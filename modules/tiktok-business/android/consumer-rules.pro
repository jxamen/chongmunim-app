# 틱톡 SDK 의 인앱 결제 자동 추적(com.tiktok.iap.billing.*)은 Play 결제 라이브러리를 compileOnly 로만 쓴다.
# SDK 의 proguard.txt 가 `-keep class com.android.billingclient.api.* { *; }` 를 거는데, 앱에 결제 라이브러리가 없으면
# R8(AGP 8 은 없는 클래스를 오류로 본다)이 「Missing class com.android.billingclient...」로 멈춘다.
# 결제 라이브러리를 일부러 넣지 않는다(BILLING 권한이 합쳐진다) — 경고만 끈다. 이미 있는 앱에는 아무 영향이 없다.
# 런타임에는 SDK 가 결제 버전을 리플렉션으로 찾다가 없으면 빈 프록시(EmptyBillingProxy)를 쓴다. 자동 추적도 모듈에서 끈다.
-dontwarn com.android.billingclient.**
