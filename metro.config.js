/**
 * Metro 설정 — 용돈캡슐 `metro.config.js` 를 그대로 옮기고 광고 모듈만 뺐다(총무님은 광고가 없다).
 *
 * ① **네이티브 번들에서 `canvaskit-wasm` 을 걷어낸다.**
 *    `@shopify/react-native-skia` 는 웹 백엔드로 `canvaskit-wasm` 을 직접 의존한다. 그 패키지는 node 전용 `fs` 를
 *    `require` 해서, 네이티브 번들에 끌려 들어오면 `Unable to resolve module fs` 로 앱이 아예 뜨지 않는다.
 *    **디버그 빌드는 JS 를 Metro 에서 받으므로 빌드는 멀쩡히 통과하고 실행할 때 터진다.** 웹에서는 그대로 둔다.
 *
 * ② **키가 필요한 네이티브 모듈은 발급 전에는 빈 모듈이다.**
 *    카카오 · 구글 로그인 · 파이어베이스(GA4)는 콘솔에서 키를 받아 `app.json` 플러그인에 넣어야 제대로 선다.
 *    공용 로그인 패키지(`@jcurve/auth`)는 이 모듈들을 지연 `require` 로 부르고 없으면 그 제공자를 건너뛰는데,
 *    Metro 는 설치되지 않은 모듈을 **번들 단계에서** 못 찾아 멈춘다. 설치되어 있지 않을 때만 빈 모듈로 돌린다 —
 *    `npm i` 로 넣는 순간 저절로 진짜 모듈을 쓴다. **모듈과 플러그인 설정을 같이** 넣어야 한다(04 E-1).
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const OPTIONAL_NATIVE = [
  '@react-native-firebase/analytics',
  '@react-native-firebase/app',
  '@react-native-kakao/core',
  '@react-native-kakao/user',
  '@react-native-google-signin/google-signin',
];

const installed = (name) => {
  try {
    require.resolve(name + '/package.json', { paths: [__dirname] });
    return true;
  } catch {
    return false;
  }
};
const missing = new Set(OPTIONAL_NATIVE.filter((n) => !installed(n)));

/* 같은 폴더의 홈페이지(`homepage/`, 다른 세션의 별도 저장소)는 앱 번들과 무관하다 — 훑지 않는다 */
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], [/[\\/]homepage[\\/].*/]);

const base = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && moduleName.startsWith('canvaskit-wasm')) {
    return { type: 'empty' };
  }
  if (missing.has(moduleName)) {
    return { type: 'empty' };
  }

  return (base ?? context.resolveRequest)(context, moduleName, platform);
};

/*
 | 웹 미리보기는 **같은 출처 프록시**로 API 를 부른다(영테크 `metro.config.js` 와 같은 장치) — 서버 CORS 가 브라우저 출처를
 | 열어 두지 않았다. `/cm-api/*` → `{CM_API_UPSTREAM}/*`. 기본은 운영 API 이고, 로컬 서버로 확인할 때만
 | `CM_API_UPSTREAM=http://127.0.0.1:8000/v1/chongmunim` 을 준다. 네이티브는 이 길을 쓰지 않는다(config.ts).
 */
const UPSTREAM = new URL(process.env.CM_API_UPSTREAM || 'https://api.j-curve.co.kr/v1/chongmunim');
const previousMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previousMiddleware ? previousMiddleware(middleware, server) : middleware;
  return (req, res, nextHandler) => {
    if (!req.url?.startsWith('/cm-api/')) return next(req, res, nextHandler);
    const upstream = require(UPSTREAM.protocol === 'https:' ? 'node:https' : 'node:http').request({
      hostname: UPSTREAM.hostname,
      port: UPSTREAM.port || undefined,
      path: UPSTREAM.pathname.replace(/\/+$/, '') + '/' + req.url.slice('/cm-api/'.length),
      method: req.method,
      headers: { ...req.headers, host: UPSTREAM.host },
    }, (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.setTimeout(30000, () => upstream.destroy(new Error('API timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'api_unavailable' }));
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  };
};

module.exports = config;
