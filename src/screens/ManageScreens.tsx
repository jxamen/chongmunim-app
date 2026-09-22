/**
 * 탭 위에 겹쳐 뜨는 작은 화면들 — 장부 한 줄 고치기 · 영수증 보기 · 명단 · 항목 · 내 정보 · 알림 · 모임 정보 · 총무 넘기기 · 예산 한 줄.
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useApp, useLoad } from '../store';
import { API_BASE } from '../config';
import * as cm from '../cm/api';
import { amountInput, kstNow, mdInput, mdWord, readAmount, readWhen, whenLong, won } from '../cm/format';
import { isPro } from '../cm/plan';
import { chipOrder, parsePasted } from '../cm/rules';
import { pickLedgerFile } from '../cm/ledgerFile';
import { sheetFileId } from '../cm/importRows';
import { codeOf } from '../cm/errors';
import type { BudgetLine, Category, Entry, RosterItem } from '../cm/model';
import { notify, push, remindOn, setRemindOn } from '../push';
import { Ask, Body, Btn, Card, Chip, Choices, Empty, Failed, Field, Head, Loading, MenuRow, Sep, Soft, Tabs, Toggle, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { BankField } from '../ui/BankField';
import { DateField } from '../ui/DateField';
import { F, S, useT } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

const ROLE: Record<string, string> = { owner: '총무', admin: '관리자', member: '회원' };

/* ── 장부 한 줄 고치기 ── */

export function EntryScreen({ entry }: { entry: Entry }) {
  const { group, back, bump, say, fail, open } = useApp();
  const kb = useKeyboardPad();
  const cats = useLoad(cm.categories);
  const evs = useLoad(cm.events);
  const [merchant, setMerchant] = useState(entry.merchant ?? '');
  const [amount, setAmount] = useState(won(entry.amount));
  const [date, setDate] = useState(entry.occurredAt.slice(0, 10));
  const [time, setTime] = useState(entry.occurredAt.slice(11, 16) === '00:00' ? '' : entry.occurredAt.slice(11, 16));
  const [categoryId, setCategoryId] = useState<number | null>(entry.categoryId);
  const [eventId, setEventId] = useState<number | null>(entry.eventId);
  const [memo, setMemo] = useState(entry.memo ?? '');
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dues = entry.source === 'dues';
  const amountValue = readAmount(amount);
  const when = readWhen(date, time);

  const save = async () => {
    if (!group || !amountValue || !when) return;
    setBusy(true);
    try {
      await cm.editEntry(group.id, entry.id, {
        ...(dues ? {} : { amount: amountValue, occurredAt: when }),
        merchant: merchant.trim() || null, categoryId, eventId, memo: memo.trim() || null,
      });
      say('고쳤어요 · 바꾼 기록은 남아요');
      bump();
      back();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    try {
      await cm.voidEntry(group.id, entry.id, reason.trim() || undefined);
      say(dues ? '지웠어요 · 회비 납부도 같이 취소했어요' : '지웠어요');
      bump();
      back();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title={entry.direction === 'in' ? '수입 고치기' : '지출 고치기'} onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        <View style={{ height: 2 }} />
        {entry.edited.length ? <Soft tone="warn" title="영수증과 다름" sub="영수증에서 읽은 값과 금액·날짜가 달라요. 영수증 보기로 원본을 확인할 수 있어요" /> : null}
        {dues ? <Soft title="회비 기록이에요" sub="금액·날짜는 모임 › 회비에서 바꿔 주세요. 지우면 그 달 납부도 취소돼요" /> : null}
        <Field label={entry.direction === 'in' ? '누구에게 · 무엇' : '상호'} value={merchant} onChangeText={setMerchant} maxLength={60} />
        <View style={[k.row, { gap: S.sm }]}>
          <DateField label="날짜" style={{ flex: 1.3 }} value={date} onChange={setDate} disabled={dues} />
          <Field label="시각" style={{ flex: 0.9 }} value={time} onChangeText={setTime} editable={!dues} maxLength={5} placeholder="—" inputStyle={{ fontSize: F.body }} />
        </View>
        <Field label="금액" value={amount} onChangeText={(v) => setAmount(amountInput(v))} editable={!dues} keyboardType="number-pad"
          inputStyle={{ fontSize: 20, fontWeight: '900' }} right={<Txt tone="sub">원</Txt>} />
        <View style={{ gap: 6 }}>
          <Txt bold>항목</Txt>
          <Choices items={(cats.data ?? []).filter((c) => !c.hidden && c.kind === entry.direction).map((c) => ({ id: c.id, label: c.name }))}
            value={categoryId} onChange={(id) => setCategoryId(id === categoryId ? null : id)} />
        </View>
        {(evs.data ?? []).length > 0 ? (
          <View style={{ gap: 6 }}>
            <Txt bold>행사</Txt>
            <Choices items={[...(evs.data ?? []).map((e) => ({ id: e.id, label: e.name + (e.status === 'closed' ? '(마감)' : '') })), { id: 0, label: '없음' }]}
              value={eventId ?? 0} onChange={(id) => setEventId(id === 0 ? null : id)} />
          </View>
        ) : null}
        <Field label="내용" value={memo} onChangeText={setMemo} multiline maxLength={200} />
        {entry.receiptId ? <Btn label="영수증 보기" tone="ghost" small onPress={() => open({ kind: 'receipt', id: entry.receiptId! })} /> : null}
        <View style={[k.row, { gap: S.sm }]}>
          <Btn label="지우기" tone="ghost" style={{ width: 96 }} onPress={() => setVoidOpen(true)} />
          <Btn label="저장" style={k.grow} loading={busy} disabled={!amountValue || !when} onPress={() => { void save(); }} />
        </View>
        {entry.by ? <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>{entry.source === 'request' ? `${entry.by} 님의 지급 요청` : `${entry.by} 님이 적었어요`}</Txt> : null}
      </Body>
      <Ask open={voidOpen} title="이 기록을 지울까요?" mood="thinking" onClose={() => setVoidOpen(false)}
        body="장부에서 빠지고 잔액이 다시 계산돼요. 지운 기록은 변경 이력에 남아요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setVoidOpen(false) }, { label: '지우기', tone: 'danger', onPress: () => { setVoidOpen(false); void remove(); } }]}>
        <Field value={reason} onChangeText={setReason} placeholder="사유(선택) 예) 두 번 적음" maxLength={100} />
      </Ask>
    </View>
  );
}

/* ── 영수증 보기 ── */

export function ReceiptScreen({ id }: { id: string }) {
  const { back } = useApp();
  const T = useT();
  const { data, error, reload } = useLoad((gid) => cm.getReceipt(gid, id), [id]);
  const [ratio, setRatio] = useState(0.7);

  useEffect(() => {
    if (data?.imageUrl) Image.getSize(data.imageUrl, (w, h) => { if (w > 0 && h > 0) setRatio(w / h); }, () => undefined);
  }, [data?.imageUrl]);

  return (
    <View style={{ flex: 1 }}>
      <Head title="영수증" onClose={back} />
      {!data ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          {data.imageUrl ? (
            <Card style={{ padding: 6 }}>
              <Image source={{ uri: data.imageUrl }} style={{ width: '100%', aspectRatio: ratio, borderRadius: 12, backgroundColor: T.track }} resizeMode="contain" />
            </Card>
          ) : <Card><Empty mood="search" title="사진이 없어요" sub="읽은 값만 남아 있어요" /></Card>}
          <Card style={{ gap: 6 }}>
            <Txt size="small" tone="sub" bold>영수증에서 읽은 값</Txt>
            <Txt>상호(참고) · {data.store ?? '—'}</Txt>
            <Txt>결제 · {data.paidAt ? whenLong(data.paidAt) : '—'}</Txt>
            <Txt>합계 · {data.total ? won(data.total) + '원' : '—'}</Txt>
            {data.businessNumber ? <Txt size="small" tone="sub">사업자번호 {data.businessNumber}</Txt> : null}
            {data.approval ? <Txt size="small" tone="sub">승인번호 {data.approval}</Txt> : null}
            {data.items.length ? <Sep style={{ marginVertical: 4 }} /> : null}
            {data.items.map((i, n) => (
              <View key={n} style={[k.row, { justifyContent: 'space-between' }]}>
                <Txt size="small" tone="sub" style={k.grow} numberOfLines={1}>{i.name}{i.count > 1 ? ` ×${i.count}` : ''}</Txt>
                <Txt size="small" style={k.amt}>{i.price !== null ? won(i.price) : ''}</Txt>
              </View>
            ))}
          </Card>
        </Body>
      )}
    </View>
  );
}

/* ── 명단 · 관리자 ── */

export function MembersScreen() {
  const { group, back, fail, say, reloadGroup, showPlan } = useApp();
  const { data, error, reload } = useLoad(cm.roster);
  const [name, setName] = useState('');
  const [pick, setPick] = useState<RosterItem | null>(null);
  const [bday, setBday] = useState('');   // 고르는 사람의 생일(MM-DD)
  const [list, setList] = useState<RosterItem[] | null>(null);
  const owner = group?.me.role === 'owner';
  const rows = list ?? data;

  const run = async (fn: () => Promise<RosterItem[]>, text: string) => {
    try { setList(await fn()); say(text); void reloadGroup(); } catch (e) { fail(e); } finally { setPick(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="명단 · 관리자" onClose={back} />
      {!rows ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          <View style={{ height: 2 }} />
          <Card style={{ gap: S.sm }}>
            <Txt size="small" tone="sub" bold>명단에 이름 적기</Txt>
            <Txt size="tiny" tone="dim">앱이 없는 회원도 적어 두면 회비를 체크할 수 있어요. 나중에 같은 이름으로 들어오면 그 자리를 이어받아요.</Txt>
            <View style={[k.row, { gap: S.sm }]}>
              <Field style={k.grow} value={name} onChangeText={setName} placeholder="예) 최은영" maxLength={30} />
              <Btn label="적기" small style={{ width: 76 }} disabled={!name.trim()}
                onPress={() => { if (group) void run(() => cm.addMember(group.id, name.trim()), `${name.trim()} 님을 적었어요`).then(() => setName('')); }} />
            </View>
          </Card>
          <Card style={{ paddingVertical: 2 }}>
            {rows.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Sep /> : null}
                <MenuRow label={m.name} value={[ROLE[m.role], m.hasApp ? null : '앱 없음', m.duesExempt ? '회비 면제' : null, mdWord(m.birthday) ? `🎂 ${mdWord(m.birthday)}` : null].filter(Boolean).join(' · ')}
                  onPress={() => { setBday(m.birthday ?? ''); setPick(m); }} />
              </View>
            ))}
          </Card>
          <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>관리자는 기록·지급·회비·공지를 함께 볼 수 있어요. 관리자 지정은 총무만 해요.</Txt>
        </Body>
      )}
      <Ask open={!!pick} title={pick?.name ?? ''} onClose={() => setPick(null)}
        body={pick ? `${ROLE[pick.role]}${pick.hasApp ? '' : ' · 앱 없음'}${pick.duesExempt ? ' · 회비 면제' : ''}` : ''}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setPick(null) }]}>
        {pick && group ? (
          <View style={{ gap: S.sm }}>
            {/* 생일 — 월·일만. 그날 아침 총무·관리자 폰에 알림(이름은 잠금 화면에 안 싣는다) · 구독 */}
            <View style={[k.row, { gap: S.sm, alignItems: 'flex-end' }]}>
              <Field label="생일(월-일)" style={k.grow} value={bday} onChangeText={(v) => setBday(mdInput(v))} placeholder="예) 03-15"
                keyboardType="number-pad" maxLength={5} inputStyle={{ fontSize: F.body }} />
              <Btn label="저장" small style={{ width: 70, marginBottom: 2 }} disabled={bday !== '' && !mdWord(bday)}
                onPress={() => {
                  if (!isPro(group)) { setPick(null); showPlan('general'); return; }
                  void run(() => cm.updateMember(group.id, pick.id, { birthday: bday || null }), bday ? `${pick.name} 님 생일을 적었어요` : '생일을 지웠어요');
                }} />
            </View>
            {pick.role !== 'owner' && owner && pick.hasApp ? (
              <Btn label={pick.role === 'admin' ? '관리자에서 빼기' : '관리자로 지정'} tone="ghost" small
                onPress={() => { void run(() => cm.updateMember(group.id, pick.id, { role: pick.role === 'admin' ? 'member' : 'admin' }), '바꿨어요'); }} />
            ) : null}
            <Btn label={pick.duesExempt ? '회비 면제 풀기' : '회비 면제'} tone="ghost" small
              onPress={() => { void run(() => cm.updateMember(group.id, pick.id, { duesExempt: !pick.duesExempt }), '바꿨어요'); }} />
            {pick.role !== 'owner' ? (
              <Btn label="명단에서 빼기" tone="danger" small
                onPress={() => { void run(() => cm.updateMember(group.id, pick.id, { remove: true }), `${pick.name} 님을 명단에서 뺐어요`); }} />
            ) : null}
          </View>
        ) : null}
      </Ask>
    </View>
  );
}

/* ── 항목 관리 ── */

export function CategoriesScreen() {
  const { group, back, fail, reloadGroup } = useApp();
  const { data, error, reload } = useLoad(cm.categories);
  const [list, setList] = useState<Category[] | null>(null);
  const [kind, setKind] = useState<'out' | 'in'>('out');
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<Category | null>(null);
  const [rename, setRename] = useState('');
  const [mode, setMode] = useState<'edit' | 'parent' | 'merge'>('edit');
  const all = list ?? data ?? [];
  const rows = chipOrder(all.filter((c) => c.kind === kind));
  const nameOf = (id: number | null) => all.find((c) => c.id === id)?.name ?? '';

  const run = async (fn: () => Promise<Category[]>) => {
    try { setList(await fn()); void reloadGroup(); } catch (e) { fail(e); } finally { setEdit(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="항목 관리" onClose={back} />
      <Tabs items={[{ id: 'out', label: '지출 항목' }, { id: 'in', label: '수입 항목' }]} value={kind} onChange={setKind} />
      {!data && !list ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          <View style={{ height: 4 }} />
          <View style={[k.row, { gap: S.sm }]}>
            <Field style={k.grow} value={name} onChangeText={setName} placeholder={kind === 'out' ? '예) 경조사비' : '예) 후원금'} maxLength={20} />
            <Btn label="더하기" small style={{ width: 84 }} disabled={!name.trim()}
              onPress={() => { if (group) void run(() => cm.addCategory(group.id, name.trim(), kind)).then(() => setName('')); }} />
          </View>
          <Card style={{ paddingVertical: 2 }}>
            {rows.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Sep /> : null}
                <MenuRow label={c.parentId ? `　· ${c.name}` : c.name} value={c.hidden ? '숨김' : c.parentId ? nameOf(c.parentId) + ' 아래' : undefined}
                  onPress={() => { setEdit(c); setRename(c.name); setMode('edit'); }} />
              </View>
            ))}
          </Card>
          <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>항목은 지우지 않고 숨겨요 — 옛 기록이 그 항목을 가리키고 있어서요.{'\n'}항목이 많아지면 대분류 아래로 묶고, 비슷한 항목(간식·간식비)은 합치세요.</Txt>
        </Body>
      )}
      <Ask open={!!edit} title={mode === 'merge' ? `「${edit?.name ?? ''}」을 어디로 합칠까요?` : mode === 'parent' ? '어느 대분류 아래로?' : '항목'} onClose={() => setEdit(null)}
        body={mode === 'merge' ? '이 항목의 기록·예산이 모두 옮겨가고 이 항목은 숨겨져요.' : undefined}
        buttons={mode === 'edit' ? [
          { label: edit?.hidden ? '다시 보이기' : '숨기기', tone: 'ghost', onPress: () => { if (group && edit) void run(() => cm.updateCategory(group.id, edit.id, { hidden: !edit.hidden })); } },
          { label: '이름 저장', onPress: () => { if (group && edit && rename.trim()) void run(() => cm.updateCategory(group.id, edit.id, { name: rename.trim() })); } },
        ] : [{ label: '뒤로', tone: 'ghost', onPress: () => setMode('edit') }]}>
        {mode === 'edit' && edit ? (
          <View style={{ gap: S.sm }}>
            <Field value={rename} onChangeText={setRename} maxLength={20} />
            <View style={[k.row, { gap: S.sm }]}>
              <Btn label="대분류 정하기" tone="ghost" small style={k.grow} onPress={() => setMode('parent')} />
              <Btn label="다른 항목에 합치기" tone="ghost" small style={k.grow} onPress={() => setMode('merge')} />
            </View>
          </View>
        ) : null}
        {mode === 'parent' && edit ? (
          <Choices items={[{ id: 0, label: '대분류로 두기' }, ...all.filter((c) => c.kind === edit.kind && !c.parentId && !c.hidden && c.id !== edit.id).map((c) => ({ id: c.id, label: c.name }))]}
            value={edit.parentId ?? 0}
            onChange={(id) => { if (group) void run(() => cm.updateCategory(group.id, edit.id, { parentId: id === 0 ? null : id })); }} />
        ) : null}
        {mode === 'merge' && edit ? (
          <Choices items={all.filter((c) => c.kind === edit.kind && !c.hidden && c.id !== edit.id).map((c) => ({ id: c.id, label: c.name }))} value={null}
            onChange={(id) => { if (group) void run(() => cm.mergeCategory(group.id, edit.id, id)); }} />
        ) : null}
      </Ask>
    </View>
  );
}

/* ── 내 정보 · 받을 계좌 ── */

export function ProfileScreen() {
  const { group, back, say, fail, reloadGroup } = useApp();
  const kb = useKeyboardPad();
  const me = group?.me;
  const [name, setName] = useState(me?.name ?? '');
  const [bankName, setBankName] = useState(me?.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(me?.bankAccount ?? '');
  const [bankHolder, setBankHolder] = useState(me?.bankHolder ?? '');
  const [birthday, setBirthday] = useState(me?.birthday ?? '');
  const [busy, setBusy] = useState(false);
  if (!group || !me) return null;
  const pro = isPro(group);

  const save = async () => {
    setBusy(true);
    try {
      // 생일은 구독 모임에서만 — 바뀌었을 때만 보낸다(무료 모임에서 이름·계좌 저장이 막히지 않게)
      const bday = pro && birthday !== (me.birthday ?? '') ? { birthday: birthday || null } : {};
      await cm.updateMe(group.id, { name: name.trim(), bankName: bankName.trim() || null, bankAccount: bankAccount.trim() || null, bankHolder: bankHolder.trim() || null, ...bday });
      await reloadGroup();
      say('저장했어요');
      back();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="내 정보" onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        <View style={{ height: 2 }} />
        <Field label="모임에서 쓰는 이름" value={name} onChangeText={setName} maxLength={30} />
        {pro ? (
          <Field label="생일(월-일)" value={birthday} onChangeText={(v) => setBirthday(mdInput(v))} placeholder="예) 03-15 · 적어 두면 그날 모임이 알아요"
            keyboardType="number-pad" maxLength={5} inputStyle={{ fontSize: F.body }} />
        ) : null}
        <Card style={{ gap: S.md }}>
          <Txt size="small" tone="sub" bold>지급받을 계좌</Txt>
          <Txt size="tiny" tone="dim">지급 요청을 하면 총무님이 이 계좌로 보내요. 총무·관리자만 전체 번호를 봐요.</Txt>
          <BankField value={bankName} onChange={setBankName} />
          <Field value={bankAccount} onChangeText={setBankAccount} placeholder="계좌번호" keyboardType="numbers-and-punctuation" maxLength={40} inputStyle={{ fontSize: F.body }} />
          <Field value={bankHolder} onChangeText={setBankHolder} placeholder="예금주" maxLength={30} inputStyle={{ fontSize: F.body }} />
        </Card>
        <Btn label="저장" loading={busy} disabled={!name.trim() || (birthday !== '' && !mdWord(birthday))} onPress={() => { void save(); }} />
      </Body>
    </View>
  );
}

/* ── 알림 — 모임 푸시(서버, 모임마다) · 장부 챙김(이 폰) ── */

export function NotifyScreen() {
  const { group, back, say, fail, reloadGroup } = useApp();
  const me = group?.me;
  const [remind, setRemind] = useState(remindOn());
  const [testing, setTesting] = useState(false);
  if (!group || !me) return null;

  /*
   | 시험 알림 — 이 폰으로만(2026-09-22 태훈님 「푸시 오는지 확인하고 싶은데 어드민이라 안 옴」 — 쓴 사람은 공지 알림에서 빠진다).
   | 권한을 먼저 묻고 토큰을 올린 뒤 보낸다. 앱을 켜 둔 채로도 위에 배너로 뜬다(@jcurve/notify).
   */
  const sendTest = async () => {
    setTesting(true);
    try {
      if (!(await notify.ask())) {
        say('폰 설정 › 총무님 › 알림을 켜 주세요');
        return;
      }
      await push.register();
      const p = await cm.testPush(group.id);
      say(p && p.sent > 0 ? '시험 알림을 보냈어요 · 곧 위에 떠요'
        : p && p.noToken > 0 ? '이 폰이 아직 알림 받을 준비가 안 됐어요 · 잠시 뒤 다시 눌러 주세요'
        : '알림을 보내지 못했어요 · 잠시 뒤 다시 해 주세요');
    } catch (e) {
      fail(e);
    } finally {
      setTesting(false);
    }
  };

  /* 재방문 로컬 알림 전체 — 이 폰에만 걸리므로 이 폰에 둔다(remind.ts) */
  const toggleRemind = async (on: boolean) => {
    // 스위치가 먼저다 — 권한 창을 기다리다 스위치가 안 바뀌면 안 된다. 권한은 그다음에 묻는다(한 실행에 한 번)
    setRemind(on);
    await setRemindOn(on);
    if (on) void notify.ask();
  };

  const setNotify = async (key: 'notice' | 'dues' | 'request', on: boolean) => {
    try {
      if (on && await notify.ask()) void push.register();
      await cm.updateMe(group.id, { notify: { [key]: on } });
      await reloadGroup();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="알림" onClose={back} />
      <Body bottom={120}>
        <View style={{ height: 2 }} />
        <Card style={{ paddingVertical: 2 }}>
          <Txt size="small" tone="sub" bold style={{ paddingTop: 12 }}>{group.name} 알림</Txt>
          <MenuRow label="공지" right={<Toggle on={me.notify.notice} onChange={(v) => { void setNotify('notice', v); }} />} />
          <Sep />
          <MenuRow label="회비 안내" right={<Toggle on={me.notify.dues} onChange={(v) => { void setNotify('dues', v); }} />} />
          <Sep />
          <MenuRow label="지급 요청" right={<Toggle on={me.notify.request} onChange={(v) => { void setNotify('request', v); }} />} />
        </Card>
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow label="장부 챙김 알림 (이 폰)" right={<Toggle on={remind} onChange={(v) => { void toggleRemind(v); }} />} />
          <Txt size="tiny" tone="dim" style={{ paddingBottom: 12, lineHeight: 19 }}>
            {me.role === 'member'
              ? '한동안 안 열면 공지와 내 회비를 확인하라고 알려 드려요.'
              : '월말 정리 · 회비 확인 · 처리 안 한 지급 요청 · 행사 정산 · 연말 결산 때를 알려 드려요. 금액과 이름은 알림에 나오지 않아요.'}
          </Txt>
        </Card>
        <Btn label="이 폰으로 시험 알림 보내기" tone="ghost" loading={testing} onPress={() => { void sendTest(); }} />
        <Txt size="tiny" tone="dim" style={{ textAlign: 'center', marginTop: -6 }}>공지를 쓴 사람에겐 공지 알림이 가지 않아요 · 알림이 오는지는 여기서 확인해요</Txt>
      </Body>
    </View>
  );
}

/* ── 모임 정보 · 월 회비 · 기초 잔액(과거 데이터) ── */

export function GroupEditScreen() {
  const { group, back, say, fail, reloadGroup, open } = useApp();
  const kb = useKeyboardPad();
  const [sheetUrl, setSheetUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [name, setName] = useState(group?.name ?? '');
  const [dues, setDues] = useState(group?.duesAmount ? won(group.duesAmount) : '');
  const [duesOn, setDuesOn] = useState((group?.duesAmount ?? 0) > 0);
  const [opening, setOpening] = useState(group?.openingBalance ? won(group.openingBalance) : '');
  const [openingDate, setOpeningDate] = useState(group?.openingDate ?? '');
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const lastYear = kstNow().year - 1;
  const parsed = parsePasted(paste);
  if (!group) return null;

  /* 작년 항목별 집행 — 시트에서 항목·금액 두 열을 복사해 붙인 것(기획 「붙여넣기가 핵심이다」) */
  const importLines = async () => {
    setBusy(true);
    try {
      const r = await cm.importPrior(group.id, lastYear, parsed.lines);
      say(`${lastYear}년 항목 ${r.lines}개를 가져왔어요${r.newCategories ? ` · 새 항목 ${r.newCategories}개` : ''} · 예산의 「작년」 칸에 보여요`);
      setPaste('');
      await reloadGroup();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /* 쓰던 장부 파일 — 맡기고 확인 표로 간다(몇 분 걸리니 기다리지 않는다) */
  const sendLedger = async (how: 'file' | 'sheet') => {
    setSending(true);
    try {
      let imp;
      if (how === 'file') {
        const picked = await pickLedgerFile();
        if (!picked) return;
        imp = await cm.uploadLedger(group.id, await picked.form());
      } else {
        imp = await cm.importSheet(group.id, sheetUrl.trim());
        setSheetUrl('');
      }
      open({ kind: 'import', id: imp.id });
    } catch (e) {
      // 받은 링크가 공개가 아니면(남이 나에게만 공유) 구글 로그인으로 그 시트를 연다 — 남의 시트 공유는 내가 못 바꾼다(2026-09-22 태훈님)
      const id = how === 'sheet' ? sheetFileId(sheetUrl) : null;
      if (id && codeOf(e) === 'sheet_private') {
        say('공개 링크가 아니라서 구글 계정으로 열어요');
        setSheetUrl('');
        await fromDrive(id);
        return;
      }
      fail(e);
    } finally {
      setSending(false);
    }
  };

  /*
   | 구글 드라이브에서 고르기 — 링크를 복사해 붙이지 않아도 된다(2026-09-22 태훈님). 폰 브라우저로 서버 페이지를 열면 구글 로그인
   | (고른 파일만 읽는 권한) → 내 드라이브 목록(구글 Picker) → 고르면 서버가 받아 가져오기에 맡기고 chongmunim://import/{id} 로
   | 돌려보낸다 → 확인 표를 연다. 로그인은 앱 안 웹뷰에서 구글이 막아서 폰 브라우저(인증 세션)로 연다.
   | fileId 가 있으면(받은 링크가 공개가 아닐 때) 목록 대신 그 시트 하나만 띄운다.
   */
  const fromDrive = async (fileId?: string) => {
    setSending(true);
    try {
      const ticket = await cm.googlePickerTicket(group.id);
      const f = fileId ? `&f=${encodeURIComponent(fileId)}` : '';
      const r = await WebBrowser.openAuthSessionAsync(`${API_BASE}/cm/picker?t=${encodeURIComponent(ticket)}${f}`, 'chongmunim://import');
      if (r.type !== 'success') return;
      const m = /^chongmunim:\/\/import\/([\w-]+)/.exec(r.url);
      if (m && m[1] !== 'cancel') open({ kind: 'import', id: m[1] });
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await cm.updateGroup(group.id, {
        name: name.trim(), duesAmount: duesOn ? readAmount(dues) ?? 0 : 0,
        openingBalance: (opening.trim().startsWith('−') || opening.trim().startsWith('-') ? -1 : 1) * (readAmount(opening) ?? 0),
        openingDate: /^\d{4}-\d{2}-\d{2}$/.test(openingDate) ? openingDate : null,
      });
      await reloadGroup();
      say('저장했어요');
      back();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="모임 정보" onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        <View style={{ height: 2 }} />
        <Field label="모임 이름" value={name} onChangeText={setName} maxLength={40} />
        {/* 회비 없음을 고를 수 있게 — 0원을 「아직 안 정함」이 아니라 「회비 없는 모임」으로(2026-09-22 태훈님) */}
        <View style={{ gap: 6 }}>
          <Txt bold>월 회비</Txt>
          <Choices items={[{ id: 'on', label: '매달 회비 받기' }, { id: 'off', label: '회비 없음' }]} value={duesOn ? 'on' : 'off'}
            onChange={(id) => { setDuesOn(id === 'on'); if (id === 'off') setDues(''); }} />
          {duesOn ? (
            <Field value={dues} onChangeText={(v) => setDues(amountInput(v))} keyboardType="number-pad" placeholder="예) 40,000" right={<Txt tone="sub">원</Txt>} />
          ) : <Txt size="tiny" tone="dim">회비 칸에 납부 체크·미납 안내가 뜨지 않아요. 나중에 언제든 바꿀 수 있어요.</Txt>}
        </View>
        <Card style={{ gap: S.md }}>
          <View style={[k.row, { gap: 10 }]}>
            <Mascot mood="calculator" size={46} />
            <View style={k.grow}>
              <Txt bold>쓰던 장부 파일로 가져오기</Txt>
              <Txt size="tiny" tone="sub">구글 시트 · 엑셀(.xlsx) · CSV · PDF 를 날짜 · 항목 · 금액으로 풀어 드려요. 확인한 줄만 넣어요.</Txt>
            </View>
          </View>
          <Btn label="구글 드라이브에서 고르기" loading={sending} onPress={() => { void fromDrive(); }} />
          <Txt size="tiny" tone="dim" style={{ marginTop: -4 }}>구글에 로그인하면 내 시트 목록이 떠요 · 고른 파일만 읽어요</Txt>
          <Btn label="폰에 있는 파일 고르기" tone="ghost" loading={sending} onPress={() => { void sendLedger('file'); }} />
          {/* 드라이브에서 고르기와 링크 넣기 둘 다 — 남이 준 링크도 있다(2026-09-22 태훈님 「2가지 다 돼야돼」) */}
          <Sep />
          <Txt bold>받은 구글 시트 링크로 가져오기</Txt>
          <Field value={sheetUrl} onChangeText={setSheetUrl} placeholder="https://docs.google.com/spreadsheets/…" autoCapitalize="none"
            autoCorrect={false} inputStyle={{ fontSize: F.small, fontWeight: '400' }} />
          <Btn label="링크로 가져오기" tone="ghost" disabled={!sheetFileId(sheetUrl)} loading={sending}
            onPress={() => { void sendLedger('sheet'); }} />
          <Txt size="tiny" tone="dim" style={{ marginTop: -4 }}>나에게만 공유된 시트면 구글 로그인으로 이어서 열어요</Txt>
        </Card>
        <Card style={{ gap: S.md }}>
          <View style={[k.row, { gap: 10 }]}>
            <Mascot mood="stack" size={46} />
            <View style={k.grow}>
              <Txt bold>과거 데이터 가져오기</Txt>
              <Txt size="tiny" tone="sub">앱을 쓰기 전 통장에 있던 돈을 기초 잔액으로 적어요. 모든 이월이 여기서 시작해요.</Txt>
            </View>
          </View>
          <Field label="기초 잔액" value={opening} onChangeText={(v) => setOpening(amountInput(v))} keyboardType="number-pad" placeholder="예) 1,150,400" right={<Txt tone="sub">원</Txt>} />
          <DateField label="기초일(선택)" value={openingDate} onChange={setOpeningDate} optional placeholder="이날 이전 잔액이 기초 잔액" />
        </Card>
        <Btn label="저장" loading={busy} disabled={!name.trim() || (duesOn && !readAmount(dues))} onPress={() => { void save(); }} />
        <Card style={{ gap: S.md }}>
          <Txt bold>{lastYear}년 항목별 집행 붙여넣기</Txt>
          <Txt size="tiny" tone="sub">쓰던 시트에서 「항목」 열과 「금액」 열을 같이 복사해 아래에 붙이세요. 합계·소계 줄은 알아서 빼요. 다음 해 예산의 근거로 쓰여요.</Txt>
          <Field value={paste} onChangeText={setPaste} multiline placeholder={'식비\t921,000\n물품·비품\t687,400'} inputStyle={{ minHeight: 110, fontSize: F.small }} />
          {parsed.lines.length > 0 ? (
            <View style={{ gap: 4 }}>
              {parsed.lines.slice(0, 12).map((l) => (
                <View key={l.name} style={[k.row, { justifyContent: 'space-between' }]}>
                  <Txt size="small" tone="sub">{l.name}</Txt><Txt size="small" style={k.amt}>{won(l.amount)}</Txt>
                </View>
              ))}
              {parsed.lines.length > 12 ? <Txt size="tiny" tone="dim">… 외 {parsed.lines.length - 12}개</Txt> : null}
              <Sep style={{ marginVertical: 4 }} />
              <View style={[k.row, { justifyContent: 'space-between' }]}><Txt size="small" bold>합계</Txt><Txt size="small" bold style={k.amt}>{won(parsed.total)}</Txt></View>
              {parsed.skipped.length ? <Txt size="tiny" tone="warn">못 읽은 줄 {parsed.skipped.length}개 — {parsed.skipped.slice(0, 2).join(', ')}</Txt> : null}
            </View>
          ) : null}
          <Btn label={`${lastYear}년 집행으로 넣기`} tone="ghost" disabled={parsed.lines.length === 0} loading={busy} onPress={() => { void importLines(); }} />
        </Card>
      </Body>
    </View>
  );
}

/* ── 총무 넘기기 ── */

export function TransferScreen() {
  const { group, back, say, fail, reloadGroup } = useApp();
  const { data, error, reload } = useLoad(cm.roster);
  const [pick, setPick] = useState<RosterItem | null>(null);
  const candidates = (data ?? []).filter((m) => m.role !== 'owner' && m.hasApp);
  const pending = group?.transfer ?? null;

  /* 지정만 한다 — 후임이 앱에서 수락해야 넘어간다(기획 「넘기는 절차」) */
  const go = async () => {
    if (!group || !pick) return;
    try {
      await cm.transferOwner(group.id, pick.id);
      await reloadGroup();
      say(`${pick.name} 님께 알렸어요 · 수락하면 넘어가요`);
    } catch (e) {
      fail(e);
    } finally {
      setPick(null);
    }
  };
  const cancel = async () => {
    if (!group) return;
    try { await cm.cancelOwner(group.id); await reloadGroup(); say('넘기기를 거뒀어요'); } catch (e) { fail(e); }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="총무 넘기기" onClose={back} />
      {!data ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          <Card style={{ alignItems: 'center', gap: 6 }}>
            <Mascot mood="heart" size={80} />
            <Txt size="small" tone="sub" style={{ textAlign: 'center' }}>장부·영수증·예산·회원 명부·처리 중인 지급 요청이 그대로 넘어가요.{'\n'}받는 분이 수락하면 넘어가고, 나는 관리자로 남아요. 내 계좌는 넘어가지 않아요.</Txt>
          </Card>
          {pending ? (
            <Soft tone="warn" title={`${pending.to ?? ''} 님의 수락을 기다려요`} sub="앱에서 수락하면 넘어가요. 거두려면 누르세요" onPress={() => { void cancel(); }} />
          ) : null}
          {candidates.length === 0 ? <Card><Empty mood="thinking" title="넘겨받을 사람이 없어요" sub="앱을 쓰는 회원에게만 넘길 수 있어요. 초대 코드로 먼저 들어오게 해 주세요" /></Card> : (
            <Card style={{ paddingVertical: 2 }}>
              {candidates.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <Sep /> : null}
                  <MenuRow label={m.name} value={ROLE[m.role]} onPress={() => setPick(m)} />
                </View>
              ))}
            </Card>
          )}
        </Body>
      )}
      <Ask open={!!pick} title={`${pick?.name ?? ''} 님에게 넘길까요?`} mood="cheer" onClose={() => setPick(null)}
        body="받는 분 앱에 알림이 가고, 수락하면 넘어가요. 넘어간 뒤 되돌리려면 새 총무가 다시 넘겨줘야 해요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setPick(null) }, { label: '넘기기 요청', onPress: () => { void go(); } }]} />
    </View>
  );
}

/* ── 예산 한 줄 ── */

export function BudgetLineScreen({ line, year }: { line: BudgetLine; year: number }) {
  const { group, back, bump, say, fail } = useApp();
  const [amount, setAmount] = useState(line.amount ? won(line.amount) : '');
  const [basis, setBasis] = useState(line.basis ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!group) return;
    setBusy(true);
    try {
      await cm.saveBudget(group.id, year, [{ categoryId: line.categoryId, amount: readAmount(amount) ?? 0, basis: basis.trim() || null }]);
      say('예산을 저장했어요');
      bump();
      back();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title={`${year}년 예산 · ${line.name}`} onClose={back} />
      <Body>
        <View style={{ height: 2 }} />
        <Card style={{ gap: 4 }}>
          <View style={[k.row, { justifyContent: 'space-between' }]}><Txt tone="sub">올해 집행</Txt><Txt bold style={k.amt}>{won(line.spent)}</Txt></View>
          <View style={[k.row, { justifyContent: 'space-between' }]}><Txt tone="sub">작년 집행</Txt><Txt bold style={k.amt}>{won(line.lastYear)}</Txt></View>
        </Card>
        <Field label="예산" value={amount} onChangeText={(v) => setAmount(amountInput(v))} keyboardType="number-pad" placeholder="예) 400,000" right={<Txt tone="sub">원</Txt>} />
        <Field label="산출 근거" value={basis} onChangeText={setBasis} multiline maxLength={200} placeholder="예) 월 2회 모임 × 12개월 × 인당 8,000원 기준" />
        {line.lastYear > 0 ? (
          <Pressable onPress={() => setAmount(won(line.lastYear))}><Chip label={`작년만큼(${won(line.lastYear)}) 넣기`} tone="tint" /></Pressable>
        ) : null}
        <Btn label="저장" loading={busy} onPress={() => { void save(); }} />
      </Body>
    </View>
  );
}
