/**
 * 지급 여부 칸 — 지출에만(2026-10-04 대표님 「영수증을 직접 등록 하더라도 지급을 한 건지 아니면 직접 지출을 한 건지 이런 것들을
 * 기록을 할 수 있어야 돼 지급을 한 거면 누구에게 한 건지」). 선택이라 안 골라도 된다(= 모름, 장부에 아무것도 안 붙는다).
 *
 *  직접 지출  모임 돈(카드 · 통장)으로 가게에 바로 냈다
 *  지급       모임 돈을 사람에게 내줬다(대신 낸 회원에게 돌려준 것 등) — 받은 사람을 명단에서 고르거나 이름을 적는다
 *
 * 고른 것을 한 번 더 누르면 비운다(모름). 지급을 고를 때 받은 사람이 비어 있고 쓴 사람이 있으면 그 사람을 먼저 넣어 둔다 —
 * 회원이 대신 내고 영수증을 준 것을 돌려주는 일이 가장 흔해서(고칠 수 있다).
 */
import React from 'react';
import { View } from 'react-native';
import type { PayKind, SpentBy } from '../cm/model';
import { Choices, Txt } from './kit';
import { PersonField } from './SpentByField';

export type PayValue = { payKind: PayKind; payee: SpentBy };

export function PayKindField({ value, onChange, suggest = null }: { value: PayValue; onChange: (v: PayValue) => void; suggest?: SpentBy }) {
  const pick = (k: 'direct' | 'payout') => {
    if (k === value.payKind) return onChange({ payKind: null, payee: null });
    onChange(k === 'payout' ? { payKind: 'payout', payee: value.payee ?? suggest } : { payKind: 'direct', payee: null });
  };

  return (
    <View style={{ gap: 6 }}>
      <Txt bold>지급 여부</Txt>
      <Choices items={[{ id: 'direct' as const, label: '직접 지출' }, { id: 'payout' as const, label: '지급' }]} value={value.payKind} onChange={pick} />
      <Txt size="tiny" tone="dim">
        {value.payKind === 'payout' ? '모임 돈을 사람에게 내줬어요 · 누구에게 줬는지 골라 주세요'
          : value.payKind === 'direct' ? '모임 돈으로 가게에 바로 냈어요'
            : '선택 · 직접 냈는지, 누구에게 지급했는지 남겨요'}
      </Txt>
      {value.payKind === 'payout' ? (
        <PersonField title="받은 사람" line={(p) => p.name} empty="누구에게 지급했나요" value={value.payee}
          onChange={(p) => onChange({ payKind: 'payout', payee: p })} />
      ) : null}
    </View>
  );
}
