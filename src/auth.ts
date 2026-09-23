/**
 * 로그인 — **공용 패키지(`@jcurve/auth`)에 앱의 것을 끼워 넣는 자리**다(용돈캡슐 `auth.ts` 와 같은 모양).
 *
 * 소셜 로그인 본체(카카오 초기화 순서, 네이티브→웹 폴백 사유, 구글 취소 판별, 애플 이름 1회, 돌아오는 순간의 fetch
 * 끊김)는 전부 패키지에 있다. 여기 남는 것은 앱마다 다른 **셋** — 키(`config`) · 서버 호출(`api`) · 기록(`track`).
 *
 * 카카오·구글 SDK 는 콘솔 키가 오기 전에는 설치하지 않는다(`metro.config.js` 가 빈 모듈로 돌린다) —
 * 그동안 `availableProviders()` 는 애플(iOS)만 준다. 게스트 시작은 패키지에 없다(서버 계약이 앱마다 다르다).
 */
import { Platform } from 'react-native';
import { createAuth, createReturnWatch, isCancel } from '@jcurve/auth';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, KAKAO_NATIVE_APP_KEY } from './config';
import { loginApple, loginGoogle, loginGuest, loginKakao, type AuthResult } from './api';
import { resendIfDropped } from './resend';
import { track } from './track';

export type { Provider } from '@jcurve/auth';

/** 서버가 켠 로그인 — 앱이 뜬 뒤 `auth/providers` 로 받아 채운다. 비어 있으면 막지 않는다(패키지 규칙) */
let serverProviders: readonly string[] = [];
export const setServerProviders = (p: readonly string[]): void => { serverProviders = p; };

export const auth = createAuth<AuthResult>({
  keys: {
    kakaoNative: KAKAO_NATIVE_APP_KEY,
    googleWeb: GOOGLE_WEB_CLIENT_ID,
    googleIos: GOOGLE_IOS_CLIENT_ID,
  },
  server: { kakao: loginKakao, google: loginGoogle, apple: loginApple },
  track,
  // kakao_native 만 켜진 서버도 카카오를 켜진 것으로 본다(@jcurve/auth 2.1.2 부터 패키지가 한다)
  providers: () => serverProviders,
});

/* 로그인 놓아 주기는 **밖에 다녀온 것만** 센다 — 패키지가 중간 `inactive` 까지 가려 준다(2.2.0, store.tsx 가 쓴다) */
export { createReturnWatch, isCancel };

/** 게스트로 시작 — SNS 없이 회원을 만든다. 끊겼을 때만 다시 보낸다(보낼 때마다 회원이 새로 생기므로 늦음은 다시 안 보낸다) */
export function signInGuest(): Promise<AuthResult> {
  return resendIfDropped(() => loginGuest(Platform.OS === 'ios' ? 'ios' : 'android'));
}
