/**
 * 새 버전(OTA)은 **늘 조용히 저절로 적용한다**(대표님 10-03 「적용하기 없이 그냥 자동 적용」 「무조건 자동」).
 * 띠(「새 버전이 준비됐어요 · 지금 적용」)와 설정 「새 버전 알려 주기」는 지웠다 — 다시 생기지 않게 못 박는다.
 * 적용하는 순간은 @jcurve/updates 가 고른다(로그인 · 가입 · 모임 고르기 · 구독 안내 도중이 아니고, 앱 앞 · 메인 첫 화면).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const strip = (code: string): string => code
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'android', 'ios'].includes(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const store = (): string => strip(fs.readFileSync(path.join(ROOT, 'src', 'store.tsx'), 'utf8'));

describe('새 버전은 늘 저절로 적용한다', () => {
  it('autoApply 에 notice 를 늘 끈다', () => {
    expect(store()).toMatch(/notice:\s*\(\)\s*=>\s*false/);
  });

  it('띠 · 「지금 적용」 · 「새 버전 알려 주기」가 없다', () => {
    const hits = sources(path.join(ROOT, 'src')).concat([path.join(ROOT, 'App.tsx')])
      .filter((f) => /\b(applyUpdate|onUpdateReady|canApplyNow|updateNotice|updateReady)\b|새 버전 알려 주기|지금 적용/.test(strip(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('로그인 · 가입 · 구독 안내 도중은 안전한 순간이 아니다', () => {
    const line = store().split('\n').find((l) => /busy:\s*\(\)\s*=>/.test(l)) ?? '';
    expect(line).toContain('isAuthorizing()');
    expect(line).toContain('live.current.plan');
  });

  it('이 앱 코드는 reloadAsync 를 직접 부르지 않는다', () => {
    const hits = sources(path.join(ROOT, 'src')).concat([path.join(ROOT, 'App.tsx')])
      .filter((f) => /\breloadAsync\s*\(/.test(strip(fs.readFileSync(f, 'utf8'))));
    expect(hits).toEqual([]);
  });
});
