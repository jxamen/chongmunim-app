/**
 * 달력 — 날짜 칸을 눌러 고르는 달력(`ui/DateField`)의 계산. 순수 함수라 시험에서 바로 부른다.
 * 날짜는 장부와 같은 「YYYY-MM-DD」 글자로 오간다(기기 시간대와 무관).
 */

export type Cell = { ymd: string; day: number; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdOf = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

/** 「2026-09-22」 → [2026, 9, 22] · 틀리면 null */
export function parseYmd(s: string | null | undefined): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));

  return probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? [y, mo, d] : null;
}

/** 한 달 칸 — 일요일부터 여섯 줄(42칸). 앞뒤 달 날짜는 inMonth=false */
export function monthGrid(y: number, m: number): Cell[] {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();   // 0 = 일요일
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - first + i));
    cells.push({ ymd: ymdOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1 });
  }

  return cells;
}

/** 달 옮기기 — [2026, 12] + 1 → [2027, 1] */
export function shiftYm(y: number, m: number, by: number): [number, number] {
  const t = y * 12 + (m - 1) + by;

  return [Math.floor(t / 12), (t % 12) + 1];
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 「2026년 9월 22일 (화)」 — thisYear 를 주면 그해는 해를 빼고 「9월 22일 (화)」(칸이 좁다) */
export function ymdLabel(s: string, thisYear?: number): string | null {
  const p = parseYmd(s);
  if (!p) return null;
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();

  return `${p[0] === thisYear ? '' : `${p[0]}년 `}${p[1]}월 ${p[2]}일 (${DOW[dow]})`;
}
