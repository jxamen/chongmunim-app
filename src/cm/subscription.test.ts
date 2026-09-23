/**
 * 구독을 안 파는 동안(첫 판, 2026-09-24 대표님 「구독 빼고 무료 먼저」) — 결제로 가는 길이 화면에 없어야 한다.
 * 스토어에 구독 상품이 없는데 결제를 누르면 심사에서 실패로 보인다(2.1 · 2.3). 켜고 끄는 것은 `app.json` `extra.subscriptionOn`.
 * 주석은 떼고 검사한다(H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (p: string) => strip(fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8'));

describe('구독 판매 스위치', () => {
  it('첫 판은 끈다 — app.json extra.subscriptionOn: false', () => {
    const extra = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../app.json'), 'utf8')).expo.extra;
    expect(extra.subscriptionOn).toBe(false);
  });

  it('참일 때만 켜진다 — 값이 없거나 글자면 꺼짐', () => {
    expect(read('src/config.ts')).toMatch(/SUBSCRIPTION_ON: boolean = [^;]*\?\.subscriptionOn === true;/);
  });

  it('꺼져 있으면 설정의 구독 카드 · 「구독 관리」 줄이 없다', () => {
    expect(read('src/screens/Plan.tsx')).toMatch(/if \(!group \|\| !SUBSCRIPTION_ON\) return null;/);
    expect(read('src/screens/SettingsScreen.tsx')).toMatch(/\{SUBSCRIPTION_ON \? \(<><Sep \/><MenuRow label="구독 관리"/);
  });

  it('꺼져 있으면 설정 머리에 「구독 중 · 무료」를 붙이지 않는다 — 무료 개방(free_open)이면 모든 모임이 pro 로 와서 「구독 중」이 보였다', () => {
    expect(read('src/screens/SettingsScreen.tsx')).toMatch(/\$\{SUBSCRIPTION_ON \? \(isPro\(group\) \? ' · 구독 중' : ' · 무료'\) : ''\}/);
  });

  it('꺼져 있으면 구독 안내 창에 결제로 가는 단추가 없다 — 「확인」 하나', () => {
    const plan = read('src/screens/Plan.tsx');
    const off = plan.slice(plan.indexOf('if (!SUBSCRIPTION_ON) {'), plan.indexOf('return (', plan.indexOf('if (!SUBSCRIPTION_ON) {') + 30));
    expect(off).toContain("buttons={[{ label: '확인', onPress: closePlan }]}");
    expect(off).not.toMatch(/구독하기|open\(\{ kind: 'plan' \}\)|PLAN_PRICE/);
  });

  it('구독 관리 화면으로 가는 곳은 켜졌을 때만 보이는 자리뿐이다', () => {
    const openers = ['src/screens/Plan.tsx', 'src/screens/SettingsScreen.tsx', 'src/screens/ClubScreen.tsx', 'src/screens/LedgerScreen.tsx',
      'src/screens/HomeScreen.tsx', 'src/screens/Closing.tsx', 'src/screens/ManageScreens.tsx']
      .flatMap((p) => read(p).split('\n').filter((l) => /open\(\{ kind: 'plan' \}\)/.test(l)).map((l) => `${p}: ${l.trim()}`));
    // PlanCard 두 곳(카드 전체가 스위치 뒤) · 안내 창의 켜진 쪽 · 설정 줄(스위치 안)
    expect(openers).toHaveLength(4);
    expect(openers.filter((l) => l.startsWith('src/screens/SettingsScreen.tsx'))[0]).toContain('SUBSCRIPTION_ON ?');
  });
});
