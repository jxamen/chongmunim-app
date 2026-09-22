/**
 * 보낸 영수증 — **올리기만 이 폰에서, 읽기 · 기록 대기는 서버에서**(2026-09-22 태훈님 「올라간 영수증은 서버에 기록 안 하나?」).
 *
 * 사진을 공용 OCR 에 올리고(`ocr.submit`) 작업을 총무님 서버에 맡긴다(cm.registerReceiptJob). 그다음은 서버가 한다 — 워커가 다
 * 읽는 순간 총무님 표로 옮기고, 「나중에 기록」 묶음이면 다 읽혔을 때 푸시로 알린다(ReceiptJobs). 「기록 기다림」은 서버 목록
 * (cm.pendingReceipts)이라 폰을 바꾸거나 다시 깔아도 남는다. 이 폰에 두는 것은 **아직 못 맡긴 장**과 묶음뿐(`cm.receiptQueue`, 계정 키).
 * 읽는 중인 장이 있으면 3초마다 서버 목록을 다시 본다(보는 화면이 있을 때만). 올리기는 회원당 분당 30회라 2.1초 간격(`pacer`).
 */
import { Platform } from 'react-native';
import * as cm from './cm/api';
import { codeOf, errorText } from './cm/errors';
import type { PendingJob } from './cm/model';
import { pacer, type Queued } from './cm/shots';
import { ocr, ocrMessage, preparePhoto } from './ocr';
import { holdWebFile } from './upload';
import * as storage from './storage';

/** 이 폰에서 올리는 중인 장 — 맡기면 서버 목록으로 넘어간다 */
type Local = { key: string; gid: number; uri: string; batch: string; state: 'sending' | 'failed'; jobId: string | null; note: string | null };
/** 한 번에 보낸 묶음 — 「나중에 기록」이면 올리기가 끝난 뒤 서버에 알림을 부탁한다 */
type Batch = { gid: number; later: boolean; told: boolean; jobIds: string[] };
type Saved = { locals: Local[]; batches: Record<string, Batch> };

/** 읽기 실패를 사람 말로 — 영수증 읽기 쪽 사유는 OCR 문구, 나머지는 공통 문구 */
export const readError = (code: string): string =>
  (code === 'ocr_disabled' || code === 'ocr_failed' || code === 'timeout' || code === 'bad_response' ? ocrMessage(code) : errorText(code));

let locals: Local[] = [];
let batches: Record<string, Batch> = {};
const pending = new Map<number, PendingJob[]>();   // 서버의 기록 기다림(모임마다)
const uris = new Map<string, string>();            // 맡긴 장의 사진 — 읽는 동안 카드에 보인다(작업 번호 → 이 폰의 파일)
const webFiles = new Map<string, Blob | null>();   // 웹 미리보기 — 올릴 파일
const listeners = new Map<() => void, number>();   // 보는 화면 → 모임
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let loaded: Promise<void> | null = null;
let running = false;
const pace = pacer(2100);

const emit = () => { for (const fn of listeners.keys()) fn(); };
const save = () => storage.setJson('cm.receiptQueue', { locals, batches } satisfies Saved).catch(() => undefined);

function load(): Promise<void> {
  if (!loaded) {
    loaded = storage.getJson<Saved | unknown[]>('cm.receiptQueue').then((saved) => {
      if (Array.isArray(saved)) {
        // 앞선 판(읽기까지 폰에서 하던 때)이 적어 둔 줄 — 작업 번호가 있으면 서버에 맡기고, 못 올린 장은 버린다
        const olds = saved as { key?: string; gid?: number; uri?: string; jobId?: string | null }[];
        locals = olds.filter((q) => q.key && q.gid && q.jobId).map((q) => ({
          key: String(q.key), gid: Number(q.gid), uri: String(q.uri ?? ''), batch: 'old', state: 'sending' as const, jobId: String(q.jobId), note: null,
        }));
        batches = { old: { gid: 0, later: false, told: true, jobIds: [] } };
      } else if (saved && typeof saved === 'object') {
        const s = saved as Saved;
        // 앱이 꺼졌던 사이 올리다 멈춘 장 — 사진이 없을 수 있어 못 올림으로(작업 번호가 있으면 맡기기만 다시)
        locals = (Array.isArray(s.locals) ? s.locals : []).map((l) => (l.state === 'sending' && !l.jobId ? { ...l, state: 'failed' as const, note: '보내다 멈췄어요 · 다시 찍어 주세요' } : l));
        batches = s.batches && typeof s.batches === 'object' ? s.batches : {};
      }
      emit();
      void run();
    }).catch(() => undefined);
  }

  return loaded;
}

/** 이 모임의 카드 — 서버의 기록 기다림(보낸 차례), 그 뒤에 이 폰에서 올리는 중인 장 */
export function list(gid: number): Queued[] {
  return [
    ...(pending.get(gid) ?? []).map((p): Queued => ({
      key: p.jobId, uri: uris.get(p.jobId) ?? p.receipt?.imageUrl ?? '', state: p.state, note: p.note, receipt: p.receipt, review: p.review,
    })),
    ...locals.filter((l) => l.gid === gid).map((l): Queued => ({ key: l.key, uri: l.uri, state: l.state, note: l.note, receipt: null, review: false })),
  ];
}

/** 이 모임을 보는 화면 — 서버 목록을 받아 오고, 읽는 중이면 따라간다 */
export function subscribe(gid: number, fn: () => void): () => void {
  listeners.set(fn, gid);
  void load().then(() => refresh(gid));

  return () => { listeners.delete(fn); };
}

/** 서버의 기록 기다림을 다시 받는다 — 읽는 중인 장이 있고 보는 화면이 있으면 3초 뒤 또 */
export async function refresh(gid: number): Promise<void> {
  const t = timers.get(gid);
  if (t) { clearTimeout(t); timers.delete(gid); }
  try {
    pending.set(gid, await cm.pendingReceipts(gid));
    emit();
  } catch { /* 끊김 — 다음 차례에 */ }
  const reading = (pending.get(gid) ?? []).some((p) => p.state === 'reading') || locals.some((l) => l.gid === gid && l.state === 'sending');
  const watched = [...listeners.values()].includes(gid);
  if (reading && watched) timers.set(gid, setTimeout(() => { timers.delete(gid); void refresh(gid); }, 3000));
}

/** 보낸다 — 줄 끝에 서서 차례로 올라간다 */
export async function add(gid: number, batch: string, photos: { key: string; uri: string; file?: Blob | null }[]): Promise<void> {
  await load();
  for (const p of photos) webFiles.set(p.key, p.file ?? null);
  locals = [...locals, ...photos.map((p): Local => ({ key: p.key, gid, uri: p.uri, batch, state: 'sending', jobId: null, note: null }))];
  batches = { ...batches, [batch]: { gid, later: false, told: false, jobIds: [] } };
  void save();
  emit();
  void run();
}

/** 나중에 기록 — 이 묶음이 다 올라가면 서버에 「다 읽히면 알려 줘」를 맡긴다 */
export function later(batch: string): void {
  const b = batches[batch];
  if (!b) return;
  batches = { ...batches, [batch]: { ...b, later: true } };
  void save();
  tell(batch);
}

/** 빼기 — 올리는 중이면 이 폰에서, 맡긴 장이면 서버 기다림에서 */
export function remove(keys: string[]): void {
  if (!keys.length) return;
  const mine = locals.filter((l) => keys.includes(l.key));
  locals = locals.filter((l) => !keys.includes(l.key));
  for (const l of mine) webFiles.delete(l.key);
  for (const [gid, list] of pending) {
    for (const p of list.filter((x) => keys.includes(x.jobId))) void cm.dismissReceiptJob(gid, p.jobId).catch(() => undefined);
    pending.set(gid, list.filter((x) => !keys.includes(x.jobId)));
  }
  void save();
  emit();
}

/** 기록한 장 — 서버 목록에서도 저절로 빠지니 화면에서만 먼저 뺀다 */
export function forget(keys: string[]): void {
  for (const [gid, list] of pending) pending.set(gid, list.filter((x) => !keys.includes(x.jobId)));
  emit();
}

/** 로그아웃 — 남의 영수증이 이 폰에 남지 않게(저장 키는 clearAccount 가 지운다) */
export function reset(): void {
  locals = [];
  batches = {};
  pending.clear();
  uris.clear();
  webFiles.clear();
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  emit();
}

const set = (key: string, patch: Partial<Local>) => {
  locals = locals.map((l) => (l.key === key ? { ...l, ...patch } : l));
  void save();
  emit();
};

/** 「나중에 기록」 묶음이 다 올라갔으면 서버에 맡긴다(한 번) */
function tell(batch: string): void {
  const b = batches[batch];
  if (!b || !b.later || b.told) return;
  if (locals.some((l) => l.batch === batch && l.state === 'sending')) return;
  if (!b.jobIds.length) { batches = { ...batches, [batch]: { ...b, told: true } }; void save(); return; }
  cm.receiptsLater(b.gid, b.jobIds).then(() => {
    batches = { ...batches, [batch]: { ...batches[batch], told: true } };
    void save();
  }).catch(() => undefined);   // 못 닿으면 다음에 줄이 돌 때 다시
}

/** 줄을 돈다 — 올리고, 서버에 맡긴다. 맡기지 못했으면 조금 뒤 다시 */
async function run(): Promise<void> {
  if (running) return;
  running = true;
  let retry = false;
  try {
    for (;;) {
      const l = locals.find((x) => x.state === 'sending');
      if (!l) break;
      if (!(await send(l))) { retry = true; break; }
    }
    for (const b of Object.keys(batches)) tell(b);
  } finally {
    running = false;
  }
  if (retry) setTimeout(() => { void run(); }, 10_000);
}

/** 한 장 — 올리고 맡긴다. 끊겨서 맡기지 못했으면 false(작업 번호는 들고 있다) */
async function send(l: Local): Promise<boolean> {
  let jobId = l.jobId;
  if (!jobId) {
    try {
      const prepared = await preparePhoto({ uri: l.uri });
      for (let tries = 0; ; tries++) {
        await pace();
        if (!locals.some((x) => x.key === l.key)) return true;   // 뺐다
        if (Platform.OS === 'web') holdWebFile(webFiles.get(l.key) ?? null);
        try {
          jobId = await ocr.submit(prepared);
          break;
        } catch (e) {
          // 한도(429) — OCR 한도는 실제로 IP 기준이라 같은 와이파이의 다른 기기와 나눠 쓴다. 조금 쉬었다 다시(세 번까지)
          if (!/429|too_many|throttle|rate/i.test(codeOf(e)) || tries >= 2) throw e;
          await new Promise((r) => setTimeout(r, 15_000));
        }
      }
      set(l.key, { jobId });
    } catch (e) {
      set(l.key, { state: 'failed', note: readError(codeOf(e)) });

      return true;
    }
  }
  try {
    const job = await cm.registerReceiptJob(l.gid, jobId!);
    uris.set(job.jobId, l.uri);
    const cur = pending.get(l.gid) ?? [];
    pending.set(l.gid, cur.some((p) => p.jobId === job.jobId) ? cur : [...cur, job]);
    const b = batches[l.batch];
    if (b) batches = { ...batches, [l.batch]: { ...b, jobIds: [...b.jobIds, job.jobId] } };
    locals = locals.filter((x) => x.key !== l.key);
    webFiles.delete(l.key);
    void save();
    emit();
    void refresh(l.gid);

    return true;
  } catch (e) {
    if (codeOf(e) === 'job_not_found') { set(l.key, { state: 'failed', note: '맡기지 못했어요 · 다시 찍어 주세요' }); return true; }

    return false;   // 끊김 — 작업 번호를 들고 조금 뒤 다시
  }
}
