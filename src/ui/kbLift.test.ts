/**
 * 키보드가 [정답 확인] 을 가리던 것을 **숫자로** 못 박는다.
 *
 * 2026-09-16·17 에 두 번 고쳤는데도 실기기에서 계속 가렸다. 세 앱(당근캐시·꿀꿀캐시·
 * 꼬꼬농장)이 같은 코드를 쓰고 있어 같은 증상이 세 곳에서 났다.
 *
 * 원인은 **Expo 57 / RN 0.86 의 edge-to-edge** 다. 창이 내비게이션 바 아래까지 가는데
 * `endCoordinates.height` 는 내비바를 뺀 값이라, 높이만큼 띄우면 **늘 내비바만큼 모자란다.**
 * 눈으로는 「입력칸은 보이는데 버튼만 숨는다」로 나타나서, 덜 올라간 것인지 아예 안
 * 올라간 것인지 구분이 안 됐다 — 그래서 실기기에서 잰 값을 그대로 넣어 둔다.
 */
import { describe, expect, it } from 'vitest';
import { kbLift } from './kbLift';

/* 갤럭시 A32 / 안드로이드 13 · 삼성 키보드 (앱빌드 세션 측정, 단위 dp) */
const A32 = { windowH: 914.3, screenY: 536.8, height: 329.5 };
const NAV = 48;   // 914.3 - (536.8 + 329.5)

describe('실기기에서 잰 값', () => {
  /*
   | 탭바는 키보드가 뜨면 언마운트되므로(App.tsx) 바닥 줄의 아랫변이 곧 창 바닥이다.
   | 그때 띄워야 하는 값은 **키보드 높이가 아니라** 창 바닥에서 키보드 윗변까지다.
   */
  it('내비바 높이만큼 더 올린다 — 이게 빠져서 버튼이 숨었다', () => {
    const got = kbLift({ rowBottom: A32.windowH, screenY: A32.screenY, height: A32.height, gap: 0 });

    expect(got).toBeCloseTo(377.5, 1);
    expect(got - A32.height).toBeCloseTo(NAV, 1);   // 옛 방식보다 정확히 내비바만큼 더
  });

  it('옛 방식(높이만 쓰기)은 내비바만큼 모자랐다', () => {
    const old = A32.height;
    const need = A32.windowH - A32.screenY;

    expect(need - old).toBeCloseTo(NAV, 1);
  });

  it('틈을 더해 준다', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: A32.screenY, height: A32.height, gap: 8 }))
      .toBeCloseTo(385.5, 1);
  });
});

describe('바닥 줄이 창 바닥에 없을 때', () => {
  /*
   | 탭바가 남아 있거나 바닥에 여백이 있으면 줄의 아랫변이 더 위에 있다. 그만큼 덜 올려야
   | 한다 — 창 바닥을 기준으로 계산하면 이 경우 **너무 많이** 올려 빈 자리가 생긴다.
   */
  it('줄이 위에 있으면 그만큼 덜 올린다', () => {
    const got = kbLift({ rowBottom: 866.3, screenY: A32.screenY, height: A32.height, gap: 0 });

    expect(got).toBeCloseTo(329.5, 1);
  });

  it('줄이 이미 키보드 위에 있으면 올리지 않는다', () => {
    expect(kbLift({ rowBottom: 400, screenY: A32.screenY, height: A32.height, gap: 0 })).toBe(0);
  });
});

describe('값을 못 쓸 때는 옛 방식으로 돌아간다', () => {
  /* 모자라게 올리더라도 아예 안 올리는 것보다 낫다 */
  it('아직 못 쟀으면 높이를 쓴다', () => {
    expect(kbLift({ rowBottom: null, screenY: A32.screenY, height: A32.height, gap: 8 }))
      .toBeCloseTo(337.5, 1);
  });

  it('좌표가 없으면 높이를 쓴다', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: null, height: A32.height, gap: 8 }))
      .toBeCloseTo(337.5, 1);
  });

  it('좌표가 0 이하면 믿지 않는다', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: 0, height: A32.height, gap: 8 }))
      .toBeCloseTo(337.5, 1);
  });
});

describe('키보드가 없으면 여백을 주지 않는다', () => {
  /* 0 이 아니면 화면이 늘 떠 있는 것처럼 보인다 */
  it('높이가 0 이면 0', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: A32.screenY, height: 0, gap: 8 })).toBe(0);
  });

  it('높이가 음수여도 0', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: A32.screenY, height: -5, gap: 8 })).toBe(0);
  });

  it('숫자가 아니면 0', () => {
    expect(kbLift({ rowBottom: A32.windowH, screenY: A32.screenY, height: NaN, gap: 8 })).toBe(0);
  });
});

/*
 | 계산은 맞았는데 **넣는 값이 틀려서** 한 번 더 돌았다(2026-09-19, 꿀꿀캐시 세션이 잡았다).
 |
 | 호출부가 `measureInWindow` 로 잰 아랫변을 넣고 있었다. 재려면 키보드가 없을 때 재야
 | 하는데(여백을 준 뒤 재면 값이 다시 들어가 매번 더 올라간다), **그때는 하단 탭바가 아직
 | 있다.** 시트는 탭바를 덮지 않고 그 위에 얹히므로 잰 값이 탭바만큼 위를 가리켰고, 키보드가
 | 뜨면 탭바가 언마운트되어 그 값은 그 순간 낡았다.
 |
 | 위 테스트들은 처음부터 **창 높이**를 넣고 있었다 — 테스트가 맞고 호출부가 틀렸다.
 | 그래서 호출부를 소스 글자로 못 박는다. 동작으로는 못 잡는다(실기기·네이티브가 필요하다).
 */
describe('호출부가 창 높이를 넣는다', () => {
  /*
   | 호출은 `useKeyboardPad` 한 곳이다(용돈캡슐 2026-09-19). 당근 원본은 아직 `MissionSheet` 를 읽는데,
   | 거기서 훅으로 옮긴 뒤라 그 글자가 없다 — 실제로 부르는 파일을 읽고, 미션 시트는 훅을 쓰는지만 본다.
   */
  const read = (...p: string[]) => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const raw = readFileSync(join(__dirname, ...p), 'utf8');

    // 주석에 예시 코드가 글로 들어 있다 — 같은 길이의 공백으로 지운다
    return raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
      .replace(/(?<!:)\/\/.*/g, (m) => ' '.repeat(m.length));
  };
  const src = read('useKeyboardPad.ts');

  it('화면은 훅을 쓴다 — 키보드 리스너를 따로 달지 않는다(총무님 화면 전부)', () => {
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    for (const f of readdirSync(join(__dirname, '..', 'screens')).filter((n: string) => n.endsWith('.tsx'))) {
      expect(read('..', 'screens', f), f).not.toMatch(/Keyboard\.addListener/);
    }
  });

  it('kbLift 에 창 높이를 넘긴다(window · screen 중 큰 쪽)', () => {
    expect(src).toMatch(/rowBottom:\s*Math\.max\(Dimensions\.get\('window'\)\.height,\s*Dimensions\.get\('screen'\)\.height\)/);
  });

  it('키보드 높이보다 적게 올리지 않는다', () => {
    expect(src).toMatch(/Math\.max\(byTop,\s*height \+ gapRef\.current\)/);
  });

  /* 스크롤 여백도 같은 48dp 가 모자랐다(2026-09-19 꿀꿀캐시 세션 전파) — 높이를 따로 읽지 말고 같은 훅을 쓴다 */
  it('스크롤 여백(keyboard.ts)도 같은 계산을 쓴다', () => {
    const scroll = read('keyboard.ts');

    expect(scroll).toContain("from './useKeyboardPad'");
    expect(scroll).not.toMatch(/Keyboard\.addListener/);
    expect(scroll).not.toMatch(/endCoordinates/);
  });

  it('잰 값을 넘기지 않는다 — 탭바만큼 어긋난다', () => {
    expect(src, '측정값을 다시 넣고 있다').not.toMatch(/rowBottom:\s*rowBottom\.current/);
  });
});
