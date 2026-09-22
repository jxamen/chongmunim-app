import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expiresSession, isDeadSession } from './deadSession';

describe('expiresSession — 세션을 실어 보낸 요청의 401 만 만료', () => {
  const dead = { code: 'unauthorized', status: 401 };
  it('로그인 전(세션 없이 보낸) 요청의 401 은 만료가 아니다', () => {
    expect(expiresSession(null, null, dead)).toBe(false);
  });
  it('실어 보낸 세션이 지금 세션과 같으면 만료', () => {
    expect(expiresSession('tok-a', 'tok-a', dead)).toBe(true);
  });
  it('그 사이 다시 로그인해 세션이 바뀌었으면 만료가 아니다', () => {
    expect(expiresSession('tok-a', 'tok-b', dead)).toBe(false);
  });
  it('401 이 아니면 만료가 아니다', () => {
    expect(expiresSession('tok-a', 'tok-a', { code: 'network', status: 0 })).toBe(false);
  });
});

describe('앱을 열 때', () => {
  it('회원 확인 실패를 이것으로 가른다 — 아무 실패나 로그아웃으로 보지 않는다', () => {
    const src = readFileSync(join(__dirname, 'store.tsx'), 'utf8');
    const at = src.indexOf("storage.getJson<Session>('cm.session')");
    expect(at).toBeGreaterThan(-1);
    const boot = src.slice(at, src.indexOf('return () => { alive = false;', at));

    expect(boot).toContain('isDeadSession(e)');
    // 못 닿았으면 지난번 회원으로 연다
    expect(boot).toContain('return savedMember;');
  });
});

describe('isDeadSession', () => {
  it('401 이면 죽은 세션', () => {
    expect(isDeadSession({ code: 'unauthorized', status: 401 })).toBe(true);
  });

  it('끊김 · 늦음(status 0)은 아니다 — OTA 받느라 껐다 켠 사람을 내보내면 안 된다', () => {
    expect(isDeadSession({ code: 'network', status: 0 })).toBe(false);
    expect(isDeadSession({ code: 'timeout', status: 0 })).toBe(false);
  });

  it('서버 오류(5xx)는 아니다', () => {
    expect(isDeadSession({ code: 'http_500', status: 500 })).toBe(false);
    expect(isDeadSession({ code: 'http_503', status: 503 })).toBe(false);
  });

  it('소셜 로그인의 401 은 아니다 — 제공자 토큰 거절이다(게스트가 실어 간 세션을 지우면 계정을 잃는다)', () => {
    expect(isDeadSession({ code: 'invalid_token', status: 401 })).toBe(false);
    expect(isDeadSession({ code: 'wrong_app', status: 401 })).toBe(false);
    expect(isDeadSession({ code: 'bad_signature', status: 401 })).toBe(false);
  });

  it('403 은 아니다 — 권한이 없는 것이지 세션이 죽은 게 아니다', () => {
    expect(isDeadSession({ code: 'forbidden', status: 403 })).toBe(false);
  });

  it('오류 모양이 아니면 아니다', () => {
    expect(isDeadSession(new Error('x'))).toBe(false);
    expect(isDeadSession(null)).toBe(false);
    expect(isDeadSession('401')).toBe(false);
  });
});
