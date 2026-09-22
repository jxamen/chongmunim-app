/**
 * 스크롤 **안에 있는** 입력칸이 키보드에 가리지 않게 — 가려진 만큼 스크롤을 내린다(꿀꿀캐시 `reveal.ts` 를 옮겼다).
 *
 * 바닥에 붙은 폼은 `useKeyboardPad` 가 올린다. 그런데 **스크롤 가운데 있는 칸**은 올릴 대상이 없다 —
 * 화면이 그대로면 칸도 그대로다. 찬스 탭 「받은 코드 넣기」가 키보드 뒤에 통째로 들어갔다
 * (꿀꿀캐시 2026-09-19 오너 제보, 안드로이드 · iOS 둘 다).
 *
 * 두 가지를 같이 해야 한다.
 *  1. **바닥에 여백**을 준다 — 칸이 화면 끝에 가까우면 스크롤할 자리가 없어 아무리 내려도 안 올라온다
 *  2. 가려진 만큼 **지금 위치에서 더** 내린다(`revealY` — 절대 위치로 넘기면 위로 튄다)
 *
 * **iOS 도 같은 길로 간다**(꿀꿀캐시 2026-09-19 정정). 처음엔 iOS 를 `automaticallyAdjustKeyboardInsets` 에 맡겼는데
 * 「아이폰은 아직 **조금** 가린다」 — 그 prop 은 키보드가 스크롤을 얼마나 덮는지로 인셋을 잡는데, **그 순간 하단 탭바가
 * 사라진다**(App.tsx 가 keyboardWillShow 에서 언마운트). 탭바가 있던 프레임으로 재니 모자란 양이 딱 탭바 높이였다.
 * 그래서 prop 을 끄고, 키보드가 다 올라온 뒤 창 좌표로 직접 잰다(둘을 같이 켜면 서로 밀어 두 배로 움직인다).
 *
 * iOS 는 글자를 넣기 시작하면 **자동완성 줄**이 붙어 키보드 윗변이 또 올라간다(이모지 자판도) —
 * `keyboardDidChangeFrame` 에도 같은 핸들러를 단다. 안드로이드에는 안 오는 이벤트라 분기 없이 둘 다 단다.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View,
} from 'react-native';
import { revealY } from './hiddenBy';
import { useKeyboardPad } from './keyboard';

export type Reveal = {
  /** 스크롤 본문에 단다 */
  scrollRef: RefObject<ScrollView | null>;
  /** 스크롤 본문 `onScroll` 에 단다(`scrollEventThrottle={16}`) — 지금 위치를 안다 */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** 입력칸이 **든 줄**에 단다 — 칸만 보이면 옆 버튼이 가린 채로 끝난다 */
  rowRef: RefObject<View | null>;
  /** 입력칸 `onFocus` 에 단다 */
  onFocus: () => void;
  /** 스크롤 본문 아래에 줄 여백 */
  pad: number;
};

export function useReveal(): Reveal {
  const scrollRef = useRef<ScrollView | null>(null);
  const rowRef = useRef<View | null>(null);
  const covered = useKeyboardPad();
  const offset = useRef(0);
  /** 키보드 윗변 — 없으면 0 */
  const top = useRef(0);
  /** 커서가 이 줄에 있나 — 다른 칸을 눌렀을 때 엉뚱하게 움직이지 않게 */
  const mine = useRef(false);

  const reveal = useCallback(() => {
    if (!mine.current || top.current <= 0) return;
    rowRef.current?.measureInWindow((_x, y, _w, h) => {
      const to = revealY(offset.current, y + h, top.current);
      if (to !== null) scrollRef.current?.scrollTo({ y: to, animated: true });
    });
  }, []);

  useEffect(() => {
    const onShow = (e: { endCoordinates?: { screenY?: number } }) => {
      top.current = Number(e?.endCoordinates?.screenY) || 0;
      // 여백이 먼저 붙어야 스크롤할 자리가 생긴다 — 한 박자 뒤에 움직인다
      setTimeout(reveal, 80);
    };
    const a = Keyboard.addListener('keyboardDidShow', onShow);
    const c = Keyboard.addListener('keyboardDidChangeFrame', onShow);
    const b = Keyboard.addListener('keyboardDidHide', () => { top.current = 0; mine.current = false; });

    return () => { a.remove(); b.remove(); c.remove(); };
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onFocus = useCallback(() => {
    mine.current = true;
    // 다른 칸에서 넘어와 키보드가 이미 떠 있으면 `keyboardDidShow` 가 다시 안 온다 — 여기서 한 번 더 맞춘다
    setTimeout(reveal, 80);
  }, [reveal]);

  return { scrollRef, onScroll, rowRef, onFocus, pad: covered };
}
