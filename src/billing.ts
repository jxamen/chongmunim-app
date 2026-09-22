/**
 * 구독 결제 — RevenueCat(2026-09-22 태훈님 「구독은 레비뉴캣으로」). 서버 `Billing`(jcurve-api)과 짝.
 *
 * 사는 사람은 회원 한 명이다(RC 사용자 `cm-{회원번호}`). 사고 나면 서버에 「이 모임에 쓰기」(cm.claimPlan)를 부른다 —
 * 서버가 RC 에 직접 물어 확인하고 모임을 덮는다. 스토어는 Apple ID(구글 계정) 하나에 이 구독을 하나만 주므로
 * 한 사람 = 한 모임이다(다른 모임으로 옮기기는 된다). 해지는 스토어의 구독 관리에서 한다.
 *
 * 네이티브 모듈(RNPurchases)은 이 SDK 를 넣은 빌드부터 있다 — 그 전 빌드에 OTA 로 이 코드가 가도 `billingState()` 가
 * 'no_native' 라 아무것도 부르지 않고 결제 단추 대신 「준비하고 있어요」가 뜬다. 공개 SDK 키가 비어 있어도(no_key) 같다.
 */
import { NativeModules, Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { BILLING_KEY } from './config';

export type BillingState = 'ready' | 'no_key' | 'no_native';

export function billingState(): BillingState {
  if (Platform.OS === 'web' || !NativeModules.RNPurchases) return 'no_native';

  return BILLING_KEY ? 'ready' : 'no_key';
}

let configuredFor: string | null = null;

/** 로그인한 회원으로 맞춘다 — 처음이면 configure, 사람이 바뀌었으면 logIn. 결제를 못 하는 판이면 아무것도 안 한다 */
export async function billingLogin(memberId: number | string): Promise<void> {
  if (billingState() !== 'ready') return;
  const id = `cm-${memberId}`;
  if (configuredFor === id) return;
  if (configuredFor === null) {
    // 추적하지 않는다 — 광고 기여 식별자를 모으지 않게(AGENTS 「사용자를 추적하지 않는다」)
    Purchases.configure({ apiKey: BILLING_KEY, appUserID: id, automaticDeviceIdentifierCollectionEnabled: false });
  } else {
    await Purchases.logIn(id);
  }
  configuredFor = id;
}

/** 파는 월 구독 한 개 — 값은 스토어가 정한 그 나라 가격(priceString) */
export async function monthlyPackage(): Promise<PurchasesPackage | null> {
  const o = await Purchases.getOfferings();

  return o.current?.monthly ?? o.current?.availablePackages[0] ?? null;
}

/** 산다 — 사람이 결제 창을 닫으면 false */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    await Purchases.purchasePackage(pkg);

    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean } | null)?.userCancelled) return false;
    throw e;
  }
}

/** 구매 복원 — 폰을 바꿨거나 다시 설치했을 때(애플 심사 필수 단추) */
export async function restore(): Promise<void> {
  await Purchases.restorePurchases();
}

/** 스토어의 구독 관리 — 해지 · 결제 수단은 여기서 */
export const manageUrl = (): string => (Platform.OS === 'ios'
  ? 'https://apps.apple.com/account/subscriptions'
  : 'https://play.google.com/store/account/subscriptions?package=kr.co.jcurve.chongmunim');
