package com.swaggames.wizard1v1s;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebSettings;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * The game runs edge to edge with both system bars hidden.
 *
 * StatusBar.hide() from the web layer only takes the top bar; the gesture pill stayed on top of the
 * tab bar's labels. Hiding systemBars() takes both, and BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE means
 * a swipe from an edge brings them back for a moment without knocking the player out of a duel.
 *
 * Android re-shows the bars after a transient reveal and after any focus change (a dialog, an
 * interstitial, the recents switcher), so onWindowFocusChanged re-applies it.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    goImmersive();
    allowLocalHttpInDebug();
  }

  /**
   * The web layer is served from https://localhost, so a call to the development duel server on
   * http://localhost:2567 is mixed content and the WebView drops it. Debug builds allow it; release
   * builds keep the default, where the only way out is https.
   *
   * The other half of this is src/debug/res/xml/network_security_config.xml, which permits cleartext
   * to the loopback names. Both are needed: one is the WebView's rule, the other the platform's.
   */
  private void allowLocalHttpInDebug() {
    // BuildConfig is not generated for this module, and the debuggable flag says the same thing.
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) return;
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) goImmersive();
  }

  private void goImmersive() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.hide(WindowInsetsCompat.Type.systemBars());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }
}
