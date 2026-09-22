/**
 * 저장 키 분류 검증(함정 B-24).
 *
 * 소스 어딘가에 `cm.` 로 시작하는 키를 새로 쓰면, 기기 키인지 계정 키인지 정할 때까지
 * 이 테스트가 깨진다. 계정 데이터를 기기 키에 두면 계정을 바꿨을 때 앞사람 진행이 그대로 보인다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_KEYS, DEVICE_KEYS } from './keys';

const SRC = join(import.meta.dirname, '.');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }

  return out;
}

describe('저장 키', () => {
  it('기기 키와 계정 키가 겹치지 않는다', () => {
    const both = DEVICE_KEYS.filter((k) => (ACCOUNT_KEYS as readonly string[]).includes(k));
    expect(both).toEqual([]);
  });

  it('전부 cm. 로 시작한다 — 다른 앱과 창고를 나눠 쓰지 않는다', () => {
    for (const k of [...DEVICE_KEYS, ...ACCOUNT_KEYS]) expect(k.startsWith('cm.')).toBe(true);
  });

  it('소스에 쓰인 모든 cm. 키가 둘 중 하나에 등록돼 있다', () => {
    const known = new Set<string>([...DEVICE_KEYS, ...ACCOUNT_KEYS]);
    const used = new Set<string>();

    for (const file of walk(SRC)) {
      // keys.ts 자신은 목록이라 건너뛴다
      if (file.endsWith('keys.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/['"`](cm\.[A-Za-z0-9_.]+)['"`]/g)) used.add(m[1]);
    }

    const missing = [...used].filter((k) => !known.has(k));
    expect(missing).toEqual([]);
  });

  it('세션·고른 모임은 계정 키다 — 로그아웃하면 지워져야 한다', () => {
    for (const k of ['cm.session', 'cm.member', 'cm.group']) {
      expect((ACCOUNT_KEYS as readonly string[]).includes(k)).toBe(true);
    }
  });

  it('기기 ID·테마는 기기 키다 — 로그아웃해도 남아야 한다', () => {
    for (const k of ['cm.device', 'cm.theme']) {
      expect((DEVICE_KEYS as readonly string[]).includes(k)).toBe(true);
    }
  });
});
