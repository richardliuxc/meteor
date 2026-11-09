/* ============================================================
 * Meteor · 本地引擎客户端（local-engine.js）
 *
 * 通过 127.0.0.1 调用手机本地的 yt-dlp 服务（server/ytdlp_server.py）。
 * - 浏览器：fetch + CORS
 * - APK：优先走原生桥（不受 CORS/混合内容限制）
 * 本地引擎负责 YouTube/1800+ 站点的解析与下载，仍无云端后台。
 * ============================================================ */
(function () {
  'use strict';

  var OG = window.OG;
  if (!OG) return;
  var t = OG.t;
  var LS_KEY = 'meteor.engine.url';
  var DEFAULT_BASE = 'http://127.0.0.1:8791';

  OG.addDict({
    zh: {
      'engine.local.name': '本地引擎',
      'engine.local.short': '引擎',
      'engine.local.online': '本地引擎在线',
      'engine.local.offline': '本地引擎未连接',
      'engine.local.checking': '检测中…',
      'engine.local.check': '检测连接',
      'engine.local.url': '引擎地址',
      'engine.local.save': '保存地址',
      'engine.local.hint': '本地引擎运行在 DSH Go 的 Ubuntu 环境里（yt-dlp + ffmpeg），只监听 127.0.0.1，不经过任何服务器。',
      'engine.local.help': '如何启动',
      'engine.local.copyCmd': '复制启动命令',
      'engine.local.cmd': 'cd /root/workspace/omniget-studio/server && python3 ytdlp_server.py --port 8791',
      'engine.local.offline.note': '本地引擎未连接：先在 DSH Go 的本地环境启动引擎，再回来点“重新检测”。',
      'engine.local.quality': '清晰度',
      'engine.local.quality.best': '最佳画质',
      'engine.local.quality.audio': '仅音频 (MP3)',
      'engine.local.download': '用本地引擎下载',
      'engine.local.detecting': '正在获取视频信息…',
      'engine.local.failed': '本地引擎解析失败',
      'engine.local.jobStarted': '已交给本地引擎下载',
      'engine.local.fileMissing': '文件已删除',
      'engine.local.openFolder': '打开下载目录',
      'engine.local.platform': '本地引擎',
      'engine.local.live': '直播',
      'engine.local.duration': '{d} 分钟',
      'engine.local.settings': '本地引擎（yt-dlp）',
      'engine.local.settings.hint': '开启后，YouTube、B 站等平台链接会交给本地 yt-dlp 下载。',
      'engine.local.note': '由本地 yt-dlp 下载，文件保存到“下载/DSH-Go/Meteor”，只经过 127.0.0.1。',
      'engine.local.processing': '合并中…',
      'engine.local.recheck': '重新检测'
    },
    en: {
      'engine.local.name': 'Local engine',
      'engine.local.short': 'Engine',
      'engine.local.online': 'Local engine online',
      'engine.local.offline': 'Local engine offline',
      'engine.local.checking': 'Checking…',
      'engine.local.check': 'Check connection',
      'engine.local.url': 'Engine URL',
      'engine.local.save': 'Save URL',
      'engine.local.hint': 'The local engine runs inside DSH Go\'s Ubuntu runtime (yt-dlp + ffmpeg) and listens on 127.0.0.1 only. No cloud involved.',
      'engine.local.help': 'How to start',
      'engine.local.copyCmd': 'Copy start command',
      'engine.local.cmd': 'cd /root/workspace/omniget-studio/server && python3 ytdlp_server.py --port 8791',
      'engine.local.offline.note': 'Local engine is offline. Start it in DSH Go\'s local environment, then check again.',
      'engine.local.quality': 'Quality',
      'engine.local.quality.best': 'Best available',
      'engine.local.quality.audio': 'Audio only (MP3)',
      'engine.local.download': 'Download with local engine',
      'engine.local.detecting': 'Fetching video info…',
      'engine.local.failed': 'Local engine could not parse this link',
      'engine.local.jobStarted': 'Handed to the local engine',
      'engine.local.fileMissing': 'File was deleted',
      'engine.local.openFolder': 'Open download folder',
      'engine.local.platform': 'Local engine',
      'engine.local.live': 'Live',
      'engine.local.duration': '{d} min',
      'engine.local.settings': 'Local engine (yt-dlp)',
      'engine.local.settings.hint': 'When online, YouTube, Bilibili and similar links are downloaded by local yt-dlp.',
      'engine.local.note': 'Downloaded by local yt-dlp into Downloads/DSH-Go/Meteor, via 127.0.0.1 only.',
      'engine.local.processing': 'Merging…',
      'engine.local.recheck': 'Check again'
    }
  });

  var LE = {
    base: (function () {
      try { return localStorage.getItem(LS_KEY) || DEFAULT_BASE; } catch (e) { return DEFAULT_BASE; }
    })(),
    online: false,
    checking: false,
    lastCheck: 0,
    lastError: '',
    _pollTimer: null,
    _knownJobs: {}
  };
  OG.localEngine = LE;

  function el(id) { return document.getElementById(id); }

  function updateChip() {
    var chip = el('og-engine-chip');
    if (!chip) return;
    chip.classList.toggle('is-online', LE.online);
    chip.classList.toggle('is-offline', !LE.online && !LE.checking);
    chip.classList.toggle('is-checking', LE.checking);
    var text = chip.querySelector('.og-engine-chip__text');
    if (text) text.textContent = t('engine.local.short');
    chip.setAttribute('title', LE.checking ? t('engine.local.checking') : LE.online ? t('engine.local.online') : t('engine.local.offline'));
  }

  function raw(path, opts) {
    opts = opts || {};
    var url = LE.base.replace(/\/+$/, '') + path;
    var method = opts.method || 'GET';
    var body = opts.body || null;

    if (typeof OG.androidHttp === 'function') {
      return OG.androidHttp(url, method, body).then(function (data) {
        if (data && data.ok === false && data.error) throw new Error(data.error);
        return data;
      });
    }

    var ctrl = null;
    var timer = null;
    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 20000);
    }
    var init = {
      method: method,
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    };
    if (body) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = body;
    }
    return fetch(url, init).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }
        if (!data) throw new Error('bad response from local engine');
        if (data.ok === false && data.error) throw new Error(data.error);
        return data;
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  LE.check = function (force) {
    var now = Date.now();
    if (!force && now - LE.lastCheck < 6000) return Promise.resolve(LE.online);
    LE.checking = true;
    updateChip();
    LE.lastCheck = now;
    return raw('/health', { timeout: 3500 }).then(function (data) {
      LE.online = !!(data && data.ok && data.service === 'meteor-local');
      LE.lastError = '';
      if (LE.online) ensurePolling();
      return LE.online;
    }).catch(function (err) {
      LE.online = false;
      LE.lastError = String(err && err.message ? err.message : err);
      return false;
    }).then(function (ok) {
      LE.checking = false;
      updateChip();
      OG.emit('engine:status', { online: ok });
      return ok;
    });
  };

  LE.setBase = function (url) {
    var value = String(url || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) return false;
    LE.base = value;
    try { localStorage.setItem(LS_KEY, value); } catch (e) { }
    LE.online = false;
    LE.lastCheck = 0;
    updateChip();
    return true;
  };

  LE.info = function (url) {
    return raw('/info?url=' + encodeURIComponent(url), { timeout: 90000 });
  };

  LE.start = function (url, quality) {
    return raw('/download', {
      method: 'POST',
      body: JSON.stringify({ url: url, quality: quality || 'best' }),
      timeout: 30000
    }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'start failed');
      if (res.job) mergeJob(res.job);
      ensurePolling();
      return res;
    });
  };

  LE.cancel = function (jobId) {
    return raw('/cancel?id=' + encodeURIComponent(jobId), { timeout: 8000 }).catch(function () { });
  };

  LE.jobs = function () {
    return raw('/jobs', { timeout: 8000 });
  };

  LE.fileUrl = function (jobId) {
    return LE.base.replace(/\/+$/, '') + '/file?id=' + encodeURIComponent(jobId);
  };

  function jobStatusToItem(s) {
    if (s === 'downloading' || s === 'processing') return 'active';
    if (s === 'done') return 'done';
    if (s === 'error') return 'error';
    if (s === 'canceled') return 'canceled';
    return 'queued';
  }

  function kindOf(job) {
    var name = job.filename || job.title || '';
    var ext = OG.utils.extOf(name);
    if (job.quality === 'audio' || job.quality === 'mp3' || job.quality === 'm4a') return 'audio';
    return OG.utils.guessType(ext) === 'file' ? 'video' : OG.utils.guessType(ext);
  }

  function findItem(engineId) {
    var list = OG.state.downloads || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].engineId === engineId) return list[i];
    }
    return null;
  }

  function mergeJob(job) {
    if (!job || !job.id) return;
    var item = findItem(job.id);
    var status = jobStatusToItem(job.status);
    if (!item) {
      item = {
        id: 'eng-' + job.id,
        engineId: job.id,
        source: 'engine',
        url: job.url,
        filename: job.filename || job.title || job.url,
        title: job.title || job.filename || job.url,
        platform: 'local',
        kind: kindOf(job),
        size: Number(job.total) || 0,
        received: Number(job.downloaded) || 0,
        speed: Number(job.speed) || 0,
        eta: job.eta === null || job.eta === undefined ? null : job.eta,
        status: status,
        error: job.error || '',
        errorHint: status === 'error' ? 'network' : null,
        progress: Number(job.percent) || 0,
        thumb: job.thumbnail || '',
        quality: job.quality || 'best',
        startedAt: job.startedAt || Date.now(),
        finishedAt: job.finishedAt || 0,
        supportsRange: true,
        memoryRisk: false,
        command: ''
      };
      OG.state.downloads.push(item);
      OG.emit('downloads:update');
    } else {
      var wasDone = item.status === 'done';
      item.title = job.title || item.title;
      item.filename = job.filename || item.filename;
      item.thumb = job.thumbnail || item.thumb;
      item.size = Number(job.total) || item.size;
      item.received = Number(job.downloaded) || item.received;
      item.speed = Number(job.speed) || 0;
      item.eta = job.eta === null || job.eta === undefined ? null : job.eta;
      item.progress = Number(job.percent) || 0;
      item.status = status;
      item.error = job.error || '';
      item.finishedAt = job.finishedAt || item.finishedAt;
      item.phase = job.status === 'processing' ? 'processing' : '';
      if (status === 'done' && !wasDone) {
        item.finishedAt = job.finishedAt || Date.now();
        OG.library.add({
          id: 'lib-' + job.id,
          title: item.title,
          filename: item.filename,
          platform: 'local',
          kind: item.kind,
          size: item.size,
          thumb: item.thumb,
          url: LE.fileUrl(job.id),
          ts: Date.now()
        });
        OG.ui.toast(t('toast.downloadDone'), 'success');
      }
      OG.emit('downloads:update');
    }
    LE._knownJobs[job.id] = true;
  }

  function mergeJobs(jobs) {
    (jobs || []).forEach(mergeJob);
  }

  var pollStarted = false;
  function ensurePolling() {
    if (pollStarted) return;
    pollStarted = true;
    LE._pollTimer = setInterval(function () {
      if (document.hidden) return;
      if (!LE.online) return;
      LE.jobs().then(function (res) {
        if (res && res.ok) mergeJobs(res.jobs);
      }).catch(function () {
        LE.online = false;
        updateChip();
      });
    }, 2500);
  }

  /* ---------- 启动时检查 + 顶栏状态 ---------- */
  function bootEngine() {
    updateChip();
    var chip = el('og-engine-chip');
    if (chip) {
      chip.addEventListener('click', function () {
        LE.showHelp();
      });
    }
    setTimeout(function () { LE.check(true); }, 800);
  }

  LE.showHelp = function () {
    var body = document.createElement('div');
    body.className = 'og-col';
    var state = document.createElement('div');
    state.className = 'og-row';
    state.innerHTML = '<span class="og-engine-dot ' + (LE.online ? 'is-online' : 'is-offline') + '"></span>' +
      '<strong>' + (LE.online ? t('engine.local.online') : t('engine.local.offline')) + '</strong>';
    body.appendChild(state);

    var hint = document.createElement('p');
    hint.className = 'og-hint';
    hint.textContent = t('engine.local.hint');
    body.appendChild(hint);

    var code = document.createElement('pre');
    code.className = 'og-result og-mono';
    code.style.whiteSpace = 'pre-wrap';
    code.textContent = t('engine.local.cmd');
    body.appendChild(code);

    var row = document.createElement('div');
    row.className = 'og-row';
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'og-btn og-btn--primary';
    copyBtn.textContent = t('engine.local.copyCmd');
    copyBtn.addEventListener('click', function () {
      OG.utils.copyText(t('engine.local.cmd')).then(function (ok) {
        OG.ui.toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'success' : 'warn');
      });
    });
    var checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'og-btn';
    checkBtn.textContent = t('engine.local.recheck');
    checkBtn.addEventListener('click', function () {
      checkBtn.disabled = true;
      LE.check(true).then(function (ok) {
        checkBtn.disabled = false;
        var dot = state.querySelector('.og-engine-dot');
        if (dot) dot.className = 'og-engine-dot ' + (ok ? 'is-online' : 'is-offline');
        state.querySelector('strong').textContent = ok ? t('engine.local.online') : t('engine.local.offline');
        OG.ui.toast(ok ? t('engine.local.online') : t('engine.local.offline'), ok ? 'success' : 'warn');
      });
    });
    row.appendChild(copyBtn);
    row.appendChild(checkBtn);
    body.appendChild(row);

    OG.ui.modal({
      title: t('engine.local.name'),
      subtitle: t('engine.local.settings.hint'),
      body: body
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEngine);
  } else {
    bootEngine();
  }

  OG.on('app:ready', function () { updateChip(); });
})();
