package app.verifeye;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Bridge between the web app and the Android-only features:
 * - files shared to VerifEye from other apps (share sheet)
 * - the floating bubble + screen capture (BubbleService)
 *
 * A file that arrives while the web app is not ready is kept as "pending" and
 * delivered either through getPendingFile() or the "pendingFile" event.
 */
@CapacitorPlugin(name = "VerifEyeNative")
public class VerifEyeNativePlugin extends Plugin {

    static final String EVENT_PENDING_FILE = "pendingFile";
    static final String EXTRA_CAPTURE_PATH = "verifeye.capturePath";
    private static final long MAX_READ_BYTES = 60L * 1024 * 1024;

    private static JSObject pendingFile;
    private static VerifEyeNativePlugin instance;

    @Override
    public void load() {
        instance = this;
        if (pendingFile != null) {
            notifyListeners(EVENT_PENDING_FILE, pendingFile, true);
        }
    }

    // --- Pending files (share sheet / screenshots) -------------------------

    /** Copies a shared content:// Uri into the cache and marks it pending. */
    static void setPendingUri(Context context, Uri uri, String mimeType, String source) {
        try {
            ContentResolver resolver = context.getContentResolver();
            String name = displayName(resolver, uri);
            String mime = mimeType != null ? mimeType : resolver.getType(uri);
            File dir = new File(context.getCacheDir(), "shared");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, System.currentTimeMillis() + "-" + sanitize(name));
            try (InputStream in = resolver.openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
                if (in == null) return;
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
            setPendingPath(out.getAbsolutePath(), name, mime, source);
        } catch (Exception ignored) {
            // A share we cannot read is simply dropped; the user can retry.
        }
    }

    static void setPendingPath(String path, String name, String mimeType, String source) {
        JSObject info = new JSObject();
        info.put("path", path);
        info.put("name", name);
        info.put("mimeType", mimeType);
        info.put("source", source);
        info.put("size", new File(path).length());
        pendingFile = info;
        if (instance != null) instance.notifyListeners(EVENT_PENDING_FILE, info, true);
    }

    @PluginMethod
    public void getPendingFile(PluginCall call) {
        JSObject result = pendingFile != null ? pendingFile : new JSObject();
        pendingFile = null;
        call.resolve(result);
    }

    /** Fallback when the WebView cannot fetch the file URL directly. */
    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("path is required");
            return;
        }
        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            call.reject("File not found");
            return;
        }
        if (file.length() > MAX_READ_BYTES) {
            call.reject("File too large to read through the bridge");
            return;
        }
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) file.length()];
            int off = 0;
            int n;
            while (off < bytes.length && (n = in.read(bytes, off, bytes.length - off)) > 0) off += n;
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        String path = call.getString("path");
        if (path != null) {
            File f = new File(path);
            if (f.getAbsolutePath().startsWith(getContext().getCacheDir().getAbsolutePath())) f.delete();
        }
        call.resolve();
    }

    /**
     * Saves a document produced in the web view (e.g. the PDF report) and opens
     * it with the system viewer. Blob downloads do not work inside a WebView.
     */
    @PluginMethod
    public void exportFile(PluginCall call) {
        String name = call.getString("name", "report.pdf");
        String mimeType = call.getString("mimeType", "application/pdf");
        String data = call.getString("data");
        if (data == null) {
            call.reject("data is required");
            return;
        }
        try {
            File dir = new File(getContext().getCacheDir(), "exports");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, sanitize(name));
            try (OutputStream os = new FileOutputStream(out)) {
                os.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mimeType);
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(mimeType);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(view, name);
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { share });
            try {
                getActivity().startActivity(chooser);
            } catch (Exception noViewer) {
                getActivity().startActivity(Intent.createChooser(share, name));
            }
            JSObject result = new JSObject();
            result.put("path", out.getAbsolutePath());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not export file: " + e.getMessage());
        }
    }

    // --- Floating bubble ---------------------------------------------------

    @PluginMethod
    public void hasOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void isBubbleRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", BubbleService.isRunning());
        call.resolve(result);
    }

    /** Asks for screen-capture consent, then starts the bubble service. */
    @PluginMethod
    public void startBubble(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("Overlay permission not granted", "OVERLAY_DENIED");
            return;
        }
        if (BubbleService.isRunning()) {
            JSObject result = new JSObject();
            result.put("running", true);
            call.resolve(result);
            return;
        }
        MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "onProjectionResult");
    }

    @ActivityCallback
    private void onProjectionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen capture permission denied", "CAPTURE_DENIED");
            return;
        }
        Intent service = new Intent(getContext(), BubbleService.class);
        service.setAction(BubbleService.ACTION_START);
        service.putExtra(BubbleService.EXTRA_RESULT_CODE, result.getResultCode());
        service.putExtra(BubbleService.EXTRA_RESULT_DATA, result.getData());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(service);
        } else {
            getContext().startService(service);
        }
        JSObject out = new JSObject();
        out.put("running", true);
        call.resolve(out);
    }

    @PluginMethod
    public void stopBubble(PluginCall call) {
        Intent service = new Intent(getContext(), BubbleService.class);
        service.setAction(BubbleService.ACTION_STOP);
        getContext().startService(service);
        JSObject out = new JSObject();
        out.put("running", false);
        call.resolve(out);
    }

    // --- helpers -------------------------------------------------------------

    private static String displayName(ContentResolver resolver, Uri uri) {
        String name = null;
        try (Cursor c = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {}
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        return name != null ? name : "shared";
    }

    private static String sanitize(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
