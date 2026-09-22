import { describe, expect, it } from 'vitest';
import { toImport } from './model';
import { byMonth, created, draftsFrom, ledgerExt, mapCategory, summary, targetOf, toCommit, toggle, update } from './importRows';

// 서버 응답(LedgerPreview) 모양 그대로 — 테스트 「확인 표는 겹친 줄과 이미 있는 줄을 빼고…」와 같은 장부
const server = {
  ok: true,
  import: {
    id: 'imp-1', status: 'ready', source: 'file', fileName: '회계장부.xlsx', verdict: 'confirmed', error: null, committed: 0, createdAt: '2026-09-22',
    currentOpening: { amount: 100000, date: '2026-01-01' },
    preview: {
      verdict: 'confirmed', checks: [],
      rows: [
        { i: 0, date: '2026-09-05', direction: 'in', amount: 320000, category: '회비', categoryId: 7, memo: '9월 회비', merchant: null, event: null, eventId: null, sheet: '9월', ref: 'C7', dup: null, dupOf: null, pick: true },
        { i: 1, date: '2026-09-14', direction: 'in', amount: 240000, category: null, categoryId: null, memo: '참가비', merchant: null, event: '가을 체육대회', eventId: null, sheet: '9월', ref: 'C8', dup: null, dupOf: null, pick: true },
        { i: 5, date: '2026-09-16', direction: 'out', amount: 128000, category: '물품비', categoryId: 3, memo: '상품', merchant: null, event: '가을 체육대회', eventId: null, sheet: '9월', ref: 'I10', dup: null, dupOf: null, pick: true },
        { i: 6, date: null, direction: 'out', amount: 12000, category: '물품비', categoryId: 3, memo: '다이소', merchant: null, event: null, eventId: null, sheet: '9월', ref: 'K10', dup: null, dupOf: null, pick: false },
        { i: 8, date: null, direction: 'out', amount: 128000, category: null, categoryId: null, memo: '상품 구입', merchant: null, event: '가을 체육대회', eventId: null, sheet: '가을체육대회', ref: 'C6', dup: 'sheet', dupOf: 5, pick: false },
        { i: 9, date: '2026-08-02', direction: 'out', amount: 50000, category: '찬조금', categoryId: null, memo: null, merchant: '꽃집', event: null, eventId: null, sheet: '8월', ref: 'G5', dup: null, dupOf: null, pick: true },
        { i: 10, date: '2026-09-01', direction: 'sideways', amount: 1 },
      ],
      categories: [{ direction: 'out', name: '물품비', categoryId: 3, count: 2, sum: 140000 }],
      events: [{ name: '가을 체육대회', eventId: null, count: 2 }],
      opening: { amount: 2376000, date: null }, closing: { amount: 2838400 },
      sourceTotals: { in: 660000, out: null }, totals: { in: 560000, out: 190000 },
      skipped: [{ sheet: '9월', ref: 'B10', text: '수입 소계', reason: 'subtotal' }],
      counts: { rows: 6, sheetDup: 1, ledgerDup: 0, noDate: 2, dropped: 0 },
    },
  },
};

describe('가져오기 — 서버 표를 고르고 고칠 줄로', () => {
  const imp = toImport(server);
  const ds = draftsFrom(imp.preview!);

  it('서버 표를 읽는다 — 못 쓰는 줄은 버리고, 맞춘 항목이 없으면 원본 이름이 새 항목 이름이 된다', () => {
    expect(imp.status).toBe('ready');
    expect(imp.preview!.rows).toHaveLength(6);
    expect(imp.preview!.sourceTotals).toEqual({ in: 660000, out: null });
    expect(ds.find((d) => d.i === 9)).toMatchObject({ categoryId: null, categoryName: '찬조금', merchant: '꽃집' });
    expect(ds.find((d) => d.i === 1)).toMatchObject({ eventId: null, eventName: '가을 체육대회' });
  });

  it('기본 선택 — 날짜 있는 줄만 넣는다, 날짜 없는 줄을 고르면 「날짜 없음」으로 따로 센다', () => {
    expect(summary(ds)).toEqual({ count: 4, in: 560000, out: 178000, noDate: 0 });
    const picked = toggle(ds, 6);
    expect(summary(picked).noDate).toBe(1);
    expect(toCommit(picked)).toHaveLength(4);   // 날짜 없는 줄은 안 나간다
    const dated = update(picked, 6, { date: '2026-09-18' });
    expect(summary(dated)).toMatchObject({ count: 5, out: 190000, noDate: 0 });
  });

  it('원본 항목 이름 단위로 한 번에 맞춘다 — 이 모임 항목 · 새로 만들기 · 미분류', () => {
    const toGoods = mapCategory(ds, 'out', '찬조금', { id: 11 });
    expect(targetOf(toGoods, 'out', '찬조금')).toEqual({ id: 11 });
    expect(created(toGoods).categories).toEqual([]);
    const renamed = mapCategory(ds, 'out', '물품비', { name: '행사 물품' });
    expect(renamed.filter((d) => d.source.category === '물품비').every((d) => d.categoryName === '행사 물품' && d.categoryId === null)).toBe(true);
    expect(mapCategory(ds, 'out', '물품비', null).find((d) => d.i === 5)).toMatchObject({ categoryId: null, categoryName: null });
    // 방향이 다른 같은 이름은 건드리지 않는다
    expect(mapCategory(ds, 'in', '물품비', { id: 1 }).find((d) => d.i === 5)!.categoryId).toBe(3);
  });

  it('보낼 줄 — 고른 것만, id 가 있으면 id · 없으면 이름, 빈 칸은 빼고', () => {
    const rows = toCommit(ds);
    expect(rows).toEqual([
      { date: '2026-09-05', direction: 'in', amount: 320000, categoryId: 7, memo: '9월 회비' },
      { date: '2026-09-14', direction: 'in', amount: 240000, eventName: '가을 체육대회', memo: '참가비' },
      { date: '2026-09-16', direction: 'out', amount: 128000, categoryId: 3, eventName: '가을 체육대회', memo: '상품' },
      { date: '2026-08-02', direction: 'out', amount: 50000, categoryName: '찬조금', merchant: '꽃집' },
    ]);
    expect(created(ds)).toEqual({ categories: ['찬조금'], events: ['가을 체육대회'] });
  });

  it('달별로 — 날짜순, 날짜 없는 줄은 맨 끝', () => {
    expect(byMonth(ds).map((m) => [m.key, m.rows.map((r) => r.i)])).toEqual([['2026-08', [9]], ['2026-09', [0, 1, 5]], ['', [6, 8]]]);
  });
});

describe('장부 파일 형식 — 확장자로 거른다', () => {
  it('xlsx · csv · pdf 만 받고, 옛 엑셀은 따로 알린다', () => {
    expect(ledgerExt('2026 회계.XLSX')).toBe('xlsx');
    expect(ledgerExt('장부.csv')).toBe('csv');
    expect(ledgerExt('결산서.pdf')).toBe('pdf');
    expect(ledgerExt('옛장부.xls')).toBe('xls');
    expect(ledgerExt('사진.jpg')).toBeNull();
    expect(ledgerExt('확장자없음')).toBeNull();
  });
});
