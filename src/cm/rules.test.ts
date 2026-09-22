import { describe, expect, it } from 'vitest';
import { chipOrder, parsePasted, rollup, suggestEvent } from './rules';
import type { Category, ClubEvent } from './model';

describe('붙여넣기 — 시트에서 항목·금액 두 열을 복사해 붙인 것', () => {
  it('탭·쉼표·띄어쓰기 어느 것으로 갈라도 읽는다', () => {
    const r = parsePasted('식비\t921,000\n물품·비품, 687400\n교통비    485,600원\n');
    expect(r.lines).toEqual([
      { name: '식비', amount: 921000 }, { name: '물품·비품', amount: 687400 }, { name: '교통비', amount: 485600 },
    ]);
    expect(r.total).toBe(2094000);
  });
  it('합계·소계 줄은 버린다 — 이중 계상', () => {
    const r = parsePasted('식비\t100\n소계\t100\n합계\t100\n총 계\t100');
    expect(r.lines).toEqual([{ name: '식비', amount: 100 }]);
  });
  it('같은 항목은 더하고, 못 읽은 줄은 말없이 버리지 않는다', () => {
    const r = parsePasted('간식 1,000\n간식 2,000\n그냥 글자\n\n');
    expect(r.lines).toEqual([{ name: '간식', amount: 3000 }]);
    expect(r.skipped).toEqual(['그냥 글자']);
  });
  it('항목 이름 안의 띄어쓰기는 남긴다', () => {
    expect(parsePasted('학생 생일선물  975,000').lines).toEqual([{ name: '학생 생일선물', amount: 975000 }]);
  });
});

const cat = (id: number, name: string, parentId: number | null = null): Category => ({ id, name, parentId, kind: 'out', hidden: false, sort: id });

describe('대분류로 묶기 — 소분류 합이 대분류 소계', () => {
  const cats = [cat(1, '교육·행사·친교'), cat(2, '여름수련회', 1), cat(3, '겨울수련회', 1), cat(4, '식비')];
  it('소분류는 대분류 아래로, 대분류에 직접 붙은 것도 더한다', () => {
    const r = rollup([{ categoryId: 2, sum: 12000 }, { categoryId: 3, sum: 3000 }, { categoryId: 1, sum: 500 }, { categoryId: 4, sum: 9000 }, { categoryId: null, sum: 700 }], cats);
    expect(r.map((x) => [x.name, x.sum])).toEqual([['교육·행사·친교', 15500], ['식비', 9000], ['미분류', 700]]);
    expect(r[0].children.map((c) => c.name)).toEqual(['여름수련회', '겨울수련회']);
  });
  it('칩은 대분류 뒤에 그 소분류가 붙어 나온다', () => {
    expect(chipOrder([cat(4, '식비'), cat(2, '여름수련회', 1), cat(1, '교육·행사·친교')]).map((c) => c.name))
      .toEqual(['식비', '교육·행사·친교', '여름수련회']);
  });
});

const ev = (id: number, startsOn: string | null, endsOn: string | null, status: 'open' | 'closed' = 'open'): ClubEvent =>
  ({ id, name: 'e' + id, startsOn, endsOn, status, budget: 0, in: 0, out: 0, balance: 0, budgetPercent: 0 });

describe('행사 칸 미리 찍기', () => {
  it('기간 안에 드는 진행 중 행사', () => {
    expect(suggestEvent([ev(1, '2026-10-10', '2026-10-12'), ev(2, '2026-07-01', '2026-07-03')], '2026-10-11')).toBe(1);
  });
  it('기간에 안 걸리면 진행 중 행사가 하나뿐일 때만', () => {
    expect(suggestEvent([ev(1, '2026-10-10', '2026-10-12')], '2026-09-01')).toBe(1);
    expect(suggestEvent([ev(1, null, null), ev(2, null, null)], '2026-09-01')).toBeNull();
  });
  it('마감한 행사는 제안하지 않는다', () => {
    expect(suggestEvent([ev(1, '2026-10-10', '2026-10-12', 'closed')], '2026-10-11')).toBeNull();
  });
  it('끝나는 날이 없으면 하루짜리', () => {
    expect(suggestEvent([ev(1, '2026-10-10', null), ev(2, null, null)], '2026-10-10')).toBe(1);
  });
});
