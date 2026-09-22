/**
 * 로그인 · 가입 마무리.
 *
 * 로그인 버튼은 `@jcurve/auth` 의 `availableProviders()` 가 주는 것만 띄운다(콘솔 키가 없는 제공자는 버튼이 없다 —
 * 눌러도 안 되는 버튼은 고장으로 보인다). 동의 체크 창은 없다 — 버튼 아래 「계속하면 … 동의합니다」 한 줄이 알린다(`LegalNote`).
 * SNS 로 처음 온 사람(`needsSignup`)도 로그인 직후 곧장 가입이 끝난다. 가입 화면은 그게 막혔을 때만 이름을 다시 받는다.
 * 새 판으로 다시 시작하는 1초 남짓의 틈에는 버튼을 무시한다(`isRestarting`, @jcurve/updates 2.3).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { isRestarting } from '@jcurve/updates';
import { defaultMyName, useApp } from '../store';
import { auth, type Provider } from '../auth';
import { track } from '../track';
import { LEGAL_BASE } from '../config';
import { Btn, Field, Text, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { AppleMark, GoogleMark, KakaoMark } from '../ui/BrandMark';
import { BRAND, F, R, S, useT } from '../ui/theme';

/** 약관 전문 — 총무님 홈페이지(`LEGAL_BASE`) */
const openLegal = (doc: 'terms' | 'privacy'): void => { void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/${doc}`).catch(() => undefined); };

/** 버튼 왼쪽 표시 — 무엇으로 로그인하는지 글자보다 그림이 먼저 읽힌다 */
const MARK: Record<Provider, React.ComponentType<{ size?: number }>> = { kakao: KakaoMark, google: GoogleMark, apple: AppleMark };

export function LoginScreen() {
  const { signInWith, guestStart, busy } = useApp();
  const T = useT();
  const providers = useMemo(() => auth.availableProviders(), []);

  useEffect(() => { track('login_view', { sns: providers.length }); }, [providers.length]);

  const tap = (p: Provider) => { if (!isRestarting()) void signInWith(p); };

  return (
    <View style={st.wrap}>
      <View style={st.hero}>
        <Mascot mood="coin" size={132} />
        <Text style={[st.brand, { color: T.deep }]}>총무님</Text>
        <Txt tone="sub" style={{ textAlign: 'center', lineHeight: 23 }}>{'영수증 찍으면 장부 한 줄.\n월말 결산서까지 알아서 나와요.'}</Txt>
      </View>

      <View style={{ gap: S.sm }}>
        {providers.map((p) => {
          const Mark = MARK[p];

          return (
            <Pressable key={p} onPress={() => tap(p)} disabled={busy} accessibilityRole="button" accessibilityLabel={BRAND[p].label}
              style={({ pressed }) => [st.sns, { backgroundColor: BRAND[p].bg, borderColor: BRAND[p].border }, pressed && k.pressed]}>
              {/* 로고는 왼쪽에 고정, 글자는 가운데 — 이름 길이가 달라도 세 버튼의 글자가 어긋나지 않게(당근캐시와 같다) */}
              <View style={st.mark}><Mark size={20} /></View>
              <Text style={{ color: BRAND[p].fg, fontSize: F.body, fontWeight: '800' }}>{BRAND[p].label}</Text>
            </Pressable>
          );
        })}
        {/* 둘러보기도 창 없이 곧장 — 동의는 아래 한 줄이 알린다(SNS 가입과 같은 규칙) */}
        <Btn label={providers.length ? '로그인 없이 둘러보기' : '시작하기'} tone={providers.length ? 'ghost' : 'main'} loading={busy}
          onPress={() => { if (!isRestarting()) void guestStart(); }} />
        <Txt tone="dim" size="tiny" style={{ textAlign: 'center' }}>둘러보다가 나중에 카카오·구글·애플로 이어 쓸 수 있어요</Txt>
        <LegalNote />
      </View>
    </View>
  );
}

/*
 | 약관 「명시」 — 약관규제법은 체크가 아니라 알리고 읽을 수 있게 하는 것을 요구한다(당근캐시 로그인 화면과 같은 문구).
 | 두 낱말을 누르면 전문이 열린다. **따로 동의 창을 띄우지 않는다** — 카카오 동의를 하고 온 사람에게 앱이 또 받던 것을 걷어 냈다
 | (2026-09-22 태훈님, 당근캐시 2026-09-18 지시와 같은 규칙. 이용약관·개인정보 수집은 계약 이행에 필요한 최소 처리, 만 14세는 약관에).
 */
function LegalNote() {
  const T = useT();
  const link = { textDecorationLine: 'underline', fontWeight: '700', color: T.sub } as const;

  return (
    <Txt tone="dim" size="tiny" style={{ textAlign: 'center', marginTop: S.xs }}>
      {'계속하면 '}
      <Text style={link} onPress={() => openLegal('terms')}>이용약관</Text>
      {' · '}
      <Text style={link} onPress={() => openLegal('privacy')}>개인정보처리방침</Text>
      {'에 동의합니다'}
    </Txt>
  );
}

/** 가입이 막혔을 때만 — 보통은 로그인 직후 곧장 가입을 끝낸다(store `afterLogin`). 이름만 다시 받는다 */
export function SignupScreen() {
  const { member, finishSignup, busy } = useApp();
  const [name, setName] = useState(defaultMyName(member?.name));

  useEffect(() => { track('signup_terms_view'); }, []);

  return (
    <View style={st.wrap}>
      <View style={[st.hero, { flex: 0, paddingTop: S.xxl }]}>
        <Mascot mood="heart" size={96} />
        <Txt bold size="title">반가워요!</Txt>
        <Txt tone="sub">부를 이름을 알려 주세요</Txt>
      </View>
      <View style={{ gap: S.lg }}>
        <Field label="이름" value={name} onChangeText={setName} placeholder="예) 김태훈" maxLength={20} />
        <Btn label="시작하기" loading={busy} disabled={name.trim().length < 2}
          onPress={() => { track('signup_terms_done'); void finishSignup(name.trim()); }} />
        <LegalNote />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: S.xl, paddingBottom: S.xxl, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm },
  brand: { fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: S.sm },
  sns: { height: 52, borderRadius: R.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', left: 18 },
});
