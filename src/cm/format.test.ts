import { describe, expect, it } from 'vitest';
import {
  MINUS, amountInput, barPercent, dayShort, entrySub, entryTitle, isNight, kstNow, monthChip, monthWord, plusMinus, readAmount, readWhen, shiftMonth,
  signed, whenLong, won,
} from './format';

describe('금액 — 시안 표기 그대로', () => {
  it('쉼표', () => {
    expect(won(1284000)).toBe('1,284,000');
    expect(won(0)).toBe('0');
    expect(won(-186400)).toBe(MINUS + '186,400');
  });
  it('방향 부호 — 빼기는 U+2212', () => {
    expect(signed(320000, 'in')).toBe('+320,000');
    expect(signed(186400, 'out')).toBe('−186,400');
    expect(signed(0, 'out')).toBe('0');   // 「−0」은 이상하다
  });
  it('수지는 0 을 넘나든다', () => {
    expect(plusMinus(142000)).toBe('+142,000');
    expect(plusMinus(-5000)).toBe('−5,000');
    expect(plusMinus(0)).toBe('0');
  });
  it('숫자가 아니어도 멈추지 않는다', () => {
    expect(won(Number.NaN)).toBe('0');
  });
});

describe('날짜 — 장부 일시는 한국 시각 글자라 글자로만 자른다', () => {
  it('시안 2: 9월 21일 토 · 오후 2:14', () => {
    expect(whenLong('2026-09-21 14:14:02')).toBe('9월 21일 월 · 오후 2:14');
    expect(whenLong('2026-09-19 14:14:02')).toBe('9월 19일 토 · 오후 2:14');
  });
  it('0시면 시각을 빼고 날짜만(날짜만 읽힌 영수증)', () => {
    expect(whenLong('2026-09-19 00:00:00')).toBe('9월 19일 토');
  });
  it('자정·정오 표기', () => {
    expect(whenLong('2026-09-19 12:05:00')).toBe('9월 19일 토 · 오후 12:05');
    expect(whenLong('2026-09-19 00:30:00')).toBe('9월 19일 토 · 오전 12:30');
  });
  it('짧게 9/20', () => {
    expect(dayShort('2026-09-20 10:00:00')).toBe('9/20');
    expect(dayShort('엉뚱한 값')).toBe('');
  });
  it('달', () => {
    expect(monthChip('2026-09')).toBe('2026.09');
    expect(monthWord('2026-09')).toBe('9월');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('한국 시각 지금 — 기기 시간대와 무관', () => {
    // 2026-09-21 15:30 UTC = 2026-09-22 00:30 KST
    const k = kstNow(Date.UTC(2026, 8, 21, 15, 30));
    expect(k.ymd).toBe('2026-09-22');
    expect(k.ym).toBe('2026-09');
    expect(k.hour).toBe(0);
  });
  it('밤(21~08시)이면 단체 알림을 한 번 묻는다', () => {
    expect(isNight(Date.UTC(2026, 8, 21, 13, 0))).toBe(true);   // 22시
    expect(isNight(Date.UTC(2026, 8, 21, 22, 59))).toBe(true);  // 07:59
    expect(isNight(Date.UTC(2026, 8, 21, 23, 0))).toBe(false);  // 08시
  });
});

describe('사람이 친 값', () => {
  it('금액은 숫자만 본다', () => {
    expect(readAmount('32,400')).toBe(32400);
    expect(readAmount('32400원')).toBe(32400);
    expect(readAmount('')).toBeNull();
    expect(readAmount('0')).toBeNull();
    expect(readAmount('1234567890123')).toBeNull();
    expect(amountInput('32400')).toBe('32,400');
  });
  it('날짜가 틀리면 null — 2월 30일은 없다', () => {
    expect(readWhen('2026-09-21', '14:14')).toBe('2026-09-21 14:14');
    expect(readWhen('2026.9.1', '')).toBe('2026-09-01 00:00');
    expect(readWhen('2026-02-30', '10:00')).toBeNull();
    expect(readWhen('어제', '10:00')).toBeNull();
  });
  it('막대 폭은 0~100', () => {
    expect(barPercent(416000, 400000)).toBe(100);
    expect(barPercent(57, 100)).toBe(57);
    expect(barPercent(1, 0)).toBe(0);
  });
});

describe('장부 한 줄 — 시안 1 의 말', () => {
  const cats = { 1: '식비', 2: '회비' };
  it('회비는 「회비 입금 · 이름」', () => {
    expect(entryTitle({ source: 'dues', merchant: '김민수', memo: '9월 회비', categoryId: 2, direction: 'in' }, cats)).toBe('회비 입금 · 김민수');
  });
  it('상호 → 내용 → 항목 → 수입/지출 순으로 고른다', () => {
    expect(entryTitle({ source: 'receipt', merchant: '정기산행 간식', memo: null, categoryId: 1, direction: 'out' }, cats)).toBe('정기산행 간식');
    expect(entryTitle({ source: 'manual', merchant: null, memo: null, categoryId: 1, direction: 'out' }, cats)).toBe('식비');
    expect(entryTitle({ source: 'manual', merchant: null, memo: null, categoryId: null, direction: 'in' }, cats)).toBe('수입');
  });
  it('부제 — 9월 20일 · 식비, 지급 요청이면 쓴 사람', () => {
    expect(entrySub({ occurredAt: '2026-09-20 10:00:00', categoryId: 1, source: 'receipt', by: '김태훈' }, cats)).toBe('9월 20일 · 식비');
    expect(entrySub({ occurredAt: '2026-09-18 10:00:00', categoryId: 1, source: 'request', by: '이수진' }, cats)).toBe('9월 18일 · 식비 · 이수진');
    expect(entrySub({ occurredAt: '2026-09-21 00:00:00', categoryId: 2, source: 'dues', by: null }, cats)).toBe('9월 21일');
  });
});
