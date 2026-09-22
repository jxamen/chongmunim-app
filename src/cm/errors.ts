/**
 * 서버 오류 → 코드 한 단어 → **그 사람이 할 수 있는 일**로 된 문장.
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`errors.test.ts`).
 */

/** 서버 오류 본문에서 코드 한 단어 — 우리 경로는 `error`, 라라벨 기본(abort·검증)은 `message` */
export function errorCode(status: number, json: unknown): string {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (typeof j.error === 'string' && j.error) return j.error;
  if (status === 422 && j.errors && typeof j.errors === 'object') return 'invalid';
  if (typeof j.message === 'string' && /^[a-z][a-z0-9_]*$/.test(j.message)) return j.message;

  return 'http_' + status;
}

const TEXT: Record<string, string> = {
  network: '인터넷 연결을 확인해 주세요',
  timeout: '응답이 늦어요. 잠시 뒤 다시 해 주세요',
  unauthorized: '로그인이 풀렸어요. 다시 로그인해 주세요',
  not_found: '찾을 수 없어요. 새로 고침해 주세요',
  not_manager: '총무·관리자만 할 수 있어요',
  not_owner: '총무만 할 수 있어요',
  bad_code: '초대 코드를 다시 확인해 주세요',
  name_required: '이름을 적어 주세요',
  amount_required: '금액을 적어 주세요',
  bad_date: '날짜를 다시 확인해 주세요',
  bad_category: '항목을 다시 골라 주세요',
  bad_event: '행사를 다시 골라 주세요',
  receipt_used: '이미 장부에 올린 영수증이에요',
  receipt_not_found: '영수증을 찾을 수 없어요. 다시 찍어 주세요',
  receipt_file_missing: '사진을 읽지 못했어요. 다시 찍어 주세요',
  job_not_done: '영수증을 아직 읽는 중이에요. 잠시만 기다려 주세요',
  bank_required: '먼저 지급받을 계좌를 적어 주세요',
  already_decided: '이미 처리된 요청이에요',
  already_paid: '이미 납부로 표시했어요',
  dues_amount_required: '설정에서 월 회비를 먼저 정해 주세요',
  dues_locked: '회비 기록은 모임 › 회비에서 고쳐 주세요',
  owner_locked: '총무는 총무 넘기기로만 바꿀 수 있어요',
  owner_must_transfer: '총무를 넘긴 뒤에 나갈 수 있어요',
  no_app: '앱을 쓰는 회원에게만 넘길 수 있어요',
  already_sent: '이미 보낸 공지예요',
  text_required: '제목과 내용을 적어 주세요',
  too_many_groups: '만들 수 있는 모임 수를 넘었어요',
  ocr_disabled: '지금은 영수증을 읽을 수 없어요. 직접 적어 주세요',
  invalid: '적은 내용을 다시 확인해 주세요',
  api_unavailable: '서버에 닿지 않아요. 잠시 뒤 다시 해 주세요',
};

export function errorText(code: string): string {
  if (TEXT[code]) return TEXT[code];
  if (/^http_5\d\d$/.test(code)) return '서버에 잠시 문제가 있어요. 잠시 뒤 다시 해 주세요';

  return '잠시 뒤 다시 해 주세요';
}

/** 던져진 것에서 코드 — ApiError·OcrError·그 밖 */
export const codeOf = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;

  return typeof c === 'string' && c ? c : 'unknown';
};
