/**
 * 달 · 해 고르기 — 장부 머리의 「2026년 8월 ▾」를 누르면 뜬다(2026-09-22 태훈님 「달력이 너무 작아 — 선택하면 달력이 뜨고
 * 월을 거기서 고르면 열리게」). ‹ › 로 한 칸씩 옮기는 것은 그대로 두고, 멀리 가는 것은 여기서 한 번에.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Btn, Text, Txt, s } from './kit';
import { F, R, S, useT } from './theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 달 — `ym` "2026-08". 해는 위 ‹ › 로 넘긴다 */
export function MonthPicker({ open, ym, now, onPick, onClose }: {
  open: boolean; ym: string; now: string; onPick: (ym: string) => void; onClose: () => void;
}) {
  const T = useT();
  const [y, setY] = useState(Number(ym.slice(0, 4)));
  useEffect(() => { if (open) setY(Number(ym.slice(0, 4))); }, [open, ym]);
  const key = (m: number) => `${y}-${String(m).padStart(2, '0')}`;

  return (
    <Sheet open={open} onClose={onClose}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Arrow label="‹" onPress={() => setY(y - 1)} a11y="지난해" />
        <Txt bold size="title">{y}년</Txt>
        <Arrow label="›" onPress={() => setY(y + 1)} a11y="다음 해" />
      </View>
      <View style={[s.row, s.wrap, { gap: 8 }]}>
        {MONTHS.map((m) => {
          const on = key(m) === ym;
          const later = key(m) > now;   // 아직 안 온 달 — 고를 수는 있다(비어 있을 뿐)

          return (
            <Pressable key={m} onPress={() => onPick(key(m))} accessibilityRole="button" accessibilityLabel={`${y}년 ${m}월`}
              style={({ pressed }) => [cell, { borderColor: on ? T.deep : T.line, backgroundColor: on ? T.deep : T.white }, pressed && s.pressed]}>
              <Text style={{ fontSize: F.head, fontWeight: on ? '900' : '700', color: on ? T.white : later ? T.dim : T.ink }}>{m}월</Text>
              {key(m) === now ? <Text style={{ fontSize: 11, fontWeight: '700', color: on ? T.white : T.deep }}>이번 달</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={[s.row, { gap: S.sm }]}>
        <Btn label="닫기" tone="ghost" style={s.grow} onPress={onClose} />
        <Btn label="이번 달로" style={s.grow} onPress={() => onPick(now)} />
      </View>
    </Sheet>
  );
}

/** 해 — 올해 앞뒤로 */
export function YearPicker({ open, year, now, onPick, onClose }: {
  open: boolean; year: number; now: number; onPick: (y: number) => void; onClose: () => void;
}) {
  const T = useT();
  const years = Array.from({ length: 9 }, (_, i) => now - 7 + i);   // 7년 전 ~ 내년(예산은 내년 것을 미리 짠다)

  return (
    <Sheet open={open} onClose={onClose}>
      <Txt bold size="title" style={{ textAlign: 'center' }}>해 고르기</Txt>
      <View style={[s.row, s.wrap, { gap: 8 }]}>
        {years.map((y) => {
          const on = y === year;

          return (
            <Pressable key={y} onPress={() => onPick(y)} accessibilityRole="button" accessibilityLabel={`${y}년`}
              style={({ pressed }) => [cell, { borderColor: on ? T.deep : T.line, backgroundColor: on ? T.deep : T.white }, pressed && s.pressed]}>
              <Text style={{ fontSize: F.head, fontWeight: on ? '900' : '700', color: on ? T.white : T.ink }}>{y}</Text>
              {y === now ? <Text style={{ fontSize: 11, fontWeight: '700', color: on ? T.white : T.deep }}>올해</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Btn label="닫기" tone="ghost" onPress={onClose} />
    </Sheet>
  );
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const T = useT();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose}>
        <Pressable style={[s.ask, { backgroundColor: T.white }]} onPress={() => undefined}>{children}</Pressable>
      </Pressable>
    </Modal>
  );
}

function Arrow({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const T = useT();

  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={a11y}
      style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }, pressed && s.pressed]}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: T.sub, marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

/** 칸 — 한 줄에 셋(모달 안쪽 폭 기준 30%) */
const cell = { width: '31%', minHeight: 58, borderRadius: R.field, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 } as const;
