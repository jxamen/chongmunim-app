# Expo HAS CHANGED
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# 총무님 — 모임 총무용 회비·영수증 장부 (2026-09-22 시작)

**리워드 앱이 아니다.** 광고(AdMob)·포인트·미션·앱모아보기(apphub)를 쓰지 않는다.
기획은 `docs/01-기획.md`, 화면 시안은 `design/chongmunim-app.html`, 캐릭터는 `design/receipt_mascot_30_transparent/`.

## 확정값

| 항목 | 값 |
|---|---|
| slug | `chongmunim` |
| Android package / iOS bundleIdentifier | `kr.co.jcurve.chongmunim` |
| scheme | `chongmunim` |
| 앱 이름 | 총무님 |
| API base | `https://api.j-curve.co.kr/v1/chongmunim` |
| 앱 DB | `jc_chongmunim` |
| 영수증 | 공용 OCR(`@jcurve/ocr`, `POST ocr/jobs`) → 총무님 전용 표 `cm_receipts` 로 옮겨 영구 보관 |

## 공용 패키지 (vendor tgz, `file:` 설치)

`@jcurve/auth` 2.1.0 · `@jcurve/ocr` 1.0.0 · `@jcurve/notify` 1.2.0 · `@jcurve/updates` 2.4.1 — 원본 `..\..\jcurve-packages\packages\<이름>`.
`@jcurve/ocr` 1.0.0 의 업로드는 Expo 57 에서 `{uri,name,type}` 이 깨진다 — 앱의 `post` 가 `expo-file-system` 의
`File` 로 다시 싼다(영테크 `src/receipt/client.ts` 와 같은 수정, `src/ocr.ts`).

## 콘솔 발급값 — 2026-09-22 (자동화 세션 기록)

**공개값만 적는다.** client secret 은 서버 `app_configs.social` 에만 있고 앱에 넣지 않는다.

```
슬러그            chongmunim
패키지/번들       kr.co.jcurve.chongmunim
어드민 app_id     20            (영수증 OCR ocr_enabled 켬)
public_key        ZANRRxH3H7eoRYHIVc80eDE6WH7j1pPLHny5rK3T   ← app.json extra.publicKey (배포 세션 회신 2026-09-22)
API base          https://api.j-curve.co.kr/v1/chongmunim
DB                jc_chongmunim (배포 세션 생성 2026-09-22 — 공용 표 51 = jc_stamptech 와 같은 벌 + cm_* 14, apps.db_name 등록)

카카오 앱 ID      1584900
카카오 네이티브키 2e519559d34fa6fd107cf3a3f23cb284   ← app.json 두 곳(플러그인 nativeAppKey + extra.kakaoNativeAppKey)
카카오 Redirect   https://api.j-curve.co.kr/v1/chongmunim/auth/callback/kakao
동의항목          닉네임·프로필사진 (필수)

Firebase 프로젝트 chongmunim-d7971   (GA4: 애널리틱스 계정 「제이커브 앱」)
  Android 앱      1:279587750736:android:157daaf115a16f2b386255
  iOS 앱          1:279587750736:ios:a12ab698e44da659386255
  설정 파일       google-services.json · GoogleService-Info.plist (앱 루트, **커밋 필수**) — OAuth 클라이언트를 만든 뒤에 받음(04 A-20)

구글 웹 클라이언트 279587750736-1ktgbrua5pjih1npv3g5h9tbe9t3ioui.apps.googleusercontent.com
구글 iOS 클라이언트 279587750736-gulso497ilpe3givj7r7bprnph4s0lg9.apps.googleusercontent.com
iosUrlScheme      com.googleusercontent.apps.279587750736-gulso497ilpe3givj7r7bprnph4s0lg9
구글 Redirect     https://api.j-curve.co.kr/v1/chongmunim/auth/callback/google

Apple App ID      kr.co.jcurve.chongmunim (Sign in with Apple 켬, 팀 7H9T37RL2G)
```

### 아직 없는 것

- 서버는 준비됨(2026-09-22 배포 세션) — 코드 jcurve-api 6d1cf88 · 1dc65ab · 6df8812, DB jc_chongmunim, cm_* 14 설치.
  **어드민 앱 등록은 DB 를 만들지 않는다**(apps.db_name 도 안 채운다) — 새 앱은 서버에서 DB 생성 + 공용 표 migrate + db_name 등록을 따로 한다.
  스모크: `cm/groups` 401 · `auth/providers` 200 **`providers: []`** — 아래 SNS 키가 들어가야 로그인 버튼이 생긴다
- **어드민 SNS 로그인 키**(`app_configs.social`) — 카카오 REST 키·시크릿, 구글 웹 시크릿은 사람이 넣는다(자동화 세션은 시크릿을 옮기지 않는다)
- **FCM V1 서비스 계정 키** → 서버 `/www/jcurve/secrets/chongmunim-fcm.json` — 자동화 세션 권한 검사에 막혀 사람이 실행해야 한다
- **구글 OAuth 게시 상태**가 「테스트 중」 — 다른 앱(꾹테크)과 같다. 테스트 사용자 외에는 구글 로그인이 안 되니 출시 전에 게시한다
- **구글 Android OAuth 클라이언트·카카오 키 해시** — 첫 AAB 뒤(Play 앱 서명 키 SHA-1 필요)
- **약관·개인정보 기본본** — 등록 안 함(총무님 전용 문안이 필요하다)
