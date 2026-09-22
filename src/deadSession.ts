/**
 * 이 오류가 **세션이 죽었다**는 뜻인가 — 401 이면서 코드가 `unauthorized` 일 때만 그렇다(서버 AuthMember).
 *
 * 끊김 · 늦음(status 0) · 서버 오류(5xx) · 403 은 세션이 살아 있다. 그걸로 로그인을 지우면
 * OTA 를 받느라 껐다 켠 사람이 로그아웃된다(2026-09-19 A32 — 서버 세션은 살아 있었다. 머니트리 d399226 · 꿀꿀 59f71fb 와 같은 자리).
 * 소셜 로그인의 401(`invalid_token` 등)은 **제공자 토큰이 거절된 것**이다 — 게스트는 그 요청에 게스트 세션을 싣고 가므로
 * 그걸로 지우면 게스트 계정을 영영 잃는다(머니트리 e3422d4).
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`deadSession.test.ts`).
 */
export function isDeadSession(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { status, code } = e as { status?: unknown; code?: unknown };

  return status === 401 && code === 'unauthorized';
}
