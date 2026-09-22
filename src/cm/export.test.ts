import { describe, expect, it } from 'vitest';
import { eventShareText, reportHtml, settle, toCsv } from './export';
import { toEntry, type ExportData } from './model';

const data: ExportData = {
  group: '토요등산회', owner: '김태훈', year: 2026, carryIn: 100000,
  categories: { 1: '식비', 2: '회비', 3: '행사·친교', 4: '여름수련회' }, events: { 5: '가을 체육대회' }, parents: { 4: 3 },
  budget: { total: 400000, spent: 32400, percent: 8 },
  budgetLines: [{ categoryId: 1, amount: 400000, spent: 32400, basis: '월 2회 × 12개월' }],
  eventRows: [{ id: 5, name: '가을 체육대회', budget: 600000, in: 0, out: 32400 }],
  entries: [
    toEntry({ id: 1, direction: 'in', amount: 40000, occurredAt: '2026-09-18 00:00:00', merchant: '이수진', categoryId: 2, memo: '9월 회비', source: 'dues' }),
    toEntry({ id: 2, direction: 'out', amount: 32400, occurredAt: '2026-09-20 14:14:02', merchant: '=GS25, "수유점"', categoryId: 1, eventId: 5, receiptId: 'r1' }),
  ],
};

describe('엑셀(CSV)', () => {
  const csv = toCsv(data);
  it('한글이 깨지지 않게 BOM 으로 시작한다', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
  it('쉼표·따옴표는 감싸고, 수식처럼 보이는 글자는 막는다', () => {
    expect(csv).toContain(`"'=GS25, ""수유점"""`);
  });
  it('지출은 음수 숫자 그대로 — 엑셀이 더할 수 있다', () => {
    expect(csv).toContain(',지출,-32400,');
    expect(csv).not.toContain("'-32400");
  });
  it('이월로 시작해 잔액으로 끝난다', () => {
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toContain('이월,100000');
    expect(lines[lines.length - 1]).toContain('잔액,107600');
  });
});

describe('결산서', () => {
  it('수입·지출·이월이 맞다', () => {
    const s = settle(data);
    expect(s.inTotal).toBe(40000);
    expect(s.outTotal).toBe(32400);
    expect(s.carryOut).toBe(107600);
    expect(s.months[8]).toEqual({ in: 40000, out: 32400 });
  });
  it('소분류는 대분류 아래로 묶는다', () => {
    const d2 = { ...data, entries: [...data.entries, toEntry({ id: 3, direction: 'out', amount: 5000, occurredAt: '2026-07-01 00:00:00', categoryId: 4 })] };
    const s = settle(d2);
    const top = s.outs.find((o) => o.name === '행사·친교');
    expect(top?.sum).toBe(5000);
    expect(top?.children).toEqual([{ name: '여름수련회', sum: 5000 }]);
  });
  it('결산서에 예산 대비 집행 · 행사별 정산 표가 들어간다', () => {
    const html = reportHtml(data, '2026.12.31');
    expect(html).toContain('예산 대비 집행');
    expect(html).toContain('367,600');   // 잔여 400,000 − 32,400
    expect(html).toContain('근거 · 월 2회 × 12개월');
    expect(html).toContain('행사별 정산');
    expect(html).toContain('가을 체육대회');
  });
  it('HTML — 제목·잔액·서명 칸, 이름은 이스케이프', () => {
    const html = reportHtml({ ...data, group: '<b>등산</b>' }, '2026년 12월 31일');
    expect(html).toContain('&lt;b&gt;등산&lt;/b&gt; 2026년 결산서');
    expect(html).toContain('107,600');
    expect(html).toContain('감사');
  });
});

describe('행사 정산서 — 카톡에 붙일 글', () => {
  it('수입 내역·지출 줄·수지', () => {
    const text = eventShareText({
      event: { id: 5, name: '가을 체육대회', startsOn: '2026-10-12', endsOn: null, status: 'open', budget: 600000, in: 580000, out: 438000, balance: 142000, budgetPercent: 73 },
      incomes: [{ categoryId: 3, name: '참가비', count: 24, sum: 480000 }, { categoryId: 4, name: '찬조', count: 1, sum: 100000 }],
      entries: [toEntry({ id: 9, direction: 'out', amount: 154000, occurredAt: '2026-09-18 10:00:00', merchant: '단체 티셔츠 25장' })],
    }, {}, '토요등산회');
    expect(text).toContain('[토요등산회] 가을 체육대회 정산');
    expect(text).toContain('참가비 24건 480,000');
    expect(text).toContain('9/18 단체 티셔츠 25장 154,000');
    expect(text).toContain('수지 +142,000원');
    expect(text).toContain('73% 사용');
  });
});
