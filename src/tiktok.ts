/**
 * 틱톡 광고 전환(이벤트 관리자) — 2026-10-02 대표님 「다른 앱 전부 틱톡 SDK(iOS · 안드)」(먼저 넣은 앱들의 `src/tiktok.ts` 와 같은 모양).
 *
 * 보내는 것:
 *  ① 설치 · 실행 — SDK 가 스스로 센다(InstallApp · LaunchAPP).
 *  ② 회원가입 — `track('signup_done')` → Registration.
 *  ③ 로그인 · 세션 복원 — 회원 ID 만으로 identify(이름 · 전화 · 이메일은 보내지 않는다). 로그아웃 · 세션 만료 → logout.
 *  ④ 광고 열람 — 보상형 광고가 화면에 뜬 순간 → InAppADImpr(보상형 광고가 있는 앱만 부른다).
 *  인앱 결제 자동 추적은 끈다(네이티브 모듈 `disableAutoIapTrack`).
 *
 * **열쇠(accessToken = App Secret)와 틱톡 앱 ID 는 번들 · 저장소에 굽지 않는다.** 어드민 「앱 설정」의
 * `{그룹}.tiktok_sdk_access`(안드 전용 시크릿이 다르면 `{그룹}.tiktok_android_sdk_access`) ·
 * `{그룹}.tiktok_app_id_ios` · `{그룹}.tiktok_app_id_android` 를 켤 때 읽어 넣는다(`tiktok.map.ts`).
 * 그 플랫폼 앱 ID 나 시크릿이 비면 켜지 않는다(앱은 그대로 돈다).
 *
 * ATT 창은 여기서 띄우지 않는다(SDK 1.7.2 도 스스로 묻지 않는다). 앱이 이미 ATT 를 묻는다면 그 답을
 * 기다린 뒤 켠다(`configureTikTok({ waitForAtt })`) — 허용 전에 켜면 설치가 IDFA 없이 나간다. 답이 오래 안 오면(30초) 그냥 켠다.
 * 안드로이드에는 ATT 가 없다 — 기다리지 않고 켠다(광고 ID 는 SDK 가 읽는다).
 *
 * **네이티브 모듈이 없는 빌드에서도 같은 JS 가 돈다**(OTA 로 지금 깔린 판에 내려가도). 모듈을 먼저 찾고,
 * 없으면 전부 아무 일도 하지 않는다(`requireOptionalNativeModule`).
 */

type Native = {
  initialize(accessToken: string, appId: string, tiktokAppId: string, debug: boolean): Promise<string | null>;
  trackStandard(key: StandardKey): void;
  trackCustom(name: string, properties?: Record<string, string | number | boolean>): void;
  identify(externalId: string, userName: string | null, phone: string | null, email: string | null): void;
  logout(): void;
  updateAccessToken(accessToken: string): void;
};

import { tiktokEventFor, tiktokIds, tiktokSecret, type StandardKey } from './tiktok.map';

export {
  TIKTOK_ANDROID_CONFIG_KEY, TIKTOK_APP_ID_ANDROID_KEY, TIKTOK_APP_ID_IOS_KEY, TIKTOK_CONFIG_KEY,
} from './tiktok.map';

/** app.json 의 extra(앱스토어 번호 · 패키지 이름) — 켤 때 읽는다(아래 react-native 과 같은 이유로 import 하지 않는다) */
function extra(): Record<string, unknown> {
  try {
    const c = require('expo-constants') as { default?: { expoConfig?: { extra?: Record<string, unknown> } } };
    return c.default?.expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

/*
 | `react-native` 은 위에서 import 하지 않는다 — 계측(`track`)이 이 파일을 부르고, 노드에서 도는 테스트들이
 | 그 파일을 읽는다(Flow 로 쓴 react-native 진입점은 노드가 못 읽는다). 기기에서는 똑같다.
 */
function os(): string {
  try {
    return (require('react-native') as { Platform: { OS: string } }).Platform.OS;
  } catch {
    return '';
  }
}

let native: Native | null | undefined;

function mod(): Native | null {
  if (native === undefined) {
    native = null;
    try {
      const o = os();
      if (o === 'ios' || o === 'android') {
        // 모듈이 없는 빌드에서는 null 을 준다(던지지 않는다)
        const core = require('expo-modules-core') as { requireOptionalNativeModule?: (n: string) => unknown };
        native = (core.requireOptionalNativeModule?.('TikTokBusiness') as Native | null) ?? null;
      }
    } catch {
      native = null;
    }
  }

  return native ?? null;
}

/** 앱마다 다른 것 — 시험 빌드인가(테스트 이벤트 코드 · 로그), iOS 에서 기다릴 ATT 답 */
type Hooks = { isDebug?: () => boolean; waitForAtt?: () => Promise<unknown> };
let hooks: Hooks = {};

export function configureTikTok(h: Hooks): void {
  hooks = { ...hooks, ...h };
}

function debugOn(): boolean {
  try { return !!hooks.isDebug?.(); } catch { return false; }
}

const ATT_WAIT_MS = 30000;
function attSettled(): Promise<void> {
  if (os() !== 'ios' || !hooks.waitForAtt) return Promise.resolve();
  try {
    return Promise.race([
      hooks.waitForAtt().then(() => undefined, () => undefined),
      new Promise<void>((ok) => setTimeout(ok, ATT_WAIT_MS)),
    ]);
  } catch {
    return Promise.resolve();
  }
}

let state: 'off' | 'starting' | 'on' = 'off';
let token = '';
let pending: (() => void)[] = [];
let lastIdentity: string | null = null;

/** 초기화 전에 생긴 이벤트는 잠깐 모아 둔다(켜자마자 가입하는 사람) — 넘치면 오래된 것부터 버린다 */
function whenOn(fn: () => void): void {
  if (state === 'on') { fn(); return; }
  pending.push(fn);
  if (pending.length > 20) pending = pending.slice(-20);
}

/**
 * 어드민 값(`content/config/custom` 의 values)을 받은 뒤 부른다 — 여러 번 불러도 된다
 * (처음 한 번만 켜고, 열쇠가 바뀌면 바꿔 끼운다). 시크릿과 그 플랫폼 틱톡 앱 ID 가 둘 다 있어야 켠다.
 */
export function startTikTok(values: Record<string, unknown> | null | undefined): void {
  const m = mod();
  if (!m) return;
  const next = tiktokSecret(os(), values);
  if (!next) return;

  if (state === 'on') {
    if (next !== token) {
      token = next;
      try { m.updateAccessToken(next); } catch { /* 계측이 앱을 막지 않는다 */ }
    }
    return;
  }
  if (state === 'starting') return;

  const ids = tiktokIds(os(), extra(), values);
  if (!ids) return;

  state = 'starting';
  token = next;
  const debug = debugOn();
  attSettled().then(() => m.initialize(token, ids.appId, ids.tiktokAppId, debug)).then((code) => {
    state = 'on';
    // 시험 빌드에서만 — 이벤트 관리자 › 테스트 이벤트에 넣는 코드(로그캣 · 콘솔에서 읽는다)
    if (debug) console.log('[tiktok] on · test event code', code ?? '(none)');
    const run = pending;
    pending = [];
    run.forEach((fn) => { try { fn(); } catch { /* 하나가 실패해도 나머지는 보낸다 */ } });
  }).catch((e: unknown) => {
    state = 'off';
    if (debug) console.log('[tiktok] init failed', e instanceof Error ? e.message : String(e));
  });
}

/** 계측(`track`)이 부른다 — 틱톡이 받는 이름일 때만 보낸다 */
export function tiktokTrack(name: string, params?: Record<string, unknown>): void {
  const m = mod();
  if (!m) return;
  const ev = tiktokEventFor(name, params);
  if (!ev) return;
  whenOn(() => {
    if ('standard' in ev) m.trackStandard(ev.standard);
    else m.trackCustom(ev.custom);
  });
}

/** 보상형 광고가 화면에 뜬 순간 */
export function tiktokAdImpression(): void {
  const m = mod();
  if (!m) return;
  whenOn(() => m.trackStandard('ad_impression'));
}

/** 로그인 · 세션 복원 — 회원 ID 만 보낸다(이름 · 전화 · 이메일은 보내지 않는다) */
export function tiktokIdentify(memberId: string | number | null | undefined): void {
  const m = mod();
  if (!m || memberId == null || memberId === '') return;
  const id = String(memberId);
  if (id === lastIdentity) return;
  lastIdentity = id;
  // 켜지기 전에 로그아웃했으면 모아 둔 identify 는 버린다(나갈 때 그 사람이 아직 그 사람인지 본다)
  whenOn(() => { if (lastIdentity === id) m.identify(id, null, null, null); });
}

export function tiktokLogout(): void {
  const m = mod();
  lastIdentity = null;
  if (!m || state !== 'on') return;
  try { m.logout(); } catch { /* 계측이 앱을 막지 않는다 */ }
}
