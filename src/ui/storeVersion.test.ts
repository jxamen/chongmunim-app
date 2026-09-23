/**
 * 스토어 업데이트(강제·권장) 연결을 고정한다 — 판단은 `@jcurve/updates` 2.6 이 시험으로 지키고,
 * 여기서는 앱이 **부르는 자리와 조건**만 본다. 주석은 떼고 검사한다(H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const store = strip(fs.readFileSync(path.resolve(__dirname, '../store.tsx'), 'utf8'));

describe('스토어 업데이트 확인', () => {
  it('앱이 켤 때 한 번 checkStoreVersion 을 부르고, 멈추는 함수를 돌려준다', () => {
    expect(store).toMatch(/useEffect\(\(\) => checkStoreVersion\(\{/);
    expect(store.match(/checkStoreVersion\(/g)).toHaveLength(1);
  });

  it('값은 로그인 없이 app/version 에서 읽는다 — 로그인 전 설치본도 막을 수 있어야 한다', () => {
    expect(store).toMatch(/fetch: \(\) => api\.get\('app\/version', false\)/);
  });

  it('권유 창은 로그인 뒤 · 모임 화면 · 로그인 중이 아닐 때만', () => {
    expect(store).toMatch(/canRecommend: \(\) => live\.current\.signedIn && live\.current\.phase === 'main' && !auth\.isAuthorizing\(\)/);
  });
});
