/**
 * iOS 27 은 UIScene 생명주기를 안 쓰는 앱을 **실행 시점에 멈춘다**(EXC_BREAKPOINT ·
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). 총무님 빌드 2(28e880a)가 iOS 27 시뮬레이터에서 켜자마자
 * 꺼졌다(2026-09-24 앱빌드) — expo-build-properties 의 ios 에 enableSceneSupport 가 없었다. 계열 앱(꾹테크 · 머니트리 · 꿀꿀)은 켜 두었다.
 * 네이티브 설정이라 OTA 로는 못 고친다 — 빠지면 새 빌드가 필요하다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const expo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../app.json'), 'utf8')).expo;
const buildProps = (expo.plugins as unknown[]).find((p): p is [string, { ios?: Record<string, unknown> }] => Array.isArray(p) && p[0] === 'expo-build-properties');

describe('iOS 장면(UIScene) 생명주기', () => {
  it('expo-build-properties ios.enableSceneSupport 가 켜져 있다', () => {
    expect(buildProps?.[1].ios?.enableSceneSupport).toBe(true);
  });
});
