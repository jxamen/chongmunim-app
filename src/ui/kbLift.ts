/**
 * 키보드가 가리지 않도록 **바닥 줄을 얼마나 띄울지** 정한다.
 *
 * 2026-09-18 실기기(갤럭시 A32 / 안드로이드 13, 앱빌드 세션)에서 잰 값이다.
 *
 *     창 높이 914.3dp · 키보드 윗변(screenY) 536.8dp · 키보드 높이 329.5dp
 *     536.8 + 329.5 = 866.3 ≠ 914.3      차이 48dp = 내비게이션 바
 *
 * Expo 57 / RN 0.86 은 안드로이드에서 **edge-to-edge** 다. 창이 내비게이션 바 **아래까지**
 * 가는데 `endCoordinates.height` 는 **내비바를 뺀 키보드 자체 높이**다. 그래서 「키보드
 * 높이만큼 바닥을 띄운다」는 **늘 내비바 높이만큼 모자란다** — 입력칸은 겨우 걸치고
 * [정답 확인] 은 키보드 뒤로 숨는다. 실제로 그렇게 보였다.
 *
 * 그래서 높이를 쓰지 않고 **키보드 윗변 좌표**를 쓴다. 바닥 줄의 아랫변이 어디에 있든
 * 그 둘의 차이만큼 띄우면 정확하다 — 내비바가 있든 없든, 탭바가 남아 있든 없든.
 *
 * ⚠ `rowBottom` 은 **키보드가 없을 때** 잰 값이어야 한다. 여백을 준 뒤에 재면 그 값이
 *   다시 입력으로 들어가 매번 더 올라간다.
 */
export type KbLiftInput = {
  /** 바닥 줄의 아랫변(window 좌표). 아직 못 쟀으면 `null` */
  rowBottom: number | null;
  /** 키보드 윗변(window 좌표) — `endCoordinates.screenY` */
  screenY: number | null;
  /** 키보드 높이 — 좌표를 못 쓸 때의 폴백 */
  height: number;
  /** 버튼과 키보드 사이에 둘 틈 */
  gap: number;
};

const ok = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * 바닥 줄에 줄 `paddingBottom`. **0 이면 키보드가 없다**(여백을 주지 않는다).
 *
 * 좌표를 못 쓰면 높이로 돌아간다 — 모자라게 올리더라도 아예 안 올리는 것보다 낫다.
 */
export function kbLift(o: KbLiftInput): number {
  const height = ok(o.height) ? Math.max(0, o.height) : 0;
  if (height <= 0) return 0;

  if (ok(o.rowBottom) && ok(o.screenY) && o.screenY > 0 && o.rowBottom > 0) {
    return Math.max(0, o.rowBottom - o.screenY) + o.gap;
  }

  return height + o.gap;
}
