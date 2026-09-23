/**
 * 앱이 앞으로 올 때 모임을 다시 받는다 — 서버가 plan 을 바꾸면(무료 개방 · 다시 잠금) 켤 때의 값에 머물지 않게.
 * 2026-09-24 앱빌드 A32: 개방 전부터 켜 둔 앱이 설정은 「구독 중」, 영수증은 「무료는 한 번에 한 장」인 채였다. 주석은 떼고 검사(H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const store = strip(fs.readFileSync(path.resolve(__dirname, '../store.tsx'), 'utf8'));

describe('모임 다시 받기', () => {
  it('앞으로 올 때(active) 지금 모임을 조용히 다시 받는다 — 그사이 모임을 바꿨으면 덮지 않는다', () => {
    const at = store.indexOf("if (st === 'active') {");
    const block = store.slice(at, store.indexOf('} else scheduleRemind();', at));
    expect(block).toMatch(/const g = groupNow\.current;\s*if \(g\) void cm\.getGroup\(g\.id\)\.then\(\(fresh\) => \{ if \(groupNow\.current\?\.id === fresh\.id\) setGroup\(fresh\); \}\)\.catch\(\(\) => undefined\);/);
  });

  it('groupNow 는 렌더마다 지금 모임을 가리킨다', () => {
    expect(store).toMatch(/const groupNow = useRef<Group \| null>\(null\);[^\n]*\n\s*groupNow\.current = group;/);
  });
});
