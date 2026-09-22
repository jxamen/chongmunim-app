/**
 * 루트 — safe area · 에러 경계 · 화면 전환 · 하단 탭(용돈캡슐 `App.tsx` 와 같은 층).
 *
 * 하단은 시안대로 **홈 · 장부 · [촬영] · 모임 · 설정** — 가운데 둥근 버튼이 영수증 촬영이다.
 * 내비게이션 라이브러리를 쓰지 않는다. 탭은 상태 하나로 가르고, 탭 위에 겹쳐 뜨는 화면(쪽)은 store 의 `pages` 맨 위
 * 한 장만 그린다 — 왼쪽 가장자리를 쓸거나 안드로이드 뒤로 버튼을 누르면 한 장씩 닫힌다.
 */
import React, { startTransition, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Jua_400Regular } from '@expo-google-fonts/jua';
import { applyUpdate, canApplyNow } from '@jcurve/updates';
import { AppProvider, useApp, type Page, type Tab } from './src/store';
import { F, PALETTES, S, TITLE_FONT, ThemeProvider, shadow, useT } from './src/ui/theme';
import { SkiaBackdrop } from './src/ui/skia';
import { Mascot } from './src/ui/Mascot';
import { Toast } from './src/ui/kit';
import { SwipeBack } from './src/ui/SwipeBack';
import { tabBottomPad } from './src/ui/tabPad';
import { CameraIcon, ClubIcon, GearIcon, HomeIcon, LedgerIcon } from './src/ui/Icons';
import { LoginScreen, SignupScreen } from './src/screens/LoginScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { ClubScreen } from './src/screens/ClubScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PageView } from './src/screens/pages';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * 화면 한 곳에서 난 예외가 앱 전체를 검은 화면으로 만들지 않게 막는다(용돈캡슐과 같다).
 * 릴리스 빌드에서는 처리되지 않은 JS 예외가 앱을 그대로 종료시킨다.
 */
class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={[s.center, { backgroundColor: PALETTES.mint.bg }]}>
        <Mascot mood="crying" size={96} />
        <Text style={s.errorTitle}>잠시 문제가 생겼어요</Text>
        <Text style={s.errorBody}>앱을 다시 열면 이어서 할 수 있어요</Text>
      </View>
    );
  }
}

export default function App() {
  const [fonts] = useFonts({ Jua_400Regular });

  return (
    // 제스처(가장자리 스와이프)는 이 루트 안에서만 동작한다 — 안드로이드는 없으면 아예 안 먹는다
    <GestureHandlerRootView style={s.fill}>
      <SafeAreaProvider>
        <Boundary>
          <AppProvider>
            <Themed>
              <Root fonts={fonts} />
            </Themed>
          </AppProvider>
        </Boundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();

  return <ThemeProvider value={PALETTES[theme]}>{children}</ThemeProvider>;
}

function Root({ fonts }: { fonts: boolean }) {
  const { phase, toast } = useApp();
  const insets = useSafeAreaInsets();
  const T = useT();
  const ready = phase !== 'boot' && fonts;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <View style={[s.root, { paddingTop: insets.top, backgroundColor: T.bg }]}>
      {/* 앱 전체에 깔리는 Skia 바탕 — 화면마다 따로 두지 않고 여기 한 장(탭을 옮겨도 이어진다) */}
      <SkiaBackdrop />
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
      {!ready ? <Splash />
        : phase === 'login' ? <LoginScreen />
          : phase === 'signup' ? <SignupScreen />
            : phase === 'groups' ? <GroupsScreen />
              : <Main />}
      <Toast text={toast} />
    </View>
  );
}

function Splash() {
  const T = useT();

  return (
    <View style={s.center}>
      <Mascot mood="happy" size={110} />
      <Text style={[s.splashTitle, { color: T.deep }]}>총무님</Text>
      <ActivityIndicator color={T.deep} style={{ marginTop: S.sm }} />
    </View>
  );
}

const TABS: { id: Tab; label: string; Icon: (p: { color: string }) => React.ReactElement }[] = [
  { id: 'home', label: '홈', Icon: HomeIcon },
  { id: 'ledger', label: '장부', Icon: LedgerIcon },
  { id: 'club', label: '모임', Icon: ClubIcon },
  { id: 'settings', label: '설정', Icon: GearIcon },
];

function Main() {
  const { tab, setTab, pages, back, open, updateReady, updateNotice } = useApp();
  const T = useT();
  const insets = useSafeAreaInsets();
  const pad = tabBottomPad(Platform.OS, insets.bottom, S.sm);

  /*
   | 탭 줄(`tab`)과 화면(`screen`)을 따로 둔다 — 누르면 탭 줄은 바로 옮겨 가고 새 화면은 그 뒤에 그린다
   | (`startTransition`, 용돈캡슐 2026-09-19 「탭 메뉴 누르면 이동도 잘 안 되고」).
   */
  const [screen, setScreen] = useState<Tab>(tab);
  useEffect(() => { startTransition(() => setScreen(tab)); }, [tab]);

  // 키보드가 올라오면 탭을 숨긴다 — 입력 칸·버튼이 탭 뒤로 가려지지 않게(용돈캡슐 2026-09-16)
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setKeyboard(true));
    const b = Keyboard.addListener(hide, () => setKeyboard(false));

    return () => { a.remove(); b.remove(); };
  }, []);

  // 안드로이드 뒤로 버튼 — 겹친 화면이 있으면 한 장 닫고, 없으면 기본 동작(앱 나가기)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pages.length === 0) return false;
      back();

      return true;
    });

    return () => sub.remove();
  }, [pages.length, back]);

  const top: Page | undefined = pages[pages.length - 1];

  return (
    <View style={s.fill}>
      <View style={s.fill}>
        {screen === 'home' ? <HomeScreen />
          : screen === 'ledger' ? <LedgerScreen />
            : screen === 'club' ? <ClubScreen />
              : <SettingsScreen />}
      </View>

      {keyboard ? null : (
        <View style={[s.nav, { paddingBottom: pad, borderTopColor: T.line }]}>
          {TABS.slice(0, 2).map((t) => <TabButton key={t.id} {...t} on={tab === t.id} onPress={() => setTab(t.id)} />)}
          <View style={s.fabWrap}>
            <Pressable onPress={() => open({ kind: 'record', start: 'scan' })} accessibilityLabel="영수증 찍기"
              style={({ pressed }) => [s.fab, { backgroundColor: T.deep }, pressed && { transform: [{ scale: 0.96 }] }]}>
              <CameraIcon color="#FFFFFF" />
            </Pressable>
          </View>
          {TABS.slice(2).map((t) => <TabButton key={t.id} {...t} on={tab === t.id} onPress={() => setTab(t.id)} />)}
        </View>
      )}

      {/* 새 버전 띠 — 받아 둔 것이 있고, 알려 주기를 켰고, 로그인 중이 아니고, 키보드가 없을 때(@jcurve/updates 2.2) */}
      {updateReady && updateNotice && canApplyNow() && !keyboard && !top ? (
        <Pressable onPress={() => { applyUpdate(); }} accessibilityRole="button"
          style={[s.band, { bottom: 84 + pad, backgroundColor: T.ink }]}>
          <Text style={s.bandText}>새 버전이 준비됐어요 · 지금 적용 ›</Text>
        </Pressable>
      ) : null}

      {/*
        겹쳐 뜨는 화면 — 바깥을 **절대 위치 틀**로 감싼다. SwipeBack 은 안쪽에 제스처 루트(flex 1)를 두므로,
        그냥 두면 흐름 배치에 끼어 탭 화면과 높이를 반씩 나눠 가졌다(2026-09-22 웹 확인에서 화면 아래 절반에만 그려짐).
      */}
      {top ? (
        <View style={StyleSheet.absoluteFill}>
          <SwipeBack onBack={back} style={{ flex: 1, backgroundColor: T.bg }}>
            <PageView key={pages.length} page={top} />
          </SwipeBack>
        </View>
      ) : null}
    </View>
  );
}

function TabButton({ label, Icon, on, onPress }: { label: string; Icon: (p: { color: string }) => React.ReactElement; on: boolean; onPress: () => void }) {
  const T = useT();
  const color = on ? T.deep : T.dim;

  return (
    <Pressable onPress={onPress} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Icon color={color} />
      <Text style={{ fontSize: 12.5, color, fontWeight: on ? '800' : '500' }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm },
  splashTitle: { fontFamily: TITLE_FONT, fontSize: 30, marginTop: S.sm },
  errorTitle: { fontSize: F.head, fontWeight: '800', color: '#16251F' },
  errorBody: { fontSize: F.small, color: '#5E7169' },

  nav: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 9, paddingHorizontal: 6, borderTopWidth: 1, backgroundColor: 'rgba(255,255,255,0.97)' },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  fabWrap: { flex: 1, alignItems: 'center' },
  fab: { width: 60, height: 60, borderRadius: 999, marginTop: -26, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', ...shadow },

  band: { position: 'absolute', left: S.lg, right: S.lg, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', ...shadow },
  bandText: { fontSize: F.small, fontWeight: '800', color: '#FFFFFF' },
});
