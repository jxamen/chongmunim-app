/**
 * 요청이 **끊겼으면** 조금 뒤 다시 보낸다 — 소셜 로그인 교환(`api.ts` 의 `loginKakao` 등)에 쓴다.
 *
 * 카카오톡 · 구글 창에서 앱으로 돌아오는 순간 보낸 요청은 **응답만** 끊길 때가 있다 — 서버는 로그인을 마쳤는데
 * 앱은 실패로 본다(2026-09-19 A32: 10:55:39 서버에 새 세션, 10:55:41 앱 `login_fail`, 같은 순간 expo fetch
 * `NativeResponse: Invalid state`). 패키지(`@jcurve/auth`)도 다시 보내지만 **한 단어 오류는 서버의 거절로 보고
 * 안 보낸다** — `api.ts` 는 끊김을 `network` 한 단어로 던지므로 그 재시도가 한 번도 돌지 않았다.
 *
 * 다시 보내도 된다 — 같은 토큰이면 서버는 같은 회원에 세션을 하나 더 만들 뿐이다.
 * 늦음(`timeout`)은 이미 12초를 기다렸으므로 다시 보내지 않는다. 서버가 답한 거절(status 가 있다)도 다시 보내지 않는다.
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`resend.test.ts`).
 */
export async function resendIfDropped<T>(fn: () => Promise<T>, waits: number[] = [700, 1500]): Promise<T> {
  for (const wait of waits) {
    try {
      return await fn();
    } catch (e) {
      const err = e as { code?: unknown; status?: unknown } | null;
      if (err?.code !== 'network' || err?.status !== 0) throw e;
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  return fn();
}
