/**
 * 키보드가 가리지 않게 **바닥에 줄 여백**을 돌려준다. 입력칸이 있는 화면은 이것만 쓴다.
 *
 * 왜 한 곳으로 모았는가 — 2026-09-16 부터 세 번 고쳤는데 세 번 다 못 잡았고, 그동안
 * 같은 코드가 화면마다 따로 있었다. 오너 확인(2026-09-19): **안드로이드는 미션·친구 초대
 * 모두 가리고, iPhone 은 친구 초대만 가린다.** 화면마다 고치면 또 한 곳이 남는다.
 *
 * 계산은 `kbLift` 가 한다(왜 높이가 아니라 좌표인지는 거기 적어 뒤었다).
 *
 * ⚠ **`addListener` 를 가장 먼저 부른다.** 실기기 로그에서 `[kb] listen` 조차 안 찍힌 적이
 *   있다 — 등록 앞에 무엇이 있으면 그것이 터질 때 리스너가 아예 안 붙는다. 진단도
 *   try/catch 로 감싸 두었다: 진단이 앱 동작을 막아서는 안 된다.
 */
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { kbLift } from './kbLift';

/** ⚠ 임시 진단(2026-09-19) — 원인이 잡히면 이 함수와 부르는 자리를 지운다 */
function say(msg: string): void {
  try { console.log('[kb] ' + msg); } catch { /* 진단이 앱을 막지 않는다 */ }
}

export type KeyboardPad = {
  /** 바닥에 줄 여백. **0 이면 키보드가 없다** */
  pad: number;
  /** 키보드가 떠 있는가 — 화면이 다른 것도 같이 바꿔야 할 때 쓴다 */
  open: boolean;
};

/**
 * @param gap 버튼과 키보드 사이에 둘 틈
 * @param tag 진단 로그에 찍을 화면 이름
 */
export function useKeyboardPad(gap: number, tag: string): KeyboardPad {
  const [pad, setPad] = useState(0);
  const gapRef = useRef(gap);
  gapRef.current = gap;

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // 등록이 맨 앞이다 — 이 앞에 아무것도 두지 않는다
    const a = Keyboard.addListener(show, (e: { endCoordinates?: { height?: number; screenY?: number } }) => {
      const ec = e?.endCoordinates;
      /*
       | 바닥 줄을 재지 않고 **창 높이**를 쓴다. 재려면 키보드가 없을 때 재야 하는데 그때는
       | 하단 탭바가 아직 있어서, 잰 값이 탭바 높이만큼 위를 가리킨다(2026-09-19 꿀꿀캐시
       | 세션이 잡았다). 키보드가 뜨면 탭바가 언마운트되므로 그 값은 그 순간 낡는다.
       */
      /*
       | 두 가지를 더 지킨다(2026-09-19 꿀꿀캐시 세션 전파).
       |  - 기기에 따라 `window` 가 내비바를 뺀 값으로 온다 — 그러면 `screen` 이 더 크다. **큰 쪽**을 쓴다
       |  - **키보드 높이보다 적게 올리지 않는다** — 좌표가 어떤 기기에서 작게 나와도 최소한 덜 가린다.
       |    여백이 조금 남는 것이 버튼이 사라지는 것보다 낫다
       */
      const height = Number(ec?.height) || 0;
      const byTop = kbLift({
        rowBottom: Math.max(Dimensions.get('window').height, Dimensions.get('screen').height),
        screenY: Number(ec?.screenY),
        height,
        gap: gapRef.current,
      });
      const next = height > 0 ? Math.max(byTop, height + gapRef.current) : byTop;
      say(tag + ' show ec=' + JSON.stringify(ec) + ' win=' + Dimensions.get('window').height + ' pad=' + next);
      setPad(next);
    });
    const b = Keyboard.addListener(hide, () => { say(tag + ' hide'); setPad(0); });

    say(tag + ' listen os=' + Platform.OS + ' win=' + Dimensions.get('window').height);

    return () => { a.remove(); b.remove(); };
  }, [tag]);

  return { pad, open: pad > 0 };
}
