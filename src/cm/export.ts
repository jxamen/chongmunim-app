/**
 * 내보내기 — 엑셀(CSV) · 결산서(PDF 로 찍을 HTML) · 행사 정산서(카톡에 붙일 글).
 *
 * 서버는 그해 줄 전부와 이름표만 준다(`ledger/export`). 모양은 기기에서 만든다 — 결산서 서식을 고치려고
 * 서버를 배포할 일이 없게. RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`export.test.ts`).
 */
import type { EventDetail, ExportData, Names } from './model';
import { dayShort, parts, signed, won } from './format';

/** 엑셀에서 열었을 때 한글이 깨지지 않게 — UTF-8 BOM */
const BOM = '﻿';

function cell(v: string | number | null | undefined): string {
  // 금액은 숫자 그대로 — 엑셀이 더할 수 있어야 한다
  if (typeof v === 'number') return String(v);
  const s = v === null || v === undefined ? '' : v;
  // 글자 칸이 수식으로 읽히는 첫 글자(=+-@)로 시작하면 막는다 — 엑셀이 계산식으로 실행하지 않게
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;

  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

export function toCsv(d: ExportData): string {
  const rows: (string | number | null)[][] = [['날짜', '구분', '금액', '상호·내용', '항목', '행사', '메모', '기록', '영수증']];
  rows.push([`${d.year}-01-01`, '이월', d.carryIn, '전년도에서 넘어온 돈', '', '', '', '', '']);
  let bal = d.carryIn;
  for (const e of d.entries) {
    bal += e.direction === 'in' ? e.amount : -e.amount;
    rows.push([
      e.occurredAt.slice(0, 16), e.direction === 'in' ? '수입' : '지출', e.direction === 'in' ? e.amount : -e.amount,
      e.merchant ?? '', e.categoryId ? d.categories[e.categoryId] ?? '' : '', e.eventId ? d.events[e.eventId] ?? '' : '',
      e.memo ?? '', e.by ?? '', e.receiptId ? '있음' : '',
    ]);
  }
  rows.push(['', '잔액', bal, '', '', '', '', '', '']);

  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

type Line = { name: string; sum: number; children: { name: string; sum: number }[] };

/**
 * 결산 숫자 — 결산서와 화면이 같은 셈을 쓴다. 항목은 **대분류로 묶고 소분류는 그 아래**(기획 「항목은 두 단계다」).
 */
export function settle(d: ExportData): {
  inTotal: number; outTotal: number; carryOut: number;
  ins: Line[]; outs: Line[]; months: { in: number; out: number }[];
} {
  const by = (dir: 'in' | 'out'): Line[] => {
    const tops = new Map<string, Line>();
    for (const e of d.entries) if (e.direction === dir) {
      const leaf = e.categoryId ?? null;
      const top = leaf !== null ? d.parents[leaf] ?? leaf : null;
      const topName = top !== null ? d.categories[top] ?? '기타' : '미분류';
      const line = tops.get(topName) ?? { name: topName, sum: 0, children: [] };
      line.sum += e.amount;
      if (leaf !== null && top !== leaf) {
        const childName = d.categories[leaf] ?? '기타';
        const child = line.children.find((c) => c.name === childName);
        if (child) child.sum += e.amount; else line.children.push({ name: childName, sum: e.amount });
      }
      tops.set(topName, line);
    }
    for (const l of tops.values()) l.children.sort((a, b) => b.sum - a.sum);

    return [...tops.values()].sort((a, b) => b.sum - a.sum);
  };
  const months = Array.from({ length: 12 }, () => ({ in: 0, out: 0 }));
  for (const e of d.entries) {
    const p = parts(e.occurredAt);
    if (p && p.m >= 1 && p.m <= 12) months[p.m - 1][e.direction] += e.amount;
  }
  const ins = by('in');
  const outs = by('out');
  const inTotal = ins.reduce((s, x) => s + x.sum, 0);
  const outTotal = outs.reduce((s, x) => s + x.sum, 0);

  return { inTotal, outTotal, carryOut: d.carryIn + inTotal - outTotal, ins, outs, months };
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Pretendard 웹 배포본(앱 `assets/fonts` 와 같은 v1.3.9) — 글자 조각(subset)마다 나눠 쓰는 것만 받는다 */
export const PRETENDARD_CSS = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/pretendard-dynamic-subset.min.css';

/** 결산서 — A4 한 장에 들어가게. 총무·감사 서명 칸을 둔다 */
export function reportHtml(d: ExportData, madeOn: string): string {
  const s = settle(d);
  const rows = (list: Line[]) =>
    list.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="n"><b>${won(x.sum)}</b></td></tr>`
      + x.children.map((c) => `<tr><td class="sm">　${esc(c.name)}</td><td class="n sm">${won(c.sum)}</td></tr>`).join('')).join('')
      || '<tr><td colspan="2" class="dim">없음</td></tr>';
  const budgetRows = d.budgetLines.map((b) => `<tr><td>${esc(d.categories[b.categoryId] ?? '기타')}</td><td class="n">${won(b.amount)}</td>`
    + `<td class="n">${won(b.spent)}</td><td class="n">${won(b.amount - b.spent)}</td><td class="n">${b.amount > 0 ? Math.floor((b.spent * 100) / b.amount) : 0}%</td></tr>`
    + (b.basis ? `<tr><td colspan="5" class="sm dim">　근거 · ${esc(b.basis)}</td></tr>` : '')).join('');
  const eventRows = d.eventRows.map((e) => `<tr><td>${esc(e.name ?? '행사')}</td><td class="n">${e.budget ? won(e.budget) : '—'}</td>`
    + `<td class="n">${won(e.in)}</td><td class="n">${won(e.out)}</td><td class="n">${e.in - e.out >= 0 ? '+' : ''}${won(e.in - e.out)}</td></tr>`).join('');
  const monthRows = s.months.map((m, i) => `<tr><td>${i + 1}월</td><td class="n">${won(m.in)}</td><td class="n">${won(m.out)}</td></tr>`).join('');

  // 글꼴은 앱과 같은 Pretendard(웹 배포본, 쓰는 글자 조각만 받는다). 못 받으면 기기 글꼴로 인쇄된다
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(d.group)} ${d.year}년 결산서</title>
<link rel="stylesheet" href="${PRETENDARD_CSS}">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif; color: #16251F; font-size: 11.5pt; }
  h1 { font-size: 19pt; margin: 0 0 4px; } .sub { color: #5E7169; margin: 0 0 16px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; } td, th { border-bottom: 1px solid #DFEDE8; padding: 5px 4px; text-align: left; }
  th { color: #5E7169; font-weight: 600; font-size: 10pt; } .n { text-align: right; font-variant-numeric: tabular-nums; }
  .sum td { font-weight: 800; border-bottom: 2px solid #148066; } .dim { color: #9AA8A2; }
  .two { display: flex; gap: 18px; } .two > div { flex: 1; } h2 { font-size: 12.5pt; margin: 10px 0 2px; color: #148066; }
  .sign { margin-top: 26px; display: flex; justify-content: flex-end; gap: 36px; font-size: 11pt; }
  .sm { font-size: 10pt; color: #5E7169; }
</style></head><body>
<h1>${esc(d.group)} ${d.year}년 결산서</h1>
<p class="sub">${esc(madeOn)} 작성${d.owner ? ` · 총무 ${esc(d.owner)}` : ''}</p>
<table>
  <tr><th>전년도 이월</th><td class="n">${won(d.carryIn)}</td></tr>
  <tr><th>수입 합계</th><td class="n">${won(s.inTotal)}</td></tr>
  <tr><th>지출 합계</th><td class="n">${won(s.outTotal)}</td></tr>
  <tr class="sum"><td>다음 해 이월(잔액)</td><td class="n">${won(s.carryOut)}</td></tr>
  ${d.budget.total > 0 ? `<tr><th>예산 대비 집행</th><td class="n">${won(d.budget.spent)} / ${won(d.budget.total)} (${d.budget.percent}%)</td></tr>` : ''}
</table>
<div class="two">
  <div><h2>수입</h2><table>${rows(s.ins)}</table></div>
  <div><h2>지출</h2><table>${rows(s.outs)}</table></div>
</div>
${budgetRows ? `<h2>예산 대비 집행</h2>
<table><tr><th>항목</th><th class="n">예산</th><th class="n">집행</th><th class="n">잔여</th><th class="n">집행률</th></tr>${budgetRows}</table>` : ''}
${eventRows ? `<h2>행사별 정산</h2>
<table><tr><th>행사</th><th class="n">예산</th><th class="n">수입</th><th class="n">지출</th><th class="n">수지</th></tr>${eventRows}</table>` : ''}
<h2>월별</h2>
<table><tr><th>달</th><th class="n">수입</th><th class="n">지출</th></tr>${monthRows}</table>
<div class="sign"><span>총무 ${d.owner ? esc(d.owner) : '　　　'} (인)</span><span>감사 　　　　 (인)</span></div>
</body></html>`;
}

/** 행사 정산서 — 카톡 단체방에 그대로 붙인다 */
export function eventShareText(detail: EventDetail, categories: Names, groupName: string): string {
  const ev = detail.event;
  const lines = [`[${groupName}] ${ev.name} 정산`, ''];
  lines.push(`수입 ${won(ev.in)}원`);
  for (const i of detail.incomes) lines.push(`  · ${i.name ?? '기타'} ${i.count}건 ${won(i.sum)}`);
  lines.push(`지출 ${won(ev.out)}원`);
  for (const e of detail.entries.filter((x) => x.direction === 'out').slice(0, 15)) {
    const what = e.merchant || e.memo || (e.categoryId ? categories[e.categoryId] : '') || '지출';
    lines.push(`  · ${dayShort(e.occurredAt)} ${what} ${won(e.amount)}`);
  }
  lines.push('', `수지 ${signed(Math.abs(ev.balance), ev.balance >= 0 ? 'in' : 'out')}원`);
  if (ev.budget > 0) lines.push(`예산 ${won(ev.budget)}원 중 ${ev.budgetPercent}% 사용`);

  return lines.join('\n');
}
