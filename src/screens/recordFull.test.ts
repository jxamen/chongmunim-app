/**
 * 더 올릴 칸이 없을 때 — 찍기 · 고르기를 **열기 전에** 막고 까닭을 고르기 화면에 남긴다(2026-09-24 앱빌드 A32:
 * 기록을 기다리는 영수증이 있는 채 새로 찍으면 토스트도 안 보이고 서버에도 안 갔다). 주석은 떼고 검사한다(H-13).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const src = strip(fs.readFileSync(path.resolve(__dirname, 'RecordScreen.tsx'), 'utf8'));
const body = (name: string) => src.slice(src.indexOf(`const ${name} = async () => {`), src.indexOf('};', src.indexOf(`const ${name} = async () => {`)));

describe('칸이 없으면 열지 않는다', () => {
  it.each(['scan', 'album', 'plainCamera'])('%s 는 열기 전에 blocked() 를 본다', (name) => {
    expect(body(name)).toMatch(/if \(blocked\(\)\) return;/);
  });

  it('막히면 까닭을 고르기 화면(note)에 남긴다 — 토스트만 띄우고 버리지 않는다', () => {
    expect(src).toMatch(/const blocked = \(\): boolean => \{\s*const why = fullNote\(\);\s*if \(!why\) return false;\s*setNote\(why\);\s*setStep\('pick'\);/);
    expect(src).toMatch(/if \(room <= 0\) \{ blocked\(\); return; \}/);
    expect(src).not.toMatch(/if \(room <= 0\) \{ say\(/);
  });
});
