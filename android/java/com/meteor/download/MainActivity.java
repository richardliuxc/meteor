package com.meteor.download;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Meteor · 流星下载
 * 纯原生 Android UI（不使用 WebView），保证所有点击/输入框可用。
 *  - 直连文件：系统 DownloadManager
 *  - YouTube 等：调用本机 127.0.0.1:8791 的 yt-dlp 引擎
 */
public class MainActivity extends Activity {

    private static final int C_BG = 0xFF0B0F19;
    private static final int C_SURFACE = 0xFF131B2E;
    private static final int C_SURFACE2 = 0xFF1A2337;
    private static final int C_BORDER = 0xFF273449;
    private static final int C_TEXT = 0xFFF8FAFC;
    private static final int C_MUTED = 0xFF94A3B8;
    private static final int C_FAINT = 0xFF64748B;
    private static final int C_ACCENT = 0xFFFF7D38;
    private static final int C_ACCENT2 = 0xFFFFA35C;
    private static final int C_SUCCESS = 0xFF10B981;
    private static final int C_DANGER = 0xFFF43F5E;
    private static final int C_INFO = 0xFF38BDF8;
    private static final String DEFAULT_ENGINE = "http://127.0.0.1:8791";
    private static final String PREFS = "meteor";

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    private FrameLayout content;
    private ScrollView homePage, downloadsPage, settingsPage;
    private LinearLayout downloadList;
    private TextView engineStatus;
    private TextView homeStatus;
    private LinearLayout previewCard;
    private ImageView previewThumb;
    private TextView previewTitle, previewMeta, previewNote;
    private Spinner previewQuality;
    private TextView previewDownloadBtn;
    private EditText urlInput;
    private TextView settingsEngineStatus;
    private EditText engineUrlInput;

    private int currentTab = 0;
    private final TextView[] navItems = new TextView[3];
    private final ImageView[] navIcons = new ImageView[3];

    private String engineBase = DEFAULT_ENGINE;
    private boolean engineOnline = false;
    private String lastProbeUrl = "";
    private String lastProbeMode = ""; // direct | engine
    private String lastDirectName = "";
    private long lastDirectSize = 0;
    private JSONArray lastHeights = new JSONArray();
    private boolean analyzing = false;

    private final List<Item> items = new ArrayList<>();
    private final Map<String, View> itemViews = new HashMap<>();
    private final Map<String, String> thumbCache = new HashMap<>();

    private static final Pattern URL_RE = Pattern.compile("https?://[^\\s]+");

    static class Item {
        String id;
        String url;
        String title = "";
        String filename = "";
        String path = "";
        String source = "";
        String uploader = "";
        String extractor = "";
        String status = "queued"; // queued|active|paused|done|error|canceled
        String platform = "direct";
        String quality = "best";
        String error = "";
        boolean engine = false;
        long nativeId = 0;
        long size = 0;
        long received = 0;
        double speed = 0;
        long eta = 0;
        String thumb = "";
        long finishedAt = 0;
        long createdAt = System.currentTimeMillis();
    }

    /* ============================================================
     * 生命周期
     * ========================================================== */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installCrashLog();
        Window w = getWindow();
        w.setStatusBarColor(C_BG);
        w.setNavigationBarColor(C_BG);

        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        engineBase = sp.getString("engine", DEFAULT_ENGINE);

        try {
            buildUi();
        } catch (Throwable t) {
            showEmergencyUi(t);
            return;
        }
        requestPermissions();
        checkEngine();
        handleIntent(getIntent());

        ui.postDelayed(tick, 1000);
        ui.postDelayed(engineTick, 2500);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String text = null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            text = intent.getStringExtra(Intent.EXTRA_TEXT);
        } else if (intent.getDataString() != null) {
            text = intent.getDataString();
        }
        if (text == null) return;
        Matcher m = URL_RE.matcher(text);
        if (!m.find()) return;
        final String url = m.group();
        urlInput.setText(url);
        urlInput.setSelection(url.length());
        ui.postDelayed(() -> analyze(url), 350);
    }

    /* ============================================================
     * UI 构建
     * ========================================================== */
    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(C_BG);
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        root.addView(buildHeader());

        content = new FrameLayout(this);
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        content.setLayoutParams(cLp);
        root.addView(content);

        homePage = buildHome();
        downloadsPage = buildDownloads();
        settingsPage = buildSettings();
        content.addView(homePage);
        content.addView(downloadsPage);
        content.addView(settingsPage);

        root.addView(buildBottomNav());
        setContentView(root);
        switchTab(0);
    }

    private View buildHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(18), dp(16), dp(18), dp(10));
        header.setBackgroundColor(C_BG);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(dp(38), dp(38));
        logoLp.rightMargin = dp(11);
        logo.setLayoutParams(logoLp);
        header.addView(logo);

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        TextView name = text("Meteor", 19, C_TEXT, true);
        TextView sub = text("流星下载 · 本地引擎", 11, C_MUTED, false);
        titles.addView(name);
        titles.addView(sub);
        header.addView(titles);

        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1f));
        header.addView(spacer);

        engineStatus = text("● 引擎检测中", 11, C_MUTED, true);
        engineStatus.setPadding(dp(10), dp(6), dp(10), dp(6));
        engineStatus.setBackground(round(C_SURFACE, 999, C_BORDER, 1));
        engineStatus.setOnClickListener(v -> showEngineDialog());
        header.addView(engineStatus);
        return header;
    }

    private ScrollView buildHome() {
        ScrollView page = new ScrollView(this);
        page.setFillViewport(true);
        page.setBackgroundColor(C_BG);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(12), dp(18), dp(30));
        page.addView(box);

        TextView kicker = text("单文件 · 零后端 · 本地优先", 11, C_ACCENT2, true);
        kicker.setLetterSpacing(0.06f);
        box.addView(kicker);

        TextView title = text("粘贴链接，拿到文件。", 26, C_TEXT, true);
        title.setPadding(0, dp(8), 0, 0);
        box.addView(title);

        TextView sub = text("直链走系统下载管理器；YouTube 等平台交给本地 yt-dlp 引擎。", 12, C_MUTED, false);
        sub.setPadding(0, dp(6), 0, dp(16));
        sub.setLineSpacing(0, 1.3f);
        box.addView(sub);

        LinearLayout inputCard = card();
        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);

        urlInput = new EditText(this);
        urlInput.setHint("粘贴链接、直链…");
        urlInput.setHintTextColor(C_FAINT);
        urlInput.setTextColor(C_TEXT);
        urlInput.setTextSize(14);
        urlInput.setSingleLine(true);
        urlInput.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setBackground(null);
        urlInput.setPadding(0, dp(8), 0, dp(8));
        LinearLayout.LayoutParams inputLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        urlInput.setLayoutParams(inputLp);
        inputRow.addView(urlInput);

        TextView pasteBtn = text("粘贴", 12, C_ACCENT2, true);
        pasteBtn.setPadding(dp(10), dp(8), dp(4), dp(8));
        pasteBtn.setOnClickListener(v -> pasteFromClipboard());
        inputRow.addView(pasteBtn);
        inputCard.addView(inputRow);

        TextView analyzeBtn = button("解析链接", C_ACCENT, 0xFF1A0D05);
        LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(44));
        aLp.topMargin = dp(10);
        analyzeBtn.setLayoutParams(aLp);
        analyzeBtn.setOnClickListener(v -> analyze(urlInput.getText().toString().trim()));
        inputCard.addView(analyzeBtn);
        box.addView(inputCard);

        LinearLayout samples = new LinearLayout(this);
        samples.setOrientation(LinearLayout.HORIZONTAL);
        samples.setPadding(0, dp(12), 0, dp(4));
        samples.addView(sampleChip("示例视频", () -> fillAndAnalyze(
                "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4")));
        samples.addView(sampleChip("示例图片", () -> fillAndAnalyze(
                "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png")));
        samples.addView(sampleChip("YouTube", () -> fillAndAnalyze(
                "https://www.youtube.com/watch?v=jNQXAC9IVRw")));
        box.addView(samples);

        homeStatus = text("", 12, C_MUTED, false);
        homeStatus.setPadding(0, dp(10), 0, 0);
        box.addView(homeStatus);

        previewCard = card();
        previewCard.setVisibility(View.GONE);
        LinearLayout.LayoutParams pLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pLp.topMargin = dp(14);
        previewCard.setLayoutParams(pLp);

        previewThumb = new ImageView(this);
        previewThumb.setScaleType(ImageView.ScaleType.CENTER_CROP);
        previewThumb.setBackground(round(C_SURFACE2, 12, C_BORDER, 1));
        LinearLayout.LayoutParams tLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(150));
        previewThumb.setLayoutParams(tLp);
        previewCard.addView(previewThumb);

        previewTitle = text("", 15, C_TEXT, true);
        previewTitle.setPadding(0, dp(10), 0, 0);
        previewCard.addView(previewTitle);

        previewMeta = text("", 11, C_MUTED, false);
        previewMeta.setPadding(0, dp(4), 0, 0);
        previewCard.addView(previewMeta);

        previewQuality = new Spinner(this);
        LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(42));
        sLp.topMargin = dp(10);
        previewQuality.setLayoutParams(sLp);
        previewQuality.setBackground(round(C_SURFACE2, 10, C_BORDER, 1));
        previewCard.addView(previewQuality);

        previewDownloadBtn = button("开始下载", C_ACCENT, 0xFF1A0D05);
        LinearLayout.LayoutParams dLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(44));
        dLp.topMargin = dp(10);
        previewDownloadBtn.setLayoutParams(dLp);
        previewDownloadBtn.setOnClickListener(v -> startPreviewDownload());
        previewCard.addView(previewDownloadBtn);

        previewNote = text("", 11, C_FAINT, false);
        previewNote.setPadding(0, dp(8), 0, 0);
        previewNote.setLineSpacing(0, 1.3f);
        previewCard.addView(previewNote);
        box.addView(previewCard);

        TextView foot = text("仅下载你有权保存的内容。不绕过 DRM、不破解付费墙。", 10, C_FAINT, false);
        foot.setPadding(0, dp(22), 0, 0);
        box.addView(foot);

        return page;
    }

    private ScrollView buildDownloads() {
        ScrollView page = new ScrollView(this);
        page.setFillViewport(true);
        page.setBackgroundColor(C_BG);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(14), dp(18), dp(30));
        page.addView(box);

        TextView title = text("下载", 22, C_TEXT, true);
        box.addView(title);
        TextView sub = text("系统下载管理器 + 本地引擎任务", 11, C_MUTED, false);
        sub.setPadding(0, dp(4), 0, dp(12));
        box.addView(sub);

        downloadList = new LinearLayout(this);
        downloadList.setOrientation(LinearLayout.VERTICAL);
        box.addView(downloadList);

        TextView empty = text("队列是空的，去首页粘贴一个链接吧。", 12, C_FAINT, false);
        empty.setPadding(0, dp(30), 0, 0);
        empty.setGravity(Gravity.CENTER_HORIZONTAL);
        box.addView(empty);
        downloadList.setTag(empty);

        return page;
    }

    private ScrollView buildSettings() {
        ScrollView page = new ScrollView(this);
        page.setFillViewport(true);
        page.setBackgroundColor(C_BG);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(14), dp(18), dp(30));
        page.addView(box);

        box.addView(text("设置", 22, C_TEXT, true));

        LinearLayout engineCard = card();
        LinearLayout.LayoutParams eLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        eLp.topMargin = dp(14);
        engineCard.setLayoutParams(eLp);
        engineCard.addView(text("本地引擎（yt-dlp）", 14, C_TEXT, true));
        settingsEngineStatus = text("检测中…", 11, C_MUTED, false);
        settingsEngineStatus.setPadding(0, dp(6), 0, 0);
        engineCard.addView(settingsEngineStatus);

        engineUrlInput = new EditText(this);
        engineUrlInput.setText(engineBase);
        engineUrlInput.setTextColor(C_TEXT);
        engineUrlInput.setTextSize(12);
        engineUrlInput.setSingleLine(true);
        engineUrlInput.setBackground(round(C_SURFACE2, 10, C_BORDER, 1));
        engineUrlInput.setPadding(dp(12), dp(9), dp(12), dp(9));
        LinearLayout.LayoutParams uLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(42));
        uLp.topMargin = dp(10);
        engineUrlInput.setLayoutParams(uLp);
        engineCard.addView(engineUrlInput);

        LinearLayout eBtns = new LinearLayout(this);
        eBtns.setOrientation(LinearLayout.HORIZONTAL);
        eBtns.setPadding(0, dp(10), 0, 0);
        TextView check = button("检测", C_SURFACE2, C_TEXT);
        check.setOnClickListener(v -> {
            engineBase = engineUrlInput.getText().toString().trim();
            if (!engineBase.startsWith("http")) {
                toast("地址无效");
                return;
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("engine", engineBase).apply();
            engineOnline = false;
            checkEngine();
        });
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(0, dp(40), 1f);
        cLp.rightMargin = dp(8);
        check.setLayoutParams(cLp);
        eBtns.addView(check);

        TextView help = button("启动方法", C_SURFACE2, C_TEXT);
        help.setOnClickListener(v -> showEngineDialog());
        LinearLayout.LayoutParams hLp = new LinearLayout.LayoutParams(0, dp(40), 1f);
        help.setLayoutParams(hLp);
        eBtns.addView(help);
        engineCard.addView(eBtns);

        TextView engineHint = text("引擎运行在 DSH Go 的 Ubuntu 本地环境，只监听 127.0.0.1。启动：server/start-engine.sh", 10, C_FAINT, false);
        engineHint.setPadding(0, dp(10), 0, 0);
        engineHint.setLineSpacing(0, 1.3f);
        engineCard.addView(engineHint);
        box.addView(engineCard);

        LinearLayout folderCard = card();
        LinearLayout.LayoutParams fLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        fLp.topMargin = dp(12);
        folderCard.setLayoutParams(fLp);
        folderCard.addView(text("下载目录", 14, C_TEXT, true));
        TextView path = text("直链：系统「下载」目录\n本地引擎：下载/DSH-Go/Meteor", 11, C_MUTED, false);
        path.setPadding(0, dp(6), 0, 0);
        path.setLineSpacing(0, 1.3f);
        folderCard.addView(path);
        TextView openFolder = button("打开系统下载目录", C_SURFACE2, C_TEXT);
        LinearLayout.LayoutParams oLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(40));
        oLp.topMargin = dp(10);
        openFolder.setLayoutParams(oLp);
        openFolder.setOnClickListener(v -> openDownloadsFolder());
        folderCard.addView(openFolder);
        box.addView(folderCard);

        LinearLayout aboutCard = card();
        LinearLayout.LayoutParams aLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        aLp.topMargin = dp(12);
        aboutCard.setLayoutParams(aLp);
        aboutCard.addView(text("关于", 14, C_TEXT, true));
        TextView about = text("Meteor 1.4.0 · 流星下载\n纯原生界面，无 WebView、无后端、无账号。\n数据只保存在本机。\n\n基于 OpenSelena/omniget 的界面与理念重制（GPL-3.0）。", 11, C_MUTED, false);
        about.setPadding(0, dp(6), 0, 0);
        about.setLineSpacing(0, 1.35f);
        aboutCard.addView(about);
        box.addView(aboutCard);

        return page;
    }

    private View buildBottomNav() {
        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setBackgroundColor(C_SURFACE);
        nav.setPadding(dp(10), dp(4), dp(10), dp(6));
        nav.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        String[] labels = {"首页", "下载", "设置"};
        for (int i = 0; i < 3; i++) {
            final int index = i;
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.HORIZONTAL);
            item.setGravity(Gravity.CENTER);
            item.setPadding(dp(6), dp(8), dp(6), dp(8));
            item.setBackground(round(Color.TRANSPARENT, 12, Color.TRANSPARENT, 0));
            LinearLayout.LayoutParams iLp = new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            item.setLayoutParams(iLp);

            ImageView ic = new ImageView(this);
            ic.setImageResource(i == 0 ? R.drawable.ic_home : i == 1 ? R.drawable.ic_download : R.drawable.ic_settings);
            LinearLayout.LayoutParams icLp = new LinearLayout.LayoutParams(dp(18), dp(18));
            icLp.rightMargin = dp(5);
            ic.setLayoutParams(icLp);
            ic.setColorFilter(C_FAINT);
            item.addView(ic);

            TextView label = text(labels[i], 11, C_FAINT, true);
            item.addView(label);

            item.setOnClickListener(v -> switchTab(index));
            navItems[i] = label;
            navIcons[i] = ic;
            nav.addView(item);
        }
        return nav;
    }

    private void switchTab(int tab) {
        currentTab = tab;
        homePage.setVisibility(tab == 0 ? View.VISIBLE : View.GONE);
        downloadsPage.setVisibility(tab == 1 ? View.VISIBLE : View.GONE);
        settingsPage.setVisibility(tab == 2 ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 3; i++) {
            navItems[i].setTextColor(i == tab ? C_ACCENT2 : C_FAINT);
            if (navIcons[i] != null) navIcons[i].setColorFilter(i == tab ? C_ACCENT : C_FAINT);
        }
        if (tab == 1) refreshDownloads(true);
        if (tab == 2) updateSettingsStatus();
        hideKeyboard();
    }

    /* ============================================================
     * 交互：粘贴 / 解析 / 下载
     * ========================================================== */
    private void pasteFromClipboard() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null
                    && cm.getPrimaryClip().getItemCount() > 0) {
                CharSequence text = cm.getPrimaryClip().getItemAt(0).coerceToText(this);
                if (text != null && text.length() > 0) {
                    urlInput.setText(text.toString().trim());
                    urlInput.setSelection(urlInput.getText().length());
                    return;
                }
            }
        } catch (Exception ignored) {
        }
        toast("剪贴板为空");
    }

    private void fillAndAnalyze(String url) {
        urlInput.setText(url);
        urlInput.setSelection(url.length());
        analyze(url);
    }

    private void analyze(final String url) {
        if (analyzing) return;
        if (url == null || !url.startsWith("http")) {
            toast("请输入 http/https 链接");
            return;
        }
        analyzing = true;
        lastProbeUrl = url;
        lastProbeMode = "";
        previewCard.setVisibility(View.VISIBLE);
        previewThumb.setImageDrawable(null);
        previewThumb.setBackground(round(C_SURFACE2, 12, C_BORDER, 1));
        previewTitle.setText("正在解析…");
        previewMeta.setText(url);
        previewNote.setText("");
        previewQuality.setVisibility(View.GONE);
        previewDownloadBtn.setEnabled(false);
        homeStatus.setText("");
        hideKeyboard();

        probeDirect(url, (ok, data, err) -> {
            if (ok) {
                analyzing = false;
                showDirectPreview(url, data);
                return;
            }
            if (engineOnline) {
                engineInfo(url, (ok2, info, err2) -> {
                    analyzing = false;
                    if (ok2) showEnginePreview(url, info);
                    else showUnsupported(url, err2);
                });
            } else {
                analyzing = false;
                showUnsupported(url, "该地址不是可直连文件；本地引擎未连接，无法解析平台视频。");
            }
        });
    }

    private void showDirectPreview(String url, JSONObject data) {
        lastProbeMode = "direct";
        lastDirectName = data.optString("filename", "");
        lastDirectSize = data.optLong("size", 0);
        previewThumb.setVisibility(View.GONE);
        previewQuality.setVisibility(View.GONE);
        previewTitle.setText(lastDirectName.isEmpty() ? url : lastDirectName);
        String type = data.optString("contentType", "");
        StringBuilder meta = new StringBuilder();
        meta.append("直连文件");
        if (lastDirectSize > 0) meta.append(" · ").append(fmtSize(lastDirectSize));
        if (!type.isEmpty()) meta.append(" · ").append(type);
        previewMeta.setText(meta.toString());
        previewNote.setText("由系统下载管理器保存到「下载」目录，大文件不进内存。");
        previewDownloadBtn.setEnabled(true);
        previewDownloadBtn.setText("开始下载");
    }

    private void showEnginePreview(String url, JSONObject info) {
        lastProbeMode = "engine";
        previewThumb.setVisibility(View.VISIBLE);
        previewTitle.setText(info.optString("title", "未命名"));
        String uploader = info.optString("uploader", "");
        long duration = info.optLong("duration", 0);
        StringBuilder meta = new StringBuilder("本地引擎");
        if (!uploader.isEmpty()) meta.append(" · ").append(uploader);
        if (duration > 0) meta.append(" · ").append(fmtDuration(duration));
        previewMeta.setText(meta.toString());

        lastHeights = info.optJSONArray("heights");
        List<String> options = new ArrayList<>();
        options.add("最佳画质");
        if (lastHeights != null) {
            for (int i = 0; i < lastHeights.length(); i++) {
                int h = lastHeights.optInt(i);
                if (h > 0 && h <= 1080) options.add(h + "p");
            }
        }
        options.add("仅音频 (MP3)");
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, options);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        previewQuality.setAdapter(adapter);
        previewQuality.setVisibility(View.VISIBLE);

        previewNote.setText("由本地 yt-dlp 下载并合并（1080p 以内，避免手机解码黑屏），保存到「下载/DSH-Go/Meteor」。");
        previewDownloadBtn.setEnabled(true);
        previewDownloadBtn.setText("用本地引擎下载");

        String thumb = info.optString("thumbnail", "");
        if (!thumb.isEmpty()) loadThumb(thumb);
        else previewThumb.setVisibility(View.GONE);
    }

    private void showUnsupported(String url, String reason) {
        lastProbeMode = "";
        previewThumb.setVisibility(View.GONE);
        previewTitle.setText("无法解析这个链接");
        previewMeta.setText(url);
        previewNote.setText(reason == null ? "" : reason);
        previewDownloadBtn.setEnabled(false);
        previewDownloadBtn.setText("开始下载");
        homeStatus.setText("提示：本地引擎未连接时，只能下载 http/https 直链文件。");
    }

    private void startPreviewDownload() {
        if (!"direct".equals(lastProbeMode) && !"engine".equals(lastProbeMode)) return;
        String url = lastProbeUrl;
        if ("direct".equals(lastProbeMode)) {
            startDirectDownload(url, lastDirectName, lastDirectSize);
        } else {
            String quality = "best";
            Object sel = previewQuality.getSelectedItem();
            if (sel != null) {
                String s = sel.toString();
                if (s.endsWith("p")) quality = s.substring(0, s.length() - 1);
                else if (s.contains("MP3")) quality = "audio";
            }
            startEngineDownload(url, quality);
        }
        switchTab(1);
    }

    private void startDirectDownload(String url, String name, long size) {
        try {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            String title = (name == null || name.isEmpty()) ? guessName(url) : name;
            req.setTitle(title);
            req.setDescription("Meteor");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setAllowedOverMetered(true);
            req.setAllowedOverRoaming(true);
            long id = dm.enqueue(req);
            Item item = new Item();
            item.id = "dm-" + id;
            item.nativeId = id;
            item.url = url;
            item.title = title;
            item.filename = title;
            item.size = size;
            item.status = "active";
            item.platform = "direct";
            item.source = hostOf(url);
            item.createdAt = System.currentTimeMillis();
            items.add(0, item);
            saveItems();
            toast("已开始下载");
            refreshDownloads(true);
        } catch (Exception e) {
            toast("下载失败: " + e.getMessage());
        }
    }

    private void startEngineDownload(String url, String quality) {
        JSONObject body = new JSONObject();
        try {
            body.put("url", url);
            body.put("quality", quality);
        } catch (Exception ignored) {
        }
        enginePost("/download", body.toString(), (ok, data, err) -> {
            if (!ok) {
                toast("引擎下载失败: " + err);
                return;
            }
            toast("已交给本地引擎");
            engineTickNow();
        });
    }

    /* ============================================================
     * 本地引擎
     * ========================================================== */
    private void checkEngine() {
        engineGet("/health", (ok, data, err) -> {
            engineOnline = ok && data != null && data.optBoolean("ok", false);
            updateEngineStatus();
            if (engineOnline && currentTab == 1) engineTickNow();
        });
    }

    private void updateEngineStatus() {
        String txt = engineOnline ? "● 引擎在线" : "● 引擎离线";
        int color = engineOnline ? C_SUCCESS : C_DANGER;
        if (engineStatus != null) {
            engineStatus.setText(txt);
            engineStatus.setTextColor(color);
        }
        if (settingsEngineStatus != null) {
            settingsEngineStatus.setText(engineOnline
                    ? "状态：在线 · yt-dlp 可用"
                    : "状态：离线 · 请先在 DSH Go 本地环境启动引擎");
            settingsEngineStatus.setTextColor(engineOnline ? C_SUCCESS : C_DANGER);
        }
    }

    private void updateSettingsStatus() {
        updateEngineStatus();
        if (engineUrlInput != null) engineUrlInput.setText(engineBase);
    }

    private void showEngineDialog() {
        new AlertDialog.Builder(this)
                .setTitle("本地引擎")
                .setMessage("Meteor 通过 127.0.0.1:8791 调用手机本地的 yt-dlp 服务，用来下载 YouTube、B 站等平台视频。\n\n"
                        + "启动方法（在 DSH Go 的本地环境里执行）：\n"
                        + "bash /root/workspace/omniget-studio/server/start-engine.sh\n\n"
                        + "当前地址：" + engineBase + "\n"
                        + "当前状态：" + (engineOnline ? "在线" : "离线"))
                .setPositiveButton("重新检测", (d, w) -> checkEngine())
                .setNeutralButton("复制命令", (d, w) -> {
                    try {
                        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Meteor",
                                "bash /root/workspace/omniget-studio/server/start-engine.sh"));
                        toast("已复制");
                    } catch (Exception ignored) {
                    }
                })
                .setNegativeButton("关闭", null)
                .show();
    }

    private void engineTickNow() {
        if (!engineOnline) return;
        engineGet("/jobs", (ok, data, err) -> {
            if (ok && data != null) mergeJobs(data.optJSONArray("jobs"));
        });
    }

    private void mergeJobs(JSONArray jobs) {
        if (jobs == null) return;
        boolean changed = false;
        for (int i = 0; i < jobs.length(); i++) {
            JSONObject j = jobs.optJSONObject(i);
            if (j == null) continue;
            String jid = j.optString("id", "");
            if (jid.isEmpty()) continue;
            String id = "eng-" + jid;
            Item item = findItem(id);
            if (item == null) {
                item = new Item();
                item.id = id;
                item.engine = true;
                item.quality = j.optString("quality", "best");
                item.createdAt = j.optLong("startedAt", System.currentTimeMillis());
                items.add(0, item);
                changed = true;
            }
            String oldStatus = item.status;
            item.url = j.optString("url", item.url);
            item.title = j.optString("title", item.title);
            item.filename = j.optString("filename", item.filename);
            item.thumb = j.optString("thumbnail", item.thumb);
            item.path = j.optString("path", item.path);
            item.uploader = j.optString("uploader", item.uploader);
            item.extractor = j.optString("extractor", item.extractor);
            item.size = j.optLong("total", item.size);
            item.received = j.optLong("downloaded", item.received);
            item.speed = j.optDouble("speed", 0);
            item.eta = j.optLong("eta", 0);
            String st = j.optString("status", "");
            if ("downloading".equals(st) || "processing".equals(st)) item.status = "active";
            else if ("done".equals(st)) item.status = "done";
            else if ("error".equals(st)) item.status = "error";
            else if ("canceled".equals(st)) item.status = "canceled";
            else item.status = "queued";
            item.error = j.optString("error", "");
            String cleanTitle = item.title.replaceAll("\\s*\\[[^\\]]+\\]$", "").trim();
            if (!cleanTitle.isEmpty()) item.title = cleanTitle;
            if (!item.uploader.isEmpty() && !"本地文件".equals(item.uploader)) item.source = item.uploader;
            else if (!item.extractor.isEmpty() && !"已下载".equals(item.extractor)) item.source = item.extractor;
            else if (item.source.isEmpty()) item.source = "本地引擎";
            if ("done".equals(item.status) && !"done".equals(oldStatus)) {
                item.finishedAt = System.currentTimeMillis();
                toast("下载完成：" + (item.title.isEmpty() ? item.filename : item.title));
            }
            if (!item.title.isEmpty() && !thumbCache.containsKey(item.id)) loadThumbForItem(item);
            changed = true;
        }
        if (changed) refreshDownloads(true);
    }

    private void engineAssetPlay(Item item) {
        openDownloadsFolder();
    }

    /* ============================================================
     * 网络：直连探测 / 引擎请求
     * ========================================================== */
    interface Callback {
        void onResult(boolean ok, JSONObject data, String error);
    }

    private void probeDirect(final String url, final Callback cb) {
        pool.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(12000);
                conn.setRequestMethod("HEAD");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) Meteor/1.1");
                int code = conn.getResponseCode();
                long size = conn.getContentLengthLong();
                String type = conn.getContentType() == null ? "" : conn.getContentType().toLowerCase();
                String disp = conn.getHeaderField("Content-Disposition");
                if (code >= 400 || size <= 0) {
                    conn.disconnect();
                    conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(12000);
                    conn.setReadTimeout(12000);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Range", "bytes=0-4096");
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) Meteor/1.1");
                    code = conn.getResponseCode();
                    type = conn.getContentType() == null ? "" : conn.getContentType().toLowerCase();
                    String cr = conn.getHeaderField("Content-Range");
                    if (cr != null) {
                        int slash = cr.lastIndexOf('/');
                        if (slash > 0) {
                            try {
                                size = Long.parseLong(cr.substring(slash + 1).trim());
                            } catch (Exception ignored) {
                            }
                        }
                    }
                    if (size <= 0) size = conn.getContentLengthLong();
                    disp = conn.getHeaderField("Content-Disposition");
                    try (InputStream in = conn.getInputStream()) {
                        byte[] buf = new byte[2048];
                        in.read(buf);
                    } catch (Exception ignored) {
                    }
                }
                String name = parseName(disp, url);
                boolean html = type.startsWith("text/html")
                        && !name.toLowerCase().endsWith(".html") && !name.toLowerCase().endsWith(".htm");
                if (code >= 200 && code < 400 && !html) {
                    JSONObject out = new JSONObject();
                    out.put("ok", true);
                    out.put("status", code);
                    out.put("size", Math.max(0, size));
                    out.put("contentType", type);
                    out.put("filename", name);
                    out.put("finalUrl", conn.getURL().toString());
                    final JSONObject f = out;
                    ui.post(() -> cb.onResult(true, f, ""));
                } else {
                    ui.post(() -> cb.onResult(false, null, "不是可直连文件"));
                }
            } catch (Exception e) {
                ui.post(() -> cb.onResult(false, null, String.valueOf(e.getMessage())));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void engineGet(String path, Callback cb) {
        engineRequest(path, "GET", null, cb);
    }

    private void enginePost(String path, String body, Callback cb) {
        engineRequest(path, "POST", body, cb);
    }

    private void engineRequest(final String path, final String method, final String body, final Callback cb) {
        pool.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(engineBase + path).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(120000);
                conn.setRequestMethod(method);
                conn.setRequestProperty("Accept", "application/json");
                if (body != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes("UTF-8"));
                    }
                }
                int code = conn.getResponseCode();
                InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String text = "";
                if (is != null) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                    is.close();
                    text = bos.toString("UTF-8");
                }
                JSONObject data = new JSONObject(text.isEmpty() ? "{}" : text);
                if (data.optBoolean("ok", false) || code < 400) {
                    ui.post(() -> cb.onResult(true, data, ""));
                } else {
                    String err = data.optString("error", "HTTP " + code);
                    ui.post(() -> cb.onResult(false, data, err));
                }
            } catch (Exception e) {
                ui.post(() -> cb.onResult(false, null, String.valueOf(e.getMessage())));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void engineInfo(String url, Callback cb) {
        engineGet("/info?url=" + Uri.encode(url), cb);
    }

    /* ============================================================
     * 下载列表渲染 / 轮询
     * ========================================================== */
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            try {
                pollNative();
                if (currentTab == 1) refreshDownloads(false);
            } catch (Throwable ignored) {
            }
            ui.postDelayed(this, 1000);
        }
    };

    private final Runnable engineTick = new Runnable() {
        @Override
        public void run() {
            if (engineOnline && currentTab != 2) engineTickNow();
            ui.postDelayed(this, 2500);
        }
    };

    private void pollNative() {
        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        boolean changed = false;
        for (Item item : items) {
            if (item.engine || item.nativeId == 0) continue;
            Cursor c = null;
            try {
                c = dm.query(new DownloadManager.Query().setFilterById(item.nativeId));
                if (c == null || !c.moveToFirst()) continue;
                int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                long sofar = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                String title = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE));
                if (total > 0) item.size = total;
                item.received = sofar;
                if (title != null && !title.isEmpty()) item.title = title;
                if (st == DownloadManager.STATUS_SUCCESSFUL) {
                    if (!"done".equals(item.status)) {
                        item.status = "done";
                        item.finishedAt = System.currentTimeMillis();
                        toast("下载完成：" + item.title);
                        changed = true;
                    }
                } else if (st == DownloadManager.STATUS_FAILED) {
                    if (!"error".equals(item.status)) {
                        item.status = "error";
                        changed = true;
                    }
                } else if (st == DownloadManager.STATUS_PAUSED) {
                    item.status = "paused";
                } else {
                    item.status = "active";
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.close();
            }
        }
        if (changed) saveItems();
    }

    private void refreshDownloads(boolean force) {
        if (downloadList == null) return;
        TextView empty = (TextView) downloadList.getTag();
        if (items.isEmpty()) {
            if (empty != null) empty.setVisibility(View.VISIBLE);
            for (View v : itemViews.values()) v.setVisibility(View.GONE);
            return;
        }
        if (empty != null) empty.setVisibility(View.GONE);
        List<Item> ordered = new ArrayList<>(items);
        ordered.sort((a, b) -> Long.compare(b.createdAt, a.createdAt));
        List<String> alive = new ArrayList<>();
        for (Item item : ordered) {
            alive.add(item.id);
            View card = itemViews.get(item.id);
            if (card == null) {
                card = buildDownloadCard(item);
                itemViews.put(item.id, card);
                downloadList.addView(card);
            }
            updateDownloadCard(card, item);
        }
        for (String id : new ArrayList<>(itemViews.keySet())) {
            if (!alive.contains(id)) {
                View v = itemViews.remove(id);
                if (v != null) downloadList.removeView(v);
            }
        }
    }

    private View buildDownloadCard(Item item) {
        LinearLayout card = card();
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(10);
        card.setLayoutParams(lp);
        card.setTag(item.id);

        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text("", 13, C_TEXT, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams tLp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        title.setLayoutParams(tLp);
        topRow.addView(title);
        TextView badge = text("", 10, C_MUTED, true);
        badge.setPadding(dp(8), dp(4), dp(8), dp(4));
        topRow.addView(badge);
        card.addView(topRow);

        TextView meta = text("", 11, C_MUTED, false);
        meta.setPadding(0, dp(6), 0, 0);
        card.addView(meta);

        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        bar.setProgress(0);
        if (Build.VERSION.SDK_INT >= 21) {
            bar.setProgressTintList(android.content.res.ColorStateList.valueOf(C_ACCENT));
            bar.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(C_SURFACE2));
        }
        LinearLayout.LayoutParams bLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(6));
        bLp.topMargin = dp(9);
        bar.setLayoutParams(bLp);
        card.addView(bar);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, dp(10), 0, 0);

        TextView cancel = smallButton("取消");
        cancel.setOnClickListener(v -> cancelItem(item));
        actions.addView(cancel, btnLp());

        TextView retry = smallButton("重试");
        retry.setOnClickListener(v -> retryItem(item));
        actions.addView(retry, btnLp());

        TextView open = smallButton("打开");
        open.setOnClickListener(v -> playItem(item));
        actions.addView(open, btnLp());

        TextView share = smallButton("分享");
        share.setOnClickListener(v -> shareItem(item));
        actions.addView(share, btnLp());

        card.addView(actions);
        return card;
    }

    private void updateDownloadCard(View card, Item item) {
        LinearLayout root = (LinearLayout) card;
        LinearLayout topRow = (LinearLayout) root.getChildAt(0);
        TextView title = (TextView) topRow.getChildAt(0);
        TextView badge = (TextView) topRow.getChildAt(1);
        TextView meta = (TextView) root.getChildAt(1);
        ProgressBar bar = (ProgressBar) root.getChildAt(2);
        LinearLayout actions = (LinearLayout) root.getChildAt(3);
        TextView cancel = (TextView) actions.getChildAt(0);
        TextView retry = (TextView) actions.getChildAt(1);
        TextView open = (TextView) actions.getChildAt(2);
        TextView share = (TextView) actions.getChildAt(3);

        title.setText(item.title.isEmpty() ? item.filename : item.title);
        String statusText;
        int statusColor;
        if ("done".equals(item.status)) {
            statusText = "已完成";
            statusColor = C_SUCCESS;
        } else if ("error".equals(item.status)) {
            statusText = "失败";
            statusColor = C_DANGER;
        } else if ("canceled".equals(item.status)) {
            statusText = "已取消";
            statusColor = C_MUTED;
        } else if ("paused".equals(item.status)) {
            statusText = "已暂停";
            statusColor = C_ACCENT2;
        } else if ("queued".equals(item.status)) {
            statusText = "排队中";
            statusColor = C_INFO;
        } else {
            statusText = "下载中";
            statusColor = C_ACCENT2;
        }
        badge.setText(statusText);
        badge.setTextColor(statusColor);

        StringBuilder sb = new StringBuilder();
        sb.append(item.engine ? "本地引擎" : "系统下载");
        if (!item.source.isEmpty()) sb.append(" · 来源 ").append(item.source);
        if (item.size > 0) sb.append(" · ").append(fmtSize(item.received)).append(" / ").append(fmtSize(item.size));
        else sb.append(" · ").append(fmtSize(item.received));
        if ("active".equals(item.status) && item.speed > 0) sb.append(" · ").append(fmtSize((long) item.speed)).append("/s");
        if ("active".equals(item.status) && item.eta > 0) sb.append(" · 剩余 ").append(fmtEta(item.eta));
        if ("error".equals(item.status) && !item.error.isEmpty()) sb.append(" · ").append(item.error);
        long ts = "done".equals(item.status) ? item.finishedAt : item.createdAt;
        if (ts > 0) sb.append("\n").append("done".equals(item.status) ? "完成于 " : "开始于 ").append(fmtTime(ts));
        meta.setText(sb.toString());
        meta.setMaxLines(2);

        int pct = 0;
        if (item.size > 0) pct = (int) Math.min(1000, item.received * 1000 / item.size);
        else if ("done".equals(item.status)) pct = 1000;
        bar.setProgress(pct);
        bar.setVisibility("queued".equals(item.status) && item.size == 0 ? View.INVISIBLE : View.VISIBLE);

        boolean running = "active".equals(item.status) || "queued".equals(item.status) || "paused".equals(item.status);
        cancel.setVisibility(running ? View.VISIBLE : View.GONE);
        retry.setVisibility(("error".equals(item.status) || "canceled".equals(item.status)) ? View.VISIBLE : View.GONE);
        open.setVisibility("done".equals(item.status) ? View.VISIBLE : View.GONE);
        share.setVisibility(View.VISIBLE);
    }

    private void cancelItem(Item item) {
        if (item.engine) {
            engineGet("/cancel?id=" + Uri.encode(item.id.replaceFirst("^eng-", "")), (ok, d, e) -> {
            });
            item.status = "canceled";
        } else if (item.nativeId != 0) {
            try {
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                dm.remove(item.nativeId);
            } catch (Exception ignored) {
            }
            item.status = "canceled";
        }
        saveItems();
        refreshDownloads(true);
    }

    private void retryItem(Item item) {
        if (item.engine) {
            startEngineDownload(item.url, item.quality);
            item.status = "queued";
            item.error = "";
        } else {
            startDirectDownload(item.url, item.filename, item.size);
        }
        refreshDownloads(true);
    }

    private void openItem(Item item) {
        if (item.engine) {
            openDownloadsFolder();
            return;
        }
        try {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            Uri uri = dm.getUriForDownloadedFile(item.nativeId);
            String mime = dm.getMimeTypeForDownloadedFile(item.nativeId);
            if (uri == null) {
                openDownloadsFolder();
                return;
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, mime == null ? "*/*" : mime);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            openDownloadsFolder();
        }
    }

    private void playItem(Item item) {
        if (!"done".equals(item.status)) {
            toast("还没下载完成");
            return;
        }
        String uriStr = null;
        String mime = "*/*";
        if (item.engine) {
            // 优先走本地引擎的 HTTP 流（不受 Android 10 scoped storage 限制），
            // 引擎离线时再尝试直接用文件路径。
            if (engineOnline) {
                uriStr = engineBase + "/file?id=" + Uri.encode(item.id.replaceFirst("^eng-", ""));
                mime = FileBridge.mimeOf(item.path == null ? "" : item.path);
            } else if (item.path != null && !item.path.isEmpty() && canReadFile(item.path)) {
                uriStr = FileBridge.uriFor(item.path).toString();
                mime = FileBridge.mimeOf(item.path);
            }
        } else if (item.nativeId != 0) {
            try {
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                Uri u = dm.getUriForDownloadedFile(item.nativeId);
                if (u != null) {
                    uriStr = u.toString();
                    String m = dm.getMimeTypeForDownloadedFile(item.nativeId);
                    if (m != null) mime = m;
                }
            } catch (Exception ignored) {
            }
        }
        if (uriStr == null) {
            toast("找不到文件，可能已被删除或移动");
            return;
        }
        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra("uri", uriStr);
        intent.putExtra("title", item.title.isEmpty() ? item.filename : item.title);
        intent.putExtra("mime", mime);
        intent.putExtra("engineId", item.engine ? item.id.replaceFirst("^eng-", "") : "");
        intent.putExtra("engineBase", engineBase);
        try {
            startActivity(intent);
        } catch (Exception e) {
            toast("无法打开播放器");
        }
    }

    private void shareItem(Item item) {
        try {
            Uri stream = null;
            String mime = "*/*";
            String text = (item.title.isEmpty() ? item.url : item.title);
            if (!item.url.isEmpty()) text += "\n" + item.url;
            if ("done".equals(item.status)) {
                if (item.engine && item.path != null && !item.path.isEmpty()
                        && canReadFile(item.path)) {
                    stream = FileBridge.uriFor(item.path);
                    mime = FileBridge.mimeOf(item.path);
                } else if (!item.engine && item.nativeId != 0) {
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    stream = dm.getUriForDownloadedFile(item.nativeId);
                    String m = dm.getMimeTypeForDownloadedFile(item.nativeId);
                    if (m != null) mime = m;
                }
            }
            Intent send = new Intent(Intent.ACTION_SEND);
            if (stream != null) {
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, stream);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                send.setType("text/plain");
            }
            send.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(send, "分享"));
        } catch (Exception e) {
            toast("分享失败");
        }
    }

    private boolean canReadFile(String path) {
        try {
            java.io.FileInputStream in = new java.io.FileInputStream(path);
            in.read();
            in.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String hostOf(String url) {
        try {
            String host = Uri.parse(url).getHost();
            return host == null ? "" : host;
        } catch (Exception e) {
            return "";
        }
    }

    private String fmtTime(long ts) {
        if (ts <= 0) return "";
        try {
            return new java.text.SimpleDateFormat("MM-dd HH:mm", java.util.Locale.getDefault())
                    .format(new java.util.Date(ts));
        } catch (Exception e) {
            return "";
        }
    }

    private void openDownloadsFolder() {
        try {
            startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) {
        }
    }

    /* ============================================================
     * 工具方法
     * ========================================================== */
    private void requestPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 4002);
            }
        }
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 4003);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (currentTab != 0) {
            switchTab(0);
            return;
        }
        super.onBackPressed();
    }

    private Item findItem(String id) {
        for (Item i : items) if (i.id.equals(id)) return i;
        return null;
    }

    private void loadThumb(String url) {
        pool.execute(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                InputStream is = conn.getInputStream();
                final Bitmap bmp = BitmapFactory.decodeStream(is);
                is.close();
                if (bmp != null) ui.post(() -> {
                    previewThumb.setVisibility(View.VISIBLE);
                    previewThumb.setImageBitmap(bmp);
                });
            } catch (Exception ignored) {
            }
        });
    }

    private void loadThumbForItem(Item item) {
        // 列表里空间有限，暂不加载缩略图，仅记录，避免频繁网络请求
        if (item.thumb != null) thumbCache.put(item.id, item.thumb);
    }

    private void hideKeyboard() {
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null && getCurrentFocus() != null) {
                imm.hideSoftInputFromWindow(getCurrentFocus().getWindowToken(), 0);
            }
        } catch (Exception ignored) {
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    private String parseName(String disposition, String url) {
        if (disposition != null) {
            Matcher m = Pattern.compile("filename\\*?=(?:UTF-8'')?\"?([^\";]+)", Pattern.CASE_INSENSITIVE).matcher(disposition);
            if (m.find()) {
                try {
                    String name = URLDecoder.decode(m.group(1).trim(), "UTF-8");
                    if (!name.isEmpty()) return sanitize(name);
                } catch (Exception ignored) {
                }
            }
        }
        return guessName(url);
    }

    private String guessName(String url) {
        try {
            String path = new URL(url).getPath();
            int slash = path.lastIndexOf('/');
            String name = slash >= 0 ? path.substring(slash + 1) : path;
            name = URLDecoder.decode(name, "UTF-8");
            return sanitize(name.isEmpty() ? "meteor-download" : name);
        } catch (Exception e) {
            return "meteor-download";
        }
    }

    private String sanitize(String name) {
        return name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
    }

    private String fmtSize(long bytes) {
        if (bytes <= 0) return "0 B";
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        double v = bytes;
        int i = 0;
        while (v >= 1024 && i < units.length - 1) {
            v /= 1024;
            i++;
        }
        return (v >= 100 ? String.format(java.util.Locale.US, "%.0f", v)
                : String.format(java.util.Locale.US, "%.1f", v).replaceAll("\\.0$", "")) + " " + units[i];
    }

    private String fmtEta(long sec) {
        if (sec <= 0) return "--";
        long m = sec / 60;
        long s = sec % 60;
        return String.format(java.util.Locale.US, "%02d:%02d", m, s);
    }

    private String fmtDuration(long sec) {
        long m = sec / 60;
        if (m < 60) return m + " 分钟";
        return (m / 60) + " 小时 " + (m % 60) + " 分";
    }

    /* ---------- 视图辅助 ---------- */
    private int dp(float v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private GradientDrawable round(int fill, float radiusDp, int strokeColor, float strokeDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0) d.setStroke(dp(strokeDp), strokeColor);
        return d;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(round(C_SURFACE, 16, C_BORDER, 1));
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        return card;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView tv = new TextView(this);
        tv.setText(s);
        tv.setTextSize(sp);
        tv.setTextColor(color);
        if (bold) tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setIncludeFontPadding(false);
        return tv;
    }

    private TextView button(String label, int bg, int color) {
        TextView tv = text(label, 13, color, true);
        tv.setGravity(Gravity.CENTER);
        tv.setBackground(round(bg, 12, Color.TRANSPARENT, 0));
        tv.setPadding(dp(14), dp(10), dp(14), dp(10));
        tv.setOnClickListener(v -> {
        });
        return tv;
    }

    private TextView smallButton(String label) {
        TextView tv = text(label, 11, C_TEXT, true);
        tv.setGravity(Gravity.CENTER);
        tv.setBackground(round(C_SURFACE2, 9, C_BORDER, 1));
        tv.setPadding(dp(12), dp(8), dp(12), dp(8));
        return tv;
    }

    private LinearLayout.LayoutParams btnLp() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.rightMargin = dp(8);
        return lp;
    }

    private void loadItems() {
        try {
            SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
            JSONArray arr = new JSONArray(sp.getString("items", "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                Item it = new Item();
                it.id = o.optString("id", "");
                it.url = o.optString("url", "");
                it.title = o.optString("title", "");
                it.filename = o.optString("filename", "");
                it.status = o.optString("status", "done");
                it.platform = o.optString("platform", "direct");
                it.source = o.optString("source", "");
                it.path = o.optString("path", "");
                it.nativeId = o.optLong("nativeId", 0);
                it.size = o.optLong("size", 0);
                it.received = o.optLong("received", 0);
                it.finishedAt = o.optLong("finishedAt", 0);
                it.createdAt = o.optLong("createdAt", System.currentTimeMillis());
                if (!it.id.isEmpty()) items.add(it);
            }
        } catch (Exception ignored) {
        }
    }

    private void saveItems() {
        try {
            JSONArray arr = new JSONArray();
            for (Item it : items) {
                if (it.engine) continue;
                if (it.nativeId == 0) continue;
                JSONObject o = new JSONObject();
                o.put("id", it.id);
                o.put("url", it.url);
                o.put("title", it.title);
                o.put("filename", it.filename);
                o.put("status", it.status);
                o.put("platform", it.platform);
                o.put("source", it.source);
                o.put("path", it.path);
                o.put("nativeId", it.nativeId);
                o.put("size", it.size);
                o.put("received", it.received);
                o.put("finishedAt", it.finishedAt);
                o.put("createdAt", it.createdAt);
                arr.put(o);
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("items", arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private void showEmergencyUi(Throwable t) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(C_BG);
        box.setPadding(dp(22), dp(60), dp(22), dp(22));
        TextView title = text("Meteor 启动异常", 20, C_TEXT, true);
        box.addView(title);
        TextView detail = text(String.valueOf(t), 11, C_DANGER, false);
        detail.setPadding(0, dp(14), 0, 0);
        detail.setTextIsSelectable(true);
        box.addView(detail);
        TextView hint = text("请把上面的信息截图/复制发给开发者。", 12, C_MUTED, false);
        hint.setPadding(0, dp(14), 0, 0);
        box.addView(hint);
        setContentView(box);
    }

    private void installCrashLog() {
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, ex) -> {
            try {
                java.io.File dir = getExternalFilesDir(null);
                if (dir != null) {
                    dir.mkdirs();
                    java.io.File f = new java.io.File(dir, "crash.log");
                    java.io.PrintWriter pw = new java.io.PrintWriter(new java.io.FileWriter(f, true));
                    pw.println(new java.util.Date().toString());
                    ex.printStackTrace(pw);
                    pw.close();
                }
            } catch (Exception ignored) {
            }
            if (prev != null) prev.uncaughtException(thread, ex);
        });
    }

    private TextView sampleChip(String label, Runnable onClick) {
        TextView tv = text(label, 11, C_MUTED, false);
        tv.setBackground(round(C_SURFACE, 999, C_BORDER, 1));
        tv.setPadding(dp(12), dp(7), dp(12), dp(7));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.rightMargin = dp(8);
        tv.setLayoutParams(lp);
        tv.setOnClickListener(v -> onClick.run());
        return tv;
    }
}
