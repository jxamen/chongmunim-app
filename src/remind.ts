/**
 * 재방문 로컬 알림 — **기기가 때 되면 스스로 띄운다**(`@jcurve/notify` createNotify, API 문서 §0-B-4-C · 당근캐시 `localNotify.ts` 와 같은 모양).
 *
 * 총무님은 리워드 앱이 아니라 「양분이 찼어요」 같은 게임 알림이 없다. 대신 **총무가 실제로 앞에 앉는 때**를 짚는다
 * (기획 「지금 총무가 겪는 일」 · 「이 화면이 월말과 연말에 총무가 실제로 앞에 앉는 자리다」):
 *
 *   tidy.month    월말 정리      말일 20:00 — 이번 달 항목 없는 기록이 있거나 통장 잔고를 아직 안 맞췄을 때
 *   dues.check    회비 확인      이번 달 미납이 있으면 5일 · 20일 19:00, 아니면 다음 달 5일 19:00 — 월 회비를 정한 모임(회비 안내 스위치를 따른다)
 *   request.wait  지급 요청      다음 날 10:00 — 처리 안 한 요청이 남은 채로 나갔을 때(지급 요청 스위치를 따른다)
 *   event.settle  행사 정산      행사 끝난 다음 날 19:00 — 진행 중 행사의 끝나는 날이 정해져 있을 때
 *   year.settle   연말 결산      12월 28일 19:00 — 11월부터 건다
 *   idle          오랜만에       마지막으로 연 뒤 7일째 19:30(회원은 14일)
 *
 * 앞의 다섯은 총무·관리자만. **서버 푸시와 겹치지 않게** — 서버는 공지를 쓸 때 · 요청이 올라올 때 · 미납 안내를 보낼 때
 * 그 자리에서 보낸다. 로컬은 서버가 모르는 **나중**만 맡는다(요청을 받고도 처리 안 한 채 나간 다음 날처럼).
 *
 * **잠금 화면에 금액·이름을 싣지 않는다** — 건수와 행사 이름만. 뒤로 가는 순간엔 네트워크를 기다릴 수 없어, 필요한 사실은
 * 홈을 열 때 받아 둔 것(`home.remind`)을 쓴다. 이 파일은 순수 모듈이다(시험에서 바로 부른다).
 */
import type { NotifyConfig } from '@jcurve/notify';

/** 앱이 시각을 건네는 키 — **어드민 「앱 알림」에 항목을 넣을 때 이 키와 같아야 한다**(다르면 오류 없이 안 뜬다) */
export const KEYS = {
  tidyMonth: 'tidy.month',
  duesCheck: 'dues.check',
  requestWait: 'request.wait',
  eventSettle: 'event.settle',
  yearSettle: 'year.settle',
  idle: 'idle',
} as const;

/** 어드민에 항목이 없을 때 쓰는 기본값 — 채널은 서버 푸시와 같은 `chongmunim`(app.json defaultChannel) */
export const DEFAULT_CONFIG: NotifyConfig = {
  quiet: { from: 21, to: 8, at: '09:00' },
  channel: { id: 'chongmunim', name: '총무님 알림', vibrate: true },
  items: [
    { key: KEYS.tidyMonth, label: '월말 정리', title: '이번 달 장부를 정리할 때예요', body: '항목 없는 기록을 묶고 통장 잔고와 맞춰 두면 연말이 편해요' },
    // 인원수는 싣지 않는다 — 다음 달 5일 알림은 그달 미납을 미리 알 수 없다
    { key: KEYS.duesCheck, label: '회비 확인', title: '이번 달 회비를 확인해 주세요', body: '납부 표시하고, 아직인 분께는 한 번에 안내를 보낼 수 있어요' },
    { key: KEYS.requestWait, label: '지급 요청', title: '지급 요청이 기다려요', body: '{pending}건을 처리하면 장부에 바로 적혀요' },
    { key: KEYS.eventSettle, label: '행사 정산', title: '「{event}」 정산할 때예요', body: '행사 수입·지출을 정리해 단톡방에 공유해요' },
    { key: KEYS.yearSettle, label: '연말 결산', title: '올해 결산서를 만들 때예요', body: '연간 장부에서 결산서 PDF 를 한 번에 받아요' },
    { key: KEYS.idle, label: '오랜만에', title: '모임 장부, 한 번 볼까요?', body: '{idleBody}' },
  ],
};

/** 어드민에 항목이 하나라도 있으면 어드민, 아니면 기본값 — 서버는 비었을 때 빈 배열을 준다(당근캐시 2026-09-22 함정) */
export function pickConfig(fromServer: unknown): NotifyConfig {
  const c = fromServer as NotifyConfig | null;

  return c && !Array.isArray(c) && Array.isArray(c.items) && c.items.length > 0 ? c : DEFAULT_CONFIG;
}

/** 홈을 열 때 받아 둔 것 — 서버 `home.remind`(총무·관리자만) + 대기 중인 지급 요청 수 */
export type RemindSnapshot = {
  manager: boolean;
  pending: number;
  remind: { uncategorized: number; reconciled: boolean; duesUnpaid: number | null; events: { name: string; endsOn: string }[] } | null;
};

/** 모임 알림 스위치(서버 명단 행) + 이 폰의 「장부 챙김 알림」 */
export type RemindPrefs = { dues: boolean; request: boolean; remind: boolean };

const IDLE_DAYS = { manager: 7, member: 14 };

/** 기기 시계로 그날 hh:mm */
function at(d: Date, h: number, m = 0): number {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);

  return x.getTime();
}

function dayOf(y: number, mo: number, day: number): Date {
  return new Date(y, mo, day);
}

/**
 * 지금 상태 → 키마다 울릴 시각. 해당 없음이면 그 키를 빼고(null), 이미 지난 시각도 뺀다
 * (지난 시각으로 예약하면 그 자리에서 울린다 — 패키지도 30초 안은 거르지만 여기서 먼저 뺀다).
 */
export function remindBases(s: RemindSnapshot | null, now: number): Record<string, number | number[] | null> {
  const out: Record<string, number | number[] | null> = {};
  if (!s) return out;
  const today = new Date(now);
  const y = today.getFullYear();
  const mo = today.getMonth();
  const future = (t: number) => (t > now ? t : null);

  const idle = new Date(now);
  idle.setDate(idle.getDate() + (s.manager ? IDLE_DAYS.manager : IDLE_DAYS.member));
  out[KEYS.idle] = at(idle, 19, 30);

  if (!s.manager) return out;
  const r = s.remind;

  if (r && (r.uncategorized > 0 || !r.reconciled)) {
    out[KEYS.tidyMonth] = future(at(dayOf(y, mo + 1, 0), 20));   // 이번 달 말일
  }
  // 월 회비를 정한 모임 — 이번 달 미납이 있으면 5일·20일, 없거나 지났으면 다음 달 5일(새 달은 모두 아직이다)
  if (r && r.duesUnpaid !== null) {
    const days = r.duesUnpaid > 0 ? [at(dayOf(y, mo, 5), 19), at(dayOf(y, mo, 20), 19)] : [];
    out[KEYS.duesCheck] = [...days, at(dayOf(y, mo + 1, 5), 19)].find((t) => t > now) ?? null;
  }
  if (s.pending > 0) {
    out[KEYS.requestWait] = at(dayOf(y, mo, today.getDate() + 1), 10);
  }
  const ev = r?.events.map((e) => ({ e, t: settleAt(e.endsOn) })).filter((x) => x.t !== null && x.t > now)
    .sort((a, b) => (a.t as number) - (b.t as number))[0];
  if (ev) out[KEYS.eventSettle] = ev.t;
  if (mo >= 10) {
    out[KEYS.yearSettle] = future(at(dayOf(y, 11, 28), 19));
  }

  return out;
}

/** 행사 끝난 다음 날 19:00 */
function settleAt(endsOn: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endsOn);
  if (!m) return null;

  return at(dayOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1), 19);
}

/** 문구의 `{이름}` 자리 — 건수와 행사 이름만(금액·사람 이름은 싣지 않는다) */
export function remindVars(s: RemindSnapshot | null, now: number): Record<string, string | number> {
  const soon = s?.remind?.events.map((e) => ({ e, t: settleAt(e.endsOn) })).filter((x) => x.t !== null && x.t > now)
    .sort((a, b) => (a.t as number) - (b.t as number))[0];

  return {
    pending: s?.pending ?? 0,
    event: soon?.e.name ?? '행사',
    idleBody: s?.manager ? '찍어 둔 영수증이 있으면 지금 기록해 두세요 · 월말이 편해져요' : '공지와 내 회비 내역을 확인해 보세요',
  };
}

/** 스위치 → 패키지의 prefs(`false` 인 키만 끈 것). 회비·요청은 모임 스위치도 같이 따른다 — 껐는데 오면 스위치가 장식이 된다 */
export function remindPrefs(p: RemindPrefs): Record<string, boolean> {
  const all = p.remind;

  return {
    [KEYS.tidyMonth]: all,
    [KEYS.duesCheck]: all && p.dues,
    [KEYS.requestWait]: all && p.request,
    [KEYS.eventSettle]: all,
    [KEYS.yearSettle]: all,
    [KEYS.idle]: all,
  };
}
