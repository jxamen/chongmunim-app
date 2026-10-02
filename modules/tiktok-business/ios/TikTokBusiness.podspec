# 총무님 앱 안의 로컬 Expo 모듈 — 틱톡 비즈니스 SDK(공식 CocoaPods 판)를 JS 에 잇는다.
Pod::Spec.new do |s|
  s.name           = 'TikTokBusiness'
  s.version        = '1.0.0'
  s.summary        = 'TikTok Business SDK bridge for 총무님'
  s.author         = 'jcurve'
  s.homepage       = 'https://github.com/jxamen/chongmunim-app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TikTokBusinessSDK', '1.7.2'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
