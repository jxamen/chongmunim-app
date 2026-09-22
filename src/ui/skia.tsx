/**
 * Skia 로 그리는 것 — 앱 바탕 · 게이지 막대 · 연간 막대그래프.
 *
 * 전부 **정적**이다(움직이지 않는다). 바탕은 앱 루트에 한 장만 깔고(용돈캡슐 `SkiaBackdrop` 과 같은 자리 — 탭을 옮겨도
 * 이어진다), 막대는 폭을 재고 나서 그린다(재기 전에는 빈 트랙만). 색은 테마(`useT()`)에서 받는다.
 * 웹 미리보기는 `index.ts` 가 CanvasKit 을 먼저 받아 둔다.
 */
import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurMask, Canvas, Circle, Group, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { useT } from './theme';

/** 앱 전체에 깔리는 바탕 — 테마 색의 큰 번짐 두 덩이. 카드 뒤로 은은하게 비친다 */
export function SkiaBackdrop() {
  const T = useT();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.w > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group opacity={0.55}>
            <Circle cx={size.w * 0.92} cy={size.h * 0.08} r={size.w * 0.55} color={T.tint}>
              <BlurMask blur={60} style="normal" />
            </Circle>
            <Circle cx={size.w * 0.04} cy={size.h * 0.62} r={size.w * 0.45} color={T.tintLine}>
              <BlurMask blur={70} style="normal" />
            </Circle>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

/**
 * 게이지 막대 — 예산·회비·행사 예산. 100% 를 넘으면 경고색으로 끝까지 채운다(시안 7 식비 104%).
 * 폭을 재기 전에는 트랙만 보인다(한 프레임).
 */
export function Gauge({ percent, height = 8, warn }: { percent: number; height?: number; warn?: boolean }) {
  const T = useT();
  const [w, setW] = useState(0);
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const over = warn ?? percent > 100;
  const fill = (w * p) / 100;
  const r = height / 2;

  return (
    <View style={{ height, borderRadius: r, backgroundColor: T.track, overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && fill > 0 ? (
        <Canvas style={{ width: w, height }}>
          <RoundedRect x={0} y={0} width={Math.max(fill, height)} height={height} r={r}>
            <LinearGradient start={vec(0, 0)} end={vec(Math.max(fill, height), 0)}
              colors={over ? [T.warn, T.warn] : [T.point, T.deep]} />
          </RoundedRect>
        </Canvas>
      ) : null}
    </View>
  );
}

/**
 * 열두 달 막대(시안 5) — 지출 기준. 가장 많이 쓴 달은 진한 색, 아직 안 온 달은 트랙색 받침만.
 * 막대 윗모서리만 둥글다(아래는 바닥에 붙는다).
 */
export function YearBars({ values, peak, current, height = 72 }: { values: number[]; peak: number | null; current: number; height?: number }) {
  const T = useT();
  const [w, setW] = useState(0);
  const max = Math.max(1, ...values);
  const gap = 4;
  const bw = w > 0 ? (w - gap * 11) / 12 : 0;

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Canvas style={{ width: w, height }}>
          {values.map((v, i) => {
            const future = i + 1 > current;
            const h = future ? height * 0.18 : Math.max(4, (height * v) / max);
            const x = i * (bw + gap);
            const y = height - h;

            if (future) return <RoundedRect key={i} x={x} y={y} width={bw} height={h + 4} r={4} color={T.track} />;

            return (
              <RoundedRect key={i} x={x} y={y} width={bw} height={h + 4} r={4}>
                <LinearGradient start={vec(0, y)} end={vec(0, height)} colors={i + 1 === peak ? [T.deep, T.deep] : [T.point, T.point + 'B3']} />
              </RoundedRect>
            );
          })}
        </Canvas>
      ) : null}
    </View>
  );
}
