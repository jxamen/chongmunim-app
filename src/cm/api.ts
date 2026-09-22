/**
 * 총무님 경로 — jcurve-api `routes/chongmunim.php` 와 한 줄씩 맞는다. 받은 것은 곧바로 `model.ts` 로 거른다.
 *
 * 금액·잔액을 앱이 계산해 올리지 않는다. 장부 줄을 만들 때 금액·날짜를 비우면 **서버가 영수증 원본 값**을 쓰고,
 * 사람이 고친 값을 보내면 그 값을 쓴다(영수증 원본은 서버에 그대로 남는다).
 */
import { api } from '../api';
import {
  toBudget, toCategories, toDues, toEntry, toEventDetail, toEvents, toExport, toGroup, toGroups, toHome, toMonth, toNotice, toNotices,
  toImport, toReceipt, toRequests, toRoster, toTidy, toYear, type Audience, type Direction, type NotifyPrefs, type RequestStatus,
 toRecipients, toClosing, toClosings } from './model';
import type { CommitRow } from './importRows';
import { toPush } from './pushText';

const g = (gid: number, path = ''): string => `cm/g/${gid}${path ? '/' + path : ''}`;
const q = (params: Record<string, string | number | undefined>): string => {
  const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');

  return s ? '?' + s : '';
};

/* ── 모임 ── */
export const myGroups = async () => toGroups(await api.get('cm/groups'));
export const createGroup = async (b: { name: string; myName?: string; duesAmount?: number }) => toGroup(await api.post('cm/groups', b));
export const joinGroup = async (code: string, name?: string) => toGroup(await api.post('cm/groups/join', { code, name }));
export const getGroup = async (gid: number) => toGroup(await api.get(g(gid)));
export const updateGroup = async (gid: number, b: { name?: string; duesAmount?: number; openingBalance?: number; openingDate?: string | null }) =>
  toGroup(await api.put(g(gid), b));
export const roster = async (gid: number) => toRoster(await api.get(g(gid, 'members')));
export const addMember = async (gid: number, name: string) => toRoster(await api.post(g(gid, 'members'), { name }));
export const updateMember = async (gid: number, id: number, b: { name?: string; duesExempt?: boolean; role?: 'admin' | 'member'; remove?: boolean; birthday?: string | null }) =>
  toRoster(await api.put(g(gid, `members/${id}`), b));
export const transferOwner = async (gid: number, memberId: number) => toGroup(await api.post(g(gid, 'owner'), { memberId }));
export const acceptOwner = async (gid: number) => toGroup(await api.post(g(gid, 'owner/accept')));
export const cancelOwner = async (gid: number) => toGroup(await api.post(g(gid, 'owner/cancel')));
/** 구매 · 복원 뒤 이 모임에 내 구독을 쓴다 — 서버가 RevenueCat 에 직접 확인한다. move: 다른 모임에서 옮겨 오기 */
export const claimPlan = async (gid: number, move = false) => toGroup(await api.post(g(gid, 'plan/claim'), { move }));
export const updateMe = async (gid: number, b: { name?: string; bankName?: string | null; bankAccount?: string | null; bankHolder?: string | null; notify?: Partial<NotifyPrefs>; birthday?: string | null }) =>
  toGroup(await api.put(g(gid, 'me'), b));
export const setPublicLink = async (gid: number, on: boolean) =>
  String((await api.post<{ publicToken?: string | null }>(g(gid, 'public-link'), { on })).publicToken ?? '');
export const leaveGroup = (gid: number) => api.post(g(gid, 'leave'));

/* ── 장부 ── */
export const home = async (gid: number) => toHome(await api.get(g(gid, 'home')));
export const month = async (gid: number, ym: string) => toMonth(await api.get(g(gid, 'ledger/month') + q({ month: ym })));
export const year = async (gid: number, y: number) => toYear(await api.get(g(gid, 'ledger/year') + q({ year: y })));
export const exportYear = async (gid: number, y: number) => toExport(await api.get(g(gid, 'ledger/export') + q({ year: y })));

export type EntryInput = {
  direction: Direction; amount?: number; occurredAt?: string; merchant?: string | null;
  categoryId?: number | null; eventId?: number | null; memo?: string | null; receiptId?: string;
};
export const addEntry = async (gid: number, b: EntryInput) => toEntry((await api.post<{ entry: unknown }>(g(gid, 'entries'), b)).entry);
export const editEntry = async (gid: number, id: number, b: Partial<Omit<EntryInput, 'direction' | 'receiptId'>> & { eventChecked?: boolean }) =>
  toEntry((await api.put<{ entry: unknown }>(g(gid, `entries/${id}`), b)).entry);
export const voidEntry = (gid: number, id: number, reason?: string) => api.post(g(gid, `entries/${id}/void`), { reason });
export const bulkEntries = (gid: number, ids: number[], set: { categoryId?: number | null; eventId?: number | null; eventChecked?: boolean }) =>
  api.post<{ changed: number }>(g(gid, 'entries/bulk'), { ids, ...set });
export const tidy = async (gid: number, ym: string) => toTidy(await api.get(g(gid, 'tidy') + q({ month: ym })));
export const reconcile = (gid: number, bankBalance: number, ym: string) =>
  api.post<{ bank: number; book: number; diff: number }>(g(gid, 'reconcile'), { bankBalance, month: ym });

/* ── 영수증 ── */
export const attachReceipt = async (gid: number, ocrJobId: string) => toReceipt(await api.post(g(gid, 'receipts'), { ocrJobId }));
export const getReceipt = async (gid: number, id: string) => toReceipt(await api.get(g(gid, `receipts/${id}`)));

/* ── 지급 요청 ── */
export const requests = async (gid: number, status: RequestStatus) => toRequests(await api.get(g(gid, 'requests') + q({ status })));
/** `bank` — 등록 안 한 계좌를 이번 요청에만 싣는다(없으면 내 정보에 등록한 계좌) */
export const addRequest = (gid: number, b: Omit<EntryInput, 'direction'> & { bank?: { name: string | null; account: string | null; holder: string | null } }) =>
  api.post(g(gid, 'requests'), b);
export const updateRequest = (gid: number, id: number, b: { categoryId?: number | null; eventId?: number | null; memo?: string | null; merchant?: string | null }) =>
  api.put(g(gid, `requests/${id}`), b);
export const payRequest = (gid: number, id: number) => api.post(g(gid, `requests/${id}/pay`));
export const rejectRequest = (gid: number, id: number, reason?: string) => api.post(g(gid, `requests/${id}/reject`), { reason });
export const cancelRequest = (gid: number, id: number) => api.post(g(gid, `requests/${id}/cancel`));

/* ── 행사 ── */
export const events = async (gid: number) => toEvents(await api.get(g(gid, 'events')));
/** 만든 행사 + 알렸으면 보낸 결과(push) */
export const addEvent = async (gid: number, b: { name: string; startsOn?: string; endsOn?: string; budget?: number; notify?: boolean }) => {
  const j = await api.post(g(gid, 'events'), b);

  return { ...toEventDetail(j), push: toPush((j as { push?: unknown }).push) };
};
export const event = async (gid: number, id: number) => toEventDetail(await api.get(g(gid, `events/${id}`)));
export const updateEvent = async (gid: number, id: number, b: { name?: string; budget?: number; status?: 'open' | 'closed' }) =>
  toEventDetail(await api.put(g(gid, `events/${id}`), b));

/* ── 예산 · 항목 ── */
export const budget = async (gid: number, y: number) => toBudget(await api.get(g(gid, 'budget') + q({ year: y })));
export const saveBudget = async (gid: number, y: number, lines: { categoryId: number; amount: number; basis?: string | null }[]) =>
  toBudget(await api.put(g(gid, 'budget'), { year: y, lines }));
export const rollover = (gid: number, from: number) => api.post<{ year: number; copied: number }>(g(gid, 'budget/rollover'), { from });
export const categories = async (gid: number) => toCategories(await api.get(g(gid, 'categories')));
export const addCategory = async (gid: number, name: string, kind: Direction, parentId?: number | null) =>
  toCategories(await api.post(g(gid, 'categories'), { name, kind, parentId: parentId ?? undefined }));
export const updateCategory = async (gid: number, id: number, b: { name?: string; hidden?: boolean; parentId?: number | null }) =>
  toCategories(await api.put(g(gid, `categories/${id}`), b));
/** 비슷한 항목 합치기 — 이 항목의 기록·예산을 `into` 로 옮기고 숨긴다 */
export const mergeCategory = async (gid: number, id: number, into: number) => toCategories(await api.post(g(gid, `categories/${id}/merge`), { into }));
/** 작년 항목별 집행 가져오기(붙여넣기) */
export const importPrior = (gid: number, y: number, lines: { name: string; amount: number }[]) =>
  api.post<{ year: number; lines: number; newCategories: number }>(g(gid, 'prior'), { year: y, lines });

/* ── 쓰던 장부 파일 가져오기 — 서버 `ChongmunimImportController` ── */
/** 파일(폼의 `file`)을 맡긴다 — 워커가 몇 분 걸려 푼다. 같은 파일을 다시 올리면 앞선 건 */
export const uploadLedger = async (gid: number, form: FormData) => toImport(await api.upload(g(gid, 'imports'), form));
/**
 * 구글 시트 링크 — 서버가 xlsx 로 받아 둔다(공유가 「링크가 있는 모든 사용자」여야 한다). 서버가 구글에서 받아 오느라
 * 오래 걸릴 수 있어 느린 요청(40초)으로 보낸다
 */
/** 구글 드라이브에서 고르기 — 15분짜리 표. 앱은 폰 브라우저로 `{API}/cm/picker?t=표` 를 연다(ChongmunimPickerController) */
export const googlePickerTicket = async (gid: number) => String((await api.post<{ ticket: string }>(g(gid, 'imports/google'))).ticket ?? '');
export const importSheet = async (gid: number, sheetUrl: string) => {
  const form = new FormData();
  form.append('sheetUrl', sheetUrl);

  return toImport(await api.upload(g(gid, 'imports'), form));
};
export const ledgerImport = async (gid: number, id: string) => toImport(await api.get(g(gid, `imports/${id}`)));
export const commitImport = (gid: number, id: string, rows: CommitRow[], opening: { amount: number; date: string | null } | null) =>
  api.post<{ committed: number; newCategories: number; newEvents: number }>(g(gid, `imports/${id}/commit`), opening ? { rows, opening } : { rows });
export const undoImport = (gid: number, id: string) => api.post<{ voided: number }>(g(gid, `imports/${id}/undo`));
export const cancelImport = (gid: number, id: string) => api.post(g(gid, `imports/${id}/cancel`));

/* ── 회비 ── */
export const dues = async (gid: number, period?: string) => toDues(await api.get(g(gid, 'dues') + q({ period })));
export const payDues = async (gid: number, memberId: number, period: string) => toDues(await api.post(g(gid, 'dues'), { memberId, period }));
export const cancelDues = async (gid: number, id: number) => toDues(await api.post(g(gid, `dues/${id}/cancel`)));
export const remindDues = (gid: number, period: string) =>
  api.post<{ targets: number; accepted: number; noApp: number; noToken: number; muted: number }>(g(gid, 'dues/remind'), { period });

/* ── 공지 ── */
export const notices = async (gid: number) => toNotices(await api.get(g(gid, 'notices')));
export const audienceCount = (gid: number, audience: Audience, period?: string) =>
  api.get<{ count: number; withApp: number }>(g(gid, 'notices/audience') + q({ audience, period }));
export type NoticeInput = { title: string; body: string; audience: Audience; period?: string; push: boolean; draft?: boolean };
/** 쓴 공지 + 보냈으면 결과(push — 임시저장이면 null) */
export const addNotice = async (gid: number, b: NoticeInput) => {
  const j = await api.post(g(gid, 'notices'), b);

  return { notice: toNotice(j), push: toPush((j as { push?: unknown }).push) };
};
export const saveNotice = async (gid: number, id: number, b: NoticeInput) => {
  const j = await api.put(g(gid, `notices/${id}`), b);

  return { notice: toNotice(j), push: toPush((j as { push?: unknown }).push) };
};
export const notice = async (gid: number, id: number) => toNotice(await api.get(g(gid, `notices/${id}`)));
/** 받는 사람 — 이름 · 알림 결과 · 읽은 시각(총무·관리자) */
export const noticeRecipients = async (gid: number, id: number) => toRecipients(await api.get(g(gid, `notices/${id}/recipients`)));

/* ── 마감 ── */
/** 지금 잠긴 것들(풀지 않은 마감) */
export const closings = async (gid: number) => toClosings(await api.get(g(gid, 'closings')));
/** 마감하고 알리기 — 결산을 굳히고 공지+푸시(notify 끄면 잠그기만) */
export const closeNow = async (gid: number, b: { kind: 'month' | 'year' | 'event'; ref: string; notify?: boolean }) => {
  const j = await api.post(g(gid, 'closings'), b);

  return { closing: toClosing(j), push: toPush((j as { push?: unknown }).push) };
};
export const closing = async (gid: number, id: number) => toClosing(await api.get(g(gid, `closings/${id}`)));
export const reopenClosing = (gid: number, id: number) => api.post(g(gid, `closings/${id}/reopen`));
