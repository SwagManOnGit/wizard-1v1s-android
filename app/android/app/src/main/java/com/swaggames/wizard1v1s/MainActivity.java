package com.swaggames.wizard1v1s;

import android.os.Bundle;

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
