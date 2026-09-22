/**
 * 영속 — 모든 저장은 이 파일을 거친다. 키는 keys.ts 가 기기/계정으로 분류한다.
 *
 * 손상된 저장본은 없는 것으로 보고 시드로 시작한다 — try/catch 를 빠뜨리면
 * 한 번 깨진 JSON 이 앱을 영영 못 켜게 만든다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCOUNT_KEYS, type StorageKey } from './keys';

export { ACCOUNT_KEYS, DEVICE_KEYS } from './keys';
export type { AccountKey, DeviceKey, StorageKey } from './keys';

export const get = (k: StorageKey): Promise<string | null> => AsyncStorage.getItem(k);
export const set = (k: StorageKey, v: string): Promise<void> => AsyncStorage.setItem(k, v);
export const remove = (k: StorageKey): Promise<void> => AsyncStorage.removeItem(k);

export async function getJson<T>(k: StorageKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const setJson = (k: StorageKey, v: unknown): Promise<void> =>
  AsyncStorage.setItem(k, JSON.stringify(v));

/** 로그아웃·계정 전환 — 계정 키만 지운다 */
export const clearAccount = (): Promise<void> => AsyncStorage.multiRemove([...ACCOUNT_KEYS]);
