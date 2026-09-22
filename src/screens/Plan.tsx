/**
 * 구독 안내 — 설정 맨 위 카드(`PlanCard`)와 어디서든 뜨는 안내 창(`PlanAsk`, App 루트).
 *
 * 무료는 계속 쓸 수 있다(체험 없음). 카드는 무료 모임에만 크게 뜬다 — 구독한 모임은 설정 머리에 「구독 중」만.
 * 결제(앱 안 구독)는 출시 직전에 붙인다 — 그전까지 「구독하기」는 곧 열린다고 알리고, 구독은 운영에서 켠다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp } from '../store';
import { FREE_FEATURES, PLAN_PRICE, PLAN_REASON, PRO_FEATURES, isPro } from '../cm/plan';
import { won } from '../cm/format';
import { track } from '../track';
import { Ask, Text, Txt, s as k } from '../ui/kit';
import { Hero } from '../ui/Hero';
import { F, R, S, useT } from '../ui/theme';

/** 설정 맨 위 — 무료 모임에만 */
export function PlanCard() {
  const { group, showPlan } = useApp();
  const T = useT();
  if (!group || isPro(group)) return null;

  return (
    <Hero tone="deep" mood="cheer" mascot={66} foot={(
      <Pressable onPress={() => showPlan('general')} accessibilityRole="button" accessibilityLabel="구독 알아보기"
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

/** 안내 창 — 무료와 구독을 나란히. 서버가 막은 것도 여기로 온다(store `fail`) */
export function PlanAsk() {
  const { planAsk, closePlan, group, say } = useApp();
  const T = useT();
  const owner = group?.me.role === 'owner';

  return (
    <Ask open={planAsk !== null} title={planAsk ? PLAN_REASON[planAsk] : ''} mood="cheer" onClose={closePlan}
      buttons={[
        { label: '닫기', tone: 'ghost', onPress: closePlan },
        { label: owner ? '구독하기' : '총무님께 부탁하기', onPress: () => {
          track('plan_cta', { owner });
          closePlan();
          say(owner ? '결제는 곧 열려요 · 열리면 여기서 바로 구독할 수 있어요' : '구독은 총무님이 할 수 있어요 · 총무님께 말씀해 주세요');
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

const st = StyleSheet.create({
  cta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  box: { borderWidth: 1, borderRadius: R.field, padding: S.md, gap: 4 },
});
