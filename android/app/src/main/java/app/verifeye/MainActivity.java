package app.verifeye;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VerifEyeNativePlugin.class);
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
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
