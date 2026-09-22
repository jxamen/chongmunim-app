/**
 * 홈(시안 1) — 잔액 → 예산 → 처리할 일 → 공지 → 최근 내역 순.
 *
 * 숫자는 전부 서버가 센 것이다(`GET cm/g/{gid}/home`). 총무·관리자에게는 처리할 지급 요청이, 회원에게는
 * 자기 요청의 진행이 보인다. 머리의 모임 이름을 누르면 모임을 바꾼다.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { entrySub, entryTitle, signed, won } from '../cm/format';
import { isManager } from '../cm/model';
import { Ask, Big, Body, Card, Chip, Failed, Head, LedgerRow, Loading, Sep, Soft, Title, Txt, s as k } from '../ui/kit';
import { Gauge } from '../ui/skia';
import { Mascot } from '../ui/Mascot';
import { S, useT } from '../ui/theme';

const ROLE: Record<string, string> = { owner: '총무', admin: '관리자', member: '회원' };

export function HomeScreen() {
  const { group, open, setTab, reloadGroup, say, fail } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad(cm.home);
  const manager = group ? isManager(group.me.role) : false;
  const [offer, setOffer] = useState(false);

  /* 총무 넘기기 — 지정받은 사람이 수락하거나 사양한다 */
  const answer = async (yes: boolean) => {
    if (!group) return;
    try {
      if (yes) await cm.acceptOwner(group.id); else await cm.cancelOwner(group.id);
      await reloadGroup();
      say(yes ? '이제 총무예요 · 장부와 영수증이 모두 넘어왔어요' : '사양했어요');
    } catch (e) {
      fail(e);
    } finally {
      setOffer(false);
    }
  };

  const head = (
    <Head
      title={(
        <Pressable onPress={() => open({ kind: 'groups' })} style={[k.row, { gap: 7 }]} hitSlop={8}>
          <Mascot mood="happy" size={30} />
          <Title style={{ flexShrink: 1 }}>{group?.name ?? ''}</Title>
          <Txt tone="dim">▾</Txt>
        </Pressable>
      )}
      right={group ? <Chip label={ROLE[group.me.role]} tone={manager ? 'tint' : 'plain'} /> : null}
    />
  );

  if (!data) {
    return <View style={{ flex: 1 }}>{head}{error ? <Failed text={error} onRetry={reload} /> : <Loading />}</View>;
  }

  const h = data;

  return (
    <View style={{ flex: 1 }}>
      {head}
      <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
        {group?.transfer?.toMe ? (
          <Soft tone="warn" title="총무를 넘겨받을까요?" sub={`${group.owner ?? '지금 총무'} 님이 장부를 넘기려 해요`} onPress={() => setOffer(true)} />
        ) : null}
        <Card>
          <View style={[k.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ gap: 4 }}>
              <Txt size="small" tone="sub">현재 잔액</Txt>
              <Big value={h.balance} />
            </View>
            <Mascot mood="coin" size={64} style={{ marginTop: -4, marginRight: -2 }} />
          </View>
          <Sep style={{ marginVertical: S.md }} />
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt size="small" tone="sub">이번 달 수입 <Txt size="small" tone="pos" bold>{signed(h.month.in, 'in')}</Txt></Txt>
            <Txt size="small" tone="sub">지출 <Txt size="small" bold>{signed(h.month.out, 'out')}</Txt></Txt>
          </View>
        </Card>

        {h.budget.total > 0 ? (
          <Card onPress={() => setTab('ledger')}>
            <View style={[k.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
              <Txt size="small" tone="sub" bold>{h.budget.year}년 예산</Txt>
              <Txt size="small" tone="sub">{h.budget.percent}%</Txt>
            </View>
            <Gauge percent={h.budget.percent} />
          </Card>
        ) : manager ? (
          <Soft title="올해 예산을 세워 보세요" sub="항목별로 적어 두면 얼마나 썼는지 막대로 보여 드려요" onPress={() => setTab('ledger')} />
        ) : null}

        {h.pending.count > 0 ? (
          <Soft pill={`${h.pending.count}건`} title={manager ? '지급 요청이 기다려요' : '지급 요청을 처리하는 중이에요'}
            sub={`합계 ${won(h.pending.sum)}원`} onPress={() => open({ kind: 'requests' })} />
        ) : null}

        {h.notice ? (
          <Card onPress={() => open({ kind: 'notice', id: h.notice!.id })} style={[k.row, { gap: 10, paddingVertical: 13 }]}>
            <Chip label="공지" tone="tint" />
            <View style={k.grow}>
              <Txt bold numberOfLines={1}>{h.notice.title}</Txt>
              <Txt size="tiny" tone="sub">
                {[h.notice.author ? `${ROLE[h.notice.authorRole]} ${h.notice.author}` : null, manager ? `읽음 ${h.notice.reads}/${h.notice.recipients}` : null]
                  .filter(Boolean).join(' · ')}
              </Txt>
            </View>
            <Txt tone="sub">›</Txt>
          </Card>
        ) : manager ? (
          <Soft title="첫 공지를 써 보세요" sub="회원 모두에게 푸시로 알려 드려요" onPress={() => open({ kind: 'compose' })} />
        ) : null}

        <Card style={{ paddingVertical: 2 }}>
          {h.recent.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: S.xl, gap: 6 }}>
              <Mascot mood="receipt" size={70} />
              <Txt bold>아직 기록이 없어요</Txt>
              <Txt size="small" tone="sub">가운데 카메라로 영수증을 찍어 보세요</Txt>
            </View>
          ) : h.recent.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Sep /> : null}
              <LedgerRow title={entryTitle(e, h.categories)} sub={entrySub(e, h.categories)} value={e.amount} direction={e.direction}
                badge={e.edited.length ? '영수증과 다름' : undefined}
                onPress={manager ? () => open({ kind: 'entry', entry: e }) : undefined} />
            </View>
          ))}
        </Card>
        {h.recent.length > 0 ? (
          <Pressable onPress={() => setTab('ledger')} style={{ alignSelf: 'center', padding: S.sm }}>
            <Txt size="small" tone="sub">장부 전체 보기 ›</Txt>
          </Pressable>
        ) : null}
      </Body>
      <Ask open={offer} title="총무를 넘겨받을까요?" mood="heart" onClose={() => setOffer(false)}
        body="장부·영수증·예산·회원 명부·처리 중인 지급 요청이 넘어와요. 지난 기록의 작성자는 그대로 남아요."
        buttons={[{ label: '사양', tone: 'ghost', onPress: () => { void answer(false); } }, { label: '넘겨받기', onPress: () => { void answer(true); } }]} />
    </View>
  );
}
