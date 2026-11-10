package com.meteor.download;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * App 内播放器：
 *  - 优先直接播放（本地 content:// 或引擎 127.0.0.1 的 Range 流）
 *  - 黑屏/解码失败时，可一键让本地引擎转码成 720p 兼容格式再播
 *  - 支持分享
 */
public class PlayerActivity extends Activity {

    private static final int C_BG = 0xFF0B0F19;
    private static final int C_SURFACE = 0xFF131B2E;
    private static final int C_TEXT = 0xFFF8FAFC;
    private static final int C_MUTED = 0xFF94A3B8;
    private static final int C_ACCENT = 0xFFFFA35C;
    private static final int C_DANGER = 0xFFF43F5E;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(2);

    private VideoView videoView;
    private TextView statusText;
    private LinearLayout errorPanel;
    private TextView errorMsg;

    private String title = "播放";
    private String uriString = "";
    private String mime = "*/*";
    private String engineId = "";
    private String engineBase = "http://127.0.0.1:8791";

    private boolean prepared = false;
    private boolean watchdogDone = false;
    private boolean compatRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(C_BG);
        w.setNavigationBarColor(C_BG);

        String t = getIntent().getStringExtra("title");
        if (t != null && !t.isEmpty()) title = t;
        uriString = getIntent().getStringExtra("uri");
        String m = getIntent().getStringExtra("mime");
        if (m != null && !m.isEmpty()) mime = m;
        String eid = getIntent().getStringExtra("engineId");
        if (eid != null) engineId = eid;
        String eb = getIntent().getStringExtra("engineBase");
        if (eb != null && eb.startsWith("http")) engineBase = eb;

        buildUi();
        if (uriString == null || uriString.isEmpty()) {
            showError("没有可播放的文件");
            return;
        }
        prepareAndPlay(uriString);
        ui.postDelayed(this::watchdog, 10000);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(C_BG);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), dp(14), dp(14), dp(10));

        TextView back = tv("‹ 返回", 15, C_TEXT);
        back.setPadding(dp(6), dp(6), dp(12), dp(6));
        back.setOnClickListener(v -> finish());
        bar.addView(back);

        TextView titleView = tv(title, 14, C_TEXT);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleView.setLayoutParams(new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(titleView);

        TextView share = tv("分享", 13, C_ACCENT);
        share.setPadding(dp(12), dp(6), dp(6), dp(6));
        share.setOnClickListener(v -> shareCurrent());
        bar.addView(share);
        root.addView(bar);

        FrameLayout area = new FrameLayout(this);
        LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        aLp.setMargins(dp(12), 0, dp(12), dp(12));
        area.setLayoutParams(aLp);
        area.setBackgroundColor(Color.BLACK);

        videoView = new VideoView(this);
        videoView.setBackgroundColor(Color.BLACK);
        area.addView(videoView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        statusText = tv("正在加载视频…", 13, C_TEXT);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(dp(16), dp(10), dp(16), dp(10));
        statusText.setBackground(round(0xCC131B2E, 10, 0xFF273449));
        FrameLayout.LayoutParams sLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        statusText.setLayoutParams(sLp);
        area.addView(statusText);

        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(18), dp(18), dp(18), dp(18));
        errorPanel.setBackground(round(0xF2131B2E, 14, 0xFF273449));
        errorPanel.setVisibility(View.GONE);
        FrameLayout.LayoutParams eLp = new FrameLayout.LayoutParams(
                dp(300), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        errorPanel.setLayoutParams(eLp);

        errorMsg = tv("", 13, C_TEXT);
        errorMsg.setGravity(Gravity.CENTER);
        errorMsg.setLineSpacing(0, 1.3f);
        errorPanel.addView(errorMsg);

        TextView compatBtn = tv("兼容转码播放 (720p)", 13, Color.BLACK);
        compatBtn.setGravity(Gravity.CENTER);
        compatBtn.setBackground(round(C_ACCENT, 10, 0));
        compatBtn.setPadding(dp(14), dp(10), dp(14), dp(10));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cLp.topMargin = dp(12);
        compatBtn.setLayoutParams(cLp);
        compatBtn.setOnClickListener(v -> requestCompat());
        errorPanel.addView(compatBtn);

        TextView sysBtn = tv("用系统播放器打开", 12, C_TEXT);
        sysBtn.setGravity(Gravity.CENTER);
        sysBtn.setBackground(round(C_SURFACE, 10, 0xFF273449));
        sysBtn.setPadding(dp(14), dp(9), dp(14), dp(9));
        LinearLayout.LayoutParams yLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        yLp.topMargin = dp(8);
        sysBtn.setLayoutParams(yLp);
        sysBtn.setOnClickListener(v -> openSystemPlayer());
        errorPanel.addView(sysBtn);

        area.addView(errorPanel);
        root.addView(area);
        setContentView(root);
        videoView.requestFocus();
    }

    /** 引擎文件先下载到 App 自己的缓存目录，再本地播放：绕开 HTTP/MediaPlayer 与 scoped storage 问题。 */
    private void prepareAndPlay(String uri) {
        if (uri == null || !uri.startsWith("http")) {
            play(uri);
            return;
        }
        final java.io.File dir = getExternalFilesDir("media");
        if (dir == null) {
            play(uri);
            return;
        }
        dir.mkdirs();
        String key = Integer.toHexString(uri.hashCode());
        final java.io.File target = new java.io.File(dir, key + ".mp4");
        if (target.exists() && target.length() > 0) {
            playLocalFile(target);
            return;
        }
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("正在准备视频…");
        pool.execute(() -> {
            HttpURLConnection conn = null;
            java.io.File tmp = new java.io.File(dir, key + ".part");
            try {
                conn = (HttpURLConnection) new URL(uri).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("Accept", "*/*");
                int code = conn.getResponseCode();
                if (code >= 400) throw new Exception("HTTP " + code);
                long total = conn.getContentLengthLong();
                InputStream is = conn.getInputStream();
                java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp);
                byte[] buf = new byte[65536];
                int n;
                long got = 0;
                long lastUpdate = 0;
                while ((n = is.read(buf)) > 0) {
                    fos.write(buf, 0, n);
                    got += n;
                    long now = System.currentTimeMillis();
                    if (now - lastUpdate > 350) {
                        lastUpdate = now;
                        final int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        final long fg = got;
                        ui.post(() -> {
                            if (!isFinishing())
                                statusText.setText(pct >= 0
                                        ? "正在准备视频… " + pct + "%"
                                        : "正在准备视频… " + (fg / 1024 / 1024) + " MB");
                        });
                    }
                }
                is.close();
                fos.close();
                if (target.exists()) target.delete();
                if (!tmp.renameTo(target)) throw new Exception("rename failed");
                ui.post(() -> playLocalFile(target));
            } catch (Exception e) {
                try {
                    if (tmp.exists()) tmp.delete();
                } catch (Exception ignored) {
                }
                final String msg = String.valueOf(e.getMessage());
                ui.post(() -> showError("准备视频失败: " + msg));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void playLocalFile(java.io.File file) {
        try {
            uriString = FileBridge.uriFor(file.getAbsolutePath()).toString();
            mime = FileBridge.mimeOf(file.getAbsolutePath());
            statusText.setText("正在加载视频…");
            play(uriString);
        } catch (Exception e) {
            showError("播放失败: " + e.getMessage());
        }
    }

    private void play(String uri) {
        prepared = false;
        watchdogDone = false;
        errorPanel.setVisibility(View.GONE);
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("正在加载视频…");
        try {
            MediaController controller = new MediaController(this);
            controller.setAnchorView(videoView);
            videoView.setMediaController(controller);
            videoView.setOnPreparedListener(mp -> {
                prepared = true;
                statusText.setVisibility(View.GONE);
                videoView.start();
            });
            videoView.setOnInfoListener((mp, what, extra) -> {
                if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) {
                    statusText.setVisibility(View.GONE);
                }
                return false;
            });
            videoView.setOnErrorListener((mp, what, extra) -> {
                showError("播放失败（解码器不支持这个视频）");
                return true;
            });
            videoView.setVideoURI(Uri.parse(uri));
        } catch (Exception e) {
            showError("播放失败: " + e.getMessage());
        }
    }

    /** 8 秒后仍无画面，提示转码。 */
    private void watchdog() {
        if (watchdogDone || isFinishing()) return;
        watchdogDone = true;
        if (!prepared) {
            showError("视频一直没有画面：分辨率/编码可能超出手机解码能力。");
        } else {
            int pos = videoView.getCurrentPosition();
            if (pos <= 0 && !videoView.isPlaying()) {
                showError("视频首帧无法显示：分辨率/编码可能不受支持。");
            }
        }
    }

    private void showError(String message) {
        if (isFinishing()) return;
        statusText.setVisibility(View.GONE);
        errorMsg.setText(message + "\n\n可以试试：让本地引擎转码为 720p 兼容格式。");
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void requestCompat() {
        if (engineId == null || engineId.isEmpty()) {
            Toast.makeText(this, "这个文件不是本地引擎下载的，无法转码；试试系统播放器", Toast.LENGTH_LONG).show();
            return;
        }
        if (compatRunning) return;
        compatRunning = true;
        errorPanel.setVisibility(View.GONE);
        statusText.setVisibility(View.VISIBLE);
        statusText.setText("正在请求引擎转码…");
        pollCompat(0);
    }

    private void pollCompat(final int attempt) {
        if (isFinishing()) return;
        if (attempt > 240) {
            compatRunning = false;
            showError("转码超时，请稍后重试");
            return;
        }
        httpGet(engineBase + "/compat?id=" + enc(engineId), new Callback() {
            @Override
            public void onResult(boolean ok, JSONObject data, String err) {
                if (!ok || data == null) {
                    compatRunning = false;
                    showError("转码失败: " + err);
                    return;
                }
                String status = data.optString("status", "");
                if ("done".equals(status)) {
                    String path = data.optString("path", "");
                    compatRunning = false;
                    statusText.setText("转码完成，正在加载…");
                    mime = "video/mp4";
                    prepareAndPlay(engineBase + "/play?p=" + enc(path));
                    return;
                }
                if ("error".equals(status)) {
                    compatRunning = false;
                    showError("转码失败，可能是文件已损坏");
                    return;
                }
                statusText.setText("正在转码 720p 兼容格式…（大文件需要一会儿）");
                ui.postDelayed(() -> pollCompat(attempt + 1), 2500);
            }
        });
    }

    private void openSystemPlayer() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri target = Uri.parse(uriString);
            if (target.getScheme() != null && target.getScheme().startsWith("http")) {
                Toast.makeText(this, "请先等待视频缓存完成再打开系统播放器", Toast.LENGTH_LONG).show();
                return;
            }
            intent.setDataAndType(target, mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "没有可用的系统播放器", Toast.LENGTH_SHORT).show();
        }
    }

    private interface Callback {
        void onResult(boolean ok, JSONObject data, String error);
    }

    private void httpGet(final String url, final Callback cb) {
        pool.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(10000);
                conn.setRequestProperty("Accept", "application/json");
                int code = conn.getResponseCode();
                InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String text = "";
                if (is != null) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                    is.close();
                    text = bos.toString("UTF-8");
                }
                JSONObject data = new JSONObject(text.isEmpty() ? "{}" : text);
                final JSONObject f = data;
                ui.post(() -> cb.onResult(true, f, ""));
            } catch (Exception e) {
                final String msg = String.valueOf(e.getMessage());
                ui.post(() -> cb.onResult(false, null, msg));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    private void shareCurrent() {
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.putExtra(Intent.EXTRA_TEXT, title);
            if (uriString.startsWith("content://")) {
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, Uri.parse(uriString));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, title + "\n" + uriString);
            }
            startActivity(Intent.createChooser(send, "分享"));
        } catch (Exception e) {
            Toast.makeText(this, "分享失败", Toast.LENGTH_SHORT).show();
        }
    }

    private TextView tv(String text, float sp, int color) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setIncludeFontPadding(false);
        return v;
    }

    private GradientDrawable round(int fill, float radiusDp, int stroke) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radiusDp));
        if (stroke != 0) d.setStroke(dp(1), stroke);
        return d;
    }

    private int dp(float v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            if (videoView != null && videoView.isPlaying()) videoView.pause();
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        try {
            pool.shutdownNow();
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }
}
