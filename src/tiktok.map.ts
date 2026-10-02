/**
 * 틱톡 전환 규칙 — RN 에 기대지 않는 순수 함수만(노드 테스트가 직접 읽는다: tiktok.map.test.ts).
 * 보내는 쪽은 `tiktok.ts`.
 */
export type StandardKey = 'ad_impression' | 'registration' | 'login';

/**
 * 어드민 「앱 설정」의 이 앱 칸 머리 — 앱과 어드민 두 곳 글자가 같아야 한다.
 * 키 이름이 `_secret`·`_token` 등으로 끝나면 서버가 앱에 안 내려준다(9/22 scrub) — 그래서 `_access` · `_id_*` 다.
 */
export const TIKTOK_GROUP = 'chongmunim';

/** App Secret(공용) — 비면 틱톡을 켜지 않는다 */
export const TIKTOK_CONFIG_KEY = `${TIKTOK_GROUP}.tiktok_sdk_access`;

/** 안드로이드 전용 App Secret 칸(있으면 이것을 먼저 쓴다). 비어 있으면 위의 공용 칸을 쓴다 */
export const TIKTOK_ANDROID_CONFIG_KEY = `${TIKTOK_GROUP}.tiktok_android_sdk_access`;

/** 이벤트 관리자의 틱톡 앱 ID — 플랫폼마다 따로 받는다. 비면 그 플랫폼은 꺼져 있다 */
export const TIKTOK_APP_ID_IOS_KEY = `${TIKTOK_GROUP}.tiktok_app_id_ios`;
export const TIKTOK_APP_ID_ANDROID_KEY = `${TIKTOK_GROUP}.tiktok_app_id_android`;

/*
 | 틱톡 앱 ID 는 19자리라 숫자로 오면 이미 자릿수가 깨져 있다(2^53 초과) — 글자만 받는다.
 | 어드민에는 글자로 넣는다.
 */
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 플랫폼에 맞는 App Secret — 안드로이드는 안드 전용 칸이 있으면 그것, 없으면 공용 칸 */
export function tiktokSecret(os: string, values: Record<string, unknown> | null | undefined): string {
  if (os === 'android') return str(values?.[TIKTOK_ANDROID_CONFIG_KEY]) || str(values?.[TIKTOK_CONFIG_KEY]);

  return str(values?.[TIKTOK_CONFIG_KEY]);
}

/**
 * 틱톡이 말하는 appId 는 플랫폼마다 다르다 — iOS 는 앱스토어 앱 번호(`extra.appleAppId`),
 * 안드로이드는 패키지 이름(`extra.androidPackage`). 둘 다 공개 값이라 앱 설정(app.json)에 둔다.
 * tiktokAppId 는 이벤트 관리자의 앱 ID — **번들에 굽지 않고** 어드민 값에서 읽는다.
 * iOS 의 틱톡 앱 ID 를 안드로이드에 쓰지 않는다. 비면 그 플랫폼은 꺼져 있다.
 */
export function tiktokIds(
  os: string,
  ex: Record<string, unknown> | null | undefined,
  values: Record<string, unknown> | null | undefined,
): { appId: string; tiktokAppId: string } | null {
  const appId = os === 'ios' ? str(ex?.appleAppId) : os === 'android' ? str(ex?.androidPackage) : '';
  const tiktokAppId = os === 'ios' ? str(values?.[TIKTOK_APP_ID_IOS_KEY])
    : os === 'android' ? str(values?.[TIKTOK_APP_ID_ANDROID_KEY]) : '';
  if (!appId || !tiktokAppId) return null;

  return { appId, tiktokAppId };
}

/** 앱이 쓰는 이름 → 틱톡에 보낼 것. 없으면 null(보내지 않는다) */
export type TikTokCall = { standard: StandardKey } | { custom: string };

export function tiktokEventFor(name: string, _params?: Record<string, unknown>): TikTokCall | null {
  if (name === 'signup_done') return { standard: 'registration' };

  return null;
}

/**
 * `content/config/custom` 응답에서 평평한 값 맵(`values`)을 꺼낸다 — 응답 모양이 `{ value: { values } }` ·
 * `{ config: { values } }` · `{ values }` 로 조금씩 다르다. 없으면 null.
 */
export function customValues(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  for (const c of [o.value, o.config, o]) {
    const v = c && typeof c === 'object' ? (c as Record<string, unknown>).values : undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }

  return null;
}
