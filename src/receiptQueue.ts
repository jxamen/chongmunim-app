/**
 * 영수증 읽기 줄 — **기록 화면과 떨어져 돈다**(2026-09-22 태훈님 「전송하기를 누르면 그때 올라가고, 지금 기록할지 나중에 기록할지」).
 *
 * 보낸 장은 여기서 올리고(`ocr.submit`) · 결과를 보고(`ocr.status`) · 총무님 표로 옮긴다(cm.attachReceipt). 기록 화면을 닫아도
 * 계속 돌고, 앱을 껐다 켜도 읽는 중이던 장을 이어서 본다(작업 번호를 이 기기에 적어 둔다 — `cm.receiptQueue`, 계정 키).
 * 기록하거나 빼면 줄에서 지운다. 홈의 「영수증 N장 기록 기다림」과 기록 화면이 같은 줄을 본다.
 *
 * OCR 은 회원당 분당 30회라 올리기 · 결과 보기가 모두 2.1초 간격으로 줄을 선다(`pacer`, 한 줄이라 화면이 둘이어도 겹치지 않는다).
 */
import { Platform } from 'react-native';
import * as cm from './cm/api';
import { codeOf, errorText } from './cm/errors';
import type { Receipt } from './cm/model';
import { pacer } from './cm/shots';
import { ocr, ocrMessage, preparePhoto, verdictMessage } from './ocr';
import { holdWebFile } from './upload';
import * as storage from './storage';

export type QItem = {
  key: string;
  gid: number;
  uri: string;
  /** sending: 올리는 중 · reading: 워커가 읽는 중 · ready: 읽음(receipt) · failed: 못 읽음(note) */
  state: 'sending' | 'reading' | 'ready' | 'failed';
  jobId: string | null;
  /** 이때까지 못 읽으면 포기 */
  until: number;
  note: string | null;
  receipt: Receipt | null;
  /** 몇 칸이 자신 없다(verdict review) — 카드가 칸을 열어 둔다 */
  review: boolean;
};

/** 읽기 실패를 사람 말로 — 영수증 읽기 쪽 사유는 OCR 문구, 나머지는 공통 문구 */
export const readError = (code: string): string =>
  (code === 'ocr_disabled' || code === 'ocr_failed' || code === 'timeout' || code === 'bad_response' ? ocrMessage(code) : errorText(code));

let items: QItem[] = [];
let loaded: Promise<void> | null = null;
let running = false;
const listeners = new Set<() => void>();
const webFiles = new Map<string, Blob | null>();   // 웹 미리보기 — 올릴 파일(기기에 적지 않는다)
const pace = pacer(2100);

const emit = () => { for (const fn of listeners) fn(); };
const save = () => storage.setJson('cm.receiptQueue', items).catch(() => undefined);
const set = (key: string, patch: Partial<QItem>) => {
  items = items.map((q) => (q.key === key ? { ...q, ...patch } : q));
  void save();
  emit();
};

function load(): Promise<void> {
  if (!loaded) {
    loaded = storage.getJson<QItem[]>('cm.receiptQueue').then((saved) => {
      const now = Date.now();
      // 앱이 꺼졌던 사이 — 올리다 멈춘 장은 사진이 없을 수 있어 못 읽음으로, 읽던 장은 기다림을 다시 준다
      const back = (Array.isArray(saved) ? saved : []).map((q): QItem => (q.state === 'sending'
        ? { ...q, state: 'failed', note: '보내다 멈췄어요 · 다시 찍어 주세요' }
        : q.state === 'reading' ? { ...q, until: now + 60_000 } : q));
      items = [...back, ...items.filter((q) => !back.some((b) => b.key === q.key))];
      emit();
      void run();
    }).catch(() => undefined);
  }

  return loaded;
}

/** 이 모임의 줄 — 보낸 차례대로 */
export const list = (gid: number): QItem[] => items.filter((q) => q.gid === gid);

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  void load();

  return () => { listeners.delete(fn); };
}

/** 보낸다 — 줄 끝에 서서 차례로 올라간다 */
export async function add(gid: number, photos: { key: string; uri: string; file?: Blob | null }[]): Promise<void> {
  await load();
  for (const p of photos) webFiles.set(p.key, p.file ?? null);
  items = [...items, ...photos.map((p): QItem => ({
    key: p.key, gid, uri: p.uri, state: 'sending', jobId: null, until: 0, note: null, receipt: null, review: false,
  }))];
  void save();
  emit();
  void run();
}

/** 기록했거나 뺀 장 */
export function remove(keys: string[]): void {
  if (!keys.length) return;
  items = items.filter((q) => !keys.includes(q.key));
  for (const k of keys) webFiles.delete(k);
  void save();
  emit();
}

/** 로그아웃 — 남의 영수증이 이 폰에 남지 않게(저장 키는 clearAccount 가 지운다) */
export function reset(): void {
  items = [];
  webFiles.clear();
  emit();
}

const live = (key: string) => items.some((q) => q.key === key);

/** 줄을 돈다 — 먼저 올릴 것을 모두 올리고, 읽는 중인 것을 돌아가며 본다 */
async function run(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const sending = items.find((q) => q.state === 'sending');
      if (sending) { await send(sending); continue; }
      const reading = items.filter((q) => q.state === 'reading');
      if (!reading.length) break;
      for (const q of reading) {
        if (!live(q.key)) continue;
        await look(q);
      }
    }
  } finally {
    running = false;
  }
}

async function send(q: QItem): Promise<void> {
  try {
    const prepared = await preparePhoto({ uri: q.uri });
    let id = '';
    for (let tries = 0; ; tries++) {
      await pace();
      if (!live(q.key)) return;
      if (Platform.OS === 'web') holdWebFile(webFiles.get(q.key) ?? null);
      try {
        id = await ocr.submit(prepared);
        break;
      } catch (e) {
        // 한도(429) — OCR 한도는 실제로 IP 기준이라 같은 와이파이의 다른 기기와 나눠 쓴다. 조금 쉬었다 다시(세 번까지)
        if (!/429|too_many|throttle|rate/i.test(codeOf(e)) || tries >= 2) throw e;
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }
    // 워커는 한 장씩 읽는다 — 앞에 읽는 중인 장이 많을수록 기다림을 늘려 준다
    const ahead = items.filter((x) => x.state === 'reading').length;
    set(q.key, { state: 'reading', jobId: id, until: Date.now() + 60_000 + ahead * 15_000 });
  } catch (e) {
    set(q.key, { state: 'failed', note: readError(codeOf(e)) });
  }
}

async function look(q: QItem): Promise<void> {
  await pace();
  if (!live(q.key) || !q.jobId) return;
  let st: Awaited<ReturnType<typeof ocr.status>> | null = null;
  try { st = await ocr.status(q.jobId); } catch { /* 한도(429) · 끊김 — 다음 차례에 다시 본다 */ }
  if (st?.status === 'done' && st.result) {
    if (st.result.verdict === 'rejected') { set(q.key, { state: 'failed', note: verdictMessage(st.result) }); return; }
    try {
      const rc = await cm.attachReceipt(q.gid, q.jobId);
      set(q.key, { state: 'ready', receipt: rc, review: st.result.verdict === 'review' });
    } catch (e) {
      set(q.key, { state: 'failed', note: readError(codeOf(e)) });
    }
    return;
  }
  if (st?.status === 'failed') { set(q.key, { state: 'failed', note: ocrMessage('ocr_failed') }); return; }
  if (Date.now() > q.until) set(q.key, { state: 'failed', note: ocrMessage('timeout') });
}
