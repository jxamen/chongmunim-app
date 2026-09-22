/**
 * 스크롤 안 입력칸 — 가려진 만큼 **지금 위치에 더해** 내린다.
 *
 * 숫자는 꿀꿀캐시 오너 제보(2026-09-19, px): 줄 아랫변 2126 · 키보드 윗변 1409.
 */
import { describe, expect, it } from 'vitest';
import { REVEAL_GAP, hiddenBy, revealY } from './hiddenBy';

describe('얼마나 가려졌나', () => {
  it('줄이 키보드 아래면 그 차이 + 틈', () => {
    expect(hiddenBy(2126, 1409)).toBe(2126 - 1409 + REVEAL_GAP);
  });

  it('이미 보이면 0', () => {
    expect(hiddenBy(1000, 1409)).toBe(0);
  });

  it('못 쟀거나 키보드가 없으면 0 — 움직이지 않는다', () => {
    expect(hiddenBy(0, 1409)).toBe(0);
    expect(hiddenBy(2126, 0)).toBe(0);
    expect(hiddenBy(NaN, 1409)).toBe(0);
  });
});

describe('어디까지 스크롤하나', () => {
  /*
   | 친구 초대 카드는 첫 화면 밖이라 **내려온 뒤에** 누른다. 가려진 거리(729)만 `scrollTo` 에 넘기면
   | 600 까지 내려와 있던 화면이 729 로 — 거의 제자리거나, 더 내려와 있었으면 **위로** 튄다.
   */
  it('지금 위치에 더한다 — 가려진 거리만 넘기면 위로 튄다', () => {
    const need = hiddenBy(2126, 1409);

    expect(revealY(600, 2126, 1409)).toBe(600 + need);
    expect(revealY(1200, 2126, 1409)).toBeGreaterThan(1200);
  });

  it('맨 위에 있으면 가려진 거리 그대로', () => {
    expect(revealY(0, 2126, 1409)).toBe(hiddenBy(2126, 1409));
  });

  it('보이면 null — 스크롤하지 않는다', () => {
    expect(revealY(600, 1000, 1409)).toBeNull();
  });
});

/*
 | iOS 를 `automaticallyAdjustKeyboardInsets` 에 맡기면 **탭바 높이만큼** 모자랐다 — 탭바가 사라지는 프레임으로
 | 잰다(꿀꿀캐시 2026-09-19 정정). 두 길을 같이 켜면 두 배로 민다. 자동완성 줄이 붙으면 윗변이 또 올라간다.
 */
describe('입력이 있는 화면 — iOS 도 직접 잰다', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const code = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!:)\/\/.*/g, '');

  it('자동 인셋 prop 을 켜지 않는다 — 총무님 화면 전부', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    for (const f of readdirSync(join(__dirname, '..', 'screens')).filter((n: string) => n.endsWith('.tsx'))) {
      expect(code('..', 'screens', f), f).not.toContain('automaticallyAdjustKeyboardInsets');
    }
  });

  it('자동완성 줄이 붙을 때(keyboardDidChangeFrame)도 다시 맞춘다', () => {
    expect(code('reveal.ts')).toContain("'keyboardDidChangeFrame'");
  });
});
