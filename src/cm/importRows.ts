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
  /** 원본에 적혀 있던 것 — 고쳐도 남겨 둔다(원본과 대조, 이름 단위로 맞추기) */
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
    memo: r.memo, merchant: r.merchant,
    source: { category: r.category, event: r.event, sheet: r.sheet, ref: r.ref },
    dup: r.dup,
  }));
}

export type CategoryTarget = { id: number } | { name: string } | null;

/** 원본 항목 이름 하나를 통째로 — 이 모임 항목(`{id}`), 새로 만들기(`{name}`), 미분류(null) */
export function mapCategory(ds: Draft[], direction: Direction, sourceName: string, to: CategoryTarget): Draft[] {
  return ds.map((d) => (d.direction === direction && d.source.category === sourceName
    ? { ...d, categoryId: to && 'id' in to ? to.id : null, categoryName: to && 'name' in to ? to.name : null }
    : d));
}

/** 원본 항목 이름이 지금 어디로 가는가 — 첫 줄을 본다(이름 단위로 맞추므로 같다) */
export function targetOf(ds: Draft[], direction: Direction, sourceName: string): CategoryTarget {
  const d = ds.find((x) => x.direction === direction && x.source.category === sourceName);
  if (!d) return null;

  return d.categoryId !== null ? { id: d.categoryId } : d.categoryName ? { name: d.categoryName } : null;
}

export function toggle(ds: Draft[], i: number): Draft[] {
  return ds.map((d) => (d.i === i ? { ...d, pick: !d.pick } : d));
}

export function update(ds: Draft[], i: number, patch: Partial<Pick<Draft, 'date' | 'direction' | 'amount' | 'memo' | 'categoryId' | 'categoryName' | 'eventId' | 'eventName'>>): Draft[] {
  return ds.map((d) => (d.i === i ? { ...d, ...patch } : d));
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
