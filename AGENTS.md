# Expo HAS CHANGED
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# 총무님 — 모임 총무용 회비·영수증 장부 (2026-09-22 시작)

**리워드 앱이 아니다.** 광고(AdMob)·포인트·미션·앱모아보기(apphub)를 쓰지 않는다.
**사용자를 추적하지 않는다(ATT 없음).** `expo-tracking-transparency`·`NSUserTrackingUsageDescription` 을 넣지 않고, Firebase Analytics 는
`withoutAdIdSupport: true`(app.json 플러그인 → Podfile `$RNFirebaseAnalyticsWithoutAdIdSupport`)로 광고 식별자 지원을 뺀다 — 기본 빌드는
`FirebaseAnalytics/IdentitySupport` 가 ATT 를 참조해서 애플이 「ATT 를 쓰는데 요청이 안 보인다」(2.1)로 반려한다(머니트리 2026-09-21).
App Store Connect 개인정보 항목도 **「추적 안 함」** 으로 낸다.
Android 도 광고 ID 를 안 모은다 — `firebase.json`(`google_analytics_adid_collection_enabled: false` 등) + app.json
`android.blockedPermissions` 로 `AD_ID` 권한과 Privacy Sandbox 광고 권한(`ACCESS_ADSERVICES_AD_ID` · `ATTRIBUTION`, Firebase Analytics 가 끌고 옴)을 뺀다(네이티브 빌드부터 적용). Play Console 「광고 ID」 선언은 **「사용 안 함」**.
약관 · 개인정보처리방침 · 계정 삭제 안내는 서버 페이지 `https://api.j-curve.co.kr/v1/chongmunim/cm/legal/{terms,privacy,delete}`
(jcurve-api `resources/views/chongmunim/legal`, 앱 `extra.legalBase`). 스토어의 개인정보 · 계정 삭제 URL 도 이 주소를 쓴다.
방침 문구는 실제 동작(탈퇴 = `Club::forget`, 모임 안 공개 범위)과 맞춰야 한다 — 동작을 바꾸면 방침도 고친다.
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
| 글꼴 | **모든 글자 Pretendard**(v1.3.9, `assets/fonts` 400~900, 2026-09-22 사용자 결정). `Text` 는 react-native 가 아니라 `src/ui/kit` 것을 쓴다 — `fontWeight` 를 그 무게의 글꼴로 바꿔 그린다(`src/ui/font.ts`). 결산서 PDF·공개 장부 웹은 같은 판의 웹 글꼴(jsDelivr) |

## 구독 (2026-09-22 사용자 결정)

**모임마다 월 5,500원**(처음 4,900원 → 앱스토어 가격표에 없어 5,500원, 2026-09-22 태훈님). **무료는 계속 쓸 수 있다(체험 없음).** `plan` 칸이 생길 때 **있던 모임은 모두 pro**, 새 모임은 free.

**결제는 RevenueCat**(2026-09-22 태훈님 「구독은 레비뉴캣으로」) — 앱 `src/billing.ts` · 서버 `Billing`(jcurve-api).
- 사는 사람 = 회원 한 명, RC 사용자 `cm-{회원번호}`. 상품 `chongmunim_pro_monthly`(iOS) · `chongmunim_pro`/`monthly`(Play), 권한 `pro`, 오퍼링 `default`
- 사고 나면 앱이 `POST cm/g/{gid}/plan/claim` → 서버가 **RC 에 직접 물어**(V1 비밀 키) 확인하고 그 모임을 덮는다(`cm_subscriptions.group_id`,
  `cm_groups.plan_until`). 갱신 · 해지 · 환불은 RC 웹훅 `POST /v1/chongmunim/cm/revenuecat` → 그 사람을 다시 읽는다. 끝이 지나면 저절로 무료
- **한 사람의 구독 = 모임 하나**(스토어는 Apple ID 하나에 같은 그룹 구독을 하나만 준다). 다른 모임으로 옮기기는 된다(`move`, 떼인 모임은 무료).
  두 모임 이상을 받으려면 상품(자리)을 더 만든다
- `plan_until` 이 비어 있는 pro 는 결제 없이 켠 것(끝 없음) — 운영에서 켜려면 plan 만 pro 로
- 설정: 앱 `extra.revenuecatIos` · `revenuecatAndroid`(공개 SDK 키), 서버 `app_configs(20,'revenuecat')` = {secretKey, webhookAuth}
- SDK(react-native-purchases)는 네이티브 모듈 — 넣은 빌드 전의 판에는 결제 단추 대신 「준비하고 있어요」(billingState)

| 무료 | 구독 |
|---|---|
| 영수증 올리기 **한 번에 한 장** · 직접 적기 · 장부 보기 · 엑셀 | 여러 장 한 번에(최대 10) |
| 총무 빼고 **10명까지** 초대 — 같이 **보기만** | 인원 제한 없음 · 운영자(관리자) · 회원 지급 요청 |
| | 회비 체크·미납 안내 · 공지 · 행사 · 예산·작년 · 결산서 PDF · 공개 링크 · 장부 파일 가져오기 |

서버가 막는 것은 `plan_required`(403) · 초대 인원은 `plan_member_limit` — 앱은 `plan_required` 를 받으면 토스트 대신
구독 안내(`src/screens/Plan.tsx` PlanAsk)를 띄운다(store `fail`). **적을 것이 있는 화면은 들어올 때 막는다** — 여러 장 · PDF ·
회원의 가운데 카메라 · 회비 · 예산 · 마감 · 장부 가져오기, 그리고 공지 쓰기 · 행사 만들기(2026-09-23 A32 시험: 제목 · 내용을 다 적고
보내기에서 막혀 헛수고였다). 누르는 순간 끝나는 것(공개 링크 스위치)은 서버 403 에 맡긴다.
문구·목록은 `src/cm/plan.ts` 한 곳.

## 영수증 보내기 (2026-09-22 태훈님)

찍기 · 고르기 → **살피기**(한 장씩 ↻ 시계 방향 · 180° 뒤집기 · 빼기 — expo-image-manipulator 로 픽셀을 돌려 새 파일) → 「N장 전송하기」 →
**지금 기록 / 나중에 기록**(한 장이어도 같다). 올리기만 폰에서(`src/receiptQueue.ts` — 공용 OCR 에 올리고 서버에 맡김),
**읽기 · 기록 대기는 서버**(jcurve-api `ReceiptJobs`, `cm_receipt_jobs`): 워커가 다 읽는 순간(OcrWorkerController result · fail 훅)
서버가 `cm_receipts` 로 옮긴다. 「기록 기다림」은 `GET receipts/pending`(폰을 바꿔도 남음) — 홈 띠 · 기록 화면이 3초마다 따라간다.
나중에 기록 묶음은 다 읽히면 **푸시**(「영수증 N장을 다 읽었어요」, `chongmunim://record?g=` → 기록 기다림 카드). 이미 다 기록했으면 조용히.

## 마감 (2026-09-22 사용자 결정 「잠그기」)

장부 월별 · 연간, 행사 화면의 「마감하고 알리기」 — 그 순간 숫자로 **결산 한 장**(서버 `cm_closings.snapshot`, 장부 화면과 같은 모양)을
굳히고 공지+푸시로 보낸다(잠금 화면엔 「9월 결산」 제목만). 알림을 누르면 `chongmunim://notice/{id}?g={모임}` → 공지 →
「결산 보기」(`src/screens/Closing.tsx`). **마감한 달 · 해 · 행사의 기록은 서버가 막는다**(`period_closed` — 적기·고치기·지우기·
지급 처리·회비·가져오기). 고치려면 「마감 풀기」, 다시 마감하면 새 결산이 간다. 구독 기능(풀기는 늘 된다).

## 쓰던 장부 파일 가져오기 (2026-09-22 사용자 결정 「b로 해」)

설정 › 모임 정보 › 「쓰던 장부 파일로 가져오기」 — 폰에 있는 엑셀(.xlsx)·CSV·PDF 또는 **공개된**(「링크가 있는 모든 사용자」) 구글 시트 링크.
드라이브에서 고르기는 뺐다(2026-09-23 대표님 — 아래 「아직 없는 것」).
서버(`ChongmunimImportController`)가 파일을 공용 OCR 큐에 **kind=ledger** 로 넣고, 맥 워커(영테크 `receipt-analyzer` 브랜치
`analyzer/`, 텍스트 Qwen · PDF 는 VL)가 날짜·구분·항목·내용·금액·행사로 푼다. 워커 결과 계약은 컨트롤러 머리 주석에 있다.
확인 표(`LedgerPreview`)가 다른 시트와 겹친 줄 · 이미 장부에 있는 줄 · 날짜 없는 줄을 꺼 두고, 항목을 이 모임 것에 맞추고,
원본 소계·이월과 **시트별로** 대조한다. **사람이 고른 줄만** 넣고(`src/cm/importRows.ts`), 넣은 것은 한 번에 되돌린다.
분석은 몇 분 걸린다 — 화면을 떠나도 되고 홈 띠가 알린다. 워커가 없거나 실패해도 붙여넣기·기초 잔액은 늘 열려 있다.

## 재방문 로컬 알림 (`src/remind.ts`, 2026-09-22)

`@jcurve/notify` createNotify — 앱이 뒤로 가면 걸고 앞으로 오면 지운다. 시각은 앱이, 문구는 어드민 「앱 알림」(`content/config/notify`)이
정하고, 비어 있으면 `remind.ts` 기본값. **어드민에 넣을 때 키가 같아야 한다**(다르면 오류 없이 안 뜬다).
필요한 사실은 홈을 열 때 받아 둔다(서버 `home.remind`, 총무·관리자만). **잠금 화면에 금액·이름을 싣지 않는다.**

| 키 | 언제 | 누구 |
|---|---|---|
| `tidy.month` | 말일 20:00 — 이번 달 항목 없는 기록이 있거나 통장 대사 전 | 총무·관리자 |
| `dues.check` | 미납이 있으면 5일·20일 19:00, 아니면 다음 달 5일 — 월 회비를 정한 모임 | 총무·관리자(회비 안내 스위치) |
| `request.wait` | 다음 날 10:00 — 처리 안 한 지급 요청이 남았을 때 | 총무·관리자(지급 요청 스위치) |
| `event.settle` | 행사 끝난 다음 날 19:00 | 총무·관리자 |
| `year.settle` | 12월 28일 19:00(11월부터) | 총무·관리자 |
| `idle` | 마지막으로 연 뒤 7일(회원 14일) 19:30 | 모두 |
| `birthday` | 회원 생일 날 09:00 — 앞으로 60일 안(구독 모임) · 이름은 싣지 않는다 | 총무·관리자 |

전체 스위치는 설정 › 내 정보 › 「장부 챙김 알림(이 폰)」. 안 울리는 시간 21~8시(아침 9시로 미룸).

## 공용 패키지 (GitHub 릴리스 주소로 설치 — API 문서 §0-B-1)

`@jcurve/auth` 2.1.2 · `@jcurve/ocr` 1.0.0 · `@jcurve/notify` 1.2.0 · `@jcurve/updates` 2.5.1 — `package.json` 에 github.com/jxamen/jcurve-packages
릴리스 파일 주소를 적는다(공개 저장소라 토큰 없이 어디서든 받는다). 예전 `vendor/*.tgz`(`file:`)는 공개 저장소에 없어 클론만으로는 설치가 안 됐다.
API 요청 헤더의 OTA 판은 앱이 만들지 않고 `otaHeaders()`(updates 2.5.1)를 쓴다.
`@jcurve/ocr` 1.0.0 의 업로드는 Expo 57 에서 `{uri,name,type}` 이 깨진다 — 앱의 `post` 가 `expo-file-system` 의
`File` 로 다시 싼다(영테크 `src/receipt/client.ts` 와 같은 수정, `src/ocr.ts`).

`@jcurve/auth` 의 **「로그인이 안 끝났으면 놓아 주기」는 `background` 를 거쳐 돌아온 것만** 센다(`src/loginRescue.ts`).
iOS 구글 · 웹 로그인은 앱을 떠나지 않고 창을 위에 띄워 `inactive ↔ active` 만 오가므로, 아무 `active` 에서나 놓아 주면
**계정 고르는 중인 로그인을 버린다**(2026-09-23 머니트리 아이폰 먹통 제보 → 총무님 · 꿀꿀 · 당근 · 용돈캡슐 · 캐시팡 같은 자리 수정).
**중간의 `inactive` 로 깃발을 지우면 안 된다** — iOS 는 돌아올 때도 `inactive → active` 로 알려서, 그러면 정작 아이콘으로
나갔다 온 것을 놓쳐 원래 버그(로그인 버튼 영구 먹통)가 되살아난다. 놓아 줄 때 **팝업(RN Modal)을 띄우지 않는다** — 구글 창 위에
올리려다 보이지 않는 막이 남는다(총무님은 추적 한 줄만 남기고, `Toast` 는 `pointerEvents="none"`).
→ **할 일**: 이 판단이 `@jcurve/auth` **2.2.0 `createReturnWatch()`** 로 패키지에 들어갔다(2026-09-23, 총무님 지적이 반영된 것).
`src/loginRescue.ts` 를 그 함수로 바꾼다 — **이 건만으로 새 빌드를 굽지 말고** 다음 네이티브 빌드나 OTA 에 얹는다.
2.2.0 에 네이티브 변경이 없다면 OTA 로도 나갈 수 있다(패키지 JS 도 번들에 들어간다).

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
동의항목          닉네임·프로필사진 → 「사용 안 함」으로 바꾸는 중 (2026-09-22 태훈님: 카카오에서 이름·사진을 받지 않는다.
                  앱은 이름이 없으면 「회원」으로 가입하고, 모임 만들 때 부를 이름을 받는다)

Firebase 프로젝트 chongmunim-d7971   (GA4: 애널리틱스 계정 「제이커브 앱」)
  Android 앱      1:279587750736:android:157daaf115a16f2b386255
  iOS 앱          1:279587750736:ios:a12ab698e44da659386255
  설정 파일       google-services.json · GoogleService-Info.plist (앱 루트, **커밋 필수**) — OAuth 클라이언트를 만든 뒤에 받음(04 A-20)

구글 웹 클라이언트 279587750736-1ktgbrua5pjih1npv3g5h9tbe9t3ioui.apps.googleusercontent.com
구글 iOS 클라이언트 279587750736-gulso497ilpe3givj7r7bprnph4s0lg9.apps.googleusercontent.com
iosUrlScheme      com.googleusercontent.apps.279587750736-gulso497ilpe3givj7r7bprnph4s0lg9
구글 Redirect     https://api.j-curve.co.kr/v1/chongmunim/auth/callback/google

Apple App ID      kr.co.jcurve.chongmunim (Sign in with Apple 켬, 팀 7H9T37RL2G)

스토어 앱 (2026-09-22 맥크롬 생성 — 태훈님 지시로 이름에 「스마트」)
  Play Console    앱 ID 4972498678274145678 · 「총무님 - 스마트 모임 회비 장부·정산」 · 무료
  App Store       Apple ID 6814784833 · 「총무님 - 스마트 모임 회비 장부」 · 부제 「스마트한 모임 총무, 회비·장부·영수증 정산」 · SKU chongmunim
  (앱 콘텐츠 · 앱 개인정보 · 스크린샷 · 빌드는 아직 — 값은 머리말의 약관 페이지 주소와 개인정보처리방침을 따른다)

RevenueCat (2026-09-22 자동화 세션 — 프로젝트 「총무님」)
  공개 SDK 키      appl_tBVEmLFyiDhOYDoZlVAaBfCkMXl(iOS) · goog_yNmmzULLtNjuJrIjVJOFUjSFFUt(Android) ← app.json extra.revenuecatIos/Android
  권한 · 오퍼링     pro(총무님 구독) · default(현재) = $rc_monthly 하나
  App Store       .p8 앱 내 구입 키 등록 · 구독 그룹 「총무님 구독」 22404322 · chongmunim_pro_monthly(Apple ID 6814796573, 1개월, 175개국)
                  가격표에 ₩4,900 이 없어 **₩5,500**(태훈님 결정 — Play 도 같은 값). 앱 화면의 결제 단추는 스토어 priceString
  Play            서비스 계정 revenuecat-play@chongmunim-d7971 JSON 등록(자격 증명 Valid). 구독 chongmunim_pro · 기본 요금제 monthly(₩5,500,
                  자동 갱신, 유예 7일, 활성) → RC 권한 pro · 오퍼링 default $rc_monthly 에 연결(2026-09-22, 판매자 계정은 태훈님)
  웹훅            …/v1/chongmunim/cm/revenuecat · 두 환경 · 모든 이벤트. 비밀 키(V1) · 웹훅 인증값은 배포가 app_configs 에(파일로 받음)
  Play 연동       서비스 계정에 pubsub.admin · monitoring.viewer, Play Console 총무님 앱에만 초대(재무 데이터 · 주문 및 구독 관리)
                  RTDN 토픽 projects/chongmunim-d7971/topics/Play-Store-Notifications — 테스트 알림 수신 확인(2026-09-22)
                  RC 자격 증명 3개 중 1개(package name not found)는 첫 AAB 업로드 뒤 다시 검사
  해외 가격        스토어마다 다르게 둔다(App Store 미국 $2.99 · Play $4.09 — 2026-09-23 대표님 결정 「그대로 두기」). 한국은 둘 다 ₩5,500
  테스터           Play 내부 테스트 「총무님 내부 테스트」 목록 · 라이선스 테스터 jxamen@gmail.com · ourteam.kr@gmail.com(RESPOND_NORMALLY — 시험 결제, 청구 없음)
                  참여 링크 https://play.google.com/apps/internaltest/4701002911810070114
                  **참여 링크는 `?authuser=그계정@gmail.com` 을 붙여 연다** — 안 붙이면 폰 크롬이 기본 계정으로 열어 초대된 계정도
                  「not yet been invited」 가 뜬다(2026-09-23 총무님 · 영테크 둘 다 여기서 40분 잃었다). 플레이스토어 앱의 활성 계정도 같아야 한다
                  새 앱의 **첫 출시는 내부 테스트라도 구글 검토**를 거친다 — 테스터 페이지에 `(unreviewed)` 면 기다리는 것 말고 할 일이 없다
  안드로이드 결제  **끝**(2026-09-23 앱빌드 A32 · ourteam.kr · 내부 테스트 1.0.0 vc2) — 결제 → 갱신 → 해지 → 만료 → 구매 복원 한 바퀴 확인.
                  cm_subscriptions 1행(sandbox) · cm_groups.plan_until 이 갱신마다 5분씩 밀림 · 해지 뒤 멈춤 · 만료 뒤 앱이 무료로 복귀.
                  **만료 뒤에도 cm_groups.plan 은 pro 로 남는 게 정상** — 판단은 plan_until 로만 한다(Club::isPro, 직접 비교하는 곳 없음).
                  어떤 이벤트가 왔는지는 `grep "chongmunim revenuecat" storage/logs/laravel.log`(서버 8c81125) — cm_subscriptions.updated_at 은
                  웹훅마다 같은 값을 다시 써서 움직이므로 그것으로는 알 수 없다
  남은 것         ASC 유료 앱 계약 — W-8BEN-E 제출(활성), 은행 · 국내 세금 처리 대기(앱관리) → 그전엔 RC 의 App Store 상품이 「Could not check」,
                  아이폰 결제 시험도 못 한다 / 구독 심사 스크린샷
```

### 아직 없는 것

- 서버는 준비됨(2026-09-22 배포 세션) — 코드 jcurve-api 6d1cf88 · 1dc65ab · 6df8812 · 914f5a3(공개 장부 글꼴) · be3acc7 · 8cc44d6(장부 파일 가져오기), DB jc_chongmunim, cm_* 15 설치(cm_imports · cm_entries.import_id 포함).
  **어드민 앱 등록은 DB 를 만들지 않는다**(apps.db_name 도 안 채운다) — 새 앱은 서버에서 DB 생성 + 공용 표 migrate + db_name 등록을 따로 한다.
  스모크: `cm/groups` 401 · `auth/providers` 200 **`providers: []`** — 아래 SNS 키가 들어가야 로그인 버튼이 생긴다
  푸시 발송 키(FCM V1)는 서버 `/www/jcurve/secrets/chongmunim-fcm.json` 에 있다(자동화 세션, project_id chongmunim-d7971 확인)
- **어드민 SNS 로그인 키**(`app_configs.social`) — 카카오 REST 키·시크릿, 구글 웹 시크릿은 사람이 넣는다(자동화 세션은 시크릿을 옮기지 않는다)
- ~~구글 OAuth 게시 상태가 「테스트 중」~~ — **프로덕션으로 게시했다**(2026-09-23 자동화). 확인(verification) 심사는 붙지 않았다 —
  드라이브를 빼서 **민감 · 제한 범위가 0** 이고 도메인도 10개 아래여서다(로고 없음). 이제 테스트 사용자가 아니어도 구글 로그인이 된다.
  웹 클라이언트의 리디렉션은 `…/auth/callback/google` 하나만 남았고(picker 주소 삭제), 브랜딩은 앱 이름 총무님 · 홈 `https://j-curve.co.kr/` ·
  방침 · 약관은 `cm/legal/*`. 되돌리려면 같은 화면의 「테스트로 돌아가기」
- ~~구글 Android OAuth 클라이언트·카카오 키 해시~~ — **끝**(2026-09-22: 디버그 · 업로드 · Play 앱 서명 현재 · 이전 네 키 모두 Firebase · OAuth · 카카오 등록). 시험판(빌드 맥 디버그 키):
  SHA-1 `83:FA:C4:D3:93:72:A3:B7:F2:FB:14:11:27:E2:FE:FD:79:9C:3A:D9` · 카카오 키 해시 `g/rE05Nyo7fy+xQRJ+L+/XmcOtk=`(계열 앱 시험판 공용 디버그 키).
  **스토어 판은 지문이 둘 더** — 설치 경로마다 실제로 서명한 키가 등록돼야 로그인이 된다
  ① EAS 업로드 키(2026-09-22 태훈님이 맥에서 만듦, Build Credentials XpMvDSU4f8) — SHA-1 `0F:29:B8:A2:03:6D:D4:20:F8:B1:1E:DE:8C:40:30:F4:F2:18:D2:3E`
     SHA-256 `94:3F:C0:97:…:CE:9F:A8:60` · 카카오 키 해시 `Dym4ogNt1CD4sR7ejEAw9PIY0j4=`. Firebase 에 등록함(총무님 세션, REST).
     Android OAuth 클라이언트 · 카카오 키 해시는 웹 콘솔이라 자동화에 부탁함
  ② Play 앱 서명 키 — **둘이다**(Play 가 키를 바꾼 상태: 현재 · 이전 — Android 13 미만은 이전 키로 볼 수 있어 둘 다 등록)
     현재 SHA-1 `CD:F7:F1:D3:D2:E5:13:FC:33:81:6E:AB:78:F1:81:BA:CB:40:82:E8` · 카카오 `zffx09LlE/wzgW6rePGBustAgug=`
     이전 SHA-1 `15:D0:2B:3B:A1:50:F0:BF:1E:3C:4C:07:ED:5B:A6:A4:A6:DB:5E:3F` · 카카오 `FdArO6FQ8L8ePEwH7VumpKbbXj8=`
  → Firebase 에 네 키(디버그 · 업로드 · 현재 · 이전) SHA-1/256 등록, Android OAuth 클라이언트 네 개(자동화), google-services.json 새로 받음(2026-09-22).
    카카오 키 해시 네 개도 넣음(자동화, 앱 1584900 › Android)
  첫 AAB: versionCode 2(51d5308) — Play 내부 테스트 게시(테스터 미지정)
- ~~구글 드라이브에서 고르기~~ — **뺐다**(2026-09-23 대표님 「Google 드라이브 기능 빼자 파일 찾기도 힘들고 되게 불편하네」).
  앱 `fromDrive`·단추, 서버 `ChongmunimPickerController`·`cm/picker`·`imports/google`, 방침의 드라이브 문구를 지웠다
  (앱 PR #21 · 서버 3f1df06 — 되돌리려면 revert, 단 **고르는 화면이 쓰기 편해야** 다시 넣는다).
  가는 길은 iframe Picker(아이폰에서 쿠키로 먹통) → 로그인 화면이 곧 고르기(`trigger_onepick`)였고, 마지막 판은 동작했지만 쓰기 불편했다.
  남은 길은 **폰에 있는 파일 고르기**와 **공개된 구글 시트 링크**(OAuth 없이 export 로 받는다) — 그래서 서버가 구글에 요구하는 범위에
  `drive.file` 이 **없다**(동의 화면 게시에 민감 범위 심사가 붙지 않는다)
- **어드민 약관·개인정보 기본본** — 등록 안 함. 총무님 전용 문안은 서버 페이지(`cm/legal/*`, 위 머리말)로 대신한다
- **출시 전 정리 — 대표님께 모아서 여쭌다**(되돌리기 어려운 일은 임의로 하지 않는다):
  ① 시험 모임 「결제 시험」(운영 `jc_chongmunim.cm_groups` id 8, 2026-09-23 구독 시험용) ② 그 모임의 sandbox 구독 행(`cm_subscriptions` id 1,
  member 8 = ourteam.kr) — 만료 상태라 해는 없지만 실제 결제 기록과 섞이지 않게 지울지
