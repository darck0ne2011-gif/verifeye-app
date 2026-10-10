package app.verifeye;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;

/**
 * Foreground service that draws the VerifEye bubble over other apps and
 * captures the screen when the bubble is tapped. The capture is saved to the
 * cache and handed to MainActivity, which opens the web app on it.
 *
 * Long-press the bubble (or use the notification action) to stop.
 */
public class BubbleService extends Service {

    static final String ACTION_START = "app.verifeye.bubble.START";
    static final String ACTION_STOP = "app.verifeye.bubble.STOP";
    static final String EXTRA_RESULT_CODE = "resultCode";
    static final String EXTRA_RESULT_DATA = "resultData";

    private static final String CHANNEL_ID = "verifeye_bubble";
    private static final int NOTIFICATION_ID = 4121;
    private static final int BUBBLE_DP = 56;
    private static final long LONG_PRESS_MS = 600;
    private static final int TAP_SLOP_PX = 12;

    private static volatile boolean running = false;

    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams bubbleParams;
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int screenWidth;
    private int screenHeight;
    private int screenDensity;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean capturing = false;

    static boolean isRunning() {
        return running;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (running) return START_STICKY;

        startAsForeground();
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent data = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        try {
            projection = mpm.getMediaProjection(resultCode, data);
        } catch (Exception e) {
            projection = null;
        }
        if (projection == null) {
            Toast.makeText(this, "Screen capture permission is missing", Toast.LENGTH_SHORT).show();
            stopSelf();
            return START_NOT_STICKY;
        }
        projection.registerCallback(
            new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    handler.post(BubbleService.this::stopSelf);
                }
            },
            handler
        );
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        setUpCapture();
        showBubble();
        running = true;
        return START_STICKY;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (projection != null) setUpCapture();
    }

    @Override
    public void onDestroy() {
        running = false;
        hideBubble();
        releaseCapture();
        if (projection != null) {
            try {
                projection.stop();
            } catch (Exception ignored) {}
            projection = null;
        }
        super.onDestroy();
    }

    // --- foreground notification ------------------------------------------------

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "VerifEye bubble", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while the VerifEye bubble is active");
            nm.createNotificationChannel(channel);
        }
        Intent stop = new Intent(this, BubbleService.class).setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(
            this,
            1,
            stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        Notification notification = builder
            .setContentTitle("VerifEye bubble is on")
            .setContentText("Tap the bubble to check what is on screen")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "Stop", stopIntent).build())
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    // --- screen capture ---------------------------------------------------------

    private void setUpCapture() {
        releaseCapture();
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        screenWidth = metrics.widthPixels;
        screenHeight = metrics.heightPixels;
        screenDensity = metrics.densityDpi;
        imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2);
        virtualDisplay = projection.createVirtualDisplay(
            "verifeye-capture",
            screenWidth,
            screenHeight,
            screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null,
            handler
        );
    }

    private void releaseCapture() {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
    }

    private void captureScreen() {
        if (capturing || imageReader == null) return;
        capturing = true;
        // Hide the bubble so it is not part of the screenshot, then wait for a fresh frame.
        if (bubble != null) bubble.setVisibility(View.INVISIBLE);
        handler.postDelayed(() -> grabFrame(0), 250);
    }

    private void grabFrame(int attempt) {
        Image image = imageReader != null ? imageReader.acquireLatestImage() : null;
        if (image == null) {
            if (attempt < 6) {
                handler.postDelayed(() -> grabFrame(attempt + 1), 120);
            } else {
                finishCapture(null);
            }
            return;
        }
        File out = null;
        try {
            Image.Plane plane = image.getPlanes()[0];
            ByteBuffer buffer = plane.getBuffer();
            int pixelStride = plane.getPixelStride();
            int rowStride = plane.getRowStride();
            int rowPadding = rowStride - pixelStride * screenWidth;
            Bitmap bitmap = Bitmap.createBitmap(screenWidth + rowPadding / pixelStride, screenHeight, Bitmap.Config.ARGB_8888);
            bitmap.copyPixelsFromBuffer(buffer);
            Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, screenWidth, screenHeight);
            File dir = new File(getCacheDir(), "captures");
            if (!dir.exists()) dir.mkdirs();
            out = new File(dir, "screen-" + System.currentTimeMillis() + ".jpg");
            try (FileOutputStream fos = new FileOutputStream(out)) {
                cropped.compress(Bitmap.CompressFormat.JPEG, 92, fos);
            }
            if (cropped != bitmap) cropped.recycle();
            bitmap.recycle();
        } catch (Exception e) {
            out = null;
        } finally {
            image.close();
        }
        finishCapture(out);
    }

    private void finishCapture(File file) {
        capturing = false;
        if (bubble != null) bubble.setVisibility(View.VISIBLE);
        if (file == null) {
            Toast.makeText(this, "Could not capture the screen", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setAction(Intent.ACTION_MAIN);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(VerifEyeNativePlugin.EXTRA_CAPTURE_PATH, file.getAbsolutePath());
        startActivity(open);
    }

    // --- bubble view ------------------------------------------------------------

    private void showBubble() {
        if (bubble != null) return;
        int size = (int) (BUBBLE_DP * getResources().getDisplayMetrics().density);
        ImageView view = new ImageView(this);
        view.setImageResource(R.mipmap.ic_launcher);
        view.setScaleType(ImageView.ScaleType.FIT_CENTER);
        view.setElevation(12f);
        view.setContentDescription("VerifEye bubble");

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        bubbleParams = new WindowManager.LayoutParams(
            size,
            size,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = screenWidth - size - (int) (12 * getResources().getDisplayMetrics().density);
        bubbleParams.y = screenHeight / 3;

        view.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private long downTime;
            private boolean moved;
            private final Runnable longPress = () -> {
                if (!moved) {
                    Toast.makeText(BubbleService.this, "VerifEye bubble stopped", Toast.LENGTH_SHORT).show();
                    stopSelf();
                }
            };

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = event.getRawX();
                        downY = event.getRawY();
                        startX = bubbleParams.x;
                        startY = bubbleParams.y;
                        downTime = System.currentTimeMillis();
                        moved = false;
                        handler.postDelayed(longPress, LONG_PRESS_MS);
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        int dx = (int) (event.getRawX() - downX);
                        int dy = (int) (event.getRawY() - downY);
                        if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) {
                            moved = true;
                            handler.removeCallbacks(longPress);
                        }
                        bubbleParams.x = Math.max(0, Math.min(screenWidth - size, startX + dx));
                        bubbleParams.y = Math.max(0, Math.min(screenHeight - size, startY + dy));
                        windowManager.updateViewLayout(v, bubbleParams);
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        handler.removeCallbacks(longPress);
                        if (!moved && System.currentTimeMillis() - downTime < LONG_PRESS_MS) {
                            captureScreen();
                        } else if (moved) {
                            // Snap to the nearest edge.
                            bubbleParams.x = bubbleParams.x + size / 2 < screenWidth / 2 ? 0 : screenWidth - size;
                            windowManager.updateViewLayout(v, bubbleParams);
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        windowManager.addView(view, bubbleParams);
        bubble = view;
    }

    private void hideBubble() {
        if (bubble != null && windowManager != null) {
            try {
                windowManager.removeView(bubble);
            } catch (Exception ignored) {}
            bubble = null;
        }
    }
}
