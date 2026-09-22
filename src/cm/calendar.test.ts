import { describe, expect, it } from 'vitest';
import { monthGrid, parseYmd, shiftYm, ymdLabel } from './calendar';

describe('달력', () => {
  it('2026년 9월 — 1일이 화요일이라 앞에 8월 30·31일, 42칸', () => {
    const g = monthGrid(2026, 9);
    expect(g).toHaveLength(42);
    expect(g.slice(0, 3).map((c) => [c.ymd, c.inMonth])).toEqual([['2026-08-30', false], ['2026-08-31', false], ['2026-09-01', true]]);
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g[g.length - 1].ymd).toBe('2026-10-10');
  });
  it('윤년 2월 · 해 넘기기', () => {
    expect(monthGrid(2028, 2).filter((c) => c.inMonth)).toHaveLength(29);
    expect(shiftYm(2026, 12, 1)).toEqual([2027, 1]);
    expect(shiftYm(2026, 1, -1)).toEqual([2025, 12]);
  });
  it('글자 읽기 · 틀린 날짜는 null', () => {
    expect(parseYmd('2026-09-22')).toEqual([2026, 9, 22]);
    expect(parseYmd('2026-02-30')).toBeNull();
    expect(parseYmd('')).toBeNull();
    expect(ymdLabel('2026-09-22')).toBe('2026년 9월 22일 (화)');
    expect(ymdLabel('2026-09-22', 2026)).toBe('9월 22일 (화)');
    expect(ymdLabel('2025-12-31', 2026)).toBe('2025년 12월 31일 (수)');
  });
});
