// Reanimated 4 의 워클릿 플러그인은 react-native-worklets 가 제공한다(예전 이름 react-native-reanimated/plugin 아님).
// 다른 플러그인보다 **마지막**에 와야 한다. 빠지면 Skia·Reanimated 의 움직임이 에러 없이 멈춘다.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
