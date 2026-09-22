/**
 * 키보드가 덮는 만큼 스크롤 바닥을 띄운다 — 내 정보 · 문의 · 인출처럼 **스크롤 안에 폼**이 있는 화면.
 *
 * `KeyboardAvoidingView` 를 쓰지 않는다. 그건 자기 아래가 화면 끝이라고 보는데, 이 앱의
 * 입력 화면들은 **하단 탭 위에 얹혀 있거나 바깥 스크롤 안에 들어 있어서** 높이를 덜 잡는다.
 * 그러면 칸이 키보드에 덮인 채로 남는다(인출 화면·내 정보에서 두 번 제보, 2026-09-17).
 *
 * 전에는 `endCoordinates.height` 를 그대로 줬는데, 그 값에는 **내비게이션 바가 안 들어 있어**
 * 안드로이드(edge-to-edge)에서 48dp 모자랐다 — 바닥 줄(`kbLift`)과 **똑같은 차이**다(2026-09-19 꿀꿀캐시
 * 세션 전파 · 꼬꼬농장도 같은 자리를 「창 높이 − screenY」로 고쳤다). 그래서 바닥 줄과 **한 값**을 쓴다(틈만 0).
 *
 * ```tsx
 * const kb = useKeyboardPad();
 * <ScrollView contentContainerStyle={[s.body, kb > 0 && { paddingBottom: kb }]}>
 * ```
 */
import { useKeyboardPad as useKeyboardLift } from './useKeyboardPad';

export function useKeyboardPad(): number {
  return useKeyboardLift(0, 'scroll').pad;
}
