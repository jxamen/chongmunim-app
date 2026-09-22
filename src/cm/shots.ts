/**
 * 영수증 여러 장 — 한 장 한 장의 상태와, 읽은 값을 장부 한 줄로 옮기는 규칙(화면은 `ReceiptShots`).
 *
 * 찍으면 읽은 값이 **확인 카드**로 뜬다(2026-09-22 태훈님 「알아서 채워지는데 매번 입력 창이 뜨는 게 이상」). 입력칸은
 * 「고치기」를 눌렀을 때만. 그래서 카드가 들고 있는 값(`form`)은 처음엔 영수증에서 온 것이고, 사람이 고치면 그 값이다.
 */
import type { Receipt } from './model';
import { readAmount, readWhen, won } from './format';

/** 한 번에 올리는 장 수 — 워커는 한 장씩 읽는다(10장이면 2분 남짓) */
export const MAX_SHOTS = 10;

export type ShotForm = {
  merchant: string; amount: string; date: string; time: string;
  categoryId: number | null; eventId: number | null; memo: string;
};

export type Shot = {
  key: string;
  uri: string;
  state: 'reading' | 'ready' | 'failed';
  /** 못 읽은 까닭 · 저장 실패 사유 */
  note: string | null;
  receipt: Receipt | null;
  form: ShotForm;
  /** 입력칸을 연 카드 */
  editing: boolean;
  /** 사람이 행사를 골랐다 — 그 뒤로는 날짜에 맞춰 바꾸지 않는다 */
  eventTouched: boolean;
};

export const emptyForm = (today: string): ShotForm => ({ merchant: '', amount: '', date: today, time: '', categoryId: null, eventId: null, memo: '' });

export function newShot(key: string, uri: string, today: string): Shot {
  return { key, uri, state: 'reading', note: null, receipt: null, form: emptyForm(today), editing: false, eventTouched: false };
}

/** 영수증에서 읽은 값으로 카드를 채운다 — 항목은 같은 가게에 지난번 붙인 것(제안) */
export function formFrom(rc: Receipt, today: string): ShotForm {
  const hm = rc.paidAt ? rc.paidAt.slice(11, 16) : '';

  return {
    merchant: rc.merchant ?? '',
    amount: rc.total ? won(rc.total) : '',
    date: rc.paidAt ? rc.paidAt.slice(0, 10) : today,
    time: hm === '00:00' ? '' : hm,
    categoryId: rc.suggestCategoryId,
    eventId: null,
    memo: '',
  };
}

/** 읽기 줄(`receiptQueue`)의 한 장 — 카드가 보는 만큼만 */
export type Queued = { key: string; uri: string; state: 'sending' | 'reading' | 'ready' | 'failed'; note: string | null; receipt: Receipt | null; review: boolean };

/**
 * 줄의 상태로 카드를 맞춘다 — 줄에 있는 차례대로. **이미 읽혀 사람이 보고 있는 카드는 그대로 둔다**(고친 값 · 저장 실패 사유를
 * 지우지 않게). 새로 읽힌 장만 영수증 값으로 채우고, 행사는 사람이 고르기 전이면 날짜로 제안한다(`suggest`).
 */
export function mergeShots(cur: Shot[], queue: Queued[], today: string, suggest: (ymd: string | null) => number | null): Shot[] {
  return queue.map((q) => {
    const old = cur.find((s) => s.key === q.key);
    if (old && old.state === 'ready' && q.state === 'ready') return old;
    const base = old ?? newShot(q.key, q.uri, today);
    if (q.state === 'ready' && q.receipt) {
      const f = formFrom(q.receipt, today);

      return {
        ...base, uri: q.uri, state: 'ready', receipt: q.receipt,
        note: q.review ? '몇 칸은 자신이 없어요. 한 번 봐 주세요' : null,
        editing: q.review,   // 자신 없는 영수증은 칸을 열어 둔다
        form: { ...f, eventId: base.eventTouched ? base.form.eventId : suggest(/^\d{4}-\d{2}-\d{2}$/.test(f.date) ? f.date : null) },
      };
    }

    return { ...base, uri: q.uri, state: q.state === 'failed' ? 'failed' : 'reading', note: q.note, editing: false };
  });
}

/** 이미 장부에 적은 바로 그 영수증(같은 사진) — 서버가 receipt_used 로 거절한다 */
export const isUsed = (s: Shot): boolean => !!s.receipt?.duplicate?.used;

/** 금액이나 날짜를 영수증과 다르게 적었다 — 장부에 「영수증과 다름」이 붙는다 */
export function isEdited(s: Shot): boolean {
  const rc = s.receipt;
  if (!rc) return false;
  const when = readWhen(s.form.date, s.form.time);
  const amt = readAmount(s.form.amount);

  return (rc.total !== null && amt !== rc.total) || (!!rc.paidAt && when !== null && rc.paidAt.slice(0, 10) !== when.slice(0, 10));
}

/** 장부 한 줄(또는 지급 요청)로 보낼 몸 — 못 보내는 카드면 null */
export function shotBody(s: Shot): {
  amount: number; occurredAt: string; merchant: string | null; categoryId: number | null; eventId: number | null; memo: string | null; receiptId: string;
} | null {
  if (s.state !== 'ready' || !s.receipt || isUsed(s)) return null;
  const amount = readAmount(s.form.amount);
  const occurredAt = readWhen(s.form.date, s.form.time);
  if (!amount || !occurredAt) return null;

  return {
    amount, occurredAt, merchant: s.form.merchant.trim() || null, categoryId: s.form.categoryId, eventId: s.form.eventId,
    memo: s.form.memo.trim() || null, receiptId: s.receipt.id,
  };
}

/** 산 것 한 줄 — 「생수 ×6 · 종이컵 ×2 외 3가지」 */
export function itemsLine(items: Receipt['items'], max = 3): string {
  const head = items.slice(0, max).map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`).join(' · ');

  return items.length > max ? `${head} 외 ${items.length - max}가지` : head;
}

/**
 * 요청 간격 — OCR 은 회원당 **분당 30회**(올리기 · 결과 보기를 합쳐, 서버 `throttle:30,1,ocr`). 여러 장을 한꺼번에
 * 1.5초마다 보면 금방 429 가 난다 — 모든 OCR 요청이 이 줄을 서서 `gap` 마다 하나씩 나간다.
 */
export function pacer(gap: number, now: () => number = Date.now, wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let next = 0;

  return async (): Promise<void> => {
    const t = now();
    const at = Math.max(t, next);
    next = at + gap;
    if (at > t) await wait(at - t);
  };
}
