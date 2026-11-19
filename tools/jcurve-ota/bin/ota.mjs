#!/usr/bin/env node
// jcurve-ota — self-hosted expo-updates (protocol v1) on Cloudflare R2.
//
// Why: EAS Update bills per monthly active device above the plan quota. R2 egress is free, so
// bundles live in R2 and even the manifest is a static R2 object. Cloudflare rules on
// ota.j-curve.co.kr do the dynamic part:
//   - request transform: /{app}/manifest + expo-* headers -> /{app}/manifest/{channel}/{runtime}/{platform}
//   - response headers: expo-protocol-version: 1, expo-sfv-version: 0, cache-control: private, max-age=0
//   - cache rule: respect origin Cache-Control (manifest 30s, files 1 year)
//
// Bucket layout (jcurve-ota):
//   {app}/assets/{sha256hex}{.ext}                    immutable bundle / asset files
//   {app}/manifest/{channel}/{runtime}/{platform}      current response body (multipart/mixed)
//   {app}/updates/{updateId}.json                      manifest JSON of every published update
//   {app}/history/{channel}/{runtime}/{platform}.json  newest-first publish log
//
// expo-updates only takes an update whose createdAt is newer than the running one, so a
// rollback re-publishes an older update's files under a new id and a new createdAt.

import { AwsClient } from 'aws4fetch';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BOUNDARY = 'jcurve-ota-7f3c1a';
const MANIFEST_CACHE = 'public, max-age=30';
const ASSET_CACHE = 'public, max-age=31536000, immutable';
const CONTENT_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
  bundle: 'application/javascript', json: 'application/json', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', lottie: 'application/json',
};

function loadConfig() {
  const file = process.env.JCURVE_OTA_ENV || join(homedir(), '.config/jcurve-ota/r2.env');
  if (!existsSync(file)) fail(`config not found: ${file}`);
  const env = Object.fromEntries(
    readFileSync(file, 'utf8').split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  for (const k of ['CF_ACCOUNT_ID', 'CF_ZONE_ID', 'R2_BUCKET', 'OTA_BASE', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'CF_API_TOKEN']) {
    if (!env[k]) fail(`missing ${k} in ${file}`);
  }
  return env;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) opts[key] = true;
    else { opts[key] = next; i++; }
  }
  return { cmd, opts };
}

const sha256 = (buf) => createHash('sha256').update(buf).digest();
const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Same derivation as expo/custom-expo-updates-server: a stable UUID from content.
const uuidFromHash = (hex) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

class Store {
  constructor(cfg) {
    this.cfg = cfg;
    this.aws = new AwsClient({ accessKeyId: cfg.R2_ACCESS_KEY_ID, secretAccessKey: cfg.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
    this.endpoint = `https://${cfg.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${cfg.R2_BUCKET}`;
  }

  url(key) {
    return `${this.endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async exists(key) {
    const res = await this.aws.fetch(this.url(key), { method: 'HEAD' });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    throw new Error(`HEAD ${key} -> ${res.status}`);
  }

  async put(key, body, contentType, cacheControl) {
    const res = await this.aws.fetch(this.url(key), {
      method: 'PUT', body, headers: { 'content-type': contentType, 'cache-control': cacheControl },
    });
    if (!res.ok) throw new Error(`PUT ${key} -> ${res.status} ${await res.text()}`);
  }

  async getJson(key) {
    const res = await this.aws.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${key} -> ${res.status}`);
    return res.json();
  }

  // ListObjectsV2 — keys under a prefix, plus the next-level "folders" when a delimiter is given.
  async list(prefix, delimiter = '') {
    const keys = [];
    const prefixes = [];
    let token = '';
    do {
      const q = new URLSearchParams({ 'list-type': '2', prefix });
      if (delimiter) q.set('delimiter', delimiter);
      if (token) q.set('continuation-token', token);
      const res = await this.aws.fetch(`${this.endpoint}?${q}`);
      if (!res.ok) throw new Error(`LIST ${prefix} -> ${res.status}`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
      for (const m of xml.matchAll(/<CommonPrefixes><Prefix>([^<]+)<\/Prefix><\/CommonPrefixes>/g)) prefixes.push(m[1]);
      token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] || '';
    } while (token);
    return { keys, prefixes };
  }

  async purge(urls) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.cfg.CF_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.cfg.CF_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files: urls }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.success) console.warn(`! cache purge failed (${res.status}) — clients see the change within 30s anyway`);
  }
}

/**
 * 앱 설정을 읽는다 — `app.json` 이 없으면 `app.config.js` 도 본다.
 *
 * 새 앱은 `app.config.js` 하나만 두고 환경변수로 채널·키를 갈아 끼운다(AppTechMoa).
 * `app.json` 만 찾다가 ENOENT 로 발행이 통째로 멈췄다(2026-09-20).
 */
function readAppConfig(projectDir) {
  const jsonPath = join(projectDir, 'app.json');
  if (existsSync(jsonPath)) return JSON.parse(readFileSync(jsonPath, 'utf8')).expo;
  const jsPath = join(projectDir, 'app.config.js');
  if (!existsSync(jsPath)) fail(`no app.json or app.config.js in ${projectDir}`);
  const out = execFileSync('node', ['-e',
    `const c=require(${JSON.stringify(jsPath)});const e=(typeof c==='function'?c({config:{}}):c);process.stdout.write(JSON.stringify(e.expo||e))`
  ], { cwd: projectDir, encoding: 'utf8' });
  return JSON.parse(out);
}

function readProject(projectDir) {
  const app = readAppConfig(projectDir);
  const policy = app.runtimeVersion?.policy;
  let runtimeVersion = typeof app.runtimeVersion === 'string' ? app.runtimeVersion : null;
  if (!runtimeVersion && policy === 'appVersion') runtimeVersion = app.version;
  if (!runtimeVersion) fail(`unsupported runtimeVersion in app.json (${JSON.stringify(app.runtimeVersion)}) — use a string or policy "appVersion"`);
  const channel = app.updates?.requestHeaders?.['expo-channel-name'];
  return { runtimeVersion, channel, updatesUrl: app.updates?.url };
}

function exportProject(projectDir, platforms) {
  const out = mkdtempSync(join(tmpdir(), 'jcurve-ota-'));
  const args = ['expo', 'export', '--clear', '--output-dir', out, ...platforms.flatMap((p) => ['--platform', p])];
  console.log(`• npx ${args.join(' ')}`);
  execFileSync('npx', args, { cwd: projectDir, stdio: ['ignore', 'ignore', 'inherit'] });
  const expoConfig = JSON.parse(execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  return { out, expoConfig };
}

function multipartManifest(manifest, directive) {
  const part = (name, body) => [
    `--${BOUNDARY}`, 'content-type: application/json; charset=utf-8', `content-disposition: form-data; name="${name}"`, '', JSON.stringify(body),
  ].join('\r\n');
  const parts = [];
  if (manifest) parts.push(part('manifest', manifest), part('extensions', { assetRequestHeaders: {} }));
  if (directive) parts.push(part('directive', directive));
  return `${parts.join('\r\n')}\r\n--${BOUNDARY}--\r\n`;
}

async function writeCurrent(store, app, channel, runtimeVersion, platform, body) {
  const key = `${app}/manifest/${channel}/${runtimeVersion}/${platform}`;
  await store.put(key, body, `multipart/mixed; boundary=${BOUNDARY}`, MANIFEST_CACHE);
  return `${store.cfg.OTA_BASE}/${key}`;
}

async function appendHistory(store, app, channel, runtimeVersion, platform, entry) {
  const key = `${app}/history/${channel}/${runtimeVersion}/${platform}.json`;
  const list = (await store.getJson(key)) || [];
  list.unshift(entry);
  await store.put(key, JSON.stringify(list.slice(0, 200), null, 2), 'application/json', 'no-store');
  await reportRelease(store.cfg, { app, channel, runtimeVersion, platform, ...entry });
}

// Admin release log (jcurve-api). Optional until the server side exists: needs OTA_REPORT_URL + OTA_REPORT_KEY.
async function reportRelease(cfg, release) {
  if (!cfg.OTA_REPORT_URL) return 'off';
  // Say so instead of skipping silently — a missing key once left the admin log empty for a whole day unnoticed.
  if (!cfg.OTA_REPORT_KEY) {
    console.warn('! admin release log skipped — OTA_REPORT_KEY is not set in r2.env (R2 history still has it)');
    return 'skipped';
  }
  try {
    const res = await fetch(cfg.OTA_REPORT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ota-publish-key': cfg.OTA_REPORT_KEY },
      body: JSON.stringify(release),
    });
    if (res.ok) return 'sent';
    console.warn(`! admin release log failed (${res.status}) — R2 history still has it`);
  } catch (e) {
    console.warn(`! admin release log failed (${e.message}) — R2 history still has it`);
  }
  return 'failed';
}

// Re-send the R2 publish log to the admin release log, oldest first.
// Safe to repeat: the server upserts on (update_id, platform).
async function backfill(opts) {
  const cfg = loadConfig();
  const dryRun = !!opts['dry-run'];
  if (!dryRun && (!cfg.OTA_REPORT_URL || !cfg.OTA_REPORT_KEY)) fail('OTA_REPORT_URL and OTA_REPORT_KEY must be set in r2.env');
  const store = new Store(cfg);
  const apps = opts.app ? [opts.app] : (await store.list('', '/')).prefixes.map((p) => p.replace(/\/$/, ''));
  const tally = { sent: 0, failed: 0 };
  for (const app of apps) {
    const { keys } = await store.list(`${app}/history/`);
    for (const key of keys) {
      const [, , channel, runtimeVersion, file] = key.split('/');
      if (!file?.endsWith('.json')) continue;
      const platform = file.slice(0, -'.json'.length);
      const history = (await store.getJson(key)) || [];
      for (const entry of [...history].reverse()) {
        const release = { app, channel, runtimeVersion, platform, ...entry };
        if (dryRun) {
          console.log(`  ${app} ${channel} ${runtimeVersion} ${platform.padEnd(7)} ${entry.createdAt} ${entry.kind.padEnd(18)} ${entry.id || '-'}`);
          continue;
        }
        tally[(await reportRelease(cfg, release)) === 'sent' ? 'sent' : 'failed']++;
        await new Promise((r) => setTimeout(r, Number(opts.delay) || 1500)); // the API rate-limits (429) bursts
      }
    }
  }
  if (!dryRun) console.log(`→ admin release log: sent ${tally.sent} · failed ${tally.failed}`);
}

async function uploadFile(store, app, file, ext) {
  const buf = readFileSync(file);
  const hex = sha256(buf).toString('hex');
  const key = `${app}/assets/${hex}.${ext}`;
  const uploaded = !(await store.exists(key));
  if (uploaded) await store.put(key, buf, CONTENT_TYPES[ext] || 'application/octet-stream', ASSET_CACHE);
  return {
    info: {
      hash: base64url(sha256(buf)),
      key: createHash('md5').update(buf).digest('hex'),
      fileExtension: `.${ext}`,
      url: `${store.cfg.OTA_BASE}/${key}`,
    },
    uploaded,
    bytes: buf.length,
  };
}

async function publish(opts) {
  const cfg = loadConfig();
  const store = new Store(cfg);
  const app = opts.app || fail('--app <slug> is required (e.g. moneycapsule)');
  const projectDir = resolve(opts.project || '.');
  const project = readProject(projectDir);
  const channel = opts.channel || project.channel || fail('--channel is required (no expo-channel-name in app.json)');
  const platforms = (opts.platform || 'android,ios').split(',');
  const message = typeof opts.message === 'string' ? opts.message : '';
  const commit = (() => { try { return execFileSync('git', ['log', '--format=%h', '-1'], { cwd: projectDir, encoding: 'utf8' }).trim(); } catch { return ''; } })();

  const { out, expoConfig } = exportProject(projectDir, platforms);
  try {
    const metadata = JSON.parse(readFileSync(join(out, 'metadata.json'), 'utf8'));
    const createdAt = new Date().toISOString();
    const purgeUrls = [];
    for (const platform of platforms) {
      const fm = metadata.fileMetadata[platform];
      if (!fm) fail(`export has no ${platform} bundle`);
      const bundle = await uploadFile(store, app, join(out, fm.bundle), 'bundle');
      const assets = [];
      let newFiles = bundle.uploaded ? 1 : 0;
      for (const a of fm.assets) {
        const r = await uploadFile(store, app, join(out, a.path), a.ext);
        assets.push({ ...r.info, contentType: CONTENT_TYPES[a.ext] || 'application/octet-stream' });
        if (r.uploaded) newFiles++;
      }
      const launchAsset = { ...bundle.info, contentType: 'application/javascript' };
      const idHex = sha256(Buffer.from(`${app}|${channel}|${project.runtimeVersion}|${platform}|${launchAsset.hash}|${assets.map((x) => x.hash).join(',')}|${createdAt}`)).toString('hex');
      const manifest = {
        id: uuidFromHash(idHex),
        createdAt,
        runtimeVersion: project.runtimeVersion,
        launchAsset,
        assets,
        metadata: {},
        extra: { expoClient: expoConfig },
      };
      await store.put(`${app}/updates/${manifest.id}.json`, JSON.stringify(manifest), 'application/json', 'no-store');
      const url = await writeCurrent(store, app, channel, project.runtimeVersion, platform, multipartManifest(manifest));
      purgeUrls.push(url);
      await appendHistory(store, app, channel, project.runtimeVersion, platform, {
        id: manifest.id, createdAt, commit, message, kind: 'publish', bundleBytes: bundle.bytes, assetCount: assets.length,
      });
      console.log(`✓ ${platform}: ${manifest.id} · bundle ${(bundle.bytes / 1024 / 1024).toFixed(2)}MB · assets ${assets.length} (new files ${newFiles})`);
    }
    await store.purge(purgeUrls);
    console.log(`→ ${app} · channel ${channel} · runtime ${project.runtimeVersion} · commit ${commit || '-'}`);
    if (project.updatesUrl !== `${cfg.OTA_BASE}/${app}/manifest`) {
      console.log(`! app.json updates.url is ${project.updatesUrl || '(none)'} — builds pick this up only when it is ${cfg.OTA_BASE}/${app}/manifest`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

async function rollback(opts) {
  const cfg = loadConfig();
  const store = new Store(cfg);
  const app = opts.app || fail('--app is required');
  const channel = opts.channel || fail('--channel is required');
  const runtimeVersion = opts.runtime || fail('--runtime is required');
  const platforms = (opts.platform || 'android,ios').split(',');
  const createdAt = new Date().toISOString();
  const purgeUrls = [];
  for (const platform of platforms) {
    let body;
    let entry;
    if (opts.embedded) {
      body = multipartManifest(null, { type: 'rollBackToEmbedded', parameters: { commitTime: createdAt } });
      entry = { id: null, createdAt, kind: 'rollBackToEmbedded' };
    } else {
      const history = (await store.getJson(`${app}/history/${channel}/${runtimeVersion}/${platform}.json`)) || [];
      const targetId = typeof opts.to === 'string' ? opts.to : history.filter((h) => h.id)[1]?.id;
      if (!targetId) fail(`${platform}: no earlier update to roll back to (use --embedded)`);
      const old = await store.getJson(`${app}/updates/${targetId}.json`);
      if (!old) fail(`${platform}: update ${targetId} not found`);
      // Same files, new id + createdAt, so clients running a newer update accept it.
      const idHex = sha256(Buffer.from(`${old.id}|rollback|${createdAt}`)).toString('hex');
      const manifest = { ...old, id: uuidFromHash(idHex), createdAt };
      await store.put(`${app}/updates/${manifest.id}.json`, JSON.stringify(manifest), 'application/json', 'no-store');
      body = multipartManifest(manifest);
      entry = { id: manifest.id, createdAt, kind: 'rollback', from: targetId };
    }
    purgeUrls.push(await writeCurrent(store, app, channel, runtimeVersion, platform, body));
    await appendHistory(store, app, channel, runtimeVersion, platform, entry);
    console.log(`✓ ${platform}: ${entry.kind}${entry.from ? ` → content of ${entry.from}` : ''} ${entry.id || ''}`);
  }
  await store.purge(purgeUrls);
}

async function status(opts) {
  const store = new Store(loadConfig());
  const app = opts.app || fail('--app is required');
  const channel = opts.channel || fail('--channel is required');
  const runtimeVersion = opts.runtime || fail('--runtime is required');
  for (const platform of (opts.platform || 'android,ios').split(',')) {
    const history = (await store.getJson(`${app}/history/${channel}/${runtimeVersion}/${platform}.json`)) || [];
    console.log(`${platform}:`);
    for (const h of history.slice(0, Number(opts.limit) || 5)) {
      console.log(`  ${h.createdAt}  ${h.kind.padEnd(18)} ${h.id || '-'} ${h.commit || ''} ${h.message || ''}${h.from ? ` (from ${h.from})` : ''}`);
    }
  }
}

// Ask the public endpoint exactly like a device does, and parse the answer.
async function check(opts) {
  const cfg = loadConfig();
  const app = opts.app || fail('--app is required');
  const res = await fetch(`${cfg.OTA_BASE}/${app}/manifest`, {
    headers: {
      'expo-platform': opts.platform || 'android',
      'expo-runtime-version': opts.runtime || fail('--runtime is required'),
      'expo-channel-name': opts.channel || fail('--channel is required'),
      'expo-protocol-version': '1',
      accept: 'multipart/mixed,application/expo+json,application/json',
    },
  });
  const text = await res.text();
  console.log(`HTTP ${res.status} · content-type ${res.headers.get('content-type')} · expo-protocol-version ${res.headers.get('expo-protocol-version')} · expo-sfv-version ${res.headers.get('expo-sfv-version')} · cache-control ${res.headers.get('cache-control')} · cf-cache-status ${res.headers.get('cf-cache-status')}`);
  const m = text.match(/name="manifest"\r\n\r\n(.*?)\r\n--/s);
  const d = text.match(/name="directive"\r\n\r\n(.*?)\r\n--/s);
  if (m) {
    const man = JSON.parse(m[1]);
    console.log(`manifest ${man.id} · createdAt ${man.createdAt} · runtime ${man.runtimeVersion} · assets ${man.assets.length}`);
    const a = await fetch(man.launchAsset.url);
    const buf = Buffer.from(await a.arrayBuffer());
    const ok = base64url(sha256(buf)) === man.launchAsset.hash;
    console.log(`launchAsset ${a.status} · ${(buf.length / 1024 / 1024).toFixed(2)}MB · hash ${ok ? 'OK' : 'MISMATCH'} · cf-cache-status ${a.headers.get('cf-cache-status')}`);
  } else if (d) {
    console.log(`directive ${d[1]}`);
  } else {
    console.log(text.slice(0, 300));
  }
}

const HELP = `jcurve-ota — self-hosted expo-updates on R2 (ota.j-curve.co.kr)

  publish  --app <slug> --project <dir> [--channel preview] [--platform android,ios] [--message "..."]
  rollback --app <slug> --channel <ch> --runtime <ver> [--platform android,ios] [--to <updateId> | --embedded]
  status   --app <slug> --channel <ch> --runtime <ver> [--platform android,ios] [--limit 5]
  check    --app <slug> --channel <ch> --runtime <ver> [--platform android]
  backfill [--app <slug>] [--dry-run]     re-send the R2 publish log to the admin release log

App side: app.json expo.updates.url = https://ota.j-curve.co.kr/<slug>/manifest (needs one native build).
Credentials: ~/.config/jcurve-ota/r2.env (0600) or JCURVE_OTA_ENV.`;

const { cmd, opts } = parseArgs(process.argv.slice(2));
const commands = { publish, rollback, status, check, backfill };
if (!commands[cmd]) { console.log(HELP); process.exit(cmd ? 1 : 0); }
commands[cmd](opts).catch((e) => fail(e.message));
