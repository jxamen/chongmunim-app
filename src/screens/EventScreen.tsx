/**
 * 행사별 장부(시안 6) — 행사는 이월이 없고 **수입 − 지출 = 수지**로 끝난다.
 *
 * 행사는 장부 줄에 붙는 꼬리표다(돈이 따로 있는 것이 아니다). 기록할 때 진행 중인 행사를 고르면 여기 모인다.
 * 정산서는 카톡 단체방에 붙이기 좋은 글로 공유한다(`eventShareText`).
 */
import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { amountInput, dayShort, entrySub, entryTitle, kstNow, plusMinus, readAmount, signed, won } from '../cm/format';
import { isManager, type EventDetail } from '../cm/model';
import { eventShareText } from '../cm/export';
import { shareText } from '../share';
import { Ask, Body, Btn, Card, Chip, Empty, Failed, Field, Head, KV, LedgerRow, Loading, Sep, Txt, s as k } from '../ui/kit';
import { Gauge } from '../ui/skia';
import { Mascot } from '../ui/Mascot';
import { F, S, useT } from '../ui/theme';

export function EventScreen({ id }: { id: number }) {
  const { group, back, bump, say, fail, open } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad((gid) => cm.event(gid, id), [id]);
  const cats = useLoad(cm.categories);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budget, setBudget] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const manager = group ? isManager(group.me.role) : false;

  if (!data) {
    return <View style={{ flex: 1 }}><Head title="행사" onClose={back} />{error ? <Failed text={error} onRetry={reload} /> : <Loading />}</View>;
  }
  const d: EventDetail = data;
  const ev = d.event;
  const names: Record<number, string> = {};
  for (const c of cats.data ?? []) names[c.id] = c.name;

  const update = async (b: { budget?: number; status?: 'open' | 'closed' }) => {
    if (!group) return;
    try {
      await cm.updateEvent(group.id, id, b);
      say(b.status === 'closed' ? '행사를 마감했어요' : b.status === 'open' ? '행사를 다시 열었어요' : '행사 예산을 바꿨어요');
      bump();
    } catch (e) {
      fail(e);
    }
  };

  const share = async () => {
    const r = await shareText(eventShareText(d, names, group?.name ?? ''));
    if (r === 'copied') say('정산서를 복사했어요 · 단체방에 붙여 주세요');
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title={ev.name} onClose={back}
        right={<Chip label={`${ev.startsOn ? dayShort(ev.startsOn) + ' · ' : ''}${ev.status === 'open' ? '진행중' : '마감'}`} tone={ev.status === 'open' ? 'tint' : 'plain'} />} />
      <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
        <View style={{ height: 2 }} />
        <Card>
          <View style={[k.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ gap: 4 }}>
              <Txt size="small" tone="sub">현재 수지</Txt>
              <Txt style={[k.num, { fontSize: 30, color: ev.balance >= 0 ? T.ink : T.danger }]}>{plusMinus(ev.balance)}</Txt>
            </View>
            <Mascot mood="celebrate" size={60} style={{ marginTop: -4 }} />
          </View>
          <Sep style={{ marginVertical: S.md }} />
          {d.incomes.map((i) => <KV key={String(i.categoryId)} label={`${i.name ?? '수입'} ${i.count}건`} value={signed(i.sum, 'in')} tone="pos" />)}
          <KV label="지출" value={signed(ev.out, 'out')} />
        </Card>

        <Card onPress={manager ? () => { setBudget(ev.budget ? won(ev.budget) : ''); setBudgetOpen(true); } : undefined}>
          <View style={[k.row, { justifyContent: 'space-between', marginBottom: 9 }]}>
            <Txt size="small" tone="sub" bold>{ev.budget > 0 ? `행사 예산 ${won(ev.budget)}원` : manager ? '행사 예산 적기 ›' : '행사 예산 없음'}</Txt>
            {ev.budget > 0 ? <Txt size="small" tone="sub">{ev.budgetPercent}%</Txt> : null}
          </View>
          <Gauge percent={ev.budgetPercent} />
        </Card>

        <Card style={{ paddingVertical: 2 }}>
          {d.entries.length === 0 ? <Empty mood="thinking" title="아직 행사 기록이 없어요" sub="기록할 때 행사 칸에서 이 행사를 고르면 여기 모여요" />
            : d.entries.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Sep /> : null}
                <LedgerRow title={entryTitle(e, names)} sub={entrySub(e, names).replace(/^(\d+)월 (\d+)일/, '$1/$2')} value={e.amount} direction={e.direction}
                  badge={e.edited.length ? '영수증과 다름' : undefined} onPress={manager ? () => open({ kind: 'entry', entry: e }) : undefined} />
              </View>
            ))}
        </Card>

        <View style={[k.row, { gap: S.sm }]}>
          {manager ? <Btn label={ev.status === 'open' ? '행사 마감' : '다시 열기'} tone="ghost" small style={k.grow}
            onPress={() => { if (ev.status === 'open') setCloseOpen(true); else void update({ status: 'open' }); }} /> : null}
          <Btn label="정산서 공유" small style={k.grow} onPress={() => { void share(); }} />
        </View>
      </Body>

      <Ask open={budgetOpen} title="행사 예산" onClose={() => setBudgetOpen(false)}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setBudgetOpen(false) },
          { label: '저장', onPress: () => { setBudgetOpen(false); void update({ budget: readAmount(budget) ?? 0 }); } }]}>
        <Field value={budget} onChangeText={(v) => setBudget(amountInput(v))} keyboardType="number-pad" placeholder="600,000" right={<Txt tone="sub">원</Txt>} autoFocus />
      </Ask>
      <Ask open={closeOpen} title="행사를 마감할까요?" mood="cheer" onClose={() => setCloseOpen(false)}
        body="마감하면 기록할 때 행사 칸에 더는 나오지 않아요. 수지는 그대로 남고, 다시 열 수 있어요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setCloseOpen(false) },
          { label: '마감', onPress: () => { setCloseOpen(false); void update({ status: 'closed' }); } }]} />
    </View>
  );
}

/** 행사 만들기 — 이름 · 날짜 · 예산 */
export function EventNewScreen() {
  const { group, back, open, bump, fail } = useApp();
  const [name, setName] = useState('');
  const [date, setDate] = useState(kstNow().ymd);
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (!group) return;
    setBusy(true);
    try {
      const ymd = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
      const d = await cm.addEvent(group.id, { name: name.trim(), startsOn: ymd(date), endsOn: ymd(endDate), budget: readAmount(budget) ?? 0 });
      bump();
      back();
      open({ kind: 'event', id: d.event.id });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="행사 만들기" onClose={back} />
      <Body>
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <Mascot mood="celebrate" size={80} />
          <Txt size="small" tone="sub" style={{ textAlign: 'center' }}>행사를 만들면 기록할 때 행사 칸이 생겨요.{'\n'}참가비·찬조·지출이 행사별로 따로 셈해져요.</Txt>
        </Card>
        <Field label="행사 이름" value={name} onChangeText={setName} placeholder="예) 가을 체육대회" maxLength={40} />
        <View style={[k.row, { gap: S.sm }]}>
          <Field label="시작" style={k.grow} value={date} onChangeText={setDate} placeholder="2026-10-10" maxLength={10} inputStyle={{ fontSize: F.body }} />
          <Field label="끝(선택)" style={k.grow} value={endDate} onChangeText={setEndDate} placeholder="2026-10-12" maxLength={10} inputStyle={{ fontSize: F.body }} />
        </View>
        <Txt size="tiny" tone="dim">기간 안에 찍힌 영수증에는 이 행사를 먼저 골라 둬요.</Txt>
        <Field label="행사 예산(없으면 비워 두세요)" value={budget} onChangeText={(v) => setBudget(amountInput(v))} keyboardType="number-pad"
          placeholder="600,000" right={<Txt tone="sub">원</Txt>} />
        <Btn label="만들기" loading={busy} disabled={!name.trim()} onPress={() => { void make(); }} />
      </Body>
    </View>
  );
}
