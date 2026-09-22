/**
 * 장부 — 월별(시안 4) · 연간(시안 5) · 행사별(시안 6 의 목록) · 예산(시안 7).
 *
 * 월별은 전월 이월에서 시작해 당월 이월로 끝난다. 항목을 펼치면 개별 건이 나온다.
 * 연간은 열두 달 흐름(Skia 막대)과 항목별 누계, 엑셀·결산서 PDF 내보내기.
 * 계산은 전부 서버가 한다(`ledger/month` · `ledger/year` · `budget`) — 앱은 그린다.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { barPercent, dayShort, entryTitle, kstNow, monthChip, monthWord, plusMinus, shiftMonth, signed, won } from '../cm/format';
import { isManager, type Budget, type ClubEvent, type Month, type Year } from '../cm/model';
import { reportHtml, toCsv } from '../cm/export';
import { rollup } from '../cm/rules';
import { shareCsv, sharePdf } from '../share';
import {
  Amount, Ask, Body, Btn, Card, Chip, Empty, Failed, Head, KV, Loading, Sep, Soft, Tabs, Txt, s as k,
} from '../ui/kit';
import { Gauge, YearBars } from '../ui/skia';
import { F, S, useT } from '../ui/theme';

type Sub = 'month' | 'year' | 'events' | 'budget';

export function LedgerScreen() {
  const { group } = useApp();
  const [sub, setSub] = useState<Sub>('month');
  const [ym, setYm] = useState(kstNow().ym);
  const [year, setYear] = useState(kstNow().year);
  const [exportOpen, setExportOpen] = useState(false);
  const manager = group ? isManager(group.me.role) : false;

  const periodChip = sub === 'month'
    ? <Stepper label={monthChip(ym)} onPrev={() => setYm(shiftMonth(ym, -1))} onNext={() => setYm(shiftMonth(ym, 1))} />
    : sub === 'year' || sub === 'budget'
      ? <Stepper label={`${year}년`} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} />
      : null;

  return (
    <View style={{ flex: 1 }}>
      <Head title="장부" right={(
        <View style={[k.row, { gap: 6 }]}>
          {periodChip}
          {sub === 'year' ? <Chip label="내보내기" tone="tint" onPress={() => setExportOpen(true)} /> : null}
        </View>
      )} />
      <Tabs items={[{ id: 'month', label: '월별' }, { id: 'year', label: '연간' }, { id: 'events', label: '행사별' }, { id: 'budget', label: '예산' }]}
        value={sub} onChange={setSub} />
      {sub === 'month' ? <MonthTab ym={ym} manager={manager} />
        : sub === 'year' ? <YearTab year={year} />
          : sub === 'events' ? <EventsTab manager={manager} />
            : <BudgetTab year={year} manager={manager} />}
      <ExportAsk open={exportOpen} year={year} onClose={() => setExportOpen(false)} />
    </View>
  );
}

function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const T = useT();

  return (
    <View style={[k.row, k.chip, { borderColor: T.line, backgroundColor: T.white, paddingHorizontal: 4, paddingVertical: 2, gap: 2 }]}>
      <Pressable onPress={onPrev} hitSlop={8} style={{ paddingHorizontal: 6 }}><Txt tone="sub">‹</Txt></Pressable>
      <Txt size="tiny" tone="sub" bold>{label}</Txt>
      <Pressable onPress={onNext} hitSlop={8} style={{ paddingHorizontal: 6 }}><Txt tone="sub">›</Txt></Pressable>
    </View>
  );
}

/* ── 월별 ── */

function MonthTab({ ym, manager }: { ym: string; manager: boolean }) {
  const { open } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad((gid) => cm.month(gid, ym), [ym]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const m: Month = data;
  const cats: Record<number, string> = {};
  for (const g of m.groups) if (g.categoryId && g.name) cats[g.categoryId] = g.name;

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      <Card style={{ paddingVertical: 12 }}>
        <KV label="전월 이월" value={won(m.carryIn)} />
        <Sep />
        <KV label="수입" value={signed(m.in, 'in')} tone="pos" />
        <KV label="지출" value={signed(m.out, 'out')} />
        <Sep />
        <KV label="당월 이월" value={won(m.carryOut)} strong />
      </Card>

      {m.groups.length === 0 ? (
        <Card><Empty mood="sleeping" title={`${monthWord(ym)}에는 기록이 없어요`} sub="영수증을 찍거나 직접 적으면 여기 모여요" /></Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {m.groups.map((g, i) => {
            const key = g.direction + ':' + (g.categoryId ?? '-');
            const expanded = openKey === key;

            return (
              <View key={key}>
                {i > 0 ? <Sep /> : null}
                <Pressable onPress={() => setOpenKey(expanded ? null : key)} style={[k.listrow, { gap: 8 }]}>
                  <Txt bold style={k.grow} tone={g.categoryId ? 'ink' : 'warn'}>{g.name ?? (g.direction === 'in' ? '항목 없는 수입' : '항목 없는 지출')}</Txt>
                  <Txt size="tiny" tone="sub">{g.count}건</Txt>
                  <Amount value={g.sum} direction={g.direction} />
                  <Txt tone="dim">{expanded ? '▾' : '›'}</Txt>
                </Pressable>
                {expanded ? (
                  <View style={{ backgroundColor: T.tint, marginHorizontal: -S.lg, paddingHorizontal: S.lg, paddingVertical: 6 }}>
                    {g.entries.map((e) => (
                      <Pressable key={e.id} disabled={!manager} onPress={() => open({ kind: 'entry', entry: e })}
                        style={[k.row, { justifyContent: 'space-between', paddingVertical: 7, gap: 8 }]}>
                        <Txt size="small" tone="sub" numberOfLines={1} style={k.grow}>
                          {dayShort(e.occurredAt)} {entryTitle(e, cats)}{e.edited.length ? ' · 영수증과 다름' : ''}
                        </Txt>
                        <Txt size="small" style={k.amt}>{won(e.amount)}</Txt>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}

      {manager && m.uncategorized > 0 ? (
        <Soft pill={String(m.uncategorized)} title="항목이 비어있는 기록" sub="정리하러 가기" onPress={() => open({ kind: 'tidy' })} />
      ) : null}
    </Body>
  );
}

/* ── 연간 ── */

function YearTab({ year }: { year: number }) {
  const T = useT();
  const { data, error, loading, reload } = useLoad((gid) => cm.year(gid, year), [year]);
  const cats = useLoad(cm.categories);
  const ex = useExport(year);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const y: Year = data;
  const now = kstNow();
  const current = y.year < now.year ? 12 : y.year > now.year ? 0 : Number(now.ym.slice(5));
  // 대분류로 묶어 소계, 소분류는 그 아래(기획 「항목은 두 단계다」)
  const rows = rollup(y.outCategories, cats.data ?? []);
  const max = Math.max(1, ...rows.map((c) => c.sum));

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      <Card>
        <View style={[k.row, { justifyContent: 'space-between', marginBottom: S.md }]}>
          <Stat label="연간 수입" value={signed(y.in, 'in')} pos />
          <Stat label="연간 지출" value={signed(y.out, 'out')} />
          <Stat label={y.year < now.year ? '다음 해 이월' : '현재 이월'} value={won(y.carryOut)} />
        </View>
        <YearBars values={y.months.map((m) => m.out)} peak={y.peak?.month ?? null} current={current} />
        <View style={[k.row, { justifyContent: 'space-between', marginTop: 6 }]}>
          <Txt size="tiny" tone="dim">1월</Txt>
          {y.peak ? <Txt size="tiny" tone="dim">{y.peak.month}월{y.peak.event ? ` · ${y.peak.event}` : ''}</Txt> : null}
          <Txt size="tiny" tone="dim">12월</Txt>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt size="small" tone="sub" bold>항목별 누계</Txt>
        {rows.length === 0 ? <Txt size="small" tone="dim">아직 쓴 돈이 없어요</Txt> : rows.slice(0, 10).map((c) => (
          <View key={String(c.id)} style={{ gap: 5 }}>
            <View style={[k.row, { justifyContent: 'space-between' }]}>
              <Txt bold size="small">{c.name}</Txt>
              <Txt size="small" style={k.amt}>{won(c.sum)}</Txt>
            </View>
            <Gauge percent={barPercent(c.sum, max)} />
            {c.children.map((ch) => (
              <View key={ch.id} style={[k.row, { justifyContent: 'space-between', paddingLeft: S.md }]}>
                <Txt size="tiny" tone="sub">· {ch.name}</Txt>
                <Txt size="tiny" tone="sub" style={k.amt}>{won(ch.sum)}</Txt>
              </View>
            ))}
          </View>
        ))}
      </Card>

      <View style={[k.row, { gap: S.sm }]}>
        <Btn label="엑셀" tone="ghost" small style={k.grow} disabled={ex.busy} onPress={() => { void ex.run('csv'); }} />
        <Btn label="결산서 PDF" small style={k.grow} loading={ex.busy} onPress={() => { void ex.run('pdf'); }} />
      </View>
    </Body>
  );
}

function Stat({ label, value, pos }: { label: string; value: string; pos?: boolean }) {
  const T = useT();

  return (
    <View style={{ gap: 2 }}>
      <Txt size="tiny" tone="sub">{label}</Txt>
      <Txt bold size="head" style={[k.num, { fontSize: F.head, color: pos ? T.pos : T.ink }]}>{value}</Txt>
    </View>
  );
}

/** 내보내기 — 엑셀(CSV) · 결산서 PDF. 그해 줄 전부를 받아 기기에서 만든다 */
function useExport(year: number) {
  const { group, fail } = useApp();
  const [busy, setBusy] = useState(false);

  const run = async (what: 'csv' | 'pdf'): Promise<boolean> => {
    if (!group || busy) return false;
    setBusy(true);
    try {
      const d = await cm.exportYear(group.id, year);
      if (what === 'csv') await shareCsv(`${d.group}_${year}_장부.csv`, toCsv(d));
      else await sharePdf(reportHtml(d, kstNow().ymd.replace(/-/g, '.')), `${d.group} ${year}년 결산서`);

      return true;
    } catch (e) {
      fail(e);

      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}

function ExportAsk({ open, year, onClose }: { open: boolean; year: number; onClose: () => void }) {
  const { busy, run } = useExport(year);
  const go = (what: 'csv' | 'pdf') => { void run(what).then((ok) => { if (ok) onClose(); }); };

  return (
    <Ask open={open} title={`${year}년 장부 내보내기`} body="엑셀은 모든 기록을 한 줄씩, 결산서는 총회에 낼 한 장이에요." mood="stack" onClose={onClose}
      buttons={[
        { label: busy ? '만드는 중…' : '엑셀', tone: 'ghost', onPress: () => go('csv') },
        { label: busy ? '만드는 중…' : '결산서 PDF', onPress: () => go('pdf') },
      ]} />
  );
}

/* ── 행사별 ── */

export function EventsTab({ manager }: { manager: boolean }) {
  const { open } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad(cm.events);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const list: ClubEvent[] = data;

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      {list.length === 0 ? (
        <Card><Empty mood="celebrate" title="행사가 아직 없어요" sub="체육대회·수련회처럼 따로 셈할 일을 만들면 행사별로 수지가 나와요" /></Card>
      ) : list.map((e) => (
        <Card key={e.id} onPress={() => open({ kind: 'event', id: e.id })} style={{ gap: 10 }}>
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt bold size="head" style={k.grow} numberOfLines={1}>{e.name}</Txt>
            <Chip label={`${e.startsOn ? dayShort(e.startsOn) + ' · ' : ''}${e.status === 'open' ? '진행중' : '마감'}`} tone={e.status === 'open' ? 'tint' : 'plain'} />
          </View>
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt size="small" tone="sub">수입 {won(e.in)} · 지출 {won(e.out)}</Txt>
            <Txt bold style={[k.amt, { color: e.balance >= 0 ? T.pos : T.ink }]}>{plusMinus(e.balance)}</Txt>
          </View>
          {e.budget > 0 ? <Gauge percent={e.budgetPercent} /> : null}
        </Card>
      ))}
      {manager ? <Btn label="+ 행사 만들기" tone="ghost" onPress={() => open({ kind: 'eventNew' })} /> : null}
    </Body>
  );
}

/* ── 예산 ── */

function BudgetTab({ year, manager }: { year: number; manager: boolean }) {
  const { open } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad((gid) => cm.budget(gid, year), [year]);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const b: Budget = data;

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      <Card>
        <View style={[k.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
          <Txt size="small" tone="sub" bold>{year}년 전체</Txt>
          <Txt size="small" tone="sub">{won(b.spent)} / {won(b.total)}</Txt>
        </View>
        <Gauge percent={b.percent} height={10} />
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        {b.lines.map((l, i) => {
          const pct = l.amount > 0 ? Math.floor((l.spent * 100) / l.amount) : 0;

          return (
            <View key={l.categoryId}>
              {i > 0 ? <Sep /> : null}
              <Pressable disabled={!manager} onPress={() => open({ kind: 'budgetLine', line: l, year })} style={{ paddingVertical: 12, gap: 7 }}>
                <View style={[k.row, { justifyContent: 'space-between' }]}>
                  <Txt bold>{l.parentId ? `· ${l.name}` : l.name}</Txt>
                  <Txt size="small" style={{ color: pct > 100 ? T.warn : T.sub, fontWeight: pct > 100 ? '800' : '400' }}>
                    {l.amount > 0 ? `${pct}%` : manager ? '예산 적기 ›' : '예산 없음'}
                  </Txt>
                </View>
                <Gauge percent={l.amount > 0 ? pct : 0} warn={pct > 100} />
                <View style={[k.row, { justifyContent: 'space-between' }]}>
                  <Txt size="tiny" tone="sub">집행 {won(l.spent)}{l.amount > 0 ? ` · 남음 ${won(l.amount - l.spent)}` : ''}</Txt>
                  <Txt size="tiny" tone="sub">예산 {won(l.amount)}</Txt>
                </View>
                {l.lastYear > 0 ? <Txt size="tiny" tone="dim">작년 {won(l.lastYear)}{l.lastYearImported ? ' · 가져온 값' : ''}</Txt> : null}
                {l.basis ? <Txt size="tiny" tone="dim" numberOfLines={2}>근거 · {l.basis}</Txt> : null}
              </Pressable>
            </View>
          );
        })}
      </Card>
      {manager ? <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>줄을 누르면 예산과 산출 근거를 적어요. 근거 메모는 다음 해의 재료가 돼요.</Txt> : null}
    </Body>
  );
}
