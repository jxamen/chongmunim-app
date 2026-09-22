import { describe, expect, it } from 'vitest';
import { planItems } from '@jcurve/notify';
import { DEFAULT_CONFIG, KEYS, pickConfig, remindBases, remindPrefs, remindVars, type RemindSnapshot } from './remind';

/** 기기 시계로 — 알림은 그 폰의 시각에 운다 */
const t = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

const manager = (over: Partial<RemindSnapshot['remind'] & object> = {}, pending = 1): RemindSnapshot => ({
  manager: true, pending,
  remind: { uncategorized: 2, reconciled: false, duesUnpaid: 3, events: [{ name: '가을 산행', endsOn: '2026-10-12' }], ...over },
});

describe('재방문 로컬 알림 — 총무가 앞에 앉는 때', () => {
  it('9월 22일 오후 — 월말 정리 · 다음 달 5일 회비 · 내일 아침 지급 요청 · 행사 다음 날 · 일주일 뒤', () => {
    const b = remindBases(manager(), t(2026, 9, 22, 14));
    expect(b).toEqual({
      [KEYS.tidyMonth]: t(2026, 9, 30, 20),
      [KEYS.duesCheck]: t(2026, 10, 5, 19),        // 이번 달 5일·20일이 지났다 — 새 달 5일
      [KEYS.requestWait]: t(2026, 9, 23, 10),
      [KEYS.eventSettle]: t(2026, 10, 13, 19),
      [KEYS.idle]: t(2026, 9, 29, 19, 30),
    });
  });

  it('회비 — 이번 달 미납이 있으면 5일 · 20일, 다 냈으면 다음 달 5일, 월 회비가 없으면 없다', () => {
    expect(remindBases(manager(), t(2026, 9, 3, 9))[KEYS.duesCheck]).toBe(t(2026, 9, 5, 19));
    expect(remindBases(manager(), t(2026, 9, 10, 9))[KEYS.duesCheck]).toBe(t(2026, 9, 20, 19));
    expect(remindBases(manager({ duesUnpaid: 0 }), t(2026, 9, 3, 9))[KEYS.duesCheck]).toBe(t(2026, 10, 5, 19));
    expect(remindBases(manager({ duesUnpaid: null }), t(2026, 9, 3, 9))).not.toHaveProperty(KEYS.duesCheck);
  });

  it('정리할 게 없으면(항목 다 채움 · 통장 맞춤) 월말 정리는 안 건다, 말일 20시가 지나면 없다', () => {
    expect(remindBases(manager({ uncategorized: 0, reconciled: true }), t(2026, 9, 22))).not.toHaveProperty(KEYS.tidyMonth);
    expect(remindBases(manager({ uncategorized: 0, reconciled: false }), t(2026, 9, 22))[KEYS.tidyMonth]).toBe(t(2026, 9, 30, 20));
    expect(remindBases(manager(), t(2026, 9, 30, 21))[KEYS.tidyMonth]).toBeNull();
    // 12월 말일도 맞는다(달 넘김)
    expect(remindBases(manager(), t(2026, 12, 2))[KEYS.tidyMonth]).toBe(t(2026, 12, 31, 20));
  });

  it('지급 요청이 없으면 안 건다 · 행사가 이미 정산 시각을 지났으면 안 건다', () => {
    expect(remindBases(manager({}, 0), t(2026, 9, 22))).not.toHaveProperty(KEYS.requestWait);
    expect(remindBases(manager({ events: [{ name: '지난 행사', endsOn: '2026-09-01' }] }), t(2026, 9, 22))).not.toHaveProperty(KEYS.eventSettle);
  });

  it('연말 결산은 11월부터, 12월 28일 19시가 지나면 없다', () => {
    expect(remindBases(manager(), t(2026, 10, 31))).not.toHaveProperty(KEYS.yearSettle);
    expect(remindBases(manager(), t(2026, 11, 15))[KEYS.yearSettle]).toBe(t(2026, 12, 28, 19));
    expect(remindBases(manager(), t(2026, 12, 29))[KEYS.yearSettle]).toBeNull();
  });

  it('회원은 「오랜만에」 하나 — 14일 뒤', () => {
    expect(remindBases({ manager: false, pending: 2, remind: null }, t(2026, 9, 22, 14))).toEqual({ [KEYS.idle]: t(2026, 10, 6, 19, 30) });
    expect(remindBases(null, t(2026, 9, 22))).toEqual({});
  });

  it('문구 자리 — 건수와 가장 가까운 행사 이름만(금액·사람 이름 없음)', () => {
    const snap = manager({ events: [{ name: '송년회', endsOn: '2026-12-20' }, { name: '가을 산행', endsOn: '2026-10-12' }] });
    const v = remindVars(snap, t(2026, 9, 22));
    expect(v).toMatchObject({ pending: 1, event: '가을 산행' });
    expect(String(v.idleBody)).toContain('영수증');
    expect(String(remindVars({ manager: false, pending: 0, remind: null }, t(2026, 9, 22)).idleBody)).toContain('회비');
    // 기본 문구 어디에도 금액·원 단위가 없다(잠금 화면)
    expect(JSON.stringify(DEFAULT_CONFIG.items)).not.toMatch(/\d{1,3}(,\d{3})+|원\b/);
  });

  it('스위치 — 「장부 챙김 알림」을 끄면 전부, 회비·지급 요청은 모임 스위치도 따른다', () => {
    expect(Object.values(remindPrefs({ dues: true, request: true, remind: false }))).toEqual([false, false, false, false, false, false]);
    expect(remindPrefs({ dues: false, request: true, remind: true })).toMatchObject({ [KEYS.duesCheck]: false, [KEYS.requestWait]: true, [KEYS.tidyMonth]: true });
  });

  it('어드민이 비어 있으면(빈 배열) 기본값, 항목이 있으면 어드민', () => {
    expect(pickConfig([])).toBe(DEFAULT_CONFIG);
    expect(pickConfig(null)).toBe(DEFAULT_CONFIG);
    const admin = { items: [{ key: KEYS.idle, title: '어드민', body: '문구' }] };
    expect(pickConfig(admin)).toBe(admin);
  });

  it('공용 패키지 계획과 맞물린다 — 문구가 채워지고, 밤(21~8시)에는 아침 9시로 미뤄진다', () => {
    const now = t(2026, 9, 22, 14);
    const snap = manager();
    const plan = planItems(DEFAULT_CONFIG, remindBases(snap, now), { now, vars: remindVars(snap, now), prefs: remindPrefs({ dues: true, request: true, remind: true }) });
    expect(plan.map((p) => p.key)).toEqual([KEYS.requestWait, KEYS.idle, KEYS.tidyMonth, KEYS.duesCheck, KEYS.eventSettle]);
    expect(plan.find((p) => p.key === KEYS.requestWait)!.body).toBe('1건을 처리하면 장부에 바로 적혀요');
    expect(plan.find((p) => p.key === KEYS.eventSettle)!.title).toBe('「가을 산행」 정산할 때예요');
    // 밤에 걸린 시각은 아침으로 — 이 앱이 거는 시각(10·19·19:30·20시)은 모두 낮이라 그대로다
    expect(plan.every((p) => new Date(p.at).getHours() >= 9 && new Date(p.at).getHours() < 21)).toBe(true);
  });
});
