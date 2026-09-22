import { defineConfig } from 'vitest/config';

/**
 * 규칙(순수 함수)만 노드에서 돌린다 — RN 컴포넌트는 실기기에서 확인한다.
 * 고정하는 것은 「이월·잔액이 맞는가 · 서버 응답이 어긋나도 화면이 멈추지 않는가 · 금액·날짜 표기」다.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
