/**
 * 기록 남기기(시안 2) — 영수증 찍기 → 읽기 → 확인 → 장부 한 줄(총무·관리자) 또는 지급 요청(회원).
 *
 *  1. 찍기    문서 스캐너(`react-native-document-scanner-plugin`, 영테크와 같은 부품) — 테두리를 잡아 반듯하게 편다.
 *             앨범에서 고를 수도 있다(`expo-image-picker`). 웹 미리보기는 앨범만. **여러 장을 한 번에**(최대 10장, 2026-09-22 태훈님).
 *  2. 살피기  **보내기 전에 한 장씩 본다**(2026-09-22 태훈님) — 시계 방향 회전 · 180° 뒤집기 · 빼기. 돌리면 픽셀을 돌려 새 파일로
 *             저장한다(영테크 turnReceiptImage 와 같은 방식). 한 장이어도 같다. 「N장 전송하기」를 눌러야 올라간다.
 *  3. 읽기    전송하면 읽기 줄(`receiptQueue` — 화면과 떨어져 돈다)에 선다: 올리기 → 워커 → 총무님 표로 옮기기.
 *             그리고 묻는다 — **지금 기록**(이 화면에서 읽히는 대로 확인) / **나중에 기록**(닫고, 다 읽히면 홈 띠에서 이어서).
 *  4. 확인    읽은 값은 **확인 카드**로 보인다 — 입력칸이 아니라 글자로(2026-09-22 태훈님 「알아서 채워지는데 매번 입력 창이
 *             뜨는 게 이상」). 항목·행사는 제안이 미리 골라진 칩, 상호·날짜·금액은 「고치기」를 눌렀을 때만 칸이 열린다.
 *             상호는 OCR 을 믿지 않는다(확인 필요 + 후보 칩). 금액·날짜를 다르게 적으면 장부에 「영수증과 다름」이 붙는다.
 *             여러 장이면 카드가 쌓이고 「N장 모두 기록하기」 한 번으로 넣는다.
 *
 * 영수증 없이 적기(현금 수입·찬조 등)는 전처럼 칸을 채우는 폼이다 — 읽은 값이 없으니까.
 *
 * 총무가 기록할 때와 회원이 요청할 때 **같은 화면**이다 — 다른 건 마지막 버튼과 회원의 「받을 계좌」 칸뿐(기획 「요청 폼은 네 칸이다」).
 * 항목은 같은 가게에 지난번 붙인 것을, 행사는 기간에 드는(없으면 하나뿐인) 진행 중 행사를 **미리 찍어 둔다** — 제안일 뿐이다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { amountInput, kstNow, readAmount, readWhen, whenLong, won } from '../cm/format';
import { isManager, type Category, type ClubEvent } from '../cm/model';
import { chipOrder, suggestEvent } from '../cm/rules';
import { codeOf, errorText } from '../cm/errors';
import {
  MAX_SHOTS, emptyForm, isEdited, isUsed, itemsLine, mergeShots, shotBody, type Shot, type ShotForm,
} from '../cm/shots';
import * as queue from '../receiptQueue';
import { isPro } from '../cm/plan';
import { track } from '../track';
import { Ask, Body, Btn, Card, Chip, Choices, Field, Head, Sep, Soft, Tabs, Text, Txt, s as k } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { BankField } from '../ui/BankField';
import { DateField } from '../ui/DateField';
import { ScanIntro } from '../ui/ScanIntro';
import * as storage from '../storage';
import { F, S, useT } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

type Step = 'pick' | 'review' | 'shots' | 'manual';
type Picked = { uri: string; file?: Blob | null };
type Draft = Picked & { key: string };

/**
 * 사진을 돌려 **새 파일로** 저장한다 — 보이는 것만이 아니라 올라가는 픽셀도(영테크 turnReceiptImage 와 같은 방식).
 * 웹 미리보기는 올릴 파일(Blob)도 새것으로 바꾼다.
 */
async function turn(d: Draft, deg: 90 | 180): Promise<Draft> {
  const ctx = ImageManipulator.manipulate(d.uri);
  try {
    ctx.rotate(deg);
    const img = await ctx.renderAsync();
    try {
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      const file = Platform.OS === 'web' ? await (await fetch(out.uri)).blob() : d.file;

      return { ...d, uri: out.uri, file };
    } finally {
      img.release();
    }
  } finally {
    ctx.release();
  }
}

export function RecordScreen({ start }: { start: 'scan' | 'album' | 'manual' | 'pending' }) {
  const { group, back, bump, say, open, reloadGroup } = useApp();
  const kb = useKeyboardPad();
  const manager = group ? isManager(group.me.role) : false;
  const cats = useLoad(cm.categories);
  const evs = useLoad(cm.events);
  const today = kstNow().ymd;

  // 홈의 「기록 기다림」에서 왔으면 바로 카드로
  const [step, setStep] = useState<Step>(start === 'manual' ? 'manual' : start === 'pending' ? 'shots' : 'pick');
  const [note, setNote] = useState<string | null>(null);          // 고르기 화면의 안내(못 읽은 까닭 등)
  const [shots, setShots] = useState<Shot[]>([]);                 // 읽기 줄에 선 장(이 모임) — receiptQueue 를 따라간다
  const [drafts, setDrafts] = useState<Draft[]>([]);              // 보내기 전에 살피는 장
  const [turning, setTurning] = useState<string | null>(null);    // 돌리는 중인 장
  const [sent, setSent] = useState<{ batch: string; n: number } | null>(null);   // 방금 보낸 묶음 — 지금 기록 / 나중에 기록
  // 영수증 없이 적기
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [form, setForm] = useState<ShotForm>(emptyForm(today));
  const [manualTouched, setManualTouched] = useState(false);
  // 회원의 받을 계좌 — 여러 장이어도 한 번
  const [bankName, setBankName] = useState(group?.me.bankName ?? '');
  const [bankAccount, setBankAccount] = useState(group?.me.bankAccount ?? '');
  const [bankHolder, setBankHolder] = useState(group?.me.bankHolder ?? '');
  const [bankAsk, setBankAsk] = useState<null | { skip: boolean }>(null);   // 처음 적은 계좌 — 등록해 둘지 묻는 중
  const [busy, setBusy] = useState(false);
  const [addCatFor, setAddCatFor] = useState<string | null>(null);         // 항목 만들기 — 'manual' 또는 카드 key
  const [newCat, setNewCat] = useState('');
  const [intro, setIntro] = useState(false);            // 안드로이드 첫 스캔 안내
  const [scanFailed, setScanFailed] = useState(false);  // 스캐너가 안 열렸다 — 일반 촬영 버튼

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  const evsRef = useRef<ClubEvent[]>([]);
  evsRef.current = evs.data ?? [];
  // 무료는 한 번에 한 장(2026-09-22 태훈님) — 여러 장은 구독
  const maxShots = isPro(group) ? MAX_SHOTS : 1;

  // 읽기 줄을 따라간다 — 올리는 중 · 읽는 중 · 읽음 · 못 읽음. 사람이 보고 있는 카드는 그대로(mergeShots)
  const gid = group?.id ?? 0;
  useEffect(() => {
    if (!gid) return;
    const sync = () => setShots((cur) => mergeShots(cur, queue.list(gid), today, (d) => suggestEvent(evsRef.current, d)));
    sync();

    return queue.subscribe(gid, sync);
    // 모임이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);
  // 카드를 다 빼면(또는 다 기록하면) 고르기로 — 홈에서 왔으면 줄을 받아 온 뒤에만
  const hadShots = useRef(false);
  if (shots.length) hadShots.current = true;
  useEffect(() => {
    if (step === 'shots' && shots.length === 0 && (start !== 'pending' || hadShots.current)) setStep('pick');
  }, [step, shots.length, start]);
  // 살피던 장을 다 빼면 — 카드가 있으면 카드로, 없으면 고르기로(전송해서 비운 때는 묻는 창이 정한다)
  useEffect(() => {
    if (step === 'review' && drafts.length === 0 && sent === null) setStep(shotsRef.current.length ? 'shots' : 'pick');
  }, [step, drafts.length, sent]);

  const categoriesOf = (dir: 'in' | 'out'): Category[] => chipOrder((cats.data ?? []).filter((c) => !c.hidden && c.kind === dir));
  // 행사 칸은 진행 중인 행사가 있을 때만(시안 2)
  const openEvents: ClubEvent[] = (evs.data ?? []).filter((e) => e.status === 'open');
  const ymd = (d: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  // 행사 목록이 늦게 오면 — 사람이 고르기 전인 것만 날짜에 맞춰 찍어 둔다
  useEffect(() => {
    if (!evs.data) return;
    const list = evs.data;
    setShots((cur) => cur.map((s) => (s.state === 'ready' && !s.eventTouched ? { ...s, form: { ...s.form, eventId: suggestEvent(list, ymd(s.form.date)) } } : s)));
    if (!manualTouched && direction === 'out') setForm((f) => ({ ...f, eventId: suggestEvent(list, ymd(f.date)) }));
    // 목록이 왔을 때 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evs.data]);

  const patch = (key: string, fn: (s: Shot) => Shot) => setShots((cur) => cur.map((s) => (s.key === key ? fn(s) : s)));
  /** 카드 빼기 — 읽기 줄에서도 뺀다 */
  const remove = (key: string) => queue.remove([key]);

  /* ── 1. 찍기 · 고르기 → 2. 살피기 ── */

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const take = (list: Picked[]) => {
    const room = maxShots - shotsRef.current.length - draftsRef.current.length;
    if (room <= 0) { say(maxShots === 1 ? '무료는 한 번에 한 장이에요 · 먼저 기록하고 다음 장을 올려 주세요' : `한 번에 ${maxShots}장까지예요`); return; }
    if (list.length > room) {
      say(maxShots === 1 ? '무료는 한 번에 한 장이에요 · 첫 장만 골랐어요 · 여러 장은 구독에서' : `${maxShots}장까지만 올려요 · 나머지는 기록한 뒤에 다시 골라 주세요`);
    }
    const stamp = Date.now();
    setNote(null);
    setDrafts((cur) => [...cur, ...list.slice(0, room).map((p, i) => ({ ...p, key: `${stamp}-${i}` }))]);
    setStep('review');
  };

  /** 한 장 돌리기 — 시계 방향 90° 또는 180° */
  const rotate = async (key: string, deg: 90 | 180) => {
    const d = draftsRef.current.find((x) => x.key === key);
    if (!d || turning) return;
    setTurning(key);
    try {
      const next = await turn(d, deg);
      setDrafts((cur) => cur.map((x) => (x.key === key ? next : x)));
    } catch {
      say('사진을 돌리지 못했어요 · 다시 해 주세요');
    } finally {
      setTurning(null);
    }
  };

  /** 전송 — 읽기 줄에 세우고, 지금 기록할지 나중에 기록할지 묻는다(한 장이어도 같다) */
  const sendDrafts = () => {
    if (!group || !drafts.length) return;
    track('receipt_submit', { batch: drafts.length });
    const batch = `${Date.now()}`;
    void queue.add(group.id, batch, drafts);
    setSent({ batch, n: drafts.length });
    setDrafts([]);
  };

  const scan = async () => {
    setNote(null);
    setScanFailed(false);
    if (Platform.OS === 'web') { void album(); return; }
    // 안드로이드 첫 스캔 — 구글 플레이가 모듈을 받는다고 먼저 알린다(기기마다 한 번, 영테크와 같은 안내)
    if (Platform.OS === 'android' && (await storage.get('cm.scanIntro')) !== '1') { setIntro(true); return; }
    await openScanner();
  };

  const openScanner = async () => {
    try {
      /*
       | 카메라 권한은 **아이폰만** 묻는다(VisionKit 은 앱 권한이 필요하다). 안드로이드 스캐너는 구글 Play 서비스 화면이라
       | 앱 권한이 필요 없고, 여기서 「이번만 허용」을 고르면 스캐너가 떠 있는 동안 권한이 거둬져 **앱이 죽고 찍은 사진을 잃었다**
       | (2026-09-22 앱빌드 A32 — one-time permission revoked).
       */
      if (Platform.OS === 'ios') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setNote('카메라를 쓸 수 있게 허락해 주세요. 설정에서 바꿀 수 있어요'); return; }
      }
      const { default: scanner, ResponseType } = await import('react-native-document-scanner-plugin');
      // 여러 장 — 한 장 찍고 이어서 찍으면 된다(안드로이드는 maxNumDocuments 까지, 아이폰 VisionKit 은 원래 여러 장)
      const r = await scanner.scanDocument({ maxNumDocuments: maxShots, croppedImageQuality: 90, responseType: ResponseType.ImageFilePath });
      if (r.status === 'cancel') return;
      const imgs = r.scannedImages ?? [];
      if (imgs.length) take(imgs.map((uri) => ({ uri })));
    } catch {
      // 구글 모듈을 못 받았거나 스캐너가 안 열린다 — 앱 카메라로 그냥 찍는 길을 준다(영테크와 같다)
      setNote('자동 스캔을 열지 못했어요. 다시 해 보거나 일반 촬영으로 찍어 주세요');
      setScanFailed(true);
    }
  };

  /** 일반 촬영 — 스캐너가 안 열릴 때(테두리 보정 없이 사진 그대로) */
  const plainCamera = async () => {
    setNote(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setNote('카메라를 쓸 수 있게 허락해 주세요. 설정에서 바꿀 수 있어요'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (r.canceled || !r.assets[0]) return;
    take([{ uri: r.assets[0].uri }]);
  };

  const album = async () => {
    setNote(null);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.85, exif: false,
      allowsMultipleSelection: maxShots > 1, selectionLimit: maxShots, orderedSelection: true,
    });
    if (r.canceled || !r.assets.length) return;
    take(r.assets.map((a) => ({ uri: a.uri, file: Platform.OS === 'web' ? (a as unknown as { file?: Blob }).file ?? null : null })));
  };

  // 들어오자마자 찍기(가운데 카메라 버튼) — 앨범으로 왔으면 앨범
  useEffect(() => {
    if (start === 'scan') void scan();
    if (start === 'album') void album();
    // 처음 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 4. 기록 ── */

  const bank = () => ({ name: bankName.trim() || null, account: bankAccount.trim() || null, holder: bankHolder.trim() || null });
  const bankOk = manager || bankAccount.trim() !== '';
  /*
   | 받을 계좌를 등록해 두지 않은 회원이 여기서 처음 적었으면 — 보내기 전에 「등록해 두고 쓸까요?」를 묻는다(2026-09-22 태훈님).
   | 등록하면 내 정보에 남아 다음부터 자동으로 채워지고, 이번만이면 이 요청에만 싣는다(서버 `bank`).
   | 이미 등록한 계좌를 고쳐 적은 것은 묻지 않고 바꾼다(한 번 적으면 다음부터 자동 — 전과 같다).
   */
  const firstBank = !manager && !group?.me.bankAccount && bankAccount.trim() !== '';

  /** 받을 계좌를 내 정보에 — 이번만 쓰기가 아니고 바뀌었을 때만 */
  const keepBank = async (once: boolean) => {
    if (!group || manager || once) return;
    const me = group.me;
    const b = bank();
    if ((b.name ?? '') !== (me.bankName ?? '') || (b.account ?? '') !== (me.bankAccount ?? '') || (b.holder ?? '') !== (me.bankHolder ?? '')) {
      await cm.updateMe(group.id, { bankName: b.name, bankAccount: b.account, bankHolder: b.holder });
      void reloadGroup();
    }
  };

  type SendBody = NonNullable<ReturnType<typeof shotBody>> | Omit<NonNullable<ReturnType<typeof shotBody>>, 'receiptId'>;
  const sendOne = async (body: SendBody, dir: 'in' | 'out', once: boolean) => {
    if (!group) return;
    if (manager) await cm.addEntry(group.id, { direction: dir, ...body });
    else await cm.addRequest(group.id, once ? { ...body, bank: bank() } : body);
  };

  /** 영수증 카드들 — 보낼 수 있는 것을 모두. 실패한 카드는 사유를 달아 남긴다 */
  const saveShots = async (once: boolean) => {
    if (!group) return;
    const list = shotsRef.current.flatMap((s) => { const b = shotBody(s); return b ? [{ key: s.key, body: b }] : []; });
    if (!list.length) return;
    setBusy(true);
    const done = new Set<string>();
    const why: Record<string, string> = {};
    try {
      await keepBank(once);
      for (const { key, body } of list) {
        try {
          await sendOne(body, 'out', once);
          done.add(key);
        } catch (e) {
          const code = codeOf(e);
          why[key] = errorText(code);
          if (code === 'bank_required') { say(errorText(code)); open({ kind: 'profile' }); break; }
        }
      }
    } catch (e) {
      say(errorText(codeOf(e)));
    } finally {
      setBusy(false);
    }
    if (!done.size) return;
    track(manager ? 'entry_add' : 'request_add', { receipt: true, count: done.size, batch: list.length > 1 });
    bump();
    const left = shotsRef.current.filter((s) => !done.has(s.key));
    const word = manager ? `${done.size > 1 ? `${done.size}장을 ` : ''}장부에 적었어요` : `${done.size > 1 ? `${done.size}건 ` : ''}지급 요청을 보냈어요`;
    // 못 읽은 장만 남았으면 닫는다 — 다시 찍으면 되니까
    // 못 읽은 장 · 이미 장부에 적은 장만 남았으면 닫는다 — 빼서 홈 띠에 남지 않게(2026-09-23 A32: 이미 적은 장이 띠에 남았다)
    if (left.every((s) => (s.state === 'failed' || isUsed(s)) && !why[s.key])) {
      queue.forget([...done]);                  // 기록한 장 — 서버 기다림에서 저절로 빠진다
      queue.remove(left.map((s) => s.key));
      say(left.length ? `${word} · 못 읽었거나 이미 적은 ${left.length}장은 뺐어요` : manager ? word : `${word} · 총무님이 확인하면 알려 드려요`);
      back();

      return;
    }
    setShots(left.map((s) => (why[s.key] ? { ...s, note: why[s.key] } : s)));
    queue.forget([...done]);
    say(`${word} · 남은 ${left.length}장을 확인해 주세요`);
  };

  /** 영수증 없이 적기 */
  const saveManual = async (skip: boolean, once: boolean) => {
    if (!group) return;
    const amount = readAmount(form.amount);
    const occurredAt = readWhen(form.date, form.time);
    if (!amount || !occurredAt) return;
    setBusy(true);
    try {
      await keepBank(once);
      await sendOne({
        amount, occurredAt, merchant: form.merchant.trim() || null,
        categoryId: skip ? null : form.categoryId, eventId: skip ? null : form.eventId, memo: skip ? null : form.memo.trim() || null,
      }, direction, once);
      say(manager ? (skip ? '장부에 적었어요 · 항목은 나중에 정리해요' : '장부에 적었어요') : '지급 요청을 보냈어요 · 총무님이 확인하면 알려 드려요');
      track(manager ? 'entry_add' : 'request_add', { receipt: false, skip });
      bump();
      back();
    } catch (e) {
      const code = codeOf(e);
      say(errorText(code));
      if (code === 'bank_required') open({ kind: 'profile' });
    } finally {
      setBusy(false);
    }
  };

  const submit = (skip: boolean) => {
    if (firstBank) { setBankAsk({ skip }); return; }
    if (step === 'shots') void saveShots(false); else void saveManual(skip, false);
  };
  const afterAsk = (once: boolean) => {
    const a = bankAsk;
    setBankAsk(null);
    if (!a) return;
    if (step === 'shots') void saveShots(once); else void saveManual(a.skip, once);
  };

  const addCategory = async () => {
    if (!group || !newCat.trim() || !addCatFor) return;
    const dir = addCatFor === 'manual' ? direction : 'out';
    try {
      const list = await cm.addCategory(group.id, newCat.trim(), dir);
      const made = list.find((c) => c.name === newCat.trim() && c.kind === dir);
      cats.reload();
      if (made) {
        if (addCatFor === 'manual') setForm((f) => ({ ...f, categoryId: made.id }));
        else patch(addCatFor, (s) => ({ ...s, form: { ...s.form, categoryId: made.id } }));
      }
      setNewCat('');
      setAddCatFor(null);
    } catch (e) {
      say(errorText(codeOf(e)));
    }
  };

  const reading = shots.filter((s) => s.state === 'reading').length;
  const sendable = shots.filter((s) => shotBody(s) !== null).length;
  const title = manager ? '기록 남기기' : '지급 요청하기';
  const cta = (n: number) => (manager ? (n > 1 ? `${n}장 모두 기록하기` : '기록하기') : (n > 1 ? `${n}건 지급 요청하기` : '지급 요청하기'));

  return (
    <View style={{ flex: 1 }}>
      <Head title={title} onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        {step === 'pick' ? (
          <>
            <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
              <Mascot mood={note ? 'confused' : 'receipt'} size={88} />
              <Txt bold size="head">{note ? '다시 해 볼까요?' : '영수증을 찍어 주세요'}</Txt>
              <Txt size="small" tone="sub" style={{ textAlign: 'center' }}>
                {note ?? (maxShots > 1
                  ? `테두리를 잡아 반듯하게 펴 드려요. 날짜와 금액은 알아서 읽어요.\n여러 장이면 이어서 찍거나 한 번에 골라요(최대 ${maxShots}장).`
                  : '테두리를 잡아 반듯하게 펴 드려요. 날짜와 금액은 알아서 읽어요.\n무료는 한 번에 한 장씩 올려요.')}
              </Txt>
            </Card>
            {shots.length ? (
              <Soft pill={`${shots.length}장`} title="기록을 기다리는 영수증이 있어요" sub="눌러서 확인하고 기록해요" onPress={() => setStep('shots')} />
            ) : null}
            {Platform.OS !== 'web' ? <Btn label="영수증 찍기" onPress={() => { void scan(); }} /> : null}
            {scanFailed ? <Btn label="일반 촬영으로 찍기" tone="ghost" onPress={() => { void plainCamera(); }} /> : null}
            <Btn label="앨범에서 고르기" tone={Platform.OS === 'web' ? 'main' : 'ghost'} onPress={() => { void album(); }} />
            <Btn label="영수증 없이 적기" tone="ghost" onPress={() => { setNote(null); setStep('manual'); }} />
          </>
        ) : null}

        {/* 보내기 전에 한 장씩 — 돌리기 · 빼기, 그리고 전송(2026-09-22 태훈님) */}
        {step === 'review' ? (
          <>
            <Txt size="small" tone="sub" style={{ lineHeight: 20 }}>보내기 전에 한 장씩 봐 주세요. 옆으로 눕거나 거꾸로 찍혔으면 돌려서 보내야 잘 읽혀요.</Txt>
            {drafts.map((d, i) => (
              <Card key={d.key} style={{ gap: S.sm }}>
                <View style={[k.row, { gap: 8 }]}>
                  <Txt bold style={k.grow}>{`${i + 1} / ${drafts.length}`}</Txt>
                  <Pressable onPress={() => setDrafts((cur) => cur.filter((x) => x.key !== d.key))} hitSlop={8} accessibilityRole="button">
                    <Txt size="small" tone="sub">빼기</Txt>
                  </Pressable>
                </View>
                <Image source={{ uri: d.uri }} resizeMode="contain" style={{ width: '100%', height: 280, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' }} />
                <View style={[k.row, { gap: S.sm }]}>
                  <Btn small tone="ghost" label="↻ 시계 방향" style={k.grow} loading={turning === d.key} disabled={turning !== null}
                    onPress={() => { void rotate(d.key, 90); }} />
                  <Btn small tone="ghost" label="180° 뒤집기" style={k.grow} disabled={turning !== null} onPress={() => { void rotate(d.key, 180); }} />
                </View>
              </Card>
            ))}
            {drafts.length + shots.length < maxShots ? (
              <View style={[k.row, { gap: S.sm }]}>
                {Platform.OS !== 'web' ? <Btn small tone="ghost" label="+ 더 찍기" style={k.grow} onPress={() => { void scan(); }} /> : null}
                <Btn small tone="ghost" label="+ 앨범에서 더" style={k.grow} onPress={() => { void album(); }} />
              </View>
            ) : null}
            <Btn label={`${drafts.length}장 전송하기`} disabled={!drafts.length || turning !== null} onPress={sendDrafts} />
          </>
        ) : null}

        {step === 'shots' ? (
          <>
            {shots.map((s) => (
              <ShotCard key={s.key} shot={s} single={shots.length === 1} manager={manager} categories={categoriesOf('out')} events={openEvents}
                onPatch={(fn) => patch(s.key, fn)} onRemove={() => remove(s.key)} onAddCat={() => setAddCatFor(s.key)}
                onDateChange={(d) => patch(s.key, (x) => (x.eventTouched ? x : { ...x, form: { ...x.form, eventId: suggestEvent(evsRef.current, ymd(d)) } }))} />
            ))}
            {shots.length < maxShots ? (
              <View style={[k.row, { gap: S.sm }]}>
                {Platform.OS !== 'web' ? <Btn small tone="ghost" label="+ 더 찍기" style={k.grow} onPress={() => { void scan(); }} /> : null}
                <Btn small tone="ghost" label="+ 앨범에서 더" style={k.grow} onPress={() => { void album(); }} />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 'manual' ? (
          <ManualForm form={form} setForm={(f) => { setForm(f); }} direction={direction} manager={manager} note={note}
            onDirection={(d) => { setDirection(d); setForm((f) => ({ ...f, categoryId: null })); }}
            categories={categoriesOf(direction)} events={openEvents} onAddCat={() => setAddCatFor('manual')}
            onEvent={(id) => { setManualTouched(true); setForm((f) => ({ ...f, eventId: id })); }}
            onDate={(d) => setForm((f) => ({ ...f, date: d, eventId: manualTouched || direction !== 'out' ? f.eventId : suggestEvent(evsRef.current, ymd(d)) }))} />
        ) : null}

        {step === 'shots' || step === 'manual' ? (
          <>
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

            {step === 'shots' ? (
              <>
                <Btn label={reading ? `읽는 중 ${reading}장…` : cta(sendable)} loading={busy}
                  disabled={busy || reading > 0 || sendable === 0 || !bankOk} onPress={() => submit(false)} />
                {!reading && sendable < shots.length ? (
                  <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>
                    {`못 읽었거나 이미 적은 ${shots.length - sendable}장은 빼고 적어요`}
                  </Txt>
                ) : null}
                {shots.length === 1 ? (
                  <Pressable onPress={() => { queue.remove(shots.map((s) => s.key)); setStep('pick'); }} style={{ alignSelf: 'center', padding: S.sm }}>
                    <Txt size="small" tone="sub">다시 찍기</Txt>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={[k.row, { gap: S.sm, paddingTop: 2 }]}>
                <Btn label="건너뛰기" tone="ghost" style={{ width: 104 }} disabled={busy || !readAmount(form.amount) || !readWhen(form.date, form.time) || !bankOk}
                  onPress={() => submit(true)} />
                <Btn label={manager ? '기록하기' : '지급 요청하기'} style={k.grow} loading={busy}
                  disabled={busy || !readAmount(form.amount) || !readWhen(form.date, form.time) || !bankOk} onPress={() => submit(false)} />
              </View>
            )}
          </>
        ) : null}
      </Body>

      <Ask open={addCatFor !== null} title="항목 만들기" onClose={() => setAddCatFor(null)}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAddCatFor(null) }, { label: '만들기', onPress: () => { void addCategory(); } }]}>
        <Field value={newCat} onChangeText={setNewCat} placeholder={addCatFor === 'manual' && direction === 'in' ? '예) 후원금' : '예) 경조사비'} maxLength={20} autoFocus />
      </Ask>

      {/* 전송 뒤 — 지금 기록 / 나중에 기록(2026-09-22 태훈님). 닫으면 지금 기록 */}
      <Ask open={sent !== null} title={`영수증 ${sent?.n ?? 0}장을 보냈어요`} mood="receipt" onClose={() => { setSent(null); setStep('shots'); }}
        body={'한 장에 10~15초쯤 걸려요.\n지금 여기서 읽히는 대로 기록할까요?\n나중에 하면 다 읽었을 때 알림으로 알려 드려요.'}
        buttons={[
          // 나중에 — 서버가 다 읽히면 푸시로 알린다(ReceiptJobs). 안내는 한 줄로(두 줄이면 읽기 전에 사라졌다 — 태훈님)
          { label: '나중에 기록', tone: 'ghost', onPress: () => { if (sent) queue.later(sent.batch); setSent(null); say('다 읽으면 알림으로 알려 드릴게요'); back(); } },
          { label: '지금 기록', onPress: () => { setSent(null); setStep('shots'); } },
        ]} />

      <ScanIntro open={intro} onClose={() => setIntro(false)}
        onContinue={() => { setIntro(false); void storage.set('cm.scanIntro', '1'); void openScanner(); }} />

      <Ask open={bankAsk !== null} title="이 계좌를 등록해 둘까요?" mood="coin" onClose={() => setBankAsk(null)}
        body={`${[bankName.trim(), bankAccount.trim(), bankHolder.trim()].filter(Boolean).join(' · ')}\n\n등록해 두면 다음 요청부터 자동으로 채워져요. 설정 › 내 정보에서 바꿀 수 있어요.`}
        buttons={[
          { label: '이번만 쓰기', tone: 'ghost', onPress: () => afterAsk(true) },
          { label: '등록하고 요청', onPress: () => afterAsk(false) },
        ]} />
    </View>
  );
}

/* ── 확인 카드 — 영수증 한 장 ── */

function ShotCard({ shot, single, manager, categories, events, onPatch, onRemove, onAddCat, onDateChange }: {
  shot: Shot; single: boolean; manager: boolean; categories: Category[]; events: ClubEvent[];
  onPatch: (fn: (s: Shot) => Shot) => void; onRemove: () => void; onAddCat: () => void; onDateChange: (d: string) => void;
}) {
  const T = useT();
  const [memoOpen, setMemoOpen] = useState(false);
  const f = shot.form;
  const rc = shot.receipt;
  const set = (p: Partial<ShotForm>) => onPatch((s) => ({ ...s, form: { ...s.form, ...p } }));
  const amount = readAmount(f.amount);
  const when = readWhen(f.date, f.time);
  const edited = isEdited(shot);
  const used = isUsed(shot);

  return (
    <Card style={{ gap: S.sm }}>
      <View style={[k.row, { gap: S.md, alignItems: 'flex-start' }]}>
        {/* 다른 폰에서 보낸 장은 읽히기 전엔 사진이 없다 — 빈 칸 */}
        {shot.uri ? <Image source={{ uri: shot.uri }} style={{ width: 54, height: 72, borderRadius: 9, backgroundColor: T.track }} />
          : <View style={{ width: 54, height: 72, borderRadius: 9, backgroundColor: T.track }} />}
        <View style={[k.grow, { gap: 2 }]}>
          {shot.state === 'reading' ? (
            <>
              <Txt bold>영수증을 읽고 있어요</Txt>
              <Txt size="small" tone="sub">{single ? '보통 10~15초 걸려요' : '여러 장이면 차례로 읽어요'}</Txt>
            </>
          ) : shot.state === 'failed' ? (
            <>
              <Txt bold tone="warn">읽지 못했어요</Txt>
              <Txt size="small" tone="sub">{shot.note ?? '다시 찍어 주세요'}</Txt>
            </>
          ) : (
            <>
              <View style={[k.row, { gap: 6 }]}>
                <Txt bold numberOfLines={1} style={{ flexShrink: 1 }}>{f.merchant || '상호 없음'}</Txt>
                {rc?.needsCheck && f.merchant ? <Chip label="확인 필요" tone="warn" /> : null}
              </View>
              <Text style={[k.num, { fontSize: F.big, color: used ? T.dim : T.ink }]}>
                {amount ? won(amount) : '—'}<Text style={{ fontSize: 15 }}> 원</Text>
              </Text>
              <Txt size="small" tone="sub">{when ? whenLong(when) : '날짜를 못 읽었어요 · 고치기에서 적어 주세요'}</Txt>
            </>
          )}
        </View>
        {shot.state === 'reading' ? <Mascot mood="search" size={44} /> : null}
        {shot.state === 'ready' && !used ? (
          <Pressable onPress={() => onPatch((s) => ({ ...s, editing: !s.editing }))} hitSlop={10} accessibilityRole="button">
            <Txt size="small" bold style={{ color: T.deep }}>{shot.editing ? '접기' : '고치기'}</Txt>
          </Pressable>
        ) : null}
      </View>

      {shot.state === 'ready' && shot.note ? <Soft tone="warn" title={shot.note} /> : null}
      {rc?.duplicate ? (
        <Soft tone="warn" title={used ? '이미 장부에 적은 영수증이에요' : '이미 올린 영수증 같아요'}
          sub={`${whenLong(rc.duplicate.occurredAt)} · ${won(rc.duplicate.amount)}원 — ${used ? '이 장은 빼고 적어요' : '그래도 적을 수 있어요'}`} />
      ) : null}

      {shot.state === 'ready' && !used ? (
        <>
          {shot.editing ? (
            <>
              <Sep style={{ marginVertical: 2 }} />
              <Field label="상호" value={f.merchant} onChangeText={(v) => set({ merchant: v })} placeholder="예) GS25 수유점" maxLength={60} inputStyle={{ fontSize: F.body }} />
              {rc && rc.candidates.length > 0 ? (
                <View style={[k.row, k.wrap, { gap: 5 }]}>
                  <Txt size="tiny" tone="sub">읽은 후보</Txt>
                  {rc.candidates.map((c) => <Chip key={c} label={c} onPress={() => set({ merchant: c })} tone={c === f.merchant ? 'tint' : 'plain'} />)}
                </View>
              ) : null}
              <View style={[k.row, { gap: S.sm }]}>
                <DateField style={{ flex: 1.3 }} value={f.date} onChange={(v) => { set({ date: v }); onDateChange(v); }} />
                <Field style={{ flex: 0.9 }} value={f.time} onChangeText={(v) => set({ time: v })} placeholder="14:14" maxLength={5} inputStyle={{ fontSize: 15.5 }} />
              </View>
              <Field value={f.amount} onChangeText={(v) => set({ amount: amountInput(v) })} keyboardType="number-pad" placeholder="금액"
                inputStyle={{ fontSize: 20, fontWeight: '900' }} right={<Txt tone="sub">원</Txt>} />
              {edited && rc ? (
                <Txt size="tiny" tone="warn">
                  {`영수증에는 ${rc.paidAt ? whenLong(rc.paidAt) + ' · ' : ''}${rc.total ? won(rc.total) + '원' : ''}으로 읽혔어요. 고친 값으로 적고 「영수증과 다름」을 붙여요`}
                </Txt>
              ) : null}
            </>
          ) : null}

          {/* 산 것 — 모임 돈은 합계만으로는 어디에 썼는지 모른다(2026-09-22 태훈님). 여러 장이면 한 줄로 */}
          <Sep style={{ marginVertical: 2 }} />
          {rc && rc.items.length ? (single ? (
            <View style={{ gap: 3 }}>
              <Txt size="small" tone="sub" bold>{`산 것 ${rc.items.length}가지`}</Txt>
              {rc.items.map((i, n) => (
                <View key={n} style={[k.row, { justifyContent: 'space-between', gap: S.sm }]}>
                  <Txt size="small" style={k.grow} numberOfLines={2}>{i.name}{i.count > 1 ? ` ×${i.count}` : ''}</Txt>
                  <Txt size="small" style={k.amt}>{i.price !== null ? won(i.price) : ''}</Txt>
                </View>
              ))}
            </View>
          ) : <Txt size="small" tone="sub" numberOfLines={2}>{`산 것 · ${itemsLine(rc.items)}`}</Txt>)
            : <Txt size="tiny" tone="dim">품목은 읽지 못했어요. 무엇을 샀는지 「내용」에 적어 두면 회원들이 알아봐요</Txt>}

          {events.length > 0 ? (
            <View style={{ gap: 5 }}>
              <Txt size="small" bold>행사</Txt>
              <Choices items={[...events.map((e) => ({ id: e.id, label: e.name })), { id: 0, label: '없음' }]} value={f.eventId ?? 0}
                onChange={(id) => onPatch((s) => ({ ...s, eventTouched: true, form: { ...s.form, eventId: id === 0 ? null : id } }))} />
            </View>
          ) : null}
          <View style={{ gap: 5 }}>
            <Txt size="small" bold>항목</Txt>
            <Choices items={categories.map((c) => ({ id: c.id, label: c.parentId ? '· ' + c.name : c.name }))} value={f.categoryId}
              onChange={(id) => set({ categoryId: id === f.categoryId ? null : id })}
              extra={manager ? <Chip label="+ 직접 입력" tone="dim" onPress={onAddCat} /> : undefined} />
          </View>
          {memoOpen || f.memo ? (
            <Field label="내용" value={f.memo} onChangeText={(v) => set({ memo: v })} placeholder="예) 체육대회 단체 티셔츠 25장" multiline maxLength={200} />
          ) : (
            <Pressable onPress={() => setMemoOpen(true)} hitSlop={6} style={{ alignSelf: 'flex-start', paddingVertical: 2 }} accessibilityRole="button">
              <Txt size="small" bold style={{ color: T.deep }}>+ 내용 적기</Txt>
            </Pressable>
          )}
        </>
      ) : null}

      {!single || shot.state === 'failed' || used ? (
        <Pressable onPress={onRemove} hitSlop={8} style={{ alignSelf: 'flex-end' }} accessibilityRole="button">
          <Txt size="small" tone="sub">이 장 빼기</Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}

/* ── 영수증 없이 적기 — 읽은 값이 없으니 칸을 채운다 ── */

function ManualForm({ form, setForm, direction, manager, note, onDirection, categories, events, onAddCat, onEvent, onDate }: {
  form: ShotForm; setForm: (f: ShotForm) => void; direction: 'in' | 'out'; manager: boolean; note: string | null;
  onDirection: (d: 'in' | 'out') => void; categories: Category[]; events: ClubEvent[]; onAddCat: () => void;
  onEvent: (id: number | null) => void; onDate: (d: string) => void;
}) {
  const T = useT();
  const set = (p: Partial<ShotForm>) => setForm({ ...form, ...p });
  const when = readWhen(form.date, form.time);

  return (
    <>
      {manager ? (
        <Tabs items={[{ id: 'out', label: '지출' }, { id: 'in', label: '수입' }]} value={direction} onChange={onDirection} />
      ) : null}
      {note ? <Soft tone="warn" title={note} /> : null}
      <Card style={{ gap: S.sm }}>
        <Txt size="small" tone="sub" bold>{direction === 'in' ? '누구에게 · 무엇' : '상호'}</Txt>
        <Field value={form.merchant} onChangeText={(v) => set({ merchant: v })} placeholder={direction === 'in' ? '예) 찬조 · 이성호' : '예) GS25 수유점'} maxLength={60}
          right={<Txt style={{ color: T.deep }}>✎</Txt>} />
        <Sep style={{ marginVertical: 3 }} />
        <View style={[k.row, { gap: S.sm }]}>
          <DateField style={{ flex: 1.3 }} value={form.date} onChange={onDate} />
          <Field style={{ flex: 0.9 }} value={form.time} onChangeText={(v) => set({ time: v })} placeholder="14:14" maxLength={5} inputStyle={{ fontSize: 15.5 }} />
        </View>
        <Field value={form.amount} onChangeText={(v) => set({ amount: amountInput(v) })} keyboardType="number-pad" placeholder="금액"
          inputStyle={{ fontSize: 22, fontWeight: '900' }} right={<Txt tone="sub">원</Txt>} />
        <Txt size="tiny" tone="dim">{when ? whenLong(when) : '날짜를 골라 주세요'}</Txt>
      </Card>

      {events.length > 0 && direction === 'out' ? (
        <View style={{ gap: 6 }}>
          <Txt bold>행사</Txt>
          <Choices items={[...events.map((e) => ({ id: e.id, label: e.name })), { id: 0, label: '없음' }]} value={form.eventId ?? 0}
            onChange={(id) => onEvent(id === 0 ? null : id)} />
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Txt bold>항목</Txt>
        <Choices items={categories.map((c) => ({ id: c.id, label: c.parentId ? '· ' + c.name : c.name }))} value={form.categoryId}
          onChange={(id) => set({ categoryId: id === form.categoryId ? null : id })}
          extra={manager ? <Chip label="+ 직접 입력" tone="dim" onPress={onAddCat} /> : undefined} />
      </View>

      <Field label="내용" value={form.memo} onChangeText={(v) => set({ memo: v })} placeholder="예) 체육대회 단체 티셔츠 25장" multiline maxLength={200} />
    </>
  );
}
