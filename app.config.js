/**
 * `app.json` 위에 **빌드마다 달라지는 것만** 얹는다 — 용돈캡슐 · 당근캐시 · 머니트리 `app.config.js` 와 같은 장치(그대로 옮겼다).
 *
 * ① **자체 OTA 주소면 `eas build` 가 채널을 안 넣는다.** 빌드 도구의 `isEASUpdateConfigured()` 가
 *    `updates.url` 호스트가 `u.expo.dev` 일 때만 참이고, 그때만 프로필 `channel` 을 `expo-channel-name` 으로 넣는다.
 *    그대로 두면 모든 빌드가 `app.json` 의 기본 채널을 본다 — 스토어 판이 시험 판(preview)을 받거나 그 반대가 된다
 *    (2026-09-19 「머니트리 용돈캡슐 깔끔하게 다 빌드해서 스토어 등록하자」 직전, 머니트리 세션이 짚었다 — 용돈캡슐 `app.json` 은
 *    preview 가 박혀 있었다). 그래서 `eas.json` 프로필의 `env.OTA_CHANNEL` 을 여기서 헤더로 옮긴다.
 *    Xcode · Gradle 로 직접 빌드할 때도 `OTA_CHANNEL=preview npx expo prebuild …` 처럼 같은 값을 준다.
 *    **값이 없으면 `app.json` 의 production** 이다(스토어로 가는 판이 기본 — 시험 판이 실사용자에게 가는 쪽이 더 나쁘다).
 *
 * ② **EAS 로 발행할 때만** `OTA_TARGET=eas` 로 주소를 EAS 로 되돌린다(자체 OTA 전 판이 깔린 기기용).
 *    이 파일이 있으면 `eas update` 가 `app.json` 을 고쳐 쓰지 못한다.
 *
 *      OTA_TARGET=eas OTA_CHANNEL=preview npx eas-cli update --branch preview --environment preview --message "…"
 */
module.exports = ({ config }) => {
  const updates = { ...config.updates };

  /* 빌드 프로필이 준 값이 있으면 그것이 이 빌드의 줄기다 */
  const channel = process.env.OTA_CHANNEL;
  if (channel) {
    updates.requestHeaders = { ...updates.requestHeaders, 'expo-channel-name': channel };
  }

  /* EAS 로 발행할 때만 — 자체 OTA 전 판이 깔린 기기를 위해 */
  if (process.env.OTA_TARGET === 'eas') {
    updates.url = 'https://u.expo.dev/' + config.extra.eas.projectId;
  }

  return { ...config, updates };
};
