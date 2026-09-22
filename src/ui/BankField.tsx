/**
 * 은행 고르기 칸 — **콤보박스**: 누르면 칸 바로 아래로 은행 목록이 펼쳐지고, 고르면 접힌다(2026-09-22 태훈님
 * 「은행은 콤보박스로」 → 칩 격자 창을 보고 「이건 콤보가 아니잖아」). 손으로 적으면 「국민은행」·「KB」·「국민」이 섞여
 * 총무가 은행 앱에서 받는 곳을 찾기 어렵다. 목록에 없는 곳(증권사 등)은 맨 아래 「직접 적기」.
 *
 * 네이티브 선택기(@react-native-picker)는 새 빌드가 필요해 쓰지 않는다 — 칸의 창 좌표를 재서(measureInWindow) 투명한
 * Modal 위에 목록을 그 자리에 띄운다. 아래 자리가 모자라면 칸 위로 펼친다. 바깥을 누르면 닫힌다.
 */
import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { BANKS } from '../cm/banks';
import { Text, Txt, s } from './kit';
import { F, R, S, shadow, useT } from './theme';

const ROW = 46;

export function BankField({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle> }) {
  const T = useT();
  const win = useWindowDimensions();
  const anchor = useRef<View | null>(null);
  const [at, setAt] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [own, setOwn] = useState<string | null>(null);   // 직접 적는 중이면 그 글자
  const listed = (BANKS as readonly string[]).includes(value);

  const openList = () => {
    const v = anchor.current;
    if (!v) return;
    v.measureInWindow((x, y, w, h) => setAt({ x, y, w, h }));
  };
  const close = () => { setAt(null); setOwn(null); };
  const pick = (v: string) => { onChange(v); close(); };

  // 목록 자리 — 칸 아래가 기본, 모자라면 위로. 폭은 칸보다 좁지 않게(은행 칸은 한 줄에 계좌번호와 나눠 쓴다)
  const width = at ? Math.min(Math.max(at.w, 200), win.width - 2 * S.lg) : 0;
  const left = at ? Math.min(at.x, win.width - S.lg - width) : 0;
  const below = at ? win.height - (at.y + at.h) - 24 : 0;
  const above = at ? at.y - 48 : 0;
  const down = below >= 240 || below >= above;
  const maxH = Math.min(ROW * 7.5, down ? below : above);

  return (
    <>
      <Pressable ref={anchor} onPress={openList} accessibilityRole="combobox" accessibilityLabel={value ? `은행 ${value}` : '은행 고르기'}
        accessibilityState={{ expanded: !!at }}
        style={[s.input, { borderColor: at ? T.deep : T.line, backgroundColor: T.white }, style]}>
        <Text style={[s.inputText, { fontSize: F.body, color: value ? T.ink : T.dim }]} numberOfLines={1}>{value || '은행'}</Text>
        <Txt tone="sub">{at ? '▴' : '▾'}</Txt>
      </Pressable>

      <Modal visible={!!at} transparent animationType="none" onRequestClose={close}>
        <Pressable style={{ flex: 1 }} onPress={close}>
          {at ? (
            <Pressable onPress={() => undefined}
              style={[{
                position: 'absolute', left, width, maxHeight: maxH + (own !== null ? 64 : 0),
                ...(down ? { top: at.y + at.h + 4 } : { bottom: win.height - at.y + 4 }),
                borderRadius: R.field, borderWidth: 1, borderColor: T.line, backgroundColor: T.white, overflow: 'hidden',
              }, shadow]}>
              {own === null ? (
                <ScrollView style={{ maxHeight: maxH }} keyboardShouldPersistTaps="handled">
                  {BANKS.map((b) => {
                    const on = b === value;

                    return (
                      <Pressable key={b} onPress={() => pick(b)} accessibilityRole="menuitem" accessibilityState={{ selected: on }}
                        style={({ pressed }) => [{ height: ROW, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
                          on && { backgroundColor: T.tint }, pressed && { backgroundColor: T.track }]}>
                        <Text style={{ flex: 1, fontSize: F.body, fontWeight: on ? '800' : '500', color: on ? T.deep : T.ink }}>{b}</Text>
                        {on ? <Text style={{ fontSize: F.body, fontWeight: '900', color: T.deep }}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => setOwn(listed ? '' : value)} accessibilityRole="menuitem"
                    style={({ pressed }) => [{ height: ROW, paddingHorizontal: 14, justifyContent: 'center', borderTopWidth: 1, borderTopColor: T.line },
                      !listed && value ? { backgroundColor: T.tint } : null, pressed && { backgroundColor: T.track }]}>
                    <Text style={{ fontSize: F.body, fontWeight: '700', color: T.sub }}>{!listed && value ? `직접 적기 · ${value}` : '직접 적기…'}</Text>
                  </Pressable>
                </ScrollView>
              ) : (
                <View style={{ padding: 10, gap: 8 }}>
                  <TextInput value={own} onChangeText={setOwn} placeholder="예) 미래에셋증권" placeholderTextColor={T.dim} maxLength={20} autoFocus
                    returnKeyType="done" onSubmitEditing={() => { if (own.trim()) pick(own.trim()); }}
                    style={[s.input, { borderColor: T.line, fontSize: F.body, color: T.ink }]} />
                  <View style={[s.row, { gap: 8 }]}>
                    <Pressable onPress={() => setOwn(null)} style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Txt size="small" tone="sub">목록으로</Txt>
                    </Pressable>
                    <Pressable onPress={() => { if (own.trim()) pick(own.trim()); }}
                      style={{ flex: 1, height: 40, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', backgroundColor: T.deep }}>
                      <Text style={{ fontSize: F.small, fontWeight: '800', color: T.white }}>적기</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
