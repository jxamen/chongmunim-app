/**
 * 모임(시안 8) — 회비 · 공지 · 행사 · 회원.
 *
 * **회비 납부 현황은 총무·관리자만 본다.** 회원에게는 자기 납부 내역만 보인다(서버가 그렇게 준다).
 * 미납 안내는 **한 사람씩** 푸시로 간다 — 누가 미납인지 다른 회원은 모른다. 밤(21~08시)이면 한 번 묻는다.
 */
import React, { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { barPercent, dayShort, isNight, kstNow, monthWord, shiftMonth, won } from '../cm/format';
import { isManager, type Dues, type DuesRow, type Notice, type RosterItem } from '../cm/model';
import { copy, shareText } from '../share';
import { track } from '../track';
import { Ask, Body, Btn, Card, Chip, Empty, Failed, Head, Loading, Sep, Tabs, Text, Txt, s as k } from '../ui/kit';
import { Gauge } from '../ui/skia';
import { Hero } from '../ui/Hero';
import { F, S, useT } from '../ui/theme';
import { EventsTab, Locked } from './LedgerScreen';
import { isPro } from '../cm/plan';

type Sub = 'dues' | 'notice' | 'event' | 'people';
const ROLE: Record<string, string> = { owner: '총무', admin: '관리자', member: '회원' };

/** 초대 글 — 코드와 들어오는 길. 스토어 주소는 앱이 올라간 뒤에 붙인다(지금은 받을 곳이 없다) */
const inviteMessage = (groupName: string, code: string): string =>
  `[${groupName}] 총무님 앱에서 모임 장부를 같이 봐요.\n앱을 받아 「초대 코드로 들어가기」에 아래 코드를 넣어 주세요.\n\n초대 코드: ${code}`;

export function ClubScreen() {
  const { group, say } = useApp();
  const [sub, setSub] = useState<Sub>('dues');
  const [inviting, setInviting] = useState(false);
  const manager = group ? isManager(group.me.role) : false;
  const T = useT();
  const invite = manager ? group?.inviteCode ?? null : null;   // 초대 코드는 총무·관리자에게만 온다

  return (
    <View style={{ flex: 1 }}>
      <Head title="모임" />
      {/* 히어로 띠 — 모임 이름과 사람 수(2026-09-22 태훈님 「모임 설정에도 히어로」). 전에 머리 칩이던 회원 수가 여기로 */}
      {group ? (
        <Hero mood="cheer" mascot={70} style={{ marginHorizontal: S.lg, marginBottom: 4 }}>
          <Text style={{ fontSize: F.title, fontWeight: '900', color: T.deep }} numberOfLines={1}>{group.name}</Text>
          <Txt size="small" tone="sub" numberOfLines={1}>
            {[`회원 ${group.members}명`, group.owner ? `총무 ${group.owner}` : null, `나는 ${ROLE[group.me.role]}`].filter(Boolean).join(' · ')}
          </Txt>
          {/* 초대 — 모임 탭 어디서든 한 번에(2026-09-22 태훈님 「모임에 초대 기능이 있어야 해」). 전엔 회원 칸 안에만 있었다 */}
          {invite ? (
            <Pressable onPress={() => { track('invite_open', {}); setInviting(true); }} accessibilityRole="button" accessibilityLabel="모임에 초대하기"
              style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: T.deep }, pressed && k.pressed]}>
              <Text style={{ fontSize: F.small, fontWeight: '800', color: T.white }}>＋ 초대하기</Text>
            </Pressable>
          ) : null}
        </Hero>
      ) : null}
      <Tabs items={[{ id: 'dues', label: '회비' }, { id: 'notice', label: '공지' }, { id: 'event', label: '행사' }, { id: 'people', label: '회원' }]}
        value={sub} onChange={setSub} />
      {sub === 'dues' ? (manager ? <DuesTab /> : <MyDues />)
        : sub === 'notice' ? <NoticesTab manager={manager} />
          : sub === 'event' ? <EventsTab manager={manager} />
            : <PeopleTab manager={manager} />}
      <Ask open={inviting && !!invite} title="모임에 초대하기" mood="phone" onClose={() => setInviting(false)}
        body="초대 글을 카톡으로 보내면, 받은 사람이 앱에서 코드를 넣고 들어와요."
        buttons={[
          { label: '코드 복사', tone: 'ghost', onPress: () => { if (invite) void copy(invite).then(() => say('초대 코드를 복사했어요')); } },
          { label: '카톡으로 보내기', onPress: () => {
            if (!invite || !group) return;
            track('invite_share', { from: 'hero' });
            void shareText(inviteMessage(group.name, invite)).then((r) => { if (r === 'copied') say('초대 글을 복사했어요'); });
            setInviting(false);
          } },
        ]}>
        <Text style={[k.num, { fontSize: 34, color: T.deep, textAlign: 'center', letterSpacing: 6 }]}>{invite ?? ''}</Text>
        {group && !isPro(group) ? (
          <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>
            {`무료 모임은 ${group.freeMembers}명까지 같이 볼 수 있어요 · 지금 ${Math.max(0, group.members - 1)}명`}
          </Txt>
        ) : null}
      </Ask>
    </View>
  );
}

/* ── 회비(총무·관리자) ── */

function DuesTab() {
  const { group, open, say, fail, bump, showPlan } = useApp();
  const T = useT();
  const [period, setPeriod] = useState(kstNow().ym);
  const { data, error, loading, reload } = useLoad((gid) => cm.dues(gid, period), [period]);
  const [pick, setPick] = useState<DuesRow | null>(null);
  const [remind, setRemind] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const d: Dues = data;
  /*
   | 월 회비 0원 = 회비 없는 모임 — 납부 체크도 미납도 없다(2026-09-22 태훈님 「회비가 0원인데 미납으로 나옴 · 회비 없음 설정」).
   | 서버도 0원이면 미납을 세지 않는다(home.remind duesUnpaid null → 회비 확인 알림 없음)
   */
  if (d.amount <= 0) {
    return (
      <Body>
        <View style={{ height: 2 }} />
        <Card>
          <Empty mood="calm" title="회비를 받지 않는 모임이에요" sub="회비를 걷게 되면 월 회비를 정해 주세요. 그때부터 달마다 납부를 체크해요">
            <Btn label="월 회비 정하기" tone="ghost" small style={{ paddingHorizontal: S.xl }} onPress={() => open({ kind: 'groupEdit' })} />
          </Empty>
        </Card>
      </Body>
    );
  }
  if (!isPro(group)) {
    return <Locked title="회비 체크는 구독에서 써요" sub="달마다 누가 냈는지 체크하고, 미납인 사람에게만 따로 안내를 보내요" onPlan={() => showPlan('dues')} />;
  }
  // 미납 먼저 — 할 일이 먼저 보이게. 면제는 맨 뒤
  const rows = [...d.members].sort((a, b) => Number(a.exempt) - Number(b.exempt) || Number(!!a.paid) - Number(!!b.paid) || a.name.localeCompare(b.name, 'ko'));

  const toggle = async (r: DuesRow) => {
    if (!group) return;
    setBusy(true);
    try {
      if (r.paid) await cm.cancelDues(group.id, r.paid.id);
      else await cm.payDues(group.id, r.memberId, period);
      say(r.paid ? `${r.name} 납부를 취소했어요` : `${r.name} 납부로 표시했어요 · 장부에도 적었어요`);
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setPick(null);
    }
  };

  const sendRemind = async () => {
    if (!group) return;
    setBusy(true);
    try {
      const r = await cm.remindDues(group.id, period);
      const missed = r.noApp + r.noToken;
      say(`${r.accepted}명에게 보냈어요${missed ? ` · ${missed}명은 앱 알림이 없어 따로 연락해 주세요` : ''}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setRemind(false);
    }
  };

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      <Card>
        <View style={[k.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
          <View style={[k.row, { gap: 6 }]}>
            <Pressable onPress={() => setPeriod(shiftMonth(period, -1))} hitSlop={10}><Txt tone="sub">‹</Txt></Pressable>
            <Txt size="small" tone="sub" bold>{monthWord(period)} 회비</Txt>
            <Pressable onPress={() => setPeriod(shiftMonth(period, 1))} hitSlop={10}><Txt tone="sub">›</Txt></Pressable>
          </View>
          <Txt size="small" tone="sub">{d.paidCount} / {d.payers}명</Txt>
        </View>
        <Gauge percent={barPercent(d.paidCount, d.payers)} />
        <View style={[k.row, { justifyContent: 'space-between', marginTop: 8 }]}>
          <Txt size="tiny" tone="sub">걷힌 돈 {won(d.collected)}</Txt>
          <Txt size="tiny" tone="sub">미납 {d.unpaidCount}명 · {won(d.unpaidSum)}</Txt>
        </View>
      </Card>

      <Card style={{ paddingVertical: 2 }}>
        {rows.map((r, i) => (
          <View key={r.memberId}>
            {i > 0 ? <Sep /> : null}
            <Pressable onPress={() => { if (!r.exempt && d.amount > 0) setPick(r); }} style={[k.listrow, { gap: 8 }]}>
              <View style={k.grow}>
                <Txt bold>{r.name}</Txt>
                {!r.hasApp ? <Txt size="tiny" tone="dim">앱 없음</Txt> : null}
              </View>
              <Chip label={r.exempt ? '면제' : r.paid ? '납부' : '미납'} tone={r.exempt ? 'dim' : r.paid ? 'tint' : 'warn'} />
              <Txt size="small" tone={r.paid ? 'sub' : 'dim'} style={{ width: 46, textAlign: 'right' }}>{r.paid ? dayShort(r.paid.paidOn) : '—'}</Txt>
            </Pressable>
          </View>
        ))}
      </Card>

      {d.unpaidCount > 0 && d.amount > 0 ? (
        <>
          <Btn label={`미납 ${d.unpaidCount}명에게 안내 보내기`} tone="ghost" onPress={() => setRemind(true)} />
          <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>개인에게만 전송되고 명단은 공개되지 않아요</Txt>
        </>
      ) : null}

      <Ask open={!!pick} title={pick ? `${pick.name} · ${monthWord(period)} 회비` : ''} mood={pick?.paid ? 'thinking' : 'coin'}
        body={pick?.paid ? `${dayShort(pick.paid.paidOn)}에 납부로 표시했어요. 취소하면 장부의 입금 줄도 지워져요.` : `${won(d.amount)}원을 받았으면 납부로 표시해요. 장부에 입금 한 줄이 같이 생겨요.`}
        onClose={() => setPick(null)}
        buttons={[
          { label: '닫기', tone: 'ghost', onPress: () => setPick(null) },
          pick?.paid ? { label: busy ? '처리 중…' : '납부 취소', tone: 'danger', onPress: () => { if (pick) void toggle(pick); } }
            : { label: busy ? '처리 중…' : '납부로 표시', onPress: () => { if (pick) void toggle(pick); } },
        ]} />

      <Ask open={remind} title={`미납 ${d.unpaidCount}명에게 보낼까요?`} mood="phone"
        body={`한 사람씩 「${monthWord(period)} 회비 안내」 알림이 가요. 금액과 이름은 잠금 화면에 나오지 않아요.${isNight() ? '\n\n지금은 밤이에요. 아침에 보내는 편이 좋아요.' : ''}`}
        onClose={() => setRemind(false)}
        buttons={[{ label: '다음에', tone: 'ghost', onPress: () => setRemind(false) }, { label: busy ? '보내는 중…' : '보내기', onPress: () => { void sendRemind(); } }]} />
    </Body>
  );
}

/* ── 회비(회원 — 내 것만) ── */

function MyDues() {
  const T = useT();
  const { data, error, loading, reload } = useLoad((gid) => cm.dues(gid));

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  if (data.amount <= 0) {
    return <Body><View style={{ height: 2 }} /><Card><Empty mood="calm" title="회비를 받지 않는 모임이에요" sub="회비가 생기면 여기서 내 납부 내역을 볼 수 있어요" /></Card></Body>;
  }

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      <Card style={{ gap: 4 }}>
        <Txt size="small" tone="sub">월 회비</Txt>
        <Txt bold size="big" style={k.num}>{won(data.amount)}<Txt size="head"> 원</Txt></Txt>
        <Txt size="tiny" tone="dim">회비 납부 현황은 총무님만 봐요. 여기엔 내 것만 보여요.</Txt>
      </Card>
      <Card style={{ paddingVertical: 2 }}>
        {data.mine.length === 0 ? <Empty mood="calm" title="아직 납부 기록이 없어요" /> : data.mine.map((m, i) => (
          <View key={m.period}>
            {i > 0 ? <Sep /> : null}
            <View style={[k.listrow, { gap: 8 }]}>
              <Txt bold style={k.grow}>{monthWord(m.period)} 회비</Txt>
              <Chip label="납부" tone="tint" />
              <Txt size="small" tone="sub" style={{ width: 46, textAlign: 'right' }}>{dayShort(m.paidOn)}</Txt>
            </View>
          </View>
        ))}
      </Card>
    </Body>
  );
}

/* ── 공지 ── */

function NoticesTab({ manager }: { manager: boolean }) {
  const { group, open, showPlan } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad(cm.notices);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const list: Notice[] = data;

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      {/* 무료 모임은 다 쓰고 보내기에서 막지 않고 들어올 때 안내한다(2026-09-23 A32 시험 — 서버 403 은 안전망으로 남는다) */}
      {manager ? <Btn label="+ 공지 쓰기" onPress={() => { if (isPro(group)) open({ kind: 'compose' }); else showPlan('notice'); }} /> : null}
      {list.length === 0 ? <Card><Empty mood="phone" title="공지가 아직 없어요" /></Card> : list.map((n) => (
        <Card key={n.id} onPress={() => open(n.status === 'draft' ? { kind: 'compose', draftId: n.id } : { kind: 'notice', id: n.id })} style={{ gap: 6 }}>
          <View style={[k.row, { gap: 8 }]}>
            {n.status === 'draft' ? <Chip label="임시저장" tone="warn" /> : !n.readByMe ? <Chip label="새 공지" tone="tint" /> : null}
            <Txt bold numberOfLines={1} style={k.grow}>{n.title}</Txt>
          </View>
          <Txt size="small" tone="sub" numberOfLines={2}>{n.preview}</Txt>
          <Txt size="tiny" tone="dim">
            {[n.author, n.sentAt ? n.sentAt.slice(5, 10).replace('-', '/') : null, manager && n.status === 'sent' ? `읽음 ${n.reads}/${n.recipients}` : null]
              .filter(Boolean).join(' · ')}
          </Txt>
        </Card>
      ))}
    </Body>
  );
}

/* ── 회원 ── */

function PeopleTab({ manager }: { manager: boolean }) {
  const { group, open, say } = useApp();
  const T = useT();
  const { data, error, loading, reload } = useLoad(cm.roster);

  if (!data) return error ? <Failed text={error} onRetry={reload} /> : <Loading />;
  const list: RosterItem[] = data;
  const invite = group?.inviteCode ?? null;
  const inviteText = invite && group ? inviteMessage(group.name, invite) : '';

  return (
    <Body refresh={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={T.deep} />}>
      <View style={{ height: 2 }} />
      {manager && invite ? (
        <Card style={{ gap: 10 }}>
          <Txt size="small" tone="sub" bold>초대 코드</Txt>
          <Txt bold size="big" style={[k.num, { letterSpacing: 4 }]}>{invite}</Txt>
          <View style={[k.row, { gap: S.sm }]}>
            <Btn label="복사" tone="ghost" small style={k.grow} onPress={() => { void copy(invite).then(() => say('초대 코드를 복사했어요')); }} />
            <Btn label="카톡으로 보내기" small style={k.grow} onPress={() => { track('invite_share', {}); void shareText(inviteText).then((r) => { if (r === 'copied') say('초대 글을 복사했어요'); }); }} />
          </View>
        </Card>
      ) : null}
      <Card style={{ paddingVertical: 2 }}>
        {list.map((m, i) => (
          <View key={m.id}>
            {i > 0 ? <Sep /> : null}
            <View style={[k.listrow, { gap: 8 }]}>
              <Txt bold style={k.grow}>{m.name}</Txt>
              {manager && !m.hasApp ? <Txt size="tiny" tone="dim">앱 없음</Txt> : null}
              {manager && m.duesExempt ? <Chip label="회비 면제" tone="dim" /> : null}
              {m.role !== 'member' ? <Chip label={ROLE[m.role]} tone="tint" /> : null}
            </View>
          </View>
        ))}
      </Card>
      {manager ? <Btn label="명단 관리" tone="ghost" onPress={() => open({ kind: 'members' })} /> : null}
    </Body>
  );
}
