/**
 * 알림 — `@jcurve/notify` 를 그대로 쓴다.
 *
 *  - `createPush`   로그인 뒤 기기 토큰을 서버(`POST {app}/push/register`)에 올리고, 알림을 누르면 열람을 보고한다.
 *                   서버가 FCM·APNs 로 직접 보낸다(공지 · 회비 안내 · 지급 요청 — jcurve-api `ClubPush`).
 *  - `createNotify` 앱이 켜져 있을 때 온 알림도 배너로 보이게 하고, 안드로이드 채널을 만들고, 권한을 **한 실행에 한 번** 묻는다.
 *                   그리고 **재방문 로컬 알림**(`remind.ts` — 월말 정리 · 회비 확인 · 지급 요청 · 행사 정산 · 연말 결산 · 오랜만에)을
 *                   앱이 뒤로 갈 때 걸고 앞으로 오면 지운다. 채널 id 는 `app.json` 의 `defaultChannel` 과 같아야 한다
 *                   (다르면 서버 알림이 대체 채널로 떨어진다, 04 A-19).
 *
 * 문구는 어드민 「앱 알림」(`content/config/notify`)이 이긴다 — 비어 있으면 `remind.ts` 기본값. 뒤로 가는 순간엔 네트워크를
 * 기다릴 수 없어 설정 · 홈 요약 · 스위치를 **들고 있고** 기기에도 적어 둔다(당근캐시 `localNotify.ts` 와 같은 이유).
 *
 * 모임마다 끄는 스위치는 서버의 명단 행에 있다(설정 › 알림, `PUT cm/g/{gid}/me {notify}`). 로컬 알림 전체 스위치는 이 폰에 있다.
 */
import { createNotify, createPush } from '@jcurve/notify';
import { API_BASE, PUBLIC_KEY } from './config';
import { api, currentToken } from './api';
import { track } from './track';
import * as storage from './storage';
import { pickConfig, remindBases, remindPrefs, remindVars, type RemindPrefs, type RemindSnapshot } from './remind';

const base = createPush({
  base: API_BASE,
  appToken: PUBLIC_KEY,
  session: () => currentToken(),
  // 권한은 켰는데 토큰이 못 올라간 이유를 남긴다(1.2) — 「알림을 켰는데 안 와요」의 단서
  onError: (e) => track('push_register_failed', e),
});

/*
 | 등록은 **한 번에 하나만** — 권한 창을 닫으면 앱이 앞으로 돌아오며(active) 또 부른다. 모임 입장 쪽과 같은 초에 두 번
 | 올라가 서버 유일 키에 걸렸다(2026-09-22 A32 OTA #3, 운영 로그 1062 Duplicate entry). 패키지는 올라간 **뒤에**
 | 같은 토큰을 기억하므로 동시에 부른 둘은 막지 못한다 — 돌고 있으면 그 약속을 같이 기다린다.
 */
let registering: Promise<void> | null = null;
export const push: typeof base = {
  ...base,
  register: () => (registering ??= base.register().finally(() => { registering = null; })),
};

let adminConfig: unknown = null;
let snapshot: RemindSnapshot | null = null;
let prefs: RemindPrefs = { dues: true, request: true, remind: true };

export const notify = createNotify({
  config: () => pickConfig(adminConfig),
  prefs: () => remindPrefs(prefs),
  // 모임을 고르기 전(로그인 화면 등)에는 아무것도 걸지 않는다
  allowed: () => snapshot !== null,
});

/** 앱을 켤 때 — 기기에 적어 둔 것을 먼저(네트워크보다 빠르다), 그다음 어드민 문구를 새로 받는다 */
export async function primeRemind(): Promise<void> {
  adminConfig = (await storage.getJson<unknown>('cm.notifyConfig')) ?? adminConfig;
  snapshot = (await storage.getJson<RemindSnapshot>('cm.remindSnap')) ?? snapshot;
  prefs = { ...prefs, remind: (await storage.get('cm.remindOff')) !== '1' };
  try {
    const j = await api.get<{ value?: unknown; config?: unknown }>('content/config/notify', false);
    adminConfig = j.value ?? j.config ?? null;
    await storage.setJson('cm.notifyConfig', adminConfig);
  } catch { /* 지난 값으로 간다 */ }
}

/** 홈을 열 때 — 알림이 쓸 사실(서버 `home.remind`)과 모임 알림 스위치 */
export function setRemindSnapshot(s: RemindSnapshot, group: { dues: boolean; request: boolean }): void {
  snapshot = s;
  prefs = { ...prefs, dues: group.dues, request: group.request };
  void storage.setJson('cm.remindSnap', s).catch(() => undefined);
}

export const remindOn = (): boolean => prefs.remind;

/** 설정 › 알림 › 「장부 챙김 알림(이 폰)」 */
export async function setRemindOn(on: boolean): Promise<void> {
  prefs = { ...prefs, remind: on };
  await storage.set('cm.remindOff', on ? '0' : '1');
}

/** 앱이 뒤로 갈 때 — 지금 들고 있는 것으로 다시 건다 */
export function scheduleRemind(): void {
  const now = Date.now();
  void notify.schedule(remindBases(snapshot, now), remindVars(snapshot, now)).catch(() => undefined);
}

/** 로그아웃 · 계정 전환 — 남의 모임 알림이 남지 않게 */
export async function resetRemind(): Promise<void> {
  snapshot = null;
  await notify.clear();
}
