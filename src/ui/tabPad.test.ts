/**
 * 하단 탭 글자가 안드로이드 내비게이션 바에 가리던 것(2026-09-19 오너 제보).
 */
import { describe, expect, it } from 'vitest';
import { tabBottomPad } from './tabPad';

describe('탭 줄 바닥 여백', () => {
  it('안드로이드는 인셋을 깎지 않는다 — 내비바가 그 자리를 덮는다', () => {
    expect(tabBottomPad('android', 48, 8)).toBe(48);   // 3버튼
    expect(tabBottomPad('android', 24, 8)).toBe(24);   // 제스처 줄
  });

  it('iOS 는 홈 인디케이터에 12 만큼 걸친다', () => {
    expect(tabBottomPad('ios', 34, 8)).toBe(22);
  });

  it('인셋이 없거나 이상하면 최소 여백', () => {
    expect(tabBottomPad('android', 0, 8)).toBe(8);
    expect(tabBottomPad('ios', 0, 8)).toBe(8);
    expect(tabBottomPad('android', NaN, 8)).toBe(8);
  });
});
