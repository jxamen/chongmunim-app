/**
 * 금액·날짜를 화면 말로 — 시안(`design/chongmunim-app.html`)의 표기를 그대로 따른다.
 *
 *   1,284,000 · +320,000 · −186,400(빼기는 U+2212) · 9월 21일 토 · 오후 2:14 · 9/20 · 2026.09
 *
 * 장부 일시는 서버가 **한국 시각 벽시계 문자열**(`2026-09-21 14:14:02`)로 준다 — `Date` 로 바꾸면 기기 시간대가 끼어든다.
 * 그래서 글자로만 자른다. RN 에 기대지 않는 순수 함수라 노드에서 시험한다(`format.test.ts`).
 */

export const MINUS = '−';

/** 1284000 → "1,284,000" */
export function won(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (v < 0 ? MINUS : '') + s;
}

/** 방향을 붙인 금액 — 수입 "+320,000", 지출 "−186,400" */
export const signed = (n: number, direction: 'in' | 'out'): string =>
  (Math.round(n) === 0 ? '' : direction === 'in' ? '+' : MINUS) + won(Math.abs(n));

/** 부호를 금액 그대로 — 수지·차이처럼 0 을 넘나드는 값 */
export const plusMinus = (n: number): string => (n > 0 ? '+' : '') + won(n);

type Parts = { y: number; m: number; d: number; hh: number; mm: number; hasTime: boolean };

/** `2026-09-21 14:14:02` · `2026-09-21` → 조각. 못 읽으면 null */
export function parts(s: string | null | undefined): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s ?? ''));
  if (!m) return null;
  const hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;

  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), hh, mm, hasTime: !!m[4] && !(hh === 0 && mm === 0) };
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 그날의 요일 — 달력 계산만(시간대와 무관) */
export function dow(y: number, m: number, d: number): string {
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "오후 2:14" */
export function clock(hh: number, mm: number): string {
  const ampm = hh < 12 ? '오전' : '오후';
  const h = hh % 12 === 0 ? 12 : hh % 12;

  return `${ampm} ${h}:${String(mm).padStart(2, '0')}`;
}

/** "9월 21일 토 · 오후 2:14" — 시각이 없으면(0시) 날짜까지만 */
export function whenLong(s: string | null | undefined): string {
  const p = parts(s);
  if (!p) return '';
  const day = `${p.m}월 ${p.d}일 ${dow(p.y, p.m, p.d)}`;

  return p.hasTime ? `${day} · ${clock(p.hh, p.mm)}` : day;
}

/** "9월 21일" */
export function dayLabel(s: string | null | undefined): string {
  const p = parts(s);

  return p ? `${p.m}월 ${p.d}일` : '';
}

/** "9/20" */
export function dayShort(s: string | null | undefined): string {
  const p = parts(s);

  return p ? `${p.m}/${p.d}` : '';
}

/** "2026-09" → "2026.09" */
export const monthChip = (ym: string): string => ym.replace('-', '.');

/** "2026-09" → "9월" */
export const monthWord = (ym: string): string => {
  const m = /^\d{4}-(\d{2})$/.exec(ym);

  return m ? `${Number(m[1])}월` : '';
};

/** 한 달 앞뒤 — "2026-01" 의 앞은 "2025-12" */
export function shiftMonth(ym: string, by: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const t = Number(m[1]) * 12 + (Number(m[2]) - 1) + by;

  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** 지금 한국 달 — 기기 시간대와 무관하게 */
export function kstNow(now: number = Date.now()): { ym: string; ymd: string; hm: string; year: number; hour: number } {
  const d = new Date(now + 9 * 3600_000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');

  return { ym: `${y}-${mo}`, ymd: `${y}-${mo}-${da}`, hm: `${hh}:${mi}`, year: y, hour: d.getUTCHours() };
}

/**
 * 밤인가(21~08시, 한국 시각) — 단체 알림을 밤에 보내려 하면 한 번 묻는다.
 * 공지·회비 안내는 광고가 아니라 법상 제한은 없지만, 모임 사람들 사이의 알림이라 미루는 편이 낫다(꼬꼬 2026-09-22).
 */
export const isNight = (now: number = Date.now()): boolean => {
  const h = kstNow(now).hour;

  return h >= 21 || h < 8;
};

/**
 * 사람이 친 금액 — "32,400" · "32400원" · " 3만 2천 " 은 아니다(숫자만 본다). 못 읽으면 null.
 * 0 이하는 금액이 아니다.
 */
export function readAmount(s: string): number | null {
  const digits = String(s).replace(/[^\d]/g, '');
  if (digits === '' || digits.length > 12) return null;
  const n = Number(digits);

  return n > 0 ? n : null;
}

/** 칸에 보이는 금액 — 치는 동안 쉼표를 넣는다 */
export const amountInput = (s: string): string => {
  const n = readAmount(s);

  return n === null ? '' : won(n);
};

/** 사람이 친 날짜·시각 → 서버에 보낼 `Y-m-d H:i`. 날짜가 틀리면 null */
export function readWhen(date: string, time: string): string | null {
  const d = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(date.trim());
  if (!d) return null;
  const y = Number(d[1]);
  const m = Number(d[2]);
  const day = Number(d[3]);
  const probe = new Date(Date.UTC(y, m - 1, day));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== day) return null;
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const hh = t ? Math.min(23, Number(t[1])) : 0;
  const mm = t ? Math.min(59, Number(t[2])) : 0;

  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 막대 폭(%) — 0~100 */
export const barPercent = (part: number, whole: number): number =>
  whole > 0 ? Math.max(0, Math.min(100, Math.floor((part * 100) / whole))) : 0;

/** 장부 한 줄의 제목 — 회비는 「회비 입금 · 김민수」(시안 1), 그 밖은 상호 → 내용 → 항목 */
export function entryTitle(e: { source: string; merchant: string | null; memo: string | null; categoryId: number | null; direction: 'in' | 'out' },
  cats: Record<number, string>): string {
  if (e.source === 'dues') return `회비 입금${e.merchant ? ' · ' + e.merchant : ''}`;

  return e.merchant || e.memo || (e.categoryId ? cats[e.categoryId] : '') || (e.direction === 'in' ? '수입' : '지출');
}

/** 장부 한 줄의 부제 — 「9월 20일 · 식비」 · 지급 요청이면 쓴 사람 이름도 */
export function entrySub(e: { occurredAt: string; categoryId: number | null; source: string; by: string | null },
  cats: Record<number, string>): string {
  const bits = [dayLabel(e.occurredAt)];
  if (e.categoryId && cats[e.categoryId] && e.source !== 'dues') bits.push(cats[e.categoryId]);
  if (e.source === 'request' && e.by) bits.push(e.by);

  return bits.filter(Boolean).join(' · ');
}
