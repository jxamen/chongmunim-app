/**
 * 쓴 사람(영수증 요청) 칸 — 지출에만(2026-09-27 대표님 「영수증 요청한 사람 등록」). 선택이라 비워 둬도 된다.
 * 누르면 모임 명단(앱 안 쓰는 회원 포함)에서 고르고, 없으면 이름을 직접 적는다(40자).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLoad } from '../store';
import * as cm from '../cm/api';
import { SPENT_BY_MAX, type SpentBy } from '../cm/model';
import { spentByLine } from '../cm/format';
import { Ask, Choices, Field, Text, Txt, s } from './kit';
import { F, useT } from './theme';

export function SpentByField({ value, onChange }: { value: SpentBy; onChange: (v: SpentBy) => void }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState('');
  const roster = useLoad(cm.roster);
  const close = () => { setOpen(false); setOwn(''); };

  return (
    <View style={{ gap: 6 }}>
      <Txt bold>쓴 사람(영수증 요청)</Txt>
      <Pressable onPress={() => { setOwn(value && !value.memberId ? value.name : ''); setOpen(true); }} accessibilityRole="button"
        style={[s.input, { borderColor: T.line, backgroundColor: T.white }]}>
        <Text style={[s.inputText, { fontSize: F.body, color: value ? T.ink : T.dim }]} numberOfLines={1}>
          {value ? spentByLine(value) : '선택 · 비워 둬도 돼요'}
        </Text>
        <Txt tone="sub">▾</Txt>
      </Pressable>

      <Ask open={open} title="쓴 사람(영수증 요청)" onClose={close}
        buttons={[
          { label: '비우기', tone: 'ghost', onPress: () => { onChange(null); close(); } },
          { label: '확인', onPress: () => { if (own.trim()) onChange({ memberId: null, name: own.trim() }); close(); } },
        ]}>
        {roster.data?.length ? (
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            <Choices items={roster.data.map((m) => ({ id: m.id, label: m.name }))} value={value?.memberId ?? null}
              onChange={(id) => { onChange({ memberId: id, name: roster.data?.find((m) => m.id === id)?.name ?? '' }); close(); }} />
          </ScrollView>
        ) : (
          <Txt size="small" tone="sub">{roster.error ? '명단을 못 불러왔어요 · 이름을 적어 주세요' : roster.loading ? '명단을 불러오는 중이에요' : '명단이 비어 있어요'}</Txt>
        )}
        <Field value={own} onChangeText={setOwn} placeholder="명단에 없으면 이름 적기" maxLength={SPENT_BY_MAX} />
      </Ask>
    </View>
  );
}
