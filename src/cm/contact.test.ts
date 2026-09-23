/**
 * 문의 · 신고(App Store 가이드라인 1.2) — 메일 쓰기 주소와, 설정에 그 줄이 있는지. 주석은 떼고 검사한다(H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, contactMailto } from './contact';

describe('문의 · 신고 메일', () => {
  const url = contactMailto({ groupId: 12, groupName: '주말 등산 동호회', memberId: 34, app: '총무님 1.0.0', os: 'ios' });
  const q = new URLSearchParams(url.slice(url.indexOf('?') + 1));

  it('방침 문의처로, 제목을 채워 연다', () => {
    expect(url.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true);
    expect(CONTACT_EMAIL).toBe('jcurve19@gmail.com');
    expect(q.get('subject')).toBe('[총무님] 문의 · 신고');
  });

  it('누가 · 어느 모임에서 보냈는지 본문에 — 이름은 넣지 않는다', () => {
    const body = q.get('body') ?? '';
    expect(body).toContain('모임: 주말 등산 동호회 (#12)');
    expect(body).toContain('회원번호: 34');
    expect(body).toContain('앱: 총무님 1.0.0 · ios');
    expect(body).toContain('신고할 글 · 사진');
  });

  it('모임이 없어도 열린다', () => {
    const body = new URLSearchParams(contactMailto({ groupId: null, groupName: null, memberId: null, app: '총무님', os: 'android' }).split('?')[1]).get('body') ?? '';
    expect(body).toContain('모임: -');
    expect(body).toContain('회원번호: -');
  });
});

describe('설정 화면', () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const src = strip(fs.readFileSync(path.resolve(__dirname, '../screens/SettingsScreen.tsx'), 'utf8'));

  it('누구에게나(총무 · 회원) 「문의 · 신고」 줄이 있고 메일 쓰기를 연다', () => {
    expect(src).toMatch(/<MenuRow label="문의 · 신고" onPress=\{\(\) => \{ void contact\(\); \}\} \/>/);
    expect(src).toMatch(/const url = contactMailto\(\{/);
    expect(src).toMatch(/await Linking\.openURL\(url\);/);
  });

  it('메일 앱이 없으면 주소를 복사하고 알린다 — 막다른 길이 되지 않게', () => {
    expect(src).toMatch(/copy\(CONTACT_EMAIL\)/);
  });
});
