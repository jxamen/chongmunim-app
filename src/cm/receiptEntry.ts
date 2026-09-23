/**
 * 영수증 올리기의 **순수한 부분** — 「영수증 분석」 입구(`POST receipts`, 2026-09-24 대표님 「모든 영수증은 입구를 1개로 통일」).
 * 응답 읽기 · 오류 문장 · 재시도 키. RN 에 기대지 않아 노드에서 시험한다(`receiptEntry.test.ts`). 올리기 자체는 `src/receipt.ts`.
 */
import { errorText } from './errors';

/** 입구가 돌려준 영수증 한 장 — `rejected` 는 품질 반려(흐림 등)라 장부로 넘기지 않고 사유를 보여 준다 */
export type Submitted = { id: string; status: 'pending' | 'rejected'; reason: string | null };

/** `{ receipt: { id, status, reason } }` — 모양이 어긋나면 null(올리기 실패로 본다) */
export function parseSubmitted(json: unknown): Submitted | null {
  const r = (json && typeof json === 'object' ? (json as { receipt?: unknown }).receipt : null) as
    { id?: unknown; status?: unknown; reason?: unknown } | null | undefined;
  if (!r || typeof r !== 'object') return null;
  if ((typeof r.id !== 'number' && typeof r.id !== 'string') || String(r.id) === '') return null;
  const status = r.status === 'rejected' ? 'rejected' : r.status === 'pending' ? 'pending' : null;
  if (!status) return null;

  return { id: String(r.id), status, reason: typeof r.reason === 'string' && r.reason.trim() ? r.reason.trim() : null };
}

/** 품질 반려 문장 — 서버 사유를 그대로, 없으면 다시 찍어 달라는 한 줄 */
export const rejectedNote = (reason: string | null): string => reason ?? '영수증을 읽기 어려워요. 다시 찍어 주세요';

/** 입구 오류 → 사람 말. `receipt_too_many` 는 `retryAfter`(초)를 분으로 알려 준다 */
export function receiptErrorText(code: string, data: unknown = null): string {
  switch (code) {
    case 'duplicate_receipt': return '이미 올린 영수증이에요';
    case 'receipt_daily_max': return '오늘은 영수증을 더 올릴 수 없어요. 내일 다시 해 주세요';
    case 'receipt_too_many': {
      const sec = Number((data && typeof data === 'object' ? (data as { retryAfter?: unknown }).retryAfter : 0) ?? 0);
      const min = Math.max(1, Math.ceil((Number.isFinite(sec) ? sec : 0) / 60));

      return `같은 사진을 여러 번 올렸어요. ${min}분 뒤 다시 해 주세요`;
    }
    case 'ocr_disabled': return '지금은 영수증을 읽을 수 없어요. 직접 적어 주세요';
    case 'bad_response': return '영수증을 올리지 못했어요. 다시 찍어 주세요';
    default: return errorText(code);
  }
}

/**
 * 재시도 키(uuid v4 모양) — 같은 장을 다시 올릴 때 같은 값을 보내 서버가 한 장으로 본다. 겹치지 않기만 하면 되고
 * 암호 강도는 필요 없다(이 앱에는 expo-crypto 가 없다).
 */
export function newIdempotencyKey(rand: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(rand() * 4)).toString(16);

  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
