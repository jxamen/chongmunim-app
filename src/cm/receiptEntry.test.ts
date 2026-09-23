/**
 * 영수증 입구 통일(2026-09-24 대표님 「모든 영수증은 입구를 1개로」) — 「영수증 분석」 입구 `POST receipts` 로 올린다.
 * 응답 읽기 · 오류 문장 · 재시도 키는 순수 함수로, 줄(`receiptQueue.ts`)이 그것을 어떻게 쓰는지는 소스로 본다(주석은 떼고, H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { newIdempotencyKey, parseSubmitted, receiptErrorText, rejectedNote, throttleWaitMs } from './receiptEntry';

describe('입구 응답', () => {
  it('받아 준 장 — 번호는 글자로', () => {
    expect(parseSubmitted({ receipt: { id: 42, status: 'pending', reason: null } })).toEqual({ id: '42', status: 'pending', reason: null });
  });

  it('품질 반려는 200 이지만 rejected + 사유 — 장부로 넘기지 않고 사유를 그대로 보인다', () => {
    const r = parseSubmitted({ receipt: { id: 'r7', status: 'rejected', reason: '글자가 흐려요. 다시 찍어 주세요' } });
    expect(r).toEqual({ id: 'r7', status: 'rejected', reason: '글자가 흐려요. 다시 찍어 주세요' });
    expect(rejectedNote(r!.reason)).toBe('글자가 흐려요. 다시 찍어 주세요');
    expect(rejectedNote(null)).toBe('영수증을 읽기 어려워요. 다시 찍어 주세요');
  });

  it('모양이 어긋나면 null — 올리기 실패로 본다', () => {
    expect(parseSubmitted(null)).toBeNull();
    expect(parseSubmitted({})).toBeNull();
    expect(parseSubmitted({ receipt: { status: 'pending' } })).toBeNull();
    expect(parseSubmitted({ receipt: { id: 1, status: 'done' } })).toBeNull();
  });
});

describe('입구 오류 문장', () => {
  it('이미 올림 · 오늘 한도 · 판독 꺼짐', () => {
    expect(receiptErrorText('duplicate_receipt')).toBe('이미 올린 영수증이에요');
    expect(receiptErrorText('receipt_daily_max')).toContain('내일');
    expect(receiptErrorText('ocr_disabled')).toContain('직접 적어');
  });

  it('같은 사진 반복은 retryAfter(초)를 분으로 — 올림', () => {
    expect(receiptErrorText('receipt_too_many', { message: 'receipt_too_many', retryAfter: 90 })).toBe('같은 사진을 여러 번 올렸어요. 2분 뒤 다시 해 주세요');
    expect(receiptErrorText('receipt_too_many', null)).toBe('같은 사진을 여러 번 올렸어요. 1분 뒤 다시 해 주세요');
  });

  it('나머지는 공통 문장', () => {
    expect(receiptErrorText('network')).toBe('인터넷 연결을 확인해 주세요');
  });
});

describe('일반 스로틀에서 쉴 시간', () => {
  it('Retry-After(초)만큼, 없으면 60초, 2분을 넘기지 않는다', () => {
    expect(throttleWaitMs({ message: 'Too Many Attempts.', retryAfterHeader: 30 })).toBe(30_000);
    expect(throttleWaitMs(null)).toBe(60_000);
    expect(throttleWaitMs({ retryAfterHeader: 900 })).toBe(120_000);
  });
});

describe('재시도 키', () => {
  it('uuid v4 모양이고 매번 다르다', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});

describe('줄(receiptQueue)이 입구를 쓰는 모양', () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const q = strip(fs.readFileSync(path.resolve(__dirname, '../receiptQueue.ts'), 'utf8'));

  it('공용 판독(ocr.submit)이 아니라 입구(submitReceipt)에 재시도 키와 함께 올린다', () => {
    expect(q).not.toMatch(/ocr\.submit/);
    expect(q).toMatch(/got = await submitReceipt\(l\.uri, idem\);/);
    expect(q).toMatch(/idem: newIdempotencyKey\(\)/);
  });

  it('품질 반려면 장부에 맡기지 않고 사유를 보인다', () => {
    expect(q).toMatch(/if \(got\.status === 'rejected'\) \{\s*set\(l\.key, \{ state: 'failed', note: rejectedNote\(got\.reason\) \}\);\s*return true;/);
  });

  it('맡길 때는 receiptId — 앞선 판이 남긴 작업 번호만 예전 길로', () => {
    expect(q).toMatch(/receiptId \? await cm\.registerReceipt\(l\.gid, receiptId\) : await cm\.registerReceiptJob\(l\.gid, l\.jobId!\)/);
  });

  it('다시 해도 같은 오류(이미 올림 · 한도 · 반복)는 되풀이하지 않는다 — 끊김 · 5xx 는 세 번, 일반 스로틀(429)은 쉬었다 한 번', () => {
    expect(q).toMatch(/\/\^\(network\|timeout\|http_5\\d\\d\)\$\//);
    expect(q).toMatch(/if \(code === 'http_429' && !throttled\) \{\s*throttled = true;\s*await new Promise\(\(r\) => setTimeout\(r, throttleWaitMs\(/);
  });
});
