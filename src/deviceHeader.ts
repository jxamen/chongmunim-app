/**
 * 회원 ↔ 기기 연결(패키지api 2026-09-29) — 로그인 · 가입 · auth/me 에 `X-Device-Id` 를 붙인다.
 * 값은 퍼널이 설치 때 한 번 만든 기기 ID 그대로(저장 키 `cm.device` — 퍼널 · 광고 기록과 같은 값). 새 식별자를 만들지 않는다.
 * 서버는 영문 · 숫자 · 하이픈 8~64자만 받고 틀리면 건너뛴다 — 여기서도 그 모양일 때만 싣는다. RN 없이 시험한다(deviceHeader.test.ts).
 */
export const DEVICE_KEY = 'cm.device';

const AUTH_PATH = /^auth\/(me|kakao|google|apple|naver|guest|exchange|toss)(\/|\?|$)/;

/** 이 경로에 기기 ID 를 실을지 */
export const wantsDevice = (path: string) => AUTH_PATH.test(path);

/** 저장소에서 기기 ID 를 읽어 머리글로 — 없거나 모양이 틀리거나 읽기가 실패하면 빈 머리글(로그인은 그대로) */
export async function deviceHeader(path: string, getItem: (key: string) => Promise<string | null>): Promise<Record<string, string>> {
  if (!wantsDevice(path)) return {};
  const id = await getItem(DEVICE_KEY).catch(() => null);
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id) ? { 'X-Device-Id': id } : {};
}
