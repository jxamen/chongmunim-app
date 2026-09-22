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
import { AppState, Platform } from 'react-native';
import { autoApply, onUpdateReady, startupSettled } from '@jcurve/updates';
import * as storage from './storage';
import {
  completeSignup, fetchMe, fetchProviders, logoutServer, onSessionExpired, setGuestNow, setSession, withdrawServer,
  type AuthResult, type Member, type Session,
} from './api';
import { auth, isCancel, setServerProviders, signInGuest, type Provider } from './auth';
import { isDeadSession } from './deadSession';
import { funnel, track } from './track';
import { notify, push } from './push';
import * as cm from './cm/api';
import type { Audience, BudgetLine, Entry, Group, GroupItem } from './cm/model';
import { codeOf, errorText } from './cm/errors';
import { isTheme, type ThemeName } from './ui/theme';

export type Phase = 'boot' | 'login' | 'signup' | 'groups' | 'main';
export type Tab = 'home' | 'ledger' | 'club' | 'settings';

/** 탭 위에 겹쳐 뜨는 화면 — 맨 위 한 장만 그린다. 뒤로가기는 한 장씩 */
export type Page =
  | { kind: 'record'; start: 'scan' | 'album' | 'manual' }
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
};

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error('AppProvider 밖');

  return c;
}

const platform = (): 'ios' | 'android' => (Platform.OS === 'ios' ? 'ios' : 'android');

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

  // 새 버전 적용 규칙(@jcurve/updates)이 읽는 지금 상태 — 렌더 밖에서 읽으므로 ref 로 둔다
  const live = useRef({ phase, signedIn: false, pages: 0, notice: true });
  live.current = { phase, signedIn: !!member, pages: pages.length, notice: updateNotice };

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  const fail = useCallback((e: unknown) => say(errorText(codeOf(e))), [say]);

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

  const afterLogin = useCallback(async (s: Session, m: Member) => {
    setSession(s);
    await storage.setJson('cm.session', s);
    await storage.setJson('cm.member', m);
    setMember(m);
    setGuestNow(m.provider === 'guest');
    void push.register();
    if (m.needsSignup) {
      setPhase('signup');

      return;
    }
    await landing();
  }, [landing]);

  const clearLocal = useCallback(async () => {
    setSession(null);
    await storage.clearAccount();
    setMember(null);
    setGroup(null);
    setGroups([]);
    setPages([]);
    setTab('home');
    setPhase('login');
  }, []);

  /* ── 부팅 ── */
  useEffect(() => {
    let alive = true;
    funnel.appOpen();
    void notify.init();
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
   */
  const busyRef = useRef(false);
  busyRef.current = busy;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      setTimeout(() => {
        if (!busyRef.current) return;
        auth.abandon();
        setBusy(false);
        track('login_cancel', { reason: 'returned_without_result' });
      }, 2500);
    });

    return () => sub.remove();
  }, []);

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
  }), [landing, phase, member, busy, groups, group, theme, setTheme, tab, pages, open, back, version, bump, toast, say, fail,
    updateReady, updateNotice, setUpdateNotice, signInWith, guestStart, finishSignup, enterGroup, selectGroup, reloadGroup, logout, withdraw]);

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
