/**
 * 색과 간격 — 화면 코드가 색 문자열을 직접 쓰지 않게 한곳에 둔다(용돈캡슐 `theme.ts` 와 같은 자리).
 *
 * 총무님은 **테마 셋**(민트 · 코랄 · 스카이)을 설정에서 고른다 — 시안 `design/chongmunim-app.html` 의 CSS 변수를
 * 그대로 옮겼다. 모든 화면이 같이 바뀌어야 해서 색은 `useT()` 로 받는다(정적 상수로 두면 테마를 바꿔도 안 바뀐다).
 * 간격 `S` 는 4의 배수, 글자 `F` 는 시안(340px 폭)을 실기기 폭(390px 안팎)에 맞춰 1.15배로 올린 값이다 —
 * 작은 글씨가 정보를 담는 자리가 많아 가장 작은 것도 13.5 아래로 내리지 않는다(용돈캡슐 규칙).
 */
import { createContext, useContext } from 'react';

export type ThemeName = 'mint' | 'coral' | 'sky';

export type Palette = {
  name: ThemeName;
  bg: string; edge: string; line: string; ink: string; sub: string; dim: string;
  point: string; deep: string; pos: string; track: string; tint: string; tintLine: string;
  warn: string; warnTint: string; warnLine: string; warnInk: string;
  white: string; danger: string;
};

const common = { warnTint: '#FDF3E2', warnLine: '#F2E2C2', warnInk: '#8A5A0B', white: '#FFFFFF', danger: '#D6453D' };

export const PALETTES: Record<ThemeName, Palette> = {
  mint: {
    name: 'mint', bg: '#F4FAF8', edge: '#DFEDE8', line: '#E6F0EC', ink: '#16251F', sub: '#5E7169', dim: '#9AA8A2',
    point: '#2FB28F', deep: '#148066', pos: '#148066', track: '#E7F1EE', tint: '#E9F6F1', tintLine: '#CFE9E0', warn: '#D9892B', ...common,
  },
  coral: {
    name: 'coral', bg: '#FFF8F6', edge: '#F3E3DE', line: '#F6E9E5', ink: '#2A1A15', sub: '#766159', dim: '#B09C94',
    point: '#F27260', deep: '#C2503C', pos: '#189277', track: '#F8E9E5', tint: '#FDEEEA', tintLine: '#F8D8D0', warn: '#C98A26', ...common,
  },
  sky: {
    name: 'sky', bg: '#F4F9FE', edge: '#DFE9F5', line: '#E5EEF7', ink: '#14243A', sub: '#5E6E82', dim: '#9AA8BA',
    point: '#43A1E4', deep: '#2A76AE', pos: '#189277', track: '#E7EFF8', tint: '#EAF3FC', tintLine: '#D3E4F6', warn: '#C98A26', ...common,
  },
};

export const THEME_LABEL: Record<ThemeName, string> = { mint: '민트', coral: '코랄', sky: '스카이' };
export const THEMES: ThemeName[] = ['mint', 'coral', 'sky'];
export const isTheme = (v: unknown): v is ThemeName => v === 'mint' || v === 'coral' || v === 'sky';

/** 모서리 — 시안의 카드 18 · 버튼 14 · 입력 13 */
export const R = { card: 18, button: 14, field: 13, chip: 999 } as const;

/** 간격 — 4의 배수만 쓴다 */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** 글자 크기 */
export const F = { hero: 32, big: 26, title: 20, head: 17, body: 15.5, small: 14, tiny: 13.5 } as const;

/** 제목 글꼴 — 시안의 Jua(`@expo-google-fonts/jua`). 읽기 전에는 시스템 글꼴로 그린다 */
export const TITLE_FONT = 'Jua_400Regular';

/** 그림자 — 떠 있는 것(촬영 버튼·띠)에만. 카드는 테두리로 가른다(시안) */
export const shadow = {
  shadowColor: '#0E1A15',
  shadowOpacity: 0.16,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 5,
} as const;

const ThemeContext = createContext<Palette>(PALETTES.mint);
export const ThemeProvider = ThemeContext.Provider;
export const useT = (): Palette => useContext(ThemeContext);

/** 소셜 로그인 버튼 — 각 사가 정한 색(테마와 무관하게 고정) */
export const BRAND = {
  kakao: { bg: '#FEE500', fg: '#191919', border: '#FEE500', label: '카카오로 시작하기' },
  google: { bg: '#FFFFFF', fg: '#1F1F1F', border: '#DADCE0', label: 'Google 로 시작하기' },
  apple: { bg: '#000000', fg: '#FFFFFF', border: '#000000', label: 'Apple 로 시작하기' },
} as const;
