/**
 * 스크롤 안 입력칸이 키보드에 **얼마나 가려졌나**, 그리고 **어디까지 스크롤해야 하나**.
 *
 * 바닥에 붙은 폼은 올려서 피하지만(`kbLift`), 스크롤 가운데 있는 칸은 올릴 대상이 없어
 * **스크롤을 내려야** 한다. 꿀꿀캐시 찬스 탭 「받은 코드 넣기」가 키보드 뒤에 통째로 들어갔다
 * (2026-09-19 오너 제보 · 안드로이드 · iOS 둘 다) — 용돈캡슐도 같은 카드다.
 *
 * ⚠ `scrollTo` 는 **절대 위치**다. 가려진 거리만 넘기면 이미 내려와 있던 화면이 **위로** 튄다 —
 *   친구 초대 카드는 첫 화면 밖이라 늘 스크롤한 뒤에 누른다. 지금 위치에 더한다.
 *
 * **아무것도 들여오지 않는다** — 테스트에서 바로 열 수 있게(`hiddenBy.test.ts`).
 */

/** 칸과 키보드 사이에 둘 틈 */
export const REVEAL_GAP = 12;

/**
 * @param rowBottom 줄의 아랫변(창 좌표). 아직 못 쟀으면 0
 * @param kbTop 키보드 윗변(창 좌표). 키보드가 없으면 0
 * @returns 더 내려야 할 거리. `0` 이면 이미 보인다
 */
export function hiddenBy(rowBottom: number, kbTop: number): number {
  if (!(rowBottom > 0) || !(kbTop > 0)) return 0;

  return Math.max(0, rowBottom - kbTop + REVEAL_GAP);
}

/**
 * `scrollTo` 에 넘길 위치 — 가려졌으면 **지금 위치 + 가려진 거리**, 아니면 `null`(움직이지 않는다).
 *
 * @param offset 지금 스크롤 위치(`contentOffset.y`)
 */
export function revealY(offset: number, rowBottom: number, kbTop: number): number | null {
  const need = hiddenBy(rowBottom, kbTop);
  if (need <= 0) return null;

  return Math.max(0, offset) + need;
}
