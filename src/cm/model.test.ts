import { describe, expect, it } from 'vitest';
import { toDues, toEntry, toGroup, toHome, toMonth, toReceipt, toRequests, toTidy, toYear } from './model';
import { codeOf, errorCode, errorText } from './errors';

describe('서버 응답이 어긋나도 화면이 멈추지 않는다(05 §5-6)', () => {
  it('빈 응답도 모양이 선다', () => {
    const h = toHome(null);
    expect(h.balance).toBe(0);
    expect(h.recent).toEqual([]);
    expect(h.notice).toBeNull();
    expect(toMonth(undefined).groups).toEqual([]);
    expect(toYear('x').months).toHaveLength(12);
    expect(toTidy(42).uncategorized.groups).toEqual([]);
  });

  it('칸의 형이 틀리면 그 칸만 비운다 — 객체가 글자 자리에 와도 렌더에 흘리지 않는다', () => {
    const e = toEntry({ id: 3, direction: 'weird', amount: '32400', merchant: { x: 1 }, categoryId: 'a', edited: ['amount', 7] });
    expect(e.direction).toBe('out');
    expect(e.amount).toBe(32400);
    expect(e.merchant).toBeNull();
    expect(e.categoryId).toBeNull();
    expect(e.edited).toEqual(['amount']);
  });

  it('id 가 없는 줄은 버린다', () => {
    expect(toHome({ recent: [{ amount: 1 }, { id: 2, amount: 1 }] }).recent.map((e) => e.id)).toEqual([2]);
  });

  it('알림 설정은 빠진 키를 켜짐으로 읽는다', () => {
    const g = toGroup({ group: { id: 1, me: { role: 'owner', notify: { dues: false } } } });
    expect(g.me.role).toBe('owner');
    expect(g.me.notify).toEqual({ notice: true, dues: false, request: true });
    expect(g.inviteCode).toBeNull();
  });

  it('모르는 역할은 회원으로 — 더 많은 권한으로 읽지 않는다', () => {
    expect(toGroup({ group: { me: { role: 'superuser' } } }).me.role).toBe('member');
  });

  it('연간 달은 1~12 만, 모자라면 0 으로 채운다', () => {
    const y = toYear({ months: [{ month: 7, out: 900 }, { month: 13, out: 1 }] });
    expect(y.months[6].out).toBe(900);
    expect(y.months.reduce((s, m) => s + m.out, 0)).toBe(900);
  });

  it('영수증 — 금액을 못 읽었으면 null(0 을 금액으로 넣지 않는다), 확인 필요는 기본으로 켠다', () => {
    const r = toReceipt({ receipt: { id: 'a', total: 0, candidates: ['GS25', '', 3] } });
    expect(r.total).toBeNull();
    expect(r.needsCheck).toBe(true);
    expect(r.candidates).toEqual(['GS25']);
  });

  it('영수증 중복 — 바로 이 영수증(같은 사진)일 때만 used, 없으면 false(비슷한 것은 막지 않는다)', () => {
    const same = toReceipt({ receipt: { id: 'a', duplicate: { occurredAt: '2026-09-21 14:14', amount: 32400, used: true } } });
    expect(same.duplicate).toEqual({ occurredAt: '2026-09-21 14:14', amount: 32400, used: true });
    const like = toReceipt({ receipt: { id: 'b', duplicate: { occurredAt: '2026-09-21 14:14', amount: 32400 } } });
    expect(like.duplicate?.used).toBe(false);
  });

  it('지급 요청 · 회비', () => {
    const q = toRequests({ counts: { pending: 2 }, requests: [{ id: 1, status: 'paid', amount: 8800 }, { id: 0 }] });
    expect(q.counts).toEqual({ pending: 2, paid: 0, rejected: 0 });
    expect(q.items).toHaveLength(1);
    expect(q.items[0].status).toBe('paid');
    const d = toDues({ members: [{ memberId: 3, name: '김민수', paid: { id: 9, amount: 40000, paidOn: '2026-09-21' } }, { memberId: 4, paid: null }] });
    expect(d.members[0].paid?.amount).toBe(40000);
    expect(d.members[1].paid).toBeNull();
  });
});

describe('오류 → 할 수 있는 일', () => {
  it('우리 경로는 error, 라라벨 기본은 message, 검증은 invalid', () => {
    expect(errorCode(409, { ok: false, error: 'receipt_used' })).toBe('receipt_used');
    expect(errorCode(403, { message: 'ocr_disabled' })).toBe('ocr_disabled');
    expect(errorCode(422, { message: 'The name field is required.', errors: { name: ['x'] } })).toBe('invalid');
    expect(errorCode(500, { message: 'Server Error' })).toBe('http_500');
    expect(errorCode(502, null)).toBe('http_502');
  });
  it('문장', () => {
    expect(errorText('bank_required')).toContain('계좌');
    expect(errorText('http_503')).toContain('서버');
    expect(errorText('처음 보는 코드')).toBe('잠시 뒤 다시 해 주세요');
    expect(codeOf({ code: 'network' })).toBe('network');
    expect(codeOf(new Error('x'))).toBe('unknown');
  });
});
