/**
 * 기획서(「모임 장부 앱 기획.md」)의 규칙 중 앱이 셈하는 것 — 붙여넣기 읽기 · 대분류 합산 · 행사 제안.
 * RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`rules.test.ts`).
 */
import type { Category, ClubEvent } from './model';

/**
 * 시트에서 복사한 「항목 · 금액」 두 열을 갈라 읽는다(기획 「붙여넣기가 핵심이다」).
 *
 * 포맷이 제각각이어도 된다 — 탭·쉼표·두 칸 이상 띄어쓰기로 가르고, 금액은 줄의 **마지막 숫자 덩어리**다.
 * 「합계·소계·계·총계」 줄은 버린다(이중 계상 — 기획 「소계·합계 행을 항목으로 집어넣는 이중 계상을 반드시 걸러야 한다」).
 * 같은 항목이 여러 번 나오면 더한다. 못 읽은 줄은 `skipped` 로 돌려준다(말없이 버리지 않는다).
 */
export function parsePasted(text: string): { lines: { name: string; amount: number }[]; skipped: string[]; total: number } {
  const sums = new Map<string, number>();
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.*?)[\s,\t]+(-?[\d,]+(?:\.\d+)?)\s*원?$/.exec(line);
    if (!m) { skipped.push(line); continue; }
    const name = m[1].replace(/[\t,]+$/, '').trim().replace(/\s+/g, ' ').slice(0, 20);
    const amount = Math.round(Number(m[2].replace(/,/g, '')));
    if (!name || !Number.isFinite(amount) || amount < 0) { skipped.push(line); continue; }
    if (/^(합\s*계|소\s*계|총\s*계|계|total|sum)$/i.test(name)) continue;
    sums.set(name, (sums.get(name) ?? 0) + amount);
  }
  const lines = [...sums.entries()].map(([name, amount]) => ({ name, amount }));

  return { lines, skipped, total: lines.reduce((s, l) => s + l.amount, 0) };
}

export type RollRow = { id: number | null; name: string; sum: number; children: { id: number; name: string; sum: number }[] };

/**
 * 항목별 합계를 **대분류로 묶는다**(기획 「항목은 두 단계다」) — 소분류 합이 대분류 소계가 된다.
 * 대분류에 직접 붙은 기록은 대분류 자신의 몫으로 더한다. 항목 없는 것은 「미분류」 한 줄.
 */
export function rollup(sums: { categoryId: number | null; sum: number }[], cats: Category[]): RollRow[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const rows = new Map<number | null, RollRow>();
  for (const s of sums) {
    const c = s.categoryId ? byId.get(s.categoryId) : undefined;
    const top = c?.parentId ? byId.get(c.parentId) ?? c : c;
    const key = top?.id ?? null;
    const row = rows.get(key) ?? { id: key, name: top?.name ?? '미분류', sum: 0, children: [] };
    row.sum += s.sum;
    if (c && top && c.id !== top.id) row.children.push({ id: c.id, name: c.name, sum: s.sum });
    rows.set(key, row);
  }
  for (const r of rows.values()) r.children.sort((a, b) => b.sum - a.sum);

  return [...rows.values()].sort((a, b) => (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0) || b.sum - a.sum);
}

/**
 * 행사 칸에 먼저 찍어 둘 것(기획 「요청 폼은 네 칸이다」) — 진행 중인 행사 가운데
 * ① 기간 안에 그 날짜가 들어가는 행사, ② 없으면 진행 중인 행사가 **하나뿐**일 때 그것, ③ 그 밖에는 고르게 둔다(null).
 */
export function suggestEvent(events: ClubEvent[], ymd: string | null): number | null {
  const open = events.filter((e) => e.status === 'open');
  if (ymd) {
    const hit = open.filter((e) => e.startsOn && e.startsOn <= ymd && (e.endsOn ?? e.startsOn) >= ymd);
    if (hit.length === 1) return hit[0].id;
  }

  return open.length === 1 ? open[0].id : null;
}

/** 고를 칩 순서 — 대분류 아래 소분류가 붙어 나오게(「여름수련회」는 「교육·행사」 뒤에) */
export function chipOrder(cats: Category[]): Category[] {
  const tops = cats.filter((c) => !c.parentId);
  const out: Category[] = [];
  for (const t of tops) {
    out.push(t);
    for (const c of cats) if (c.parentId === t.id) out.push(c);
  }
  for (const c of cats) if (!out.includes(c)) out.push(c);

  return out;
}
