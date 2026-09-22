/**
 * 날짜 칸 — 누르면 달력이 뜨고 날을 누르면 들어간다(2026-09-22 태훈님 「달력으로 지정하기」). 「2026-09-22」를 손으로
 * 치지 않는다. 값은 장부와 같은 「YYYY-MM-DD」 글자. 선택 칸(끝 날짜 등)은 「지우기」가 있다.
 * 네이티브 날짜 선택기는 새 빌드가 필요해 쓰지 않는다 — 앱 안 달력(Modal).
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { kstNow } from '../cm/format';
import { monthGrid, parseYmd, shiftYm, ymdLabel } from '../cm/calendar';
import { Btn, Text, Txt, s } from './kit';
import { F, S, useT } from './theme';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function DateField({ label, value, onChange, placeholder = '날짜 고르기', optional, disabled, min, style }: {
  label?: string; value: string; onChange: (ymd: string) => void; placeholder?: string;
  /** 비워 둘 수 있는 칸(끝 날짜 등) — 「지우기」 */
  optional?: boolean; disabled?: boolean;
  /** 이 날보다 앞은 못 고른다(끝 날짜) */
  min?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const today = kstNow().ymd;
  const start = parseYmd(value) ?? parseYmd(min ?? '') ?? parseYmd(today)!;
  const [ym, setYm] = useState<[number, number]>([start[0], start[1]]);
  useEffect(() => { if (open) setYm([start[0], start[1]]); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ymdLabel(value, Number(today.slice(0, 4)));

  const pick = (ymd: string) => { onChange(ymd); setOpen(false); };

  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={{ fontSize: F.body, fontWeight: '700', color: T.ink }}>{label}</Text> : null}
      <Pressable onPress={() => { if (!disabled) setOpen(true); }} accessibilityRole="button" accessibilityLabel={`${label ?? '날짜'} ${shown ?? '비어 있음'}`}
        style={[s.input, { borderColor: T.line, backgroundColor: disabled ? T.track : T.white }]}>
        <Text style={[s.inputText, { fontSize: F.body, color: shown ? T.ink : T.dim }]} numberOfLines={1}>{shown ?? placeholder}</Text>
        <Txt tone="sub">📅</Txt>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.dim} onPress={() => setOpen(false)}>
          <Pressable style={[s.ask, { backgroundColor: T.white, gap: S.sm }]} onPress={() => undefined}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Pressable onPress={() => setYm(shiftYm(ym[0], ym[1], -1))} hitSlop={10} accessibilityLabel="지난달" style={{ padding: 8 }}>
                <Txt bold tone="sub">‹</Txt>
              </Pressable>
              <Txt bold size="head">{`${ym[0]}년 ${ym[1]}월`}</Txt>
              <Pressable onPress={() => setYm(shiftYm(ym[0], ym[1], 1))} hitSlop={10} accessibilityLabel="다음 달" style={{ padding: 8 }}>
                <Txt bold tone="sub">›</Txt>
              </Pressable>
            </View>
            <View style={s.row}>
              {DOW.map((d, i) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: i === 0 ? T.danger : T.sub }}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthGrid(ym[0], ym[1]).map((c, i) => {
                const on = c.ymd === value;
                const off = !!min && c.ymd < min;

                return (
                  <Pressable key={c.ymd} disabled={off} onPress={() => pick(c.ymd)} accessibilityRole="button" accessibilityLabel={c.ymd}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={[{ width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
                      on && { backgroundColor: T.deep }, !on && c.ymd === today && { borderWidth: 1.5, borderColor: T.deep }]}>
                      <Text style={{ fontSize: F.body, fontWeight: on ? '900' : '600',
                        color: on ? T.white : off ? T.line : !c.inMonth ? T.dim : i % 7 === 0 ? T.danger : T.ink }}>{c.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={[s.row, { gap: S.sm }]}>
              {optional && value ? <Btn label="지우기" tone="ghost" small style={s.grow} onPress={() => pick('')} /> : null}
              <Btn label="오늘" tone="ghost" small style={s.grow} disabled={!!min && today < min} onPress={() => pick(today)} />
              <Btn label="닫기" small style={s.grow} onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
