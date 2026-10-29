import { describe, expect, it } from 'vitest';
import { customValues } from './customValues';

describe('customValues — 응답 모양이 달라도 values 를 꺼낸다(틱톡 켜기)', () => {
  it('value · config · 바로 values', () => {
    expect(customValues({ value: { values: { a: '1' } } })).toEqual({ a: '1' });
    expect(customValues({ config: { values: { a: '1' } } })).toEqual({ a: '1' });
    expect(customValues({ values: { a: '1' } })).toEqual({ a: '1' });
  });

  it('없으면 null', () => {
    expect(customValues(null)).toBeNull();
    expect(customValues({ value: { values: [] } })).toBeNull();
    expect(customValues('x')).toBeNull();
  });
});
