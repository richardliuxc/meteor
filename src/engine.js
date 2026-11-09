/* ============================================================
 * OmniGet Studio · 单文件版
 * engine.js — 链接识别 / 元数据探测 / 下载引擎 / 播放器
 *
 * 依赖 core.js 提供的公共能力（不要重复实现）：
 *   OG.utils / OG.t / OG.addDict / OG.library / OG.emit / OG.on / OG.ui
 * 纯前端、零后端；DOM 相关逻辑都有 typeof document 保护，便于 node:test 单测。
 * ============================================================ */
(function () {
  'use strict';

  var root = typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this);
  var OG = (root.OG = root.OG || {});
  var U = OG.utils;

  /* ============================================================
   * 1. 常量与文案
   * ========================================================== */
  var VERSION = '1.0.0';
  var MEMORY_LIMIT = 300 * 1024 * 1024; // > 300MB 且走 Blob 时标记 memoryRisk
  var PROBE_TIMEOUT = 10000;
  var META_TIMEOUT = 8000;
  var SPEED_TICK = 300;                 // 进度事件节流（~300ms）
  var PERSIST_KEY = 'omniget.downloads.v1';

  if (typeof OG.addDict === 'function') {
    OG.addDict({
      zh: {
        'engine.error.cors': '跨域受限（CORS），浏览器无法读取该地址',
        'engine.error.network': '网络错误，下载中断',
        'engine.error.timeout': '请求超时',
        'engine.error.http': '服务器返回 HTTP {status}',
        'engine.error.aborted': '已中止',
        'engine.error.truncated': '连接提前中断，文件不完整',
        'engine.error.unsupported': '浏览器无法直连该平台的视频流',
        'engine.error.torrent': '浏览器无法运行 BitTorrent 客户端',
        'engine.error.stream': 'HLS/DASH 流媒体需要本地引擎合并',
        'engine.error.invalid': '这不是有效的链接',
        'engine.error.page': '这是一个网页，不是可直连的文件',
        'engine.hint.ytdlp': '可复制 yt-dlp 命令在本地完成下载',
        'engine.hint.torrent': '请使用原版 OmniGet 或桌面 BT 客户端',
        'engine.hint.stream': '可用 ffmpeg 合并，或使用原版 OmniGet',
        'engine.player.title': '播放器',
        'engine.player.video': '视频',
        'engine.player.audio': '音频',
        'engine.player.urlTitle': '网络媒体（受 CORS 限制）',
        'engine.player.speed': '倍速',
        'engine.player.loadSubtitle': '加载字幕',
        'engine.player.subtitleOn': '字幕已加载',
        'engine.player.subtitleFail': '字幕解析失败',
        'engine.player.fullscreen': '全屏',
        'engine.player.download': '下载',
        'engine.player.dragHint': '支持视频与音频，可加载 .srt / .vtt 字幕',
        'engine.player.cannotPlay': '无法播放该媒体',
        'engine.player.corsHint': '远程媒体可能不允许跨域播放，请先下载',
        'engine.player.noFile': '没有选择文件',
        'engine.download.pickCanceled': '已取消保存',
        'engine.download.savedTo': '已保存到 {name}',
        'engine.meta.unsupported': '该平台不支持浏览器端解析',
        'engine.meta.failed': '元数据获取失败，已使用基础信息'
      },
      en: {
        'engine.error.cors': 'Blocked by CORS — the browser cannot read that address',
        'engine.error.network': 'Network error — the download was interrupted',
        'engine.error.timeout': 'Request timed out',
        'engine.error.http': 'Server returned HTTP {status}',
        'engine.error.aborted': 'Aborted',
        'engine.error.truncated': 'Connection closed early — the file is incomplete',
        'engine.error.unsupported': 'This platform stream cannot be fetched in a browser',
        'engine.error.torrent': 'Browsers cannot run a BitTorrent client',
        'engine.error.stream': 'HLS/DASH streams need a local engine to merge',
        'engine.error.invalid': 'That is not a valid link',
        'engine.error.page': 'This is a web page, not a direct file',
        'engine.hint.ytdlp': 'Copy the yt-dlp command to finish the download locally',
        'engine.hint.torrent': 'Use the original OmniGet or a desktop BT client',
        'engine.hint.stream': 'Use ffmpeg to merge, or the original OmniGet',
        'engine.player.title': 'Player',
        'engine.player.video': 'Video',
        'engine.player.audio': 'Audio',
        'engine.player.urlTitle': 'Remote media (CORS limited)',
        'engine.player.speed': 'Speed',
        'engine.player.loadSubtitle': 'Subtitles',
        'engine.player.subtitleOn': 'Subtitles loaded',
        'engine.player.subtitleFail': 'Could not read that subtitle file',
        'engine.player.fullscreen': 'Fullscreen',
        'engine.player.download': 'Download',
        'engine.player.dragHint': 'Video and audio files; .srt / .vtt subtitles supported',
        'engine.player.cannotPlay': 'Cannot play this media',
        'engine.player.corsHint': 'Remote media may block cross-origin playback — download it first',
        'engine.player.noFile': 'No file selected',
        'engine.download.pickCanceled': 'Save canceled',
        'engine.download.savedTo': 'Saved to {name}',
        'engine.meta.unsupported': 'This platform cannot be resolved in the browser',
        'engine.meta.failed': 'Metadata unavailable — using basic info'
      }
    });
  }

  function t(key, vars) {
    if (typeof OG.t === 'function') return OG.t(key, vars);
    return key;
  }

  function icon(name) {
    return typeof OG.icon === 'function' ? OG.icon(name) : '';
  }

  /* ============================================================
   * 2. 平台表
   * ========================================================== */
  var PLATFORMS = [
    { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com', 'music.youtube.com'], color: '#FF0033', icon: 'youtube' },
    { id: 'vimeo', name: 'Vimeo', hosts: ['vimeo.com', 'player.vimeo.com'], color: '#1AB7EA', icon: 'vimeo' },
    { id: 'x', name: 'X', hosts: ['x.com', 'twitter.com', 't.co', 'mobile.twitter.com'], color: '#1D9BF0', icon: 'x' },
    { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'instagr.am'], color: '#E1306C', icon: 'instagram' },
    { id: 'tiktok', name: 'TikTok', hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'], color: '#25F4EE', icon: 'tiktok' },
    { id: 'bilibili', name: 'Bilibili', hosts: ['bilibili.com', 'b23.tv', 'm.bilibili.com', 'live.bilibili.com'], color: '#FB7299', icon: 'bilibili' },
    { id: 'pinterest', name: 'Pinterest', hosts: ['pinterest.com', 'pin.it', 'pinterest.co.uk', 'pinterest.de'], color: '#E60023', icon: 'pinterest' },
    { id: 'reddit', name: 'Reddit', hosts: ['reddit.com', 'redd.it', 'old.reddit.com', 'np.reddit.com'], color: '#FF4500', icon: 'reddit' },
    { id: 'twitch', name: 'Twitch', hosts: ['twitch.tv', 'clips.twitch.tv', 'm.twitch.tv'], color: '#9146FF', icon: 'twitch' },
    { id: 'soundcloud', name: 'SoundCloud', hosts: ['soundcloud.com', 'on.soundcloud.com', 'soundcloud.app.goo.gl', 'm.soundcloud.com'], color: '#FF5500', icon: 'soundcloud' },
    { id: 'direct', name: 'Direct', hosts: [], color: '#FF7D38', icon: 'download' },
    { id: 'torrent', name: 'Torrent', hosts: [], color: '#F59E0B', icon: 'torrent' },
    { id: 'unknown', name: 'Link', hosts: [], color: '#8A94A6', icon: 'unknown' }
  ];

  var PLATFORM_ICONS = {
    youtube: '<rect x="2.6" y="5.6" width="18.8" height="12.8" rx="3.4"/><path d="m10.4 9.2 5 2.8-5 2.8z"/>',
    vimeo: '<path d="M4.8 7.2 12 19l7.2-11.8"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r=".9" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M14 4v9.4a3.6 3.6 0 1 1-3.6-3.6"/><path d="M14 4c.4 2.6 2 4.2 4.6 4.6"/>',
    bilibili: '<rect x="3" y="6.4" width="18" height="13" rx="3"/><path d="M7.4 3.6 10 6.4M16.6 3.6 14 6.4M8.4 11.4v3M15.6 11.4v3"/>',
    pinterest: '<circle cx="12" cy="12" r="8.8"/><path d="M10.2 20.2 12.4 13m-.9-4.4c2.6-1 4.6.6 4.2 3-.4 2.9-2.6 3.8-4.4 2.6"/>',
    reddit: '<circle cx="12" cy="12" r="8.8"/><circle cx="9" cy="12.6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12.6" r="1" fill="currentColor" stroke="none"/><path d="M8.8 15.2c1.8 1.6 4.6 1.6 6.4 0"/>',
    twitch: '<path d="M5 4h14v10.4l-4 4h-3.2L9 21H7.4v-2.6H4.6V7z"/><path d="M10.4 8.4v4M15 8.4v4"/>',
    soundcloud: '<path d="M4 15.4a3 3 0 0 1 .6-5.9M2.6 15.4h17.8a2 2 0 0 0-1.4-3.4"/><path d="M7 15.4V9.6M10 15.4V7.4M13 15.4V6.6"/>',
    torrent: '<path d="M13.2 2.6 4.4 14h6.1l-.9 7.4L18.8 10h-6.2z"/>',
    unknown: '<path d="M10.2 13.8a4.8 4.8 0 0 0 6.8 0l2.6-2.6a4.8 4.8 0 0 0-6.8-6.8l-1.4 1.4"/><path d="M13.8 10.2a4.8 4.8 0 0 0-6.8 0l-2.6 2.6a4.8 4.8 0 0 0 6.8 6.8l1.4-1.4"/>'
  };
  if (typeof OG.registerIcon === 'function') {
    Object.keys(PLATFORM_ICONS).forEach(function (name) {
      OG.registerIcon(name, PLATFORM_ICONS[name]);
    });
  }

  var HOST_INDEX = {};
  PLATFORMS.forEach(function (platform) {
    (platform.hosts || []).forEach(function (host) { HOST_INDEX[host] = platform.id; });
  });
  var HOST_KEYS = Object.keys(HOST_INDEX);

  function platformForHost(host) {
    if (!host) return null;
    if (HOST_INDEX[host]) return HOST_INDEX[host];
    for (var i = 0; i < HOST_KEYS.length; i++) {
      var h = HOST_KEYS[i];
      if (host.length > h.length && host.slice(-(h.length + 1)) === '.' + h) return HOST_INDEX[h];
    }
    return null;
  }

  /* ============================================================
   * 3. 通用小工具（只做 engine 内部需要的，公共能力走 OG.utils）
   * ========================================================== */
  function truncate(text, n) {
    text = String(text === null || text === undefined ? '' : text);
    return text.length > n ? text.slice(0, Math.max(1, n - 1)) + '…' : text;
  }

  function cleanText(text) {
    return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
  }

  function stripHtml(html) {
    return cleanText(String(html || '').replace(/<[^>]*>/g, ' '));
  }

  function pad2(value) {
    var s = String(value);
    return s.length >= 2 ? s : ('00' + s).slice(-2);
  }

  function safeName(name, ext) {
    var raw = String(name === null || name === undefined ? '' : name);
    if (/[\\/]/.test(raw)) raw = raw.split(/[\\/]/).pop();
    raw = raw.replace(/[\u0000-\u001f\u007f:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
    raw = raw.replace(/^\.+/, '');
    if (raw.length > 160) raw = raw.slice(0, 160);
    var wanted = String(ext || '').toLowerCase().replace(/^\./, '');
    var current = U.extOf(raw);
    if (!raw) raw = 'download';
    if (wanted && current !== wanted) {
      raw = (current ? raw.slice(0, raw.length - current.length - 1) : raw) + '.' + wanted;
    }
    if (!raw) raw = 'download' + (wanted ? '.' + wanted : '');
    return raw;
  }

  function pageName(url) {
    var name = '';
    try { name = U.basename(url); } catch (e) { name = ''; }
    return name || 'download';
  }

  var MIME_EXT = {
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
    'video/x-msvideo': 'avi', 'video/mpeg': 'mpg', 'video/ogg': 'ogv', 'video/3gpp': '3gp',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac',
    'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/webm': 'weba',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
    'application/pdf': 'pdf', 'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'rar', 'application/vnd.rar': 'rar',
    'application/x-7z-compressed': '7z', 'application/x-tar': 'tar',
    'application/gzip': 'gz', 'application/x-gzip': 'gz',
    'application/json': 'json', 'text/plain': 'txt', 'text/csv': 'csv',
    'application/mpegurl': 'm3u8', 'application/vnd.apple.mpegurl': 'm3u8',
    'application/x-mpegurl': 'm3u8', 'application/dash+xml': 'mpd',
    'application/octet-stream': ''
  };

  var PAGE_EXTS = ['html', 'htm', 'xhtml', 'php', 'asp', 'aspx', 'jsp', 'cgi', 'do', 'action'];
  var STREAM_EXTS = ['m3u8', 'mpd'];

  function directKindOf(ext) {
    if (!ext) return '';
    if (PAGE_EXTS.indexOf(ext) >= 0) return '';
    if (STREAM_EXTS.indexOf(ext) >= 0) return '';
    var kind = U.guessType(ext);
    if (kind === 'video' || kind === 'audio' || kind === 'image' || kind === 'pdf' || kind === 'archive') return kind;
    if (kind === 'doc') return 'file';
    return '';
  }

  /* ---- 错误分类 ------------------------------------------------ */
  function timeoutError() {
    var err = new Error('timeout');
    err.name = 'TimeoutError';
    return err;
  }
  function abortError() {
    var err = new Error('aborted');
    err.name = 'AbortError';
    return err;
  }
  function httpError(status) {
    var err = new Error('HTTP ' + status);
    err.name = 'HttpError';
    err.status = status;
    err.hint = 'http';
    return err;
  }
  function netError(message) {
    var err = new Error(message || 'network');
    err.name = 'NetworkError';
    return err;
  }
  function unsupportedError(message) {
    var err = new Error(message || 'unsupported');
    err.name = 'UnsupportedError';
    err.hint = 'unsupported';
    return err;
  }

  function classifyError(err) {
    if (!err) return 'network';
    if (err.hint) return err.hint;
    var name = err.name || '';
    if (name === 'TimeoutError') return 'timeout';
    if (name === 'AbortError') return 'aborted';
    if (name === 'TypeError') return 'cors';
    if (name === 'HttpError') return 'http';
    if (name === 'UnsupportedError' || name === 'NotSupportedError') return 'unsupported';
    if (err.status) return 'http';
    return 'network';
  }

  function errorMessage(err, hint) {
    if (err && err.hint === 'unsupported' && err.message) return err.message;
    if (hint === 'timeout') return t('engine.error.timeout');
    if (hint === 'cors') return t('engine.error.cors');
    if (hint === 'aborted') return t('engine.error.aborted');
    if (hint === 'http') return t('engine.error.http', { status: (err && err.status) || 0 });
    if (hint === 'unsupported') return t('engine.error.unsupported');
    if (err && err.name === 'NetworkError' && err.message === 'truncated') return t('engine.error.truncated');
    return t('engine.error.network');
  }

  /* ---- HTTP 响应头 --------------------------------------------- */
  function header(res, name) {
    if (!res || !res.headers) return '';
    try {
      if (typeof res.headers.get === 'function') return res.headers.get(name) || '';
      var lower = String(name).toLowerCase();
      var keys = Object.keys(res.headers);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === lower) {
          var value = res.headers[keys[i]];
          return value === null || value === undefined ? '' : String(value);
        }
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  function filenameFromDisposition(disposition) {
    var cd = String(disposition || '');
    if (!cd) return '';
    var star = cd.match(/filename\*\s*=\s*([^;]+)/i);
    if (star) {
      var raw = star[1].trim().replace(/^["']|["']$/g, '');
      var encoded = raw.match(/^([\w-]+)'([\w-]*)'([\s\S]+)$/);
      if (encoded) {
        try { return decodeURIComponent(encoded[3]); } catch (e) { return encoded[3]; }
      }
      try { return decodeURIComponent(raw); } catch (e) { return raw; }
    }
    var plain = cd.match(/filename\s*=\s*([^;]+)/i);
    if (plain) return plain[1].trim().replace(/^["']|["']$/g, '');
    return '';
  }

  function cancelBody(res) {
    try {
      if (res && res.body && typeof res.body.cancel === 'function') res.body.cancel();
    } catch (e) { /* ignore */ }
  }

  function sleep(ms) {
    if (typeof U.sleep === 'function') return U.sleep(ms);
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ---- fetch 注入（便于单测） ---------------------------------- */
  var nativeFetch = null;
  try {
    if (typeof fetch === 'function') nativeFetch = fetch;
  } catch (e) { nativeFetch = null; }
  var fetchOverride = null;

  function currentFetch() {
    if (typeof fetchOverride === 'function') return fetchOverride;
    return nativeFetch;
  }

  function doFetch(url, init) {
    var fn = currentFetch();
    if (!fn) {
      var err = new TypeError('fetch is not available');
      return Promise.reject(err);
    }
    return fn(url, init);
  }

  /* 带超时 / 外部取消的 fetch（仅用于探测与 oEmbed） */
  function fetchWithTimeout(url, init, timeoutMs, externalSignal) {
    init = init || {};
    var ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : PROBE_TIMEOUT;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = null;
      var onExternal = null;

      function cleanup() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (externalSignal && onExternal && typeof externalSignal.removeEventListener === 'function') {
          try { externalSignal.removeEventListener('abort', onExternal); } catch (e) { /* ignore */ }
        }
      }
      function settle(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }
      function failTimeout() {
        if (settled) return;
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* ignore */ } }
        settle(reject, timeoutError());
      }
      function failAborted() {
        if (settled) return;
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* ignore */ } }
        settle(reject, abortError());
      }

      timer = setTimeout(failTimeout, ms);
      if (externalSignal) {
        if (externalSignal.aborted) { failAborted(); return; }
        if (typeof externalSignal.addEventListener === 'function') {
          onExternal = failAborted;
          externalSignal.addEventListener('abort', onExternal);
        }
      }

      var options = {};
      Object.keys(init).forEach(function (key) { options[key] = init[key]; });
      if (ctrl) options.signal = ctrl.signal;

      var request;
      try {
        request = doFetch(url, options);
      } catch (err) {
        settle(reject, err);
        return;
      }
      Promise.resolve(request).then(function (res) {
        settle(resolve, res);
      }, function (err) {
        settle(reject, err);
      });
    });
  }

  /* ============================================================
   * 4. 链接识别
   * ========================================================== */
  function youtubeVideoId(u) {
    if (!u) return '';
    var host = String(u.hostname || '').toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      var seg = u.pathname.split('/').filter(Boolean)[0];
      return seg || '';
    }
    var fromQuery = '';
    try { fromQuery = u.searchParams.get('v') || ''; } catch (e) { fromQuery = ''; }
    if (fromQuery) return fromQuery;
    var m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }

  function vimeoVideoId(u) {
    if (!u) return '';
    var m = u.pathname.match(/\/(?:video\/)?(\d{5,})/);
    return m ? m[1] : '';
  }

  function describePlatform(platformId, u, result) {
    var path = u.pathname || '';
    var id = '';
    if (platformId === 'youtube') {
      id = youtubeVideoId(u);
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'youtube-' + id + '.mp4' : 'youtube.mp4', 'mp4');
    } else if (platformId === 'vimeo') {
      id = vimeoVideoId(u);
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'vimeo-' + id + '.mp4' : 'vimeo.mp4', 'mp4');
    } else if (platformId === 'x') {
      var xm = path.match(/\/status(?:es)?\/([0-9]+)/i) || path.match(/\/i\/status\/([0-9]+)/i);
      id = xm ? xm[1] : '';
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'x-' + id + '.mp4' : 'x-video.mp4', 'mp4');
    } else if (platformId === 'instagram') {
      var im = path.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      id = im ? im[1] : '';
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'instagram-' + id + '.mp4' : 'instagram.mp4', 'mp4');
    } else if (platformId === 'tiktok') {
      var tm = path.match(/\/video\/([0-9]+)/) || path.match(/^\/t\/([A-Za-z0-9]+)/);
      id = tm ? tm[1] : '';
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'tiktok-' + id + '.mp4' : 'tiktok.mp4', 'mp4');
    } else if (platformId === 'bilibili') {
      var bm = path.match(/\/video\/(BV[0-9A-Za-z]+)/i);
      if (bm) id = bm[1];
      else {
        var am = path.match(/\/video\/av([0-9]+)/i);
        if (am) id = 'av' + am[1];
      }
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'bilibili-' + id + '.mp4' : 'bilibili.mp4', 'mp4');
    } else if (platformId === 'pinterest') {
      var pm = path.match(/\/pin\/([0-9]+)/);
      id = pm ? pm[1] : '';
      result.videoId = id;
      result.kind = 'image';
      result.ext = 'jpg';
      result.filename = safeName(id ? 'pinterest-' + id + '.jpg' : 'pinterest.jpg', 'jpg');
    } else if (platformId === 'reddit') {
      var rm = path.match(/\/comments\/([a-z0-9]+)/i);
      id = rm ? rm[1] : '';
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'reddit-' + id + '.mp4' : 'reddit.mp4', 'mp4');
    } else if (platformId === 'twitch') {
      var twm = path.match(/\/videos\/([0-9]+)/);
      if (twm) id = twm[1];
      else {
        var clm = path.match(/\/clip\/([A-Za-z0-9_-]+)/);
        if (clm) id = clm[1];
      }
      result.videoId = id;
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName(id ? 'twitch-' + id + '.mp4' : 'twitch.mp4', 'mp4');
    } else if (platformId === 'soundcloud') {
      var parts = path.split('/').filter(Boolean);
      id = parts.length ? parts[parts.length - 1] : '';
      result.videoId = id;
      result.kind = 'audio';
      result.ext = 'mp3';
      result.filename = safeName(id ? 'soundcloud-' + id + '.mp3' : 'soundcloud.mp3', 'mp3');
    } else {
      result.kind = 'video';
      result.ext = 'mp4';
      result.filename = safeName('media.mp4', 'mp4');
    }
    return result;
  }

  function detectLink(url) {
    var raw = String(url === null || url === undefined ? '' : url).trim();
    var result = {
      url: raw,
      platform: 'unknown',
      kind: 'unknown',
      filename: '',
      ext: '',
      direct: false,
      videoId: null
    };
    if (!raw) return result;

    if (/^magnet:/i.test(raw)) {
      var dn = raw.match(/[?&]dn=([^&]*)/i);
      var name = '';
      if (dn) {
        try { name = decodeURIComponent(dn[1].replace(/\+/g, ' ')); } catch (e) { name = dn[1]; }
      }
      var xt = raw.match(/xt=urn:btih:([a-z0-9]+)/i);
      var hash = xt ? xt[1] : '';
      name = name || (hash ? 'magnet-' + hash.slice(0, 8) : 'magnet');
      result.platform = 'torrent';
      result.kind = 'torrent';
      result.direct = false;
      result.filename = safeName(name, U.extOf(name));
      result.ext = U.extOf(result.filename);
      result.magnetHash = hash;
      return result;
    }

    var u = U.parseUrl(raw);
    if (!u) {
      result.kind = 'unknown';
      return result;
    }

    var host = String(u.hostname || '').toLowerCase().replace(/^www\./, '');
    var platformId = platformForHost(host);
    if (platformId) {
      result.platform = platformId;
      result.direct = false;
      return describePlatform(platformId, u, result);
    }

    var ext = U.extOf(u.pathname);
    var baseName = '';
    try {
      baseName = decodeURIComponent((u.pathname.split('/').filter(Boolean).pop() || ''));
    } catch (e) {
      baseName = pageName(raw);
    }

    if (ext === 'torrent') {
      result.platform = 'torrent';
      result.kind = 'torrent';
      result.direct = true;
      result.ext = 'torrent';
      result.filename = safeName(baseName || 'download', 'torrent');
      return result;
    }

    if (STREAM_EXTS.indexOf(ext) >= 0) {
      result.platform = 'direct';
      result.kind = 'video';
      result.direct = false;
      result.stream = true;
      result.ext = ext;
      result.filename = safeName(baseName || ('stream.' + ext), ext);
      return result;
    }

    var directKind = directKindOf(ext);
    if (directKind) {
      result.platform = 'direct';
      result.kind = directKind;
      result.direct = true;
      result.ext = ext;
      result.filename = safeName(baseName || 'download', ext);
      return result;
    }

    result.platform = 'unknown';
    result.kind = 'page';
    result.ext = ext || '';
    result.filename = safeName(baseName || host || 'link', ext || '');
    return result;
  }

  /* ============================================================
   * 5. probe —— HEAD / GET Range / CORS / 超时
   * ========================================================== */
  function failProbe(error, status, raw, res) {
    return {
      ok: false,
      status: status || 0,
      size: null,
      contentType: '',
      ext: '',
      filename: safeName(pageName(raw), U.extOf(raw)),
      supportsRange: false,
      finalUrl: (res && res.url) || raw,
      error: error || 'network'
    };
  }

  function buildProbeResult(res, raw) {
    var finalUrl = (res && res.url) || raw;
    var contentType = String(header(res, 'content-type') || '').split(';')[0].trim().toLowerCase();
    var dispositionName = filenameFromDisposition(header(res, 'content-disposition'));
    var size = null;
    var supportsRange = /bytes/i.test(header(res, 'accept-ranges') || '');

    var contentLength = parseInt(header(res, 'content-length'), 10);
    if (!isNaN(contentLength) && contentLength >= 0) size = contentLength;

    if (res && res.status === 206) {
      var rangeMatch = String(header(res, 'content-range') || '').match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
      if (rangeMatch) {
        supportsRange = true;
        if (rangeMatch[3] !== '*') size = parseInt(rangeMatch[3], 10);
      }
    } else if (res && res.status === 416) {
      var totalMatch = String(header(res, 'content-range') || '').match(/bytes\s+\*\/(\d+)/i);
      if (totalMatch) size = parseInt(totalMatch[1], 10);
      supportsRange = true;
    }

    var urlName = '';
    try {
      var parsed = new URL(finalUrl);
      urlName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    } catch (e) {
      urlName = pageName(raw);
    }
    var filename = dispositionName || urlName || pageName(raw);
    var ext = U.extOf(filename) || MIME_EXT[contentType] || '';
    filename = safeName(filename, ext);

    return {
      ok: true,
      status: (res && res.status) || 200,
      size: size,
      contentType: contentType,
      ext: ext,
      filename: filename,
      supportsRange: !!supportsRange,
      finalUrl: finalUrl,
      error: null
    };
  }

  async function probe(url, opts) {
    opts = opts || {};
    var raw = String(url === null || url === undefined ? '' : url).trim();
    var parsed = U.parseUrl(raw);
    if (!parsed) return failProbe('invalid', 0, raw);

    var timeout = Number(opts.timeout) > 0 ? Number(opts.timeout) : PROBE_TIMEOUT;
    var signal = opts.signal || null;
    var res = null;

    try {
      res = await fetchWithTimeout(raw, {
        method: 'HEAD', redirect: 'follow', cache: 'no-store', credentials: 'omit', mode: 'cors'
      }, timeout, signal);
    } catch (err) {
      var hint = classifyError(err);
      if (hint === 'aborted' || hint === 'timeout') return failProbe(hint, 0, raw);
      res = null;
    }

    if (res && !res.ok) {
      if (res.status !== 400 && res.status !== 403 && res.status !== 405 && res.status !== 501) {
        return failProbe('http', res.status, raw, res);
      }
      res = null;
    }

    if (!res) {
      try {
        res = await fetchWithTimeout(raw, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          redirect: 'follow',
          cache: 'no-store',
          credentials: 'omit',
          mode: 'cors'
        }, timeout, signal);
      } catch (err2) {
        return failProbe(classifyError(err2), 0, raw);
      }
      if (!res) return failProbe('network', 0, raw);
      if (!res.ok && res.status !== 416) return failProbe('http', res.status, raw, res);
      cancelBody(res);
    }

    return buildProbeResult(res, raw);
  }

  /* ============================================================
   * 6. fetchMeta —— YouTube / Vimeo / X oEmbed（已验证 CORS）
   * ========================================================== */
  function fetchOEmbed(endpoint, opts) {
    var timeout = Number(opts && opts.timeout) > 0 ? Number(opts.timeout) : META_TIMEOUT;
    var signal = (opts && opts.signal) || null;
    return fetchWithTimeout(endpoint, {
      method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit', mode: 'cors'
    }, timeout, signal).then(function (res) {
      if (!res || !res.ok) throw httpError(res ? res.status : 0);
      if (typeof res.json === 'function') return res.json();
      if (typeof res.text === 'function') {
        return res.text().then(function (text) { return JSON.parse(text); });
      }
      throw netError('no body');
    });
  }

  function applyMeta(base, data, thumbFallback) {
    data = data || {};
    if (!base.title && data.title) base.title = truncate(cleanText(data.title), 200);
    if (!base.author && data.author_name) base.author = truncate(cleanText(data.author_name), 120);
    if (!base.author && data.author) base.author = truncate(cleanText(data.author), 120);
    if (!base.thumbnail && data.thumbnail_url) base.thumbnail = String(data.thumbnail_url);
    if (!base.thumbnail && data.thumbnail) base.thumbnail = String(data.thumbnail);
    if (data.duration !== undefined && data.duration !== null) {
      var duration = Number(data.duration);
      if (isFinite(duration) && duration > 0) base.duration = duration;
    }
    if (!base.description && data.description) base.description = truncate(cleanText(data.description), 500);
    base.thumbnail = base.thumbnail || thumbFallback || '';
    return base;
  }

  async function fetchMeta(url, opts) {
    opts = opts || {};
    var raw = String(url === null || url === undefined ? '' : url).trim();
    var info = detectLink(raw);
    var platform = opts.platform || info.platform;
    var thumbFallback = '';
    if (platform === 'youtube' && info.videoId) {
      thumbFallback = 'https://i.ytimg.com/vi/' + info.videoId + '/hqdefault.jpg';
    }
    var base = {
      url: raw,
      platform: platform,
      kind: info.kind,
      filename: info.filename || '',
      title: '',
      author: '',
      thumbnail: thumbFallback,
      duration: null,
      description: '',
      error: null,
      videoId: info.videoId || ''
    };
    if (!raw) {
      base.error = 'invalid';
      return base;
    }

    if (platform === 'youtube' || platform === 'vimeo' || platform === 'x') {
      var endpoint = platform === 'youtube'
        ? 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(raw)
        : platform === 'vimeo'
          ? 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(raw)
          : 'https://publish.twitter.com/oembed?url=' + encodeURIComponent(raw);
      try {
        var data = await fetchOEmbed(endpoint, opts);
        applyMeta(base, data, thumbFallback);
        if (platform === 'x' && !base.title && data && data.html) {
          base.title = truncate(stripHtml(data.html), 140);
        }
      } catch (err) {
        base.error = classifyError(err);
        base.status = (err && err.status) || 0;
        base.thumbnail = base.thumbnail || thumbFallback;
      }
      return base;
    }

    if (platform === 'direct' || platform === 'unknown') {
      try {
        // Android 桥可能覆盖 OG.engine.probe 走原生探测（无 CORS 限制）
        var probeFn = (engine && typeof engine.probe === 'function') ? engine.probe : probe;
        var probed = await probeFn(raw, { timeout: opts.timeout, signal: opts.signal });
        if (!probed.ok) {
          base.error = probed.error || 'network';
          base.title = base.title || pageName(raw);
          return base;
        }
        base.title = probed.filename || pageName(raw);
        base.filename = probed.filename;
        base.size = probed.size;
        base.contentType = probed.contentType;
        base.ext = probed.ext;
        base.direct = !!info.direct;
        if (!base.author) {
          try { base.author = new URL(probed.finalUrl).hostname.replace(/^www\./, ''); } catch (e) { base.author = ''; }
        }
        if (info.kind === 'image') base.thumbnail = raw;
        var description = [];
        if (probed.contentType) description.push(probed.contentType);
        if (probed.size) description.push(U.fmtBytes(probed.size));
        base.description = description.join(' · ');
      } catch (err2) {
        base.error = classifyError(err2);
        base.title = base.title || pageName(raw);
      }
      return base;
    }

    // 其他平台：按契约不发起请求，交给 UI 提示“需本地引擎”
    base.error = 'unsupported';
    return base;
  }

  /* ============================================================
   * 7. 下载队列
   * ========================================================== */
  function downloadsList() {
    if (!OG.state) OG.state = {};
    if (!Array.isArray(OG.state.downloads)) OG.state.downloads = [];
    return OG.state.downloads;
  }

  function findItem(id) {
    var list = downloadsList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function concurrencyLimit() {
    var n = parseInt(OG.state && OG.state.settings && OG.state.settings.concurrency, 10);
    if (!n || n < 1) n = 2;
    return Math.min(n, 6);
  }

  var running = Object.create(null);
  var idleWaiters = [];
  var tickTimer = null;
  var persistTimer = null;
  var sinkFactory = null;
  var speedLimitOverride = null;

  var PERSIST_FIELDS = [
    'id', 'url', 'filename', 'title', 'platform', 'kind', 'ext', 'size', 'received',
    'status', 'error', 'errorHint', 'errorStatus', 'startedAt', 'finishedAt', 'elapsed',
    'thumb', 'supportsRange', 'memoryRisk', 'command', 'contentType', 'direct',
    'saveMode', 'addedAt', 'savedTo'
  ];

  function storage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function schedulePersist() {
    if (persistTimer) return;
    persistTimer = setTimeout(function () {
      persistTimer = null;
      persistNow();
    }, 400);
    if (persistTimer && typeof persistTimer.unref === 'function') persistTimer.unref();
  }

  function persistNow() {
    var store = storage();
    if (!store) return;
    try {
      var meta = downloadsList().slice(0, 100).map(function (item) {
        var out = {};
        PERSIST_FIELDS.forEach(function (key) {
          if (item[key] !== undefined) out[key] = item[key];
        });
        return out;
      });
      if (!meta.length) store.removeItem(PERSIST_KEY);
      else store.setItem(PERSIST_KEY, JSON.stringify(meta));
    } catch (e) { /* 配额不足时静默降级，绝不影响下载本身 */ }
  }

  function restore() {
    var store = storage();
    if (!store) return;
    try {
      var raw = store.getItem(PERSIST_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!Array.isArray(saved) || !saved.length) return;
      var list = downloadsList();
      var seen = {};
      list.forEach(function (item) { seen[item.id] = 1; });
      saved.slice(0, 100).forEach(function (src) {
        if (!src || !src.id || !src.url || seen[src.id]) return;
        var item = {};
        PERSIST_FIELDS.forEach(function (key) {
          if (src[key] !== undefined) item[key] = src[key];
        });
        // 页面重载后内存里的数据已消失：active/queued 一律降级为 paused 并归零
        if (item.status === 'active' || item.status === 'queued') item.status = 'paused';
        if (item.status === 'paused') item.received = 0;
        item.speed = 0;
        item.eta = null;
        item.progress = 0;
        item.memoryRisk = false;
        item.saveMode = 'blob';
        list.push(item);
        seen[item.id] = 1;
      });
    } catch (e) { /* 忽略损坏的持久化数据 */ }
  }

  function notify(id, item) {
    schedulePersist();
    if (typeof OG.emit === 'function') {
      try { OG.emit('downloads:update', { id: id || null, item: item || null }); } catch (e) { /* ignore */ }
    }
  }

  function updateMemoryRisk(item) {
    if (item.saveMode !== 'blob') { item.memoryRisk = false; return; }
    if ((Number(item.size) || 0) > MEMORY_LIMIT || (Number(item.received) || 0) > MEMORY_LIMIT) {
      item.memoryRisk = true;
    }
  }

  function idleNow() {
    var list = downloadsList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].status === 'active' || list[i].status === 'queued') return false;
    }
    return true;
  }

  function checkIdle() {
    if (!idleNow()) return;
    var waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  function whenIdle() {
    return new Promise(function (resolve) {
      if (idleNow()) resolve();
      else idleWaiters.push(resolve);
    });
  }

  /* ---- 保存落盘 ------------------------------------------------ */
  function blobSink(item) {
    var chunks = [];
    return {
      kind: 'blob',
      chunks: chunks,
      write: function (chunk) { chunks.push(chunk); return null; },
      reset: function () { chunks.length = 0; return null; },
      close: function () {
        if (typeof document === 'undefined') { chunks.length = 0; return null; }
        try {
          var blob = new Blob(chunks, { type: item.contentType || 'application/octet-stream' });
          var objectUrl = URL.createObjectURL(blob);
          var anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = item.filename || 'download';
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(function () {
            try { anchor.remove(); } catch (e) { /* ignore */ }
            try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
          }, 4000);
        } catch (e) { /* 保存失败时静默，状态仍是 done，用户可从资料库重试 */ }
        chunks.length = 0;
        return null;
      },
      abort: function () { chunks.length = 0; return null; }
    };
  }

  function defaultSink(item) {
    var win = (typeof window !== 'undefined') ? window : null;
    if (win && typeof win.showSaveFilePicker === 'function' && !item.noPicker) {
      try {
        var picker = win.showSaveFilePicker({ suggestedName: item.filename || 'download' });
        return Promise.resolve(picker).then(function (handle) {
          return Promise.resolve(handle.createWritable()).then(function (writer) {
            return {
              kind: 'fs',
              path: (handle && handle.name) || '',
              write: function (chunk) { return writer.write(chunk); },
              close: function () { return writer.close(); },
              abort: function () {
                try {
                  if (typeof writer.abort === 'function') return writer.abort();
                  return writer.close();
                } catch (e) { return null; }
              },
              reset: function () {
                try {
                  if (typeof writer.truncate === 'function') {
                    return Promise.resolve(writer.truncate(0)).then(function () {
                      return writer.write({ type: 'seek', position: 0 });
                    });
                  }
                  return writer.write({ type: 'truncate', size: 0 });
                } catch (e) { return null; }
              }
            };
          });
        }).catch(function (err) {
          // AbortError = 用户取消保存位置；其余（无用户手势的 SecurityError）退回 Blob
          if (err && err.name === 'AbortError') return null;
          return blobSink(item);
        });
      } catch (e) { /* 落到 Blob 兜底 */ }
    }
    return blobSink(item);
  }

  function createSink(item) {
    if (typeof sinkFactory === 'function') return sinkFactory(item);
    return defaultSink(item);
  }

  function releaseSink(sink, item, discard) {
    if (!sink) return;
    try {
      if (discard && typeof sink.abort === 'function') sink.abort();
      else if (typeof sink.close === 'function' && item && item.status === 'done') sink.close();
    } catch (e) { /* ignore */ }
  }

  function toBytes(value) {
    if (!value) return null;
    try {
      if (typeof Uint8Array !== 'undefined' && value instanceof Uint8Array) return value;
      if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return new Uint8Array(value);
      if (value.buffer && typeof value.byteLength === 'number') {
        return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
      }
      if (typeof value.length === 'number') return new Uint8Array(value);
    } catch (e) { return null; }
    return null;
  }

  function writeChunk(sink, chunk) {
    if (!sink || typeof sink.write !== 'function') return null;
    var result = sink.write(chunk);
    return (result && typeof result.then === 'function') ? result : null;
  }

  async function throttleChunk(rec, length) {
    var limit = Number(downloads.speedLimit) || 0;
    var now = Date.now();
    if (!rec.lastChunkAt) rec.lastChunkAt = now;
    if (limit > 0) {
      var expected = (length / limit) * 1000;
      var actual = now - rec.lastChunkAt;
      if (expected > actual) await sleep(expected - actual);
    }
    rec.lastChunkAt = Date.now();
  }

  async function transfer(item, rec, sink) {
    var signal = rec.ctrl ? rec.ctrl.signal : null;
    var restarts = 0;

    while (true) {
      if (signal && signal.aborted) throw abortError();

      var startByte = (item.supportsRange && item.received > 0) ? item.received : 0;
      if (!item.supportsRange && item.received > 0) {
        item.received = 0;
        item.progress = 0;
        if (typeof sink.reset === 'function') await Promise.resolve(sink.reset());
      }

      var headers = {};
      if (startByte > 0) headers.Range = 'bytes=' + startByte + '-';

      var res = await doFetch(item.url, {
        method: 'GET',
        headers: headers,
        signal: signal || undefined,
        redirect: 'follow',
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors'
      });

      if (!res) throw netError('empty response');

      if (!res.ok) {
        if (res.status === 416 && startByte > 0 && restarts < 2) {
          restarts += 1;
          item.supportsRange = false;
          item.received = 0;
          if (typeof sink.reset === 'function') await Promise.resolve(sink.reset());
          continue;
        }
        throw httpError(res.status);
      }

      var contentType = String(header(res, 'content-type') || '').split(';')[0].trim().toLowerCase();
      if (contentType && !item.contentType) item.contentType = contentType;
      if (item.kind === 'page' && contentType.indexOf('text/html') === 0) {
        throw unsupportedError(t('engine.error.page'));
      }

      var dispositionName = filenameFromDisposition(header(res, 'content-disposition'));
      var mimeExt = MIME_EXT[contentType] || '';
      if (dispositionName) {
        item.filename = safeName(dispositionName, U.extOf(dispositionName) || mimeExt);
      } else if (item.platform === 'direct' || item.platform === 'unknown') {
        if (mimeExt && U.extOf(item.filename) !== mimeExt) {
          item.filename = safeName(U.basename(item.url) || item.filename, mimeExt);
        }
      }
      if ((item.platform === 'direct' || item.platform === 'unknown') && mimeExt) {
        var mimeKind = U.guessType(mimeExt);
        if (mimeKind !== 'file') item.kind = mimeKind;
      }

      var total = 0;
      if (res.status === 206) {
        item.supportsRange = true;
        var rangeMatch = String(header(res, 'content-range') || '').match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
        if (rangeMatch && rangeMatch[3] !== '*') {
          total = parseInt(rangeMatch[3], 10);
          if (total > 0) item.size = total;
        }
      } else {
        if (startByte > 0) {
          item.supportsRange = false;
          item.received = 0;
          if (typeof sink.reset === 'function') await Promise.resolve(sink.reset());
        }
        var contentLength = parseInt(header(res, 'content-length'), 10);
        if (!isNaN(contentLength) && contentLength >= 0 && !header(res, 'content-encoding')) total = contentLength;
        if (total > 0) item.size = total;
      }
      if (/bytes/i.test(header(res, 'accept-ranges') || '')) item.supportsRange = true;

      var rangeStart = res.status === 206 ? startByte : 0;
      updateMemoryRisk(item);
      notify(item.id, item);

      var reader = (res.body && typeof res.body.getReader === 'function') ? res.body.getReader() : null;
      if (!reader) {
        if (typeof res.arrayBuffer === 'function') {
          var buffer = new Uint8Array(await res.arrayBuffer());
          if (buffer.length) {
            await writeChunk(sink, buffer);
            item.received = rangeStart + buffer.length;
            item.progress = item.size > 0 ? Math.min(1, item.received / item.size) : 0;
          }
        }
      } else {
        while (true) {
          if (signal && signal.aborted) {
            if (typeof reader.cancel === 'function') { try { reader.cancel(); } catch (e) { /* ignore */ } }
            throw abortError();
          }
          var step = await reader.read();
          if (!step || step.done) break;
          if (!step.value) continue;
          var chunk = toBytes(step.value);
          if (!chunk || !chunk.length) continue;
          await writeChunk(sink, chunk);
          item.received = (Number(item.received) || 0) + chunk.length;
          item.progress = item.size > 0 ? Math.min(1, item.received / item.size) : 0;
          updateMemoryRisk(item);
          await throttleChunk(rec, chunk.length);
          if (signal && signal.aborted) {
            if (typeof reader.cancel === 'function') { try { reader.cancel(); } catch (e) { /* ignore */ } }
            throw abortError();
          }
        }
      }

      var expected = Number(item.size) || 0;
      if (expected > 0 && item.received < expected && !header(res, 'content-encoding')) {
        throw netError('truncated');
      }
      return;
    }
  }

  function startTicker() {
    if (tickTimer) return;
    if (typeof setInterval !== 'function') return;
    tickTimer = setInterval(tick, SPEED_TICK);
    if (tickTimer && typeof tickTimer.unref === 'function') tickTimer.unref();
  }

  function stopTicker() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function tick() {
    var list = downloadsList();
    var now = Date.now();
    var active = 0;
    list.forEach(function (item) {
      if (item.status !== 'active') return;
      active += 1;
      var rec = running[item.id];
      if (!rec) return;
      var dt = rec.lastTick ? (now - rec.lastTick) / 1000 : 0;
      if (dt > 0) {
        var delta = Math.max(0, (Number(item.received) || 0) - (rec.lastReceived || 0));
        var instant = delta / dt;
        item.speed = Math.round(item.speed ? (item.speed * 0.6 + instant * 0.4) : instant);
        item.eta = (Number(item.size) > 0 && item.speed > 0)
          ? Math.max(0, (item.size - item.received) / item.speed)
          : null;
      }
      rec.lastTick = now;
      rec.lastReceived = Number(item.received) || 0;
      item.progress = Number(item.size) > 0 ? Math.min(1, item.received / item.size) : 0;
      updateMemoryRisk(item);
    });
    if (active) notify(null, null);
    else stopTicker();
  }

  function beginItem(item) {
    var previous = item._sink || null;
    item._sink = null;
    var sink = null;
    // 暂停后继续：保留已写入的接收端；否则重建（重建时旧句柄要丢弃）
    if (previous && item.received > 0 && item.supportsRange) {
      sink = previous;
    } else {
      if (previous && typeof previous.abort === 'function') {
        try { previous.abort(); } catch (e) { /* ignore */ }
      }
      try { sink = createSink(item); } catch (e) { sink = blobSink(item); }
    }

    var rec = {
      id: item.id,
      ctrl: (typeof AbortController !== 'undefined') ? new AbortController() : null,
      abortedReason: null,
      sink: null,
      sinkPromise: Promise.resolve(sink),
      lastTick: 0,
      lastReceived: 0,
      lastChunkAt: 0
    };
    running[item.id] = rec;

    item.status = 'active';
    item.error = null;
    item.errorHint = null;
    item.errorStatus = 0;
    item.speed = 0;
    item.eta = null;
    if (!item.startedAt) item.startedAt = Date.now();
    if (!(Number(item.received) >= 0)) item.received = 0;
    updateMemoryRisk(item);

    startTicker();
    notify(item.id, item);

    rec.promise = runItem(item, rec).then(null, function (err) {
      handleFailure(item, rec, err);
    });
    return rec;
  }

  async function runItem(item, rec) {
    var sink = await rec.sinkPromise;
    if (!sink) {
      rec.abortedReason = 'canceled';
      throw abortError();
    }
    rec.sink = sink;
    item.saveMode = sink.kind === 'fs' ? 'fs' : 'blob';
    updateMemoryRisk(item);

    await transfer(item, rec, sink);

    if (rec.ctrl && rec.ctrl.signal.aborted) throw abortError();

    var size = Number(item.size) || 0;
    if (size > 0 && item.received > size) item.received = size;
    item.progress = size > 0 ? 1 : 0;
    item.status = 'done';
    item.speed = 0;
    item.eta = 0;
    item.finishedAt = Date.now();
    item.elapsed = Math.max(0, item.finishedAt - (item.startedAt || item.finishedAt));
    if (sink.path) item.savedTo = sink.path;

    var closed = (typeof sink.close === 'function') ? sink.close() : null;
    if (closed && typeof closed.then === 'function') await closed;

    delete running[item.id];
    item._sink = null;

    if (OG.library && typeof OG.library.add === 'function') {
      var ext = U.extOf(item.filename) || '';
      try {
        OG.library.add({
          id: item.id,
          title: item.title || item.filename,
          filename: item.filename,
          platform: item.platform,
          kind: item.kind,
          size: item.received,
          thumb: item.thumb || '',
          url: item.url,
          ts: item.finishedAt,
          ext: ext,
          type: U.guessType(ext)
        });
      } catch (e) { /* 资料库失败不影响下载结果 */ }
    }

    notify(item.id, item);
    pump();
    checkIdle();
  }

  function handleFailure(item, rec, err) {
    if (running[item.id] !== rec) return;
    delete running[item.id];

    var reason = rec.abortedReason;
    var hint = classifyError(err);
    var inQueue = downloadsList().indexOf(item) >= 0;

    if (reason === 'retry') {
      if (inQueue) item.status = 'queued';
      item.received = 0;
      item.progress = 0;
      item.speed = 0;
      item.eta = null;
      item.finishedAt = 0;
      item.error = null;
      item.errorHint = null;
      item.errorStatus = 0;
      releaseSink(rec.sink, item, true);
      item._sink = null;
    } else if (reason === 'paused') {
      if (inQueue) item.status = 'paused';
      item.speed = 0;
      item.eta = null;
      item._sink = rec.sink || item._sink || null;
    } else if (reason === 'canceled' || hint === 'aborted') {
      if (inQueue) item.status = 'canceled';
      item.received = 0;
      item.progress = 0;
      item.speed = 0;
      item.eta = null;
      releaseSink(rec.sink, item, true);
      item._sink = null;
    } else {
      if (inQueue) item.status = 'error';
      item.errorHint = hint;
      item.error = errorMessage(err, hint);
      item.errorStatus = (err && err.status) || 0;
      item.received = 0;
      item.progress = 0;
      item.speed = 0;
      item.eta = null;
      releaseSink(rec.sink, item, true);
      item._sink = null;
    }

    rec.sink = null;
    notify(item.id, item);
    pump();
    checkIdle();
  }

  function pump() {
    var list = downloadsList();
    var limit = concurrencyLimit();
    var active = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].status === 'active') active += 1;
    }
    for (i = 0; i < list.length && active < limit; i++) {
      var item = list[i];
      if (item.status === 'queued' && !running[item.id]) {
        beginItem(item);
        active += 1;
      }
    }
    if (active === 0) {
      stopTicker();
      checkIdle();
    }
  }

  function resetItemForRetry(item) {
    item.received = 0;
    item.progress = 0;
    item.speed = 0;
    item.eta = null;
    item.error = null;
    item.errorHint = null;
    item.errorStatus = 0;
    item.finishedAt = 0;
    if (item._sink) {
      try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
      item._sink = null;
    }
  }

  function markUnsupported(item, reason) {
    item.status = 'error';
    item.speed = 0;
    item.eta = null;
    item.progress = 0;
    item.received = 0;
    if (reason === 'torrent') {
      item.errorHint = 'unsupported';
      item.error = t('engine.error.torrent');
      item.command = 'omniget "' + item.url + '"';
    } else if (reason === 'stream') {
      item.errorHint = 'unsupported';
      item.error = t('engine.error.stream');
      item.command = 'ffmpeg -i "' + item.url + '" -c copy output.mp4';
    } else if (reason === 'invalid') {
      item.errorHint = 'unsupported';
      item.error = t('engine.error.invalid');
    } else {
      item.errorHint = 'unsupported';
      item.error = t('engine.error.unsupported');
      item.command = 'yt-dlp "' + item.url + '"';
    }
    notify(item.id, item);
    schedulePersist();
    checkIdle();
    return item;
  }

  function isAttemptable(item) {
    if (item.platform === 'direct' || item.platform === 'unknown') return true;
    if (item.platform === 'torrent') return !!item.direct;
    return !!item.direct;
  }

  async function start(url, opts) {
    opts = opts || {};
    var raw = String(url === null || url === undefined ? '' : url).trim();
    var info = detectLink(raw);
    if (opts.info && typeof opts.info === 'object') {
      for (var key in opts.info) {
        if (Object.prototype.hasOwnProperty.call(opts.info, key)) info[key] = opts.info[key];
      }
    }
    var probed = opts.probe || null;
    var platform = opts.platform || info.platform || 'unknown';
    var kind = opts.kind || info.kind || 'unknown';
    var ext = opts.ext || info.ext || (probed && probed.ext) || '';
    var guessName = opts.filename || (probed && probed.filename) || info.filename || U.basename(raw) || 'download';
    var filename = safeName(guessName, ext);
    var size = Number(opts.size) || Number(probed && probed.size) || 0;
    var supportsRange = opts.supportsRange !== undefined
      ? !!opts.supportsRange
      : !!(probed && probed.supportsRange);

    var item = {
      id: U.uid(),
      url: (probed && probed.finalUrl) || raw,
      filename: filename,
      title: opts.title || '',
      platform: platform,
      kind: kind,
      ext: U.extOf(filename) || ext,
      size: size,
      received: 0,
      speed: 0,
      eta: null,
      progress: 0,
      status: 'queued',
      error: null,
      errorHint: null,
      errorStatus: 0,
      startedAt: 0,
      finishedAt: 0,
      elapsed: 0,
      thumb: opts.thumb || (probed && probed.thumb) || '',
      supportsRange: supportsRange,
      memoryRisk: false,
      command: '',
      contentType: (probed && probed.contentType) || '',
      direct: opts.direct !== undefined ? !!opts.direct : !!info.direct,
      stream: !!info.stream,
      saveMode: 'blob',
      addedAt: Date.now()
    };
    downloadsList().push(item);

    if (item.kind === 'torrent' || item.platform === 'torrent' || /^magnet:/i.test(raw)) {
      markUnsupported(item, 'torrent');
      return item;
    }
    if (!raw || !/^https?:\/\//i.test(raw)) {
      markUnsupported(item, 'invalid');
      return item;
    }
    if (item.kind === 'torrent' || item.platform === 'torrent') {
      if (!item.direct) {
        markUnsupported(item, 'torrent');
        return item;
      }
    }
    if (item.stream) {
      markUnsupported(item, 'stream');
      return item;
    }
    if (!isAttemptable(item)) {
      markUnsupported(item, 'platform');
      return item;
    }

    notify(item.id, item);
    pump();
    return item;
  }

  function pause(id) {
    var item = findItem(id);
    if (!item) return;
    var rec = running[id];
    if (rec) {
      rec.abortedReason = 'paused';
      if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
      return;
    }
    if (item.status === 'queued') {
      item.status = 'paused';
      item.speed = 0;
      item.eta = null;
      notify(item.id, item);
      schedulePersist();
      checkIdle();
    }
  }

  function resume(id) {
    var item = findItem(id);
    if (!item) return;
    if (['paused', 'error', 'canceled'].indexOf(item.status) < 0) return;
    if (item.status === 'error' || item.status === 'canceled') {
      item.received = 0;
      item.progress = 0;
      if (item._sink) {
        try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
        item._sink = null;
      }
    }
    item.status = 'queued';
    item.error = null;
    item.errorHint = null;
    item.errorStatus = 0;
    item.speed = 0;
    item.eta = null;
    item.finishedAt = 0;
    notify(item.id, item);
    pump();
  }

  function cancel(id) {
    var item = findItem(id);
    if (!item) return;
    if (item.status === 'done' || item.status === 'canceled') return;
    var rec = running[id];
    item.error = null;
    item.errorHint = null;
    item.errorStatus = 0;
    if (rec) {
      rec.abortedReason = 'canceled';
      if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
      return;
    }
    item.status = 'canceled';
    item.received = 0;
    item.progress = 0;
    item.speed = 0;
    item.eta = null;
    if (item._sink) {
      try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
      item._sink = null;
    }
    notify(item.id, item);
    schedulePersist();
    pump();
    checkIdle();
  }

  function retry(id) {
    var item = findItem(id);
    if (!item) return;
    if (item.status === 'done') return;
    var rec = running[id];
    if (rec) {
      rec.abortedReason = 'retry';
      if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
    }
    resetItemForRetry(item);
    item.status = 'queued';
    notify(item.id, item);
    if (!rec) pump();
  }

  function remove(id) {
    var list = downloadsList();
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { index = i; break; }
    }
    if (index < 0) return;
    var item = list[index];
    var rec = running[id];
    if (rec) {
      rec.abortedReason = 'canceled';
      if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
    }
    if (item._sink) {
      try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
      item._sink = null;
    }
    list.splice(index, 1);
    notify(null, null);
    schedulePersist();
    pump();
    checkIdle();
  }

  function clearCompleted() {
    var list = downloadsList();
    var kept = [];
    list.forEach(function (item) {
      if (item.status === 'done' || item.status === 'canceled') {
        var rec = running[item.id];
        if (rec) {
          rec.abortedReason = 'canceled';
          if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
        }
        if (item._sink) {
          try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
          item._sink = null;
        }
      } else {
        kept.push(item);
      }
    });
    OG.state.downloads = kept;
    notify(null, null);
    schedulePersist();
    checkIdle();
  }

  function stats() {
    var out = { active: 0, queued: 0, paused: 0, done: 0, failed: 0, canceled: 0, bytes: 0 };
    downloadsList().forEach(function (item) {
      var key = item.status === 'error' ? 'failed' : item.status;
      if (out[key] !== undefined) out[key] += 1;
      out.bytes += Number(item.received) || 0;
    });
    return out;
  }

  function resetEngine() {
    var list = downloadsList();
    list.forEach(function (item) {
      var rec = running[item.id];
      if (rec) {
        rec.abortedReason = 'canceled';
        if (rec.ctrl) { try { rec.ctrl.abort(); } catch (e) { /* ignore */ } }
      }
      if (item._sink) {
        try { if (typeof item._sink.abort === 'function') item._sink.abort(); } catch (e) { /* ignore */ }
        item._sink = null;
      }
    });
    running = Object.create(null);
    OG.state.downloads = [];
    idleWaiters = [];
    stopTicker();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (typeof OG.emit === 'function') {
      try { OG.emit('downloads:update', { id: null, item: null }); } catch (e) { /* ignore */ }
    }
  }

  var downloads = {
    queue: function () { return downloadsList().slice(); },
    get: function (id) { return findItem(id); },
    start: start,
    pause: pause,
    resume: resume,
    cancel: cancel,
    retry: retry,
    remove: remove,
    clearCompleted: clearCompleted,
    stats: stats,
    restore: restore,
    // views.js 传的是 MB/s；0 = 不限速（与 settings.speedLimit 语义一致）
    setSpeedLimit: function (mbPerSecond) {
      var n = Number(mbPerSecond);
      speedLimitOverride = (isFinite(n) && n > 0) ? n * 1024 * 1024 : 0;
    }
  };

  Object.defineProperty(downloads, 'speedLimit', {
    enumerable: true,
    configurable: true,
    get: function () {
      if (speedLimitOverride !== null) return speedLimitOverride;
      var setting = Number(OG.state && OG.state.settings && OG.state.settings.speedLimit) || 0;
      return setting > 0 ? setting * 1024 * 1024 : 0;
    },
    set: function (value) {
      var n = Number(value);
      speedLimitOverride = (isFinite(n) && n > 0) ? n : 0;
    }
  });

  /* ============================================================
   * 8. 播放器（DOM）
   * ========================================================== */
  function srtToVtt(input) {
    var text = String(input === null || input === undefined ? '' : input)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    if (!text.trim()) return 'WEBVTT\n\n';
    var trimmed = text.replace(/^\n+/, '');
    if (/^WEBVTT/.test(trimmed)) {
      return trimmed.replace(/\n*$/, '\n');
    }
    var body = trimmed
      .replace(/(\d{1,3}):(\d{2})(?::(\d{2}))?,(\d{3})/g, function (m, a, b, c, d) {
        return c === undefined ? a + ':' + b + '.' + d : a + ':' + b + ':' + c + '.' + d;
      })
      .replace(/(^|[\s>])(\d{1,3}):(\d{2})(?::(\d{2}))?\.(\d{3})/g, function (m, prefix, a, b, c, d) {
        if (c === undefined) return prefix + pad2(a) + ':' + b + '.' + d;
        return prefix + pad2(a) + ':' + b + ':' + c + '.' + d;
      });
    body = body.replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
    return 'WEBVTT\n\n' + body;
  }

  function openPlayer(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return null;
    var file = opts.file || null;
    var remote = opts.url ? String(opts.url) : '';
    if (!file && !remote) return null;

    var name = file
      ? (file.name || 'media')
      : (opts.title || pageName(remote) || t('engine.player.title'));
    var mime = file ? String(file.type || '') : '';
    var ext = U.extOf(name) || U.extOf(remote);
    var isAudio = mime.indexOf('audio/') === 0 || (!mime && U.guessType(ext) === 'audio');
    var kind = isAudio ? 'audio' : 'video';
    var objectUrls = [];
    var src = remote;
    if (file) {
      try {
        src = URL.createObjectURL(file);
        objectUrls.push(src);
      } catch (e) {
        return null;
      }
    }

    var wrap = document.createElement('div');
    wrap.className = 'og-player';

    var media = document.createElement(kind === 'audio' ? 'audio' : 'video');
    media.className = 'og-player__media';
    media.setAttribute('controls', 'controls');
    media.setAttribute('playsinline', 'playsinline');
    media.setAttribute('preload', 'metadata');
    media.src = src;
    if (kind === 'video') {
      media.style.width = '100%';
      media.style.maxHeight = '62vh';
      media.style.borderRadius = '12px';
      media.style.background = '#000';
    } else {
      media.style.width = '100%';
    }
    wrap.appendChild(media);

    var bar = document.createElement('div');
    bar.className = 'og-player__bar';

    var speedLabel = document.createElement('span');
    speedLabel.className = 'og-player__label';
    speedLabel.textContent = t('engine.player.speed');
    bar.appendChild(speedLabel);

    var speedButtons = [];
    [0.5, 1, 1.25, 1.5, 2].forEach(function (rate) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'og-btn og-btn--sm og-btn--ghost' + (rate === 1 ? ' is-active' : '');
      button.textContent = rate + '×';
      button.setAttribute('aria-label', t('engine.player.speed') + ' ' + rate + '×');
      button.addEventListener('click', function () {
        try { media.playbackRate = rate; } catch (e) { /* ignore */ }
        speedButtons.forEach(function (node) {
          node.classList.toggle('is-active', node === button);
        });
      });
      speedButtons.push(button);
      bar.appendChild(button);
    });

    var hint = document.createElement('p');
    hint.className = 'og-hint';
    hint.textContent = t('engine.player.dragHint');

    var subInput = document.createElement('input');
    subInput.type = 'file';
    subInput.accept = '.srt,.vtt,text/vtt,application/x-subrip';
    subInput.hidden = true;
    subInput.setAttribute('aria-hidden', 'true');
    var subButton = document.createElement('button');
    subButton.type = 'button';
    subButton.className = 'og-btn og-btn--sm og-btn--ghost';
    subButton.textContent = t('engine.player.loadSubtitle');
    subButton.addEventListener('click', function () { subInput.click(); });
    subInput.addEventListener('change', function () {
      var picked = subInput.files && subInput.files[0];
      if (picked) loadSubtitle(picked);
      else if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.noFile'), 'info');
      subInput.value = '';
    });
    bar.appendChild(subButton);
    wrap.appendChild(subInput);

    var trackUrl = null;
    function loadSubtitle(subFile) {
      if (typeof FileReader === 'undefined') return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var rawText = String(reader.result || '');
          var needsConvert = U.extOf(subFile.name) === 'srt' || !/^\s*WEBVTT/.test(rawText);
          var vttText = needsConvert ? srtToVtt(rawText) : rawText;
          var blob = new Blob([vttText], { type: 'text/vtt' });
          if (trackUrl) {
            try { URL.revokeObjectURL(trackUrl); } catch (e) { /* ignore */ }
          }
          trackUrl = URL.createObjectURL(blob);
          objectUrls.push(trackUrl);
          Array.prototype.slice.call(media.querySelectorAll('track')).forEach(function (node) {
            try { node.remove(); } catch (e) { /* ignore */ }
          });
          var track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = String(subFile.name || 'subtitle').replace(/\.[^.]+$/, '');
          track.srclang = (OG.state && OG.state.lang === 'en') ? 'en' : 'zh';
          track.src = trackUrl;
          track.default = true;
          media.appendChild(track);
          hint.textContent = t('engine.player.subtitleOn');
          setTimeout(function () {
            try {
              if (media.textTracks) {
                for (var i = 0; i < media.textTracks.length; i++) media.textTracks[i].mode = 'showing';
              }
            } catch (e) { /* ignore */ }
          }, 60);
        } catch (e) {
          if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.subtitleFail'), 'error');
        }
      };
      reader.onerror = function () {
        if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.subtitleFail'), 'error');
      };
      reader.readAsText(subFile);
    }

    var fullscreenButton = document.createElement('button');
    fullscreenButton.type = 'button';
    fullscreenButton.className = 'og-btn og-btn--sm og-btn--ghost';
    fullscreenButton.textContent = t('engine.player.fullscreen');
    fullscreenButton.addEventListener('click', function () {
      try {
        if (typeof media.requestFullscreen === 'function') media.requestFullscreen();
        else if (typeof media.webkitEnterFullscreen === 'function') media.webkitEnterFullscreen();
      } catch (e) { /* ignore */ }
    });
    bar.appendChild(fullscreenButton);

    var downloadLink = document.createElement('a');
    downloadLink.className = 'og-btn og-btn--sm og-btn--ghost';
    downloadLink.href = src;
    downloadLink.textContent = t('engine.player.download');
    if (file) downloadLink.setAttribute('download', file.name || 'media');
    else {
      downloadLink.setAttribute('target', '_blank');
      downloadLink.setAttribute('rel', 'noopener');
    }
    bar.appendChild(downloadLink);

    wrap.appendChild(bar);
    wrap.appendChild(hint);

    media.addEventListener('error', function () {
      hint.textContent = remote ? t('engine.player.corsHint') : t('engine.player.cannotPlay');
      if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.cannotPlay'), 'error');
    });

    function cleanup() {
      try { media.pause(); } catch (e) { /* ignore */ }
      try {
        media.removeAttribute('src');
        if (typeof media.load === 'function') media.load();
      } catch (e) { /* ignore */ }
      objectUrls.forEach(function (url) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      });
      objectUrls.length = 0;
    }

    if (OG.ui && typeof OG.ui.modal === 'function') {
      return OG.ui.modal({
        title: name,
        subtitle: remote
          ? t('engine.player.urlTitle')
          : (kind === 'audio' ? t('engine.player.audio') : t('engine.player.video')),
        body: wrap,
        wide: true,
        onClose: cleanup
      });
    }
    return null;
  }

  function openLocalFile(file) {
    if (!file) return null;
    if (typeof document === 'undefined') return null;
    if (!(file instanceof Blob) && typeof file.name !== 'string') return null;
    return openPlayer({ file: file });
  }

  function openWithPicker() {
    if (typeof document === 'undefined') return null;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*,.mkv,.avi,.flac,.m4a';
    input.hidden = true;
    input.setAttribute('aria-hidden', 'true');
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      try { input.remove(); } catch (e) { /* ignore */ }
      if (file) openLocalFile(file);
      else if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.noFile'), 'info');
    });
    input.click();
    return input;
  }

  function openUrl(url) {
    if (typeof document === 'undefined') return null;
    var raw = String(url === null || url === undefined ? '' : url).trim();
    if (!raw) return null;
    var modal = openPlayer({ url: raw });
    if (!modal && OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.cannotPlay'), 'error');
    return modal;
  }

  /**
   * 播放“已下载”条目。浏览器版拿不到磁盘文件句柄，只能回退到原始直链；
   * Android 桥会覆盖此方法，直接交给系统播放器打开真实文件。
   */
  function playDownloaded(item) {
    if (!item) return null;
    if (typeof document === 'undefined') return null;
    if (item.url && /^https?:\/\//i.test(item.url)) return openUrl(item.url);
    if (OG.ui && OG.ui.toast) OG.ui.toast(t('engine.player.cannotPlay'), 'warn');
    return null;
  }

  var player = {
    openLocalFile: openLocalFile,
    openFile: openLocalFile,
    openWithPicker: openWithPicker,
    openUrl: openUrl,
    playDownloaded: playDownloaded,
    srtToVtt: srtToVtt
  };

  /* ============================================================
   * 9. 暴露 API
   * ========================================================== */
  var engine = {
    version: VERSION,
    PLATFORMS: PLATFORMS,
    detectLink: detectLink,
    probe: probe,
    fetchMeta: fetchMeta,
    downloads: downloads,
    player: player,
    _setFetch: function (fn) {
      fetchOverride = typeof fn === 'function' ? fn : null;
    },
    _setSink: function (fn) {
      sinkFactory = typeof fn === 'function' ? fn : null;
    },
    _reset: resetEngine,
    _whenIdle: whenIdle,
    _impl: {
      srtToVtt: srtToVtt,
      filenameFromDisposition: filenameFromDisposition,
      safeName: safeName,
      classifyError: classifyError,
      toBytes: toBytes,
      pad2: pad2
    }
  };

  Object.defineProperty(engine, 'fetchImpl', {
    enumerable: true,
    configurable: true,
    get: function () { return currentFetch(); },
    set: function (fn) { fetchOverride = typeof fn === 'function' ? fn : null; }
  });

  OG.PLATFORMS = PLATFORMS;
  OG.detectLink = detectLink;
  OG.probe = probe;
  OG.fetchMeta = fetchMeta;
  OG.downloads = downloads;
  OG.player = player;
  OG.engine = engine;

  // 恢复上次的队列元数据（只恢复元信息，不恢复二进制；失败静默）
  try { restore(); } catch (e) { /* ignore */ }
})();
