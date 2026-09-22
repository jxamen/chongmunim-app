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
  plan_required: '구독한 모임에서 쓸 수 있어요',
  period_closed: '마감한 기간이에요 · 고치려면 장부에서 마감을 풀어 주세요',
  already_closed: '이미 마감했어요',
  plan_member_limit: '이 모임은 무료로 10명까지 들어올 수 있어요. 총무님께 구독을 부탁해 주세요',
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
  // 장부 파일 가져오기 — 막힌 까닭과 대신 할 수 있는 일을 같이(기획 「이유와 대안을 같이 보여주지 않으면 영원히 기다린다」)
  old_excel: '옛 엑셀(.xls)은 못 읽어요. 엑셀에서 「다른 이름으로 저장 › .xlsx」로 바꿔 올려 주세요',
  bad_file: '엑셀(.xlsx) · CSV · PDF 파일만 올릴 수 있어요',
  file_missing: '파일을 읽지 못했어요. 다시 골라 주세요',
  file_required: '파일을 고르거나 구글 시트 링크를 붙여 주세요',
  file_too_big: '파일이 너무 커요(10MB 까지). 올해 시트만 따로 저장해 올려 주세요',
  bad_sheet_url: '구글 시트 링크가 아니에요. 시트의 「공유 › 링크 복사」로 받은 주소를 붙여 주세요',
  sheet_private: '시트를 열 수 없어요. 공유를 「링크가 있는 모든 사용자」로 바꾼 뒤 다시 해 주세요',
  sheet_unreachable: '구글 시트에 닿지 않아요. 잠시 뒤 다시 해 주세요',
  import_closed: '이미 넣었거나 그만둔 가져오기예요',
  import_not_done: '아직 넣지 않은 가져오기예요',
  category_not_found: '항목이 바뀌었어요. 새로 고침한 뒤 다시 골라 주세요',
  event_not_found: '행사가 바뀌었어요. 새로 고침한 뒤 다시 골라 주세요',
  unreadable: '파일을 열지 못했어요(암호가 걸렸거나 깨진 파일). 암호를 풀어 다시 올리거나, 아래 붙여넣기로 넣어 주세요',
  no_rows: '파일에서 장부 줄을 찾지 못했어요. 장부가 있는 시트인지 확인하거나, 아래 붙여넣기로 넣어 주세요',
  ocr_failed: '파일을 끝까지 읽지 못했어요. 다시 올리거나, 아래 붙여넣기 · 기초 잔액으로 먼저 시작해 주세요',
  bad_result: '읽은 결과가 이상해요. 다시 올려 주세요',
};

export function errorText(code: string): string {
  if (TEXT[code]) return TEXT[code];
  // 넣을 줄 하나가 이상하다 — 서버가 몇 번째인지 알려 준다
  const row = /^bad_row_(\d+)$/.exec(code);
  if (row) return `${Number(row[1]) + 1}번째 줄의 날짜·금액을 다시 확인해 주세요`;
  if (/^http_5\d\d$/.test(code)) return '서버에 잠시 문제가 있어요. 잠시 뒤 다시 해 주세요';

  return '잠시 뒤 다시 해 주세요';
}

/** 던져진 것에서 코드 — ApiError·OcrError·그 밖 */
export const codeOf = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;

  return typeof c === 'string' && c ? c : 'unknown';
};
