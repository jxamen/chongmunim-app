/**
 * 틱톡 SDK 를 **앱이 켜질 때** 켠다 — 로그인 여부와 상관없이(설치 캠페인은 로그인 전 설치 측정이 핵심).
 *
 * 총무님은 그동안 어드민 「앱 설정」(`content/config/custom`)을 읽지 않았다 — 틱톡 값만 읽으려고 같은 공개 조회
 * (알림 문구 `content/config/notify` 와 같은 방식, 인증 없음)를 켤 때 한 번 · 앞으로 올 때마다 부른다.
 * 그룹은 `chongmunim`(`chongmunim.tiktok_*`). 못 받거나 비면 켜지 않고 앱은 그대로 돈다.
 *
 * 총무님은 광고 · ATT(추적 허용)가 없다 — iOS 도 기다리지 않고 켠다(IDFA 없이 나간다).
 */
import { AppState } from 'react-native';
import { api } from './api';
import { configureTikTok, startTikTok } from './tiktok';
import { customValues } from './tiktok.map';

async function load(): Promise<void> {
  const values = customValues(await api.get<unknown>('content/config/custom', false));
  if (values) startTikTok(values);
}

let watching = false;

/** 켤 때 한 번 부른다 */
export function bootTikTok(): void {
  configureTikTok({ isDebug: () => __DEV__ });
  void load().catch(() => undefined);
  if (watching) return;
  watching = true;
  AppState.addEventListener('change', (s) => { if (s === 'active') void load().catch(() => undefined); });
}
