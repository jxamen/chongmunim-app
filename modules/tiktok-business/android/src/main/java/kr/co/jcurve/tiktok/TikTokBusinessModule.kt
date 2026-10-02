package kr.co.jcurve.tiktok

import com.tiktok.TikTokBusinessSdk
import com.tiktok.appevents.base.EventName
import com.tiktok.appevents.base.TTBaseEvent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 틱톡 비즈니스 SDK 를 JS 에 잇는 얇은 다리 — 판단은 전부 JS(`src/tiktok.ts`)에서 한다.
 *
 * 인앱 결제 자동 추적은 끈다(`disableAutoIapTrack`) — 결제 전환은 보내지 않는다.
 * SDK 는 결제 라이브러리를 compileOnly 로만 두고, 없으면 빈 프록시로 넘어간다(`consumer-rules.pro` 참고).
 * 광고 ID(GAID)는 SDK 가 스스로 읽는다 — 사용자가 「광고 ID 삭제/맞춤 광고 끄기」를 했으면 Play 서비스가 빈 값을 준다.
 */
class TikTokBusinessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TikTokBusiness")

    // 처음 한 번만 된다. 디버그면 테스트 이벤트 코드를 돌려준다(이벤트 관리자 › 테스트 이벤트에 넣는 값).
    AsyncFunction("initialize") { accessToken: String, appId: String, tiktokAppId: String, debug: Boolean, promise: Promise ->
      if (TikTokBusinessSdk.isInitialized()) {
        promise.resolve(TikTokBusinessSdk.getTestEventCode())
        return@AsyncFunction
      }
      val context = appContext.reactContext?.applicationContext
      if (context == null) {
        promise.reject("E_TIKTOK_CONTEXT", "앱 컨텍스트가 없어요", null)
        return@AsyncFunction
      }
      val config = TikTokBusinessSdk.TTConfig(context, accessToken)
        .setAppId(appId)
        .setTTAppId(tiktokAppId)
        .disableAutoIapTrack()
      if (debug) {
        config.openDebugMode().setLogLevel(TikTokBusinessSdk.LogLevel.DEBUG)
      }
      TikTokBusinessSdk.initializeSdk(config, object : TikTokBusinessSdk.TTInitCallback {
        override fun success() {
          promise.resolve(TikTokBusinessSdk.getTestEventCode())
        }

        override fun fail(code: Int, msg: String?) {
          promise.reject("E_TIKTOK_INIT", "$code $msg", null)
        }
      })
    }.runOnQueue(Queues.MAIN) // SDK 가 켤 때 앱 생명주기 관찰자를 단다 — androidx lifecycle 은 메인 스레드에서만 받는다

    // 표준 이벤트는 플랫폼마다 글자가 달라서(iOS InAppADImpr · 안드 InAppAdImpr) 짧은 이름으로 받아 여기서 고른다.
    Function("trackStandard") { key: String ->
      val name = when (key) {
        "ad_impression" -> EventName.IN_APP_AD_IMPR
        "registration" -> EventName.REGISTRATION
        "login" -> EventName.LOGIN
        else -> null
      }
      if (name != null && TikTokBusinessSdk.isInitialized()) {
        TikTokBusinessSdk.trackTTEvent(name)
      }
    }

    Function("trackCustom") { name: String, properties: Map<String, Any?>? ->
      if (TikTokBusinessSdk.isInitialized()) {
        val builder = TTBaseEvent.newBuilder(name)
        properties?.forEach { (k, v) -> if (v != null) builder.addProperty(k, v) }
        TikTokBusinessSdk.trackTTEvent(builder.build())
      }
    }

    // 함수 몸통에서 return@Function 을 쓰지 않는다 — 인자 없는 Function 은 반환형이 Any? 로 잡혀 컴파일이 깨진다
    Function("identify") { externalId: String, userName: String?, phone: String?, email: String? ->
      if (TikTokBusinessSdk.isInitialized()) {
        TikTokBusinessSdk.identify(externalId, userName, phone, email)
      }
    }

    Function("logout") {
      if (TikTokBusinessSdk.isInitialized()) {
        TikTokBusinessSdk.logout()
      }
    }

    Function("updateAccessToken") { accessToken: String ->
      if (TikTokBusinessSdk.isInitialized()) {
        TikTokBusinessSdk.updateAccessToken(accessToken)
      }
    }
  }
}
