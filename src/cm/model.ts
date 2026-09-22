/**
 * 총무님 서버 응답의 모양 — **받을 때 모양을 확인하고, 어긋난 칸만 비운다**(05 §5-6).
 *
 * 서버가 칸을 바꾸거나 빼도 화면 전체가 멈추면 안 된다. 그래서 모든 값을 여기서 한 번 거른다 —
 * 숫자여야 할 칸에 글자가 오면 0, 글자여야 할 칸에 객체가 오면 null. 렌더에 서버 객체를 그대로 흘리지 않는다.
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`model.test.ts`).
 */

type J = Record<string, unknown>;

const obj = (v: unknown): J => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const idOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(num(v, NaN)) ? num(v) : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';

export type Role = 'owner' | 'admin' | 'member';
const role = (v: unknown): Role => (v === 'owner' || v === 'admin' ? v : 'member');
export const isManager = (r: Role): boolean => r === 'owner' || r === 'admin';

/* ── 모임 ── */

export type GroupItem = { id: number; name: string; role: Role; members: number };
export const toGroups = (j: unknown): GroupItem[] =>
  arr(obj(j).groups).map((g) => ({ id: num(obj(g).id), name: str(obj(g).name) ?? '', role: role(obj(g).role), members: num(obj(g).members) }))
    .filter((g) => g.id > 0);

export type NotifyPrefs = { notice: boolean; dues: boolean; request: boolean };
export type Me = { id: number; name: string; role: Role; bankName: string | null; bankAccount: string | null; bankHolder: string | null; notify: NotifyPrefs };
export type Group = {
  id: number; name: string; owner: string | null; members: number; admins: number; categories: number; duesAmount: number; me: Me;
  inviteCode: string | null; publicToken: string | null; openingBalance: number; openingDate: string | null;
  /** 총무 넘기기 진행 중 — 받을 사람과 그게 나인지 */
  transfer: { to: string | null; toMe: boolean } | null;
};

export function toGroup(j: unknown): Group {
  const g = obj(obj(j).group);
  const me = obj(g.me);
  const n = obj(me.notify);
  const tr = g.transfer ? obj(g.transfer) : null;

  return {
    id: num(g.id), name: str(g.name) ?? '', owner: str(g.owner), members: num(g.members), admins: num(g.admins),
    categories: num(g.categories), duesAmount: num(g.duesAmount),
    me: {
      id: num(me.id), name: str(me.name) ?? '', role: role(me.role),
      bankName: str(me.bankName), bankAccount: str(me.bankAccount), bankHolder: str(me.bankHolder),
      notify: { notice: n.notice !== false, dues: n.dues !== false, request: n.request !== false },
    },
    inviteCode: str(g.inviteCode), publicToken: str(g.publicToken),
    openingBalance: num(g.openingBalance), openingDate: str(g.openingDate),
    transfer: tr ? { to: str(tr.to), toMe: bool(tr.toMe) } : null,
  };
}

export type RosterItem = { id: number; name: string; role: Role; hasApp: boolean; duesExempt: boolean; bank: string | null };
export const toRoster = (j: unknown): RosterItem[] =>
  arr(obj(j).members).map((m) => {
    const o = obj(m);

    return { id: num(o.id), name: str(o.name) ?? '', role: role(o.role), hasApp: bool(o.hasApp), duesExempt: bool(o.duesExempt), bank: str(o.bank) };
  }).filter((m) => m.id > 0);

/* ── 장부 ── */

export type Direction = 'in' | 'out';
const dir = (v: unknown): Direction => (v === 'in' ? 'in' : 'out');

export type Entry = {
  id: number; direction: Direction; amount: number; occurredAt: string; merchant: string | null;
  categoryId: number | null; eventId: number | null; memo: string | null; receiptId: string | null;
  source: string; by: string | null; edited: string[]; eventChecked: boolean;
};

export function toEntry(v: unknown): Entry {
  const o = obj(v);

  return {
    id: num(o.id), direction: dir(o.direction), amount: Math.max(0, num(o.amount)), occurredAt: str(o.occurredAt) ?? '',
    merchant: str(o.merchant), categoryId: idOrNull(o.categoryId), eventId: idOrNull(o.eventId), memo: str(o.memo),
    receiptId: str(o.receiptId), source: str(o.source) ?? 'manual', by: str(o.by),
    edited: arr(o.edited).filter((x): x is string => typeof x === 'string'), eventChecked: bool(o.eventChecked),
  };
}
const entries = (v: unknown): Entry[] => arr(v).map(toEntry).filter((e) => e.id > 0);

/** 항목 id → 이름. 서버는 `{ "3": "식비" }` 로 준다 */
export type Names = Record<number, string>;
export function toNames(v: unknown): Names {
  const out: Names = {};
  for (const [k, n] of Object.entries(obj(v))) if (typeof n === 'string' && Number.isFinite(Number(k))) out[Number(k)] = n;

  return out;
}

export type NoticeBrief = { id: number; title: string; author: string | null; authorRole: Role; reads: number; recipients: number; readByMe: boolean };

export type Home = {
  balance: number;
  month: { month: string; in: number; out: number };
  budget: { year: number; total: number; spent: number; percent: number };
  pending: { count: number; sum: number };
  notice: NoticeBrief | null;
  recent: Entry[];
  categories: Names;
};

export function toHome(j: unknown): Home {
  const o = obj(j);
  const m = obj(o.month);
  const b = obj(o.budget);
  const p = obj(o.pending);
  const n = o.notice ? obj(o.notice) : null;

  return {
    balance: num(o.balance),
    month: { month: str(m.month) ?? '', in: num(m.in), out: num(m.out) },
    budget: { year: num(b.year), total: num(b.total), spent: num(b.spent), percent: num(b.percent) },
    pending: { count: num(p.count), sum: num(p.sum) },
    notice: n && num(n.id) > 0 ? { id: num(n.id), title: str(n.title) ?? '', author: str(n.author), authorRole: role(n.authorRole),
      reads: num(n.reads), recipients: num(n.recipients), readByMe: bool(n.readByMe) } : null,
    recent: entries(o.recent),
    categories: toNames(o.categories),
  };
}

export type MonthGroup = { direction: Direction; categoryId: number | null; name: string | null; count: number; sum: number; entries: Entry[] };
export type Month = { month: string; carryIn: number; in: number; out: number; carryOut: number; groups: MonthGroup[]; uncategorized: number };

export function toMonth(j: unknown): Month {
  const o = obj(j);

  return {
    month: str(o.month) ?? '', carryIn: num(o.carryIn), in: num(o.in), out: num(o.out), carryOut: num(o.carryOut),
    groups: arr(o.groups).map((g) => {
      const x = obj(g);

      return { direction: dir(x.direction), categoryId: idOrNull(x.categoryId), name: str(x.name), count: num(x.count), sum: num(x.sum), entries: entries(x.entries) };
    }),
    uncategorized: num(o.uncategorized),
  };
}

export type CatSum = { categoryId: number | null; name: string | null; sum: number };
export type Year = {
  year: number; carryIn: number; in: number; out: number; carryOut: number;
  months: { month: number; in: number; out: number }[];
  outCategories: CatSum[]; inCategories: CatSum[]; peak: { month: number; event: string | null } | null;
};

const catSums = (v: unknown): CatSum[] => arr(v).map((c) => ({ categoryId: idOrNull(obj(c).categoryId), name: str(obj(c).name), sum: num(obj(c).sum) }));

export function toYear(j: unknown): Year {
  const o = obj(j);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, in: 0, out: 0 }));
  for (const m of arr(o.months)) {
    const x = obj(m);
    const i = num(x.month) - 1;
    if (i >= 0 && i < 12) months[i] = { month: i + 1, in: num(x.in), out: num(x.out) };
  }
  const p = o.peak ? obj(o.peak) : null;

  return {
    year: num(o.year), carryIn: num(o.carryIn), in: num(o.in), out: num(o.out), carryOut: num(o.carryOut), months,
    outCategories: catSums(o.outCategories), inCategories: catSums(o.inCategories),
    peak: p && num(p.month) > 0 ? { month: num(p.month), event: str(p.event) } : null,
  };
}

export type ExportData = {
  group: string; owner: string | null; year: number; carryIn: number; categories: Names; events: Names;
  /** 소분류 id → 대분류 id(대분류는 없다) */
  parents: Record<number, number>;
  budget: { total: number; spent: number; percent: number }; entries: Entry[];
  budgetLines: { categoryId: number; amount: number; spent: number; basis: string | null }[];
  eventRows: { id: number; name: string | null; budget: number; in: number; out: number }[];
};

export function toExport(j: unknown): ExportData {
  const o = obj(j);
  const b = obj(o.budget);

  const parents: Record<number, number> = {};
  for (const [k, v] of Object.entries(obj(o.parents))) if (Number(k) > 0 && num(v) > 0) parents[Number(k)] = num(v);

  return {
    group: str(o.group) ?? '', owner: str(o.owner), year: num(o.year), carryIn: num(o.carryIn),
    categories: toNames(o.categories), events: toNames(o.events), parents,
    budget: { total: num(b.total), spent: num(b.spent), percent: num(b.percent) }, entries: entries(o.entries),
    budgetLines: arr(o.budgetLines).map((l) => ({ categoryId: num(obj(l).categoryId), amount: num(obj(l).amount), spent: num(obj(l).spent), basis: str(obj(l).basis) }))
      .filter((l) => l.categoryId > 0),
    eventRows: arr(o.eventRows).map((e) => ({ id: num(obj(e).id), name: str(obj(e).name), budget: num(obj(e).budget), in: num(obj(e).in), out: num(obj(e).out) }))
      .filter((e) => e.id > 0),
  };
}

/* ── 영수증 ── */

export type Receipt = {
  id: string; verdict: string | null; store: string | null; paidAt: string | null; total: number | null;
  businessNumber: string | null; approval: string | null; items: { name: string; price: number | null; count: number }[];
  merchant: string | null; needsCheck: boolean; candidates: string[];
  /** 같은 가게에 지난번 붙인 항목 — 칩을 미리 찍어 둘 뿐이다(제안이지 확정이 아니다) */
  suggestCategoryId: number | null;
  /** 비슷한 영수증을 이미 적었다 — `used` 면 **바로 이 영수증**(같은 사진)이라 다시 적을 수 없다 */
  duplicate: { occurredAt: string; amount: number; used: boolean } | null; imageUrl: string | null;
};

export function toReceipt(j: unknown): Receipt {
  const o = obj(obj(j).receipt);
  const d = o.duplicate ? obj(o.duplicate) : null;

  return {
    id: str(o.id) ?? '', verdict: str(o.verdict), store: str(o.store), paidAt: str(o.paidAt),
    total: o.total === null || o.total === undefined ? null : num(o.total, 0) || null,
    businessNumber: str(o.businessNumber), approval: str(o.approval),
    items: arr(o.items).map((i) => ({ name: str(obj(i).name) ?? '', price: obj(i).price == null ? null : num(obj(i).price), count: num(obj(i).count, 1) }))
      .filter((i) => i.name !== ''),
    merchant: str(o.merchant), needsCheck: o.needsCheck !== false, suggestCategoryId: idOrNull(o.suggestCategoryId),
    candidates: arr(o.candidates).filter((c): c is string => typeof c === 'string' && c !== ''),
    duplicate: d ? { occurredAt: str(d.occurredAt) ?? '', amount: num(d.amount), used: d.used === true } : null,
    imageUrl: str(o.imageUrl),
  };
}

/* ── 지급 요청 ── */

export type RequestStatus = 'pending' | 'paid' | 'rejected';
export type PayRequest = {
  id: number; requester: string | null; mine: boolean; amount: number; occurredAt: string; merchant: string | null;
  categoryId: number | null; eventId: number | null; memo: string | null; receiptId: string | null; bank: string | null;
  bankCopy: string | null; status: RequestStatus; decidedBy: string | null; rejectReason: string | null;
};
const reqStatus = (v: unknown): RequestStatus => (v === 'paid' || v === 'rejected' ? v : 'pending');

export function toRequests(j: unknown): { counts: Record<RequestStatus, number>; items: PayRequest[] } {
  const o = obj(j);
  const c = obj(o.counts);

  return {
    counts: { pending: num(c.pending), paid: num(c.paid), rejected: num(c.rejected) },
    items: arr(o.requests).map((r) => {
      const x = obj(r);

      return {
        id: num(x.id), requester: str(x.requester), mine: bool(x.mine), amount: num(x.amount), occurredAt: str(x.occurredAt) ?? '',
        merchant: str(x.merchant), categoryId: idOrNull(x.categoryId), eventId: idOrNull(x.eventId), memo: str(x.memo),
        receiptId: str(x.receiptId), bank: str(x.bank), bankCopy: str(x.bankCopy), status: reqStatus(x.status),
        decidedBy: str(x.decidedBy), rejectReason: str(x.rejectReason),
      };
    }).filter((r) => r.id > 0),
  };
}

/* ── 행사 ── */

export type ClubEvent = {
  id: number; name: string; startsOn: string | null; endsOn: string | null; status: 'open' | 'closed'; budget: number;
  in: number; out: number; balance: number; budgetPercent: number;
};
function toEvent(v: unknown): ClubEvent {
  const x = obj(v);

  return {
    id: num(x.id), name: str(x.name) ?? '', startsOn: str(x.startsOn), endsOn: str(x.endsOn), status: x.status === 'closed' ? 'closed' : 'open',
    budget: num(x.budget), in: num(x.in), out: num(x.out), balance: num(x.balance), budgetPercent: num(x.budgetPercent),
  };
}
export const toEvents = (j: unknown): ClubEvent[] => arr(obj(j).events).map(toEvent).filter((e) => e.id > 0);

export type EventDetail = { event: ClubEvent; incomes: { categoryId: number | null; name: string | null; count: number; sum: number }[]; entries: Entry[] };
export function toEventDetail(j: unknown): EventDetail {
  const o = obj(j);

  return {
    event: toEvent(o.event),
    incomes: arr(o.incomes).map((i) => ({ categoryId: idOrNull(obj(i).categoryId), name: str(obj(i).name), count: num(obj(i).count), sum: num(obj(i).sum) })),
    entries: entries(o.entries),
  };
}

/* ── 예산 · 항목 ── */

export type BudgetLine = {
  categoryId: number; parentId: number | null; name: string; amount: number; basis: string | null; spent: number;
  /** 작년 집행 — 그해 장부 기록, 없으면 붙여넣어 가져온 값(`lastYearImported`) */
  lastYear: number; lastYearImported: boolean;
};
export type Budget = { year: number; total: number; spent: number; percent: number; lines: BudgetLine[] };
export function toBudget(j: unknown): Budget {
  const o = obj(j);

  return {
    year: num(o.year), total: num(o.total), spent: num(o.spent), percent: num(o.percent),
    lines: arr(o.lines).map((l) => {
      const x = obj(l);

      return { categoryId: num(x.categoryId), parentId: idOrNull(x.parentId), name: str(x.name) ?? '', amount: num(x.amount), basis: str(x.basis),
        spent: num(x.spent), lastYear: num(x.lastYear), lastYearImported: bool(x.lastYearImported) };
    }).filter((l) => l.categoryId > 0),
  };
}

export type Category = { id: number; parentId: number | null; name: string; kind: Direction; hidden: boolean; sort: number };
export const toCategories = (j: unknown): Category[] =>
  arr(obj(j).categories).map((c) => {
    const x = obj(c);

    return { id: num(x.id), parentId: idOrNull(x.parentId), name: str(x.name) ?? '', kind: dir(x.kind), hidden: bool(x.hidden), sort: num(x.sort) };
  }).filter((c) => c.id > 0);

/* ── 회비 ── */

export type DuesRow = { memberId: number; name: string; hasApp: boolean; exempt: boolean; paid: { id: number; amount: number; paidOn: string } | null };
export type Dues = {
  period: string; amount: number; payers: number; paidCount: number; unpaidCount: number; collected: number; unpaidSum: number;
  members: DuesRow[]; mine: { period: string; amount: number; paidOn: string }[];
};
export function toDues(j: unknown): Dues {
  const o = obj(j);

  return {
    period: str(o.period) ?? '', amount: num(o.amount), payers: num(o.payers), paidCount: num(o.paidCount),
    unpaidCount: num(o.unpaidCount), collected: num(o.collected), unpaidSum: num(o.unpaidSum),
    members: arr(o.members).map((m) => {
      const x = obj(m);
      const p = x.paid ? obj(x.paid) : null;

      return { memberId: num(x.memberId), name: str(x.name) ?? '', hasApp: bool(x.hasApp), exempt: bool(x.exempt),
        paid: p && num(p.id) > 0 ? { id: num(p.id), amount: num(p.amount), paidOn: str(p.paidOn) ?? '' } : null };
    }).filter((m) => m.memberId > 0),
    mine: arr(o.mine).map((m) => ({ period: str(obj(m).period) ?? '', amount: num(obj(m).amount), paidOn: str(obj(m).paidOn) ?? '' })),
  };
}

/* ── 공지 ── */

export type Audience = 'all' | 'admins' | 'unpaid';
export type Notice = {
  id: number; title: string; author: string | null; audience: Audience; push: boolean; status: 'draft' | 'sent';
  sentAt: string | null; recipients: number; reads: number; readByMe: boolean; preview: string; body: string | null;
};
function toNoticeOne(v: unknown): Notice {
  const x = obj(v);

  return {
    id: num(x.id), title: str(x.title) ?? '', author: str(x.author),
    audience: x.audience === 'admins' || x.audience === 'unpaid' ? x.audience : 'all', push: bool(x.push),
    status: x.status === 'draft' ? 'draft' : 'sent', sentAt: str(x.sentAt), recipients: num(x.recipients), reads: num(x.reads),
    readByMe: bool(x.readByMe), preview: str(x.preview) ?? '', body: str(x.body),
  };
}
export const toNotices = (j: unknown): Notice[] => arr(obj(j).notices).map(toNoticeOne).filter((n) => n.id > 0);
export const toNotice = (j: unknown): Notice => toNoticeOne(obj(j).notice);

/* ── 정리 모드 ── */

export type Tidy = {
  month: string; total: number;
  uncategorized: { count: number; groups: { merchant: string | null; direction: Direction; count: number; sum: number; ids: number[] }[] };
  eventCheck: { events: { id: number; name: string }[]; entries: Entry[] };
  reconcile: { book: number; done: boolean; last: { period: string; bank: number; book: number; diff: number } | null };
};
export function toTidy(j: unknown): Tidy {
  const o = obj(j);
  const u = obj(o.uncategorized);
  const e = obj(o.eventCheck);
  const r = obj(o.reconcile);
  const last = r.last ? obj(r.last) : null;

  return {
    month: str(o.month) ?? '', total: num(o.total),
    uncategorized: {
      count: num(u.count),
      groups: arr(u.groups).map((g) => {
        const x = obj(g);

        return { merchant: str(x.merchant), direction: dir(x.direction), count: num(x.count), sum: num(x.sum),
          ids: arr(x.ids).map((i) => num(i)).filter((i) => i > 0) };
      }),
    },
    eventCheck: { events: arr(e.events).map((v) => ({ id: num(obj(v).id), name: str(obj(v).name) ?? '' })).filter((v) => v.id > 0), entries: entries(e.entries) },
    reconcile: { book: num(r.book), done: bool(r.done),
      last: last ? { period: str(last.period) ?? '', bank: num(last.bank), book: num(last.book), diff: num(last.diff) } : null },
  };
}
