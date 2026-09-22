/**
 * 기록 남기기(시안 2) — 영수증 찍기 → 읽기 → 확인 → 장부 한 줄(총무·관리자) 또는 지급 요청(회원).
 *
 *  1. 찍기    문서 스캐너(`react-native-document-scanner-plugin`, 영테크와 같은 부품) — 테두리를 잡아 반듯하게 편다.
 *             앨범에서 고를 수도 있다(`expo-image-picker`). 웹 미리보기는 앨범만.
 *  2. 읽기    `@jcurve/ocr` — `preparePhoto`(1600·방향) → `submit`(번호) → `status` 를 1.5초마다(보통 10~15초).
 *             기다리는 동안에도 항목·행사·내용을 채울 수 있다.
 *  3. 옮기기  끝나면 `POST cm/g/{gid}/receipts {ocrJobId}` — 총무님 전용 표로(사진도 서버가 복사해 보관).
 *  4. 확인    상호는 OCR 을 믿지 않는다(확인 필요 + 후보 칩). **날짜·금액도 틀릴 수 있어 고칠 수 있다**
 *             (오너 2026-09-22) — 영수증 원본 값은 서버에 그대로 남고, 다르게 적으면 장부에 「영수증과 다름」이 붙는다.
 *
 * 영수증 없이 적기(현금 수입·찬조 등)도 여기서 한다.
 *
 * 총무가 기록할 때와 회원이 요청할 때 **같은 폼**이다 — 다른 건 마지막 버튼과 회원의 「받을 계좌」 칸뿐(기획 「요청 폼은 네 칸이다」).
 * 항목은 같은 가게에 지난번 붙인 것을, 행사는 기간에 드는(없으면 하나뿐인) 진행 중 행사를 **미리 찍어 둔다** — 제안일 뿐이다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { amountInput, kstNow, readAmount, readWhen, whenLong, won } from '../cm/format';
import { isManager, type Category, type ClubEvent, type Receipt } from '../cm/model';
import { chipOrder, suggestEvent } from '../cm/rules';
import { codeOf, errorText } from '../cm/errors';
import { ocr, ocrMessage, preparePhoto, verdictMessage, type OcrResult } from '../ocr';
import { holdWebFile } from '../upload';
import { track } from '../track';
import { Ask, Body, Btn, Card, Chip, Choices, Field, Head, Sep, Soft, Tabs, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { BankField } from '../ui/BankField';
import { S, useT } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

type Step = 'pick' | 'reading' | 'ready' | 'manual';

export function RecordScreen({ start }: { start: 'scan' | 'album' | 'manual' }) {
  const { group, back, bump, say, open, reloadGroup } = useApp();
  const T = useT();
  const kb = useKeyboardPad();
  const manager = group ? isManager(group.me.role) : false;
  const cats = useLoad(cm.categories);
  const evs = useLoad(cm.events);

  const [step, setStep] = useState<Step>(start === 'manual' ? 'manual' : 'pick');
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);          // 읽기 결과 안내(반려 사유 등)
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(kstNow().ymd);
  const [time, setTime] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventTouched, setEventTouched] = useState(false);
  const [bankName, setBankName] = useState(group?.me.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(group?.me.bankAccount ?? '');
  const [bankHolder, setBankHolder] = useState(group?.me.bankHolder ?? '');
  const [addCat, setAddCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [bankAsk, setBankAsk] = useState<null | { skip: boolean }>(null);   // 처음 적은 계좌 — 등록해 둘지 묻는 중
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const categories: Category[] = chipOrder((cats.data ?? []).filter((c) => !c.hidden && c.kind === direction));
  // 행사 칸은 진행 중인 행사가 있을 때만(시안 2)
  const openEvents: ClubEvent[] = (evs.data ?? []).filter((e) => e.status === 'open');

  // 행사를 사람이 고르기 전까지는 날짜에 맞춰 미리 찍어 둔다(기간 안 → 하나뿐인 진행 중 행사)
  useEffect(() => {
    if (eventTouched || direction !== 'out' || !evs.data) return;
    setEventId(suggestEvent(evs.data, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null));
  }, [evs.data, date, eventTouched, direction]);

  /* ── 1. 찍기 · 고르기 ── */

  const scan = async () => {
    setNote(null);
    if (Platform.OS === 'web') { void album(); return; }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setNote('카메라를 쓸 수 있게 허락해 주세요. 설정에서 바꿀 수 있어요'); return; }
      const { default: scanner, ResponseType } = await import('react-native-document-scanner-plugin');
      const r = await scanner.scanDocument({ maxNumDocuments: 1, croppedImageQuality: 90, responseType: ResponseType.ImageFilePath });
      if (r.status === 'cancel') return;
      const imgs = r.scannedImages ?? [];
      // 여러 장이 찍히면 조용히 버리지 않는다(영테크 규칙) — 한 장씩 올리게 한다
      if (imgs.length > 1) { setNote('영수증은 한 장씩 찍어 주세요'); return; }
      if (!imgs[0]) return;
      await read(imgs[0]);
    } catch {
      setNote('카메라를 열지 못했어요. 앨범에서 골라 주세요');
    }
  };

  const album = async () => {
    setNote(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, exif: false });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if (Platform.OS === 'web') holdWebFile((a as unknown as { file?: Blob }).file ?? null);
    await read(a.uri);
  };

  // 들어오자마자 찍기(가운데 카메라 버튼) — 앨범으로 왔으면 앨범
  useEffect(() => {
    if (start === 'scan') void scan();
    if (start === 'album') void album();
    // 처음 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 2·3. 읽기 · 옮기기 ── */

  const read = async (uri: string) => {
    if (!group) return;
    setPhoto(uri);
    setStep('reading');
    track('receipt_submit');
    try {
      const prepared = await preparePhoto({ uri });
      const id = await ocr.submit(prepared);
      const until = Date.now() + 60_000;
      let result: OcrResult | null = null;
      for (;;) {
        if (!alive.current) return;
        const st = await ocr.status(id);
        if (st.status === 'done' && st.result) { result = st.result; break; }
        if (st.status === 'failed') throw Object.assign(new Error('ocr_failed'), { code: 'ocr_failed' });
        if (Date.now() > until) throw Object.assign(new Error('timeout'), { code: 'timeout' });
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (result.verdict === 'rejected') {
        setNote(verdictMessage(result));
        setStep('pick');

        return;
      }
      const rc = await cm.attachReceipt(group.id, id);
      if (!alive.current) return;
      setReceipt(rc);
      setMerchant(rc.merchant ?? '');
      // 같은 가게에 지난번 붙인 항목 — 사람이 이미 골랐으면 두고
      if (rc.suggestCategoryId) setCategoryId((cur) => cur ?? rc.suggestCategoryId);
      if (rc.total) setAmount(won(rc.total));
      if (rc.paidAt) {
        setDate(rc.paidAt.slice(0, 10));
        const hm = rc.paidAt.slice(11, 16);
        setTime(hm === '00:00' ? '' : hm);
      }
      setNote(result.verdict === 'review' ? '몇 칸은 자신이 없어요. 한 번 봐 주세요' : null);
      setStep('ready');
    } catch (e) {
      const code = codeOf(e);
      // 앱 관리에서 영수증 읽기가 꺼져 있으면(ocr_disabled) 직접 적는다
      setNote(code === 'ocr_disabled' || code === 'ocr_failed' || code === 'timeout' || code === 'bad_response'
        ? ocrMessage(code) : errorText(code));
      setStep(code === 'ocr_disabled' ? 'manual' : 'pick');
    }
  };

  /* ── 4. 기록 ── */

  const amountValue = readAmount(amount);
  const when = readWhen(date, time);
  const bankOk = manager || bankAccount.trim() !== '';
  // 같은 사진을 또 고른 것 — 서버가 receipt_used 로 거절하니 처음부터 막고 다시 찍기로 보낸다
  const used = !!receipt?.duplicate?.used;
  const canSave = !!amountValue && !!when && bankOk && !busy && !used && (step === 'ready' || step === 'manual');

  /*
   | 받을 계좌를 등록해 두지 않은 회원이 여기서 처음 적었으면 — 보내기 전에 「등록해 두고 쓸까요?」를 묻는다(2026-09-22 태훈님).
   | 등록하면 내 정보에 남아 다음부터 자동으로 채워지고, 이번만이면 이 요청에만 싣는다(서버 `bank`).
   | 이미 등록한 계좌를 고쳐 적은 것은 묻지 않고 바꾼다(한 번 적으면 다음부터 자동 — 전과 같다).
   */
  const firstBank = !manager && !group?.me.bankAccount && bankAccount.trim() !== '';
  const submit = (skip: boolean) => { if (firstBank) setBankAsk({ skip }); else void save(skip); };

  const save = async (skip: boolean, once = false) => {
    if (!group || !amountValue || !when) return;
    setBusy(true);
    const body = {
      amount: amountValue, occurredAt: when, merchant: merchant.trim() || null,
      categoryId: skip ? null : categoryId, eventId: skip ? null : eventId, memo: skip ? null : memo.trim() || null,
      ...(receipt ? { receiptId: receipt.id } : {}),
    };
    try {
      if (manager) {
        await cm.addEntry(group.id, { direction, ...body });
        say(skip ? '장부에 적었어요 · 항목은 나중에 정리해요' : '장부에 적었어요');
      } else {
        // 받을 계좌 — 한 번 적으면 다음부터 자동(바뀌었을 때만 저장)
        const me = group.me;
        const bank = { name: bankName.trim() || null, account: bankAccount.trim() || null, holder: bankHolder.trim() || null };
        if (!once && (bankName.trim() !== (me.bankName ?? '') || bankAccount.trim() !== (me.bankAccount ?? '') || bankHolder.trim() !== (me.bankHolder ?? ''))) {
          await cm.updateMe(group.id, { bankName: bank.name, bankAccount: bank.account, bankHolder: bank.holder });
          void reloadGroup();
        }
        await cm.addRequest(group.id, once ? { ...body, bank } : body);
        say('지급 요청을 보냈어요 · 총무님이 확인하면 알려 드려요');
      }
      track(manager ? 'entry_add' : 'request_add', { receipt: !!receipt, skip });
      bump();
      back();
    } catch (e) {
      const code = codeOf(e);
      if (code === 'bank_required') { say(errorText(code)); open({ kind: 'profile' }); }
      else say(errorText(code));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!group || !newCat.trim()) return;
    try {
      const list = await cm.addCategory(group.id, newCat.trim(), direction);
      const made = list.find((c) => c.name === newCat.trim() && c.kind === direction);
      cats.reload();
      if (made) setCategoryId(made.id);
      setNewCat('');
      setAddCat(false);
    } catch (e) {
      say(errorText(codeOf(e)));
    }
  };

  const edited = useMemo(() => {
    if (!receipt) return false;
    const amtDiff = receipt.total !== null && amountValue !== receipt.total;
    const dateDiff = !!receipt.paidAt && when !== null && receipt.paidAt.slice(0, 10) !== when.slice(0, 10);

    return amtDiff || dateDiff;
  }, [receipt, amountValue, when]);

  const title = manager ? '기록 남기기' : '지급 요청하기';

  return (
    <View style={{ flex: 1 }}>
      <Head title={title} onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        {step === 'pick' ? (
          <>
            <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
              <Mascot mood={note ? 'confused' : 'receipt'} size={88} />
              <Txt bold size="head">{note ? '다시 해 볼까요?' : '영수증을 찍어 주세요'}</Txt>
              <Txt size="small" tone="sub" style={{ textAlign: 'center' }}>{note ?? '테두리를 잡아 반듯하게 펴 드려요. 날짜와 금액은 알아서 읽어요.'}</Txt>
            </Card>
            {Platform.OS !== 'web' ? <Btn label="영수증 찍기" onPress={() => { void scan(); }} /> : null}
            <Btn label="앨범에서 고르기" tone={Platform.OS === 'web' ? 'main' : 'ghost'} onPress={() => { void album(); }} />
            <Btn label="영수증 없이 적기" tone="ghost" onPress={() => { setNote(null); setStep('manual'); }} />
          </>
        ) : null}

        {step === 'reading' ? (
          <Card style={[k.row, { gap: S.md }]}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 64, height: 84, borderRadius: 10, backgroundColor: T.track }} /> : null}
            <View style={[k.grow, { gap: 4 }]}>
              <Txt bold>영수증을 읽고 있어요</Txt>
              <Txt size="small" tone="sub">보통 10~15초 걸려요. 그동안 아래 칸을 채워도 돼요.</Txt>
            </View>
            <Mascot mood="search" size={52} />
          </Card>
        ) : null}

        {step === 'ready' || step === 'reading' || step === 'manual' ? (
          <>
            {step === 'manual' && manager ? (
              <Tabs items={[{ id: 'out', label: '지출' }, { id: 'in', label: '수입' }]} value={direction}
                onChange={(d) => { setDirection(d); setCategoryId(null); }} />
            ) : null}
            {note && step !== 'reading' ? <Soft tone="warn" title={note} /> : null}
            {receipt?.duplicate ? (
              <Soft tone="warn" title={used ? '이미 장부에 적은 영수증이에요' : '이미 올린 영수증 같아요'}
                sub={`${whenLong(receipt.duplicate.occurredAt)} · ${won(receipt.duplicate.amount)}원 — ${used ? '다른 영수증을 찍어 주세요' : '그래도 적을 수 있어요'}`} />
            ) : null}

            {step !== 'reading' ? (
              <Card style={{ gap: S.sm }}>
                <View style={[k.row, { gap: 7 }]}>
                  <Txt size="small" tone="sub" bold>{direction === 'in' ? '누구에게 · 무엇' : '상호'}</Txt>
                  {receipt?.needsCheck && merchant ? <Chip label="확인 필요" tone="warn" /> : null}
                </View>
                <Field value={merchant} onChangeText={setMerchant} placeholder={direction === 'in' ? '예) 찬조 · 이성호' : '예) GS25 수유점'} maxLength={60}
                  right={<Txt style={{ color: T.deep }}>✎</Txt>} />
                {receipt && receipt.candidates.length > 0 ? (
                  <View style={[k.row, k.wrap, { gap: 5 }]}>
                    <Txt size="tiny" tone="sub">읽은 후보</Txt>
                    {receipt.candidates.map((c) => <Chip key={c} label={c} onPress={() => setMerchant(c)} tone={c === merchant ? 'tint' : 'plain'} />)}
                  </View>
                ) : null}
                <Sep style={{ marginVertical: 3 }} />
                <View style={[k.row, { gap: S.sm }]}>
                  <Field style={{ flex: 1.3 }} value={date} onChangeText={setDate} placeholder="2026-09-21" maxLength={10} inputStyle={{ fontSize: 15.5 }} />
                  <Field style={{ flex: 0.9 }} value={time} onChangeText={setTime} placeholder="14:14" maxLength={5} inputStyle={{ fontSize: 15.5 }} />
                </View>
                <Field value={amount} onChangeText={(v) => setAmount(amountInput(v))} keyboardType="number-pad" placeholder="금액"
                  inputStyle={{ fontSize: 22, fontWeight: '900' }} right={<Txt tone="sub">원</Txt>} />
                <Txt size="tiny" tone={edited ? 'warn' : 'dim'}>
                  {receipt
                    ? edited ? `영수증에는 ${receipt.paidAt ? whenLong(receipt.paidAt) + ' · ' : ''}${receipt.total ? won(receipt.total) + '원' : ''}으로 읽혔어요. 고친 값으로 적고 「영수증과 다름」을 붙여요`
                      : '영수증에서 읽은 값이에요. 틀리면 고쳐 주세요'
                    : when ? whenLong(when) : '날짜는 2026-09-21 처럼 적어요'}
                </Txt>
                {/* 산 것 — 모임 돈은 합계만으로는 어디에 썼는지 모른다(2026-09-22 태훈님). 영수증 보기와 같은 줄 모양 */}
                {receipt ? (
                  <>
                    <Sep style={{ marginVertical: 3 }} />
                    <Txt size="small" tone="sub" bold>{receipt.items.length ? `산 것 ${receipt.items.length}가지` : '산 것'}</Txt>
                    {receipt.items.length ? receipt.items.map((i, n) => (
                      <View key={n} style={[k.row, { justifyContent: 'space-between', gap: S.sm }]}>
                        <Txt size="small" style={k.grow} numberOfLines={2}>{i.name}{i.count > 1 ? ` ×${i.count}` : ''}</Txt>
                        <Txt size="small" style={k.amt}>{i.price !== null ? won(i.price) : ''}</Txt>
                      </View>
                    )) : <Txt size="tiny" tone="dim">품목은 읽지 못했어요. 무엇을 샀는지 아래 「내용」에 적어 두면 회원들이 알아봐요</Txt>}
                  </>
                ) : null}
              </Card>
            ) : null}

            {openEvents.length > 0 && direction === 'out' ? (
              <View style={{ gap: 6 }}>
                <Txt bold>행사</Txt>
                <Choices items={[...openEvents.map((e) => ({ id: e.id, label: e.name })), { id: 0, label: '없음' }]} value={eventId ?? 0}
                  onChange={(id) => { setEventTouched(true); setEventId(id === 0 ? null : id); }} />
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Txt bold>항목</Txt>
              <Choices items={categories.map((c) => ({ id: c.id, label: c.parentId ? '· ' + c.name : c.name }))} value={categoryId}
                onChange={(id) => setCategoryId(id === categoryId ? null : id)}
                extra={manager ? <Chip label="+ 직접 입력" tone="dim" onPress={() => setAddCat(true)} /> : undefined} />
            </View>

            <Field label="내용" value={memo} onChangeText={setMemo} placeholder="예) 체육대회 단체 티셔츠 25장" multiline maxLength={200} />

            {!manager ? (
              <Card style={{ gap: S.sm }}>
                <Txt size="small" tone="sub" bold>받을 계좌</Txt>
                <View style={[k.row, { gap: S.sm }]}>
                  <BankField style={{ flex: 0.8 }} value={bankName} onChange={setBankName} />
                  <Field style={{ flex: 1.4 }} value={bankAccount} onChangeText={setBankAccount} placeholder="계좌번호" keyboardType="numbers-and-punctuation"
                    maxLength={40} inputStyle={{ fontSize: 15.5 }} />
                </View>
                <Field value={bankHolder} onChangeText={setBankHolder} placeholder="예금주" maxLength={30} inputStyle={{ fontSize: 15.5 }} />
                <Txt size="tiny" tone="dim">{group?.me.bankAccount
                  ? '내 정보에 등록한 계좌예요. 고쳐 적으면 등록한 계좌도 바뀌어요. 총무·관리자만 전체 번호를 봐요.'
                  : '처음 적는 계좌예요. 요청할 때 등록해 둘지 여쭤볼게요. 총무·관리자만 전체 번호를 봐요.'}</Txt>
              </Card>
            ) : null}

            <View style={[k.row, { gap: 9 }]}>
              <Mascot mood="calculator" size={46} />
              <Card style={[k.grow, { paddingVertical: 10, paddingHorizontal: 12 }]}>
                <Txt size="small" tone="sub" style={{ lineHeight: 20 }}>항목·내용은 비워두셔도 돼요. 나중에 정리할 때 채우면 됩니다.</Txt>
              </Card>
            </View>

            <View style={[k.row, { gap: S.sm, paddingTop: 2 }]}>
              <Btn label="건너뛰기" tone="ghost" style={{ width: 104 }} disabled={!canSave} onPress={() => submit(true)} />
              <Btn label={manager ? '기록하기' : '지급 요청하기'} style={k.grow} disabled={!canSave} loading={busy} onPress={() => submit(false)} />
            </View>
            {step === 'ready' ? (
              <Pressable onPress={() => { setReceipt(null); setStep('pick'); }} style={{ alignSelf: 'center', padding: S.sm }}>
                <Txt size="small" tone="sub">다시 찍기</Txt>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Body>

      <Ask open={addCat} title="항목 만들기" onClose={() => setAddCat(false)}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAddCat(false) }, { label: '만들기', onPress: () => { void addCategory(); } }]}>
        <Field value={newCat} onChangeText={setNewCat} placeholder={direction === 'in' ? '예) 후원금' : '예) 경조사비'} maxLength={20} autoFocus />
      </Ask>

      <Ask open={bankAsk !== null} title="이 계좌를 등록해 둘까요?" mood="coin" onClose={() => setBankAsk(null)}
        body={`${[bankName.trim(), bankAccount.trim(), bankHolder.trim()].filter(Boolean).join(' · ')}\n\n등록해 두면 다음 요청부터 자동으로 채워져요. 설정 › 내 정보에서 바꿀 수 있어요.`}
        buttons={[
          { label: '이번만 쓰기', tone: 'ghost', onPress: () => { const a = bankAsk; setBankAsk(null); if (a) void save(a.skip, true); } },
          { label: '등록하고 요청', onPress: () => { const a = bankAsk; setBankAsk(null); if (a) void save(a.skip); } },
        ]} />
    </View>
  );
}
