import { describe, expect, it } from 'vitest';
import { returnedFromOutside, type AppPhase } from './loginRescue';

/** 여러 번 오간 것을 순서대로 넣고, 마지막에 놓아 주기로 했는지 본다 */
const run = (...steps: AppPhase[]): boolean => {
  let wentOut = false;
  let rescue = false;
  for (const st of steps) ({ wentOut, rescue } = returnedFromOutside(wentOut, st));

  return rescue;
};

describe('로그인 놓아 주기 — 앱을 떠났다 온 것만', () => {
  it('아이폰 구글 · 웹 로그인(inactive ↔ active)은 놓아 주지 않는다', () => {
    // 앱 위에 창이 떠서 잠깐 inactive 가 됐을 뿐 — 계정을 고르는 중이다
    expect(run('inactive', 'active')).toBe(false);
    expect(run('inactive', 'active', 'inactive', 'active')).toBe(false);
  });

  it('아이콘으로 나갔다 돌아오면 놓아 준다', () => {
    expect(run('inactive', 'background', 'inactive', 'active')).toBe(true);
    expect(run('background', 'active')).toBe(true);
  });

  it('나갔다 온 뒤 다시 창만 떴다 지면 또 놓아 주지 않는다 — 깃발은 한 번 쓰고 내린다', () => {
    let wentOut = false;
    let rescue = false;
    for (const st of ['background', 'active'] as AppPhase[]) ({ wentOut, rescue } = returnedFromOutside(wentOut, st));
    expect(rescue).toBe(true);
    expect(wentOut).toBe(false);

    for (const st of ['inactive', 'active'] as AppPhase[]) ({ wentOut, rescue } = returnedFromOutside(wentOut, st));
    expect(rescue).toBe(false);
  });

  it('처음 켤 때(active 하나)로는 놓아 주지 않는다', () => {
    expect(run('active')).toBe(false);
  });
});
