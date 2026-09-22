/**
 * 구독 — 설정 맨 위 카드(`PlanCard`) · 구독 관리 화면(`PlanScreen`) · 어디서든 뜨는 안내 창(`PlanAsk`, App 루트).
 *
 * 무료는 계속 쓸 수 있다(체험 없음). 카드는 무료 모임엔 크게(구독 알아보기), 구독한 모임엔 작게(구독 중 · 관리) 뜬다
 * (2026-09-22 태훈님 「구독 플랜 관리가 없네」 — 구독한 모임엔 아무것도 없었다).
 * 결제(앱 안 구독)는 출시 직전에 붙인다 — 그전까지 「구독하기」·「해지」는 곧 열린다고 알리고, 구독은 운영에서 켠다.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useApp } from '../store';
import { FREE_FEATURES, PLAN_PRICE, PLAN_REASON, PRO_FEATURES, isPro } from '../cm/plan';
import { won } from '../cm/format';
import { track } from '../track';
import { Ask, Body, Btn, Card, Head, KV, Sep, Text, Txt, s as k } from '../ui/kit';
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

/** 구독 관리 — 지금 플랜 · 요금 · 들어 있는 것 · 구독하기/해지. 구독은 모임마다 */
export function PlanScreen() {
  const { group, back, say } = useApp();
  const T = useT();
  const [cancel, setCancel] = useState(false);
  if (!group) return null;
  const pro = isPro(group);
  const owner = group.me.role === 'owner';
  const others = Math.max(0, group.members - 1);

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
          <KV label="결제" value={pro ? '출시 전 시험 구독 · 결제 없음' : '없음'} />
        </Card>

        <Card style={{ gap: 5 }}>
          <Txt size="small" tone="sub" bold>{pro ? '쓰고 있는 기능' : '구독하면 더 쓰는 기능'}</Txt>
          {/* 구독 중이면 무료의 제한(한 장씩 · 10명)은 빼고 보인다 */}
          {(pro ? ['영수증 올리기 · 장부 보기 · 엑셀 내려받기'] : FREE_FEATURES).map((f) => <Txt key={f} size="small">✓  {f}</Txt>)}
          {PRO_FEATURES.map((f) => <Txt key={f} size="small" tone={pro ? 'ink' : 'dim'}>{pro ? '✓' : '＋'}  {f}</Txt>)}
        </Card>

        {pro ? (
          owner ? <Btn label="구독 해지" tone="ghost" onPress={() => setCancel(true)} /> : null
        ) : owner ? (
          <Btn label={`구독하기 · 월 ${won(PLAN_PRICE)}원`} onPress={() => { track('plan_cta', { owner, from: 'manage' }); say('결제는 곧 열려요 · 열리면 여기서 바로 구독할 수 있어요'); }} />
        ) : null}
        <Txt size="tiny" tone="dim" style={{ textAlign: 'center', lineHeight: 19 }}>
          {owner ? '구독은 모임마다예요 · 모임을 바꾸면 그 모임의 구독이 보여요' : '구독은 총무님이 관리해요 · 모임마다 따로예요'}
        </Txt>
      </Body>

      <Ask open={cancel} title="구독을 해지할까요?" mood="thinking" onClose={() => setCancel(false)}
        body={'지금은 출시 전 시험 구독이라 결제되는 돈이 없어요.\n결제가 열리면 여기서 앱스토어·플레이스토어 구독 관리로 이어져 해지할 수 있고, 해지해도 결제한 기간이 끝날 때까지는 모든 기능을 써요.'}
        buttons={[{ label: '닫기', onPress: () => setCancel(false) }]} />
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
