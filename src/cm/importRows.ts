/**
 * 가져오기 확인 표의 셈 — 서버가 준 표(`ImportPreview`)를 화면이 고르고 고치는 줄(`Draft`)로, 다시 서버에 보낼 줄(`CommitRow`)로.
 *
 * **넣는 것은 사람이 고른 줄뿐이다**(기획 「결과를 표로 보여주고 사용자가 확인한 뒤에」). 서버가 정한 기본 선택
 * (겹친 줄 · 이미 있는 줄 · 날짜 없는 줄은 꺼 둠)에서 시작하고, 날짜가 없는 줄은 날짜를 적기 전에는 넣지 못한다.
 * 항목은 원본 이름 단위로 한 번에 맞춘다(「물품비」 스무 줄을 하나씩 고치지 않게) — 이 모임 항목, 새로 만들기, 미분류 셋 중 하나.
 */
import type { Direction, ImportPreview, ImportRow } from './model';

export type LedgerExt = 'xlsx' | 'csv' | 'pdf';

/** 받는 형식이면 그 확장자, 옛 엑셀(xls)이면 'xls', 나머지는 null — 거르기는 MIME 이 아니라 이름으로(`ledgerFile.ts`) */
export function ledgerExt(name: string): LedgerExt | 'xls' | null {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  const ext = m ? m[1].toLowerCase() : '';

  return ext === 'xlsx' || ext === 'csv' || ext === 'pdf' || ext === 'xls' ? ext : null;
}

/** 구글 시트 링크의 파일 id — 시트 링크가 아니면 null(서버 `fromSheet` 와 같은 규칙: docs.google.com/spreadsheets/d/{id}) */
export function sheetFileId(url: string): string | null {
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/.exec(url.trim());

  return m ? m[1] : null;
}

export type Draft = {
  i: number; pick: boolean; date: string | null; direction: Direction; amount: number;
  /** 둘 다 null 이면 미분류. categoryName 은 새로 만들 항목 이름 */
  categoryId: number | null; categoryName: string | null;
  eventId: number | null; eventName: string | null;
  memo: string | null; merchant: string | null;
  /** 이름 단위로 맞출 원본 항목 — 보통 원본 그대로, 묶이면 앞말(「아웃팅 치킨」 → 「아웃팅」) */
  cat: string | null;
  /** 묶여서 떨어진 뒷말(「치킨」) — 메모 맨 앞에도 붙어 있다 */
  detail: string | null;
  /** 원본에 적혀 있던 것 — 고쳐도 남겨 둔다(원본과 대조) */
  source: { category: string | null; event: string | null; sheet: string | null; ref: string | null };
  dup: ImportRow['dup'];
};

export type CommitRow = {
  date: string; direction: Direction; amount: number;
  categoryId?: number; categoryName?: string; eventId?: number; eventName?: string; memo?: string; merchant?: string;
};

export function draftsFrom(p: ImportPreview): Draft[] {
  return p.rows.map((r) => ({
    i: r.i, pick: r.pick, date: r.date, direction: r.direction, amount: r.amount,
    categoryId: r.categoryId, categoryName: r.categoryId === null ? r.category : null,
    eventId: r.eventId, eventName: r.eventId === null ? r.event : null,
    memo: r.memo, merchant: r.merchant, cat: r.category, detail: null,
    source: { category: r.category, event: r.event, sheet: r.sheet, ref: r.ref },
    dup: r.dup,
  }));
}

export type CategoryTarget = { id: number } | { name: string } | null;

/** 원본 항목 이름 하나를 통째로 — 이 모임 항목(`{id}`), 새로 만들기(`{name}`), 미분류(null) */
export function mapCategory(ds: Draft[], direction: Direction, sourceName: string, to: CategoryTarget): Draft[] {
  return ds.map((d) => (d.direction === direction && d.cat === sourceName
    ? { ...d, categoryId: to && 'id' in to ? to.id : null, categoryName: to && 'name' in to ? to.name : null }
    : d));
}

/** 원본 항목 이름이 지금 어디로 가는가 — 첫 줄을 본다(이름 단위로 맞추므로 같다) */
export function targetOf(ds: Draft[], direction: Direction, sourceName: string): CategoryTarget {
  const d = ds.find((x) => x.direction === direction && x.cat === sourceName);
  if (!d) return null;

  return d.categoryId !== null ? { id: d.categoryId } : d.categoryName ? { name: d.categoryName } : null;
}

export function toggle(ds: Draft[], i: number): Draft[] {
  return ds.map((d) => (d.i === i ? { ...d, pick: !d.pick } : d));
}

export function update(ds: Draft[], i: number, patch: Partial<Pick<Draft, 'date' | 'direction' | 'amount' | 'memo' | 'categoryId' | 'categoryName' | 'eventId' | 'eventName'>>): Draft[] {
  return ds.map((d) => (d.i === i ? { ...d, ...patch } : d));
}

/** 탭(원본 시트)별 줄 수 — 나온 차례대로. 탭 이름이 없는 줄(CSV·PDF)은 세지 않는다 */
export function sheetsOf(ds: Draft[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of ds) if (d.source.sheet) map.set(d.source.sheet, (map.get(d.source.sheet) ?? 0) + 1);

  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

/** 탭 하나를 통째로 — 끄면 모두 뺀다, 켜면 서버 기본 선택으로(겹침 · 이미 있음 · 날짜 없음은 꺼 둔 채) */
export function pickSheet(ds: Draft[], base: ImportRow[], sheet: string, on: boolean): Draft[] {
  const first = new Map(base.map((r) => [r.i, r.pick]));

  return ds.map((d) => (d.source.sheet === sheet ? { ...d, pick: on ? first.get(d.i) === true : false } : d));
}

/** 고른 줄의 수·합. `noDate` 는 골랐지만 날짜가 없어 넣지 못하는 줄 */
export function summary(ds: Draft[]): { count: number; in: number; out: number; noDate: number } {
  const s = { count: 0, in: 0, out: 0, noDate: 0 };
  for (const d of ds) {
    if (!d.pick) continue;
    if (d.date === null) { s.noDate++; continue; }
    s.count++;
    s[d.direction] += d.amount;
  }

  return s;
}

/** 넣으면 새로 생기는 항목 · 행사(고른 줄 기준) */
export function created(ds: Draft[]): { categories: string[]; events: string[] } {
  const cats = new Set<string>();
  const events = new Set<string>();
  for (const d of ds) {
    if (!d.pick || d.date === null) continue;
    if (d.categoryId === null && d.categoryName) cats.add(d.categoryName);
    if (d.eventId === null && d.eventName) events.add(d.eventName);
  }

  return { categories: [...cats], events: [...events] };
}

/** 서버에 보낼 줄 — 고르고 날짜가 있는 것만. 빈 칸은 보내지 않는다 */
export function toCommit(ds: Draft[]): CommitRow[] {
  return ds.filter((d) => d.pick && d.date !== null).map((d) => {
    const row: CommitRow = { date: d.date as string, direction: d.direction, amount: d.amount };
    if (d.categoryId !== null) row.categoryId = d.categoryId;
    else if (d.categoryName) row.categoryName = d.categoryName;
    if (d.eventId !== null) row.eventId = d.eventId;
    else if (d.eventName) row.eventName = d.eventName;
    if (d.memo) row.memo = d.memo;
    if (d.merchant) row.merchant = d.merchant;

    return row;
  });
}

/** 달별로 묶는다 — 달 안에서는 날짜순, 날짜 없는 줄은 맨 끝(key '') */
export function byMonth(ds: Draft[]): { key: string; rows: Draft[] }[] {
  const map = new Map<string, Draft[]>();
  for (const d of [...ds].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.i - b.i)) {
    const key = d.date ? d.date.slice(0, 7) : '';
    map.set(key, [...(map.get(key) ?? []), d]);
  }

  return [...map.entries()].map(([key, rows]) => ({ key, rows }));
}

/* ── 묶기(대표님 9/26 「아웃팅 치킨, 아웃팅 피자는 아웃팅 안에 세부로」 「여름 수련회 주제로 한번에 싹 묶여야」) ── */

/** 달 · 기간 이름 — 「9월」「2026.03」「3월 회비」「2026년」「1분기」 */
const PERIOD = /(^|\D)(0?[1-9]|1[0-2])\s*월|^\s*\d{2,4}\s*[.\-/년]\s*\d{1,2}|^[\d\s.\-/년월]+$|분기|반기/;
/** 표 이름 — 행사가 아닌 탭(「요약」「합계」「Sheet1」…) */
const TABLE = /요약|합계|결산|전체|목록|^(sheet|시트)\s*\d*$/i;

/** 탭 이름이 행사(주제)인가 — 달 · 기간 · 표 이름이 아니면 행사 */
export function isTopicSheet(name: string): boolean {
  const n = name.trim();

  return n !== '' && !PERIOD.test(n) && !TABLE.test(n);
}

/** 「아웃팅 치킨」 → 앞말 · 뒷말. 앞말이 달 이름 · 숫자뿐이면 나누지 않는다 */
function splitCat(c: string | null): { head: string; tail: string } | null {
  const m = c ? /^(\S+)\s+(.+)$/.exec(c.trim()) : null;

  return m && !/^[\d.\-/]+$/.test(m[1]) && !PERIOD.test(m[1]) ? { head: m[1], tail: m[2] } : null;
}

/**
 * 가져온 줄을 묶는다(처음 한 번).
 * ① 행사 탭이면 그 탭 줄은 모두 그 행사로 — 원본에 행사가 적힌 줄은 그것 그대로
 * ② 앞말이 같고 뒷말이 다른 항목이 둘 이상이면 항목은 앞말 하나로, 뒷말은 메모 맨 앞에
 */
export function bundle(ds: Draft[]): Draft[] {
  const names = new Map<string, Set<string>>();
  for (const d of ds) {
    const x = splitCat(d.source.category);
    if (x) names.set(d.direction + '|' + x.head, (names.get(d.direction + '|' + x.head) ?? new Set<string>()).add(x.tail));
  }

  return ds.map((d) => {
    let r = d;
    const sheet = d.source.sheet?.trim();
    if (sheet && isTopicSheet(sheet) && d.eventId === null && !d.eventName && !d.source.event) r = { ...r, eventName: sheet };
    const x = splitCat(d.source.category);
    if (x && (names.get(d.direction + '|' + x.head)?.size ?? 0) >= 2) {
      r = { ...r, cat: x.head, detail: x.tail, categoryId: null, categoryName: x.head, memo: r.memo ? `${x.tail} · ${r.memo}` : x.tail };
    }

    return r;
  });
}

/** 이 모임에 같은 이름 행사가 있으면 그 id 로 */
export function linkEvents(ds: Draft[], events: { id: number; name: string }[]): Draft[] {
  const ids = new Map(events.map((e) => [e.name.trim(), e.id]));

  return ds.map((d) => {
    const id = d.eventId === null && d.eventName ? ids.get(d.eventName.trim()) : undefined;

    return id !== undefined ? { ...d, eventId: id, eventName: null } : d;
  });
}

/** 항목 맞추기 목록 — 서버 목록을 묶인 이름으로 합친다 */
export function catsOf(cs: ImportPreview['categories'], ds: Draft[]): ImportPreview['categories'] {
  const to = new Map(ds.map((d) => [d.direction + '|' + d.source.category, d.cat]));
  const map = new Map<string, ImportPreview['categories'][number]>();
  for (const c of cs) {
    const name = to.get(c.direction + '|' + c.name) ?? c.name;
    const x = map.get(c.direction + '|' + name);
    map.set(c.direction + '|' + name, x
      ? { ...x, count: x.count + c.count, sum: x.sum + c.sum, categoryId: null }
      : { ...c, name, categoryId: name === c.name ? c.categoryId : null });
  }

  return [...map.values()];
}

export type Bundle = { key: string; label: string; direction: Direction; rows: Draft[] };

/** 확인 표 묶음 — 「행사 › 항목 › 세부 · 세부」, 나온 차례대로. 묶음 안은 날짜순(날짜 없는 줄은 끝) */
export function bundlesOf(ds: Draft[], eventName: (id: number) => string | null = () => null): Bundle[] {
  const map = new Map<string, { event: string | null; cat: string | null; direction: Direction; details: string[]; rows: Draft[] }>();
  for (const d of ds) {
    const event = d.eventId !== null ? eventName(d.eventId) ?? '행사' : d.eventName;
    const key = `${d.eventId ?? ''}|${d.eventName ?? ''}|${d.direction}|${d.cat ?? ''}`;
    const b = map.get(key) ?? { event, cat: d.cat, direction: d.direction, details: [], rows: [] };
    if (d.detail && !b.details.includes(d.detail)) b.details.push(d.detail);
    b.rows.push(d);
    map.set(key, b);
  }

  return [...map.entries()].map(([key, b]) => ({
    key, direction: b.direction,
    label: [b.event, b.cat ?? '항목 없음', b.details.join(' · ') || null].filter(Boolean).join(' › '),
    rows: byMonth(b.rows).flatMap((m) => m.rows),
  }));
}
