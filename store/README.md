# 총무님 스토어 스크린샷

8컷을 한 가로 캔버스에 배치한 뒤 잘라 냅니다. 1·2컷은 홈 화면 폰 한 대와 배경이 연결되며, 2컷의 콜아웃은 잔액·월 수입과 지출, 예산 사용률, 지급 요청을 가리킵니다. 3~8컷에는 폰을 한 대씩 배치했습니다.

## 만든 파일

| 파일 | 용도 |
|---|---|
| `out/01.png` ~ `08.png` | App Store 1320 × 2868, 8장 |
| `out/play/01.png` ~ `08.png` | Google Play 1080 × 1920, 8장 |
| `design/preview.png`, `design/preview-play.png` | 8컷 연속 미리보기 |
| `review.html` | 원본을 누르며 확인하는 로컬 검수 페이지. 컷 사이 간격 켜기 지원 |
| `raw/01-home.png` ~ `07-closing.png` | Expo 웹 화면 1170 × 2532, 7장 |
| `design/panels.html`, `panels-play.html`, `panels.css` | 10560px 너비의 연속 캔버스와 공통 스타일 |
| `design/render.js`, `render-play.js`, `render-common.js` | Playwright 컷별 출력과 미리보기 생성 |
| `design/resize-play.py` | PIL로 Play 결과를 정확히 1080 × 1920으로 축소 |
| `design/capture.js`, `demo-data.js` | 실제 앱 UI를 시연 데이터로 다시 촬영 |
| `design/demo-receipt.html`, `demo-receipt.png` | 앨범 선택에 사용하는 가상 영수증 |
| `design/capture-report.json`, `qa-report.json`, `verify.py` | 요청 차단 기록, 규격·연속성 검사 |
| `design/pair-reference.png` | App Store 1·2컷을 자르기 전 원본. 연결 픽셀 비교용 |

**캐릭터(`design/mascot/`)는 저장소에 올리지 않는다** — 원본이 공개하지 않는 `design/receipt_mascot_30_transparent/` 다(`.gitignore`).
다시 구울 때는 그 폴더의 PNG 를 `store/design/mascot/` 에 복사한다. `expo.log` · `pair-reference.png` · `.python/` 도 올리지 않는다.

기존 `out/feature-1024x500.png`, `LISTING.md`, 아이콘·폰트·캐릭터는 그대로 사용했습니다. 글꼴은 `design/fonts/`의 로컬 Pretendard Black / SemiBold입니다. CDN 요청은 없습니다.

## 확인 방법

`store/review.html`을 브라우저에서 열면 두 규격을 연속으로 볼 수 있습니다. 간격을 켜면 실제 목록처럼 각 컷을 구분할 수 있습니다. `design/preview*.png`는 전체 색 흐름과 연결을 빠르게 보는 파일입니다.

검수 결과: 최종 16장 및 원본 7장의 크기 정확, 모든 PNG 불투명, 촬영 중 앱 JS 오류 0건. 1·2컷을 붙인 이미지와 자르기 전 두 컷 캔버스가 픽셀 단위로 같습니다. 숫자가 경계에서 잘리지 않도록 잔액은 1컷, 월 지출은 2컷 쪽에 배치했습니다. 가짜 상태바는 없습니다.

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

포트를 바꾸면 `$env:STORE_WEB_URL = "http://localhost:포트"`를 지정합니다. 뷰포트는 **390 × 844**, deviceScaleFactor는 **3**, 날짜는 **2026-09-24**, 시간대는 서울입니다. 촬영 스크립트가 로컬 CanvasKit WASM을 응답하므로 public/ 또는 src/ 수정은 필요 없습니다.

시연 모임은 **주말 등산 동호회**, 총 9명, 총무 김민준, pro 모임입니다. 이름·영수증·계좌는 모두 가상입니다. 월 회비 30,000원, 7명 납부로 수입 210,000원, 지출 138,000원, 이월 1,173,000원에서 잔액 1,245,000원이 됩니다. 결산 화면은 마감이 끝난 8월을 보여줍니다.

`page.route`가 **Metro의 /cm-api 프록시와 운영 API 주소를 모두 가로채며**, 알려진 로컬 앱 자산 외 외부 요청은 차단합니다. 실제 서버에 쓰기 요청을 보내지 않습니다. 로그인 저장소에는 무효한 촬영용 토큰만 사용합니다. 영수증은 앨범 파일 선택 → 살피기 → 1장 전송 → 지금 기록 → 읽은 결과 확인까지 실제 UI로 진행합니다. OCR 및 영수증 서버 응답은 모두 시연 데이터입니다. API 호출은 `capture-report.json`에 남습니다.

원본은 **Expo 웹 캡처**이므로 실기기 화면과 일부 렌더링 차이가 있을 수 있습니다. 네이티브 캡처를 받으면 raw/를 같은 이름으로 교체해 다시 출력할 수 있습니다.

## 작업 범위

`src/`와 앱 설정은 수정하지 않았습니다. 커밋·푸시하지 않았습니다. 기존 저장소의 `design/` 무시 규칙 때문에 **store/design/도 git status에 표시되지 않습니다**. 파일은 디스크에 모두 있으며, 기존 무시 규칙은 변경하지 않았습니다.
