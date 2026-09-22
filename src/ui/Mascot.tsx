/**
 * 영수증이 — 총무님 캐릭터(`design/receipt_mascot_30_transparent`, 여백을 잘라 `assets/mascot/` 에 둔 30표정).
 *
 * 표정은 **역할 이름**으로 부른다(`happy`·`coin`·`calculator` …) — 화면이 파일 이름을 몰라도 되게.
 * 그림마다 가로세로 비율이 달라서(잘라 낸 뒤) 높이만 주면 폭은 비율대로 정한다.
 */
import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const ART = {
  happy: [require('../../assets/mascot/receipt_01_happy.png'), 349 / 300],
  phone: [require('../../assets/mascot/receipt_02_phone.png'), 322 / 296],
  cheer: [require('../../assets/mascot/receipt_03_cheer.png'), 372 / 311],
  heart: [require('../../assets/mascot/receipt_04_heart.png'), 311 / 278],
  receipt: [require('../../assets/mascot/receipt_05_receipt.png'), 325 / 287],
  confused: [require('../../assets/mascot/receipt_06_confused.png'), 336 / 295],
  thinking: [require('../../assets/mascot/receipt_07_thinking.png'), 334 / 309],
  smug: [require('../../assets/mascot/receipt_08_smug.png'), 273 / 287],
  idea: [require('../../assets/mascot/receipt_09_idea.png'), 307 / 345],
  calm: [require('../../assets/mascot/receipt_10_calm.png'), 413 / 291],
  excited: [require('../../assets/mascot/receipt_11_excited.png'), 356 / 282],
  tear: [require('../../assets/mascot/receipt_12_tear.png'), 304 / 287],
  exhausted: [require('../../assets/mascot/receipt_13_exhausted.png'), 336 / 178],
  sleeping: [require('../../assets/mascot/receipt_14_sleeping.png'), 403 / 259],
  food: [require('../../assets/mascot/receipt_15_food.png'), 329 / 282],
  coin: [require('../../assets/mascot/receipt_16_won_coin.png'), 349 / 280],
  stack: [require('../../assets/mascot/receipt_17_receipt_stack.png'), 316 / 264],
  angry: [require('../../assets/mascot/receipt_18_angry.png'), 287 / 277],
  cool: [require('../../assets/mascot/receipt_19_cool.png'), 372 / 304],
  search: [require('../../assets/mascot/receipt_20_search.png'), 363 / 284],
  calculator: [require('../../assets/mascot/receipt_21_calculator.png'), 331 / 305],
  celebrate: [require('../../assets/mascot/receipt_22_celebrate.png'), 413 / 320],
  peek: [require('../../assets/mascot/receipt_23_peek.png'), 212 / 314],
  coffee: [require('../../assets/mascot/receipt_24_coffee.png'), 327 / 287],
  rushing: [require('../../assets/mascot/receipt_25_rushing.png'), 286 / 286],
  crying: [require('../../assets/mascot/receipt_26_crying.png'), 325 / 282],
  fighting: [require('../../assets/mascot/receipt_27_fighting.png'), 358 / 323],
  driving: [require('../../assets/mascot/receipt_28_driving.png'), 434 / 266],
  shopping: [require('../../assets/mascot/receipt_29_shopping.png'), 403 / 282],
  back: [require('../../assets/mascot/receipt_30_back.png'), 253 / 257],
} as const;

export type Mood = keyof typeof ART;

export function Mascot({ mood, size, style }: { mood: Mood; size: number; style?: StyleProp<ImageStyle> }) {
  const [src, ratio] = ART[mood];

  return <Image source={src} style={[{ height: size, width: Math.round(size * ratio) }, style]} resizeMode="contain" />;
}
