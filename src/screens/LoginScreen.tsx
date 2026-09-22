/**
 * 로그인 · 가입 마무리.
 *
 * 로그인 버튼은 `@jcurve/auth` 의 `availableProviders()` 가 주는 것만 띄운다(콘솔 키가 없는 제공자는 버튼이 없다 —
 * 눌러도 안 되는 버튼은 고장으로 보인다). 둘러보기(게스트)는 서버에 진짜 회원을 만들므로 **동의를 먼저** 받는다.
 * SNS 로 처음 온 사람(`needsSignup`)은 가입 화면에서 이름·동의를 받는다.
 * 새 판으로 다시 시작하는 1초 남짓의 틈에는 버튼을 무시한다(`isRestarting`, @jcurve/updates 2.3).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { isRestarting } from '@jcurve/updates';
import { useApp } from '../store';
import { auth, type Provider } from '../auth';
import { track } from '../track';
import { LEGAL_BASE } from '../config';
import { Ask, Btn, Field, Text, Txt, s as k } from '../ui/kit';
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
  const [consentOpen, setConsentOpen] = useState(false);
  const [agree, setAgree] = useState(false);

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
        <Btn label={providers.length ? '로그인 없이 둘러보기' : '시작하기'} tone={providers.length ? 'ghost' : 'main'} loading={busy}
          onPress={() => { if (!isRestarting()) setConsentOpen(true); }} />
        <Txt tone="dim" size="tiny" style={{ textAlign: 'center' }}>둘러보다가 나중에 카카오·구글·애플로 이어 쓸 수 있어요</Txt>
        {/*
          약관 「명시」 — 약관규제법은 체크가 아니라 알리고 읽을 수 있게 하는 것을 요구한다(당근캐시 로그인 화면과 같은 문구).
          두 낱말을 누르면 전문이 열린다. 필수 동의 체크는 가입 마무리 · 둘러보기 시작에서 따로 받는다(Consent)
        */}
        <Txt tone="dim" size="tiny" style={{ textAlign: 'center', marginTop: S.xs }}>
          {'계속하면 '}
          <Text style={{ textDecorationLine: 'underline', fontWeight: '700', color: T.sub }} onPress={() => openLegal('terms')}>이용약관</Text>
          {' · '}
          <Text style={{ textDecorationLine: 'underline', fontWeight: '700', color: T.sub }} onPress={() => openLegal('privacy')}>개인정보처리방침</Text>
          {'에 동의합니다'}
        </Txt>
      </View>

      <Ask open={consentOpen} title="시작하기 전에" mood="receipt" onClose={() => setConsentOpen(false)}
        buttons={[
          { label: '닫기', tone: 'ghost', onPress: () => setConsentOpen(false) },
          { label: '동의하고 시작', onPress: () => { if (!agree) return; setConsentOpen(false); void guestStart(); } },
        ]}>
        <Consent on={agree} onChange={setAgree} />
      </Ask>
    </View>
  );
}

/** 가입 마무리 — SNS 로 처음 온 사람. 이름과 필수 동의 */
export function SignupScreen() {
  const { member, finishSignup, busy } = useApp();
  const [name, setName] = useState(String(member?.name ?? '').slice(0, 30));
  const [agree, setAgree] = useState(false);

  useEffect(() => { track('signup_terms_view'); }, []);

  return (
    <View style={st.wrap}>
      <View style={[st.hero, { flex: 0, paddingTop: S.xxl }]}>
        <Mascot mood="heart" size={96} />
        <Txt bold size="title">반가워요!</Txt>
        <Txt tone="sub">모임에서 부를 이름을 알려 주세요</Txt>
      </View>
      <View style={{ gap: S.lg }}>
        <Field label="이름" value={name} onChangeText={setName} placeholder="예) 김태훈" maxLength={30} />
        <Consent on={agree} onChange={setAgree} />
        <Btn label="시작하기" loading={busy} disabled={!agree || name.trim() === ''}
          onPress={() => { track('signup_terms_done'); void finishSignup(name.trim()); }} />
      </View>
    </View>
  );
}

/** 필수 동의 셋 — 만 14세 이상 · 이용약관 · 개인정보 수집·이용. 전문은 총무님 홈페이지 */
function Consent({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const T = useT();
  const openDoc = openLegal;

  return (
    <View style={[st.consent, { borderColor: T.line, backgroundColor: T.white }]}>
      <Pressable onPress={() => onChange(!on)} style={[k.row, { gap: 10 }]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
        <View style={[st.check, { borderColor: on ? T.deep : T.line, backgroundColor: on ? T.deep : T.white }]}>
          {on ? <Text style={{ color: T.white, fontWeight: '900' }}>✓</Text> : null}
        </View>
        <Txt bold>모두 동의해요</Txt>
      </Pressable>
      <View style={{ gap: 6, paddingLeft: 34 }}>
        <Txt size="small" tone="sub">(필수) 만 14세 이상이에요</Txt>
        <Pressable onPress={() => openDoc('terms')}><Txt size="small" tone="sub">(필수) 이용약관 <Text style={{ textDecorationLine: 'underline' }}>보기</Text></Txt></Pressable>
        <Pressable onPress={() => openDoc('privacy')}><Txt size="small" tone="sub">(필수) 개인정보 수집·이용 <Text style={{ textDecorationLine: 'underline' }}>보기</Text></Txt></Pressable>
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
  consent: { borderWidth: 1, borderRadius: R.card, padding: S.lg, gap: S.md },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
