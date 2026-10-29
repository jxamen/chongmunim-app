/**
 * `content/config/custom`(어드민 「앱 설정」) 응답에서 평평한 값 맵(`values`)을 꺼낸다 — 응답 모양이
 * `{ value: { values } }` · `{ config: { values } }` · `{ values }` 로 조금씩 다르다. 없으면 null.
 * 틱톡 켜기(`store.tsx` 의 `tiktok.boot`)가 쓴다 — RN 에 기대지 않아 노드 시험이 직접 읽는다.
 */
export function customValues(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  for (const c of [o.value, o.config, o]) {
    const v = c && typeof c === 'object' ? (c as Record<string, unknown>).values : undefined;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }

  return null;
}
