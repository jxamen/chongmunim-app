/**
 * 조사 고르기 — 이름을 **어드민이 정하므로**(캡슐 종류 · 시간대 캡슐 · 뽑기 상품) 받침을 보고 붙인다.
 * 「지폐이 나왔어요」 · 「동전로 올리면」 같은 글자가 화면에 나가지 않게(당근 11 §4-6: 용어가 바뀌면 조사도 바뀐다).
 * 한글이 아니면(숫자 · 영문) 받침이 없는 것으로 본다.
 */
function batchim(word: string): number {
  const c = word.trim().charCodeAt(word.trim().length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return 0;

  return (c - 0xac00) % 28;
}

/** 이/가 · 을/를 · 은/는 · 과/와 */
export function josa(word: string, withB: string, withoutB: string): string {
  return word + (batchim(word) ? withB : withoutB);
}

/** 으로/로 — ㄹ 받침(8)은 「로」 */
export function ro(word: string): string {
  const b = batchim(word);

  return word + (b && b !== 8 ? '으로' : '로');
}
