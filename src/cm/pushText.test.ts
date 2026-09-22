import { describe, expect, it } from 'vitest';
import { pushLine, toPush } from './pushText';

describe('보낸 뒤 한 줄', () => {
  it('받는 사람이 알림을 안 켰으면 그렇게 말한다(태훈님 「마감을 했는데도 알림이 안 와」)', () => {
    expect(pushLine(toPush({ recipients: 1, accepted: 0, noToken: 1, noApp: 0, muted: 0 }))).toBe('알림 0명에게 감 · 1명은 알림을 아직 안 켰어요');
  });
  it('모두 갔으면 한 줄 · 받을 사람이 없으면(혼자) 그렇게', () => {
    expect(pushLine(toPush({ recipients: 3, sent: 3 }))).toBe('3명에게 알림이 갔어요');
    expect(pushLine(toPush({ recipients: 0 }))).toBe('받을 사람이 없어요 · 보낸 나는 빼고 세요');
    expect(pushLine(toPush({ recipients: 5, sent: 2, noToken: 1, noApp: 1, muted: 1 }))).toBe('알림 2명에게 감 · 1명은 알림을 아직 안 켰어요 · 1명은 앱이 없어요 · 1명은 알림을 꺼 뒀어요');
    expect(pushLine(null)).toBe('');
  });
});
