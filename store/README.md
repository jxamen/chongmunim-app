# 총무님 스토어 스크린샷

8컷을 한 가로 캔버스에 배치한 뒤 잘라 냅니다. 1·2컷은 홈 화면 폰 한 대와 배경이 연결되며, 2컷의 콜아웃은 잔액·월 수입과 지출, 예산 사용률, 지급 요청, 공지와 읽은 사람 수를 가리킵니다. 7컷은 가져오기 표를 뒤에, 예산을 앞에 겹친 두 대이며 나머지는 한 대입니다.

## 만든 파일

| 파일 | 용도 |
|---|---|
| `out/01.png` ~ `08.png` | App Store 1320 × 2868, 8장 |
| `out/play/01.png` ~ `08.png` | Google Play 1080 × 1920, 8장 |
| `design/preview.png`, `design/preview-play.png` | 8컷 연속 미리보기 |
| `review.html` | 원본을 누르며 확인하는 로컬 검수 페이지. 컷 사이 간격 켜기 지원 |
| `raw/01-home.png` ~ `09-closing.png` (05 없음) | Expo 웹 화면 1170 × 2532, 8장 |
| `design/panels.html`, `panels-play.html`, `panels.css` | 10560px 너비의 연속 캔버스와 공통 스타일 |
| `design/render.js`, `render-play.js`, `render-common.js` | Playwright 컷별 출력과 미리보기 생성 |
| `design/resize-play.py` | PIL로 Play 결과를 정확히 1080 × 1920으로 축소 |
| `design/capture.js`, `demo-data.js` | 실제 앱 UI를 시연 데이터로 다시 촬영 |
| `design/demo-receipt.html`, `demo-receipt.png`, `demo-claim-receipt.html`, `demo-claim-receipt.png` | 앨범 선택에 사용하는 가상 영수증 |
| `design/capture-report.json`, `qa-report.json`, `verify.py` | 요청 차단 기록, 규격·연속성 검사 |
| `design/pair-reference.png` | App Store 1·2컷을 자르기 전 원본. 연결 픽셀 비교용 |

**캐릭터(`design/mascot/`)는 저장소에 올리지 않는다** — 원본이 공개하지 않는 `design/receipt_mascot_30_transparent/` 다(`.gitignore`).
다시 구울 때는 그 폴더의 PNG 를 `store/design/mascot/` 에 복사한다. `expo.log` · `pair-reference.png` · `.python/` 도 올리지 않는다.

기존 `out/feature-1024x500.png`, `LISTING.md`, 아이콘·폰트·캐릭터는 그대로 사용했습니다. 글꼴은 `design/fonts/`의 로컬 Pretendard Black / SemiBold입니다. CDN 요청은 없습니다.

## 확인 방법

`store/review.html`을 브라우저에서 열면 두 규격을 연속으로 볼 수 있습니다. 간격을 켜면 실제 목록처럼 각 컷을 구분할 수 있습니다. `design/preview*.png`는 전체 색 흐름과 연결을 빠르게 보는 파일입니다.

검수 결과: 최종 16장 및 원본 8장의 크기 정확, 모든 PNG 불투명, 촬영 중 앱 JS 오류 0건. 1·2컷을 붙인 이미지와 자르기 전 두 컷 캔버스가 픽셀 단위로 같습니다. 숫자가 경계에서 잘리지 않도록 잔액은 1컷, 월 지출은 2컷 쪽에 배치했습니다. 가짜 상태바는 없습니다.

## 다시 굽기

프로젝트 루트에서 실행합니다.

```powershell
node store/design/render.js
node store/design/render-play.js
python store/design/verify.py
```

Playwright는 일반 `require("playwright")`를 먼저 시도하고, 없으면 브리프에 지정된 `C:/Users/jxame/.claude/jobs/d0d2efb0/tmp/pw/node_modules/playwright`를 씁니다.

Python에는 Pillow가 필요합니다. 이 작업 환경에서는 기존 pip 캐시의 Pillow 12.2.0을 `store/design/.python/`에 설치해 사용했습니다. 다른 환경은 `python -m pip install --target store/design/.python Pillow`로 준비합니다. `.python/`은 도구 의존성이며 납품 PNG에 필요하지 않습니다.

## Play 비율

App Store 캔버스는 **10560 × 2868**, Play 캔버스는 **10560 × 2347**입니다. 가로 위치와 폰 너비를 유지하고 제목·폰·콜아웃의 세로 위치를 올렸습니다. 폰 아래 일부가 화면 밖으로 이어지는 구도입니다. App Store PNG를 찌그러뜨려 쓰지 않습니다. Playwright는 1320 × 2347로 자르고, PIL LANCZOS로 **1080 × 1920**을 명시해 축소합니다. 미리보기는 축소 전 캔버스를 18%로 보여줍니다.

## 앱 화면 재촬영

먼저 Expo 웹 서버를 실행합니다.

```powershell
npx expo start --web --port 8123
```

다른 터미널에서:

```powershell
node store/design/capture.js
node store/design/render.js
node store/design/render-play.js
python store/design/verify.py
```

6컷만 다시 촬영하려면 `node store/design/capture.js --claim-only`를 실행한 뒤 위 렌더링·검증 명령을 실행합니다. 다른 raw 원본은 덮어쓰지 않습니다.

포트를 바꾸면 `$env:STORE_WEB_URL = "http://localhost:포트"`를 지정합니다. 뷰포트는 **390 × 844**, deviceScaleFactor는 **3**, 날짜는 **2026-09-24**, 시간대는 서울입니다. 촬영 스크립트가 로컬 CanvasKit WASM을 응답하므로 public/ 또는 src/ 수정은 필요 없습니다.

시연 모임은 **주말 등산 동호회**, 총 9명, 총무 김민준, pro 모임입니다. 6컷은 두 번째 시연 로그인인 회원 이서연(id 902)의 지급 요청 **48,000원**입니다. 3컷의 산마루 식당·산채비빔밥(식비 84,000원)과 구분되도록 **솔바람 아웃도어·등산용 장갑 8켤레(준비물, 6,000원 × 8)**의 별도 가상 영수증으로 실제 업로드 흐름을 진행했습니다. 영수증은 푸른 배경·3컷과 반대 기울기·상단 띠로 모양도 구분합니다. 홈의 지급 요청은 이서연 48,000원 + 박지호 18,000원 = **2건 66,000원**입니다. 받을 계좌는 **국민은행 `000-****-0000`**으로 가렸습니다. 은행 이름을 제외한 회원·가게·영수증·계좌 정보는 모두 가상입니다. 월 회비 30,000원, 7명 납부로 수입 210,000원, 지출 138,000원, 이월 1,173,000원에서 잔액 1,245,000원이 됩니다. 결산 화면은 마감이 끝난 8월을 보여줍니다.

`page.route`가 **Metro의 /cm-api 프록시와 운영 API 주소를 모두 가로채며**, 알려진 로컬 앱 자산 외 외부 요청은 차단합니다. 실제 서버에 쓰기 요청을 보내지 않습니다. 로그인 저장소에는 무효한 촬영용 토큰만 사용합니다. 영수증은 앨범 파일 선택 → 살피기 → 1장 전송 → 지금 기록 → 읽은 결과 확인까지 실제 UI로 진행합니다. OCR 및 영수증 서버 응답은 모두 시연 데이터입니다. API 호출은 `capture-report.json`에 남습니다.

원본은 **Expo 웹 캡처**이므로 실기기 화면과 일부 렌더링 차이가 있을 수 있습니다. 네이티브 캡처를 받으면 raw/를 같은 이름으로 교체해 다시 출력할 수 있습니다.

## 작업 범위

`src/`와 앱 설정은 수정하지 않았습니다. 커밋·푸시하지 않았습니다. store/design/의 기존 추적 파일은 수정 내역에 표시됩니다. 캐릭터·임시 도구에 대한 기존 무시 규칙은 변경하지 않았습니다.

## 1차 수정 — 컷 구성

| 컷 | 원본 | 수정 내용 |
|---|---|---|
| 1 | 01-home.png 왼쪽 | 한 폰 파노라마 유지 |
| 2 | 같은 폰 오른쪽 | 콜아웃 4개: 잔액·수입·지출 / 예산 / 지급 요청 / 공지·읽음 |
| 3 | 02-record.png | 여러 장·나중에 기록·직접 적기 칩 |
| 4 | 03-ledger.png | 월별·연간·행사별·엑셀·PDF·공개 링크 칩 |
| 5 | 04-dues.png | ‘한 사람씩 안내’ 받침글, 관리자 칩 |
| 6 | 06-claim.png | 회원의 지급 요청 확인 화면 새 촬영, 지급 후 장부 기록 칩 |
| 7 | 07-import.png + 08-budget.png | 가져오기 확인 표 + 작년 집행이 있는 예산, 폰 두 대 |
| 8 | 09-closing.png | 결산 원본 이름 변경, 월말 정리 모드 칩 |

옛 공지 컷과 총무의 요청 처리 컷 원본(05-notice.png, 06-request.png)은 삭제했습니다. 07-closing.png는 09-closing.png로 재촬영했습니다. 1·2컷에 하나로 이어지는 홈 외에 동일 원본을 재사용한 폰은 없습니다.

## 기능 확인 — 기능 → 컷 → 근거 파일

모든 경로는 저장소 루트 기준이며 앱 구현을 읽어 확인했습니다. 서버 동작 자체를 운영에서 시험한 것은 아닙니다.

| 기능·칩 | 컷 | src/ 근거 파일·함수 |
|---|---|---|
| 잔액과 이번 달 수입 · 지출 | 1·2 | src/screens/HomeScreen.tsx — HomeScreen, h.balance / h.month |
| 올해 예산, 얼마나 썼는지 | 1·2 | src/screens/HomeScreen.tsx:105 — 예산 Gauge와 h.budget.percent |
| 처리할 지급 요청 | 1·2 | src/screens/HomeScreen.tsx — h.pending, requests 화면 진입 |
| 공지와 읽은 사람 수 | 2 | src/screens/HomeScreen.tsx:153 — h.notice.reads / recipients, NoticeScreens의 읽음 |
| 상호 · 날짜 · 금액을 읽어 기록 | 3 | src/screens/RecordScreen.tsx — ShotCard, src/cm/shots.ts — formFrom |
| 여러 장 한 번에(최대 10장) | 3 | src/cm/shots.ts:11 — MAX_SHOTS = 10; src/screens/RecordScreen.tsx:106,237 — maxShots / selectionLimit |
| 나중에 기록 | 3 | src/screens/RecordScreen.tsx:525 — queue.later; src/receiptQueue.ts — later |
| 영수증 없이 적기 | 3 | src/screens/RecordScreen.tsx:406 — manual 전환, ManualForm |
| 월별 | 4 | src/screens/LedgerScreen.tsx — MonthTab |
| 연간 | 4 | src/screens/LedgerScreen.tsx — YearTab |
| 행사별 | 4 | src/screens/LedgerScreen.tsx — EventsTab; src/screens/EventScreen.tsx |
| 엑셀 | 4 | src/screens/LedgerScreen.tsx — useExport('csv'), shareCsv / toCsv (엑셀에서 여는 CSV) |
| 결산서 PDF | 4 | src/screens/LedgerScreen.tsx — useExport('pdf'), reportHtml / sharePdf |
| 공개 장부 링크 | 4 | src/screens/SettingsScreen.tsx:100,146 — 링크 켜기·복사; src/config.ts — 공개 링크 주소 |
| 미납 회원에게 한 사람씩 안내 | 5 | src/screens/ClubScreen.tsx:202 — 미납 안내 확인, cm.remindDues |
| 회장 · 부총무도 관리자로 | 5 | src/screens/ManageScreens.tsx:222 — ‘관리자로 지정’, admin 역할 설정. 회장·부총무는 모임 내 호칭이며 별도 앱 역할을 뜻하지 않음 |
| 회원이 영수증과 받을 계좌를 붙여 지급 요청 | 6 | src/screens/RecordScreen.tsx:277,466 — cm.addRequest / 받을 계좌, !manager 분기 |
| 총무가 지급완료를 누르면 장부에 저절로 적혀요 | 6 | src/screens/RequestsScreen.tsx:4,40 — act('pay'), cm.payRequest 후 ‘장부에 적었어요’; 서버 자동 기록 계약 명시 |
| 엑셀 · CSV · PDF 가져오기 | 7 | src/cm/ledgerFile.ts — pickLedgerFile / ledgerExt; src/screens/ManageScreens.tsx — sendLedger('file') |
| 구글 시트 가져오기 | 7 | src/screens/ManageScreens.tsx — sendLedger('sheet'); src/cm/api.ts — importSheet. 공개된 시트 링크만 지원 |
| 가져오기 확인 표 | 7 | src/screens/ImportScreen.tsx — Review / RowLine, 고른 줄만 commitImport |
| 작년 집행을 채워 두기 | 7 | src/screens/ManageScreens.tsx — importLines / cm.importPrior; src/screens/LedgerScreen.tsx — BudgetTab의 lastYear / lastYearImported |
| 「작년만큼」 한 번에 | 7 | src/screens/ManageScreens.tsx:691 — BudgetLineScreen의 setAmount(won(line.lastYear)); 항목 한 줄의 예산 입력 기능 |
| 마감 결산 한 장·회원 알림 | 8 | src/screens/Closing.tsx — CloseBar / cm.closeNow({notify}), ClosingScreen snapshot |
| 월말 정리 모드 | 8 | src/screens/TidyScreen.tsx:2,21 — TidyScreen, 항목 정리·통장 대사 |

7컷의 ‘가져온 값’은 **작년 항목별 집행 붙여넣기(importPrior)**에서 온 값입니다. 파일 가져오기 결과가 자동으로 이 표시를 만든다는 뜻은 아닙니다. 캡처는 파일 선택 → mocked imports 응답 → Review 확인 표로 진입하며, 예산 응답도 가로챕니다. 세 항목 모두 작년 값·가져온 값 표시가 있습니다.

### 뺀 칩

- **광고 없음(8컷)**: AGENTS.md에는 운영 방침이 있으나 src/에서 이 문구를 직접 보장하는 화면·함수를 찾지 못했습니다. REVISE의 ‘칩마다 src/ 근거, 못 찾으면 제외’ 조건에 따라 뺐습니다. 광고가 있다는 뜻은 아닙니다.
- 그 외 칩은 모두 근거를 확인하여 요청 문구 그대로 반영했습니다.

최종 검증: `node store/design/render.js`, `node store/design/render-play.js`, `python store/design/verify.py` 모두 통과. App Store 8장(1320×2868), Play 8장(1080×1920), 원본 8장(1170×2532), PNG 불투명·앱 오류 없음·API 전부 가로채기·1/2컷 연결 픽셀 일치 확인. 두 미리보기를 직접 검수했습니다. 작업 전후 SHA-256 대조로 src/ 전체와 LISTING.md 무변경을 확인했습니다. 커밋·푸시는 하지 않았습니다.
