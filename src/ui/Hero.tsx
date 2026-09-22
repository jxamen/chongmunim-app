/**
 * 히어로 띠 — 화면 머리 아래 색 띠 + 캐릭터(2026-09-22 태훈님 「너무 비어 보인다」 · 「메인도 너무 심심해」).
 * 당근캐시 `ScreenHero` 와 같은 뜻 — 어느 화면인지 그림으로 먼저 읽힌다. 화면마다 다른 표정을 쓴다.
 *
 * Skia 없이 View 둘(번진 동그라미)로만 그린다 — 탭 머리마다 캔버스를 두면 가만한 화면에서도 CPU 를 먹는다
 * (영테크 `HeroWall` 2026-09-19 A32 측정 65~80%).
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Mascot, type Mood } from './Mascot';
import { R, S, useT } from './theme';

export function Hero({ mood, tone = 'tint', mascot = 76, style, foot, children }: {
  mood: Mood;
  /** tint — 옅은 띠(장부) · deep — 진한 띠, 글자는 흰색(홈 잔액) */
  tone?: 'tint' | 'deep';
  mascot?: number;
  style?: StyleProp<ViewStyle>;
  /** 캐릭터 아래까지 온 폭으로 까는 줄(홈의 이번 달 수입·지출) — 캐릭터 옆에 두면 가려진다 */
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const T = useT();
  const deep = tone === 'deep';

  return (
    <View style={[st.hero, { backgroundColor: deep ? T.deep : T.tint, borderColor: deep ? T.deep : T.tintLine }, style]}>
      <View pointerEvents="none" style={[st.blob, { right: -36, top: -54, width: 170, height: 170, backgroundColor: T.point, opacity: deep ? 0.45 : 0.16 }]} />
      <View pointerEvents="none" style={[st.blob, { left: -30, bottom: -64, width: 120, height: 120, backgroundColor: deep ? T.white : T.point, opacity: deep ? 0.08 : 0.1 }]} />
      <View style={st.row}>
        <View style={st.body}>{children}</View>
        <Mascot mood={mood} size={mascot} />
      </View>
      {foot}
    </View>
  );
}

const st = StyleSheet.create({
  hero: {
    gap: S.sm, borderRadius: R.card + 4, borderWidth: 1,
    paddingVertical: 14, paddingLeft: 18, paddingRight: 12, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  blob: { position: 'absolute', borderRadius: 999 },
  body: { flex: 1, minWidth: 0, gap: 4 },
});
