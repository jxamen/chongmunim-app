/**
 * 보낸 영수증 — **올리기만 이 폰에서, 읽기 · 기록 대기는 서버에서**(2026-09-22 태훈님 「올라간 영수증은 서버에 기록 안 하나?」).
 *
 * 사진을 「영수증 분석」 입구에 올리고(`submitReceipt` — 2026-09-24 대표님 「모든 영수증은 입구를 1개로 통일」) 받아 준 장을
 * 총무님 서버에 맡긴다(cm.registerReceipt). 품질 반려(흐림 등)는 입구가 바로 알려 주므로 맡기지 않고 사유를 보인다.
 * 그다음은 서버가 한다 — 다 읽는 순간 총무님 표로 옮기고, 「나중에 기록」 묶음이면 다 읽혔을 때 푸시로 알린다(ReceiptJobs). 「기록 기다림」은 서버 목록
 * (cm.pendingReceipts)이라 폰을 바꾸거나 다시 깔아도 남는다. 이 폰에 두는 것은 **아직 못 맡긴 장**과 묶음뿐(`cm.receiptQueue`, 계정 키).
 * 읽는 중인 장이 있으면 3초마다 서버 목록을 다시 본다(보는 화면이 있을 때만). 올리기는 회원당 분당 30회라 2.1초 간격(`pacer`).
 */
import { Platform } from 'react-native';
import * as cm from './cm/api';
import { codeOf } from './cm/errors';
import type { PendingJob } from './cm/model';
import { pacer, type Queued } from './cm/shots';
import { newIdempotencyKey, receiptErrorText, rejectedNote, throttleWaitMs } from './cm/receiptEntry';
import { holdWebFile, submitReceipt } from './receipt';
import * as storage from './storage';

/** 이 폰에서 올리는 중인 장 — 맡기면 서버 목록으로 넘어간다 */
type Local = {
  key: string; gid: number; uri: string; batch: string; state: 'sending' | 'failed'; note: string | null;
  /** 입구가 받아 준 영수증 번호 — 있으면 올리기는 끝났고 맡기기만 남았다 */
  receiptId?: string | null;
  /** 재시도 키 — 끊겨서 다시 올려도 서버가 한 장으로 본다 */
  idem?: string;
  /** 앞선 판(공용 판독)이 남긴 작업 번호 — 업데이트 순간 맡기지 못한 장만. 새 장은 쓰지 않는다 */
  jobId: string | null;
};
/** 한 번에 보낸 묶음 — 「나중에 기록」이면 올리기가 끝난 뒤 서버에 알림을 부탁한다 */
type Batch = { gid: number; later: boolean; told: boolean; jobIds: string[] };
type Saved = { locals: Local[]; batches: Record<string, Batch> };

/** 올리기 실패를 사람 말로 — 입구 사유(이미 올림 · 오늘 한도 · 반복)는 입구 문장, 나머지는 공통 문장 */
const readError = (e: unknown): string => receiptErrorText(codeOf(e), (e as { data?: unknown })?.data ?? null);

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
        locals = (Array.isArray(s.locals) ? s.locals : []).map((l) => (l.state === 'sending' && !l.jobId && !l.receiptId && !l.idem
          ? { ...l, state: 'failed' as const, note: '보내다 멈췄어요 · 다시 찍어 주세요' } : l));
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
  locals = [...locals, ...photos.map((p): Local => ({
    key: p.key, gid, uri: p.uri, batch, state: 'sending', receiptId: null, idem: newIdempotencyKey(), jobId: null, note: null,
  }))];
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

/** 한 장 — 입구에 올리고 장부에 맡긴다. 끊겨서 맡기지 못했으면 false(받아 준 번호는 들고 있다) */
async function send(l: Local): Promise<boolean> {
  let receiptId = l.receiptId ?? null;
  if (!receiptId && !l.jobId) {
    const idem = l.idem ?? newIdempotencyKey();
    if (!l.idem) set(l.key, { idem });
    try {
      let got: Awaited<ReturnType<typeof submitReceipt>> | null = null;
      let throttled = false;
      for (let tries = 0; ; tries++) {
        await pace();
        if (!locals.some((x) => x.key === l.key)) return true;   // 뺐다
        if (Platform.OS === 'web') holdWebFile(webFiles.get(l.key) ?? null);
        try {
          got = await submitReceipt(l.uri, idem);
          break;
        } catch (e) {
          // 같은 재시도 키라 다시 올려도 두 장이 되지 않는다. 이미 올림 · 오늘 한도 · 같은 사진 반복(receipt_too_many)은
          // 다시 해도 같다 — 바로 사유를 보인다. 일반 스로틀(429)은 서버가 준 만큼 쉬고 **한 번만**, 끊김 · 5xx 는 15초씩 세 번까지
          const code = codeOf(e);
          if (code === 'http_429' && !throttled) {
            throttled = true;
            await new Promise((r) => setTimeout(r, throttleWaitMs((e as { data?: unknown })?.data)));
            continue;
          }
          if (!/^(network|timeout|http_5\d\d)$/.test(code) || tries >= 2) throw e;
          await new Promise((r) => setTimeout(r, 15_000));
        }
      }
      if (got.status === 'rejected') {
        set(l.key, { state: 'failed', note: rejectedNote(got.reason) });

        return true;
      }
      receiptId = got.id;
      set(l.key, { receiptId });
    } catch (e) {
      set(l.key, { state: 'failed', note: readError(e) });

      return true;
    }
  }
  try {
    const job = receiptId ? await cm.registerReceipt(l.gid, receiptId) : await cm.registerReceiptJob(l.gid, l.jobId!);
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
    const code = codeOf(e);
    if (code === 'job_not_found' || code === 'receipt_not_found') { set(l.key, { state: 'failed', note: '맡기지 못했어요 · 다시 찍어 주세요' }); return true; }

    return false;   // 끊김 — 받아 준 번호를 들고 조금 뒤 다시
  }
}
