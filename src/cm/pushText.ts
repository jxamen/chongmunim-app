/**
 * 보낸 뒤 한 줄 — 알림이 몇 명에게 갔고, 왜 못 간 사람이 있는지(2026-09-22 태훈님 「마감을 했는데도 알림이 안 와」).
 * 보낸 사람 자신은 원래 빠진다 — 혼자 시험하면 「받을 사람이 없어요」가 뜬다.
 */
export type PushSummary = { recipients: number; sent: number; noToken: number; noApp: number; muted: number };

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export function toPush(v: unknown): PushSummary | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;

  return { recipients: n(o.recipients), sent: n(o.sent ?? o.accepted), noToken: n(o.noToken), noApp: n(o.noApp), muted: n(o.muted) };
}

export function pushLine(p: PushSummary | null): string {
  if (!p) return '';
  if (p.recipients === 0) return '받을 사람이 없어요 · 보낸 나는 빼고 세요';
  const miss = [p.noToken ? `${p.noToken}명은 알림을 아직 안 켰어요` : null, p.noApp ? `${p.noApp}명은 앱이 없어요` : null,
    p.muted ? `${p.muted}명은 알림을 꺼 뒀어요` : null].filter(Boolean);
  if (!miss.length) return `${p.sent}명에게 알림이 갔어요`;

  return `알림 ${p.sent}명에게 감 · ${miss.join(' · ')}`;
}
