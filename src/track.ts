/**
 * 사용 기록 — `@jcurve/auth` 2.1 의 `createFunnel`·`createTrack` 을 그대로 쓴다.
 *
 * 같은 이름으로 GA4(Firebase)와 우리 서버 퍼널(`POST {app}/funnel`)에 남긴다 — 앱마다 이름이 같아야 어드민이
 * 앱을 나란히 놓고 본다. 개인정보(회원번호·이름·이메일·전화)는 넣지 않는다.
 * GA4 모듈이 없는 빌드(Firebase 설정 파일을 받기 전)에서는 GA4 만 조용히 건너뛴다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFunnel, createTrack } from '@jcurve/auth';
import { API_BASE, PUBLIC_KEY } from './config';

export const funnel = createFunnel({
  base: API_BASE,
  appToken: PUBLIC_KEY,
  storage: AsyncStorage,
  // 새 앱이라 쓰던 키가 없다 — 저장 키 분류(keys.ts)에 맞춘 이름을 준다
  keys: { device: 'cm.device', installRef: 'cm.installRef' },
});

export const track = createTrack({ funnel });
