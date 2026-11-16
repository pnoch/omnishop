package expo.modules.omnishopforegroundservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OmniShopForegroundServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OmniShopForegroundService")

    AsyncFunction("start") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val intent = Intent(context, OmniShopForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      context.stopService(Intent(context, OmniShopForegroundService::class.java))
    }

    AsyncFunction("isRunning") {
      OmniShopForegroundService.isRunning
    }
  }
}
