import { describe, expect, it } from 'vitest';
import { josa, ro } from './josa';

describe('조사', () => {
  it('이/가', () => {
    expect(josa('동전', '이', '가')).toBe('동전이');
    expect(josa('지폐', '이', '가')).toBe('지폐가');
    expect(josa('저녁 캡슐', '이', '가')).toBe('저녁 캡슐이');
  });

  it('으로/로 — ㄹ 받침은 로', () => {
    expect(ro('동전')).toBe('동전으로');
    expect(ro('지폐')).toBe('지폐로');
    expect(ro('황금 캡슐')).toBe('황금 캡슐로');
  });

  it('한글이 아니면 받침 없음으로', () => {
    expect(josa('30P', '이', '가')).toBe('30P가');
  });
});
