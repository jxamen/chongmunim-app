/**
 * 구독 — 모임마다(2026-09-22 태훈님 결정). 무료는 계속 쓸 수 있고 체험은 없다.
 *
 *  무료  혼자 쓰기 — 영수증 올리기(한 번에 한 장) · 장부 보기 · 엑셀 내려받기, 그리고 10명까지 초대해 **같이 보기만**
 *  구독  월 5,500원(2026-09-22 태훈님 — 앱스토어 가격표에 4,900원이 없어 5,500원) — 그 밖 전부: 여러 장 한 번에 · 인원 제한 없음 · 운영자 · 지급 요청 · 회비 · 공지 · 행사 · 예산 ·
 *        결산서 PDF · 공개 장부 링크 · 쓰던 장부 가져오기
 *
 * 서버가 막는 것은 `plan_required`(403)로 온다 — 앱은 그걸 받으면 구독 안내를 띄운다(store `fail`).
 * 앱에서만 되는 것(여러 장 · PDF)은 앱이 먼저 막는다. 결제(앱 안 구독)는 출시 직전에 붙인다.
 */
export const PLAN_PRICE = 5500;

export const FREE_FEATURES = [
  '영수증 올리기 · 한 번에 한 장',
  '장부 보기 · 엑셀 내려받기',
  '10명까지 초대해 같이 보기',
] as const;

export const PRO_FEATURES = [
  '영수증 여러 장 한 번에',
  '인원 제한 없이 초대 · 운영자 두기',
  '회원 지급 요청 · 회비 체크·미납 안내',
  '공지 · 행사 알림',
  '예산 · 결산서 PDF · 공개 장부 링크',
  '쓰던 장부 파일 가져와 분석',
] as const;

/** 서버가 plan 을 아직 안 주면(옛 서버) 막지 않는다 */
export const isPro = (g: { plan?: 'free' | 'pro' } | null | undefined): boolean => (g?.plan ?? 'pro') === 'pro';

/** 무엇 때문에 구독 안내가 떴는지 — 안내 창 머리 한 줄 */
export type PlanReason = 'general' | 'photos' | 'request' | 'dues' | 'budget' | 'pdf' | 'server';

export const PLAN_REASON: Record<PlanReason, string> = {
  general: '모임을 함께 쓰려면 구독해 주세요',
  photos: '영수증 여러 장을 한 번에 올리는 건 구독에서 돼요',
  request: '회원 지급 요청은 모임이 구독하면 쓸 수 있어요',
  dues: '회비 체크와 미납 안내는 구독에서 돼요',
  budget: '예산은 구독에서 쓸 수 있어요',
  pdf: '결산서 PDF 는 구독에서 받을 수 있어요',
  server: '이 기능은 구독한 모임에서 쓸 수 있어요',
};
