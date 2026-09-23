import { describe, expect, it } from 'vitest';
import { formFrom, isEdited, itemsLine, mergeShots, newShot, pacer, shotBody, type Queued, type Shot } from './shots';
import type { Receipt } from './model';

const rc = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r1', verdict: 'confirmed', store: 'KICC', paidAt: '2026-09-21 14:14:02', total: 32400, businessNumber: null, approval: null,
  items: [{ name: '생수', price: 27400, count: 6 }, { name: '종이컵', price: 5000, count: 2 }],
  merchant: 'GS25 수유점', needsCheck: true, candidates: [], suggestCategoryId: 4, duplicate: null, imageUrl: null, ...over,
});

const ready = (r: Receipt): Shot => ({ ...newShot('a', 'file://a.jpg', '2026-09-22'), state: 'ready', receipt: r, form: formFrom(r, '2026-09-22') });

describe('확인 카드 — 영수증에서 읽은 값으로 채운다', () => {
  it('상호·금액·날짜·시각·항목 제안', () => {
    expect(formFrom(rc(), '2026-09-22')).toEqual({
      merchant: 'GS25 수유점', amount: '32,400', date: '2026-09-21', time: '14:14', categoryId: 4, eventId: null, memo: '',
    });
  });
  it('시각이 00:00 이면 비우고, 날짜를 못 읽었으면 오늘', () => {
    const f = formFrom(rc({ paidAt: null, total: null }), '2026-09-22');
    expect([f.date, f.time, f.amount]).toEqual(['2026-09-22', '', '']);
    expect(formFrom(rc({ paidAt: '2026-09-21 00:00:00' }), '2026-09-22').time).toBe('');
  });
  it('상호가 merchant 에 없으면 store 로 — 「영수증 분석」 입구는 store 에만 줄 때가 있다(A32 「상호 없음」)', () => {
    expect(formFrom(rc({ merchant: null, store: '시험문구 역삼점' }), '2026-09-22').merchant).toBe('시험문구 역삼점');
    expect(formFrom(rc({ merchant: null, store: null }), '2026-09-22').merchant).toBe('');
  });
});

describe('보낼 몸 — 못 보내는 카드는 null', () => {
  it('읽힌 그대로면 영수증 값과 같다', () => {
    expect(shotBody(ready(rc()))).toEqual({
      amount: 32400, occurredAt: '2026-09-21 14:14', merchant: 'GS25 수유점', categoryId: 4, eventId: null, memo: null, receiptId: 'r1',
    });
  });
  it('읽는 중 · 못 읽음 · 이미 적은 그 사진 · 금액 없음은 보내지 않는다', () => {
    expect(shotBody({ ...ready(rc()), state: 'reading' })).toBeNull();
    expect(shotBody({ ...ready(rc()), state: 'failed' })).toBeNull();
    expect(shotBody(ready(rc({ duplicate: { occurredAt: '2026-09-21 14:14', amount: 32400, used: true, on: 'entry' } })))).toBeNull();
    expect(shotBody(ready(rc({ total: null })))).toBeNull();
  });
  it('비슷한 영수증(같은 사진은 아님)은 보낸다', () => {
    expect(shotBody(ready(rc({ duplicate: { occurredAt: '2026-09-21 14:14', amount: 32400, used: false, on: 'entry' } })))).not.toBeNull();
  });
  it('금액·날짜를 고치면 「영수증과 다름」', () => {
    const s = ready(rc());
    expect(isEdited(s)).toBe(false);
    expect(isEdited({ ...s, form: { ...s.form, amount: '23,400' } })).toBe(true);
    expect(isEdited({ ...s, form: { ...s.form, date: '2026-09-20' } })).toBe(true);
    expect(isEdited({ ...s, form: { ...s.form, merchant: '다른 이름' } })).toBe(false);
  });
});

describe('산 것 한 줄', () => {
  it('셋까지 · 나머지는 외 N가지', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((name, i) => ({ name, price: null, count: i === 0 ? 3 : 1 }));
    expect(itemsLine(items)).toBe('a ×3 · b · c 외 2가지');
    expect(itemsLine(items.slice(0, 2))).toBe('a ×3 · b');
  });
});

describe('요청 간격 — 분당 30회 한도', () => {
  it('처음은 바로, 그다음부터는 gap 마다 하나', async () => {
    let t = 1000;
    const waits: number[] = [];
    const pace = pacer(2100, () => t, async (ms) => { waits.push(ms); });
    await pace(); await pace(); await pace();
    expect(waits).toEqual([2100, 4200]);
    t += 10_000;   // 한참 쉬었다 오면 다시 바로
    await pace();
    expect(waits).toEqual([2100, 4200]);
  });
});

describe('읽기 줄 → 카드(mergeShots)', () => {
  const q = (key: string, over: Partial<Queued> = {}): Queued => ({ key, uri: `file://${key}.jpg`, state: 'reading', note: null, receipt: null, review: false, ...over });
  const suggest = (ymd: string | null) => (ymd === '2026-09-21' ? 7 : null);

  it('줄의 차례대로 — 올리는 중 · 읽는 중은 읽는 중, 못 읽은 장은 사유', () => {
    const out = mergeShots([], [q('a', { state: 'sending' }), q('b', { state: 'failed', note: '영수증으로 확인되지 않았어요' })], '2026-09-22', suggest);
    expect(out.map((s) => [s.key, s.state, s.note])).toEqual([['a', 'reading', null], ['b', 'failed', '영수증으로 확인되지 않았어요']]);
  });

  it('새로 읽힌 장은 영수증 값으로 채우고 행사를 날짜로 제안, 자신 없으면 칸을 연다', () => {
    const [s] = mergeShots([], [q('a', { state: 'ready', receipt: rc(), review: true })], '2026-09-22', suggest);
    expect([s.state, s.form.amount, s.form.eventId, s.editing]).toEqual(['ready', '32,400', 7, true]);
  });

  it('이미 읽혀 보고 있는 카드는 그대로(고친 값을 지우지 않는다) · 줄에서 빠진 장은 카드도 빠진다', () => {
    const edited = { ...ready(rc()), key: 'a', form: { ...formFrom(rc(), '2026-09-22'), amount: '30,000' }, note: '저장 실패' };
    const out = mergeShots([edited], [q('a', { state: 'ready', receipt: rc() })], '2026-09-22', suggest);
    expect(out[0]).toBe(edited);
    expect(mergeShots([edited], [], '2026-09-22', suggest)).toEqual([]);
  });
});
