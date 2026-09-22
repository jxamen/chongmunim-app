/**
 * 홈(시안 1) — 잔액 → 예산 → 처리할 일 → 공지 → 최근 내역 순.
 *
 * 숫자는 전부 서버가 센 것이다(`GET cm/g/{gid}/home`). 총무·관리자에게는 처리할 지급 요청이, 회원에게는
 * 자기 요청의 진행이 보인다. 머리의 모임 이름을 누르면 모임을 바꾼다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { entrySub, entryTitle, mdWord, signed, won } from '../cm/format';
import { isManager } from '../cm/model';
import { setRemindSnapshot } from '../push';
import * as receiptQueue from '../receiptQueue';
import type { Queued } from '../cm/shots';
import { Ask, Body, Card, Chip, Failed, Head, LedgerRow, Loading, Sep, Soft, Text, Title, Txt, s as k } from '../ui/kit';
import { Gauge } from '../ui/skia';
import { Mascot } from '../ui/Mascot';
import { Hero } from '../ui/Hero';
import { F, S, useT } from '../ui/theme';

const ROLE: Record<string, string> = { owner: '총무', admin: '관리자', member: '회원' };

export function HomeScreen() {
  const { group, open, setTab, reloadGroup, say, fail } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad(cm.home);
  const manager = group ? isManager(group.me.role) : false;
  const [offer, setOffer] = useState(false);
  // 보내 놓고 아직 기록 안 한 영수증(읽기 줄) — 「나중에 기록」
  const [queued, setQueued] = useState<Queued[]>([]);
  const gid = group?.id ?? 0;
  useEffect(() => {
    if (!gid) return;
    const sync = () => setQueued(receiptQueue.list(gid));
    sync();

    return receiptQueue.subscribe(gid, sync);
  }, [gid]);
  const queuedReading = queued.filter((q) => q.state === 'sending' || q.state === 'reading').length;

  // 재방문 로컬 알림이 쓸 사실을 들고 있게 한다 — 앱이 뒤로 가는 순간엔 네트워크를 기다릴 수 없다(push.ts)
  useEffect(() => {
    if (!data || !group) return;
    setRemindSnapshot({ manager, pending: manager ? data.pending.count : 0, remind: data.remind },
      { dues: group.me.notify.dues, request: group.me.notify.request });
  }, [data, group, manager]);

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
        {/* 잔액은 히어로 띠로 — 흰 카드 한 장이면 첫 화면이 너무 심심했다(2026-09-22 태훈님). 누르면 장부로 */}
        <Pressable onPress={() => setTab('ledger')} accessibilityRole="button" accessibilityLabel="장부 보기">
          <Hero tone="deep" mood="coin" mascot={80} foot={(
            <View style={[k.row, { gap: 6 }]}>
              <View style={[hs.pill, k.grow]}><Text style={hs.pillText}>이번 달 수입  {signed(h.month.in, 'in')}</Text></View>
              <View style={[hs.pill, k.grow]}><Text style={hs.pillText}>지출  {signed(h.month.out, 'out')}</Text></View>
            </View>
          )}>
            <Text style={{ fontSize: F.small, fontWeight: '700', color: 'rgba(255,255,255,0.82)' }}>현재 잔액</Text>
            <Text style={[k.num, { fontSize: F.hero, color: T.white }]} numberOfLines={1} adjustsFontSizeToFit>
              {won(h.balance)}<Text style={{ fontSize: 19 }}> 원</Text>
            </Text>
          </Hero>
        </Pressable>

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

        {/* 보낸 영수증 — 「나중에 기록」을 고른 것. 다 읽히면 여기서 이어서 기록한다(2026-09-22 태훈님) */}
        {queued.length ? (
          <Soft pill={`${queued.length}장`}
            title={queuedReading ? `영수증 ${queuedReading}장을 읽고 있어요` : `영수증 ${queued.length}장이 기록을 기다려요`}
            sub={queuedReading ? '다 읽으면 알림으로 알려 드려요 · 지금 눌러 봐도 돼요' : '눌러서 확인하고 한 번에 기록해요'}
            onPress={() => open({ kind: 'record', start: 'pending' })} />
        ) : null}

        {/* 가져오는 장부 파일 — 분석이 끝나면 여기서 알린다(기획 「가져오기는 관문이 아니라 보너스」) */}
        {h.import ? (
          <Soft pill={h.import.status === 'ready' && h.import.rows !== null ? `${h.import.rows}건` : undefined}
            title={h.import.status === 'ready' ? '가져온 장부를 확인해 주세요' : '장부 파일을 읽고 있어요'}
            sub={h.import.status === 'ready' ? `${h.import.fileName ?? '구글 시트'} · 확인한 줄만 넣어요` : '끝나면 여기서 알려 드려요 · 그동안 장부를 그대로 쓰셔도 돼요'}
            onPress={() => open({ kind: 'import', id: h.import!.id })} />
        ) : null}

        {/* 다가오는 생일(14일 안) — 총무·관리자 · 구독 모임. 회비로 선물을 챙기는 모임이 많다(2026-09-22 태훈님) */}
        {h.birthdays.length > 0 ? (
          <Card style={{ gap: 6 }} onPress={() => open({ kind: 'members' })}>
            <Txt size="small" tone="sub" bold>다가오는 생일</Txt>
            {h.birthdays.slice(0, 4).map((b) => (
              <View key={b.id} style={[k.row, { gap: 8 }]}>
                <Txt bold style={k.grow} numberOfLines={1}>🎂 {b.name}</Txt>
                <Txt size="small" tone={b.days === 0 ? 'pos' : 'sub'} bold={b.days === 0}>
                  {b.days === 0 ? '오늘' : b.days === 1 ? '내일' : `${b.days}일 뒤`} · {mdWord(b.md)}
                </Txt>
              </View>
            ))}
          </Card>
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

const hs = StyleSheet.create({
  pill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.16)' },
  pillText: { fontSize: 13.5, fontWeight: '700', color: '#fff', textAlign: 'center' },
});
