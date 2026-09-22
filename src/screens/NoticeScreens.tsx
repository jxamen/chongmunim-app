/**
 * 공지 — 읽기 · 쓰기(시안 9).
 *
 * **보내기 전에 받는 사람 수를 한 번 확인받는다** — 단체 푸시는 되돌릴 수 없다. 받는 사람은 서버가 명단에서 고르고
 * 보낸 순간에 굳힌다(「미납자만」은 그 달 미납자). 밤(21~08시)이면 한 번 더 묻는다.
 * 잠금 화면에는 「{모임} 공지 · 제목」만 뜬다.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useApp, useLoad } from '../store';
import * as cm from '../cm/api';
import { isNight, kstNow, monthWord } from '../cm/format';
import { isManager, type Audience } from '../cm/model';
import { Ask, Body, Btn, Card, Chip, Choices, Failed, Field, Head, Loading, Soft, Toggle, Txt, s as k } from '../ui/kit';
import { S } from '../ui/theme';
import { useKeyboardPad } from '../ui/keyboard';

export function NoticeScreen({ id }: { id: number }) {
  const { group, back } = useApp();
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
            <Txt size="tiny" tone="sub">{[data.author, data.sentAt?.slice(0, 10).replace(/-/g, '.'), manager ? `읽음 ${data.reads}/${data.recipients}` : null].filter(Boolean).join(' · ')}</Txt>
            <Txt style={{ lineHeight: 25 }}>{data.body ?? ''}</Txt>
          </Card>
        </Body>
      )}
    </View>
  );
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
      if (draftId) await cm.saveNotice(group.id, draftId, b);
      else await cm.addNotice(group.id, b);
      say(draft ? '임시저장했어요' : `${n}명에게 보냈어요`);
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

      <Ask open={confirm} title={`${n}명에게 보낼까요?`} mood="phone" onClose={() => setConfirm(false)}
        body={`「${title.trim()}」${push ? '\n푸시로도 알려요. 보낸 뒤에는 취소할 수 없어요.' : '\n앱에서만 보여요(푸시 없음).'}${push && isNight() ? '\n\n지금은 밤이에요. 아침에 보내는 편이 좋아요.' : ''}`}
        buttons={[{ label: '다시 보기', tone: 'ghost', onPress: () => setConfirm(false) }, { label: busy ? '보내는 중…' : '보내기', onPress: () => { void submit(false); } }]} />
    </View>
  );
}
