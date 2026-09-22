import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * 진입점.
 *
 * 웹에서는 Skia 가 CanvasKit(WASM)을 먼저 받아야 그려진다. 그리고 **App 을 그 뒤에
 * 불러와야 한다** — `import App from './App'` 로 위에 두면 CanvasKit 이 준비되기 전에
 * Skia 모듈이 평가되어 굳는다(증상: 화면이 에러 경계로 떨어지고
 * `Cannot read properties of undefined (reading 'PathBuilder')`).
 *
 * 웹은 **화면과 흐름을 빠르게 보는 용도**다. 광고·SNS 로그인은 네이티브 모듈이라
 * 웹에서는 목업으로 떨어지거나 버튼이 숨는다. 실제 확인은 개발 빌드로 한다.
 *
 * `public/canvaskit.wasm` 이 있어야 한다 — 없으면 `npx setup-skia-web public`.
 */
function start(): void {
  registerRootComponent(require('./App').default);
}

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/commonjs/web');
  void LoadSkiaWeb({ locateFile: (file: string) => '/' + file })
    .then(start)
    .catch((e: unknown) => {
      // 못 받아도 앱은 뜬다(바탕 그림만 안 그려진다) — 왜 못 받았는지는 남긴다
      console.error('[skia-web] CanvasKit 로드 실패:', e);
      start();
    });
} else {
  start();
}
