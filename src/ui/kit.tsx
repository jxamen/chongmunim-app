/**
 * 화면 조각 — 시안 `design/chongmunim-app.html` 의 부품을 그대로 옮긴 것.
 *
 *   .card · .chip(on·tint·warn) · .pill · .btn(main·ghost) · .soft · .listrow(.pipe) · .kv · .sep · .tabs · .input · .ta · 토글 · 라디오
 *
 * 화면 코드가 StyleSheet 를 매번 다시 쓰지 않게 여기 모은다. 색은 `useT()`(테마) 만 본다.
 * 확인창·입력창은 RN `Alert` 대신 여기 것을 쓴다 — 웹 미리보기에서 `Alert` 가 아무것도 안 한다.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput as RNTextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useKeyboardPad } from './keyboard';
import { revealY } from './hiddenBy';
import { F, R, S, shadow, useT } from './theme';
import { withPretendard } from './font';
import { Mascot, type Mood } from './Mascot';
import { signed, won } from '../cm/format';

/* ── 글자 ── */

/** 앱의 모든 글자 — Pretendard, `fontWeight` 는 그 무게의 글꼴로 바꿔 그린다(`./font`). RN `Text` 대신 이것을 쓴다 */
export function Text({ style, ...rest }: React.ComponentProps<typeof RNText>) {
  return <RNText {...rest} style={withPretendard(StyleSheet.flatten(style))} />;
}

function TextInput({ style, ...rest }: TextInputProps) {
  return <RNTextInput {...rest} style={withPretendard(StyleSheet.flatten(style))} />;
}

type TextProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

/** 화면 제목 — Pretendard ExtraBold */
export function Title({ children, style, numberOfLines = 1 }: TextProps) {
  const T = useT();

  return <Text numberOfLines={numberOfLines} style={[s.title, { color: T.ink }, style]}>{children}</Text>;
}

export function Txt({ children, style, numberOfLines, size = 'body', tone = 'ink', bold }: TextProps & {
  size?: keyof typeof F; tone?: 'ink' | 'sub' | 'dim' | 'deep' | 'pos' | 'warn' | 'white' | 'danger'; bold?: boolean;
}) {
  const T = useT();
  const color = tone === 'ink' ? T.ink : tone === 'sub' ? T.sub : tone === 'dim' ? T.dim : tone === 'deep' ? T.deep
    : tone === 'pos' ? T.pos : tone === 'warn' ? T.warnInk : tone === 'danger' ? T.danger : T.white;

  return <Text numberOfLines={numberOfLines} style={[{ fontSize: F[size], color, fontWeight: bold ? '700' : '400' }, style]}>{children}</Text>;
}

/** 큰 금액 — 「1,284,000 원」 */
export function Big({ value, size = F.hero, unit = true, tone }: { value: number; size?: number; unit?: boolean; tone?: 'pos' }) {
  const T = useT();

  return (
    <Text style={[s.num, { fontSize: size, color: tone === 'pos' ? T.pos : T.ink }]}>
      {won(value)}{unit ? <Text style={{ fontSize: Math.round(size * 0.58) }}> 원</Text> : null}
    </Text>
  );
}

/** 방향을 붙인 금액 — 수입은 초록 */
export function Amount({ value, direction, size = 'body', bold = true }: { value: number; direction: 'in' | 'out'; size?: keyof typeof F; bold?: boolean }) {
  const T = useT();

  return (
    <Text style={[s.amt, { fontSize: F[size], color: direction === 'in' ? T.pos : T.ink, fontWeight: bold ? '800' : '600' }]}>
      {signed(value, direction)}
    </Text>
  );
}

/* ── 틀 ── */

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const T = useT();
  const box = [s.card, { borderColor: T.line, backgroundColor: T.white }, style];
  if (!onPress) return <View style={box}>{children}</View>;

  return <Pressable onPress={onPress} style={({ pressed }) => [box, pressed && s.pressed]}>{children}</Pressable>;
}

export const Sep = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const T = useT();

  return <View style={[{ height: 1, backgroundColor: T.line }, style]} />;
};

/** 화면 머리 — 제목 + 오른쪽 자리. 닫기(✕)나 뒤로(‹)가 있으면 왼쪽에 */
export function Head({ title, right, onClose, onBack, left }: {
  title: React.ReactNode; right?: React.ReactNode; onClose?: () => void; onBack?: () => void; left?: React.ReactNode;
}) {
  const T = useT();

  return (
    <View style={s.head}>
      <View style={[s.row, { gap: S.sm, flexShrink: 1 }]}>
        {onBack ? <Pressable onPress={onBack} hitSlop={12}><Text style={[s.headIcon, { color: T.sub }]}>‹</Text></Pressable> : null}
        {left}
        {typeof title === 'string' ? <Title>{title}</Title> : title}
      </View>
      <View style={[s.row, { gap: 6 }]}>
        {right}
        {onClose ? <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기"><Text style={[s.close, { color: T.sub }]}>✕</Text></Pressable> : null}
      </View>
    </View>
  );
}

/** 탭 줄(시안 .tabs) — 밑줄. 글자는 머리 크기(17) — 15.5 는 폰에서 너무 작았다(2026-09-22 태훈님) */
export function Tabs<K extends string>({ items, value, onChange }: { items: { id: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const T = useT();

  return (
    <View style={[s.tabs, { borderBottomColor: T.line }]}>
      {items.map((it) => {
        const on = it.id === value;

        return (
          <Pressable key={it.id} onPress={() => onChange(it.id)} hitSlop={6}
            style={[s.tab, on && { borderBottomColor: T.ink }]}>
            <Text style={{ fontSize: F.head, color: on ? T.ink : T.sub, fontWeight: on ? '800' : '600' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── 칩 · 알약 ── */

export function Chip({ label, tone = 'plain', onPress, style }: {
  label: string; tone?: 'plain' | 'on' | 'tint' | 'warn' | 'dim'; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const T = useT();
  const bg = tone === 'on' ? T.deep : tone === 'tint' ? T.tint : tone === 'warn' ? T.warnTint : T.white;
  const bd = tone === 'on' ? T.deep : tone === 'tint' ? T.tintLine : tone === 'warn' ? T.warnLine : T.line;
  const fg = tone === 'on' ? T.white : tone === 'tint' ? T.deep : tone === 'warn' ? T.warnInk : tone === 'dim' ? T.dim : T.sub;
  const body = <Text style={{ fontSize: F.tiny, color: fg, fontWeight: tone === 'plain' || tone === 'dim' ? '500' : '700' }}>{label}</Text>;
  const box = [s.chip, { backgroundColor: bg, borderColor: bd }, style];
  if (!onPress) return <View style={box}>{body}</View>;

  return <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => [box, pressed && s.pressed]}>{body}</Pressable>;
}

export function Pill({ label }: { label: string }) {
  const T = useT();

  return <View style={[s.pill, { backgroundColor: T.point }]}><Text style={s.pillText}>{label}</Text></View>;
}

/* ── 버튼 ── */

/**
 * 인자를 받는 함수를 `onPress` 에 **직접 넘기지 않는다**(용돈캡슐 kit 규칙) — 터치 이벤트가 첫 인자로 들어간다.
 * 그래서 인자 없는 함수만 받는다.
 */
export function Btn({ label, onPress, tone = 'main', loading, disabled, style, small }: {
  label: string; onPress: () => void; tone?: 'main' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const T = useT();
  const off = !!(disabled || loading);
  const bg = tone === 'ghost' ? T.white : off ? T.dim : tone === 'danger' ? T.danger : T.deep;
  const fg = tone === 'ghost' ? (off ? T.dim : T.sub) : T.white;

  return (
    <Pressable
      onPress={() => { if (!off) onPress(); }}
      accessibilityRole="button" disabled={off}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg },
        tone === 'ghost' && { borderWidth: 1, borderColor: T.line }, pressed && !off && s.pressed, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <Text style={{ color: fg, fontSize: small ? F.small : F.body, fontWeight: tone === 'ghost' ? '600' : '800' }}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ── 줄 ── */

/** 할 일 띠(시안 .soft) — 「2건 · 지급 요청이 기다려요 · 합계 41,200원 ›」 */
export function Soft({ pill, title, sub, onPress, tone = 'tint', icon }: {
  pill?: string; title: string; sub?: string; onPress?: () => void; tone?: 'tint' | 'warn'; icon?: React.ReactNode;
}) {
  const T = useT();
  const warn = tone === 'warn';

  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.soft, { backgroundColor: warn ? T.warnTint : T.tint, borderColor: warn ? T.warnLine : T.tintLine }, pressed && s.pressed]}>
      {icon}
      {pill ? <Pill label={pill} /> : null}
      <View style={s.grow}>
        <Text style={{ fontSize: F.body, fontWeight: '700', color: warn ? T.warnInk : T.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: F.tiny, color: warn ? T.warnInk : T.sub, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {onPress ? <Text style={{ color: T.sub, fontSize: F.head }}>›</Text> : null}
    </Pressable>
  );
}

/** 장부 한 줄(시안 .listrow) — 왼쪽 세로 줄 색이 수입(초록)·지출(테마색) */
export function LedgerRow({ title, sub, value, direction, onPress, badge }: {
  title: string; sub?: string; value: number; direction: 'in' | 'out'; onPress?: () => void; badge?: string;
}) {
  const T = useT();

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.listrow, pressed && s.pressed]}>
      <View style={[s.pipe, { backgroundColor: direction === 'in' ? T.pos : T.point }]} />
      <View style={s.grow}>
        <View style={[s.row, { gap: 6 }]}>
          <Text numberOfLines={1} style={{ fontSize: F.body, fontWeight: '700', color: T.ink, flexShrink: 1 }}>{title}</Text>
          {badge ? <Chip label={badge} tone="warn" style={{ paddingVertical: 1, paddingHorizontal: 6 }} /> : null}
        </View>
        {sub ? <Text numberOfLines={1} style={{ fontSize: F.tiny, color: T.sub, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Amount value={value} direction={direction} />
    </Pressable>
  );
}

/** 왼쪽 이름 · 오른쪽 값(시안 .kv) */
export function KV({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'pos' }) {
  const T = useT();

  return (
    <View style={s.kv}>
      <Text style={{ fontSize: F.body, color: strong ? T.ink : T.sub, fontWeight: strong ? '700' : '400' }}>{label}</Text>
      <Text style={[s.amt, { fontSize: strong ? F.head : F.body, fontWeight: '800', color: tone === 'pos' ? T.pos : T.ink }]}>{value}</Text>
    </View>
  );
}

/** 설정 목록 한 줄 — 「관리자 3명 ›」 */
export function MenuRow({ label, value, onPress, right, danger }: { label: string; value?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  const T = useT();
  const body = (
    <>
      <Text style={[s.grow, { fontSize: F.body, fontWeight: '700', color: danger ? T.danger : T.ink }]}>{label}</Text>
      {value ? <Text style={{ fontSize: F.small, color: T.sub }}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Text style={{ color: T.dim, fontSize: F.head }}>›</Text> : null}
    </>
  );
  // 누를 곳이 없는 줄(오른쪽에 토글만)은 그냥 줄이다 — 꺼 둔 Pressable 로 감싸면 안의 토글까지 「비활성」으로 읽힌다
  if (!onPress) return <View style={s.menu}>{body}</View>;

  return <Pressable onPress={onPress} style={({ pressed }) => [s.menu, pressed && s.pressed]}>{body}</Pressable>;
}

/* ── 입력 ── */

export function Field({ label, right, style, inputStyle, ...rest }: TextInputProps & {
  label?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>;
}) {
  const T = useT();
  const body = useContext(BodyContext);
  const rowRef = useRef<View | null>(null);

  return (
    <View ref={rowRef} style={[{ gap: 6 }, style]}>
      {label ? <Text style={{ fontSize: F.body, fontWeight: '700', color: T.ink }}>{label}</Text> : null}
      <View style={[s.input, { borderColor: T.line, backgroundColor: T.white }]}>
        {/* 몸통(Body) 안이면 눌렸을 때 이 줄이 키보드에 가리지 않게 몸통이 스크롤한다 */}
        <TextInput placeholderTextColor={T.dim} {...rest}
          onFocus={(e) => { body?.focus(rowRef.current); rest.onFocus?.(e); }}
          style={[s.inputText, { color: T.ink }, rest.multiline && s.multi, inputStyle]} />
        {right}
      </View>
    </View>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const T = useT();

  return (
    <Pressable onPress={() => onChange(!on)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: on }}
      style={[s.toggle, { backgroundColor: on ? T.deep : T.track, justifyContent: on ? 'flex-end' : 'flex-start' }]}>
      <View style={s.knob} />
    </Pressable>
  );
}

export function Radio({ on }: { on: boolean }) {
  const T = useT();

  return <View style={[s.radio, on ? { borderWidth: 6, borderColor: T.deep } : { borderColor: T.line }]} />;
}

/** 고르기 칩 줄 — 항목·행사·받을 사람 */
export function Choices<K extends string | number>({ items, value, onChange, extra }: {
  items: { id: K; label: string }[]; value: K | null; onChange: (k: K) => void; extra?: React.ReactNode;
}) {
  return (
    <View style={[s.row, s.wrap, { gap: 6 }]}>
      {items.map((it) => (
        <Chip key={String(it.id)} label={it.label} tone={it.id === value ? 'on' : 'plain'} onPress={() => onChange(it.id)} />
      ))}
      {extra}
    </View>
  );
}

/* ── 상태 ── */

export function Loading({ label = '불러오는 중이에요' }: { label?: string }) {
  const T = useT();

  return (
    <View style={s.center}>
      <Mascot mood="search" size={72} />
      <ActivityIndicator color={T.deep} />
      <Txt tone="sub" size="small">{label}</Txt>
    </View>
  );
}

export function Empty({ mood = 'calm', title, sub, children }: { mood?: Mood; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={[s.center, { paddingVertical: S.xl }]}>
      <Mascot mood={mood} size={84} />
      <Txt bold size="head">{title}</Txt>
      {sub ? <Txt tone="sub" size="small" style={{ textAlign: 'center' }}>{sub}</Txt> : null}
      {children}
    </View>
  );
}

export function Failed({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={[s.center, { paddingVertical: S.xl }]}>
      <Mascot mood="confused" size={80} />
      <Txt tone="sub" style={{ textAlign: 'center' }}>{text}</Txt>
      <Btn label="다시 불러오기" tone="ghost" small onPress={onRetry} style={{ paddingHorizontal: S.xl }} />
    </View>
  );
}

/*
 | 스크롤 몸통 안의 입력칸이 키보드에 가리지 않게 — `reveal.ts`(꿀꿀캐시)와 같은 계산을 **몸통 한 곳**에 둔다.
 | 화면마다 useReveal 을 달게 두면 또 한 곳이 빠진다(2026-09-22 태훈님 아이폰 모임 만들기 「입력칸 가려짐」 — 그 화면만
 | 키보드 여백도 없었다). 몸통이 ① 키보드만큼 바닥 여백을 두고 ② 칸(Field)이 눌리면 그 줄이 가린 만큼 지금 위치에서 더 내린다.
 | iOS 의 automaticallyAdjustKeyboardInsets 는 쓰지 않는다(탭바가 사라지는 프레임으로 재 모자란다 — hiddenBy.test).
 */
const BodyContext = React.createContext<{ focus: (row: View | null) => void } | null>(null);

/** 스크롤 몸통 — 시안 .pad(좌우 14 → 16, 사이 9 → 10) */
export function Body({ children, refresh, pad = true, bottom = 120 }: {
  children: React.ReactNode; refresh?: React.ReactElement; pad?: boolean; bottom?: number;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offset = useRef(0);
  const top = useRef(0);                       // 키보드 윗변(창 좌표) — 없으면 0
  const row = useRef<View | null>(null);       // 커서가 있는 칸의 줄
  const kb = useKeyboardPad();

  const reveal = useCallback(() => {
    const r = row.current;
    if (!r || top.current <= 0) return;
    r.measureInWindow((_x, y, _w, h) => {
      const to = revealY(offset.current, y + h, top.current);
      if (to !== null) scrollRef.current?.scrollTo({ y: to, animated: true });
    });
  }, []);

  useEffect(() => {
    // 여백이 먼저 붙어야 스크롤할 자리가 생긴다 — 한 박자 뒤에. 자동완성 줄이 붙으면 윗변이 또 올라간다(keyboardDidChangeFrame)
    const onShow = (e: { endCoordinates?: { screenY?: number } }) => { top.current = Number(e?.endCoordinates?.screenY) || 0; setTimeout(reveal, 80); };
    const a = Keyboard.addListener('keyboardDidShow', onShow);
    const c = Keyboard.addListener('keyboardDidChangeFrame', onShow);
    const b = Keyboard.addListener('keyboardDidHide', () => { top.current = 0; row.current = null; });

    return () => { a.remove(); b.remove(); c.remove(); };
  }, [reveal]);

  // 다른 칸에서 넘어와 키보드가 이미 떠 있으면 keyboardDidShow 가 다시 안 온다 — 눌린 자리에서 한 번 더 맞춘다
  const ctx = useMemo(() => ({ focus: (r: View | null) => { row.current = r; setTimeout(reveal, 80); } }), [reveal]);

  return (
    <BodyContext.Provider value={ctx}>
      <ScrollView ref={scrollRef} refreshControl={refresh as never} keyboardShouldPersistTaps="handled"
        onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
        contentContainerStyle={[pad && s.pad, { paddingBottom: Math.max(bottom, kb > 0 ? kb + 24 : 0) }]}>
        {children}
      </ScrollView>
    </BodyContext.Provider>
  );
}

/* ── 겹쳐 뜨는 것 ── */

export type AskButton = { label: string; tone?: 'main' | 'ghost' | 'danger'; onPress: () => void };

/** 확인창 — 「24명에게 발송됩니다 · 보낸 뒤에는 취소할 수 없어요」 */
export function Ask({ open, title, body, buttons, onClose, mood, children }: {
  open: boolean; title: string; body?: string; buttons: AskButton[]; onClose: () => void; mood?: Mood; children?: React.ReactNode;
}) {
  const T = useT();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose}>
        <Pressable style={[s.ask, { backgroundColor: T.white }]} onPress={() => undefined}>
          {mood ? <Mascot mood={mood} size={64} style={{ alignSelf: 'center' }} /> : null}
          <Txt bold size="head" style={{ textAlign: 'center' }}>{title}</Txt>
          {body ? <Txt tone="sub" size="small" style={{ textAlign: 'center', lineHeight: 21 }}>{body}</Txt> : null}
          {children}
          <View style={[s.row, { gap: S.sm, marginTop: S.xs }]}>
            {buttons.map((b) => <Btn key={b.label} label={b.label} tone={b.tone} onPress={b.onPress} style={s.grow} />)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 잠깐 뜨는 한 줄 — 화면 아래 */
export function Toast({ text }: { text: string | null }) {
  const T = useT();
  if (!text) return null;

  return (
    <View pointerEvents="none" style={s.toastWrap}>
      <View style={[s.toast, { backgroundColor: T.ink }, shadow]}><Text style={s.toastText}>{text}</Text></View>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: F.title, fontWeight: '800', letterSpacing: -0.4 },
  num: { fontWeight: '900', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  amt: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.82 },
  center: { alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg },

  head: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg },
  headIcon: { fontSize: 30, lineHeight: 32, marginTop: -2, paddingRight: 2 },
  close: { fontSize: 20, paddingLeft: S.sm },
  pad: { paddingHorizontal: S.lg, gap: 10 },

  card: { borderWidth: 1, borderRadius: R.card, padding: S.lg },
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: S.lg, borderBottomWidth: 1 },
  tab: { paddingTop: 12, paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },

  chip: { borderWidth: 1, borderRadius: R.chip, paddingHorizontal: 11, paddingVertical: 6, alignSelf: 'flex-start' },
  pill: { borderRadius: R.chip, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },

  btn: { height: 52, borderRadius: R.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg },
  btnSmall: { height: 44 },

  soft: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: R.card, paddingVertical: 14, paddingHorizontal: S.lg },
  listrow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  pipe: { width: 3.5, height: 36, borderRadius: 999 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },

  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: R.field, minHeight: 50, paddingLeft: 14, paddingRight: 12 },
  // minWidth 0 — 웹의 <input> 은 자기 최소 폭이 있어 줄이지 않으면 오른쪽 「원」을 칸 밖으로 민다
  inputText: { flex: 1, minWidth: 0, fontSize: F.head, fontWeight: '700', paddingVertical: 10 },
  multi: { minHeight: 96, fontSize: F.body, fontWeight: '400', textAlignVertical: 'top', lineHeight: 22 },

  toggle: { width: 48, height: 28, borderRadius: 999, padding: 3, flexDirection: 'row' },
  knob: { width: 22, height: 22, borderRadius: 999, backgroundColor: '#FFFFFF' },
  radio: { width: 21, height: 21, borderRadius: 999, borderWidth: 2 },

  dim: { flex: 1, backgroundColor: 'rgba(10,18,15,0.45)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  ask: { width: '100%', maxWidth: 380, borderRadius: 22, padding: S.xl, gap: S.md },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center', paddingHorizontal: S.xl },
  toast: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  toastText: { color: '#FFFFFF', fontSize: F.small, fontWeight: '700' },
});
