/**
 * 공용 API(jcurve-api) 클라이언트 — https://api.j-curve.co.kr/v1/chongmunim/…
 *
 * 요청 함수는 용돈캡슐 `api.ts` 의 `call()` 을 그대로 옮겼다(앱 토큰 · 세션 · 12초에 끊기 · 401 판정).
 * 규약(서버 `routes/api.php` · `routes/chongmunim.php`):
 *  - 앱 식별: 헤더 `X-App-Token` = public_key
 *  - 회원 식별: 헤더 `Authorization: Bearer {세션토큰}`
 *  - 실패: `{ok:false, error:'코드'}`. 검증 실패(422)는 `{message, errors}` 라 `invalid` 로 읽는다
 *
 * **금액을 앱이 정해 서버에 믿게 하지 않는다** — 장부 계산(잔액·이월·집계)은 서버가 하고 앱은 그린다.
 */
import { Platform } from 'react-native';
import { API_BASE, PUBLIC_KEY } from './config';
import { resendIfDropped } from './resend';
import { isDeadSession } from './deadSession';
import { errorCode } from './cm/errors';

export type Member = {
  id: number | string;
  provider: string;
  name?: string | null;
  needsSignup?: boolean;
};

export type Session = { token: string; expiresAt: number };
export type AuthResult = { session: Session; member: Member };

/** 서버가 준 코드 한 단어를 그대로 던진다 — 화면이 사유별로 다르게 말할 수 있게 */
export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

let session: Session | null = null;
let onExpired: (() => void) | null = null;

export const setSession = (s: Session | null): void => { session = s; };
export const currentToken = (): string | null => session?.token ?? null;
/** 세션이 죽었을 때 앱이 할 일(로그아웃 → 로그인 화면)을 등록한다 */
export const onSessionExpired = (fn: () => void): void => { onExpired = fn; };

/** 응답을 기다릴 최대 시간 — `fetch` 는 스스로 포기하지 않는다(용돈캡슐 2026-09-17 제보) */
const TIMEOUT_MS = 12000;
/** 사진 올리기는 더 기다린다(영테크 `SLOW_MS`) */
const SLOW_MS = 40000;

/** 이 기기가 어느 OTA 판으로 도는지 — 어드민이 판별 사용자 수를 센다(용돈캡슐과 같은 헤더) */
let otaHeaders: Record<string, string> | null = null;
function ota(): Record<string, string> {
  if (otaHeaders) return otaHeaders;
  otaHeaders = {};
  if (Platform.OS === 'web') return otaHeaders;
  try {
    const U = require('expo-updates') as typeof import('expo-updates');
    otaHeaders = {
      'x-ota-update-id': U.updateId ?? 'embedded',
      'x-ota-channel': U.channel ?? '',
      'x-ota-runtime': U.runtimeVersion ?? '',
      'x-ota-platform': Platform.OS,
    };
  } catch {
    // 모듈이 없는 빌드 — 붙이지 않는다
  }

  return otaHeaders;
}

async function call<T>(method: string, path: string, body?: unknown, auth = true, ms = TIMEOUT_MS): Promise<T> {
  const headers: Record<string, string> = { 'X-App-Token': PUBLIC_KEY, Accept: 'application/json', ...ota() };
  const form = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (auth && session) headers.Authorization = 'Bearer ' + session.token;

  const ctl = new AbortController();
  // 끊은 것이 우리 시계인지를 따로 적는다 — expo fetch 는 끊을 때 AbortError 가 아니라 「fetch failed」로 던진다
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
  const t0 = Date.now();

  let res: Response;
  try {
    res = await fetch(API_BASE + '/' + path, {
      method,
      headers,
      body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e: any) {
    const code = timedOut || e?.name === 'AbortError' ? 'timeout' : 'network';
    console.warn('[api] ' + method + ' ' + path + ' ' + code + ' ' + (Date.now() - t0) + 'ms ' + String(e?.message ?? e).slice(0, 160));
    throw new ApiError(code, 0);
  } finally {
    clearTimeout(timer);
  }

  let json: any = null;
  try { json = await res.json(); } catch { /* 본문이 없거나 HTML 이면 코드로만 판단한다 */ }

  if (res.status === 401) {
    const code = String(json?.error ?? 'unauthorized');
    // 세션이 죽은 것은 `unauthorized` 뿐이다 — 소셜 토큰 거절(invalid_token 등)로 지우면 게스트 계정을 잃는다
    if (isDeadSession({ status: 401, code })) {
      session = null;
      onExpired?.();
    }
    throw new ApiError(code, 401);
  }
  if (!res.ok || json?.ok === false) throw new ApiError(errorCode(res.status, json), res.status);

  return json as T;
}

export const api = {
  get: <T>(path: string, auth = true) => call<T>('GET', path, undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => call<T>('POST', path, body ?? {}, auth),
  put: <T>(path: string, body?: unknown, auth = true) => call<T>('PUT', path, body ?? {}, auth),
  /** 사진 올리기 — `@jcurve/ocr` 가 만든 폼을 받아 Expo 57 에서 나가는 모양으로 다시 싼다(`upload.ts`) */
  upload: <T>(path: string, body: FormData) => call<T>('POST', path, body, true, SLOW_MS),
};

/* ── 로그인(공용 경로) ── */

/** 서버가 실제로 키를 갖고 있는 제공자 */
export const fetchProviders = (): Promise<{ providers: string[] }> =>
  api.get<{ providers: string[] }>('auth/providers', false);

/** 지금 세션이 게스트면 소셜 로그인 요청에 그 세션을 실어 보낸다 — 서버가 같은 회원에 SNS 를 잇는다(API 문서 §3-3) */
let guestNow = false;
export const setGuestNow = (on: boolean): void => { guestNow = on; };

export const loginKakao = (accessToken: string): Promise<AuthResult> =>
  resendIfDropped(() => api.post<AuthResult>('auth/kakao', { accessToken }, guestNow));
export const loginGoogle = (idToken: string): Promise<AuthResult> =>
  resendIfDropped(() => api.post<AuthResult>('auth/google', { idToken }, guestNow));
export const loginApple = (identityToken: string, name?: string): Promise<AuthResult> =>
  resendIfDropped(() => api.post<AuthResult>('auth/apple', { identityToken, name: name ?? '' }, guestNow));

/** 게스트 — 동의 3종은 화면에서 받은 뒤에만 부른다(서버가 accepted 를 요구한다) */
export const loginGuest = (platform: 'ios' | 'android'): Promise<AuthResult> =>
  api.post<AuthResult>('auth/guest', { age14: true, tos: true, privacy: true, marketing: false, platform }, false);

export const fetchMe = (): Promise<{ member: Member }> => api.get<{ member: Member }>('auth/me');

/** 가입 마무리 — 로그인한 **뒤에** 받은 동의를 남긴다(세션을 먼저 저장해야 한다, API 문서 §3) */
export const completeSignup = (name: string, platform: 'ios' | 'android'): Promise<{ member: Member }> =>
  api.post<{ member: Member }>('auth/complete', { name, age14: true, tos: true, privacy: true, marketing: false, platform });

export const logoutServer = (): Promise<unknown> => api.post('auth/logout');
export const withdrawServer = (): Promise<unknown> => api.post('auth/withdraw');
