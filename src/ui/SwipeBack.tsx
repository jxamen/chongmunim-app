/**
 * 왼쪽 가장자리에서 오른쪽으로 쓸면 뒤로 — iOS 에서 몸에 밴 동작이다(2026-09-17 지시).
 *
 * **화면이 손가락을 따라온다.** 처음에는 `PanResponder` 로 문턱만 재서 툭 닫았는데, 끄는
 * 동안 아무 반응이 없어 「먹었나?」 싶은 채로 손을 떼야 했다. 얼마나 더 끌면 닫히는지도
 * 알 수 없다. 지금은 `react-native-gesture-handler` 로 손가락 위치를 그대로 받아
 * `reanimated` 가 UI 스레드에서 화면을 옮긴다 — 자바스크립트가 바빠도 끊기지 않는다.
 * (Skia 는 밭 그림을 그리는 캔버스라 화면 전환에는 쓰지 않는다.)
 *
 * **가장자리에서 시작한 것만** 잡는다(`EDGE`). 화면 한가운데서 옆으로 쓰는 동작까지 잡으면
 * 가로로 넘기는 것들(따라 하기의 가짜 화면)과 싸우고, 세로 스크롤 중에 손가락이 조금만
 * 비뚤어져도 화면이 닫힌다.
 *
 * 끝까지 안 끌어도 **빠르게 튕기면** 닫힌다 — 실제로 사람들은 끝까지 끌지 않는다.
 *
 * `GestureHandlerRootView` 를 자기 안에 하나 더 둔다. 리액트 네이티브 `Modal` 안에서는
 * 바깥 루트의 제스처가 닿지 않아서, 덮어 놓는 화면(미션 상세·내역·완료 페이지)에서 아예
 * 동작하지 않는다. 겹쳐 두어도 문제가 없다.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';

/**
 * 이 폭 안에서 시작한 스와이프만 뒤로가기로 본다.
 * 엄지 끝은 넓게 닿아서 「가장자리를 잡았다」고 느껴도 40px 을 넘기 쉽다 — 넉넉히 준다.
 */
const EDGE = 56;
/** 화면 폭의 이만큼을 넘기면 닫는다 */
const FAR = 0.3;
/** 이보다 빠르게 튕기면 덜 끌었어도 닫는다(px/초) */
const FLING = 700;
/** 닫히며 빠져나가는 시간 */
const OUT_MS = 170;

export type SwipeBackProps = {
  onBack: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 끌어도 안 닫히게 잠깐 꺼 둘 때(따라 하기 중간처럼) */
  enabled?: boolean;
};

export function SwipeBack({ onBack, children, style, enabled = true }: SwipeBackProps) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);

  /**
   * 닫고 **곧바로 제자리로 돌린다.**
   * 덮어 놓는 화면은 그대로 사라지지만, 상점 안쪽처럼 같은 화면에서 내용만 바뀌는 곳은
   * 되돌리지 않으면 새 내용이 화면 밖에 나가 있는다.
   */
  const done = useCallback(() => {
    onBack();
    x.value = 0;
  }, [onBack, x]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(enabled)
    // 가로로 이만큼 움직여야 우리 차례다 — 세로 스크롤을 뺏지 않는다
    .activeOffsetX(8)
    /*
     | 세로 허용치를 넉넉히 둔다. 20px 로 조였더니 **실기기에서 아예 안 먹었다**
     | (2026-09-17 제보). 손가락으로 쓸면 엄지가 위로 호를 그려서, 가로로 8px 가기 전에
     | 세로로 20px 을 넘겨 제스처가 죽는다. 마우스로 곧게 끄는 웹에서는 안 드러났다.
     */
    .failOffsetY([-48, 48])
    .onBegin((e) => {
      armed.value = e.x < EDGE;
    })
    .onUpdate((e) => {
      /*
       | 잡은 자리를 **여기서 다시 센다**(`absoluteX - translationX` 가 손을 댄 지점이다).
       | `onBegin` 한 번에만 기대면, 그 콜백이 늦거나 건너뛰는 기기에서 영영 안 잡힌다.
       */
      if (!armed.value && e.absoluteX - e.translationX >= EDGE) return;
      armed.value = true;
      // 왼쪽으로는 안 간다 — 뒤로가기는 한 방향이다
      x.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      if (!armed.value) return;
      if (e.translationX > width * FAR || e.velocityX > FLING) {
        x.value = withTiming(width, { duration: OUT_MS }, (ok) => {
          if (ok) runOnJS(done)();
        });

        return;
      }
      // 모자라면 제자리로 — 튕기듯 돌아와야 「안 닫혔다」가 읽힌다
      x.value = withSpring(0, { damping: 22, stiffness: 240 });
    })
    .onFinalize(() => {
      armed.value = false;
    }), [enabled, width, x, armed, done]);

  /*
   | 끌면 화면이 따라오고, 그림자가 왼쪽 모서리에 진다 — **한 장이 들려 올라가는** 느낌이다.
   | 그림자가 없으면 화면이 그냥 미끄러지기만 해서 「뒤에 뭔가 있다」가 안 읽힌다.
   */
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    shadowOpacity: x.value > 0 ? 0.18 : 0,
  }));

  /** 들린 만큼 뒤가 어둡게 비친다 — iOS 가 이렇게 한다 */
  const veil = useAnimatedStyle(() => ({
    opacity: Math.min(0.28, (x.value / width) * 0.9),
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#2B2118' }, veil]} pointerEvents="none" />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, shadow, style, slide]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/** 왼쪽 모서리 그림자 — 끄는 동안에만 보인다(`shadowOpacity` 를 값으로 준다) */
const shadow = {
  shadowColor: '#2B2118',
  shadowOffset: { width: -6, height: 0 },
  shadowRadius: 12,
  elevation: 12,
} as const;
