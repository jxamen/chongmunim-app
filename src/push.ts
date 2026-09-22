/**
 * 알림 — `@jcurve/notify` 를 그대로 쓴다.
 *
 *  - `createPush`   로그인 뒤 기기 토큰을 서버(`POST {app}/push/register`)에 올리고, 알림을 누르면 열람을 보고한다.
 *                   서버가 FCM·APNs 로 직접 보낸다(공지 · 회비 안내 · 지급 요청 — jcurve-api `ClubPush`).
 *  - `createNotify` 앱이 켜져 있을 때 온 알림도 배너로 보이게 하고, 안드로이드 채널을 만들고, 권한을 **한 실행에 한 번** 묻는다.
 *                   총무님은 예약(로컬) 알림이 없어 채널만 준다 — id 는 `app.json` 의 `defaultChannel` 과 같아야 한다
 *                   (다르면 서버 알림이 대체 채널로 떨어진다, 04 A-19).
 *
 * 모임마다 끄는 스위치는 서버의 명단 행에 있다(설정 › 알림, `PUT cm/g/{gid}/me {notify}`).
 */
import { createNotify, createPush } from '@jcurve/notify';
import { API_BASE, PUBLIC_KEY } from './config';
import { currentToken } from './api';
import { track } from './track';

export const push = createPush({
  base: API_BASE,
  appToken: PUBLIC_KEY,
  session: () => currentToken(),
  // 권한은 켰는데 토큰이 못 올라간 이유를 남긴다(1.2) — 「알림을 켰는데 안 와요」의 단서
  onError: (e) => track('push_register_failed', e),
});

export const notify = createNotify({
  config: () => ({ channel: { id: 'chongmunim', name: '총무님 알림' }, items: [] }),
});
