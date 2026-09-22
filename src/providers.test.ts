import { describe, expect, it } from 'vitest';
import { normalizeProviders } from './providers';

describe('서버 로그인 목록 → 패키지가 읽는 이름', () => {
  it('카카오톡 앱 로그인만 켜진 서버(총무님 운영 값)도 카카오 버튼이 서버까지 간다', () => {
    expect(normalizeProviders(['google', 'apple', 'kakao_native'])).toEqual(['google', 'apple', 'kakao_native', 'kakao']);
  });

  it('웹 카카오가 이미 있거나 카카오가 아예 없으면 그대로', () => {
    const both = ['kakao', 'kakao_native'];
    expect(normalizeProviders(both)).toBe(both);
    expect(normalizeProviders(['google'])).toEqual(['google']);
    expect(normalizeProviders([])).toEqual([]);   // 비어 있으면 패키지가 막지 않는다(아직 모름)
  });
});
