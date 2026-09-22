/**
 * 은행 고르기 칸 — 누르면 은행 목록이 뜬다(2026-09-22 태훈님 「은행은 콤보박스로」). 손으로 적으면 「국민은행」·「KB」·「국민」이
 * 섞여 총무가 은행 앱에서 받는 곳을 찾기 어렵다. 목록에 없는 곳(증권사 등)은 「직접 적기」.
 * 네이티브 선택기(@react-native-picker)는 새 빌드가 필요해 쓰지 않는다 — 확인창(Ask) 안의 칩 줄로 연다.
 */
import React, { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { BANKS } from '../cm/banks';
import { Ask, Chip, Field, Text, Txt, s } from './kit';
import { F, S, useT } from './theme';

export function BankField({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle> }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState<string | null>(null);   // 직접 적는 중이면 그 글자
  const listed = (BANKS as readonly string[]).includes(value);

  const close = () => { setOpen(false); setOwn(null); };
  const pick = (v: string) => { onChange(v); close(); };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={value ? `은행 ${value}` : '은행 고르기'}
        style={[s.input, { borderColor: T.line, backgroundColor: T.white }, style]}>
        <Text style={[s.inputText, { fontSize: F.body, color: value ? T.ink : T.dim }]} numberOfLines={1}>{value || '은행'}</Text>
        <Txt tone="sub">▾</Txt>
      </Pressable>
      <Ask open={open} title="은행 고르기" onClose={close}
        buttons={own === null
          ? [{ label: '닫기', tone: 'ghost', onPress: close }]
          : [{ label: '목록으로', tone: 'ghost', onPress: () => setOwn(null) }, { label: '적기', onPress: () => { if (own.trim()) pick(own.trim()); } }]}>
        {own === null ? (
          <View style={[s.row, s.wrap, { gap: 6, justifyContent: 'center' }]}>
            {BANKS.map((b) => <Chip key={b} label={b} tone={b === value ? 'on' : 'plain'} onPress={() => pick(b)} />)}
            <Chip label={value && !listed ? `직접 적기 · ${value}` : '직접 적기'} tone={value && !listed ? 'on' : 'dim'}
              onPress={() => setOwn(listed ? '' : value)} />
          </View>
        ) : (
          <Field value={own} onChangeText={setOwn} placeholder="예) 미래에셋증권" maxLength={20} autoFocus inputStyle={{ fontSize: F.body }}
            style={{ marginTop: S.xs }} />
        )}
      </Ask>
    </>
  );
}
