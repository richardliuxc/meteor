/* ============================================================
 * OmniGet Studio · 单文件版
 * android-bridge.js — Android WebView 原生桥接（仅在 APK 内加载）
 *
 * 提供浏览器做不到的能力：
 *  - 原生 HTTP 探测（绕过 CORS，拿到真实大小/类型）
 *  - 原生 DownloadManager 下载（大文件不进内存，写入系统下载目录）
 *  - 本地文件保存（工具生成的图片/JSON）
 *  - 打开已下载文件、复制、Toast、外部浏览器
 * ============================================================ */
(function () {
  'use strict';

  var OG = window.OG;
  if (!OG) return;
  var Native = window.OGNative;
  if (!Native) return; // 普通浏览器：保持原有实现

  document.documentElement.setAttribute('data-platform', 'android');
  OG.isAndroid = true;

  var pending = new Map();
  var seq = 0;

  window.__OGNATIVE__ = {
    resolve: function (id, payloadJson) {
      var p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);
      try {
        p.resolve(typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson);
      } catch (e) {
        p.reject(e);
      }
    }
  };

  function call(method, args, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = 'c' + (++seq);
      var timer = setTimeout(function () {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error('native timeout: ' + method));
      }, timeoutMs || 25000);
      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      try {
        Native[method].apply(Native, (args || []).concat([id]));
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  }

  function emit() { OG.emit('downloads:update'); }

  /* ---------- 1. 原生探测（无 CORS 限制） ---------- */
  OG.engine = OG.engine || {};
  OG.engine.probe = function (url) {
    return call('probe', [String(url)]).then(function (r) {
      if (r && r.ok) {
        return {
          ok: true,
          status: r.status,
          size: r.size || 0,
          contentType: r.contentType || '',
          ext: OG.utils.extOf(r.filename || url),
          filename: r.filename || OG.utils.basename(url),
          supportsRange: !!r.supportsRange,
          finalUrl: r.finalUrl || url
        };
      }
      return {
        ok: false,
        status: r && r.status,
        error: (r && r.error) || 'network'
      };
    });
  };

  /* ---------- 2. 原生下载引擎 ---------- */
  OG.state.downloads = OG.state.downloads || [];
  var timers = {};

  function findItem(id) {
    for (var i = 0; i < OG.state.downloads.length; i++) {
      if (OG.state.downloads[i].id === id) return OG.state.downloads[i];
    }
    return null;
  }

  function stopPolling(item) {
    if (timers[item.id]) {
      clearInterval(timers[item.id]);
      delete timers[item.id];
    }
  }

  function mapStatus(st) {
    var s = st && st.status;
    if (s === 'successful') return 'done';
    if (s === 'failed' || s === 'missing') return 'error';
    if (s === 'paused') return 'paused';
    if (s === 'pending') return 'queued';
    return 'active';
  }

  function startPolling(item) {
    stopPolling(item);
    var lastBytes = 0;
    var lastTime = Date.now();
    timers[item.id] = setInterval(function () {
      if (!item.nativeId || item.status === 'canceled') { stopPolling(item); return; }
      var st = null;
      try { st = JSON.parse(Native.status(String(item.nativeId))); } catch (e) { st = null; }
      if (!st) return;

      var now = Date.now();
      var downloaded = Number(st.downloaded) || 0;
      var total = Number(st.total) || 0;
      if (total > 0) item.size = total;
      item.received = downloaded;
      if (st.title) item.actualFilename = st.title;
      var dt = (now - lastTime) / 1000;
      if (dt > 0.3) {
        var instSpeed = Math.max(0, (downloaded - lastBytes) / dt);
        item.speed = item.speed ? item.speed * 0.6 + instSpeed * 0.4 : instSpeed;
        lastBytes = downloaded;
        lastTime = now;
      }
      if (item.size && item.speed > 0) item.eta = Math.max(0, (item.size - downloaded) / item.speed);

      var mapped = mapStatus(st);
      if (mapped === 'done') {
        item.status = 'done';
        item.received = item.size = total > 0 ? total : downloaded;
        item.speed = 0;
        item.eta = 0;
        item.finishedAt = Date.now();
        item.filename = st.title || item.filename;
        stopPolling(item);
        OG.library.add({
          id: item.id,
          title: item.filename || item.url,
          filename: item.filename || '',
          platform: item.platform || 'direct',
          kind: item.kind || OG.utils.guessType(OG.utils.extOf(item.filename || item.url)),
          size: item.size || downloaded,
          thumb: item.thumb || '',
          url: item.url,
          ts: Date.now()
        });
        OG.ui.toast(OG.t('toast.downloadDone'), 'success');
      } else if (mapped === 'error') {
        item.status = 'error';
        item.error = 'network';
        item.errorHint = 'network';
        item.speed = 0;
        stopPolling(item);
        OG.ui.toast(OG.t('toast.downloadFailed'), 'error');
      } else if (mapped === 'paused') {
        item.status = 'paused';
      } else if (mapped === 'queued') {
        item.status = 'queued';
      } else if (item.status !== 'paused') {
        item.status = 'active';
      }
      emit();
    }, 700);
  }

  function enqueue(item) {
    return call('enqueue', [item.url, item.filename || '', item.mime || '']).then(function (res) {
      item.nativeId = res && res.id;
      item.status = 'active';
      item.startedAt = Date.now();
      item.error = null;
      item.errorHint = null;
      emit();
      startPolling(item);
      return item;
    });
  }

  OG.downloads = {
    queue: function () { return OG.state.downloads.slice(); },
    start: function (url, opts) {
      opts = opts || {};
      var link = (OG.detectLink && OG.detectLink(url)) || {
        url: url, platform: 'direct', kind: 'file',
        filename: OG.utils.basename(url), direct: true
      };
      if (link.platform && link.platform !== 'direct' && link.platform !== 'unknown' && !link.direct) {
        return Promise.reject(new Error(OG.t('preview.error.unsupported')));
      }
      var filename = opts.filename || link.filename || OG.utils.basename(url) || 'download';
      var item = {
        id: OG.utils.uid(),
        url: url,
        filename: filename,
        platform: link.platform || 'direct',
        kind: link.kind || OG.utils.guessType(OG.utils.extOf(filename || url)),
        mime: '',
        size: opts.size || 0,
        received: 0,
        speed: 0,
        eta: null,
        status: 'queued',
        error: null,
        errorHint: null,
        startedAt: Date.now(),
        nativeId: null,
        thumb: opts.thumb || ''
      };
      OG.state.downloads.push(item);
      emit();
      return new Promise(function (resolve, reject) {
        enqueue(item).then(resolve).catch(function (err) {
          item.status = 'error';
          item.error = err && err.message ? err.message : 'network';
          item.errorHint = 'network';
          emit();
          reject(err);
        });
      });
    },
    pause: function (id) {
      var item = findItem(id);
      if (!item || !item.nativeId) return;
      try { Native.pause(String(item.nativeId)); } catch (e) {}
      item.status = 'paused';
      emit();
    },
    resume: function (id) {
      var item = findItem(id);
      if (!item || !item.nativeId) return;
      try { Native.resume(String(item.nativeId)); } catch (e) {}
      item.status = 'active';
      startPolling(item);
      emit();
    },
    cancel: function (id) {
      var item = findItem(id);
      if (!item) return;
      stopPolling(item);
      if (item.nativeId) { try { Native.cancel(String(item.nativeId)); } catch (e) {} }
      item.status = 'canceled';
      item.speed = 0;
      emit();
    },
    retry: function (id) {
      var item = findItem(id);
      if (!item) return Promise.resolve();
      stopPolling(item);
      item.received = 0;
      item.size = item.size || 0;
      item.speed = 0;
      item.eta = 0;
      item.status = 'queued';
      item.error = null;
      item.errorHint = null;
      emit();
      return enqueue(item).catch(function () {});
    },
    remove: function (id) {
      var item = findItem(id);
      if (!item) return;
      stopPolling(item);
      if (item.nativeId) { try { Native.cancel(String(item.nativeId)); } catch (e) {} }
      OG.state.downloads = OG.state.downloads.filter(function (x) { return x.id !== id; });
      emit();
    },
    clearCompleted: function () {
      OG.state.downloads = OG.state.downloads.filter(function (x) {
        return x.status !== 'done' && x.status !== 'canceled';
      });
      emit();
    },
    setSpeedLimit: function () {
      /* DownloadManager 不支持限速，保留 API 兼容 */
    },
    stats: function () {
      var list = OG.state.downloads;
      return {
        active: list.filter(function (x) { return x.status === 'active'; }).length,
        queued: list.filter(function (x) { return x.status === 'queued'; }).length,
        done: list.filter(function (x) { return x.status === 'done'; }).length,
        failed: list.filter(function (x) { return x.status === 'error'; }).length
      };
    }
  };

  /* ---------- 3. 播放器：原生打开已下载文件 ---------- */
  OG.player = OG.player || {};
  OG.player.playDownloaded = function (item) {
    if (item && item.nativeId) {
      try { Native.openFile(String(item.nativeId)); return; } catch (e) {}
    }
    if (item && item.url && OG.player.openUrl) OG.player.openUrl(item.url);
  };

  /* ---------- 4. 本地生成文件保存（blob / data URL） ---------- */
  function saveBase64(name, mime, base64) {
    return call('saveBase64', [name || 'omniget-file', mime || 'application/octet-stream', base64], 60000)
      .then(function (res) {
        if (res && res.ok) {
          OG.ui.toast(OG.t('toast.saved'), 'success');
        } else {
          OG.ui.toast(OG.t('toast.saved') + ' (?)', 'warn');
        }
      })
      .catch(function () {
        OG.ui.toast(OG.t('toast.importFail'), 'error');
      });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function saveBlobUrl(url, name, mime) {
    if (url.indexOf('data:') === 0) {
      var comma = url.indexOf(',');
      var meta = url.slice(0, comma);
      var payload = url.slice(comma + 1);
      var isBase64 = /;base64/i.test(meta);
      var type = (meta.match(/data:([^;,]+)/) || [])[1] || mime || 'application/octet-stream';
      if (isBase64) {
        saveBase64(name, type, payload);
      } else {
        saveBase64(name, type, btoa(unescape(encodeURIComponent(decodeURIComponent(payload)))));
      }
      return;
    }
    fetch(url).then(function (r) { return r.blob(); }).then(function (blob) {
      return blobToBase64(blob).then(function (b64) { saveBase64(name, blob.type || mime, b64); });
    }).catch(function () {
      OG.ui.toast(OG.t('toast.importFail'), 'error');
    });
  }

  /* 拦截 <a download> 的 blob/data/远程链接，交给原生保存 */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var name = a.getAttribute('download') || 'omniget-file';
    if (href.indexOf('blob:') === 0 || href.indexOf('data:') === 0) {
      e.preventDefault();
      e.stopPropagation();
      saveBlobUrl(href, name, a.getAttribute('type') || '');
    } else if (/^https?:/i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      OG.downloads.start(href, { filename: name }).catch(function () {
        try { Native.openUrl(href); } catch (err) {}
      });
    }
  }, true);

  /* 外部链接：交给系统浏览器 */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"]') : null;
    if (!a) return;
    e.preventDefault();
    try { Native.openUrl(a.getAttribute('href')); } catch (err) {}
  }, true);

  var nativeWindowOpen = window.open;
  window.open = function (url) {
    if (url) {
      try { Native.openUrl(String(url)); } catch (e) {}
      return null;
    }
    return nativeWindowOpen ? nativeWindowOpen.apply(window, arguments) : null;
  };

  /* ---------- 5. 本地引擎（127.0.0.1）绕过 CORS ---------- */
  OG.androidHttp = function (url, method, body) {
    return call('httpJson', [String(url), method || 'GET', body || ''], 200000).then(function (data) {
      if (data && data.ok === false && data.error) throw new Error(data.error);
      return data;
    });
  };

  OG.openDownloadsFolder = function () {
    try { Native.openDownloadsFolder(); } catch (e) {}
  };

  /* ---------- 6. 剪贴板 / 系统集成 ---------- */
  var originalCopy = OG.utils.copyText;
  OG.utils.copyText = function (text) {
    try {
      Native.copyText(String(text === null || text === undefined ? '' : text));
      return Promise.resolve(true);
    } catch (e) {
      return originalCopy ? originalCopy(text) : Promise.resolve(false);
    }
  };

  OG.android = {
    available: true,
    toast: function (msg) { try { Native.toast(String(msg)); } catch (e) {} },
    openUrl: function (url) { try { Native.openUrl(String(url)); } catch (e) {} },
    info: function () {
      try { return JSON.parse(Native.appInfo()); } catch (e) { return null; }
    }
  };

  /* 启动时同步一次应用信息，便于"关于"页展示 */
  OG.on('app:ready', function () {
    var info = OG.android.info();
    if (info) OG.androidInfo = info;
  });
})();
