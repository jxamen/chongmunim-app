import { describe, expect, it } from 'vitest';
import { resendIfDropped } from './resend';

/** n 번째까지는 `err` 를 던지고 그다음은 'ok' 를 주는 요청 — 몇 번 불렸는지 센다 */
function failing(times: number, err: unknown) {
  const calls = { n: 0 };
  const fn = async () => {
    calls.n += 1;
    if (calls.n <= times) throw err;

    return 'ok';
  };

  return { fn, calls };
}

const dropped = { code: 'network', status: 0 };

describe('resendIfDropped', () => {
  it('끊기면 다시 보낸다 — 카카오톡에서 돌아오는 순간 응답만 잃은 경우', async () => {
    const { fn, calls } = failing(2, dropped);
    await expect(resendIfDropped(fn, [0, 0])).resolves.toBe('ok');
    expect(calls.n).toBe(3);
  });

  it('세 번 다 끊기면 끊김을 그대로 던진다', async () => {
    const { fn, calls } = failing(5, dropped);
    await expect(resendIfDropped(fn, [0, 0])).rejects.toBe(dropped);
    expect(calls.n).toBe(3);
  });

  it('늦음은 다시 보내지 않는다 — 이미 12초를 기다렸다', async () => {
    const late = { code: 'timeout', status: 0 };
    const { fn, calls } = failing(1, late);
    await expect(resendIfDropped(fn, [0, 0])).rejects.toBe(late);
    expect(calls.n).toBe(1);
  });

  it('서버가 답한 거절은 다시 보내지 않는다', async () => {
    const reject = { code: 'invalid_token', status: 400 };
    const { fn, calls } = failing(1, reject);
    await expect(resendIfDropped(fn, [0, 0])).rejects.toBe(reject);
    expect(calls.n).toBe(1);
  });

  it('처음에 되면 한 번만 부른다', async () => {
    const { fn, calls } = failing(0, dropped);
    await expect(resendIfDropped(fn, [0, 0])).resolves.toBe('ok');
    expect(calls.n).toBe(1);
  });
});
