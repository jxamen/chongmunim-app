/**
 * 네이티브 모듈이 없는 판에서도 같은 JS 가 돈다 — OTA 로 지금 깔린 판에 내려가도 앱이 죽지 않는지(`tiktok.ts` 머리말).
 * 노드에는 react-native · 틱톡 모듈이 없으니 「모듈 없는 빌드」와 같은 처지다. 던지지만 않으면 된다.
 */
import { describe, expect, it } from 'vitest';
import {
  configureTikTok, startTikTok, tiktokAdImpression, tiktokIdentify, tiktokLogout, tiktokTrack,
  TIKTOK_APP_ID_ANDROID_KEY, TIKTOK_APP_ID_IOS_KEY, TIKTOK_CONFIG_KEY,
} from './tiktok';

describe('틱톡 — 모듈이 없는 빌드', () => {
  it('켜기 · 보내기 · 식별 · 로그아웃 모두 아무 일 없이 지나간다', () => {
    expect(() => {
      configureTikTok({ isDebug: () => true, waitForAtt: () => Promise.resolve() });
      startTikTok({ [TIKTOK_CONFIG_KEY]: 'x', [TIKTOK_APP_ID_IOS_KEY]: '1', [TIKTOK_APP_ID_ANDROID_KEY]: '2' });
      startTikTok(null);
      tiktokTrack('signup_done', { method: 'kakao' });
      tiktokAdImpression();
      tiktokIdentify(1);
      tiktokLogout();
    }).not.toThrow();
  });
});
