/**
 * 쓰던 장부 파일 가져오기 — 확인 표(사용자 결정 2026-09-22 「b로 해」, 기획 「통째로 읽히게 하고 싶다면」).
 *
 *   읽는 중   → 맥 워커가 푸는 동안 3초마다 묻는다. **나가도 된다** — 끝나면 홈 띠로 알린다(기획 「기다리는 동안 앱이 멈춰 있으면 안 된다」)
 *   못 읽음   → 이유와 대안(붙여넣기 · 기초 잔액)을 같이(「조용히 끝내는 것도 금물」)
 *   확인 표   → 원본 합계와 맞는지, 겹친 줄·이미 있는 줄·날짜 없는 줄은 꺼 둔 채로. 원본 항목 이름 단위로 이 모임 항목에 맞추고,
 *               줄을 눌러 날짜·금액·내용을 고친다. **고른 줄만** 넣는다
 *   넣음      → 한 번에 되돌리기(지우지 않고 void — 장부 규칙 그대로)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { amountInput, readAmount, won } from '../cm/format';
import { codeOf, errorText } from '../cm/errors';
import type { Direction, ImportCheck, LedgerImport } from '../cm/model';
import {
  byMonth, created, draftsFrom, mapCategory, summary, targetOf, toCommit, toggle, update, type CategoryTarget, type Draft,
} from '../cm/importRows';
import { Amount, Ask, Body, Btn, Card, Chip, Choices, Failed, Field, Head, Loading, Sep, Soft, Tabs, Toggle, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { S, useT } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';
import { DateField } from '../ui/DateField';

/** 한 번에 그리는 줄 수 — 몇 년 치(수천 줄)도 버벅이지 않게 나눠 보인다 */
const PAGE = 150;

export function ImportScreen({ id }: { id: string }) {
  const { group, back, say, fail, bump, setTab } = useApp();
  const [imp, setImp] = useState<LedgerImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // 읽는 중이면 3초마다 다시 묻는다 — 화면을 떠나면 멈춘다
  useEffect(() => {
    if (!group) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      try {
        const x = await cm.ledgerImport(group.id, id);
        if (!alive) return;
        setImp(x);
        setError(null);
        if (x.status === 'reading') timer = setTimeout(() => { void ask(); }, 3000);
      } catch (e) {
        if (alive) setError(errorText(codeOf(e)));
      }
    };
    void ask();

    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [group, id, tick]);

  const cancel = async () => {
    if (!group) return;
    try {
      await cm.cancelImport(group.id, id);
      say('가져오기를 그만뒀어요');
      bump();
      back();
    } catch (e) {
      fail(e);
    }
  };

  const title = imp?.fileName ?? '장부 가져오기';
  if (!imp) {
    return (
      <View style={{ flex: 1 }}>
        <Head title="장부 가져오기" onClose={back} />
        {error ? <Failed text={error} onRetry={() => setTick((t) => t + 1)} /> : <Loading />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Head title="장부 가져오기" onClose={back} />
      {imp.status === 'reading' ? (
        <Body>
          <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
            <Mascot mood="search" size={96} />
            <Txt bold size="head">장부를 읽고 있어요</Txt>
            <Txt tone="sub" size="small" style={{ textAlign: 'center', lineHeight: 21 }}>
              {`「${title}」의 날짜·항목·금액을 풀고 있어요.\n보통 1~3분, 긴 장부는 더 걸려요.\n나가도 돼요 — 끝나면 홈에서 알려 드려요.`}
            </Txt>
          </Card>
          <Btn label="그만두기" tone="ghost" onPress={() => { void cancel(); }} />
        </Body>
      ) : imp.status === 'failed' ? (
        <Body>
          <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
            <Mascot mood="crying" size={90} />
            <Txt bold size="head">장부를 읽지 못했어요</Txt>
            <Txt tone="sub" size="small" style={{ textAlign: 'center', lineHeight: 21 }}>{errorText(imp.error ?? 'ocr_failed')}</Txt>
          </Card>
          <Btn label="다른 파일 올리기 · 붙여넣기로 넣기" onPress={back} />
        </Body>
      ) : imp.status === 'ready' && imp.preview ? (
        <Review imp={imp} onDone={(x) => setImp(x)} onCancel={() => { void cancel(); }} />
      ) : imp.status === 'done' ? (
        <Done imp={imp} onUndone={(x) => setImp(x)} onLedger={() => { setTab('ledger'); back(); }} />
      ) : (
        <Body>
          <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
            <Mascot mood="calm" size={84} />
            <Txt bold size="head">{imp.status === 'undone' ? '넣은 것을 되돌렸어요' : '그만둔 가져오기예요'}</Txt>
            <Txt tone="sub" size="small" style={{ textAlign: 'center' }}>
              {imp.status === 'undone' ? `가져왔던 ${imp.committed}건을 장부에서 뺐어요. 기록은 남아 있어요.` : '다시 하려면 파일을 새로 올려 주세요.'}
            </Txt>
          </Card>
          <Btn label="닫기" tone="ghost" onPress={back} />
        </Body>
      )}
    </View>
  );
}

/* ── 확인 표 ── */

function Review({ imp, onDone, onCancel }: { imp: LedgerImport; onDone: (x: LedgerImport) => void; onCancel: () => void }) {
  const { group, say, fail, bump, reloadGroup } = useApp();
  const T = useT();
  const kb = useKeyboardPad();
  const p = imp.preview!;
  const cats = useLoad((gid) => cm.categories(gid));
  const [drafts, setDrafts] = useState<Draft[]>(() => draftsFrom(p));
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // 전기이월 — 지금 기초 잔액이 비어 있으면 파일 것을 쓰는 게 기본
  const [useOpening, setUseOpening] = useState(!!p.opening && (imp.currentOpening?.amount ?? 0) === 0);

  const sum = summary(drafts);
  const made = created(drafts);
  const months = useMemo(() => byMonth(drafts), [drafts]);
  const firstDate = useMemo(() => drafts.filter((d) => d.pick && d.date).map((d) => d.date as string).sort()[0] ?? null, [drafts]);
  const openingDate = p.opening?.date ?? (firstDate ? firstDate.slice(0, 8) + '01' : null);
  const catList = (cats.data ?? []).filter((c) => !c.hidden);
  const catName = (idOr: number | null) => catList.find((c) => c.id === idOr)?.name ?? null;

  const commit = async () => {
    if (!group) return;
    setBusy(true);
    try {
      const r = await cm.commitImport(group.id, imp.id, toCommit(drafts), useOpening && p.opening ? { amount: p.opening.amount, date: openingDate } : null);
      say(`${r.committed}건을 장부에 넣었어요${r.newCategories ? ` · 새 항목 ${r.newCategories}개` : ''}${r.newEvents ? ` · 새 행사 ${r.newEvents}개` : ''}`);
      bump();
      if (useOpening) await reloadGroup();
      onDone(await cm.ledgerImport(group.id, imp.id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  let drawn = 0;

  return (
    <View style={{ flex: 1 }}>
      <Body bottom={kb > 0 ? kb + 24 : 140}>
        <View style={{ height: 2 }} />
        <Card style={{ gap: S.sm }}>
          <View style={[k.row, { gap: 10 }]}>
            <Mascot mood={p.verdict === 'confirmed' ? 'celebrate' : 'thinking'} size={52} />
            <View style={k.grow}>
              <Txt bold size="head">기록 {p.counts.rows}건을 찾았어요</Txt>
              <Txt size="tiny" tone="sub" numberOfLines={1}>{imp.fileName ?? '구글 시트'}</Txt>
            </View>
          </View>
          <Sep />
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt size="small" tone="sub">수입</Txt><Txt size="small" bold style={[k.amt, { color: T.pos }]}>{won(p.totals.in)}</Txt>
          </View>
          <View style={[k.row, { justifyContent: 'space-between' }]}>
            <Txt size="small" tone="sub">지출</Txt><Txt size="small" bold style={k.amt}>{won(p.totals.out)}</Txt>
          </View>
          {p.verdict === 'confirmed'
            ? <Chip label="원본 합계와 맞아요" tone="tint" style={{ alignSelf: 'flex-start' }} />
            : <Txt size="tiny" tone="warn">원본 합계와 다른 곳이 있어요 — 아래를 봐 주세요</Txt>}
          <Txt size="tiny" tone="dim" style={{ lineHeight: 19 }}>
            {[
              p.counts.sheetDup ? `다른 시트에 또 적힌 ${p.counts.sheetDup}건은 한 번만 셌어요` : null,
              p.counts.ledgerDup ? `이미 장부에 있는 ${p.counts.ledgerDup}건` : null,
              p.counts.noDate ? `날짜가 없는 ${p.counts.noDate}건` : null,
            ].filter(Boolean).join(' · ') + (p.counts.ledgerDup || p.counts.noDate ? '은 꺼 두었어요.' : '')}
            {p.skipped.length ? ` 합계·소계·이월 줄 ${p.skipped.length}개는 넣지 않아요.` : ''}
          </Txt>
        </Card>

        {p.checks.length ? <Soft tone="warn" title="원본과 다른 곳" sub={p.checks.map(checkText).join('\n')} /> : null}

        {p.opening ? (
          <Card style={{ gap: S.sm }}>
            <View style={[k.row, { gap: S.sm }]}>
              <View style={k.grow}>
                <Txt bold>전기이월 {won(p.opening.amount)}원</Txt>
                <Txt size="tiny" tone="sub">
                  {useOpening
                    ? `기초 잔액을 이 값으로 바꿔요${openingDate ? `(${openingDate} 기준)` : ''}. 지금은 ${won(imp.currentOpening?.amount ?? 0)}원이에요.`
                    : `기초 잔액은 지금 그대로(${won(imp.currentOpening?.amount ?? 0)}원) 둬요.`}
                </Txt>
              </View>
              <Toggle on={useOpening} onChange={setUseOpening} />
            </View>
          </Card>
        ) : null}

        {p.categories.length ? (
          <Card style={{ gap: S.md }}>
            <View>
              <Txt bold>항목 맞추기</Txt>
              <Txt size="tiny" tone="sub">원본 항목 이름마다 한 번만 고르면 그 이름의 줄이 모두 따라가요</Txt>
            </View>
            {p.categories.map((c) => (
              <CategoryMap key={c.direction + c.name} source={c.name} direction={c.direction} count={c.count}
                target={targetOf(drafts, c.direction, c.name)} options={catList.filter((x) => x.kind === c.direction).map((x) => ({ id: x.id, label: x.name }))}
                onChange={(to) => setDrafts((ds) => mapCategory(ds, c.direction, c.name, to))} />
            ))}
          </Card>
        ) : null}

        <Card style={{ paddingVertical: 2 }}>
          {months.map((m) => {
            if (drawn >= shown) return null;
            const rows = m.rows.slice(0, Math.max(0, shown - drawn));
            drawn += rows.length;

            return (
              <View key={m.key || 'none'}>
                <Txt size="tiny" tone="sub" bold style={{ paddingTop: 12, paddingBottom: 2 }}>
                  {m.key ? `${m.key.slice(0, 4)}년 ${Number(m.key.slice(5, 7))}월` : '날짜 없음 — 눌러서 날짜를 적으면 넣을 수 있어요'}
                </Txt>
                {rows.map((d) => (
                  <RowLine key={d.i} d={d} category={d.categoryId !== null ? catName(d.categoryId) : d.categoryName}
                    onToggle={() => { if (!d.pick && !d.date) setEditing(d.i); else setDrafts((ds) => toggle(ds, d.i)); }}
                    onEdit={() => setEditing(d.i)} />
                ))}
              </View>
            );
          })}
          {drafts.length > shown ? (
            <Pressable onPress={() => setShown((n) => n + PAGE)} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Txt size="small" tone="deep" bold>{`${drafts.length - shown}건 더 보기`}</Txt>
            </Pressable>
          ) : null}
        </Card>

        <Btn label={sum.count ? `${sum.count}건 장부에 넣기` : '넣을 줄을 골라 주세요'} disabled={sum.count === 0} loading={busy}
          onPress={() => setConfirm(true)} />
        {sum.noDate ? <Txt size="tiny" tone="warn" style={{ textAlign: 'center' }}>고른 줄 중 {sum.noDate}건은 날짜가 없어 빠져요</Txt> : null}
        <Btn label="그만두기" tone="ghost" onPress={onCancel} />
      </Body>

      <Ask open={confirm} mood="stack" title={`${sum.count}건을 넣을까요?`}
        body={[
          `수입 ${won(sum.in)}원 · 지출 ${won(sum.out)}원`,
          made.categories.length ? `새 항목 ${made.categories.length}개(${made.categories.slice(0, 3).join(', ')}${made.categories.length > 3 ? ' …' : ''})가 생겨요` : null,
          made.events.length ? `새 행사 ${made.events.length}개(${made.events.slice(0, 2).join(', ')})가 생겨요` : null,
          useOpening && p.opening ? `기초 잔액을 ${won(p.opening.amount)}원으로 바꿔요` : null,
          '넣은 뒤에도 한 번에 되돌릴 수 있어요',
        ].filter(Boolean).join('\n')}
        onClose={() => setConfirm(false)}
        buttons={[{ label: '다시 보기', tone: 'ghost', onPress: () => setConfirm(false) }, { label: busy ? '넣는 중…' : '넣기', onPress: () => { void commit(); } }]} />

      {editing !== null ? (
        <EditRow d={drafts.find((d) => d.i === editing)!} options={catList}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            // 고쳐 저장한 줄은 넣을 줄로 켠다 — 날짜 없는 줄은 날짜를 적는 것이 넣겠다는 뜻이다
            setDrafts((ds) => update(ds, editing, patch).map((d) => (d.i === editing ? { ...d, pick: true } : d)));
            setEditing(null);
          }} />
      ) : null}
    </View>
  );
}

function checkText(c: ImportCheck): string {
  const where = c.sheet ? `「${c.sheet}」 ` : '';
  if (c.code === 'total_mismatch') return `${where}${c.side === 'in' ? '수입' : '지출'} 소계 ${won(c.expected ?? 0)}원 · 읽은 줄 합 ${won(c.got ?? 0)}원`;
  if (c.code === 'closing_mismatch') return `${where}차기이월 ${won(c.expected ?? 0)}원 · 계산하면 ${won(c.got ?? 0)}원`;
  if (c.code === 'rows_unaccounted') return `${where}금액이 있는데 못 읽은 줄이 있어요`;
  if (c.code === 'too_many_rows') return '줄이 너무 많아 앞부분만 읽었어요';

  return where + '원본과 다른 곳이 있어요';
}

/** 원본 항목 하나 → 이 모임 항목 · 새로 만들기 · 미분류 */
function CategoryMap({ source, direction, count, target, options, onChange }: {
  source: string; direction: Direction; count: number; target: CategoryTarget;
  options: { id: number; label: string }[]; onChange: (to: CategoryTarget) => void;
}) {
  const NEW = -1;
  const NONE = 0;
  const value = target && 'id' in target ? target.id : target && 'name' in target ? NEW : NONE;

  return (
    <View style={{ gap: 6 }}>
      <Txt size="small"><Txt size="small" bold>{`「${source}」`}</Txt>{` ${direction === 'in' ? '수입' : '지출'} ${count}건 →`}</Txt>
      <Choices items={[...options, { id: NEW, label: `+ 「${source}」 새로` }, { id: NONE, label: '미분류' }]} value={value}
        onChange={(v) => onChange(v === NEW ? { name: source } : v === NONE ? null : { id: v })} />
    </View>
  );
}

function RowLine({ d, category, onToggle, onEdit }: { d: Draft; category: string | null; onToggle: () => void; onEdit: () => void }) {
  const T = useT();
  const tag = d.dup === 'sheet' ? '다른 시트와 겹침' : d.dup === 'ledger' ? '이미 장부에 있음' : !d.date ? '날짜 없음' : null;

  return (
    <View>
      <Sep />
      <View style={[k.listrow, { gap: 10 }]}>
        <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: d.pick }}
          style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: d.pick ? T.deep : T.line, backgroundColor: d.pick ? T.deep : T.white,
            alignItems: 'center', justifyContent: 'center' }}>
          {d.pick ? <Txt size="tiny" bold tone="white">✓</Txt> : null}
        </Pressable>
        <Pressable onPress={onEdit} style={[k.grow, { opacity: d.pick ? 1 : 0.55 }]}>
          <View style={[k.row, { gap: 6 }]}>
            <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>{d.memo ?? d.merchant ?? category ?? '내용 없음'}</Txt>
            {tag ? <Chip label={tag} tone="warn" style={{ paddingVertical: 1, paddingHorizontal: 6 }} /> : null}
          </View>
          <Txt size="tiny" tone="sub" numberOfLines={1}>
            {[d.date ? `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}` : null, category ?? '미분류', d.eventId !== null || d.eventName ? d.eventName ?? '행사' : null,
              d.source.sheet && d.source.ref ? `원본 ${d.source.sheet}!${d.source.ref}` : null].filter(Boolean).join(' · ')}
          </Txt>
        </Pressable>
        <Amount value={d.amount} direction={d.direction} />
      </View>
    </View>
  );
}

/** 줄 하나 고치기 — 날짜 · 수입/지출 · 금액 · 내용 · 항목 */
function EditRow({ d, options, onClose, onSave }: {
  d: Draft; options: { id: number; name: string; kind: Direction }[]; onClose: () => void;
  onSave: (patch: Partial<Pick<Draft, 'date' | 'direction' | 'amount' | 'memo' | 'categoryId' | 'categoryName'>>) => void;
}) {
  const [date, setDate] = useState(d.date ?? '');
  const [direction, setDirection] = useState<Direction>(d.direction);
  const [amount, setAmount] = useState(won(d.amount));
  const [memo, setMemo] = useState(d.memo ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(d.categoryId);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(date) && (readAmount(amount) ?? 0) > 0;

  return (
    <Ask open title="줄 고치기" onClose={onClose}
      buttons={[{ label: '닫기', tone: 'ghost', onPress: onClose }, {
        label: '저장', onPress: () => {
          if (!ok) return;
          onSave({ date, direction, amount: readAmount(amount) ?? d.amount, memo: memo.trim() || null,
            ...(categoryId !== d.categoryId ? { categoryId, categoryName: categoryId === null ? d.categoryName : null } : {}) });
        },
      }]}>
      <Tabs items={[{ id: 'out', label: '지출' }, { id: 'in', label: '수입' }]} value={direction} onChange={(v) => { setDirection(v); setCategoryId(null); }} />
      <View style={[k.row, { gap: S.sm }]}>
        <DateField style={{ flex: 1.3 }} value={date} onChange={setDate} />
        <Field style={{ flex: 1 }} value={amount} onChangeText={(v) => setAmount(amountInput(v))} keyboardType="number-pad" placeholder="금액" />
      </View>
      <Field value={memo} onChangeText={setMemo} placeholder="내용" maxLength={200} />
      <Choices items={options.filter((o) => o.kind === direction).map((o) => ({ id: o.id, label: o.name }))} value={categoryId}
        onChange={(v) => setCategoryId(v === categoryId ? null : v)} />
      {!ok ? <Txt size="tiny" tone="warn">날짜(2026-09-21 처럼)와 금액을 적어 주세요</Txt> : null}
    </Ask>
  );
}

/* ── 넣은 뒤 ── */

function Done({ imp, onUndone, onLedger }: { imp: LedgerImport; onUndone: (x: LedgerImport) => void; onLedger: () => void }) {
  const { group, say, fail, bump, reloadGroup } = useApp();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const undo = async () => {
    if (!group) return;
    setBusy(true);
    try {
      const r = await cm.undoImport(group.id, imp.id);
      say(`${r.voided}건을 되돌렸어요`);
      bump();
      await reloadGroup();
      onUndone(await cm.ledgerImport(group.id, imp.id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setAsk(false);
    }
  };

  return (
    <Body>
      <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
        <Mascot mood="celebrate" size={96} />
        <Txt bold size="head">{`${imp.committed}건을 장부에 넣었어요`}</Txt>
        <Txt tone="sub" size="small" style={{ textAlign: 'center' }}>잘못 넣었으면 한 번에 되돌릴 수 있어요</Txt>
      </Card>
      <Btn label="장부 보기" onPress={onLedger} />
      <Btn label="넣은 것 되돌리기" tone="ghost" loading={busy} onPress={() => setAsk(true)} />
      <Ask open={ask} mood="thinking" title={`${imp.committed}건을 되돌릴까요?`}
        body="가져온 줄을 장부에서 빼고, 바꾼 기초 잔액도 되돌려요. 새로 생긴 항목은 숨기고 빈 행사는 지워요."
        onClose={() => setAsk(false)}
        buttons={[{ label: '그대로 두기', tone: 'ghost', onPress: () => setAsk(false) }, { label: busy ? '되돌리는 중…' : '되돌리기', tone: 'danger', onPress: () => { void undo(); } }]} />
    </Body>
  );
}
