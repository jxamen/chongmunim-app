/**
 * 구독 — 설정 맨 위 카드(`PlanCard`) · 구독 관리 화면(`PlanScreen`) · 어디서든 뜨는 안내 창(`PlanAsk`, App 루트).
 *
 * 무료는 계속 쓸 수 있다(체험 없음). 카드는 무료 모임엔 크게(구독 알아보기), 구독한 모임엔 작게(구독 중 · 관리) 뜬다
 * (2026-09-22 태훈님 「구독 플랜 관리가 없네」 — 구독한 모임엔 아무것도 없었다).
 * 결제는 RevenueCat(`src/billing.ts`, 2026-09-22 태훈님 「구독은 레비뉴캣으로」) — 총무가 사면 서버가 RC 에 확인하고
 * 이 모임을 덮는다(cm.claimPlan). 해지는 스토어의 구독 관리에서. 결제 없이 켠 구독(운영 · 칸이 생길 때 있던 모임)은 끝이 없다.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { PurchasesPackage } from 'react-native-purchases';
import { useApp } from '../store';
import type { ApiError } from '../api';
import * as cm from '../cm/api';
import { codeOf } from '../cm/errors';
import { FREE_FEATURES, PLAN_PRICE, PLAN_REASON, PRO_FEATURES, isPro } from '../cm/plan';
import { won } from '../cm/format';
import { billingLogin, billingState, buy, manageUrl, monthlyPackage, restore } from '../billing';
import { LEGAL_BASE } from '../config';
import { track } from '../track';
import { Ask, Body, Btn, Card, Head, KV, Sep, Soft, Text, Txt, s as k } from '../ui/kit';
import { Hero } from '../ui/Hero';
import { F, R, S, useT } from '../ui/theme';

/** 설정 맨 위 — 무료 모임엔 크게(구독 알아보기), 구독한 모임엔 작게(구독 중 · 관리) */
export function PlanCard() {
  const { group, open } = useApp();
  const T = useT();
  if (!group) return null;
  if (isPro(group)) {
    return (
      <Pressable onPress={() => open({ kind: 'plan' })} accessibilityRole="button" accessibilityLabel="구독 관리"
        style={({ pressed }) => [st.proCard, { backgroundColor: T.deep }, pressed && k.pressed]}>
        <View style={[st.check, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Text style={{ color: T.white, fontWeight: '900', fontSize: 16 }}>✓</Text></View>
        <View style={k.grow}>
          <Text style={{ fontSize: F.body, fontWeight: '900', color: T.white }}>구독 중 · 모든 기능</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>{`${group.name} · 모임당 월 ${won(PLAN_PRICE)}원`}</Text>
        </View>
        <Text style={{ fontSize: F.small, fontWeight: '800', color: T.white }}>관리 ›</Text>
      </Pressable>
    );
  }

  return (
    <Hero tone="deep" mood="cheer" mascot={66} foot={(
      <Pressable onPress={() => open({ kind: 'plan' })} accessibilityRole="button" accessibilityLabel="구독 알아보기"
        style={({ pressed }) => [st.cta, pressed && k.pressed]}>
        <Text style={{ fontSize: F.body, fontWeight: '800', color: T.white }}>구독 알아보기  →</Text>
      </Pressable>
    )}>
      <View style={[k.row, { gap: 8, flexWrap: 'wrap' }]}>
        <Text style={{ fontSize: F.head, fontWeight: '900', color: T.white }}>모임을 함께 쓰려면</Text>
        <View style={st.badge}><Text style={{ fontSize: 12.5, fontWeight: '800', color: T.deep }}>월 {won(PLAN_PRICE)}원</Text></View>
      </View>
      <Text style={{ fontSize: F.small, fontWeight: '800', color: T.white, marginTop: 4 }}>혼자 쓰기는 계속 무료예요</Text>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 19 }}>초대 10명 넘게 · 운영자 · 회비 · 공지 · 예산 · 가져오기는 구독</Text>
    </Hero>
  );
}

/** 안내 창 — 무료와 구독을 나란히. 서버가 막은 것도 여기로 온다(store `fail`). 총무의 「구독하기」는 구독 관리 화면으로 */
export function PlanAsk() {
  const { planAsk, closePlan, group, say, open } = useApp();
  const T = useT();
  const owner = group?.me.role === 'owner';

  return (
    <Ask open={planAsk !== null} title={planAsk ? PLAN_REASON[planAsk] : ''} mood="cheer" onClose={closePlan}
      buttons={[
        { label: '닫기', tone: 'ghost', onPress: closePlan },
        { label: owner ? '구독하기' : '총무님께 부탁하기', onPress: () => {
          track('plan_cta', { owner });
          closePlan();
          if (owner) open({ kind: 'plan' });
          else say('구독은 총무님이 할 수 있어요 · 총무님께 말씀해 주세요');
        } },
      ]}>
      <View style={{ gap: S.sm }}>
        <View style={[st.box, { borderColor: T.line }]}>
          <Txt size="small" bold tone="sub">무료 · 계속</Txt>
          {FREE_FEATURES.map((f) => <Txt key={f} size="small">·  {f}</Txt>)}
        </View>
        <View style={[st.box, { borderColor: T.deep, backgroundColor: T.tint }]}>
          <Txt size="small" bold style={{ color: T.deep }}>{`구독 · 모임당 월 ${won(PLAN_PRICE)}원`}</Txt>
          {PRO_FEATURES.map((f) => <Txt key={f} size="small">✓  {f}</Txt>)}
        </View>
      </View>
    </Ask>
  );
}

/** 구독 끝 — 서버 UTC 「2026-10-22 09:00:00」 → 「10월 22일」 */
const untilDay = (at: string | null): string => {
  if (!at) return '';
  const d = new Date(at.includes('T') ? at : at.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const kst = new Date(d.getTime() + 9 * 3600_000);

  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
};

/** 구독 관리 — 지금 플랜 · 요금 · 들어 있는 것 · 구독하기(RevenueCat) · 구매 복원 · 스토어에서 해지. 구독은 모임마다 */
export function PlanScreen() {
  const { group, member, back, say, fail, reloadGroup } = useApp();
  const T = useT();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);   // plan_in_use — 내 구독이 이미 덮고 있는 모임
  const [cancel, setCancel] = useState(false);
  const state = billingState();
  const pro = isPro(group);
  const owner = group?.me.role === 'owner';

  // 파는 상품(스토어 가격) — 무료 모임의 총무에게만 필요하다
  useEffect(() => {
    if (state !== 'ready' || !member || pro || !owner) return;
    let alive = true;
    billingLogin(member.id).then(monthlyPackage).then((p) => { if (alive) setPkg(p); }).catch(() => undefined);

    return () => { alive = false; };
  }, [state, member, pro, owner]);

  if (!group) return null;
  const others = Math.max(0, group.members - 1);

  /* 산 구독을 이 모임에 — 서버가 RevenueCat 에 직접 확인한다. 이미 다른 모임을 덮고 있으면 옮길지 묻는다 */
  const claim = async (move = false) => {
    try {
      await cm.claimPlan(group.id, move);
      await reloadGroup();
      say(move ? '구독을 이 모임으로 옮겼어요' : '구독했어요 · 모든 기능이 열렸어요');
    } catch (e) {
      if (codeOf(e) === 'plan_in_use') {
        const name = ((e as ApiError).data as { groupName?: unknown } | null)?.groupName;
        setMoveFrom(typeof name === 'string' && name ? name : '다른 모임');
        return;
      }
      fail(e);
    }
  };
  const purchase = async () => {
    if (!pkg) return;
    track('plan_buy', { from: 'manage' });
    setBusy('buy');
    try {
      if (await buy(pkg)) await claim();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const restoreNow = async () => {
    setBusy('restore');
    try {
      await restore();
      await claim();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const pay = !pro ? '없음'
    : !group.planPaid ? '결제 없이 켠 구독'
    : group.planMine ? `내가 결제 · ${untilDay(group.planUntil)}까지(자동 갱신)` : '다른 관리자가 결제 중';

  return (
    <View style={{ flex: 1 }}>
      <Head title="구독 관리" onClose={back} />
      <Body>
        <View style={{ height: 2 }} />
        <Hero tone={pro ? 'deep' : 'tint'} mood={pro ? 'celebrate' : 'thinking'} mascot={70}>
          <Text style={{ fontSize: F.title, fontWeight: '900', color: pro ? T.white : T.deep }}>{pro ? '구독 중이에요' : '무료로 쓰고 있어요'}</Text>
          <Text style={{ fontSize: F.small, color: pro ? 'rgba(255,255,255,0.85)' : T.sub }}>{group.name}</Text>
        </Hero>

        <Card style={{ paddingVertical: 12 }}>
          <KV label="플랜" value={pro ? '구독' : '무료'} strong />
          <KV label="요금" value={pro ? `모임당 월 ${won(PLAN_PRICE)}원` : '0원 · 계속 무료'} />
          <KV label="같이 보는 사람" value={pro ? `${others}명 · 제한 없음` : `${others}명 / ${group.freeMembers}명까지`} />
          <Sep />
          <KV label="결제" value={pay} />
        </Card>

        <Card style={{ gap: 5 }}>
          <Txt size="small" tone="sub" bold>{pro ? '쓰고 있는 기능' : '구독하면 더 쓰는 기능'}</Txt>
          {/* 구독 중이면 무료의 제한(한 장씩 · 10명)은 빼고 보인다 */}
          {(pro ? ['영수증 올리기 · 장부 보기 · 엑셀 내려받기'] : FREE_FEATURES).map((f) => <Txt key={f} size="small">✓  {f}</Txt>)}
          {PRO_FEATURES.map((f) => <Txt key={f} size="small" tone={pro ? 'ink' : 'dim'}>{pro ? '✓' : '＋'}  {f}</Txt>)}
        </Card>

        {pro ? (
          group.planPaid && group.planMine ? <Btn label="구독 관리 · 해지" tone="ghost" onPress={() => setCancel(true)} /> : null
        ) : owner ? (
          // 결제 모듈이 없는 판(SDK 전 시험판 · 웹)이나 키가 없을 때 — 첫 스토어 판부터는 모듈이 들어 있다
          state !== 'ready' ? <Soft title="결제를 준비하고 있어요" sub="곧 여기서 바로 구독할 수 있어요" />
            : (
              <>
                <Btn label={pkg ? `구독하기 · 월 ${pkg.product.priceString}` : '가격을 불러오는 중…'} disabled={!pkg || busy !== null}
                  loading={busy === 'buy'} onPress={() => { void purchase(); }} />
                {/* 자동 갱신 구독 안내 — 스토어 심사가 보는 것(가격 · 기간 · 자동 갱신 · 해지 방법 · 약관) */}
                <Txt size="tiny" tone="dim" style={{ textAlign: 'center', lineHeight: 19 }}>
                  1개월마다 자동으로 갱신돼요 · 스토어의 구독 관리에서 언제든 해지할 수 있고, 해지해도 결제한 기간 끝까지 써요
                </Txt>
              </>
            )
        ) : null}
        {owner && state === 'ready' && !(pro && group.planPaid) ? (
          <Pressable onPress={() => { void restoreNow(); }} disabled={busy !== null} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Txt size="small" tone="sub">{busy === 'restore' ? '구매 확인하는 중…' : '구매 복원 · 다른 모임에서 옮겨 오기'}</Txt>
          </Pressable>
        ) : null}
        <View style={[k.row, { gap: S.md, alignSelf: 'center' }]}>
          <Pressable onPress={() => { void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/terms`).catch(() => undefined); }} hitSlop={8}>
            <Txt size="tiny" tone="sub">이용약관</Txt>
          </Pressable>
          <Pressable onPress={() => { void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/privacy`).catch(() => undefined); }} hitSlop={8}>
            <Txt size="tiny" tone="sub">개인정보처리방침</Txt>
          </Pressable>
        </View>
        <Txt size="tiny" tone="dim" style={{ textAlign: 'center', lineHeight: 19 }}>
          {owner ? '구독은 모임마다예요 · 한 사람의 구독은 모임 하나에 써요' : '구독은 총무님이 관리해요 · 모임마다 따로예요'}
        </Txt>
      </Body>

      <Ask open={cancel} title="구독을 해지할까요?" mood="thinking" onClose={() => setCancel(false)}
        body={`해지는 ${Platform.OS === 'ios' ? '앱스토어' : '플레이스토어'}의 구독 관리에서 해요.\n해지해도 ${untilDay(group.planUntil) || '결제한 기간 끝'}까지는 모든 기능을 써요.`}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setCancel(false) },
          { label: '구독 관리 열기', onPress: () => { setCancel(false); void Linking.openURL(manageUrl()).catch(() => undefined); } }]} />
      <Ask open={moveFrom !== null} title="구독을 이 모임으로 옮길까요?" mood="thinking" onClose={() => setMoveFrom(null)}
        body={`내 구독은 지금 「${moveFrom ?? ''}」에 쓰고 있어요. 한 사람의 구독은 모임 하나에만 써요.\n옮기면 「${moveFrom ?? ''}」은 무료로 돌아가요.`}
        buttons={[{ label: '그대로 두기', tone: 'ghost', onPress: () => setMoveFrom(null) },
          { label: '이 모임으로 옮기기', onPress: () => { setMoveFrom(null); void claim(true); } }]} />
    </View>
  );
}

const st = StyleSheet.create({
  proCard: { flexDirection: 'row', alignItems: 'center', gap: S.md, borderRadius: R.card, paddingVertical: 14, paddingHorizontal: 16 },
  check: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  box: { borderWidth: 1, borderRadius: R.field, padding: S.md, gap: 4 },
});
