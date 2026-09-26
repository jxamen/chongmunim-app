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
export type Me = { id: number; name: string; role: Role; bankName: string | null; bankAccount: string | null; bankHolder: string | null; notify: NotifyPrefs;
  /** 생일 「MM-DD」(월·일만) */
  birthday: string | null };
export type Group = {
  id: number; name: string; owner: string | null; members: number; admins: number; categories: number; duesAmount: number; me: Me;
  inviteCode: string | null; publicToken: string | null; openingBalance: number; openingDate: string | null;
  /** 구독 — 옛 서버처럼 안 오면 pro(막지 않는다). freeMembers: 무료로 받을 수 있는 인원(총무 빼고) */
  plan: 'free' | 'pro'; freeMembers: number;
  /** 결제한 구독이면 끝(서버 UTC)과 누가 내는지 — 결제 없이 켠 구독은 planPaid false · planUntil null(끝 없음) */
  planUntil: string | null; planPaid: boolean; planMine: boolean;
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
      birthday: str(me.birthday),
    },
    inviteCode: str(g.inviteCode), publicToken: str(g.publicToken),
    plan: g.plan === 'free' ? 'free' : 'pro', freeMembers: num(g.freeMembers, 10),
    planUntil: str(g.planUntil), planPaid: bool(g.planPaid), planMine: bool(g.planMine),
    openingBalance: num(g.openingBalance), openingDate: str(g.openingDate),
    transfer: tr ? { to: str(tr.to), toMe: bool(tr.toMe) } : null,
  };
}

export type RosterItem = { id: number; name: string; role: Role; hasApp: boolean; duesExempt: boolean; bank: string | null; birthday: string | null };
export const toRoster = (j: unknown): RosterItem[] =>
  arr(obj(j).members).map((m) => {
    const o = obj(m);

    return { id: num(o.id), name: str(o.name) ?? '', role: role(o.role), hasApp: bool(o.hasApp), duesExempt: bool(o.duesExempt), bank: str(o.bank), birthday: str(o.birthday) };
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
  /** 가져오는 장부 파일 — 읽는 중이거나 확인을 기다리는 것(총무·관리자에게만 온다) */
  import: { id: string; status: 'choosing' | 'reading' | 'ready'; fileName: string | null; rows: number | null } | null;
  /** 로컬 알림(`remind.ts`)이 쓸 셈 — 총무·관리자에게만 온다 */
  remind: { uncategorized: number; reconciled: boolean; duesUnpaid: number | null; events: { name: string; endsOn: string }[]; birthdays: string[] } | null;
  /** 다가오는 생일(14일 안) — 총무·관리자 · 구독 모임에만 온다 */
  birthdays: { id: number; name: string; md: string; days: number }[];
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
    import: toPendingImport(o.import),
    remind: o.remind && typeof o.remind === 'object' ? toRemind(obj(o.remind)) : null,
    birthdays: arr(o.birthdays).map((x) => ({ id: num(obj(x).id), name: str(obj(x).name) ?? '', md: str(obj(x).md) ?? '', days: num(obj(x).days) }))
      .filter((x) => /^\d{2}-\d{2}$/.test(x.md)),
  };
}

function toRemind(r: J): NonNullable<Home['remind']> {
  return {
    uncategorized: num(r.uncategorized), reconciled: bool(r.reconciled), duesUnpaid: idOrNull(r.duesUnpaid),
    events: arr(r.events).map((e) => ({ name: str(obj(e).name) ?? '', endsOn: str(obj(e).endsOn) ?? '' }))
      .filter((e) => e.name !== '' && /^\d{4}-\d{2}-\d{2}$/.test(e.endsOn)),
    birthdays: arr(r.birthdays).filter((x): x is string => typeof x === 'string' && /^\d{2}-\d{2}$/.test(x)),
  };
}

function toPendingImport(v: unknown): Home['import'] {
  const i = obj(v);
  const status = i.status === 'choosing' || i.status === 'reading' || i.status === 'ready' ? i.status : null;
  if (!status || !str(i.id)) return null;

  return { id: str(i.id) as string, status, fileName: fileNameOf(i.fileName), rows: idOrNull(i.rows) };
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
  /** 비슷한 영수증이 이미 쓰인 곳 — 장부 줄(entry) 또는 지급 요청(request). used: 바로 이 영수증이 쓰였다 */
  duplicate: { occurredAt: string; amount: number; used: boolean; on: 'entry' | 'request' } | null; imageUrl: string | null;
};

/** 보낸 영수증 한 장 — **서버가 기록한다**(receipts/pending, 2026-09-22 태훈님 「올라간 영수증은 서버에 기록 안 하나?」) */
export type PendingJob = { jobId: string; state: 'reading' | 'ready' | 'failed'; note: string | null; review: boolean; receipt: Receipt | null };

export function toPendingJob(j: unknown): PendingJob {
  const o = obj(j);
  const st = str(o.state);

  return {
    jobId: str(o.jobId) ?? '', state: st === 'ready' || st === 'failed' ? st : 'reading', note: str(o.note), review: bool(o.review),
    receipt: o.receipt ? toReceipt({ receipt: o.receipt }) : null,
  };
}

export const toPendingJobs = (j: unknown): PendingJob[] => arr(obj(j).jobs).map(toPendingJob);

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
    duplicate: d ? { occurredAt: str(d.occurredAt) ?? '', amount: num(d.amount), used: d.used === true, on: d.requestId ? 'request' : 'entry' } : null,
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
  /** 결산 공지 — 마감이 보낸 것(「결산 보기」) */
  closingId: number | null;
};
function toNoticeOne(v: unknown): Notice {
  const x = obj(v);

  return {
    id: num(x.id), title: str(x.title) ?? '', author: str(x.author),
    audience: x.audience === 'admins' || x.audience === 'unpaid' ? x.audience : 'all', push: bool(x.push),
    status: x.status === 'draft' ? 'draft' : 'sent', sentAt: str(x.sentAt), recipients: num(x.recipients), reads: num(x.reads),
    readByMe: bool(x.readByMe), preview: str(x.preview) ?? '', body: str(x.body), closingId: idOrNull(x.closingId),
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

/* ── 장부 파일 가져오기 ── */

/** choosing = 여러 탭 파일, 읽을 탭을 고르기 기다림(서버 곧 — 없으면 바로 reading) */
export type ImportStatus = 'choosing' | 'reading' | 'ready' | 'failed' | 'done' | 'undone' | 'canceled';

/** 확인 표 한 줄 — 서버 `LedgerPreview` 가 워커 결과를 이 모임 말로 옮긴 것. `pick` 은 기본 선택일 뿐이다 */
export type ImportRow = {
  i: number; date: string | null; direction: Direction; amount: number;
  /** 원본 항목 이름 · 맞춘 이 모임 항목(없으면 새로 만들 이름) */
  category: string | null; categoryId: number | null;
  memo: string | null; merchant: string | null;
  event: string | null; eventId: number | null;
  sheet: string | null; ref: string | null;
  /** sheet = 다른 시트에 같은 거래가 또 있음(한 번만 센다) · ledger = 이미 장부에 같은 날·같은 금액 */
  dup: 'sheet' | 'ledger' | null; dupOf: number | null; pick: boolean;
};
/** range = 못 읽은 행 범위(「12~70」, chunk_unread 때만) */
export type ImportCheck = { code: string; sheet: string | null; side: Direction | null; expected: number | null; got: number | null; range: string | null };
export type ImportPreview = {
  verdict: 'confirmed' | 'review'; checks: ImportCheck[]; rows: ImportRow[];
  categories: { direction: Direction; name: string; categoryId: number | null; count: number; sum: number }[];
  events: { name: string; eventId: number | null; count: number }[];
  opening: { amount: number; date: string | null } | null;
  closing: { amount: number } | null;
  sourceTotals: { in: number | null; out: number | null };
  totals: { in: number; out: number };
  skipped: { sheet: string | null; ref: string | null; text: string | null; reason: string | null }[];
  counts: { rows: number; sheetDup: number; ledgerDup: number; noDate: number; dropped: number };
};
export type LedgerImport = {
  id: string; status: ImportStatus; source: 'file' | 'sheet'; fileName: string | null;
  verdict: 'confirmed' | 'review' | null; error: string | null; committed: number; createdAt: string;
  preview: ImportPreview | null;
  currentOpening: { amount: number; date: string | null } | null;
  /** 파일의 탭 — choosing 일 때만 온다. rows 는 대략 줄 수 */
  sheets: { name: string; rows: number | null; hidden: boolean }[];
};

const IMPORT_STATUS: ImportStatus[] = ['choosing', 'reading', 'ready', 'failed', 'done', 'undone', 'canceled'];
const dirOrNull = (v: unknown): Direction | null => (v === 'in' || v === 'out' ? v : null);
const ymd = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * 올린 파일 이름 — 아이폰은 한글 이름을 퍼센트로 싸서(「%E1%84%8B…」) 올리고, 글자도 자모가 풀린 꼴(NFD)이다(2026-09-26 앱빌드).
 * 풀고 모아(NFC) 보여 준다. 못 풀면 받은 그대로.
 */
export function fileNameOf(v: unknown): string | null {
  const s = str(v);
  if (!s) return s;
  let out = s;
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try { out = decodeURIComponent(s); } catch { out = s; }
  }

  return out.normalize('NFC');
}

export function toImport(j: unknown): LedgerImport {
  const o = obj(obj(j).import);
  const p = o.preview ? obj(o.preview) : null;
  const co = o.currentOpening ? obj(o.currentOpening) : null;

  return {
    id: str(o.id) ?? '',
    status: IMPORT_STATUS.includes(o.status as ImportStatus) ? (o.status as ImportStatus) : 'failed',
    source: o.source === 'sheet' ? 'sheet' : 'file',
    fileName: fileNameOf(o.fileName),
    verdict: o.verdict === 'confirmed' || o.verdict === 'review' ? o.verdict : null,
    error: str(o.error),
    committed: num(o.committed),
    createdAt: str(o.createdAt) ?? '',
    preview: p ? toPreview(p) : null,
    currentOpening: co ? { amount: num(co.amount), date: ymd(co.date) } : null,
    // 탭 고르기 필드 이름은 서버 확정본에 맞춰 여기서만 바꾼다(sheets[].name · rows)
    sheets: arr(o.sheets).map((x) => ({ name: str(obj(x).name) ?? '', rows: idOrNull(obj(x).rows), hidden: bool(obj(x).hidden) })).filter((x) => x.name !== ''),
  };
}

function toPreview(p: J): ImportPreview {
  const st = obj(p.sourceTotals);
  const t = obj(p.totals);
  const c = obj(p.counts);
  const op = p.opening ? obj(p.opening) : null;
  const cl = p.closing ? obj(p.closing) : null;

  return {
    verdict: p.verdict === 'confirmed' ? 'confirmed' : 'review',
    checks: arr(p.checks).map((x) => {
      const k = obj(x);

      // 워커는 검사 이름을 name 으로 싣기도 한다(chunk_unread — 2026-09-26 qwen) — code 가 없으면 name
      return { code: str(k.code) ?? str(k.name) ?? '', sheet: str(k.sheet), side: dirOrNull(k.side), expected: idOrNull(k.expected), got: idOrNull(k.got), range: typeof k.rows === 'string' ? k.rows : null };
    }),
    rows: arr(p.rows).map((x): ImportRow | null => {
      const r = obj(x);
      const d = dirOrNull(r.direction);
      if (!d || num(r.amount) <= 0) return null;

      return {
        i: num(r.i), date: ymd(r.date), direction: d, amount: num(r.amount),
        category: str(r.category), categoryId: idOrNull(r.categoryId), memo: str(r.memo), merchant: str(r.merchant),
        event: str(r.event), eventId: idOrNull(r.eventId), sheet: str(r.sheet), ref: str(r.ref),
        dup: r.dup === 'sheet' || r.dup === 'ledger' ? r.dup : null, dupOf: idOrNull(r.dupOf), pick: r.pick === true,
      };
    }).filter((r): r is ImportRow => r !== null),
    categories: arr(p.categories).map((x) => {
      const k = obj(x);

      return { direction: dirOrNull(k.direction) ?? 'out', name: str(k.name) ?? '', categoryId: idOrNull(k.categoryId), count: num(k.count), sum: num(k.sum) };
    }).filter((k) => k.name !== ''),
    events: arr(p.events).map((x) => ({ name: str(obj(x).name) ?? '', eventId: idOrNull(obj(x).eventId), count: num(obj(x).count) }))
      .filter((e) => e.name !== ''),
    opening: op ? { amount: num(op.amount), date: ymd(op.date) } : null,
    closing: cl ? { amount: num(cl.amount) } : null,
    sourceTotals: { in: idOrNull(st.in), out: idOrNull(st.out) },
    totals: { in: num(t.in), out: num(t.out) },
    skipped: arr(p.skipped).map((x) => {
      const s = obj(x);

      return { sheet: str(s.sheet), ref: str(s.ref), text: str(s.text), reason: str(s.reason) };
    }),
    counts: { rows: num(c.rows), sheetDup: num(c.sheetDup), ledgerDup: num(c.ledgerDup), noDate: num(c.noDate), dropped: num(c.dropped) },
  };
}

/* ── 공지 받는 사람 ── */

/** 알림 결과 — sent 보냄 · failed 실패 · no_app 앱 없음 · muted 꺼 둠 · no_token 알림 허용 전 · off 알림 없이 보낸 공지 · null 기록 전 공지 */
export type PushResult = 'sent' | 'failed' | 'no_app' | 'muted' | 'no_token' | 'off' | null;
export type NoticeRecipient = { id: number; name: string; hasApp: boolean; push: PushResult; readAt: string | null };

const PUSH_RESULTS: readonly string[] = ['sent', 'failed', 'no_app', 'muted', 'no_token', 'off'];

export function toRecipients(j: unknown): NoticeRecipient[] {
  return arr(obj(j).recipients).map((x) => {
    const o = obj(x);
    const p = str(o.push);

    return { id: num(o.id), name: str(o.name) ?? '', hasApp: bool(o.hasApp), push: p && PUSH_RESULTS.includes(p) ? p as PushResult : null, readAt: str(o.readAt) };
  });
}

/* ── 마감 ── */

export type Closing = {
  id: number; kind: 'month' | 'year' | 'event'; ref: string; title: string; closedAt: string | null; reopenedAt: string | null;
  summary: { in?: number; out?: number; carryOut?: number } | null;
  /** 마감한 순간의 장부 화면 모양(월별 · 연간 · 행사) — 결산 화면이 그대로 그린다 */
  snapshot: unknown;
};

function toClosingOne(v: unknown): Closing {
  const x = obj(v);
  const k = x.kind === 'year' || x.kind === 'event' ? x.kind : 'month';

  return {
    id: num(x.id), kind: k, ref: str(x.ref) ?? '', title: str(x.title) ?? '', closedAt: str(x.closedAt), reopenedAt: str(x.reopenedAt),
    summary: x.summary && typeof x.summary === 'object' ? x.summary as Closing['summary'] : null, snapshot: x.snapshot ?? null,
  };
}
export const toClosings = (j: unknown): Closing[] => arr(obj(j).closings).map(toClosingOne).filter((c) => c.id > 0);
export const toClosing = (j: unknown): Closing => toClosingOne(obj(j).closing);
