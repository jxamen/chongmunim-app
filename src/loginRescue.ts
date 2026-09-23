/**
 * 로그인 창에 갔다가 **아이콘으로** 돌아오면 약속이 영영 안 끝난다(@jcurve/auth README) — 앞으로 돌아왔을 때 풀어 준다.
 * 그런데 **앱을 떠났다 온 것만** 그렇다: iOS 의 구글 · 웹 로그인은 앱 위에 창을 띄워서 `active → inactive → active` 만 오간다.
 * 그걸 「돌아왔다」로 보면 계정을 고르는 사이에 로그인을 버린다(2026-09-23 머니트리 제보 — 아이폰 구글 로그인 뒤 먹통,
 * 꿀꿀 `loginRescue` · 당근 `authReturnWatch` 와 같은 자리. 총무님은 구글 비중이 커서 더 크게 걸린다).
 *
 * 그래서 `background` 를 거쳐 돌아온 것만 센다. iOS 는 나갈 때 `inactive → background`, 올 때 `inactive → active` 로 알리므로
 * 중간의 `inactive` 로는 깃발을 지우지 않는다 — 지우면 정작 아이콘으로 돌아온 것을 놓친다.
 */
export type AppPhase = 'active' | 'inactive' | 'background' | string;

/**
 * @param wentOut 앱이 뒤로 간 적이 있나(호출하는 쪽이 들고 있는 깃발)
 * @param st 방금 온 AppState 값
 * @returns wentOut 다음 깃발 · rescue 지금 로그인을 놓아 줄지(2.5초 뒤 확인을 걸지)
 */
export function returnedFromOutside(wentOut: boolean, st: AppPhase): { wentOut: boolean; rescue: boolean } {
  if (st === 'background') return { wentOut: true, rescue: false };
  if (st !== 'active') return { wentOut, rescue: false };   // inactive — 아직 앱 안이다(구글 창 · 알림창 · 전화)

  return { wentOut: false, rescue: wentOut };
}
