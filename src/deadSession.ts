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

/**
 * 이 401 로 로그인을 지워도 되나 — **세션을 실어 보낸 요청**이고, 그 사이 다른 세션으로 바뀌지 않았을 때만.
 * 세션 없이 나간 요청(로그인 전 · 로그아웃 직후)의 401 은 「로그인이 풀렸어요」가 아니다(2026-09-22 꼬꼬 — 당근 · 영테크에서
 * 재설치 직후 로그인 전 요청의 401 로 그 창이 떴고, 총무님도 로그인 전 cm/groups 401 이 서버 기록에 있었다).
 */
export function expiresSession(sentToken: string | null, nowToken: string | null, e: unknown): boolean {
  return sentToken !== null && sentToken === nowToken && isDeadSession(e);
}
