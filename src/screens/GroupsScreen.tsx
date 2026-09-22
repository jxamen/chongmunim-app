/**
 * 모임 만들기 · 초대 코드로 들어가기 · (있으면) 내 모임 고르기.
 *
 * 첫 실행(모임이 하나도 없다)에 한 번 뜨고, 설정 › 모임 바꾸기에서도 같은 화면이 쪽으로 뜬다.
 * 만든 사람이 총무다. 초대 코드는 모임 › 회원에서 총무·관리자가 보고 알려 준다.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { defaultMyName, useApp } from '../store';
import * as cm from '../cm/api';
import { readAmount, amountInput } from '../cm/format';
import { Ask, Body, Btn, Card, Chip, Field, Head, MenuRow, Sep, Tabs, Txt } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { track } from '../track';
import { S } from '../ui/theme';

const ROLE: Record<string, string> = { owner: '총무', admin: '관리자', member: '회원' };

export function GroupsScreen({ asPage }: { asPage?: boolean }) {
  const { member, groups, group, enterGroup, selectGroup, back, fail, logout } = useApp();
  const [mode, setMode] = useState<'make' | 'join'>('make');
  const [out, setOut] = useState(false);
  const [name, setName] = useState('');
  const [myName, setMyName] = useState(defaultMyName(member?.name));
  const [dues, setDues] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const make = () => run(async () => {
    await enterGroup(await cm.createGroup({ name: name.trim(), myName: myName.trim() || undefined, duesAmount: readAmount(dues) ?? 0 }));
  });
  const join = () => run(async () => {
    const g = await cm.joinGroup(code.trim().toUpperCase(), myName.trim() || undefined);
    track('invite_join', {});
    await enterGroup(g);
  });

  return (
    <View style={{ flex: 1 }}>
      <Head title={asPage ? '모임' : '총무님'} onClose={asPage ? back : undefined} />
      <Body>
        {!asPage ? (
          <View style={st.hero}>
            <Mascot mood="cheer" size={96} />
            <Txt bold size="head">어느 모임의 장부를 볼까요?</Txt>
            <Txt tone="sub" size="small">총무라면 새로 만들고, 회원이라면 초대 코드로 들어와요</Txt>
          </View>
        ) : null}

        {asPage && groups.length > 0 ? (
          <Card style={{ paddingVertical: 2 }}>
            {groups.map((g, i) => (
              <View key={g.id}>
                {i > 0 ? <Sep /> : null}
                <MenuRow label={g.name} value={`${ROLE[g.role]} · ${g.members}명`}
                  right={g.id === group?.id ? <Chip label="보는 중" tone="tint" /> : undefined}
                  onPress={g.id === group?.id ? undefined : () => { void run(() => selectGroup(g.id)); }} />
              </View>
            ))}
          </Card>
        ) : null}

        <Tabs items={[{ id: 'make', label: '새 모임 만들기' }, { id: 'join', label: '초대 코드로 들어가기' }]} value={mode} onChange={setMode} />
        <Card style={{ gap: S.lg }}>
          {mode === 'make' ? (
            <>
              <Field label="모임 이름" value={name} onChangeText={setName} placeholder="예) 토요등산회" maxLength={40} />
              <Field label="내 이름" value={myName} onChangeText={setMyName} placeholder="모임에서 부르는 이름" maxLength={30} />
              <Field label="월 회비(없으면 비워 두세요)" value={dues} onChangeText={(v) => setDues(amountInput(v))} keyboardType="number-pad"
                placeholder="40,000" right={<Txt tone="sub">원</Txt>} />
              <Btn label="모임 만들기" loading={busy} disabled={name.trim() === ''} onPress={() => { void make(); }} />
              <Txt tone="dim" size="tiny">만든 사람이 총무가 돼요. 항목(식비·물품·교통비…)은 기본으로 깔아 두고, 설정에서 고칠 수 있어요.</Txt>
            </>
          ) : (
            <>
              <Field label="초대 코드" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="여섯 자리" autoCapitalize="characters" maxLength={12} />
              <Field label="모임에서 쓰는 내 이름" value={myName} onChangeText={setMyName} placeholder="예) 이수진" maxLength={30} />
              <Btn label="들어가기" loading={busy} disabled={code.trim().length < 6} onPress={() => { void join(); }} />
              <Txt tone="dim" size="tiny">총무님이 명단에 적어 둔 이름과 같으면 그 자리(회비 기록)를 이어받아요.</Txt>
            </>
          )}
        </Card>

        {/* 다른 방법으로 로그인해 새 계정이 된 사람의 출구 — 이 화면에는 설정(로그아웃)이 없다
            (2026-09-23 태훈님: 카카오로 만든 모임을 두고 구글로 로그인하니 「기능이 싹 사라짐」) */}
        {!asPage && groups.length === 0 && member?.provider !== 'guest' ? (
          <Card style={{ gap: S.sm }}>
            <Txt bold>전에 쓰던 모임이 안 보이나요?</Txt>
            <Txt tone="sub" size="small">처음 가입한 방법(카카오·구글·애플)으로 로그인해야 그 모임이 보여요. 다른 방법으로 들어오면 새 계정이 돼요.</Txt>
            <Btn label="다른 방법으로 로그인하기" tone="ghost" onPress={() => setOut(true)} />
          </Card>
        ) : null}
      </Body>

      <Ask open={out} title="로그아웃하고 다시 로그인할까요?" mood="sleeping" onClose={() => setOut(false)}
        body="카카오·구글·애플 중 다른 방법으로 들어가 볼 수 있어요. 지금 계정은 그대로 남아요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setOut(false) }, { label: '로그아웃', onPress: () => { setOut(false); void logout(); } }]} />
    </View>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingVertical: S.lg },
});
