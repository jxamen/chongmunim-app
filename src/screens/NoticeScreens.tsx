/**
 * 공지 — 읽기 · 쓰기(시안 9).
 *
 * **보내기 전에 받는 사람 수를 한 번 확인받는다** — 단체 푸시는 되돌릴 수 없다. 받는 사람은 서버가 명단에서 고르고
 * 보낸 순간에 굳힌다(「미납자만」은 그 달 미납자). 밤(21~08시)이면 한 번 더 묻는다.
 * 잠금 화면에는 「{모임} 공지 · 제목」만 뜬다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { isNight, kstNow, monthWord } from '../cm/format';
import { isManager, type Audience, type PushResult } from '../cm/model';
import { pushLine } from '../cm/pushText';
import { Ask, Body, Btn, Card, Chip, Choices, Failed, Field, Head, Loading, Sep, Soft, Toggle, Txt, s as k } from '../ui/kit';
import { S } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

export function NoticeScreen({ id }: { id: number }) {
  const { group, back, open } = useApp();
  const { data, error, reload } = useLoad((gid) => cm.notice(gid, id), [id]);
  const manager = group ? isManager(group.me.role) : false;

  return (
    <View style={{ flex: 1 }}>
      <Head title="공지" onClose={back} />
      {!data ? (error ? <Failed text={error} onRetry={reload} /> : <Loading />) : (
        <Body>
          <Card style={{ gap: S.md }}>
            <View style={[k.row, { gap: 8 }]}>
              <Chip label="공지" tone="tint" />
              {data.audience !== 'all' ? <Chip label={data.audience === 'admins' ? '관리자만' : '미납자만'} /> : null}
            </View>
            <Txt bold size="title">{data.title}</Txt>
            <Txt size="tiny" tone="sub">{[data.author, data.sentAt?.slice(0, 10).replace(/-/g, '.')].filter(Boolean).join(' · ')}</Txt>
            <Txt style={{ lineHeight: 25 }}>{data.body ?? ''}</Txt>
          </Card>
          {data.closingId ? <Btn label="결산 보기" onPress={() => open({ kind: 'closing', id: data.closingId! })} /> : null}
          {manager && data.status === 'sent' ? <Recipients id={id} reads={data.reads} total={data.recipients} /> : null}
        </Body>
      )}
    </View>
  );
}

/*
 | 받는 사람 — 「읽음 3/10」을 누르면 한 사람씩: 알림이 갔는지 · 읽었는지(2026-09-22 태훈님 「받는 사람 리스트 · 수신 여부」).
 | 알림 결과는 보낸 순간의 것이다 — 그 뒤에 알림을 허용한 사람은 「알림 허용 전」으로 남는다.
 */
const PUSH_LABEL: Record<NonNullable<PushResult>, string> = {
  sent: '알림 보냄', failed: '알림 실패', no_app: '앱 없음', muted: '알림 꺼 둠', no_token: '알림 허용 전', off: '알림 없이 보냄',
};

function Recipients({ id, reads, total }: { id: number; reads: number; total: number }) {
  const [open, setOpen] = useState(false);
  const list = useLoad((gid) => (open ? cm.noticeRecipients(gid, id) : Promise.resolve(null)), [id, open]);

  return (
    <Card style={{ paddingVertical: 2 }}>
      <Pressable onPress={() => setOpen(!open)} style={[k.listrow, { gap: 8 }]} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Txt bold style={k.grow}>{`읽음 ${reads} / ${total}명`}</Txt>
        <Txt size="small" tone="sub">{open ? '접기 ▴' : '받는 사람 보기 ▾'}</Txt>
      </Pressable>
      {open ? (
        !list.data ? <Loading /> : list.data.length === 0 ? (
          <Txt size="small" tone="dim" style={{ paddingBottom: 12 }}>받는 사람이 없어요(쓴 사람은 빼고 세요)</Txt>
        ) : list.data.map((r) => (
          <View key={r.id}>
            <Sep />
            <View style={[k.listrow, { gap: 8 }]}>
              <Txt bold style={k.grow} numberOfLines={1}>{r.name}</Txt>
              {r.push ? <Chip label={PUSH_LABEL[r.push]} tone={r.push === 'sent' ? 'tint' : r.push === 'off' ? 'plain' : 'warn'} /> : <Chip label="알림 기록 없음" tone="dim" />}
              <Txt size="small" tone={r.readAt ? 'pos' : 'dim'} style={{ width: 74, textAlign: 'right' }}>{r.readAt ? readWhen(r.readAt) : '안 읽음'}</Txt>
            </View>
          </View>
        ))
      ) : null}
    </Card>
  );
}

/** 읽은 때 — 서버 UTC → 「9/22 14:30」 */
function readWhen(at: string): string {
  const d = new Date(at.includes('T') || at.endsWith('Z') ? at : at.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '읽음';
  const k = new Date(d.getTime() + 9 * 3600_000);

  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

export function ComposeScreen({ draftId, audience: startAudience }: { draftId?: number; audience?: Audience }) {
  const { group, back, bump, say, fail } = useApp();
  const kb = useKeyboardPad();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>(startAudience ?? 'all');
  const [push, setPush] = useState(true);
  const [counts, setCounts] = useState<Record<Audience, number>>({ all: 0, admins: 0, unpaid: 0 });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const period = kstNow().ym;

  useEffect(() => {
    if (!group) return;
    for (const a of ['all', 'admins', 'unpaid'] as Audience[]) {
      cm.audienceCount(group.id, a, a === 'unpaid' ? period : undefined)
        .then((r) => setCounts((c) => ({ ...c, [a]: Number(r.count) || 0 }))).catch(() => undefined);
    }
    if (draftId) {
      cm.notice(group.id, draftId).then((n) => {
        setTitle(n.title); setBody(n.body ?? ''); setAudience(n.audience); setPush(n.push);
      }).catch(fail);
    }
    // 처음 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = counts[audience];
  const ready = title.trim() !== '' && body.trim() !== '' && !busy;

  const submit = async (draft: boolean) => {
    if (!group) return;
    setBusy(true);
    const b = { title: title.trim(), body: body.trim(), audience, period: audience === 'unpaid' ? period : undefined, push, draft };
    try {
      const r = draftId ? await cm.saveNotice(group.id, draftId, b) : await cm.addNotice(group.id, b);
      // 공지는 늘 남는다 — 알림은 켠 사람에게만 간다(몇 명에게 갔는지까지)
      say(draft ? '임시저장했어요' : push && r.push ? `공지를 올렸어요 · ${pushLine(r.push)}` : `${n}명에게 공지를 올렸어요`);
      bump();
      back();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Head title="공지 쓰기" onClose={back} />
      <Body bottom={kb > 0 ? kb + 24 : 120}>
        <View style={{ height: 2 }} />
        <Field label="제목" value={title} onChangeText={setTitle} placeholder="예) 10월 정기산행 안내" maxLength={60} />
        <Field label="내용" value={body} onChangeText={setBody} multiline maxLength={5000}
          placeholder="예) 10월 12일 토요일 오전 7시 사당역 4번 출구에서 출발합니다." inputStyle={{ minHeight: 140 }} />
        <View style={{ gap: 6 }}>
          <Txt bold>받을 사람</Txt>
          <Choices items={[
            { id: 'all' as Audience, label: `전체 ${counts.all}명` },
            { id: 'admins' as Audience, label: '관리자만' },
            { id: 'unpaid' as Audience, label: `${monthWord(period)} 미납자만` },
          ]} value={audience} onChange={setAudience} />
        </View>
        <Card style={[k.row, { gap: 10, paddingVertical: 13 }]}>
          <View style={k.grow}>
            <Txt bold>푸시 알림도 보내기</Txt>
            <Txt size="tiny" tone="sub">앱을 켜지 않아도 폰에 뜹니다</Txt>
          </View>
          <Toggle on={push} onChange={setPush} />
        </Card>
        {push ? <Soft tone="warn" title={`${n}명에게 발송됩니다`} sub="보낸 뒤에는 취소할 수 없어요" /> : null}
        <View style={[k.row, { gap: S.sm }]}>
          <Btn label="임시저장" tone="ghost" style={{ width: 104 }} disabled={!ready} onPress={() => { void submit(true); }} />
          <Btn label="발송하기" style={k.grow} disabled={!ready || n === 0} onPress={() => setConfirm(true)} />
        </View>
      </Body>

      {/* 받는 사람 수는 쓰는 나를 빼고 센다(서버 audience) — 0명이면 공지만 남는다 */}
      <Ask open={confirm} title={n > 0 ? `${n}명에게 보낼까요?` : '공지만 올릴까요?'} mood="phone" onClose={() => setConfirm(false)}
        body={`「${title.trim()}」${n === 0 ? '\n받을 사람이 아직 없어요(쓰는 나는 빼고 세요). 공지는 남아서 나중에 들어온 사람도 봐요.' : push ? '\n푸시로도 알려요. 보낸 뒤에는 취소할 수 없어요.' : '\n앱에서만 보여요(푸시 없음).'}${n > 0 && push && isNight() ? '\n\n지금은 밤이에요. 아침에 보내는 편이 좋아요.' : ''}`}
        buttons={[{ label: '다시 보기', tone: 'ghost', onPress: () => setConfirm(false) }, { label: busy ? '보내는 중…' : '보내기', onPress: () => { void submit(false); } }]} />
    </View>
  );
}
