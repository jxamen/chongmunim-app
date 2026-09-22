/**
 * 마감 — 월별 · 연간 · 행사별 결산을 굳혀 회원에게 보내고, 알림을 누르면 여기서 본다(2026-09-22 태훈님).
 *
 *  CloseBar     장부 월별 · 연간, 행사 화면 아래 — 「마감하고 알리기」 / 마감됨 · 결산 보기 · 마감 풀기
 *  ClosingScreen 결산 한 장 — 서버가 마감한 순간의 숫자(snapshot)를 그대로 그린다(그 뒤 기록과 무관)
 *
 * 마감한 기간은 잠긴다(태훈님 결정) — 그 달 · 그해 · 그 행사의 기록은 서버가 `period_closed` 로 막는다. 고치려면 풀고,
 * 다시 마감하면 고친 결산이 새로 간다. 구독 기능(풀기는 늘 된다).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { signed, won } from '../cm/format';
import { isManager, type Closing } from '../cm/model';
import { isPro } from '../cm/plan';
import { Ask, Body, Btn, Card, Failed, Head, KV, Loading, MenuRow, Sep, Soft, Toggle, Txt, s as k } from '../ui/kit';
import { S } from '../ui/theme';

/** 날짜 — 서버 UTC 「2026-09-30 11:00:00」 → 「9월 30일」 */
const closedDay = (at: string | null): string => {
  if (!at) return '';
  const d = new Date(at.includes('T') ? at : at.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const kst = new Date(d.getTime() + 9 * 3600_000);

  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
};

export function CloseBar({ kind, refKey, label }: { kind: Closing['kind']; refKey: string; label: string }) {
  const { group, open, say, fail, bump, showPlan, version } = useApp();
  const list = useLoad(cm.closings, [version]);
  const [ask, setAsk] = useState<null | 'close' | 'reopen'>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!group) return null;
  const manager = isManager(group.me.role);
  const active = (list.data ?? []).find((c) => c.kind === kind && c.ref === refKey) ?? null;
  if (!active && !manager) return null;

  const close = async () => {
    setBusy(true);
    try {
      const c = await cm.closeNow(group.id, { kind, ref: refKey, notify });
      say(notify ? `${c.title}을 회원들에게 보냈어요 · 이제 잠겼어요` : `${label}을 마감했어요 · 이제 잠겼어요`);
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };
  const reopen = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await cm.reopenClosing(group.id, active.id);
      say(`${label} 마감을 풀었어요 · 고친 뒤 다시 마감하면 결산이 새로 가요`);
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  return (
    <>
      {active ? (
        <Soft tone="tint" title={`🔒 ${label} 마감 · ${closedDay(active.closedAt)}`} sub="마감한 기간의 기록은 고칠 수 없어요 · 누르면 결산 보기"
          onPress={() => open({ kind: 'closing', id: active.id })} />
      ) : null}
      {manager ? (
        active
          ? <Btn label="마감 풀기" tone="ghost" small onPress={() => setAsk('reopen')} />
          : <Btn label={`${label} 마감하고 알리기`} tone="ghost" onPress={() => { if (!isPro(group)) showPlan('general'); else setAsk('close'); }} />
      ) : null}

      <Ask open={ask === 'close'} title={`${label}을 마감할까요?`} mood="calculator" onClose={() => setAsk(null)}
        body={'지금 숫자로 결산 한 장을 만들어요. 마감한 기간의 기록은 고치거나 지울 수 없어요(풀면 다시 고칠 수 있어요).'}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAsk(null) },
          { label: busy ? '마감하는 중…' : notify ? '마감하고 알리기' : '마감하기', onPress: () => { void close(); } }]}>
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow label="회원들에게 결산 보내기" right={<Toggle on={notify} onChange={setNotify} />} />
          <Txt size="tiny" tone="dim" style={{ paddingBottom: 10 }}>
            {notify ? '공지로 남고 알림이 가요. 알림을 누르면 결산이 열려요. 잠금 화면엔 금액이 안 나와요.' : '알리지 않고 잠그기만 해요.'}
          </Txt>
        </Card>
      </Ask>
      <Ask open={ask === 'reopen'} title={`${label} 마감을 풀까요?`} mood="thinking" onClose={() => setAsk(null)}
        body="풀면 다시 고칠 수 있어요. 이미 보낸 결산은 그대로 남아요 — 고친 뒤 다시 마감하면 새 결산이 가요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAsk(null) }, { label: busy ? '푸는 중…' : '마감 풀기', onPress: () => { void reopen(); } }]} />
    </>
  );
}

/** 결산 한 장 — 굳힌 숫자 */
export function ClosingScreen({ id }: { id: number }) {
  const { back } = useApp();
  const { data, error, reload } = useLoad((gid) => cm.closing(gid, id), [id]);

  return (
    <View style={{ flex: 1 }}>
      <Head title={data?.title ?? '결산'} onClose={back} />
      {!data ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          <View style={{ height: 2 }} />
          <Txt size="tiny" tone="dim">{`${closedDay(data.closedAt)} 마감 · 그때 숫자로 굳힌 결산이에요${data.reopenedAt ? ' · 지금은 마감을 풀었어요' : ''}`}</Txt>
          <Report c={data} />
        </Body>
      )}
    </View>
  );
}

type Row = { name?: string | null; direction?: string; count?: number; sum?: number; categoryId?: number | null };
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

function Report({ c }: { c: Closing }) {
  const s = (c.snapshot ?? {}) as Record<string, unknown>;

  if (c.kind === 'event') {
    const ev = (s.event ?? {}) as Record<string, unknown>;
    const incomes = (Array.isArray(s.incomes) ? s.incomes : []) as Row[];
    const entries = (Array.isArray(s.entries) ? s.entries : []) as { direction?: string; amount?: number }[];

    return (
      <>
        <Card style={{ paddingVertical: 12 }}>
          {incomes.map((i, n) => <KV key={n} label={`${i.name ?? '수입'} ${num(i.count)}건`} value={signed(num(i.sum), 'in')} tone="pos" />)}
          <KV label="지출" value={signed(num(ev.out), 'out')} />
          <Sep />
          <KV label="행사 수지" value={won(num(ev.in) - num(ev.out))} strong />
          {num(ev.budget) > 0 ? <KV label="행사 예산" value={`${won(num(ev.budget))} · ${num(ev.budgetPercent)}% 씀`} /> : null}
        </Card>
        <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>{`기록 ${entries.length}건 · 들어온 돈 ${won(num(ev.in))}원 · 나간 돈 ${won(num(ev.out))}원`}</Txt>
      </>
    );
  }

  const summary = (
    <Card style={{ paddingVertical: 12 }}>
      <KV label={c.kind === 'year' ? '작년에서 넘어온 돈' : '전월 이월'} value={won(num(s.carryIn))} />
      <Sep />
      <KV label="수입" value={signed(num(s.in), 'in')} tone="pos" />
      <KV label="지출" value={signed(num(s.out), 'out')} />
      <Sep />
      <KV label={c.kind === 'year' ? '다음 해로 넘길 돈' : '당월 이월'} value={won(num(s.carryOut))} strong />
    </Card>
  );

  if (c.kind === 'month') {
    const groups = (Array.isArray(s.groups) ? s.groups : []) as Row[];

    return (
      <>
        {summary}
        <Card style={{ paddingVertical: 4 }}>
          {groups.length === 0 ? <Txt tone="dim" style={{ paddingVertical: S.md }}>기록이 없는 달이에요</Txt> : groups.map((g, n) => (
            <View key={n}>
              {n > 0 ? <Sep /> : null}
              <View style={[k.listrow, { gap: 8 }]}>
                <Txt bold style={k.grow}>{g.name ?? (g.direction === 'in' ? '항목 없는 수입' : '항목 없는 지출')}</Txt>
                <Txt size="tiny" tone="sub">{num(g.count)}건</Txt>
                <Txt bold tone={g.direction === 'in' ? 'pos' : 'ink'}>{signed(num(g.sum), g.direction === 'in' ? 'in' : 'out')}</Txt>
              </View>
            </View>
          ))}
        </Card>
      </>
    );
  }

  const months = (Array.isArray(s.months) ? s.months : []) as { month?: number; in?: number; out?: number }[];
  const outs = (Array.isArray(s.outCategories) ? s.outCategories : []) as Row[];

  return (
    <>
      {summary}
      <Card style={{ gap: 4 }}>
        <Txt size="small" tone="sub" bold>달마다</Txt>
        {months.filter((m) => num(m.in) || num(m.out)).map((m) => (
          <View key={num(m.month)} style={[k.row, { gap: 8 }]}>
            <Txt size="small" style={{ width: 40 }}>{num(m.month)}월</Txt>
            <Txt size="small" tone="pos" style={[k.grow, k.amt]}>{signed(num(m.in), 'in')}</Txt>
            <Txt size="small" style={[k.grow, k.amt]}>{signed(num(m.out), 'out')}</Txt>
          </View>
        ))}
      </Card>
      {outs.length ? (
        <Card style={{ gap: 4 }}>
          <Txt size="small" tone="sub" bold>지출 항목별</Txt>
          {outs.map((o, n) => <KV key={n} label={o.name ?? '항목 없음'} value={won(num(o.sum))} />)}
        </Card>
      ) : null}
    </>
  );
}
