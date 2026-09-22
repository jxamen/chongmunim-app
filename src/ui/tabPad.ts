/**
 * 하단 탭 줄의 바닥 여백.
 *
 * - **iOS** — 홈 인디케이터(34)를 다 비우면 아이콘이 붕 떠서 허전했다(2026-09-17 당근 제보). 인디케이터는 얇은 선이라
 *   12 만큼 걸쳐도 글자에 안 닿는다 → `inset − 12`
 * - **안드로이드** — edge-to-edge 라 **내비게이션 바가 그 자리를 실제로 덮는다**(3버튼 48dp · 제스처 줄 ~24dp).
 *   iOS 처럼 12 를 깎으면 탭 글자 아래가 그만큼 가려졌다(2026-09-19 오너 제보: 「탭메뉴 하단 텍스트가 일부 가려짐」).
 *   → 인셋 **그대로**. 당근캐시도 같은 자리를 `insets.bottom` 그대로로 바꿨다
 *
 * 어느 쪽이든 최소 `min` 은 둔다(인셋 0 인 기기).
 */
export function tabBottomPad(os: string, inset: number, min: number): number {
  const i = Number.isFinite(inset) ? Math.max(0, inset) : 0;

  return Math.max(os === 'ios' ? i - 12 : i, min);
}
