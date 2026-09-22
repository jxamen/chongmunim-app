/**
 * 정리 모드(시안 10) — 쌓아둔 걸 한 화면에서 일괄로. 월말과 연말에 총무가 앉는 자리.
 *
 *  - 항목이 비어있는 기록 — 서버가 **같은 상호끼리 묶어** 준다(띄어쓰기만 다른 상호도 한 묶음). 묶음마다 항목 하나를 고른다
 *  - 행사 확인 — 진행 중인 행사가 있을 때 행사 없이 기록된 지출. 행사를 붙이거나 「행사 아님」으로 확인
 *  - 통장 잔고와 맞추기 — 통장에 찍힌 잔고를 적으면 장부 잔액과 차이를 보여 주고 기록으로 남긴다
 *
 * 고른 것은 모아 두었다가 「N건 정리 끝내기」에서 한 번에 보낸다(`entries/bulk` · `reconcile`).
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { amountInput, dayShort, kstNow, monthWord, plusMinus, readAmount, shiftMonth, won } from '../cm/format';
import type { Tidy } from '../cm/model';
import { Ask, Body, Btn, Card, Chip, Choices, Failed, Field, Head, Loading, Sep, Soft, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { S, useT } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

export function TidyScreen() {
  const { group, back, bump, say, fail, open } = useApp();
  const T = useT();
  const kb = useKeyboardPad();
  const [ym, setYm] = useState(kstNow().ym);
  const { data, error, reload } = useLoad((gid) => cm.tidy(gid, ym), [ym]);
  const cats = useLoad(cm.categories);
  const [catPick, setCatPick] = useState<Record<number, number>>({});       // 묶음 번호 → 항목
  const [evPick, setEvPick] = useState<Record<number, number | 'none'>>({}); // 장부 줄 → 행사 · 행사 아님
  const [picking, setPicking] = useState<number | null>(null);
  const [bank, setBank] = useState('');
  const [busy, setBusy] = useState(false);

  if (!data) {
    return <View style={{ flex: 1 }}><Head title="정리하기" onClose={back} />{error ? <Failed text={error} onRetry={reload} /> : <Loading />}</View>;
  }
  const t: Tidy = data;
  const catName = (id: number) => cats.data?.find((c) => c.id === id)?.name ?? '';
  const bankValue = bank.trim() === '' ? null : (bank.trim().startsWith('-') ? -1 : 1) * (readAmount(bank) ?? 0);
  const diff = bankValue === null ? null : bankValue - t.reconcile.book;
  const evCount = t.eventCheck.entries.length;
  const blankCount = t.uncategorized.count;
  const chosen = Object.keys(catPick).reduce((n, i) => n + (t.uncategorized.groups[Number(i)]?.count ?? 0), 0)
    + Object.keys(evPick).length + (bankValue !== null ? 1 : 0);

  const finish = async () => {
    if (!group) return;
    setBusy(true);
    try {
      for (const [i, catId] of Object.entries(catPick)) {
        const g = t.uncategorized.groups[Number(i)];
        if (g) await cm.bulkEntries(group.id, g.ids, { categoryId: catId });
      }
      const byEvent = new Map<number | 'none', number[]>();
      for (const [id, v] of Object.entries(evPick)) byEvent.set(v, [...(byEvent.get(v) ?? []), Number(id)]);
      for (const [v, ids] of byEvent) await cm.bulkEntries(group.id, ids, v === 'none' ? { eventChecked: true } : { eventId: v });
      if (bankValue !== null) await cm.reconcile(group.id, bankValue, ym);
      say(`${chosen}건 정리했어요`);
      setCatPick({});
      setEvPick({});
      setBank('');
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const pickGroup = picking === null ? null : t.uncategorized.groups[picking];

  return (
    <View style={{ flex: 1 }}>
      <Head title="정리하기" onClose={back} right={(
        <View style={[k.row, k.chip, { borderColor: T.line, backgroundColor: T.white, paddingHorizontal: 4, paddingVertical: 2, gap: 2 }]}>
          <Pressable onPress={() => setYm(shiftMonth(ym, -1))} hitSlop={8} style={{ paddingHorizontal: 6 }}><Txt tone="sub">‹</Txt></Pressable>
          <Txt size="tiny" tone="sub" bold>{monthWord(ym)}</Txt>
          <Pressable onPress={() => setYm(shiftMonth(ym, 1))} hitSlop={8} style={{ paddingHorizontal: 6 }}><Txt tone="sub">›</Txt></Pressable>
        </View>
      )} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        <View style={{ height: 2 }} />
        <Card style={[k.row, { gap: 10 }]}>
          <Mascot mood={t.total === 0 ? 'cool' : 'stack'} size={50} />
          <View style={k.grow}>
            <Txt bold size="head">{t.total === 0 ? '정리할 게 없어요' : `정리할 게 ${t.total}건 있어요`}</Txt>
            <Txt size="tiny" tone="sub">항목 {blankCount} · 행사 {evCount} · 통장 대사 {t.reconcile.done ? 0 : 1}</Txt>
          </View>
        </Card>

        {blankCount > 0 ? (
          <Card style={{ gap: 9 }}>
            <View style={[k.row, { justifyContent: 'space-between' }]}>
              <Txt size="small" tone="sub" bold>항목이 비어있음 {blankCount}건</Txt>
              <Chip label="같은 상호 묶기" tone="tint" />
            </View>
            <Sep />
            {t.uncategorized.groups.map((g, i) => (
              <View key={i} style={[k.row, { gap: 8, justifyContent: 'space-between' }]}>
                <View style={k.grow}>
                  <Txt bold numberOfLines={1}>{g.merchant ?? (g.direction === 'in' ? '이름 없는 수입' : '상호 없음')} · {g.count}건</Txt>
                  <Txt size="tiny" tone="sub">{g.count > 1 ? '합계 ' : ''}{won(g.sum)}원</Txt>
                </View>
                <Chip label={catPick[i] ? catName(catPick[i]) : '고르기'} tone={catPick[i] ? 'on' : 'plain'} onPress={() => setPicking(i)} />
              </View>
            ))}
          </Card>
        ) : null}

        {evCount > 0 ? (
          <Card style={{ gap: 9 }}>
            <Txt size="small" tone="sub" bold>행사 확인 {evCount}건 · 진행 중: {t.eventCheck.events.map((e) => e.name).join(', ')}</Txt>
            <Sep />
            {t.eventCheck.entries.map((e) => (
              <View key={e.id} style={{ gap: 6 }}>
                <View style={[k.row, { justifyContent: 'space-between' }]}>
                  <Txt size="small" numberOfLines={1} style={k.grow}>{dayShort(e.occurredAt)} {e.merchant ?? e.memo ?? '지출'}</Txt>
                  <Txt size="small" bold style={k.amt}>{won(e.amount)}</Txt>
                </View>
                <Choices items={[...t.eventCheck.events.map((v) => ({ id: v.id as number | 'none', label: v.name })), { id: 'none' as const, label: '행사 아님' }]}
                  value={evPick[e.id] ?? null} onChange={(v) => setEvPick((p) => ({ ...p, [e.id]: v }))} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: 9 }}>
          <Txt size="small" tone="sub" bold>통장 잔고와 맞추기</Txt>
          <Field value={bank} onChangeText={(v) => setBank((v.trim().startsWith('-') ? '-' : '') + amountInput(v))} keyboardType="numbers-and-punctuation"
            placeholder="통장에 찍힌 잔고" inputStyle={{ fontSize: 19 }} right={<Txt tone="sub">원</Txt>} />
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt size="small" tone="sub">장부상 잔액</Txt>
            <Txt size="small" bold style={k.amt}>{won(t.reconcile.book)}</Txt>
          </View>
          {diff !== null ? (
            <View style={[k.row, { gap: 6 }]}>
              <Chip label={diff === 0 ? '일치' : '차이 있음'} tone={diff === 0 ? 'tint' : 'warn'} />
              <Txt size="tiny" tone="sub">{diff === 0 ? '차이 없음' : `${plusMinus(diff)}원 — 빠진 기록이 없는지 봐 주세요`}</Txt>
            </View>
          ) : t.reconcile.last ? (
            <Txt size="tiny" tone="dim">지난번({t.reconcile.last.period}) 차이 {plusMinus(t.reconcile.last.diff)}원</Txt>
          ) : null}
        </Card>

        <Soft title="비슷한 항목 합치기" sub="「간식」·「간식비」처럼 따로 생긴 항목을 하나로 묶어요" onPress={() => open({ kind: 'categories' })} />

        <Btn label={chosen > 0 ? `${chosen}건 정리 끝내기` : '정리 끝내기'} loading={busy} disabled={chosen === 0} onPress={() => { void finish(); }} />
      </Body>

      <Ask open={pickGroup !== null} title={pickGroup ? `${pickGroup.merchant ?? '상호 없음'} · ${pickGroup.count}건` : ''} onClose={() => setPicking(null)}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setPicking(null) }]}>
        <Choices items={(cats.data ?? []).filter((c) => !c.hidden && c.kind === (pickGroup?.direction ?? 'out')).map((c) => ({ id: c.id, label: c.name }))}
          value={picking !== null ? catPick[picking] ?? null : null}
          onChange={(id) => { if (picking !== null) setCatPick((p) => ({ ...p, [picking]: id })); setPicking(null); }} />
      </Ask>
    </View>
  );
}
