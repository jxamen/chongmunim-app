/**
 * 지급 요청 처리(시안 3) — **송금은 은행 앱에서. 여기엔 지급 여부만 남긴다.**
 *
 * 총무·관리자: 대기/지급완료/반려 탭, 계좌 복사, [반려][지급완료]. 지급완료를 누르면 장부에 지출 한 줄이 생긴다.
 * 회원: 내 요청만 보이고, 처리 전이면 거둘 수 있다.
 */
import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { dayLabel, won } from '../cm/format';
import { isManager, type PayRequest, type RequestStatus } from '../cm/model';
import { chipOrder } from '../cm/rules';
import { copy } from '../share';
import { Ask, Big, Body, Btn, Card, Chip, Choices, Empty, Failed, Field, Head, Loading, Tabs, Txt, s as k } from '../ui/kit';
import { S, useT } from '../ui/theme';

export function RequestsScreen() {
  const { group, back, bump, say, fail, open } = useApp();
  const T = useT();
  const [status, setStatus] = useState<RequestStatus>('pending');
  const { data, error, loading, reload } = useLoad((gid) => cm.requests(gid, status), [status]);
  const cats = useLoad(cm.categories);
  const evs = useLoad(cm.events);
  const [reject, setReject] = useState<PayRequest | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  // 처리 전에 고치기 — 회원이 항목·행사를 잘못 골랐을 때(기획 「총무가 승인할 때 고칠 수 있어야 한다」)
  const [edit, setEdit] = useState<PayRequest | null>(null);
  const [eCat, setECat] = useState<number | null>(null);
  const [eEvent, setEEvent] = useState<number | null>(null);
  const [eMemo, setEMemo] = useState('');
  const manager = group ? isManager(group.me.role) : false;

  const catName = (id: number | null) => (id ? cats.data?.find((c) => c.id === id)?.name : undefined);
  const evName = (id: number | null) => (id ? evs.data?.find((e) => e.id === id)?.name : undefined);

  const act = async (q: PayRequest, what: 'pay' | 'reject' | 'cancel') => {
    if (!group) return;
    setBusy(q.id);
    try {
      if (what === 'pay') await cm.payRequest(group.id, q.id);
      if (what === 'reject') await cm.rejectRequest(group.id, q.id, reason.trim() || undefined);
      if (what === 'cancel') await cm.cancelRequest(group.id, q.id);
      say(what === 'pay' ? `${q.requester ?? ''} ${won(q.amount)}원 지급완료 · 장부에 적었어요` : what === 'reject' ? '반려했어요 · 요청한 분께 알려 드려요' : '요청을 거뒀어요');
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
      setReject(null);
      setReason('');
    }
  };

  const openEdit = (q: PayRequest) => { setEdit(q); setECat(q.categoryId); setEEvent(q.eventId); setEMemo(q.memo ?? ''); };
  const saveEdit = async () => {
    if (!group || !edit) return;
    try {
      await cm.updateRequest(group.id, edit.id, { categoryId: eCat, eventId: eEvent, memo: eMemo.trim() || null });
      say('고쳤어요');
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setEdit(null);
    }
  };

  const counts = data?.counts;

  return (
    <View style={{ flex: 1 }}>
      <Head title="지급 요청" onClose={back} right={group ? <Chip label={group.name} /> : null} />
      <Tabs items={[
        { id: 'pending', label: `대기${counts ? ' ' + counts.pending : ''}` },
        { id: 'paid', label: `지급완료${counts ? ' ' + counts.paid : ''}` },
        { id: 'rejected', label: `반려${counts ? ' ' + counts.rejected : ''}` },
      ]} value={status} onChange={setStatus} />
      {!data ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
          <View style={{ height: 4 }} />
          {data.items.length === 0 ? (
            <Card><Empty mood={status === 'pending' ? 'coffee' : 'calm'} title={status === 'pending' ? '기다리는 요청이 없어요' : '아직 없어요'}
              sub={manager ? undefined : '모임 돈을 먼저 썼다면 가운데 카메라로 영수증을 찍어 요청해 주세요'} /></Card>
          ) : data.items.map((q) => (
            <Card key={q.id} style={{ gap: S.sm }}>
              <View style={[k.row, { justifyContent: 'space-between' }]}>
                <Txt bold>{q.requester ?? ''}{q.mine && manager ? ' (나)' : ''}</Txt>
                <Txt size="small" tone="sub">{dayLabel(q.occurredAt)}</Txt>
              </View>
              <Big value={q.amount} size={26} />
              {catName(q.categoryId) || evName(q.eventId) ? (
                <View style={[k.row, k.wrap, { gap: 5 }]}>
                  {evName(q.eventId) ? <Chip label={evName(q.eventId)!} tone="tint" /> : null}
                  {catName(q.categoryId) ? <Chip label={catName(q.categoryId)!} /> : null}
                </View>
              ) : null}
              {q.merchant || q.memo ? <Txt size="small" tone="sub">{[q.merchant, q.memo].filter(Boolean).join(' · ')}</Txt> : null}
              <View style={[k.row, k.wrap, { gap: 5 }]}>
                {q.receiptId ? <Chip label="영수증 보기" onPress={() => open({ kind: 'receipt', id: q.receiptId! })} /> : null}
                {manager && q.status === 'pending' ? <Chip label="항목·행사 고치기" onPress={() => openEdit(q)} /> : null}
                {manager && q.bankCopy ? (
                  <Chip label={`${q.bank ?? ''} 복사`} onPress={() => { void copy(q.bankCopy!).then(() => say('계좌번호를 복사했어요 · 은행 앱에 붙여 보내 주세요')); }} />
                ) : q.bank ? <Chip label={q.bank} /> : null}
              </View>
              {q.status === 'rejected' && q.rejectReason ? <Txt size="small" tone="warn">반려 · {q.rejectReason}</Txt> : null}
              {q.status === 'paid' && q.decidedBy ? <Txt size="tiny" tone="dim">{q.decidedBy} 님이 지급완료로 표시했어요</Txt> : null}
              {q.status === 'pending' && manager ? (
                <View style={[k.row, { gap: 7, marginTop: 2 }]}>
                  <Btn label="반려" tone="ghost" small style={{ width: 84 }} onPress={() => setReject(q)} />
                  <Btn label="지급완료" small style={k.grow} loading={busy === q.id} onPress={() => { void act(q, 'pay'); }} />
                </View>
              ) : null}
              {q.status === 'pending' && !manager && q.mine ? (
                <Btn label="요청 거두기" tone="ghost" small onPress={() => { void act(q, 'cancel'); }} />
              ) : null}
            </Card>
          ))}
          {manager && status === 'pending' && data.items.length > 0 ? (
            <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>송금은 은행 앱에서 해 주세요. 여기서는 지급 여부만 남겨요.</Txt>
          ) : null}
        </Body>
      )}

      <Ask open={!!reject} title="반려할까요?" mood="thinking" onClose={() => setReject(null)}
        body={reject ? `${reject.requester ?? ''} · ${won(reject.amount)}원 — 사유를 적으면 요청한 분이 봐요` : ''}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setReject(null) }, { label: '반려', tone: 'danger', onPress: () => { if (reject) void act(reject, 'reject'); } }]}>
        <Field value={reason} onChangeText={setReason} placeholder="예) 영수증 금액과 달라요" maxLength={100} />
      </Ask>

      <Ask open={!!edit} title="처리 전에 고치기" onClose={() => setEdit(null)}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setEdit(null) }, { label: '저장', onPress: () => { void saveEdit(); } }]}>
        <View style={{ gap: S.sm }}>
          <Txt size="small" tone="sub" bold>항목</Txt>
          <Choices items={chipOrder((cats.data ?? []).filter((c) => !c.hidden && c.kind === 'out')).map((c) => ({ id: c.id, label: c.parentId ? '· ' + c.name : c.name }))}
            value={eCat} onChange={(id) => setECat(id === eCat ? null : id)} />
          {(evs.data ?? []).length > 0 ? (
            <>
              <Txt size="small" tone="sub" bold>행사</Txt>
              <Choices items={[...(evs.data ?? []).filter((e) => e.status === 'open' || e.id === eEvent).map((e) => ({ id: e.id, label: e.name })), { id: 0, label: '없음' }]}
                value={eEvent ?? 0} onChange={(id) => setEEvent(id === 0 ? null : id)} />
            </>
          ) : null}
          <Field value={eMemo} onChangeText={setEMemo} placeholder="내용" maxLength={200} />
        </View>
      </Ask>
    </View>
  );
}
