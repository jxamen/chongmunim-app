/**
 * 사용 기록 — `@jcurve/auth` 2.1 의 `createFunnel`·`createTrack` 을 그대로 쓴다.
 *
 * 같은 이름으로 GA4(Firebase)와 우리 서버 퍼널(`POST {app}/funnel`)에 남긴다 — 앱마다 이름이 같아야 어드민이
 * 앱을 나란히 놓고 본다. 개인정보(회원번호·이름·이메일·전화)는 넣지 않는다.
 * GA4 모듈이 없는 빌드(Firebase 설정 파일을 받기 전)에서는 GA4 만 조용히 건너뛴다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFunnel, createTrack } from '@jcurve/auth';
import { createTikTok } from '@jcurve/ads';
import { API_BASE, PUBLIC_KEY } from './config';

export const funnel = createFunnel({
  base: API_BASE,
  appToken: PUBLIC_KEY,
  storage: AsyncStorage,
  // 새 앱이라 쓰던 키가 없다 — 저장 키 분류(keys.ts)에 맞춘 이름을 준다
  keys: { device: 'cm.device', installRef: 'cm.installRef' },
});

const sendTrack = createTrack({ funnel });

/**
 * 틱톡 광고 전환 — 공용 패키지 `@jcurve/ads`(1.7)의 `createTikTok`. 어드민 「앱 설정」 그룹 `chongmunim` 의
 * `chongmunim.tiktok_*` 값을 켤 때 읽는다(값표는 패키지 README). 비면 꺼진 채 앱은 그대로 돈다.
 * 총무님은 광고(AdMob) · ATT 가 없다 — `waitForTracking` 을 넘기지 않아 iOS 도 기다리지 않고 켠다(IDFA 없이).
 * 켜기 · 회원은 `store.tsx`(tiktok.boot · identify · logout).
 */
export const tiktok = createTikTok({ group: 'chongmunim', test: __DEV__ });

/*
 | 틱톡 광고 전환도 여기서 함께 보낸다(가입 완료 `signup_done` → Registration · 로그인 `login_done` → Login).
 | 틱톡이 받는 이름이 아니면 아무것도 하지 않고, 네이티브 모듈이 없는 빌드에서도 조용히 넘어간다(패키지가 처리).
 */
export const track: typeof sendTrack = ((name: string, params?: Parameters<typeof sendTrack>[1]) => {
  sendTrack(name, params);
  try { tiktok.track(name, params as Record<string, unknown> | undefined); } catch { /* 계측이 앱을 막지 않는다 */ }
}) as typeof sendTrack;
