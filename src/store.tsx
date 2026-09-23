/**
 * 앱 상태 — 로그인 · 고른 모임 · 테마 · 탭 · 겹쳐 뜨는 화면(쪽) · 알림 한 줄.
 *
 * 장부는 전부 서버에 있다. 여기 두는 것은 「누구로 · 어느 모임을 · 무슨 색으로 보고 있나」와 화면 이동뿐이다.
 * 화면은 `version` 이 오르면(무언가를 바꿨다) 자기 데이터를 다시 받는다.
 *
 * 부팅(용돈캡슐 `store.tsx` 와 같은 순서): 저장된 세션 → 회원 확인(죽은 세션일 때만 로그아웃, 못 닿으면 지난번 회원으로) →
 * 모임 목록 → 마지막으로 본 모임. 모임이 없으면 「모임 만들기 / 들어가기」로.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { autoApply, onUpdateReady, startupSettled } from '@jcurve/updates';
import * as storage from './storage';
import {
  completeSignup, currentToken, fetchMe, fetchProviders, logoutServer, onSessionExpired, setGuestNow, setSession, withdrawServer,
  type AuthResult, type Member, type Session,
} from './api';
import { auth, isCancel, setServerProviders, signInGuest, type Provider } from './auth';
import { isDeadSession } from './deadSession';
import { returnedFromOutside } from './loginRescue';
import { funnel, track } from './track';
import { notify, primeRemind, push, resetRemind, scheduleRemind } from './push';
import { billingLogin } from './billing';
import * as receiptQueue from './receiptQueue';
import * as cm from './cm/api';
import type { Audience, BudgetLine, Entry, Group, GroupItem } from './cm/model';
import { codeOf, errorText } from './cm/errors';
import type { PlanReason } from './cm/plan';
import { isTheme, type ThemeName } from './ui/theme';

export type Phase = 'boot' | 'login' | 'signup' | 'groups' | 'main';
export type Tab = 'home' | 'ledger' | 'club' | 'settings';

/** 탭 위에 겹쳐 뜨는 화면 — 맨 위 한 장만 그린다. 뒤로가기는 한 장씩 */
export type Page =
  | { kind: 'record'; start: 'scan' | 'album' | 'manual' | 'pending' }
  | { kind: 'requests' }
  | { kind: 'event'; id: number }
  | { kind: 'eventNew' }
  | { kind: 'notice'; id: number }
  | { kind: 'compose'; draftId?: number; audience?: Audience }
  | { kind: 'tidy' }
  | { kind: 'entry'; entry: Entry }
  | { kind: 'receipt'; id: string }
  | { kind: 'members' }
  | { kind: 'categories' }
  | { kind: 'profile' }
  | { kind: 'notify' }
  | { kind: 'closing'; id: number }
  | { kind: 'plan' }
  | { kind: 'groupEdit' }
  | { kind: 'import'; id: string }
  | { kind: 'transfer' }
  | { kind: 'groups' }
  | { kind: 'budgetLine'; line: BudgetLine; year: number };

type Ctx = {
  phase: Phase;
  member: Member | null;
  busy: boolean;
  groups: GroupItem[];
  group: Group | null;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  pages: Page[];
  open: (p: Page) => void;
  back: () => void;
  version: number;
  bump: () => void;
  toast: string | null;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  updateReady: boolean;
  updateNotice: boolean;
  setUpdateNotice: (on: boolean) => void;
  signInWith: (p: Provider) => Promise<void>;
  guestStart: () => Promise<void>;
  finishSignup: (name: string) => Promise<void>;
  enterGroup: (g: Group) => Promise<void>;
  selectGroup: (gid: number) => Promise<void>;
  reloadGroup: () => Promise<void>;
  /** 모임 목록을 다시 보고 들어갈 곳을 정한다 — 모임을 나간 뒤 */
  reland: () => Promise<void>;
  logout: () => Promise<void>;
  withdraw: () => Promise<void>;
  /** 구독 안내 — 무엇 때문에 떴는지(없으면 닫힘). 서버 plan_required 도 여기로 온다 */
  planAsk: PlanReason | null;
  showPlan: (why?: PlanReason) => void;
  closePlan: () => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error('AppProvider 밖');

  return c;
}

const platform = (): 'ios' | 'android' => (Platform.OS === 'ios' ? 'ios' : 'android');

/** 가입 이름 — 서버가 2자 이상을 요구한다. SNS 이름이 없으면(카카오 닉네임을 받지 않는다) 자리값. 화면은 이 자리값을 기본값으로 쓰지 않는다 */
export const SIGNUP_PLACEHOLDER = '회원';
export const signupName = (name?: string | null): string => {
  const n = String(name ?? '').trim().slice(0, 20);

  return n.length >= 2 ? n : SIGNUP_PLACEHOLDER;
};
/** 모임에서 쓸 이름의 기본값 — 가입 자리값이면 비운다 */
export const defaultMyName = (name?: string | null): string => {
  const n = String(name ?? '').trim();

  return n === SIGNUP_PLACEHOLDER ? '' : n.slice(0, 30);
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('boot');
  const [member, setMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [theme, setThemeState] = useState<ThemeName>('mint');
  const [tab, setTab] = useState<Tab>('home');
  const [pages, setPages] = useState<Page[]>([]);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateNotice, setUpdateNoticeState] = useState(true);
  const [planAsk, setPlanAsk] = useState<PlanReason | null>(null);

  // 새 버전 적용 규칙(@jcurve/updates)이 읽는 지금 상태 — 렌더 밖에서 읽으므로 ref 로 둔다
  const live = useRef({ phase, signedIn: false, pages: 0, notice: true });
  live.current = { phase, signedIn: !!member, pages: pages.length, notice: updateNotice };

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // 적어도 3초, 긴 말은 더 오래(최대 5초) — 두 줄짜리가 다 읽기 전에 사라졌다(2026-09-22 태훈님), 한 줄도 2.3초는 짧았다(A32)
    toastTimer.current = setTimeout(() => setToast(null), Math.min(5000, Math.max(3000, 1500 + text.length * 100)));
  }, []);
  const showPlan = useCallback((why: PlanReason = 'general') => { track('plan_view', { why }); setPlanAsk(why); }, []);
  const closePlan = useCallback(() => setPlanAsk(null), []);
  // 구독에서만 되는 일을 서버가 막으면(plan_required) 토스트 대신 구독 안내를 띄운다
  const fail = useCallback((e: unknown) => {
    const code = codeOf(e);
    if (code === 'plan_required') setPlanAsk('server');
    else say(errorText(code));
  }, [say]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const open = useCallback((p: Page) => setPages((cur) => [...cur, p]), []);
  const back = useCallback(() => setPages((cur) => cur.slice(0, -1)), []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    void storage.set('cm.theme', t);
  }, []);

  const setUpdateNotice = useCallback((on: boolean) => {
    setUpdateNoticeState(on);
    void storage.set('cm.updateNotice', on ? '1' : '0');
  }, []);

  /** 모임 하나로 들어간다 — 목록을 다시 받고 탭을 홈으로 */
  const enterGroup = useCallback(async (g: Group) => {
    setGroup(g);
    await storage.set('cm.group', String(g.id));
    setGroups(await cm.myGroups().catch(() => [] as GroupItem[]));
    setPages([]);
    setTab('home');
    setPhase('main');
    /*
     | 알림 권한은 **모임에 들어온 때** 묻는다(한 실행에 한 번 — 이미 허용했으면 창 없이 넘어간다). 허용돼야 기기 토큰이 올라간다 —
     | `push.register()` 는 권한이 없으면 조용히 돌아선다(@jcurve/notify: 「허용 요청은 앱이 한다」). 전에는 설정 › 알림 스위치를
     | 건드려야만 물어서, 스위치가 처음부터 켜져 있는 이 앱에선 아무도 안 물어봤다 → 운영 push_tokens 0행, 지급 요청 알림이
     | 총무에게 한 번도 안 갔다(2026-09-22 태훈님 「요청 들어오면 담당자한테 알림이 와야 함」, 배포 조회 chongmunim_push_no_token).
     */
    void notify.ask().then((ok) => { if (ok) void push.register(); }).catch(() => undefined);
  }, []);

  const selectGroup = useCallback(async (gid: number) => {
    await enterGroup(await cm.getGroup(gid));
  }, [enterGroup]);

  const reloadGroup = useCallback(async () => {
    if (!group) return;
    setGroup(await cm.getGroup(group.id));
    setGroups(await cm.myGroups().catch(() => groups));
  }, [group, groups]);

  /** 로그인된 뒤 — 모임 목록을 보고 들어갈 곳을 정한다 */
  const landing = useCallback(async () => {
    // 세션 없이 모임 목록을 부르지 않는다 — 로그인 전 cm/groups 401 이 서버 기록에 있었다(2026-09-22 꼬꼬)
    if (!currentToken()) {
      setPhase('login');

      return;
    }
    const list = await cm.myGroups();
    setGroups(list);
    if (list.length === 0) {
      setPhase('groups');

      return;
    }
    const saved = Number(await storage.get('cm.group'));
    const pick = list.find((g) => g.id === saved) ?? list[0];
    await enterGroup(await cm.getGroup(pick.id));
  }, [enterGroup]);

  const afterLogin = useCallback(async (s: Session, m0: Member) => {
    let m = m0;
    setSession(s);
    await storage.setJson('cm.session', s);
    setGuestNow(m.provider === 'guest');
    /*
     | 처음 온 SNS 계정은 **약관 창 없이 여기서 가입까지 끝낸다**(당근캐시 2026-09-18 지시와 같다 — 화면 하나에서 38% 가 빠졌다).
     | 고지는 로그인 버튼 아래 한 줄(「계속하면 이용약관 · 개인정보처리방침에 동의합니다」)이 한다. 카카오 동의를 한 사람에게
     | 앱이 또 동의를 받던 것(2026-09-22 태훈님 「카카오 동의 했는데 … 또 동의가 뜸」). 세션을 먼저 둔 뒤라 auth/complete 가 인증된다.
     | 이름은 모임마다 따로 받으므로(모임 만들기·들어가기의 「내 이름」) 여기서는 서버 규칙(2자 이상)만 맞춘다 — 카카오 닉네임을
     | 받지 않는다(태훈님 「프로필사진, 닉네임도 불러오지마」). 실패하면 이름만 적는 화면으로(동의 칸 없음).
     */
    if (m.needsSignup) {
      try {
        const r = await completeSignup(signupName(m.name), platform());
        track('signup_done');
        m = { ...m, ...r.member, needsSignup: false };
      } catch (e) {
        track('signup_fail', { code: codeOf(e) });
      }
    }
    await storage.setJson('cm.member', m);
    setMember(m);
    void push.register();
    if (m.needsSignup) {
      setPhase('signup');

      return;
    }
    await landing();
  }, [landing]);

  const clearLocal = useCallback(async () => {
    setSession(null);
    void resetRemind();   // 남의 모임 알림이 이 폰에 남지 않게
    receiptQueue.reset();   // 보냈지만 기록 안 한 영수증도(저장 키는 clearAccount 가)
    await storage.clearAccount();
    setMember(null);
    setGroup(null);
    setGroups([]);
    setPages([]);
    setTab('home');
    setPhase('login');
  }, []);

  /*
   | 알림을 누르면 — @jcurve/notify 가 푸시의 data.url(「chongmunim://notice/12?g=3」)을 연다 → 여기서 받아 그 공지를 띄운다
   | (마감 결산 공지면 공지 안의 「결산 보기」). 다른 모임 것이면 그 모임으로 옮긴 뒤. 꺼져 있다 알림으로 켜졌으면
   | 로그인 복원 · 모임 입장이 끝난 뒤에 한 번. 같은 주소가 두 길(getInitialURL · url 이벤트)로 와도 한 번만 연다.
   */
  const pendingLink = useRef<string | null>(null);
  const lastLink = useRef<{ url: string; at: number } | null>(null);
  const groupRef = useRef<number | null>(null);
  groupRef.current = group?.id ?? null;
  const openLink = useCallback(async (url: string) => {
    const m = /^chongmunim:\/\/notice\/(\d+)(?:\?g=(\d+))?/.exec(url);
    // 「나중에 기록」 영수증이 다 읽혔다는 알림 — 기록 기다림 카드로(서버 ReceiptJobs)
    const rec = /^chongmunim:\/\/record\?g=(\d+)/.exec(url);
    if (!m && !rec) return;
    if (lastLink.current && lastLink.current.url === url && Date.now() - lastLink.current.at < 5000) return;
    lastLink.current = { url, at: Date.now() };
    const gid = Number((m ? m[2] : rec![1]) ?? 0);
    try {
      if (gid && gid !== groupRef.current) await enterGroup(await cm.getGroup(gid));
      setPages((cur) => [...cur, m ? { kind: 'notice', id: Number(m[1]) } : { kind: 'record', start: 'pending' }]);
      track('push_open', { kind: m ? 'notice' : 'receipt' });
    } catch {
      say(m ? '알림의 공지를 열지 못했어요' : '알림의 영수증을 열지 못했어요');
    }
  }, [enterGroup, say]);
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (live.current.phase === 'main') void openLink(url); else pendingLink.current = url;
    });
    void Linking.getInitialURL().then((u) => { if (u) pendingLink.current = u; }).catch(() => undefined);

    return () => sub.remove();
  }, [openLink]);
  useEffect(() => {
    if (phase !== 'main' || !pendingLink.current) return;
    const u = pendingLink.current;
    pendingLink.current = null;
    void openLink(u);
  }, [phase, openLink]);

  /* ── 부팅 ── */
  useEffect(() => {
    let alive = true;
    funnel.appOpen();
    void notify.init();
    void primeRemind();
    push.init();
    onSessionExpired(() => {
      void clearLocal();
      say('로그인이 풀렸어요. 다시 로그인해 주세요');
    });
    const stopApply = autoApply({
      signedIn: () => live.current.signedIn,
      triedAuth: () => auth.hasTriedAuth(),
      busy: () => live.current.phase === 'signup' || live.current.phase === 'groups' || auth.isAuthorizing(),
      atHome: () => live.current.phase === 'main' && live.current.pages === 0,
      notice: () => live.current.notice,
    }, { resumeCheckMs: 10 * 60_000 });   // 뒤에 두고 가끔 여는 앱 — 다시 앞으로 올 때도 받는다(2.4, 로그인 중엔 건너뜀)
    const stopBand = onUpdateReady(() => setUpdateReady(true));

    void (async () => {
      const t = await storage.get('cm.theme');
      if (isTheme(t)) setThemeState(t);
      if ((await storage.get('cm.updateNotice')) === '0') setUpdateNoticeState(false);
      void fetchProviders().then((r) => setServerProviders(Array.isArray(r.providers) ? r.providers : [])).catch(() => undefined);

      const saved = await storage.getJson<Session>('cm.session');
      const savedMember = await storage.getJson<Member>('cm.member');
      if (!saved || !savedMember) {
        // 로그인 전이면 새 판 확인이 끝날 때까지 시작 화면을 붙잡는다(최대 3초, @jcurve/updates)
        await startupSettled();
        if (alive) setPhase('login');

        return;
      }
      setSession(saved);
      // 못 닿았으면 지난번 회원으로 연다 — 세션이 죽었을 때(401 unauthorized)만 로그아웃
      const check = fetchMe().then((r) => r.member).catch((e) => {
        if (isDeadSession(e)) throw e;

        return savedMember;
      });
      try {
        const m = await check;
        if (alive) await afterLogin(saved, m);
      } catch {
        if (alive) await clearLocal();
      }
    })();

    return () => { alive = false; stopApply(); stopBand(); };
    // 부팅은 한 번뿐이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   | 로그인 창에 갔다가 **아이콘으로** 돌아오면 약속이 영영 안 끝날 수 있다(@jcurve/auth README). 앞으로 돌아오고
   | 2.5초가 지나도 busy 면 풀고 패키지의 약속도 버린다 — 안 그러면 모든 로그인 버튼이 먹통이 된다.
   | **앱을 떠났다 온 것만** 그렇게 본다(`loginRescue.ts`) — iOS 구글 · 웹 로그인은 창을 앱 위에 띄워 inactive ↔ active 만
   | 오가는데, 그걸 「돌아왔다」로 보면 계정 고르는 사이에 로그인을 버린다(2026-09-23 머니트리 · 꿀꿀 · 당근과 같은 자리).
   */
  const busyRef = useRef(false);
  busyRef.current = busy;
  const wentOutRef = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const r = returnedFromOutside(wentOutRef.current, st);
      wentOutRef.current = r.wentOut;
      if (!r.rescue) return;
      setTimeout(() => {
        if (!busyRef.current) return;
        auth.abandon();
        setBusy(false);
        track('login_cancel', { reason: 'returned_without_result' });
      }, 2500);
    });

    return () => sub.remove();
  }, []);

  /*
   | 재방문 로컬 알림(`remind.ts`) — 뒤로 가면 지금 들고 있는 것으로 걸고, 앞으로 오면 지운다(배지도 0).
   | iOS 는 inactive → background 로 두 번 알리지만 패키지가 예약을 한 줄로 세운다(@jcurve/notify).
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void notify.clear();
        void push.register();   // 기기 설정에서 나중에 허용했으면 이제 올라간다(같은 토큰은 한 실행에 한 번만)
      } else scheduleRemind();
    });

    return () => sub.remove();
  }, []);

  // 구독 결제(RevenueCat)를 로그인한 회원으로 — 켤 때 한 번 맞춰 두어야 끊겼던 결제도 마무리된다(billing.ts)
  useEffect(() => {
    if (member) billingLogin(member.id).catch(() => undefined);
  }, [member]);

  const handleLogin = useCallback(async (r: AuthResult, how: string) => {
    track(r.member.needsSignup ? 'signup_start' : 'login_done', { provider: how });
    await afterLogin(r.session, r.member);
  }, [afterLogin]);

  const signInWith = useCallback(async (p: Provider) => {
    if (busyRef.current) return;
    setBusy(true);
    track('login_tap', { provider: p });
    try {
      await handleLogin(await auth.signIn(p), p);
    } catch (e) {
      if (isCancel(String((e as Error)?.message ?? ''))) track('login_cancel', { provider: p });
      else {
        track('login_fail', { provider: p, code: codeOf(e) });
        say('로그인하지 못했어요. 잠시 뒤 다시 해 주세요');
      }
    } finally {
      setBusy(false);
    }
  }, [handleLogin, say]);

  const guestStart = useCallback(async () => {
    if (busyRef.current) return;
    setBusy(true);
    track('guest_tap');
    try {
      const r = await signInGuest();
      track('guest_start');
      await afterLogin(r.session, r.member);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [afterLogin, fail]);

  const finishSignup = useCallback(async (name: string) => {
    setBusy(true);
    try {
      const r = await completeSignup(name, platform());
      track('signup_done');
      const m = { ...member, ...r.member, needsSignup: false } as Member;
      setMember(m);
      await storage.setJson('cm.member', m);
      await landing();
    } catch (e) {
      track('signup_fail', { code: codeOf(e) });
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [member, landing, fail]);

  const logout = useCallback(async () => {
    try { await push.unregister(); await logoutServer(); } catch { /* 못 닿아도 이 기기에서는 나간다 */ }
    await clearLocal();
  }, [clearLocal]);

  const withdraw = useCallback(async () => {
    try {
      await withdrawServer();
      await clearLocal();
      say('탈퇴했어요. 그동안 고마웠어요');
    } catch (e) {
      fail(e);
    }
  }, [clearLocal, say, fail]);

  const value = useMemo<Ctx>(() => ({
    phase, member, busy, groups, group, theme, setTheme, tab, setTab, pages, open, back, version, bump, toast, say, fail,
    updateReady, updateNotice, setUpdateNotice,
    signInWith, guestStart, finishSignup, enterGroup, selectGroup, reloadGroup, reland: landing, logout, withdraw,
    planAsk, showPlan, closePlan,
  }), [landing, phase, member, busy, groups, group, theme, setTheme, tab, pages, open, back, version, bump, toast, say, fail,
    updateReady, updateNotice, setUpdateNotice, signInWith, guestStart, finishSignup, enterGroup, selectGroup, reloadGroup, logout, withdraw,
    planAsk, showPlan, closePlan]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** 화면이 자기 데이터를 받는 방법 — 모임·version 이 바뀌면 다시 받는다 */
export function useLoad<T>(fn: (gid: number) => Promise<T>, deps: unknown[] = []): {
  data: T | null; error: string | null; loading: boolean; reload: () => void;
} {
  const { group, version } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const gid = group?.id ?? 0;

  useEffect(() => {
    if (!gid) return;
    let alive = true;
    setLoading(true);
    fn(gid).then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(errorText(codeOf(e))); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, version, tick, ...deps]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
