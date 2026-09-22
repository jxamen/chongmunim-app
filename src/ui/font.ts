/**
 * 글꼴 — **모든 글자가 Pretendard**(v1.3.9, OFL — `assets/fonts/LICENSE.txt`). 2026-09-22 사용자 결정 「모든 폰트는 프리텐디드」.
 *
 * 무게마다 파일이 따로다(Regular 400 ~ Black 900). 안드로이드는 `fontWeight` 로 커스텀 글꼴의 무게를 고르지 못하고
 * 가짜 굵기를 입힌다 — 그래서 `fontWeight` 를 **그 무게의 글꼴 이름**으로 바꿔 그린다. kit 의 `Text`·`TextInput`
 * 입구에서 한 번만 바꾸므로 화면 코드는 지금처럼 `fontWeight` 만 쓴다(앱테크모아 `F.bold` 와 같은 글꼴 파일).
 */
import type { TextStyle } from 'react-native';

/** `useFonts` 에 넘기는 이름 = 스타일의 `fontFamily` */
export const PRETENDARD = {
  400: 'Pretendard-Regular',
  500: 'Pretendard-Medium',
  600: 'Pretendard-SemiBold',
  700: 'Pretendard-Bold',
  800: 'Pretendard-ExtraBold',
  900: 'Pretendard-Black',
} as const;

type Weight = keyof typeof PRETENDARD;

/** `'bold'` → 700, `'normal'`·없음 → 400. 파일이 없는 얇은 무게(100~300)는 Regular */
function weightOf(w: TextStyle['fontWeight']): Weight {
  if (w === 'bold') return 700;
  const n = typeof w === 'number' ? w : Number(w);
  if (!Number.isFinite(n) || n < 400) return 400;

  return (Math.min(900, Math.round(n / 100) * 100) as Weight);
}

/**
 * 펼친 스타일 하나 → 그 무게의 Pretendard. `fontWeight` 는 지운다(글꼴 파일이 이미 그 굵기다 — 남기면 안드로이드가
 * 한 번 더 굵게 그린다). `fontFamily` 를 따로 정한 스타일은 건드리지 않는다.
 */
export function withPretendard(style: TextStyle | undefined): TextStyle {
  const { fontWeight, ...rest } = style ?? {};
  if (rest.fontFamily) return style ?? {};

  return { ...rest, fontFamily: PRETENDARD[weightOf(fontWeight)] };
}
