package app.verifeye;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VerifEyeNativePlugin.class);
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
        handleIntent(getIntent());
    }

    /**
     * Android 15+ draws the app edge to edge, so the web view would sit under
     * the status bar and the gesture bar. Keep the web content between them and
     * paint the bars' area in the app background.
     */
    private void applySystemBarInsets() {
        final int background = Color.parseColor("#0b1220");
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(background));
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
        View content = findViewById(android.R.id.content);
        content.setBackgroundColor(background);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** Files shared from other apps and screenshots taken by the bubble arrive here. */
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Uri uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) {
                VerifEyeNativePlugin.setPendingUri(this, uri, intent.getType(), "file");
            }
            intent.removeExtra(Intent.EXTRA_STREAM);
        } else if (intent.hasExtra(VerifEyeNativePlugin.EXTRA_CAPTURE_PATH)) {
            String path = intent.getStringExtra(VerifEyeNativePlugin.EXTRA_CAPTURE_PATH);
            intent.removeExtra(VerifEyeNativePlugin.EXTRA_CAPTURE_PATH);
            if (path != null) {
                VerifEyeNativePlugin.setPendingPath(path, "screenshot.jpg", "image/jpeg", "screenshot");
            }
        }
    }
}
