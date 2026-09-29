import { describe, expect, it } from 'vitest';
import { DEVICE_KEY, deviceHeader, wantsDevice } from './deviceHeader';

describe('회원 ↔ 기기 연결 머리글', () => {
  const store = (v: string | null) => async (k: string) => (k === DEVICE_KEY ? v : null);
  it('로그인 · 가입 · auth/me 에만', () => {
    expect(['auth/me', 'auth/kakao', 'auth/google', 'auth/apple', 'auth/guest', 'auth/exchange', 'auth/naver', 'auth/toss'].every(wantsDevice)).toBe(true);
    expect(['auth/logout', 'auth/withdraw', 'me', 'missions'].some(wantsDevice)).toBe(false);
  });
  it('퍼널 기기 ID 를 그대로, 모양이 틀리거나 없으면 빈 머리글', async () => {
    expect(await deviceHeader('auth/me', store('m1abcd-3f9k2x7q1z'))).toEqual({ 'X-Device-Id': 'm1abcd-3f9k2x7q1z' });
    expect(await deviceHeader('missions', store('m1abcd-3f9k2x7q1z'))).toEqual({});
    expect(await deviceHeader('auth/me', store(null))).toEqual({});
    expect(await deviceHeader('auth/me', store('짧음'))).toEqual({});
    expect(await deviceHeader('auth/me', async () => { throw new Error('x'); })).toEqual({});
  });
});
