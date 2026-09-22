/**
 * 하단 탭 · 촬영 버튼 아이콘 — 시안(`design/chongmunim-app.html` .nav) 의 SVG 경로 그대로.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type P = { color: string; size?: number };

export const HomeIcon = ({ color, size = 23 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Path d="M4 10.5 12 4l8 6.5V20H4z" />
  </Svg>
);

export const LedgerIcon = ({ color, size = 23 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M5 4h14v16H5z" />
    <Path d="M9 9h6M9 13h6M9 17h3" />
  </Svg>
);

export const ClubIcon = ({ color, size = 23 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={9} cy={8} r={3} />
    <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <Path d="M16 7.5a3 3 0 010 5.4" />
    <Path d="M17.5 19c0-2-.8-3.6-2-4.6" />
  </Svg>
);

export const GearIcon = ({ color, size = 23 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={3} />
    <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Svg>
);

export const CameraIcon = ({ color, size = 25 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Path d="M3 8h4l1.5-2h7L17 8h4v11H3z" />
    <Circle cx={12} cy={13} r={3.4} />
  </Svg>
);
