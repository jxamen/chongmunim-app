/**
 * 설정(시안 11) — 테마를 고르는 자리. 관리자와 인수인계도 여기 있다.
 *
 * 테마는 **기기마다** 고른다(모임 전체에 강제하지 않는다). 공개 장부 링크는 서버가 만든 무작위 주소이고, 다시 만들면
 * 옛 링크는 죽는다. 연도 넘김은 이월을 따로 적지 않는다(잔액이 이어진다) — 다음 해 예산표를 올해 것으로 채워 둔다.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { bundleLabel } from '@jcurve/updates';
import { useApp } from '../store';
import * as cm from '../cm/api';
import { kstNow } from '../cm/format';
import { isManager } from '../cm/model';
import { APP_VERSION, LEGAL_BASE, publicLedgerUrl } from '../config';
import { copy, shareText } from '../share';
import { Ask, Body, Card, Chip, Head, MenuRow, Radio, Sep, Soft, Toggle, Txt, s as k } from '../ui/kit';
import { PALETTES, S, THEMES, THEME_LABEL, useT } from '../ui/theme';

export function SettingsScreen() {
  const { group, theme, setTheme, open, say, fail, reloadGroup, reland, logout, withdraw, updateNotice, setUpdateNotice, member } = useApp();
  const T = useT();
  const [ask, setAsk] = useState<null | 'rollover' | 'logout' | 'withdraw' | 'leave' | 'link'>(null);
  const [busy, setBusy] = useState(false);
  if (!group) return null;
  const manager = isManager(group.me.role);
  const owner = group.me.role === 'owner';
  const year = kstNow().year;
  const notifyOn = group.me.notify.notice || group.me.notify.dues || group.me.notify.request;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { fail(e); } finally { setBusy(false); setAsk(null); }
  };

  const linkOn = () => run(async () => {
    const token = await cm.setPublicLink(group.id, true);
    await reloadGroup();
    await copy(publicLedgerUrl(token));
    say('새 링크를 만들고 복사했어요 · 옛 링크는 이제 안 열려요');
  });
  const linkOff = () => run(async () => {
    await cm.setPublicLink(group.id, false);
    await reloadGroup();
    say('공개 장부 링크를 껐어요');
  });

  return (
    <View style={{ flex: 1 }}>
      <Head title="설정" />
      <Body>
        <Card style={{ gap: 2 }}>
          <Txt size="small" tone="sub" bold style={{ marginBottom: 4 }}>테마</Txt>
          {THEMES.map((t, i) => (
            <View key={t}>
              {i > 0 ? <Sep /> : null}
              <Pressable onPress={() => setTheme(t)} style={[k.row, { gap: 10, paddingVertical: 12 }]}>
                <Radio on={theme === t} />
                <Txt bold style={k.grow}>{THEME_LABEL[t]}</Txt>
                <View style={[k.row, { gap: 4 }]}>
                  <View style={{ width: 17, height: 17, borderRadius: 999, backgroundColor: PALETTES[t].point }} />
                  <View style={{ width: 17, height: 17, borderRadius: 999, backgroundColor: PALETTES[t].tint, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }} />
                </View>
              </Pressable>
            </View>
          ))}
        </Card>

        {owner && group.admins === 0 ? (
          <Soft tone="warn" title="관리자를 한 명 더 두세요" sub="총무가 연락이 끊겨도 모임 장부가 잠기지 않아요" onPress={() => open({ kind: 'members' })} />
        ) : null}

        <Card style={{ paddingVertical: 2 }}>
          <MenuRow label="내 정보 · 받을 계좌" value={group.me.bankAccount ? '적어 둠' : '비어 있음'} onPress={() => open({ kind: 'profile' })} />
          <Sep />
          <MenuRow label="알림" value={notifyOn ? '푸시 켬' : '꺼 둠'} onPress={() => open({ kind: 'profile' })} />
          {manager ? (
            <>
              <Sep />
              <MenuRow label="관리자" value={`${group.admins + 1}명`} onPress={() => open({ kind: 'members' })} />
              <Sep />
              <MenuRow label="항목 관리" value={`${group.categories}개`} onPress={() => open({ kind: 'categories' })} />
              <Sep />
              <MenuRow label="공개 장부 링크" right={group.publicToken
                ? <Chip label="복사" tone="tint" onPress={() => { void copy(publicLedgerUrl(group.publicToken!)).then(() => say('링크를 복사했어요 · 단체방에 붙여 주세요')); }} />
                : <Chip label="만들기" tone="tint" onPress={() => { void linkOn(); }} />}
                onPress={group.publicToken ? () => setAsk('link') : undefined} />
            </>
          ) : null}
        </Card>

        {manager ? (
          <Card style={{ paddingVertical: 2 }}>
            <MenuRow label="모임 정보 · 월 회비" value={group.duesAmount ? `${group.duesAmount.toLocaleString()}원` : '회비 없음'} onPress={() => open({ kind: 'groupEdit' })} />
            <Sep />
            <MenuRow label="과거 데이터 가져오기" value="기초 잔액" onPress={() => open({ kind: 'groupEdit' })} />
            {owner ? (<><Sep /><MenuRow label="총무 넘기기" value={group.transfer ? `${group.transfer.to ?? ''} 수락 대기` : undefined} onPress={() => open({ kind: 'transfer' })} /></>) : null}
            <Sep />
            <MenuRow label="연도 넘김" value={`${year + 1}년 준비`} onPress={() => setAsk('rollover')} />
          </Card>
        ) : null}

        <Card style={{ paddingVertical: 2 }}>
          <MenuRow label="모임 바꾸기 · 새 모임" value={group.name} onPress={() => open({ kind: 'groups' })} />
          <Sep />
          <MenuRow label="새 버전 알려 주기" right={<Toggle on={updateNotice} onChange={setUpdateNotice} />} />
          <Sep />
          <MenuRow label="이용약관" onPress={() => { void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/terms`).catch(() => undefined); }} />
          <Sep />
          <MenuRow label="개인정보 처리방침" onPress={() => { void WebBrowser.openBrowserAsync(`${LEGAL_BASE}/privacy`).catch(() => undefined); }} />
        </Card>

        <Card style={{ paddingVertical: 2 }}>
          {!owner ? (<><MenuRow label="이 모임 나가기" onPress={() => setAsk('leave')} /><Sep /></>) : null}
          <MenuRow label="로그아웃" onPress={() => setAsk('logout')} />
          <Sep />
          <MenuRow label="회원 탈퇴" danger onPress={() => setAsk('withdraw')} />
        </Card>
        <Txt size="tiny" tone="dim" style={{ textAlign: 'center' }}>
          총무님 {APP_VERSION}{bundleLabel() ? ` · ${bundleLabel()}` : ''}{member?.provider === 'guest' ? ' · 둘러보기 계정' : ''}
        </Txt>
      </Body>

      <Ask open={ask === 'rollover'} title={`${year + 1}년을 준비할까요?`} mood="calculator" onClose={() => setAsk(null)}
        body={`${year}년 예산표(금액·산출 근거)를 ${year + 1}년으로 복사해요. 이미 적어 둔 항목은 그대로 둬요.\n잔액은 따로 옮기지 않아도 이어져요.`}
        buttons={[{ label: '다음에', tone: 'ghost', onPress: () => setAsk(null) }, {
          label: busy ? '준비 중…' : '준비하기',
          onPress: () => { void run(async () => { const r = await cm.rollover(group.id, year); say(`${r.year}년 예산 ${r.copied}줄을 준비했어요`); }); },
        }]} />
      <Ask open={ask === 'link'} title="공개 장부 링크" mood="peek" onClose={() => setAsk(null)}
        body="링크를 받은 사람은 잔액·쓰임새·최근 내역을 볼 수 있어요(회비 명단은 안 보여요). 새로 만들면 옛 링크는 안 열려요."
        buttons={[
          { label: '끄기', tone: 'ghost', onPress: () => { void linkOff(); } },
          { label: '공유', tone: 'ghost', onPress: () => { void shareText(`[${group.name}] 장부 보기\n${publicLedgerUrl(group.publicToken ?? '')}`); setAsk(null); } },
          { label: '새로 만들기', onPress: () => { void linkOn(); } },
        ]} />
      <Ask open={ask === 'leave'} title="이 모임에서 나갈까요?" mood="tear" onClose={() => setAsk(null)}
        body="장부와 내 지급 요청 기록은 모임에 남아요. 초대 코드로 다시 들어올 수 있어요."
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAsk(null) }, {
          label: '나가기', tone: 'danger',
          onPress: () => { void run(async () => { await cm.leaveGroup(group.id); await reland(); }); },
        }]} />
      <Ask open={ask === 'logout'} title="로그아웃할까요?" mood="sleeping" onClose={() => setAsk(null)}
        body={member?.provider === 'guest' ? '둘러보기 계정은 로그아웃하면 다시 들어올 수 없어요. 먼저 카카오·구글·애플로 이어 두세요.' : '다시 로그인하면 그대로 이어서 볼 수 있어요.'}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAsk(null) }, { label: '로그아웃', onPress: () => { setAsk(null); void logout(); } }]} />
      <Ask open={ask === 'withdraw'} title="정말 탈퇴할까요?" mood="crying" onClose={() => setAsk(null)}
        body={owner ? '총무인 모임이 있으면 먼저 총무를 넘겨 주세요. 탈퇴하면 로그인 정보가 지워지고 되돌릴 수 없어요.' : '탈퇴하면 로그인 정보가 지워지고 되돌릴 수 없어요. 모임 장부 기록은 모임에 남아요.'}
        buttons={[{ label: '닫기', tone: 'ghost', onPress: () => setAsk(null) }, { label: '탈퇴', tone: 'danger', onPress: () => { setAsk(null); void withdraw(); } }]} />
    </View>
  );

}

