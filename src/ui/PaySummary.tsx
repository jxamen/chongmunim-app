/**
 * 정산의 「지급 · 받은 사람별」(2026-10-04 대표님 「지급을 한 거면 누구에게 한 건지」) — 행사 화면 · 월별 장부 · 결산 한 장 아래.
 * 지출 줄의 지급 여부를 모아 받은 사람마다 몇 건 · 얼마, 그리고 직접 지출 · 모름 합계. 지급 여부를 하나도 안 적었으면 안 그린다
 * (옛 기록뿐인 달 · 옛 결산은 그대로 보인다).
 */
import React from 'react';
import { payTotals, won } from '../cm/format';
import type { Entry } from '../cm/model';
import { Card, KV, Sep, Txt } from './kit';

export function PaySummary({ entries }: { entries: Pick<Entry, 'direction' | 'amount' | 'payKind' | 'payee'>[] }) {
  const t = payTotals(entries);
  if (!t.payout && !t.direct) return null;

  return (
    <Card style={{ gap: 4 }}>
      <Txt size="small" tone="sub" bold>지급 여부</Txt>
      {t.people.map((p, n) => <KV key={n} label={`지급 · ${p.name ?? '받은 사람 안 적음'} ${p.count}건`} value={won(p.sum)} />)}
      {t.people.length ? <Sep /> : null}
      {t.payout ? <KV label="지급 합계" value={won(t.payout)} strong /> : null}
      {t.direct ? <KV label="직접 지출" value={won(t.direct)} /> : null}
      {t.unknown ? <KV label="지급 여부 안 적음" value={won(t.unknown)} /> : null}
    </Card>
  );
}
