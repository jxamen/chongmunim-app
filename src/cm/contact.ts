/**
 * 문의 · 신고 — 설정의 한 줄이 메일 쓰기 화면을 연다(2026-09-24, App Store 가이드라인 1.2).
 *
 * 총무님은 모임 회원끼리 장부 · 영수증 사진 · 공지를 보므로 「사용자 생성 콘텐츠: 예」다. 1.2 는 그런 앱에 **부적절한 글을 알릴
 * 수단과 운영자에게 닿는 길**을 요구한다(내보내기 · 차단은 이미 있다 — 총무 · 관리자의 「명단에서 빼기」, 회원의 「이 모임 나가기」).
 * 받는 곳은 방침 12항의 문의처와 같다. 누가 · 어느 모임에서 보냈는지 적어 두어야 답할 수 있어 본문 아래에 채운다(이름은 넣지 않는다).
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`contact.test.ts`). 여는 일은 `SettingsScreen.tsx`.
 */

/** 문의처 — 개인정보처리방침 12항과 같다. 바뀌면 방침(어드민)도 같이 고친다 */
export const CONTACT_EMAIL = 'jcurve19@gmail.com';

export type ContactFacts = { groupId: number | null; groupName: string | null; memberId: number | string | null; app: string; os: string };

/** 메일 쓰기 주소 — 제목 · 본문을 채워 둔다 */
export function contactMailto(f: ContactFacts): string {
  const subject = '[총무님] 문의 · 신고';
  const body = [
    '문의하실 내용이나 신고할 글 · 사진(어느 화면의 무엇인지)을 적어 주세요.',
    '',
    '',
    '— 아래는 답을 드리려고 채워 둔 것이에요. 지우지 말아 주세요 —',
    `모임: ${f.groupName ?? '-'}${f.groupId != null ? ` (#${f.groupId})` : ''}`,
    `회원번호: ${f.memberId ?? '-'}`,
    `앱: ${f.app} · ${f.os}`,
  ].join('\n');

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
