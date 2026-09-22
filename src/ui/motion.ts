/**
 * 움직임 줄이기 — 기기 설정을 한 번 읽어 두고 애니메이션 길이를 0으로 만든다.
 *
 * 멀미·발작을 줄이려는 설정이라 **꺼져 있으면 아예 움직이지 않아야** 한다. 길이만 0으로
 * 만들면 값은 끝 상태로 바로 가므로, 마지막 장면을 보여 주는 것과 같다.
 */
import { AccessibilityInfo } from 'react-native';

let reduced = false;

void AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduced = v; }).catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduced = v; });

export const isReduced = (): boolean => reduced;

/** 애니메이션 길이 — 움직임 줄이기면 0 */
export const ms = (v: number): number => (reduced ? 0 : v);
