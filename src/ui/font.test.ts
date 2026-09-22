import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRETENDARD, withPretendard } from './font';

describe('모든 글자는 Pretendard — fontWeight 를 그 무게의 글꼴로', () => {
  it('무게마다 글꼴 파일이 따로다 — fontWeight 는 지운다(안드로이드 가짜 굵기 방지)', () => {
    expect(withPretendard({ fontSize: 15, fontWeight: '800' })).toEqual({ fontSize: 15, fontFamily: 'Pretendard-ExtraBold' });
    expect(withPretendard({ fontWeight: '900' }).fontFamily).toBe('Pretendard-Black');
    expect(withPretendard({ fontWeight: 600 }).fontFamily).toBe('Pretendard-SemiBold');
    expect(withPretendard({ fontWeight: 'bold' }).fontFamily).toBe('Pretendard-Bold');
  });

  it('무게가 없거나 normal·얇은 무게면 Regular', () => {
    expect(withPretendard(undefined)).toEqual({ fontFamily: 'Pretendard-Regular' });
    expect(withPretendard({ fontWeight: 'normal' }).fontFamily).toBe('Pretendard-Regular');
    expect(withPretendard({ fontWeight: '300' }).fontFamily).toBe('Pretendard-Regular');
  });

  it('글꼴을 따로 정한 스타일은 그대로 둔다', () => {
    const own = { fontFamily: 'Menlo', fontWeight: '700' as const };
    expect(withPretendard(own)).toBe(own);
  });

  it('쓰는 무게는 모두 글꼴 파일이 있다(400~900)', () => {
    expect(Object.keys(PRETENDARD)).toEqual(['400', '500', '600', '700', '800', '900']);
    for (const name of Object.values(PRETENDARD)) {
      expect(existsSync(resolve(__dirname, '../../assets/fonts', `${name}.otf`)), name).toBe(true);
    }
  });
});
