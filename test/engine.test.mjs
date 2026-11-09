/* ============================================================
 * OmniGet Studio · engine.js 单元测试
 * 运行：node --test test/engine.test.mjs
 *
 * 测试环境用 new Function 注入最小 window/OG 桩，
 * 不加载 core.js（core 依赖 DOM），从而保持纯函数可测。
 * ========================================================== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const CHUNK = 4;

/* ------------------------------------------------------------
 * 最小 OG 桩（core.js 的公共能力）
 * ---------------------------------------------------------- */
function makeUtils() {
  let uidCounter = 0;
  const typeMap = {
    video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm4v', 'ts', 'wmv'],
    audio: ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'wma', 'aiff'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic', 'ico', 'tif', 'tiff'],
    pdf: ['pdf'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'iso', 'apk', 'dmg', 'exe', 'msi', 'deb', 'rpm', 'appimage'],
    doc: ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub', 'srt', 'vtt', 'ass']
  };
  return {
    uid: () => 'id-' + (++uidCounter),
    clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    escapeHtml: (s) => String(s),
    truncate: (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s)),
    fmtBytes: (n) => {
      if (n === null || n === undefined || isNaN(n)) return '—';
      if (n < 1024) return n + ' B';
      const units = ['KB', 'MB', 'GB', 'TB'];
      let v = Number(n);
      let i = -1;
      do { v /= 1024; i += 1; } while (v >= 1024 && i < units.length - 1);
      return v.toFixed(1).replace(/\.0$/, '') + ' ' + units[i];
    },
    parseUrl: (raw) => {
      try {
        const u = new URL(String(raw).trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u;
      } catch (e) {
        return null;
      }
    },
    basename: (url) => {
      try {
        const u = new URL(url);
        const name = u.pathname.split('/').filter(Boolean).pop() || '';
        return decodeURIComponent(name);
      } catch (e) {
        const clean = String(url || '').split('#')[0].split('?')[0];
        const parts = clean.split('/').filter(Boolean);
        return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
      }
    },
    extOf: (nameOrUrl) => {
      if (!nameOrUrl) return '';
      const name = String(nameOrUrl).split('#')[0].split('?')[0];
      const m = name.match(/\.([a-z0-9]{1,8})$/i);
      return m ? m[1].toLowerCase() : '';
    },
    guessType: (ext) => {
      const key = String(ext || '').toLowerCase();
      for (const type of Object.keys(typeMap)) {
        if (typeMap[type].includes(key)) return type;
      }
      return 'file';
    }
  };
}

function loadEngine() {
  const dict = { zh: {}, en: {} };
  const listeners = {};
  const state = {
    lang: 'zh',
    settings: { concurrency: 2, speedLimit: 0 },
    downloads: [],
    library: []
  };
  const OG = {
    state,
    dict,
    addDict(patch) {
      ['zh', 'en'].forEach((lang) => {
        Object.assign(dict[lang], (patch && patch[lang]) || {});
      });
    },
    t(key, vars) {
      let text = dict.zh[key] !== undefined ? dict.zh[key] : key;
      if (vars) {
        text = String(text).replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name])));
      }
      return text;
    },
    utils: makeUtils(),
    library: {
      add(entry) { state.library.push(entry); },
      all() { return state.library.slice(); }
    },
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return () => { listeners[event] = (listeners[event] || []).filter((x) => x !== fn); };
    },
    emit(event, payload) {
      (listeners[event] || []).slice().forEach((fn) => fn(payload));
    },
    registerIcon() {},
    icon(name, cls) { return '<svg data-icon="' + name + '" class="' + (cls || '') + '"></svg>'; },
    ui: {
      toast() {},
      modal() { return { el: null, body: null, close() {} }; }
    }
  };
  const win = { OG };
  const factory = new Function('window', 'document', 'localStorage', 'fetch', SRC);
  factory(win, undefined, undefined, undefined);
  return { OG, engine: OG.engine, state, listeners };
}

/* ------------------------------------------------------------
 * HTTP 模拟工具
 * ---------------------------------------------------------- */
function headerObj(source) {
  const lower = {};
  Object.keys(source || {}).forEach((key) => {
    lower[String(key).toLowerCase()] = source[key];
  });
  return {
    get(name) {
      const key = String(name).toLowerCase();
      return Object.prototype.hasOwnProperty.call(lower, key) ? lower[key] : null;
    }
  };
}

function makeResponse(options = {}) {
  const status = options.status === undefined ? 200 : options.status;
  return {
    ok: options.ok === undefined ? status >= 200 && status < 300 : options.ok,
    status,
    url: options.url || '',
    headers: headerObj(options.headers),
    body: options.body || null,
    json: typeof options.json === 'function' ? options.json : undefined,
    text: typeof options.text === 'function' ? options.text : undefined
  };
}

function immediateBody(chunks) {
  let index = 0;
  return {
    getReader() {
      return {
        read() {
          if (index >= chunks.length) return Promise.resolve({ done: true });
          const value = chunks[index];
          index += 1;
          return Promise.resolve({ done: false, value });
        },
        cancel() { return Promise.resolve(); }
      };
    }
  };
}

/** 可控流：测试里 release() 放一个 chunk，fail()/abort 让 read 拒绝 */
function controlledResponse(options = {}) {
  const chunks = options.chunks || [];
  const status = options.status === undefined ? 206 : options.status;
  const state = { index: 0, pending: null };

  const reader = {
    read() {
      if (state.index >= chunks.length) return Promise.resolve({ done: true });
      const value = chunks[state.index];
      state.index += 1;
      return new Promise((resolve, reject) => {
        state.pending = { resolve, reject, value };
      });
    },
    cancel() { return Promise.resolve(); }
  };

  const result = {
    res: {
      ok: status >= 200 && status < 300,
      status,
      url: options.url || '',
      headers: headerObj(options.headers),
      body: { getReader: () => reader }
    },
    get pending() { return !!state.pending; },
    release() {
      const pending = state.pending;
      state.pending = null;
      if (pending) pending.resolve({ done: false, value: pending.value });
    },
    fail(error) {
      const pending = state.pending;
      state.pending = null;
      if (pending) pending.reject(error);
    },
    bindSignal(signal) {
      if (!signal || typeof signal.addEventListener !== 'function') return;
      signal.addEventListener('abort', () => {
        const pending = state.pending;
        state.pending = null;
        if (pending) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          pending.reject(err);
        }
      });
    }
  };
  return result;
}

function makeFetch(handler) {
  const calls = [];
  const fn = (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(String(url), init || {}, calls);
  };
  fn.calls = calls;
  return fn;
}

async function waitFor(predicate, timeout = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('waitFor timed out');
}

/* ============================================================
 * detectLink
 * ========================================================== */
test('detectLink: 13 种平台 / 直连 / 磁力识别', () => {
  const { engine, OG } = loadEngine();
  const cases = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'video', false],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'video', false],
    ['https://www.youtube.com/shorts/abcDEF12345', 'youtube', 'video', false],
    ['https://vimeo.com/123456789', 'vimeo', 'video', false],
    ['https://x.com/someone/status/1234567890', 'x', 'video', false],
    ['https://twitter.com/someone/status/1234567890', 'x', 'video', false],
    ['https://www.instagram.com/reel/Cabc123/', 'instagram', 'video', false],
    ['https://www.tiktok.com/@user/video/123456789', 'tiktok', 'video', false],
    ['https://www.bilibili.com/video/BV1xx411c7mD', 'bilibili', 'video', false],
    ['https://www.pinterest.com/pin/123456789/', 'pinterest', 'image', false],
    ['https://www.reddit.com/r/test/comments/abc123/some-title/', 'reddit', 'video', false],
    ['https://www.twitch.tv/videos/123456789', 'twitch', 'video', false],
    ['https://soundcloud.com/artist/track-name', 'soundcloud', 'audio', false],
    ['https://cdn.example.com/media/movie.mp4', 'direct', 'video', true],
    ['https://cdn.example.com/files/archive.zip', 'direct', 'archive', true],
    ['https://cdn.example.com/docs/manual.pdf', 'direct', 'pdf', true],
    ['https://cdn.example.com/pic/photo.jpg', 'direct', 'image', true],
    ['https://example.com/article', 'unknown', 'page', false],
    ['https://example.com/page.html', 'unknown', 'page', false],
    ['magnet:?xt=urn:btih:abcdef0123456789&dn=My%20File.iso', 'torrent', 'torrent', false]
  ];
  for (const [url, platform, kind, direct] of cases) {
    const result = engine.detectLink(url);
    assert.equal(result.platform, platform, url);
    assert.equal(result.kind, kind, url);
    assert.equal(result.direct, direct, url);
    assert.equal(result.url, url);
  }

  const youtube = engine.detectLink('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(youtube.videoId, 'dQw4w9WgXcQ');
  assert.equal(youtube.ext, 'mp4');
  assert.match(youtube.filename, /\.mp4$/);

  const magnet = engine.detectLink('magnet:?xt=urn:btih:abcdef0123456789&dn=My%20File.iso');
  assert.equal(magnet.filename, 'My File.iso');
  assert.equal(magnet.ext, 'iso');

  const direct = engine.detectLink('https://cdn.example.com/a/b%20c.mp4?token=1');
  assert.equal(direct.filename, 'b c.mp4');

  const torrentFile = engine.detectLink('https://example.com/files/x.torrent');
  assert.equal(torrentFile.platform, 'torrent');
  assert.equal(torrentFile.kind, 'torrent');
  assert.equal(torrentFile.direct, true);

  const stream = engine.detectLink('https://example.com/live/playlist.m3u8');
  assert.equal(stream.stream, true);
  assert.equal(stream.direct, false);

  const invalid = engine.detectLink('not a url at all');
  assert.equal(invalid.platform, 'unknown');
  assert.equal(invalid.kind, 'unknown');
  assert.equal(invalid.direct, false);

  const ids = OG.PLATFORMS.map((p) => p.id);
  ['youtube', 'vimeo', 'x', 'instagram', 'tiktok', 'bilibili', 'pinterest', 'reddit',
    'twitch', 'soundcloud', 'direct', 'torrent', 'unknown'].forEach((id) => {
    assert.ok(ids.includes(id), 'missing platform ' + id);
  });
});

/* ============================================================
 * probe
 * ========================================================== */
test('probe: HEAD 200 元数据', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch(() => makeResponse({
    status: 200,
    url: 'https://cdn.example.com/a/clip.mp4',
    headers: {
      'content-length': '1048576',
      'content-type': 'video/mp4',
      'accept-ranges': 'bytes',
      'content-disposition': 'attachment; filename="clip.mp4"'
    }
  }));
  engine.fetchImpl = fetchMock;

  const result = await engine.probe('https://cdn.example.com/a/clip.mp4');
  assert.equal(fetchMock.calls.length, 1);
  assert.equal(fetchMock.calls[0].init.method, 'HEAD');
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.size, 1048576);
  assert.equal(result.contentType, 'video/mp4');
  assert.equal(result.ext, 'mp4');
  assert.equal(result.filename, 'clip.mp4');
  assert.equal(result.supportsRange, true);
  assert.equal(result.finalUrl, 'https://cdn.example.com/a/clip.mp4');
  assert.equal(result.error, null);
});

test('probe: HEAD 405 退回 GET Range，并解析 206 总大小', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch((url, init) => {
    if (init.method === 'HEAD') return makeResponse({ status: 405 });
    return makeResponse({
      status: 206,
      headers: { 'content-range': 'bytes 0-0/9999', 'content-type': 'application/zip', 'accept-ranges': 'bytes' }
    });
  });
  engine._setFetch(fetchMock);

  const result = await engine.probe('https://example.com/archive.zip');
  assert.equal(fetchMock.calls.length, 2);
  assert.equal(fetchMock.calls[1].init.method, 'GET');
  assert.equal(fetchMock.calls[1].init.headers.Range, 'bytes=0-0');
  assert.equal(result.ok, true);
  assert.equal(result.status, 206);
  assert.equal(result.size, 9999);
  assert.equal(result.supportsRange, true);
  assert.equal(result.ext, 'zip');
});

test('probe: 404 直接失败（不重试）', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch(() => makeResponse({ status: 404 }));
  engine._setFetch(fetchMock);
  const result = await engine.probe('https://example.com/missing.mp4');
  assert.equal(fetchMock.calls.length, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.error, 'http');
});

test('probe: CORS 失败返回 error cors', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch(() => {
    throw new TypeError('Failed to fetch');
  });
  engine._setFetch(fetchMock);
  const result = await engine.probe('https://blocked.example.com/a.mp4');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'cors');
  assert.equal(result.status, 0);
  assert.equal(fetchMock.calls.length, 2);
});

test('probe: HEAD 被 CORS 拦截但 GET Range 可用', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch((url, init) => {
    if (init.method === 'HEAD') throw new TypeError('Failed to fetch');
    return makeResponse({
      status: 206,
      headers: { 'content-range': 'bytes 0-0/512', 'content-type': 'image/png' }
    });
  });
  engine._setFetch(fetchMock);
  const result = await engine.probe('https://example.com/pic');
  assert.equal(result.ok, true);
  assert.equal(result.size, 512);
  assert.equal(result.ext, 'png');
  assert.equal(result.filename, 'pic.png');
  assert.equal(fetchMock.calls.length, 2);
});

test('probe: 超时归类为 timeout', async () => {
  const { engine } = loadEngine();
  let calls = 0;
  engine._setFetch(() => {
    calls += 1;
    return new Promise(() => {});
  });
  const result = await engine.probe('https://slow.example.com/a.mp4', { timeout: 20 });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'timeout');
  assert.equal(calls, 1);
});

test('probe: 外部 signal 中止归类为 aborted', async () => {
  const { engine } = loadEngine();
  engine._setFetch(() => new Promise(() => {}));
  const controller = new AbortController();
  const pending = engine.probe('https://example.com/slow.mp4', {
    signal: controller.signal,
    timeout: 5000
  });
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'aborted');
});

/* ============================================================
 * fetchMeta
 * ========================================================== */
test('fetchMeta: YouTube oEmbed + 缩略图兜底', async () => {
  const { engine } = loadEngine();
  const fetchMock = makeFetch((url) => {
    assert.match(url, /youtube\.com\/oembed/);
    return {
      ok: true,
      status: 200,
      url,
      headers: headerObj({ 'content-type': 'application/json' }),
      json: async () => ({
        title: 'Demo Video',
        author_name: 'Creator',
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      })
    };
  });
  engine._setFetch(fetchMock);
  const meta = await engine.fetchMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(meta.platform, 'youtube');
  assert.equal(meta.title, 'Demo Video');
  assert.equal(meta.author, 'Creator');
  assert.match(meta.thumbnail, /hqdefault\.jpg$/);
  assert.equal(meta.error, null);
});

test('fetchMeta: YouTube 失败兜底返回 error + 缩略图，不抛错', async () => {
  const { engine } = loadEngine();
  engine._setFetch(() => { throw new TypeError('Failed to fetch'); });
  const meta = await engine.fetchMeta('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(meta.platform, 'youtube');
  assert.equal(meta.error, 'cors');
  assert.match(meta.thumbnail, /i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/hqdefault\.jpg/);
  assert.ok(!meta.title || typeof meta.title === 'string');
});

test('fetchMeta: Vimeo oEmbed（含时长）', async () => {
  const { engine } = loadEngine();
  engine._setFetch(makeFetch(() => ({
    ok: true,
    status: 200,
    url: 'https://vimeo.com/api/oembed.json',
    headers: headerObj({ 'content-type': 'application/json' }),
    json: async () => ({
      title: 'Vimeo Clip',
      author_name: 'Author',
      thumbnail_url: 'https://i.vimeocdn.com/video/1.jpg',
      duration: 90
    })
  })));
  const meta = await engine.fetchMeta('https://vimeo.com/123456789');
  assert.equal(meta.platform, 'vimeo');
  assert.equal(meta.title, 'Vimeo Clip');
  assert.equal(meta.author, 'Author');
  assert.equal(meta.duration, 90);
  assert.equal(meta.error, null);
});

test('fetchMeta: X oEmbed 用 html 兜底标题', async () => {
  const { engine } = loadEngine();
  engine._setFetch(makeFetch(() => ({
    ok: true,
    status: 200,
    url: 'https://publish.twitter.com/oembed',
    headers: headerObj({ 'content-type': 'application/json' }),
    json: async () => ({ author_name: 'Someone', html: '<blockquote>Hello tweet text</blockquote>' })
  })));
  const meta = await engine.fetchMeta('https://x.com/someone/status/1234567890');
  assert.equal(meta.platform, 'x');
  assert.equal(meta.author, 'Someone');
  assert.equal(meta.title, 'Hello tweet text');
  assert.equal(meta.error, null);
});

test('fetchMeta: 其他平台不发请求，返回 unsupported', async () => {
  const { engine } = loadEngine();
  let calls = 0;
  engine._setFetch(() => {
    calls += 1;
    throw new Error('should not fetch');
  });
  const meta = await engine.fetchMeta('https://www.instagram.com/reel/Cabc123/');
  assert.equal(calls, 0);
  assert.equal(meta.platform, 'instagram');
  assert.equal(meta.error, 'unsupported');
});

test('fetchMeta: 直连文件使用 probe 结果做标题', async () => {
  const { engine } = loadEngine();
  engine._setFetch(makeFetch(() => makeResponse({
    status: 200,
    url: 'https://example.com/files/report.pdf',
    headers: {
      'content-length': '2048',
      'content-type': 'application/pdf',
      'accept-ranges': 'bytes',
      'content-disposition': 'attachment; filename="report.pdf"'
    }
  })));
  const meta = await engine.fetchMeta('https://example.com/files/report.pdf');
  assert.equal(meta.platform, 'direct');
  assert.equal(meta.title, 'report.pdf');
  assert.equal(meta.size, 2048);
  assert.equal(meta.author, 'example.com');
  assert.equal(meta.error, null);
});

/* ============================================================
 * downloads
 * ========================================================== */
test('downloads: 平台链接 -> error unsupported + yt-dlp 命令', async () => {
  const { engine } = loadEngine();
  let calls = 0;
  engine._setFetch(() => {
    calls += 1;
    throw new TypeError('should not fetch');
  });
  const item = await engine.downloads.start('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(calls, 0);
  assert.equal(item.status, 'error');
  assert.equal(item.errorHint, 'unsupported');
  assert.equal(item.command, 'yt-dlp "https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
  assert.equal(engine.downloads.stats().failed, 1);
  assert.equal(engine.downloads.queue().length, 1);
});

test('downloads: 磁力链 -> error unsupported', async () => {
  const { engine } = loadEngine();
  const item = await engine.downloads.start('magnet:?xt=urn:btih:abcdef0123456789&dn=File');
  assert.equal(item.platform, 'torrent');
  assert.equal(item.status, 'error');
  assert.equal(item.errorHint, 'unsupported');
  assert.match(item.command, /^omniget "/);
});

test('downloads: 非法链接 -> error unsupported', async () => {
  const { engine } = loadEngine();
  const item = await engine.downloads.start('hello');
  assert.equal(item.status, 'error');
  assert.equal(item.errorHint, 'unsupported');
});

test('downloads: 完成下载、进度、事件与 library', { timeout: 8000 }, async () => {
  const { engine, OG } = loadEngine();
  const total = 3 * CHUNK;
  engine._setFetch(makeFetch(() => makeResponse({
    status: 200,
    url: 'https://example.com/a.mp4',
    headers: { 'content-length': String(total), 'content-type': 'video/mp4' },
    body: immediateBody([
      new Uint8Array(CHUNK),
      new Uint8Array(CHUNK),
      new Uint8Array(CHUNK)
    ])
  })));
  const events = [];
  OG.on('downloads:update', (payload) => events.push(payload));

  const item = await engine.downloads.start('https://example.com/a.mp4');
  assert.equal(item.status, 'active');
  await engine._whenIdle();

  assert.equal(item.status, 'done');
  assert.equal(item.received, total);
  assert.equal(item.size, total);
  assert.equal(item.progress, 1);
  assert.equal(item.saveMode, 'blob');
  assert.ok(item.finishedAt >= item.startedAt);
  assert.ok(events.length >= 2);
  assert.equal(OG.state.library.length, 1);
  assert.equal(OG.state.library[0].id, item.id);
  assert.equal(OG.state.library[0].size, total);
  assert.equal(engine.downloads.stats().done, 1);
  assert.equal(engine.downloads.stats().bytes, total);
});

test('downloads: 并发限制（concurrency = 1）', { timeout: 8000 }, async () => {
  const { engine, OG } = loadEngine();
  OG.state.settings.concurrency = 1;
  const gates = [];
  engine._setFetch(makeFetch(() => {
    const gate = controlledResponse({
      status: 200,
      url: 'https://example.com/a.mp4',
      headers: { 'content-length': String(2 * CHUNK) },
      chunks: [new Uint8Array(CHUNK), new Uint8Array(CHUNK)]
    });
    gates.push(gate);
    return gate.res;
  }));

  const first = await engine.downloads.start('https://example.com/a.mp4');
  const second = await engine.downloads.start('https://example.com/b.mp4');
  assert.equal(first.status, 'active');
  assert.equal(second.status, 'queued');

  await waitFor(() => gates.length === 1 && gates[0].pending);
  gates[0].release();
  await waitFor(() => first.received === CHUNK);
  await waitFor(() => gates[0].pending);
  gates[0].release();
  await waitFor(() => first.status === 'done');

  await waitFor(() => gates.length === 2 && gates[1].pending);
  gates[1].release();
  await waitFor(() => second.received === CHUNK);
  await waitFor(() => gates[1].pending);
  gates[1].release();
  await engine._whenIdle();

  assert.equal(first.status, 'done');
  assert.equal(second.status, 'done');
  assert.equal(second.received, 2 * CHUNK);
});

test('downloads: 暂停 + Range 续传', { timeout: 8000 }, async () => {
  const { engine } = loadEngine();
  const total = 5 * CHUNK;
  const chunks = Array.from({ length: 5 }, () => new Uint8Array(CHUNK));
  let firstGate = null;
  const resumeRequest = { range: null };

  engine._setFetch(makeFetch((url, init) => {
    if (init.headers && init.headers.Range) {
      resumeRequest.range = init.headers.Range;
      const startByte = Number(String(init.headers.Range).match(/bytes=(\d+)-/)[1]);
      const rest = chunks.slice(startByte / CHUNK);
      return makeResponse({
        status: 206,
        url: 'https://example.com/v.mp4',
        headers: {
          'content-range': 'bytes ' + startByte + '-' + (total - 1) + '/' + total,
          'accept-ranges': 'bytes',
          'content-type': 'video/mp4'
        },
        body: immediateBody(rest)
      });
    }
    firstGate = controlledResponse({
      status: 206,
      url: 'https://example.com/v.mp4',
      headers: {
        'content-range': 'bytes 0-' + (total - 1) + '/' + total,
        'accept-ranges': 'bytes',
        'content-type': 'video/mp4'
      },
      chunks: chunks.slice()
    });
    firstGate.bindSignal(init.signal);
    return firstGate.res;
  }));

  const item = await engine.downloads.start('https://example.com/v.mp4');

  await waitFor(() => firstGate && firstGate.pending);
  firstGate.release();
  await waitFor(() => item.received === CHUNK);
  await waitFor(() => firstGate.pending);
  firstGate.release();
  await waitFor(() => item.received === 2 * CHUNK);

  engine.downloads.pause(item.id);
  await waitFor(() => item.status === 'paused');
  assert.equal(item.received, 2 * CHUNK);

  engine.downloads.resume(item.id);
  await engine._whenIdle();

  assert.equal(item.status, 'done');
  assert.equal(item.received, total);
  assert.equal(resumeRequest.range, 'bytes=' + (2 * CHUNK) + '-');
});

test('downloads: 取消后不再写 library', { timeout: 8000 }, async () => {
  const { engine, OG } = loadEngine();
  let gate = null;
  engine._setFetch(makeFetch((url, init) => {
    gate = controlledResponse({
      status: 200,
      url: 'https://example.com/c.mp4',
      headers: { 'content-length': String(CHUNK) },
      chunks: [new Uint8Array(CHUNK)]
    });
    gate.bindSignal(init.signal);
    return gate.res;
  }));

  const item = await engine.downloads.start('https://example.com/c.mp4');
  await waitFor(() => gate && gate.pending);
  engine.downloads.cancel(item.id);
  await waitFor(() => item.status === 'canceled');

  assert.equal(item.received, 0);
  assert.equal(item.error, null);
  assert.equal(OG.state.library.length, 0);
  assert.equal(engine.downloads.stats().canceled, 1);
});

test('downloads: CORS 失败归类为 cors', { timeout: 8000 }, async () => {
  const { engine } = loadEngine();
  engine._setFetch(() => { throw new TypeError('Failed to fetch'); });
  const item = await engine.downloads.start('https://example.com/cors.mp4');
  await waitFor(() => item.status === 'error');
  assert.equal(item.errorHint, 'cors');
  assert.match(item.error, /CORS/);
  assert.equal(engine.downloads.stats().failed, 1);
});

test('downloads: HTTP 404 -> 错误 -> retry 成功', { timeout: 8000 }, async () => {
  const { engine } = loadEngine();
  let attempt = 0;
  engine._setFetch(makeFetch(() => {
    attempt += 1;
    if (attempt === 1) return makeResponse({ status: 404 });
    return makeResponse({
      status: 200,
      url: 'https://example.com/r.bin',
      headers: { 'content-length': String(CHUNK) },
      body: immediateBody([new Uint8Array(CHUNK)])
    });
  }));

  const item = await engine.downloads.start('https://example.com/r.bin');
  await waitFor(() => item.status === 'error');
  assert.equal(item.errorHint, 'http');
  assert.match(item.error, /404/);

  engine.downloads.retry(item.id);
  await engine._whenIdle();
  assert.equal(item.status, 'done');
  assert.equal(item.received, CHUNK);
});

test('downloads: >300MB 且 Blob 时标 memoryRisk', { timeout: 8000 }, async () => {
  const { engine } = loadEngine();
  const bigSize = 301 * 1024 * 1024;
  let gate = null;
  engine._setFetch(makeFetch((url, init) => {
    gate = controlledResponse({
      status: 200,
      url: 'https://example.com/big.bin',
      headers: { 'content-length': String(bigSize) },
      chunks: [new Uint8Array(1)]
    });
    gate.bindSignal(init.signal);
    return gate.res;
  }));

  const item = await engine.downloads.start('https://example.com/big.bin');
  await waitFor(() => item.memoryRisk === true);
  assert.equal(item.size, bigSize);
  engine.downloads.cancel(item.id);
  await waitFor(() => item.status === 'canceled');
});

test('downloads: 队列顺序 / remove / clearCompleted', { timeout: 8000 }, async () => {
  const { engine } = loadEngine();
  engine._setFetch(makeFetch(() => makeResponse({
    status: 200,
    url: 'https://example.com/x.bin',
    headers: { 'content-length': String(CHUNK) },
    body: immediateBody([new Uint8Array(CHUNK)])
  })));

  const first = await engine.downloads.start('https://example.com/one.bin');
  const second = await engine.downloads.start('https://example.com/two.bin');
  await engine._whenIdle();
  assert.deepEqual(engine.downloads.queue().map((x) => x.id), [first.id, second.id]);

  engine.downloads.remove(first.id);
  assert.equal(engine.downloads.queue().length, 1);

  const unsupported = await engine.downloads.start('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(unsupported.status, 'error');
  engine.downloads.clearCompleted();
  assert.equal(engine.downloads.queue().length, 1);
  assert.equal(engine.downloads.stats().done, 0);
  assert.equal(engine.downloads.stats().failed, 1);
});

/* ============================================================
 * 播放器纯函数 / 其它
 * ========================================================== */
test('srtToVtt: 基本转换 / 短时间戳 / 已是 VTT / 空 / CRLF / BOM', () => {
  const { engine } = loadEngine();
  const vtt = engine._impl.srtToVtt(
    '1\n00:00:01,000 --> 00:00:04,500\nHello\n\n2\n00:00:05,000 --> 00:00:07,000\nWorld\n'
  );
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.match(vtt, /00:00:01\.000 --> 00:00:04\.500/);
  assert.match(vtt, /00:00:05\.000 --> 00:00:07\.000/);
  assert.match(vtt, /Hello/);
  assert.match(vtt, /World/);

  const short = engine._impl.srtToVtt('1\n0:02,500 --> 0:05,000\nHi\n');
  assert.match(short, /00:02\.500 --> 00:05\.000/);

  assert.equal(engine._impl.srtToVtt(''), 'WEBVTT\n\n');
  assert.equal(engine._impl.srtToVtt('   \n\n'), 'WEBVTT\n\n');

  const alreadyVtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n';
  const unchanged = engine._impl.srtToVtt(alreadyVtt);
  assert.ok(unchanged.startsWith('WEBVTT'));
  assert.match(unchanged, /00:00:01\.000/);

  const crlf = engine._impl.srtToVtt('\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n');
  assert.ok(!/\r/.test(crlf));
  assert.match(crlf, /00:00:01\.000 --> 00:00:02\.000/);
});

test('filenameFromDisposition: 普通与 RFC5987 编码', () => {
  const { engine } = loadEngine();
  assert.equal(
    engine._impl.filenameFromDisposition('attachment; filename="clip.mp4"'),
    'clip.mp4'
  );
  assert.equal(
    engine._impl.filenameFromDisposition("attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87.mp4"),
    '中文.mp4'
  );
  assert.equal(engine._impl.filenameFromDisposition(''), '');
});

test('_impl.safeName: 清理非法字符并补齐扩展名', () => {
  const { engine } = loadEngine();
  assert.equal(engine._impl.safeName('a/b:c*.mp4', 'mp4'), 'b_c_.mp4');
  assert.equal(engine._impl.safeName('movie', 'mp4'), 'movie.mp4');
  assert.equal(engine._impl.safeName('', 'zip'), 'download.zip');
});

test('fetchImpl 属性与 _setFetch 都可注入', async () => {
  const { engine } = loadEngine();
  const viaProperty = makeFetch(() => makeResponse({ status: 200, headers: { 'content-length': '3' } }));
  engine.fetchImpl = viaProperty;
  await engine.probe('https://example.com/a.bin');
  assert.equal(viaProperty.calls.length, 1);

  const viaMethod = makeFetch(() => makeResponse({ status: 200, headers: { 'content-length': '4' } }));
  engine._setFetch(viaMethod);
  const result = await engine.probe('https://example.com/b.bin');
  assert.equal(viaMethod.calls.length, 1);
  assert.equal(result.size, 4);
});
