/**
 * 서버가 켠 로그인 목록(`GET auth/providers`)을 `@jcurve/auth` 가 읽는 이름으로 맞춘다.
 *
 * 서버의 카카오는 이름이 둘이다 — `kakao`(웹 로그인, 어드민에 REST 키가 있을 때) · `kakao_native`(카카오톡 앱 로그인, 앱 ID 만 있으면).
 * 패키지(auth 2.1.1)는 버튼을 누를 때 목록에 `kakao` 가 있는지만 봐서, 앱 ID 만 넣은 총무님(REST 키 없음)의 카카오 버튼은
 * **서버에 가지도 않고 「disabled」로 끝났다**(2026-09-22 태훈님 아이폰 — 배포 세션이 funnel_events · laravel.log 로 확인).
 * 카카오톡 앱 로그인이 켜져 있으면 카카오를 켠 것으로 본다. 패키지가 고쳐지면 이 파일을 지운다(꼬꼬 세션에 알림).
 */
export function normalizeProviders(list: readonly string[]): readonly string[] {
  return list.includes('kakao_native') && !list.includes('kakao') ? [...list, 'kakao'] : list;
}
