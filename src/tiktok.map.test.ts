import { describe, expect, it } from 'vitest';
import {
  customValues, tiktokEventFor, tiktokIds, tiktokSecret,
  TIKTOK_ANDROID_CONFIG_KEY, TIKTOK_APP_ID_ANDROID_KEY, TIKTOK_APP_ID_IOS_KEY, TIKTOK_CONFIG_KEY,
} from './tiktok.map';

describe('tiktokEventFor — 앱 이름을 틱톡 전환으로', () => {
  it('가입 완료만 Registration', () => {
    expect(tiktokEventFor('signup_done', { method: 'kakao' })).toEqual({ standard: 'registration' });
  });

  it('나머지 이름은 보내지 않는다', () => {
    for (const n of ['app_open', 'first_open', 'login_tap', 'login_done', 'signup_start']) {
      expect(tiktokEventFor(n)).toBeNull();
    }
  });
});

describe('tiktokIds — 틱톡 앱 ID 는 어드민 값에서, 플랫폼마다 따로', () => {
  const ex = { appleAppId: '1234567890', androidPackage: 'kr.co.jcurve.sample' };
  const values = { [TIKTOK_APP_ID_IOS_KEY]: ' 7691439629542850580 ', [TIKTOK_APP_ID_ANDROID_KEY]: '111' };

  it('iOS 는 앱스토어 번호 + iOS 틱톡 앱 ID', () => {
    expect(tiktokIds('ios', ex, values)).toEqual({ appId: '1234567890', tiktokAppId: '7691439629542850580' });
  });

  it('안드로이드는 패키지 이름 + 안드 틱톡 앱 ID — iOS 틱톡 앱 ID 를 쓰지 않는다', () => {
    expect(tiktokIds('android', ex, values)).toEqual({ appId: 'kr.co.jcurve.sample', tiktokAppId: '111' });
    expect(tiktokIds('android', ex, { [TIKTOK_APP_ID_IOS_KEY]: '7691439629542850580' })).toBeNull();
  });

  it('값이 비거나 글자가 아니면 켜지 않는다(웹 포함)', () => {
    expect(tiktokIds('web', ex, values)).toBeNull();
    expect(tiktokIds('ios', { ...ex, appleAppId: '' }, values)).toBeNull();
    expect(tiktokIds('ios', ex, { ...values, [TIKTOK_APP_ID_IOS_KEY]: '  ' })).toBeNull();
    expect(tiktokIds('ios', ex, { [TIKTOK_APP_ID_IOS_KEY]: 7691439629542850580 })).toBeNull();
    expect(tiktokIds('ios', ex, null)).toBeNull();
    expect(tiktokIds('android', null, values)).toBeNull();
  });
});

describe('tiktokSecret — 플랫폼에 맞는 App Secret', () => {
  it('iOS 는 공용 칸만', () => {
    expect(tiktokSecret('ios', { [TIKTOK_CONFIG_KEY]: ' a ', [TIKTOK_ANDROID_CONFIG_KEY]: 'b' })).toBe('a');
  });

  it('안드로이드는 안드 칸이 있으면 그것, 없으면 공용 칸', () => {
    expect(tiktokSecret('android', { [TIKTOK_CONFIG_KEY]: 'a', [TIKTOK_ANDROID_CONFIG_KEY]: 'b' })).toBe('b');
    expect(tiktokSecret('android', { [TIKTOK_CONFIG_KEY]: 'a', [TIKTOK_ANDROID_CONFIG_KEY]: '  ' })).toBe('a');
    expect(tiktokSecret('android', { [TIKTOK_CONFIG_KEY]: 'a' })).toBe('a');
  });

  it('비거나 글자가 아니면 빈 값(켜지 않는다)', () => {
    expect(tiktokSecret('ios', null)).toBe('');
    expect(tiktokSecret('android', { [TIKTOK_CONFIG_KEY]: 1 })).toBe('');
  });
});

describe('customValues — 응답 모양이 달라도 values 를 꺼낸다', () => {
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

describe('어드민 키 이름', () => {
  it('서버 scrub 이 빼는 끝말(_secret · _key · _token · _password)이 아니다', () => {
    expect(TIKTOK_CONFIG_KEY).toBe('chongmunim.tiktok_sdk_access');
    expect(TIKTOK_ANDROID_CONFIG_KEY).toBe('chongmunim.tiktok_android_sdk_access');
    expect(TIKTOK_APP_ID_IOS_KEY).toBe('chongmunim.tiktok_app_id_ios');
    expect(TIKTOK_APP_ID_ANDROID_KEY).toBe('chongmunim.tiktok_app_id_android');
    for (const k of [TIKTOK_CONFIG_KEY, TIKTOK_ANDROID_CONFIG_KEY, TIKTOK_APP_ID_IOS_KEY, TIKTOK_APP_ID_ANDROID_KEY]) {
      expect(/_(secret|key|token|password)$/.test(k)).toBe(false);
    }
  });
});
