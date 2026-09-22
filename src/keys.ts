/**
 * 저장 키 목록 — **기기 키와 계정 키를 나눈다**(함정 B-24, 용돈캡슐 `keys.ts` 와 같은 모양).
 *
 * 계정 데이터를 기기 전역 키에 두면 계정을 바꿀 때 남의 것이 그대로 보인다.
 * RN 에 기대지 않는 파일이라 `keys.test.ts` 가 노드에서 직접 읽는다 — 소스 어딘가에 `cm.` 키를 새로 쓰면
 * 둘 중 하나에 등록될 때까지 테스트가 깨진다.
 *
 * 장부는 **전부 서버**에 있다. 기기에 두는 것은 세션·고른 모임·테마 같은 것뿐이다.
 */

/** 로그아웃해도 남는다 — 기기에 속한 값 */
export const DEVICE_KEYS = [
  'cm.device',         // 퍼널 식별용 임시 ID(회원 ID 가 아니다) — @jcurve/auth createFunnel
  'cm.installRef',     // 설치 출처를 보냈다 — @jcurve/auth createFunnel
  'cm.theme',          // 테마 — mint · coral · sky(설정에서 고른다, 기기마다)
  'cm.updateNotice',   // 새 버전이 오면 띠로 알린다 — 끄면 '0'(끄면 스스로 적용, @jcurve/updates 2.2)
  'cm.notifyAsked',    // 알림 권한을 실제로 물어봤다
  'cm.notifyConfig',   // 어드민 로컬 알림 문구(content/config/notify) — 뒤로 가는 순간엔 못 받아서 들고 있는다
  'cm.remindOff',      // 「장부 챙김 알림(이 폰)」을 껐다 — '1'
  'cm.scanIntro',      // 안드로이드 — 첫 스캔 전 「구글 플레이 준비」 안내를 봤다(구글 모듈은 기기마다 한 번 받는다)
] as const;

/** 로그아웃·계정 전환 때 지운다 — 회원에 속한 값 */
export const ACCOUNT_KEYS = [
  'cm.session',        // 세션 토큰
  'cm.member',         // 화면에 쓰는 회원 정보
  'cm.group',          // 마지막으로 본 모임 id
  'cm.remindSnap',     // 로컬 알림이 쓸 홈 요약(home.remind) — 그 모임의 것이라 계정과 같이 지운다
] as const;

export type DeviceKey = (typeof DEVICE_KEYS)[number];
export type AccountKey = (typeof ACCOUNT_KEYS)[number];
export type StorageKey = DeviceKey | AccountKey;
