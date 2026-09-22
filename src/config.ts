/**
 * 앱 번들에 들어가는 값은 여기 모인다 — 슬러그·public_key·SNS 앱 로그인 키뿐이다(용돈캡슐 `config.ts` 와 같은 자리).
 * 서버 키(admin_key·소셜 secret)는 절대 넣지 않는다.
 *
 * 값 자체는 `app.json` 의 `extra` 에 있다. 비어 있는 것은 자동화 세션이 콘솔에서 발급받아 채운다
 * (`AGENTS.md` 「콘솔 발급값」). SNS 키는 네이티브 재빌드가 필요한 값이므로 **첫 빌드 전에** 끝낸다.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const APP_SLUG = extra.appSlug || 'chongmunim';

/**
 * 웹 미리보기는 같은 출처 프록시(`metro.config.js` 의 `/cm-api/*`)로 부른다 — 서버 CORS 가 브라우저 출처를 열어 두지 않았다
 * (영테크와 같은 장치). 네이티브는 운영 API 를 바로 부른다.
 */
export const API_BASE = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.origin + '/cm-api'
  : extra.apiBase || 'https://api.j-curve.co.kr/v1/chongmunim';

/** 개발 서버에서만 앱 토큰을 바꿔 끼울 수 있다(로컬 API 로 확인할 때) — 출시 빌드는 `__DEV__` 가 거짓이다 */
export const PUBLIC_KEY = (__DEV__ && process.env.EXPO_PUBLIC_APP_TOKEN) || extra.publicKey || '';

/** EAS 프로젝트 ID — `app.json` 의 `extra.eas.projectId`(앱빌드 세션이 `eas init` 으로 채운다) */
export const EAS_PROJECT_ID =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? '';

/**
 * 사람이 읽는 약관·정책 주소 — **총무님 홈페이지**(`chongmunim.j-curve.co.kr/legal`).
 * 어드민 주소를 쓰지 않는다(로그인·CF 에 막히고 어드민 주소가 공개된다 — 13 문서 사고 14).
 */
export const LEGAL_BASE = extra.legalBase || 'https://api.j-curve.co.kr/v1/chongmunim/cm/legal';

/** RevenueCat 공개 SDK 키(appl_… · goog_…) — 비어 있으면 결제 단추 대신 「준비하고 있어요」(`src/billing.ts`) */
export const BILLING_KEY: string = (Platform.OS === 'ios' ? extra.revenuecatIos : extra.revenuecatAndroid) || '';

export const KAKAO_NATIVE_APP_KEY = extra.kakaoNativeAppKey || '';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId || '';
export const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId || '';

/** 공개 장부 링크 — 서버가 HTML 한 장으로 낸다(jcurve-api `ChongmunimPublicController`) */
export const publicLedgerUrl = (token: string): string =>
  (extra.apiBase || 'https://api.j-curve.co.kr/v1/chongmunim') + '/cm/l/' + encodeURIComponent(token);

/** 화면에 띄우는 버전 — OTA 가 실제로 도착했는지 눈으로 확인하는 용도(05 §6-2) */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
