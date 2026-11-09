/* ============================================================
 * OmniGet Studio · 单文件版
 * views.js — 六个页面的渲染与交互
 * 依赖：core.js（OG.*）、engine.js（OG.detectLink/OG.downloads/OG.player）
 *       tools.js（OG.tools）
 * ============================================================ */
(function () {
  'use strict';

  var OG = window.OG;
  var t = OG.t;
  var icon = OG.icon;
  var esc = OG.utils.escapeHtml;

  var MEDIA_PLATFORMS = ['youtube', 'vimeo', 'x', 'instagram', 'tiktok', 'bilibili', 'pinterest', 'reddit', 'twitch', 'soundcloud', 'threads', 'facebook'];

  /* ---------------- 小工具 ---------------- */
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === null || val === undefined || val === false) return;
        if (key === 'class') node.className = val;
        else if (key === 'html') node.innerHTML = val;
        else if (key === 'text') node.textContent = val;
        else if (key === 'dataset') Object.keys(val).forEach(function (k) { node.dataset[k] = val[k]; });
        else if (key.slice(0, 2) === 'on' && typeof val === 'function') node.addEventListener(key.slice(2).toLowerCase(), val);
        else node.setAttribute(key, val === true ? '' : val);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function frag(nodes) {
    var f = document.createDocumentFragment();
    nodes.forEach(function (n) { if (n) f.appendChild(n); });
    return f;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function platformOf(id) {
    var list = (OG.PLATFORMS || []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function platformBadge(id) {
    var p = platformOf(id);
    var name = p ? p.name : (id === 'direct' ? 'Direct' : (id || 'Link'));
    var badge = h('span', { class: 'og-badge' + (p && p.color ? '' : '') }, [
      h('span', { html: icon(p && p.icon && OG.icons[p.icon] ? p.icon : 'globe') })
    ]);
    badge.appendChild(document.createTextNode(name));
    return badge;
  }

  function kindIcon(kind) {
    var map = { video: 'video', audio: 'music', image: 'image', pdf: 'pdf', archive: 'archive', file: 'file', page: 'globe', torrent: 'clouddown', direct: 'download' };
    return map[kind] || 'file';
  }

  function pageHead(opts) {
    var actions = h('div', { class: 'og-page-head__actions' }, opts.actions || []);
    return h('div', { class: 'og-page-head' }, [
      h('div', { class: 'og-page-head__main' }, [
        opts.eyebrow ? h('div', { class: 'og-page-head__eyebrow', text: opts.eyebrow }) : null,
        h('h2', { class: 'og-page-head__title', text: opts.title }),
        opts.sub ? h('p', { class: 'og-page-head__sub', text: opts.sub }) : null
      ]),
      actions
    ]);
  }

  function emptyState(opts) {
    return h('div', { class: 'og-empty' }, [
      h('div', { class: 'og-empty__icon', html: icon(opts.icon || 'file') }),
      h('div', { class: 'og-empty__title', text: opts.title }),
      opts.sub ? h('div', { class: 'og-empty__sub', text: opts.sub }) : null,
      opts.actionLabel ? h('button', { class: 'og-btn og-btn--primary', type: 'button', onclick: opts.onAction, text: opts.actionLabel }) : null
    ]);
  }

  function btn(label, opts) {
    opts = opts || {};
    var b = h('button', {
      type: 'button',
      class: 'og-btn' + (opts.primary ? ' og-btn--primary' : '') + (opts.small ? ' og-btn--sm' : '') + (opts.ghost ? ' og-btn--ghost' : '') + (opts.danger ? ' og-btn--danger' : ''),
      title: opts.title || label,
      onclick: opts.onClick
    }, [
      opts.icon ? h('span', { html: icon(opts.icon) }) : null,
      h('span', { text: label })
    ]);
    if (opts.disabled) b.disabled = true;
    return b;
  }

  function iconBtn(iconName, label, onClick, extraClass) {
    var b = h('button', { type: 'button', class: 'og-icon-btn' + (extraClass ? ' ' + extraClass : ''), title: label, 'aria-label': label, onclick: onClick });
    b.innerHTML = icon(iconName);
    return b;
  }

  function statusMeta(status) {
    var map = {
      queued: { cls: 'og-badge', text: t('download.status.queued') },
      active: { cls: 'og-badge og-badge--primary', text: t('download.status.active') },
      paused: { cls: 'og-badge og-badge--warn', text: t('download.status.paused') },
      done: { cls: 'og-badge og-badge--ok', text: t('download.status.done') },
      error: { cls: 'og-badge og-badge--err', text: t('download.status.error') },
      canceled: { cls: 'og-badge', text: t('download.status.canceled') }
    };
    return map[status] || map.queued;
  }

  function platformThumb(item) {
    var thumb = h('div', { class: 'og-download__thumb' });
    if (item.thumb) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.thumb;
      img.onerror = function () { img.remove(); thumb.innerHTML = icon(kindIcon(item.kind)); };
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = icon(kindIcon(item.kind));
    }
    return thumb;
  }

  /* ============================================================
   * HOME
   * ============================================================ */
  var analyzeToken = 0;
  var currentLink = null;

  OG.registerView('home', function (root) {
    var cleanups = [];
    var input = h('input', {
      class: 'og-omnibox__input',
      id: 'og-omnibox-input',
      type: 'text',
      inputmode: 'url',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: t('home.omnibox.placeholder'),
      'aria-label': t('home.omnibox.placeholder')
    });
    var badge = h('span', { class: 'og-omnibox__badge', id: 'og-omnibox-badge' });
    var analyzeBtn = h('button', { type: 'submit', class: 'og-omnibox__btn' }, [
      h('span', { html: icon('arrowDown') }),
      h('span', { text: t('home.omnibox.action') })
    ]);

    var form = h('form', { class: 'og-omnibox', onsubmit: function (e) { e.preventDefault(); analyze(input.value.trim()); } }, [
      h('span', { class: 'og-omnibox__icon', html: icon('link') }),
      input,
      badge,
      analyzeBtn
    ]);

    var pasteBtn = h('button', { type: 'button', text: t('home.omnibox.paste'), onclick: function () {
      if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) {
        navigator.clipboard.readText().then(function (text) {
          if (text) { input.value = text.trim(); analyze(text.trim()); }
        }).catch(function () { input.focus(); OG.ui.toast(t('toast.noClipboard'), 'warn'); });
      } else {
        input.focus();
        OG.ui.toast(t('toast.noClipboard'), 'info');
      }
    } });
    var clearBtn = h('button', { type: 'button', text: t('home.omnibox.clear'), onclick: function () {
      input.value = '';
      currentLink = null;
      badge.classList.remove('is-visible');
      var slot = root.querySelector('#og-preview-slot');
      if (slot) clear(slot);
      input.focus();
    } });

    var hints = h('div', { class: 'og-omnibox-hints' }, [
      pasteBtn,
      h('span', { class: 'dot' }),
      clearBtn,
      h('span', { class: 'dot' }),
      h('span', { text: t('home.omnibox.hint') })
    ]);

    var previewSlot = h('div', { id: 'og-preview-slot' });

    /* 示例 */
    var samples = [
      { key: 'home.sample.video', icon: 'video', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
      { key: 'home.sample.image', icon: 'image', url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png' },
      { key: 'home.sample.css', icon: 'file', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' },
      { key: 'home.sample.youtube', icon: 'play', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ];
    var sampleChips = h('div', { class: 'og-samples' }, [h('span', { class: 'og-samples__label', text: t('home.sample.title') })]);
    samples.forEach(function (s) {
      sampleChips.appendChild(h('button', {
        type: 'button', class: 'og-sample-chip', onclick: function () {
          input.value = s.url;
          analyze(s.url);
        }
      }, [h('span', { html: icon(s.icon) }), h('span', { text: t(s.key) })]));
    });

    var trust = h('div', { class: 'og-trust' }, [
      trustItem('wifiOff', 'home.trust.offline'),
      trustItem('harddrive', 'home.trust.nobackend'),
      trustItem('shield', 'home.trust.privacy'),
      trustItem('file', 'home.trust.single')
    ]);

    var hero = h('section', { class: 'og-hero' }, [
      h('div', { class: 'og-hero__kicker' }, [h('span', { html: icon('sparkle') }), h('span', { text: t('home.hero.kicker') })]),
      h('h2', { class: 'og-hero__title', html: heroTitleHTML() }),
      h('p', { class: 'og-hero__sub', text: t('home.hero.sub') }),
      h('div', { class: 'og-omnibox-wrap' }, [form, hints]),
      sampleChips,
      trust
    ]);

    /* 最近解析 */
    var recent = h('section', { class: 'og-recent' });
    renderRecent(recent, function (url) { input.value = url; analyze(url); });

    /* 功能卡 */
    var features = h('section', { class: 'og-section', style: 'width:100%;max-width:900px' }, [
      h('div', { class: 'og-section__head' }, [
        h('h3', { class: 'og-section__title' }, [h('span', { html: icon('sparkle') }), h('span', { text: t('home.features.title') })])
      ]),
      h('div', { class: 'og-feature-grid' }, [
        feature('clouddown', 'home.features.direct'),
        feature('link', 'home.features.meta'),
        feature('tools', 'home.features.tools'),
        feature('play', 'home.features.player')
      ])
    ]);

    root.appendChild(h('div', { class: 'og-home' }, [
      hero,
      previewSlot,
      recent,
      features,
      h('p', { class: 'og-home-footer', text: t('home.footer.terms') })
    ]));

    /* 输入联想 */
    var detect = OG.utils.debounce(function () {
      var url = input.value.trim();
      if (!url) { badge.classList.remove('is-visible'); return; }
      if (!/^https?:\/\//i.test(url)) { badge.classList.remove('is-visible'); return; }
      var link = OG.detectLink ? OG.detectLink(url) : null;
      if (!link) return;
      var p = platformOf(link.platform);
      badge.innerHTML = (p ? icon(p.icon && OG.icons[p.icon] ? p.icon : 'globe') : icon('link')) +
        '<span>' + esc(p ? p.name : t('preview.kind.' + (link.direct ? 'direct' : 'unknown'))) + '</span>';
      badge.classList.add('is-visible');
    }, 300);
    var onInput = function () { detect(); };
    input.addEventListener('input', onInput);
    cleanups.push(function () { input.removeEventListener('input', onInput); });

    var onFill = function (e) {
      if (!e.detail || !e.detail.url) return;
      input.value = e.detail.url;
      analyze(e.detail.url);
    };
    document.addEventListener('omnibox:fill', onFill);
    cleanups.push(function () { document.removeEventListener('omnibox:fill', onFill); });

    /* 本地文件拖放 */
    var onDragOver = function (e) { e.preventDefault(); };
    var onDrop = function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      handleLocalFiles(Array.prototype.slice.call(e.dataTransfer.files));
    };
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('drop', onDrop);
    cleanups.push(function () {
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('drop', onDrop);
    });

    OG._cleanup = function () { cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); };

    /* ---- 解析 ---- */
    function analyze(url) {
      url = String(url || '').trim();
      if (!url) { input.focus(); return; }
      if (!/^https?:\/\//i.test(url)) {
        if (/^magnet:/i.test(url) || /\.torrent$/i.test(url)) {
          renderUnsupported(previewSlot, { platform: 'torrent', url: url, kind: 'torrent' });
          return;
        }
        OG.ui.toast(t('preview.error'), 'warn');
        return;
      }
      var link = OG.detectLink ? OG.detectLink(url) : { url: url, platform: 'unknown', kind: 'unknown', direct: false, filename: OG.utils.basename(url) };
      currentLink = link;
      var myToken = ++analyzeToken;
      renderLoading(previewSlot);

      var metaPlatform = MEDIA_PLATFORMS.indexOf(link.platform) >= 0;
      if (metaPlatform) {
        renderLoading(previewSlot);
        var engineReady = OG.localEngine ? OG.localEngine.check(false) : Promise.resolve(false);
        engineReady.then(function (online) {
          if (myToken !== analyzeToken) return;
          if (!online) {
            renderMediaMetaPreview(previewSlot, url, link, myToken, true, '');
            return;
          }
          OG.localEngine.info(url).then(function (info) {
            if (myToken !== analyzeToken) return;
            if (!info || !info.ok) throw new Error((info && info.error) || t('engine.local.failed'));
            renderEnginePreview(previewSlot, url, link, info);
            recordHistory(url, info.title || url, link.platform);
          }).catch(function (err) {
            if (myToken !== analyzeToken) return;
            renderMediaMetaPreview(previewSlot, url, link, myToken, false, String(err && err.message || err));
          });
        }).catch(function () {
          if (myToken === analyzeToken) renderMediaMetaPreview(previewSlot, url, link, myToken, true, '');
        });
        return;
      }

      if (link.platform === 'torrent' || link.kind === 'torrent') {
        renderUnsupported(previewSlot, link);
        return;
      }

      var probePromise = OG.engine && OG.engine.probe ? OG.engine.probe(url) : Promise.resolve({ ok: false, error: 'unsupported' });
      Promise.resolve(probePromise).then(function (probe) {
        if (myToken !== analyzeToken) return;
        probe = probe || {};
        if (probe.ok) {
          renderPreview(previewSlot, {
            url: url,
            platform: 'direct',
            kind: OG.utils.guessType(probe.ext || link.ext || OG.utils.extOf(probe.filename || link.filename || url)),
            title: probe.filename || link.filename || OG.utils.basename(url) || t('preview.unknown.title'),
            author: OG.utils.parseUrl(probe.finalUrl || url).hostname,
            thumbnail: '',
            size: probe.size || 0,
            contentType: probe.contentType,
            filename: probe.filename || link.filename || OG.utils.basename(url),
            direct: true,
            supportsRange: probe.supportsRange,
            note: t('preview.note.direct')
          });
          recordHistory(url, probe.filename || url, 'direct');
        } else {
          var reason = probe.error === 'cors' ? 'cors' : probe.error === 'network' ? 'network' : 'unsupported';
          if (OG.localEngine && OG.localEngine.online) {
            OG.localEngine.info(url).then(function (info) {
              if (myToken !== analyzeToken) return;
              if (!info || !info.ok) throw new Error((info && info.error) || '');
              renderEnginePreview(previewSlot, url, link, info);
              recordHistory(url, info.title || url, link.platform);
            }).catch(function (err) {
              if (myToken !== analyzeToken) return;
              renderPreview(previewSlot, {
                url: url, platform: link.platform, kind: link.kind,
                title: link.filename || OG.utils.basename(url) || t('preview.unknown.title'),
                author: OG.utils.parseUrl(url).hostname,
                direct: false,
                note: t('preview.note.cors') + ' ' + String(err && err.message || ''),
                error: t('preview.error.' + reason),
                copyOnly: true, engineHint: true
              });
              recordHistory(url, link.filename || url, link.platform);
            });
          } else {
            renderPreview(previewSlot, {
              url: url,
              platform: link.platform,
              kind: link.kind,
              title: link.filename || OG.utils.basename(url) || t('preview.unknown.title'),
              author: OG.utils.parseUrl(url).hostname,
              direct: false,
              note: t('preview.note.' + (reason === 'cors' ? 'cors' : 'media')) + ' ' + t('engine.local.offline.note'),
              error: t('preview.error.' + reason),
              copyOnly: true, engineHint: true
            });
            recordHistory(url, link.filename || url, link.platform);
          }
        }
      }).catch(function () {
        if (myToken !== analyzeToken) return;
        renderPreview(previewSlot, {
          url: url, platform: link.platform, kind: link.kind,
          title: OG.utils.basename(url) || t('preview.unknown.title'),
          author: t('preview.unknown.author'), direct: false,
          note: t('preview.note.cors'), error: t('preview.error.network'), copyOnly: true
        });
      });
    }

    function handleLocalFiles(files) {
      if (!files.length) return;
      var file = files[0];
      var ext = OG.utils.extOf(file.name);
      var type = OG.utils.guessType(ext);
      if (['video', 'audio', 'image'].indexOf(type) >= 0 && OG.player && OG.player.openLocalFile) {
        OG.player.openLocalFile(file);
        return;
      }
      var body = h('div', { class: 'og-col' }, [
        h('div', { class: 'og-card' }, [
          h('div', { class: 'og-row' }, [h('span', { html: icon('file') }), h('strong', { text: file.name })]),
          h('div', { class: 'og-hint', text: OG.utils.fmtBytes(file.size) + ' · ' + (file.type || ext || t('common.unknown')) })
        ]),
        h('div', { class: 'og-row' }, [
          btn(t('tools.title'), { icon: 'hash', primary: true, onClick: function () { OG.openTool('hash'); } }),
          btn(t('home.features.player.title'), { icon: 'play', onClick: function () { OG.player && OG.player.openLocalFile && OG.player.openLocalFile(file); } })
        ])
      ]);
      OG.ui.modal({ title: file.name, subtitle: t('home.features.player.desc'), body: body });
    }

    /* 启动时若有 pending URL（从命令面板/其他页跳转） */
    var pending = OG._pendingUrl;
    if (pending) {
      OG._pendingUrl = null;
      input.value = pending;
      setTimeout(function () { analyze(pending); }, 60);
    }
  });

  function heroTitleHTML() {
    var title = t('home.hero.title');
    var accent = t('home.hero.title.accent');
    var idx = title.indexOf(accent);
    if (idx < 0) return esc(title);
    return esc(title.slice(0, idx)) + '<span class="accent">' + esc(accent) + '</span>' + esc(title.slice(idx + accent.length));
  }

  function trustItem(iconName, key) {
    return h('span', { class: 'og-trust__item' }, [h('span', { html: icon(iconName) }), h('span', { text: t(key) })]);
  }

  function feature(iconName, key) {
    return h('div', { class: 'og-feature' }, [
      h('div', { class: 'og-feature__icon', html: icon(iconName) }),
      h('div', { class: 'og-feature__title', text: t(key + '.title') }),
      h('div', { class: 'og-feature__desc', text: t(key + '.desc') })
    ]);
  }

  function renderRecent(container, onPick) {
    clear(container);
    var history = OG.state.history || [];
    var head = h('div', { class: 'og-section__head' }, [
      h('h3', { class: 'og-section__title' }, [h('span', { html: icon('clock') }), h('span', { text: t('home.recent.title') })]),
      history.length ? h('button', { type: 'button', class: 'og-btn og-btn--sm og-btn--ghost', onclick: function () { OG.nav('downloads'); } }, [h('span', { text: t('home.recent.viewAll') }), h('span', { html: icon('chevronRight') })]) : null
    ]);
    container.appendChild(head);
    if (!history.length) {
      container.appendChild(h('div', { class: 'og-hint', text: t('home.recent.empty') }));
      return;
    }
    var list = h('div', { class: 'og-recent__list' });
    history.slice(0, 5).forEach(function (item) {
      var p = platformOf(item.platform);
      list.appendChild(h('button', { type: 'button', class: 'og-recent__item', onclick: function () { onPick(item.url); } }, [
        h('span', { class: 'og-recent__icon', html: icon(p && OG.icons[p.icon] ? p.icon : 'link') }),
        h('span', { class: 'og-recent__main' }, [
          h('span', { class: 'og-recent__title', text: item.title || item.url }),
          h('span', { class: 'og-recent__sub', text: item.url })
        ]),
        h('span', { class: 'og-badge', text: OG.utils.fmtDate(item.ts, false) })
      ]));
    });
    container.appendChild(list);
  }

  function recordHistory(url, title, platform) {
    OG.addHistory({ url: url, title: title, platform: platform, ts: Date.now() });
    var root = document.getElementById('og-view');
    var recent = root && root.querySelector('.og-recent');
    if (recent) {
      var input = root.querySelector('#og-omnibox-input');
      renderRecent(recent, function (u) { if (input) { input.value = u; } OG.emit('omnibox:fill', { url: u }); });
    }
  }

  function renderLoading(slot) {
    clear(slot);
    slot.appendChild(h('div', { class: 'og-preview', style: 'padding:20px' }, [
      h('div', { class: 'og-row' }, [
        h('span', { class: 'og-spinner', html: icon('refresh') }),
        h('span', { class: 'og-hint', text: t('preview.analyzing') })
      ])
    ]));
  }

  function renderUnsupported(slot, link) {
    clear(slot);
    var isTorrent = link.kind === 'torrent' || link.platform === 'torrent';
    var card = h('div', { class: 'og-preview' });
    card.appendChild(h('div', { class: 'og-preview__main' }, [
      h('div', { class: 'og-preview__thumb' }, [h('span', { html: icon(isTorrent ? 'clouddown' : 'globe') })]),
      h('div', { class: 'og-preview__info' }, [
        h('div', { class: 'og-preview__topline', html: '' }),
        h('div', { class: 'og-preview__title', text: isTorrent ? t('preview.kind.torrent') : t('preview.error.unsupported') }),
        h('div', { class: 'og-preview__author' }, [h('span', { html: icon('link') }), h('span', { text: link.url || t('preview.unknown.title') })]),
        h('div', { class: 'og-preview__note' }, [h('span', { html: icon('info') }), h('span', { text: isTorrent ? t('preview.note.torrent') : t('preview.note.media') })])
      ])
    ]));
    var actions = h('div', { class: 'og-preview__actions', style: 'padding:0 18px 18px' }, [
      btn(t('preview.action.copy'), { icon: 'copy', small: true, onClick: function () { copy(link.url); } }),
      btn(t('preview.action.open'), { icon: 'external', small: true, onClick: function () { window.open(link.url, '_blank', 'noopener'); } })
    ]);
    card.appendChild(actions);
    slot.appendChild(card);
  }

  /* ---- 本地引擎（yt-dlp）预览 ---- */
  function renderEnginePreview(slot, url, link, info) {
    clear(slot);
    var card = h('div', { class: 'og-preview' });
    var thumb = h('div', { class: 'og-preview__thumb' });
    if (info.thumbnail) {
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = info.thumbnail;
      img.onerror = function () { img.remove(); thumb.innerHTML = icon(kindIcon(link.kind)); };
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = icon(kindIcon(link.kind));
    }
    if (info.duration) {
      thumb.appendChild(h('span', { class: 'og-preview__thumb-badge', text: OG.utils.fmtDuration(info.duration) }));
    }

    var quality = h('select', { class: 'og-select', 'aria-label': t('engine.local.quality') });
    var options = [{ v: 'best', label: t('engine.local.quality.best') }];
    (info.heights || []).filter(function (x) { return x && x <= 2160; }).slice(0, 5).forEach(function (x) {
      options.push({ v: String(x), label: x + 'p' });
    });
    options.push({ v: 'audio', label: t('engine.local.quality.audio') });
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.v;
      op.textContent = o.label;
      quality.appendChild(op);
    });

    var startBtn = btn(t('engine.local.download'), {
      icon: 'arrowDown',
      primary: true,
      onClick: function () {
        startBtn.disabled = true;
        OG.localEngine.start(url, quality.value).then(function () {
          OG.ui.toast(t('engine.local.jobStarted'));
          setTimeout(function () { OG.nav('downloads'); }, 240);
        }).catch(function (err) {
          startBtn.disabled = false;
          OG.ui.toast((err && err.message) || t('engine.local.failed'), 'error');
        });
      }
    });

    var meta = h('div', { class: 'og-preview__meta' }, [
      h('span', {}, [h('b', { text: t('engine.local.name') })]),
      info.uploader ? h('span', { text: info.uploader }) : null,
      info.duration ? h('span', { text: OG.utils.fmtDuration(info.duration) }) : null,
      info.heights && info.heights.length ? h('span', { text: '≤ ' + info.heights[0] + 'p' }) : null
    ]);

    var infoEl = h('div', { class: 'og-preview__info' }, [
      h('div', { class: 'og-preview__topline' }, [
        h('span', { class: 'og-badge og-badge--ok', text: t('engine.local.online') }),
        h('span', { class: 'og-badge', text: (info.extractor || '').toUpperCase() || t('engine.local.platform') })
      ]),
      h('div', { class: 'og-preview__title', text: info.title || t('preview.unknown.title') }),
      h('div', { class: 'og-preview__author' }, [h('span', { html: icon('zap') }), h('span', { text: info.uploader || info.webpage_url || url })]),
      meta,
      h('div', { class: 'og-engine-quality' }, [h('span', { class: 'og-label', text: t('engine.local.quality') }), quality]),
      h('div', { class: 'og-preview__actions' }, [
        startBtn,
        btn(t('preview.action.open'), { icon: 'external', small: true, onClick: function () { window.open(url, '_blank', 'noopener'); } })
      ])
    ]);

    card.appendChild(h('div', { class: 'og-preview__main' }, [thumb, infoEl]));
    card.appendChild(h('div', { class: 'og-preview__note og-preview__note--ok' }, [
      h('span', { html: icon('shield') }),
      h('span', { text: t('engine.local.note') })
    ]));
    slot.appendChild(card);
  }

  /* oEmbed 兜底预览（本地引擎离线或解析失败时） */
  function renderMediaMetaPreview(slot, url, link, token, engineOffline, err) {
    var metaPromise = OG.engine && OG.engine.fetchMeta ? OG.engine.fetchMeta(url) : Promise.resolve({ error: 'unsupported' });
    Promise.resolve(metaPromise).then(function (meta) {
      if (token !== analyzeToken) return;
      meta = meta || {};
      var p = platformOf(link.platform);
      var note = t('preview.note.media');
      if (err) note += ' · ' + err;
      if (engineOffline) note += ' ' + t('engine.local.offline.note');
      renderPreview(slot, {
        url: url,
        platform: link.platform,
        kind: link.kind,
        title: meta.title || t('preview.unknown.title'),
        author: meta.author || (p ? p.name : t('preview.unknown.author')),
        thumbnail: meta.thumbnail || meta.thumb || '',
        size: meta.size || 0,
        filename: link.filename || '',
        direct: false,
        unsupported: true,
        note: note,
        command: 'yt-dlp "' + url + '"',
        engineHint: engineOffline || !!err
      });
      recordHistory(url, meta.title || url, link.platform);
    }).catch(function () {
      if (token !== analyzeToken) return;
      renderPreview(slot, {
        url: url, platform: link.platform, kind: 'page',
        title: t('preview.unknown.title'), author: t('preview.unknown.author'),
        direct: false, unsupported: true,
        note: t('preview.note.media') + (engineOffline ? ' ' + t('engine.local.offline.note') : ''),
        command: 'yt-dlp "' + url + '"',
        engineHint: true
      });
      recordHistory(url, url, link.platform);
    });
  }

  function renderPreview(slot, data) {
    clear(slot);
    var card = h('div', { class: 'og-preview' });
    var thumb = h('div', { class: 'og-preview__thumb' });
    if (data.thumbnail) {
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = data.thumbnail;
      img.onerror = function () { img.remove(); thumb.innerHTML = icon(kindIcon(data.kind)); };
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = icon(kindIcon(data.kind));
    }
    if (data.direct && data.size) {
      thumb.appendChild(h('span', { class: 'og-preview__thumb-badge', text: OG.utils.fmtBytes(data.size) }));
    }

    var metaItems = [];
    if (data.size) metaItems.push(h('span', {}, [t('preview.meta.size') + ' ', h('b', { text: OG.utils.fmtBytes(data.size) })]));
    if (data.kind) metaItems.push(h('span', {}, [t('preview.meta.type') + ' ', h('b', { text: (data.contentType || data.kind || '').toString().toUpperCase() })]));
    if (data.filename) metaItems.push(h('span', {}, [t('preview.meta.name') + ' ', h('b', { text: OG.utils.truncate(data.filename, 42) })]));

    var top = h('div', { class: 'og-preview__topline' }, [
      platformBadge(data.platform),
      data.direct ? h('span', { class: 'og-badge og-badge--ok', text: t('preview.ready') }) :
        h('span', { class: 'og-badge og-badge--warn', text: data.unsupported ? t('preview.error.unsupported') : t('preview.kind.media') })
    ]);

    var actions = h('div', { class: 'og-preview__actions' });
    if (data.engineHint && OG.localEngine) {
      actions.appendChild(btn(t('engine.local.help'), { icon: 'zap', small: true, onClick: function () { OG.localEngine.showHelp(); } }));
    }
    if (data.direct) {
      actions.appendChild(btn(t('preview.action.download'), {
        icon: 'arrowDown', primary: true,
        onClick: function (e) { startDownload(data.url, data.filename, e.currentTarget); }
      }));
      actions.appendChild(btn(t('preview.action.copy'), { icon: 'copy', small: true, onClick: function () { copy(data.url); } }));
      if (['video', 'audio', 'image'].indexOf(data.kind) >= 0 && OG.player && OG.player.openUrl) {
        actions.appendChild(btn(t('preview.action.play'), { icon: 'play', small: true, onClick: function () { OG.player.openUrl(data.url); } }));
      }
    } else {
      if (data.command) actions.appendChild(btn(t('preview.action.command'), { icon: 'copy', primary: true, onClick: function () { copy(data.command); } }));
      actions.appendChild(btn(t('preview.action.open'), { icon: 'external', small: true, onClick: function () { window.open(data.url, '_blank', 'noopener'); } }));
      actions.appendChild(btn(t('preview.action.copy'), { icon: 'link', small: true, onClick: function () { copy(data.url); } }));
    }

    var info = h('div', { class: 'og-preview__info' }, [
      top,
      h('div', { class: 'og-preview__title', text: data.title || t('preview.unknown.title') }),
      h('div', { class: 'og-preview__author' }, [h('span', { html: icon(data.direct ? 'globe' : 'user') }), h('span', { text: data.author || t('preview.unknown.author') })]),
      metaItems.length ? h('div', { class: 'og-preview__meta' }, metaItems) : null,
      actions
    ]);

    card.appendChild(h('div', { class: 'og-preview__main' }, [thumb, info]));
    if (data.note || data.error) {
      var noteCls = 'og-preview__note' + (data.error ? ' og-preview__note--err' : data.direct ? ' og-preview__note--ok' : '');
      card.appendChild(h('div', { class: noteCls }, [h('span', { html: icon(data.error ? 'alert' : data.direct ? 'shield' : 'info') }), h('span', { text: data.error ? data.error + ' · ' + (data.note || '') : data.note })]));
    }
    slot.appendChild(card);
  }

  function startDownload(url, filename, button) {
    if (!OG.downloads || !OG.downloads.start) {
      OG.ui.toast(t('preview.error.unsupported'), 'error');
      return;
    }
    if (button) { button.disabled = true; }
    Promise.resolve(OG.downloads.start(url, { filename: filename })).then(function () {
      OG.ui.toast(t('toast.downloadStarted'));
      setTimeout(function () { OG.nav('downloads'); }, 260);
    }).catch(function (err) {
      if (button) button.disabled = false;
      OG.ui.toast((err && err.message) || t('toast.downloadFailed'), 'error');
    });
  }

  function copy(text) {
    OG.utils.copyText(text).then(function (ok) {
      OG.ui.toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'success' : 'warn');
    });
  }

  /* ============================================================
   * DOWNLOADS
   * ============================================================ */
  OG.registerView('downloads', function (root) {
    var filter = 'all';
    var listHost = h('div', { class: 'og-download-list' });

    function items() {
      var all = (OG.state.downloads || []).slice().reverse();
      if (filter === 'active') return all.filter(function (d) { return d.status === 'active' || d.status === 'paused'; });
      if (filter === 'queued') return all.filter(function (d) { return d.status === 'queued'; });
      if (filter === 'done') return all.filter(function (d) { return d.status === 'done'; });
      if (filter === 'failed') return all.filter(function (d) { return d.status === 'error' || d.status === 'canceled'; });
      return all;
    }

    function counts() {
      var all = OG.state.downloads || [];
      return {
        all: all.length,
        active: all.filter(function (d) { return d.status === 'active' || d.status === 'paused'; }).length,
        queued: all.filter(function (d) { return d.status === 'queued'; }).length,
        done: all.filter(function (d) { return d.status === 'done'; }).length,
        failed: all.filter(function (d) { return d.status === 'error' || d.status === 'canceled'; }).length
      };
    }

    var filterDefs = [
      { id: 'all', key: 'downloads.filter.all' },
      { id: 'active', key: 'downloads.filter.active' },
      { id: 'queued', key: 'downloads.filter.queued' },
      { id: 'done', key: 'downloads.filter.done' },
      { id: 'failed', key: 'downloads.filter.failed' }
    ];

    var tabsHost = h('div', { class: 'og-tabs' });
    var statsHost = h('div', { class: 'og-toolbar__meta' });

    function renderTabs() {
      clear(tabsHost);
      var c = counts();
      filterDefs.forEach(function (f) {
        var active = filter === f.id;
        var btnEl = h('button', { type: 'button', class: 'og-tab' + (active ? ' is-active' : ''), onclick: function () { filter = f.id; renderTabs(); renderList(); } }, [
          h('span', { text: t(f.key) }),
          h('span', { class: 'og-tab__count', text: String(c[f.id] || 0) })
        ]);
        tabsHost.appendChild(btnEl);
      });
    }

    function speedLimitSelect() {
      var options = [0, 1, 2, 5, 10];
      var wrap = h('select', { class: 'og-select', style: 'width:auto;height:32px;padding:4px 30px 4px 10px;font-size:12px', 'aria-label': t('downloads.speedLimit') });
      options.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = String(v);
        opt.textContent = v === 0 ? t('downloads.speedLimit.off') : v + ' MB/s';
        if ((OG.state.settings.speedLimit || 0) === v) opt.selected = true;
        wrap.appendChild(opt);
      });
      wrap.addEventListener('change', function () {
        OG.state.settings.speedLimit = Number(wrap.value) || 0;
        OG.saveState();
        if (OG.downloads && OG.downloads.setSpeedLimit) OG.downloads.setSpeedLimit(OG.state.settings.speedLimit);
      });
      return wrap;
    }

    function actionBtn(label, iconName, onClick, extra) {
      return btn(label, { icon: iconName, small: true, onClick: onClick, danger: extra === 'danger' });
    }

    function renderList() {
      clear(listHost);
      var list = items();
      var c = counts();
      statsHost.innerHTML = '';
      statsHost.appendChild(h('span', { html: icon('radio') }));
      statsHost.appendChild(h('span', { text: t('downloads.sub', { active: c.active, done: c.done }) }));
      if (!list.length) {
        listHost.appendChild(emptyState({
          icon: 'download',
          title: filter === 'all' ? t('downloads.empty.title') : t('preview.kind.unknown'),
          sub: t('downloads.empty.sub'),
          actionLabel: t('downloads.empty.cta'),
          onAction: function () { OG.nav('home'); }
        }));
        return;
      }
      list.forEach(function (d) {
        listHost.appendChild(renderDownloadCard(d));
      });
    }

    function renderDownloadCard(d) {
      var isEngine = d.source === 'engine';
      var st = (isEngine && d.phase === 'processing')
        ? { cls: 'og-badge og-badge--info', text: t('engine.local.processing') }
        : statusMeta(d.status);
      var p = platformOf(d.platform);
      var progressPct = 0;
      if (d.size) progressPct = Math.min(100, Math.round(((d.received || 0) / d.size) * 100));
      else if (d.status === 'done') progressPct = 100;
      if (isEngine && d.progress) progressPct = Math.max(progressPct, Math.round(d.progress));
      var progressClass = 'og-progress' + (d.status === 'done' ? ' og-progress--done' : d.status === 'error' ? ' og-progress--err' : (!d.size && (d.status === 'active' || d.status === 'queued') ? ' og-progress--indeterminate' : ''));

      var meta = h('div', { class: 'og-download__meta' }, [
        h('span', { html: icon(p && OG.icons[p.icon] ? p.icon : 'globe') }),
        h('span', { text: d.platform === 'local' ? t('engine.local.platform') : (p ? p.name : (d.platform === 'direct' ? t('preview.kind.direct') : (d.platform || t('common.unknown')))) }),
        d.quality && d.quality !== 'best' ? h('span', { class: 'og-badge og-badge--info', text: d.quality === 'audio' ? 'MP3' : d.quality + 'p' }) : null,
        d.kind ? h('span', { class: 'og-badge', text: String(d.kind).toUpperCase() }) : null,
        d.size ? h('span', { text: OG.utils.fmtBytes(d.size) }) : h('span', { text: t('download.pendingSize') }),
        d.memoryRisk ? h('span', { class: 'og-badge og-badge--warn', text: t('download.memoryRisk') }) : null
      ]);

      var stats = h('div', { class: 'og-download__stats' });
      if (d.status === 'active') {
        stats.appendChild(h('span', {}, [h('b', { text: OG.utils.fmtBytes(d.received || 0) }), ' / ' + (d.size ? OG.utils.fmtBytes(d.size) : '?')]));
        stats.appendChild(h('span', {}, [h('b', { text: OG.utils.fmtSpeed(d.speed || 0) + '/s' })]));
        if (d.eta) stats.appendChild(h('span', {}, [h('b', { text: OG.utils.fmtEta(d.eta) })]));
        if (progressPct) stats.appendChild(h('span', { text: progressPct + '%' }));
      } else if (d.status === 'done') {
        stats.appendChild(h('span', { text: (d.size ? OG.utils.fmtBytes(d.size) : '') + ' · ' + t('download.status.done') }));
        if (d.finishedAt) stats.appendChild(h('span', { text: OG.utils.fmtDate(d.finishedAt) }));
      } else if (d.status === 'queued') {
        stats.appendChild(h('span', { text: t('download.waiting') }));
      } else if (d.status === 'paused') {
        stats.appendChild(h('span', { text: OG.utils.fmtBytes(d.received || 0) + ' / ' + (d.size ? OG.utils.fmtBytes(d.size) : '?') }));
      } else if (d.status === 'error') {
        stats.appendChild(h('span', { class: 'og-download__error' }, [h('span', { html: icon('alert') }), h('span', { text: errorText(d) })]));
      } else if (d.status === 'canceled') {
        stats.appendChild(h('span', { text: t('download.status.canceled') }));
      }

      var progress = h('div', { class: progressClass }, [
        h('div', { class: 'og-progress__fill', style: d.size || d.status === 'done' ? 'width:' + progressPct + '%' : (d.status === 'active' ? 'width:35%' : 'width:0%') })
      ]);

      var actions = h('div', { class: 'og-download__actions' });
      if (isEngine) {
        if (d.status === 'queued' || d.status === 'active') {
          actions.appendChild(actionBtn(t('download.action.cancel'), 'close', function () { engineCancel(d); }));
        }
        if (d.status === 'error' || d.status === 'canceled') {
          actions.appendChild(actionBtn(t('download.action.retry'), 'refresh', function () { engineRetry(d); }));
        }
        if (d.status === 'done') {
          actions.appendChild(actionBtn(t('download.action.play'), 'play', function () { enginePlay(d); }));
          actions.appendChild(actionBtn(t('download.action.copyLink'), 'link', function () { copy(OG.localEngine.fileUrl(d.engineId)); }));
          if (OG.openDownloadsFolder) actions.appendChild(actionBtn(t('engine.local.openFolder'), 'folder', function () { OG.openDownloadsFolder(); }));
        }
        actions.appendChild(actionBtn(t('download.action.remove'), 'trash', function () { engineRemove(d); }));
      } else {
        if (d.status === 'active') actions.appendChild(actionBtn(t('download.action.pause'), 'pause', function () { safe('pause', d.id); }));
        if (d.status === 'paused') actions.appendChild(actionBtn(t('download.action.resume'), 'play', function () { safe('resume', d.id); }));
        if (d.status === 'queued' || d.status === 'active' || d.status === 'paused') actions.appendChild(actionBtn(t('download.action.cancel'), 'close', function () { safe('cancel', d.id); }));
        if (d.status === 'error' || d.status === 'canceled') actions.appendChild(actionBtn(t('download.action.retry'), 'refresh', function () { safe('retry', d.id); }));
        if (d.status === 'done') {
          if (['video', 'audio', 'image'].indexOf(d.kind) >= 0 && OG.player) actions.appendChild(actionBtn(t('download.action.play'), 'play', function () { playItem(d); }));
          actions.appendChild(actionBtn(t('download.action.copyLink'), 'link', function () { copy(d.url); }));
        }
        actions.appendChild(actionBtn(t('download.action.remove'), 'trash', function () { removeItem(d); }));
      }

      return h('div', { class: 'og-download' }, [
        platformThumb(d),
        h('div', { class: 'og-download__body' }, [
          h('div', { class: 'og-download__top' }, [
            h('div', { class: 'og-download__title', text: d.title || d.filename || d.url }),
            h('span', { class: st.cls + ' og-download__status', text: st.text })
          ]),
          meta,
          progress,
          stats
        ]),
        actions
      ]);
    }

    function errorText(d) {
      if (d.errorHint === 'cors' || d.error === 'cors') return t('preview.error.cors');
      if (d.errorHint === 'unsupported' || d.error === 'unsupported') return t('preview.error.unsupported');
      if (d.errorHint === 'network' || d.error === 'network') return t('preview.error.network');
      return d.error || d.errorHint || t('download.status.error');
    }

    function safe(method, id) {
      try {
        if (OG.downloads && typeof OG.downloads[method] === 'function') OG.downloads[method](id);
      } catch (e) { console.error(e); }
      renderTabs();
      renderList();
    }

    function removeItem(d) {
      var doRemove = function () {
        try { if (OG.downloads && OG.downloads.remove) OG.downloads.remove(d.id); } catch (e) {}
        renderTabs();
        renderList();
      };
      if (d.status === 'done' || d.status === 'canceled' || d.status === 'error') { doRemove(); return; }
      OG.ui.confirm({ title: t('download.action.remove'), message: d.title || d.filename || d.url, confirmLabel: t('common.confirm'), cancelLabel: t('common.cancel'), danger: true }).then(function (ok) { if (ok) doRemove(); });
    }

    function playItem(d) {
      if (OG.player && OG.player.playDownloaded) { OG.player.playDownloaded(d); return; }
      if (d.url && OG.player && OG.player.openUrl) { OG.player.openUrl(d.url); return; }
      OG.ui.toast(t('preview.error.unsupported'), 'warn');
    }

    function engineCancel(d) {
      if (OG.localEngine && d.engineId) OG.localEngine.cancel(d.engineId);
      d.status = 'canceled';
      d.speed = 0;
      OG.emit('downloads:update');
    }

    function engineRetry(d) {
      if (!OG.localEngine) return;
      OG.localEngine.start(d.url, d.quality || 'best').then(function () {
        d.status = 'queued';
        d.received = 0;
        d.progress = 0;
        d.error = '';
        OG.ui.toast(t('engine.local.jobStarted'));
      }).catch(function (err) {
        OG.ui.toast((err && err.message) || t('engine.local.failed'), 'error');
      });
    }

    function enginePlay(d) {
      if (!OG.localEngine || !d.engineId) return;
      if (OG.player && OG.player.openUrl) OG.player.openUrl(OG.localEngine.fileUrl(d.engineId));
    }

    function engineRemove(d) {
      if (OG.localEngine && d.engineId && (d.status === 'active' || d.status === 'queued')) {
        OG.localEngine.cancel(d.engineId);
      }
      OG.state.downloads = (OG.state.downloads || []).filter(function (x) { return x.id !== d.id; });
      OG.emit('downloads:update');
    }

    var head = pageHead({
      eyebrow: t('downloads.title'),
      title: t('route.downloads.title'),
      sub: t('downloads.sub', { active: counts().active, done: counts().done }),
      actions: [
        OG.isAndroid ? null : speedLimitSelect(),
        btn(t('downloads.clear'), { icon: 'trash', onClick: function () {
          OG.ui.confirm({ title: t('downloads.clear'), message: t('downloads.clearConfirm'), danger: true, confirmLabel: t('common.confirm') }).then(function (ok) {
            if (ok && OG.downloads && OG.downloads.clearCompleted) { OG.downloads.clearCompleted(); renderTabs(); renderList(); }
          });
        } })
      ]
    });

    var toolbar = h('div', { class: 'og-toolbar' }, [tabsHost, h('div', { class: 'og-toolbar__spacer' }), statsHost]);

    root.appendChild(h('div', {}, [head, toolbar, listHost]));

    var off = OG.on('downloads:update', function () {
      renderTabs();
      renderList();
      var pageSub = document.getElementById('og-page-sub');
      if (pageSub) {
        var c = counts();
        pageSub.textContent = t('downloads.sub', { active: c.active, done: c.done });
      }
    });

    OG._cleanup = function () { off(); };

    renderTabs();
    renderList();

    if (OG.downloads && OG.downloads.setSpeedLimit && OG.state.settings.speedLimit) {
      try { OG.downloads.setSpeedLimit(OG.state.settings.speedLimit); } catch (e) {}
    }
  });

  /* ============================================================
   * LIBRARY
   * ============================================================ */
  OG.registerView('library', function (root) {
    var searchQuery = '';
    var typeFilter = 'all';
    var viewMode = 'grid';
    try { viewMode = localStorage.getItem('omniget.libview') || 'grid'; } catch (e) {}

    var host = h('div', {});
    var library = OG.library.all();

    function filtered() {
      return library.filter(function (item) {
        if (typeFilter !== 'all' && OG.utils.guessType(OG.utils.extOf(item.filename || item.url)) !== typeFilter) return false;
        if (!searchQuery) return true;
        var hay = ((item.title || '') + ' ' + (item.filename || '') + ' ' + (item.platform || '') + ' ' + (item.url || '')).toLowerCase();
        return hay.indexOf(searchQuery.toLowerCase()) >= 0;
      });
    }

    var searchInput = h('input', { type: 'text', placeholder: t('library.search'), 'aria-label': t('library.search'), style: 'flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--og-text);font-size:13.5px' });
    var onSearch = OG.utils.debounce(function () { searchQuery = searchInput.value.trim(); renderGrid(); }, 180);
    searchInput.addEventListener('input', onSearch);

    var searchBox = h('div', { class: 'og-tools-search', style: 'height:40px;max-width:360px;flex:1' }, [h('span', { html: icon('search') }), searchInput]);

    var typeTabs = h('div', { class: 'og-tabs' });
    function renderTypeTabs() {
      clear(typeTabs);
      [['all', 'library.filter.all'], ['video', 'library.filter.video'], ['audio', 'library.filter.audio'], ['image', 'library.filter.image'], ['file', 'library.filter.file']].forEach(function (pair) {
        typeTabs.appendChild(h('button', { type: 'button', class: 'og-tab' + (typeFilter === pair[0] ? ' is-active' : ''), onclick: function () { typeFilter = pair[0]; renderTypeTabs(); renderGrid(); }, text: t(pair[1]) }));
      });
    }

    var gridHost = h('div', {});
    var countHost = h('div', { class: 'og-toolbar__meta' });

    function renderGrid() {
      clear(gridHost);
      var list = filtered();
      countHost.innerHTML = '';
      countHost.appendChild(h('span', { text: t('library.sub', { n: list.length, size: OG.utils.fmtBytes(OG.library.bytes()) }) }));
      if (!list.length) {
        gridHost.appendChild(emptyState({
          icon: 'library',
          title: t('library.empty.title'),
          sub: t('library.empty.sub'),
          actionLabel: t('library.empty.cta'),
          onAction: function () { OG.nav('home'); }
        }));
        return;
      }
      if (viewMode === 'list') {
        var listEl = h('div', { class: 'og-lib-list' });
        list.forEach(function (item) { listEl.appendChild(renderRow(item)); });
        gridHost.appendChild(listEl);
      } else {
        var gridEl = h('div', { class: 'og-lib-grid' });
        list.forEach(function (item) { gridEl.appendChild(renderCard(item)); });
        gridHost.appendChild(gridEl);
      }
    }

    function renderCard(item) {
      var p = platformOf(item.platform);
      var cover = h('div', { class: 'og-lib-card__cover' });
      if (item.thumb) {
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '';
        img.src = item.thumb;
        img.onerror = function () { img.remove(); cover.innerHTML = icon(kindIcon(OG.utils.guessType(OG.utils.extOf(item.filename)))); };
        cover.appendChild(img);
      } else {
        cover.innerHTML = icon(p && OG.icons[p.icon] ? p.icon : kindIcon(OG.utils.guessType(OG.utils.extOf(item.filename))));
      }
      var acts = h('div', { class: 'og-lib-card__actions' }, [
        iconBtn('link', t('library.action.copy'), function (e) { e.stopPropagation(); copy(item.url); }),
        iconBtn('trash', t('library.action.remove'), function (e) {
          e.stopPropagation();
          OG.library.remove(item.id);
          library = OG.library.all();
          renderGrid();
        })
      ]);
      return h('div', { class: 'og-lib-card' }, [
        cover,
        acts,
        h('div', { class: 'og-lib-card__body' }, [
          h('div', { class: 'og-lib-card__title', text: item.title || item.filename || item.url }),
          h('div', { class: 'og-lib-card__meta' }, [
            h('span', { text: OG.utils.fmtBytes(item.size || 0) }),
            h('span', { text: '·' }),
            h('span', { text: p ? p.name : (item.platform || '') }),
            h('span', { text: '·' }),
            h('span', { text: OG.utils.fmtDate(item.ts, false) })
          ])
        ])
      ]);
    }

    function renderRow(item) {
      var p = platformOf(item.platform);
      return h('div', { class: 'og-lib-row' }, [
        h('div', { class: 'og-lib-row__icon', html: icon(p && OG.icons[p.icon] ? p.icon : kindIcon(OG.utils.guessType(OG.utils.extOf(item.filename)))) }),
        h('div', { class: 'og-lib-row__main' }, [
          h('div', { class: 'og-lib-row__title', text: item.title || item.filename || item.url }),
          h('div', { class: 'og-lib-row__sub', text: [OG.utils.fmtBytes(item.size || 0), p ? p.name : item.platform, OG.utils.fmtDate(item.ts)].filter(Boolean).join(' · ') })
        ]),
        h('div', { class: 'og-row' }, [
          btn(t('library.action.copy'), { icon: 'link', small: true, ghost: true, onClick: function () { copy(item.url); } }),
          btn(t('library.action.remove'), { icon: 'trash', small: true, ghost: true, onClick: function () {
            OG.library.remove(item.id);
            library = OG.library.all();
            renderGrid();
          } })
        ])
      ]);
    }

    var viewToggle = h('div', { class: 'og-tabs' }, [
      h('button', { type: 'button', class: 'og-tab' + (viewMode === 'grid' ? ' is-active' : ''), title: t('library.view.grid'), 'aria-label': t('library.view.grid'), onclick: function (e) { setView('grid', e.currentTarget); } }, [h('span', { html: icon('grid') })]),
      h('button', { type: 'button', class: 'og-tab' + (viewMode === 'list' ? ' is-active' : ''), title: t('library.view.list'), 'aria-label': t('library.view.list'), onclick: function (e) { setView('list', e.currentTarget); } }, [h('span', { html: icon('list') })])
    ]);
    function setView(mode, btnEl) {
      viewMode = mode;
      try { localStorage.setItem('omniget.libview', mode); } catch (e) {}
      viewToggle.querySelectorAll('.og-tab').forEach(function (b) { b.classList.remove('is-active'); });
      if (btnEl) btnEl.classList.add('is-active');
      renderGrid();
    }

    var head = pageHead({
      eyebrow: t('library.title'),
      title: t('route.library.title'),
      sub: t('library.sub', { n: OG.library.all().length, size: OG.utils.fmtBytes(OG.library.bytes()) }),
      actions: [
        viewToggle,
        btn(t('library.clear'), { icon: 'trash', onClick: function () {
          OG.ui.confirm({ title: t('library.clear'), message: t('library.clearConfirm'), danger: true, confirmLabel: t('common.confirm') }).then(function (ok) {
            if (ok) { OG.library.clear(); library = OG.library.all(); renderGrid(); }
          });
        } })
      ]
    });

    renderTypeTabs();
    renderGrid();
    root.appendChild(h('div', {}, [head, h('div', { class: 'og-toolbar' }, [searchBox, h('div', { class: 'og-toolbar__spacer' }), typeTabs, countHost]), gridHost]));

    var off = OG.on('library:update', function () {
      library = OG.library.all();
      renderGrid();
    });
    OG._cleanup = function () { off(); };
  });

  /* ============================================================
   * TOOLS
   * ============================================================ */
  OG.registerView('tools', function (root) {
    var tools = (OG.tools && OG.tools.list) ? OG.tools.list : [];
    var categories = (OG.tools && OG.tools.categories) ? OG.tools.categories : [];
    var activeCat = 'all';
    var query = '';

    var searchInput = h('input', { type: 'text', placeholder: t('tools.search'), 'aria-label': t('tools.search') });
    var searchBox = h('div', { class: 'og-tools-search' }, [h('span', { html: icon('search') }), searchInput]);

    var catRow = h('div', { class: 'og-cat-row' });
    function renderCats() {
      clear(catRow);
      catRow.appendChild(h('button', { type: 'button', class: 'og-chip' + (activeCat === 'all' ? ' is-active' : ''), onclick: function () { activeCat = 'all'; renderCats(); renderGrid(); } }, [h('span', { text: t('tools.all') }), h('span', { class: 'og-badge', text: String(tools.length) })]));
      categories.forEach(function (cat) {
        var count = tools.filter(function (x) { return x.category === cat.id; }).length;
        if (!count) return;
        var chip = h('button', { type: 'button', class: 'og-chip' + (activeCat === cat.id ? ' is-active' : ''), onclick: function () { activeCat = cat.id; renderCats(); renderGrid(); } }, [
          h('span', { text: OG.toolText(cat.name) }),
          h('span', { class: 'og-badge', text: String(count) })
        ]);
        catRow.appendChild(chip);
      });
    }

    var gridHost = h('div', { class: 'og-tools-grid' });
    var countHost = h('div', { class: 'og-toolbar__meta' });

    function toolIconHTML(tool) {
      var raw = tool.icon;
      if (typeof raw === 'string' && raw.trim().slice(0, 4) === '<svg') return raw;
      return icon(raw || 'tools');
    }

    function toolGradient(tool) {
      var g = tool.gradient;
      if (Array.isArray(g) && g.length >= 2) return 'linear-gradient(140deg,' + g[0] + ',' + g[1] + ')';
      return 'linear-gradient(140deg, var(--og-primary-2), var(--og-primary-deep))';
    }

    function renderGrid() {
      clear(gridHost);
      var q = query.toLowerCase();
      var list = tools.filter(function (tool) {
        if (activeCat !== 'all' && tool.category !== activeCat) return false;
        if (!q) return true;
        var title = OG.toolText(tool.title).toLowerCase();
        var desc = OG.toolText(tool.desc).toLowerCase();
        return title.indexOf(q) >= 0 || desc.indexOf(q) >= 0 || tool.id.indexOf(q) >= 0;
      });
      countHost.innerHTML = '';
      countHost.appendChild(h('span', { text: t('tools.sub', { n: list.length }) }));
      if (!list.length) {
        gridHost.appendChild(emptyState({ icon: 'search', title: t('tools.empty'), sub: t('tools.search') }));
        return;
      }
      list.forEach(function (tool) {
        var tile = h('button', { type: 'button', class: 'og-tool-tile', onclick: function () { openTool(tool.id); } }, [
          h('div', { class: 'og-tool-tile__icon', style: 'background:' + toolGradient(tool), html: toolIconHTML(tool) }),
          h('div', { class: 'og-tool-tile__title', text: OG.toolText(tool.title) }),
          h('div', { class: 'og-tool-tile__desc', text: OG.toolText(tool.desc) }),
          h('div', { class: 'og-tool-tile__foot' }, [
            h('span', { class: 'og-tool-tile__status', text: tool.status === 'beta' ? t('tools.status.beta') : t('tools.status.ready') }),
            h('span', { class: 'og-tool-tile__open' }, [h('span', { text: t('tools.open') }), h('span', { html: icon('chevronRight') })])
          ])
        ]);
        gridHost.appendChild(tile);
      });
    }

    function openTool(id) {
      var tool = tools.filter(function (x) { return x.id === id; })[0];
      if (!tool) return;
      var bodyEl = h('div', { class: 'og-tool-body' });
      var m = OG.ui.modal({
        title: '',
        wide: true,
        body: bodyEl,
        onClose: function () { if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } }
      });
      m.el.classList.add('og-tool-modal');
      var headEl = m.el.querySelector('.og-modal__head');
      var titleEl = m.el.querySelector('.og-modal__title');
      if (titleEl) titleEl.textContent = OG.toolText(tool.title);
      var subEl = m.el.querySelector('.og-modal__subtitle');
      if (subEl && subEl.parentNode) subEl.parentNode.removeChild(subEl);
      if (headEl) {
        var sub = h('p', { class: 'og-modal__subtitle', text: t('tools.modal.sub') });
        headEl.querySelector('div').appendChild(sub);
      }
      var cleanup = null;
      try {
        if (OG.tools && OG.tools.open) cleanup = OG.tools.open(id, bodyEl);
      } catch (e) {
        bodyEl.appendChild(h('div', { class: 'og-empty' }, [h('div', { class: 'og-empty__title', text: t('tools.empty') })]));
      }
    }

    var offTool = OG.on('tools:open', function (payload) { if (payload && payload.id) openTool(payload.id); });
    OG._cleanup = function () { offTool(); };

    var onSearch = OG.utils.debounce(function () { query = searchInput.value.trim(); renderGrid(); }, 160);
    searchInput.addEventListener('input', onSearch);

    var hero = h('div', { class: 'og-tools-hero' }, [
      h('div', { class: 'og-tools-hero__mark', html: icon('tools') }),
      h('div', {}, [
        h('div', { class: 'og-tools-hero__title', text: t('route.tools.title') }),
        h('div', { class: 'og-tools-hero__sub', text: t('tools.sub', { n: tools.length }) })
      ])
    ]);

    renderCats();
    renderGrid();
    root.appendChild(h('div', {}, [
      hero,
      searchBox,
      catRow,
      h('div', { class: 'og-toolbar' }, [h('div', { class: 'og-toolbar__spacer' }), countHost]),
      gridHost
    ]));

    if (!tools.length) {
      gridHost.appendChild(emptyState({ icon: 'tools', title: t('tools.empty'), sub: t('common.loading') }));
    }
  });

  /* ============================================================
   * SETTINGS
   * ============================================================ */
  OG.registerView('settings', function (root) {
    var container = h('div', { class: 'og-settings-grid' });

    function card(titleKey, iconName, children, extraClass) {
      return h('div', { class: 'og-settings-card' + (extraClass ? ' ' + extraClass : '') }, [
        h('div', { class: 'og-settings-card__title' }, [h('span', { html: icon(iconName) }), h('span', { text: t(titleKey) })])
      ].concat(children));
    }

    function row(labelKey, hintKey, control) {
      return h('div', { class: 'og-setting-row' }, [
        h('div', { class: 'og-setting-row__label' }, [
          h('span', { text: t(labelKey) }),
          hintKey ? h('span', { class: 'og-setting-row__hint', text: t(hintKey) }) : null
        ]),
        h('div', { class: 'og-setting-row__control' }, [control])
      ]);
    }

    /* 外观 */
    var themePicker = h('div', { class: 'og-theme-picker' });
    [['dark', 'settings.theme.dark'], ['light', 'settings.theme.light'], ['auto', 'settings.theme.auto']].forEach(function (pair) {
      var opt = h('button', { type: 'button', class: 'og-theme-option' + (OG.state.theme === pair[0] ? ' is-active' : ''), onclick: function () {
        OG.setTheme(pair[0]);
        themePicker.querySelectorAll('.og-theme-option').forEach(function (n) { n.classList.remove('is-active'); });
        opt.classList.add('is-active');
      } }, [
        h('div', { class: 'og-theme-option__preview ' + pair[0] }, [
          h('div', { class: 'og-theme-option__bar' }),
          h('div', { class: 'og-theme-option__bar dim' })
        ]),
        h('div', { class: 'og-theme-option__label', text: t(pair[1]) })
      ]);
      themePicker.appendChild(opt);
    });

    var accentRow = h('div', { class: 'og-accent-row' });
    Object.keys(OG.ACCENTS).forEach(function (name) {
      var dot = h('button', {
        type: 'button',
        class: 'og-accent-dot' + (OG.state.accent === name ? ' is-active' : ''),
        style: 'background:' + OG.ACCENTS[name] + ';color:' + OG.ACCENTS[name],
        title: name,
        'aria-label': name,
        onclick: function () {
          OG.setAccent(name);
          accentRow.querySelectorAll('.og-accent-dot').forEach(function (n) { n.classList.remove('is-active'); });
          dot.classList.add('is-active');
        }
      });
      accentRow.appendChild(dot);
    });

    var langSeg = h('div', { class: 'og-tabs' }, [
      h('button', { type: 'button', class: 'og-tab' + (OG.state.lang === 'zh' ? ' is-active' : ''), onclick: function () { OG.setLang('zh'); }, text: t('settings.lang.zh') }),
      h('button', { type: 'button', class: 'og-tab' + (OG.state.lang === 'en' ? ' is-active' : ''), onclick: function () { OG.setLang('en'); }, text: t('settings.lang.en') })
    ]);

    var motionSwitch = h('label', { class: 'og-switch' });
    motionSwitch.appendChild(h('input', { type: 'checkbox', checked: OG.state.settings.reduceMotion, onchange: function (e) {
      OG.state.settings.reduceMotion = e.target.checked;
      OG.saveState();
      OG.applyTheme();
    } }));
    motionSwitch.appendChild(h('span', { class: 'og-switch__track' }));
    motionSwitch.appendChild(h('span', { class: 'og-switch__label', text: t('settings.reduceMotion') }));

    var compactSwitch = h('label', { class: 'og-switch' });
    compactSwitch.appendChild(h('input', { type: 'checkbox', checked: OG.state.settings.compact, onchange: function (e) {
      OG.state.settings.compact = e.target.checked;
      OG.saveState();
      OG.applyTheme();
    } }));
    compactSwitch.appendChild(h('span', { class: 'og-switch__track' }));
    compactSwitch.appendChild(h('span', { class: 'og-switch__label', text: t('settings.compact') }));

    var appearanceCard = card('settings.appearance', 'sparkle', [
      h('div', { class: 'og-field' }, [h('span', { class: 'og-label', text: t('settings.theme') }), themePicker]),
      h('div', { class: 'og-field' }, [h('span', { class: 'og-label', text: t('settings.accent') }), accentRow]),
      row('settings.lang', null, langSeg),
      row('settings.reduceMotion', null, motionSwitch),
      row('settings.compact', null, compactSwitch)
    ]);

    /* 下载 */
    var concurrency = h('select', { class: 'og-select', style: 'width:auto;min-width:90px', 'aria-label': t('settings.concurrency') });
    [1, 2, 3, 4].forEach(function (n) {
      var o = document.createElement('option');
      o.value = String(n);
      o.textContent = String(n);
      if (Number(OG.state.settings.concurrency) === n) o.selected = true;
      concurrency.appendChild(o);
    });
    concurrency.addEventListener('change', function () {
      OG.state.settings.concurrency = Number(concurrency.value) || 2;
      OG.saveState();
    });

    var speed = h('select', { class: 'og-select', style: 'width:auto;min-width:120px', 'aria-label': t('settings.speedLimit') });
    [0, 1, 2, 5, 10, 20].forEach(function (v) {
      var o = document.createElement('option');
      o.value = String(v);
      o.textContent = v === 0 ? t('settings.speedLimit.off') : v + ' MB/s';
      if (Number(OG.state.settings.speedLimit) === v) o.selected = true;
      speed.appendChild(o);
    });
    speed.addEventListener('change', function () {
      OG.state.settings.speedLimit = Number(speed.value) || 0;
      OG.saveState();
      if (OG.downloads && OG.downloads.setSpeedLimit) OG.downloads.setSpeedLimit(OG.state.settings.speedLimit);
    });

    var downloadsCard = card('settings.downloads', 'download', [
      row('settings.concurrency', 'settings.concurrency.hint', concurrency)
    ].concat(OG.isAndroid ? [] : [row('settings.speedLimit', 'settings.speedLimit.hint', speed)]));

    /* 数据 */
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) OG.importData(fileInput.files[0]);
      fileInput.value = '';
    });
    document.body.appendChild(fileInput);

    var dataCard = card('settings.data', 'harddrive', [
      row('settings.data.storage', null, h('span', { class: 'og-badge og-badge--info', text: t('settings.data.storage.val', { n: OG.state.library.length, size: OG.utils.fmtBytes(OG.library.bytes()) }) })),
      h('div', { class: 'og-row' }, [
        btn(t('settings.data.export'), { icon: 'download', onClick: function () { OG.exportData(); } }),
        btn(t('settings.data.import'), { icon: 'folder', onClick: function () { fileInput.click(); } })
      ]),
      h('p', { class: 'og-hint', text: t('settings.data.note') })
    ]);

    var dangerCard = card('settings.data', 'alert', [
      h('div', { class: 'og-row' }, [
        btn(t('settings.data.clear'), { icon: 'trash', danger: true, onClick: function () {
          OG.ui.confirm({ title: t('settings.data.clear'), message: t('settings.data.clearConfirm'), danger: true, confirmLabel: t('common.confirm') }).then(function (ok) {
            if (ok) { OG.clearAllData(); }
          });
        } }),
        btn(t('settings.reset'), { icon: 'refresh', onClick: function () {
          OG.ui.confirm({ title: t('settings.reset'), message: t('settings.data.clearConfirm'), danger: true }).then(function (ok) {
            if (!ok) return;
            OG.state.settings = { concurrency: 2, speedLimit: 0, reduceMotion: false, compact: false };
            OG.setTheme('dark');
            OG.setAccent('orange');
            OG.saveState();
            OG.applyTheme();
            OG.nav('settings');
          });
        } })
      ]),
      h('p', { class: 'og-hint', text: t('settings.data.note') })
    ], 'og-danger-zone');

    /* 关于入口 */
    var engineCard = (function () {
      var online = !!(OG.localEngine && OG.localEngine.online);
      var dot = h('span', { class: 'og-engine-dot ' + (online ? 'is-online' : 'is-offline') });
      var statusText = h('span', { text: online ? t('engine.local.online') : t('engine.local.offline') });
      var checkBtn = btn(t('engine.local.check'), { icon: 'refresh', small: true, onClick: function () {
        checkBtn.disabled = true;
        OG.localEngine.check(true).then(function (ok) {
          checkBtn.disabled = false;
          dot.className = 'og-engine-dot ' + (ok ? 'is-online' : 'is-offline');
          statusText.textContent = ok ? t('engine.local.online') : t('engine.local.offline');
          OG.ui.toast(ok ? t('engine.local.online') : t('engine.local.offline'), ok ? 'success' : 'warn');
        });
      } });
      var helpBtn = btn(t('engine.local.help'), { icon: 'zap', small: true, onClick: function () { OG.localEngine.showHelp(); } });
      var urlInput = h('input', { class: 'og-input', type: 'text', value: (OG.localEngine ? OG.localEngine.base : 'http://127.0.0.1:8791'), 'aria-label': t('engine.local.url') });
      var saveBtn = btn(t('engine.local.save'), { icon: 'check', small: true, onClick: function () {
        if (OG.localEngine && OG.localEngine.setBase(urlInput.value)) {
          OG.ui.toast(t('toast.saved'));
          OG.localEngine.check(true).then(function (ok) {
            dot.className = 'og-engine-dot ' + (ok ? 'is-online' : 'is-offline');
            statusText.textContent = ok ? t('engine.local.online') : t('engine.local.offline');
          });
        } else {
          OG.ui.toast('URL 无效', 'warn');
        }
      } });
      return card('engine.local.settings', 'zap', [
        h('div', { class: 'og-setting-row' }, [
          h('div', { class: 'og-setting-row__label' }, [
            h('span', { text: t('engine.local.name') }),
            h('span', { class: 'og-setting-row__hint', text: t('engine.local.hint') })
          ]),
          h('div', { class: 'og-setting-row__control' }, [dot, statusText])
        ]),
        h('div', { class: 'og-field' }, [h('span', { class: 'og-label', text: t('engine.local.url') }), urlInput]),
        h('div', { class: 'og-row' }, [checkBtn, helpBtn, saveBtn])
      ]);
    })();

    var aboutCard = card('settings.about', 'info', [
      h('div', { class: 'og-setting-row' }, [
        h('div', { class: 'og-setting-row__label' }, [
          h('span', { text: t('settings.about.version') }),
          h('span', { class: 'og-setting-row__hint', text: t('settings.about.license') })
        ]),
        h('span', { class: 'og-badge', text: t('settings.about.version.val', { v: OG.version }) })
      ]),
      h('div', { class: 'og-row' }, [
        btn(t('settings.about.open'), { icon: 'chevronRight', onClick: function () { OG.nav('about'); } })
      ])
    ]);

    container.appendChild(appearanceCard);
    container.appendChild(downloadsCard);
    container.appendChild(engineCard);
    container.appendChild(dataCard);
    container.appendChild(aboutCard);
    container.appendChild(dangerCard);

    var head = pageHead({
      eyebrow: t('settings.appearance'),
      title: t('route.settings.title'),
      sub: t('route.settings.sub')
    });
    root.appendChild(h('div', {}, [head, container]));

    OG._cleanup = function () {
      if (fileInput.parentNode) fileInput.parentNode.removeChild(fileInput);
    };
  });

  /* ============================================================
   * ABOUT
   * ============================================================ */
  OG.registerView('about', function (root) {
    var size = 0;
    try { size = new Blob([document.documentElement.outerHTML]).size; } catch (e) {}
    var hero = h('div', { class: 'og-about-hero' }, [
      h('div', { class: 'og-about-hero__mark', html: icon('logo') }),
      h('div', { style: 'min-width:0;flex:1' }, [
        h('div', { class: 'og-about-hero__title', text: 'Meteor' }),
        h('div', { class: 'og-about-hero__sub', text: t('app.tagline') }),
        h('div', { class: 'og-about-hero__meta' }, [
          h('span', { class: 'og-badge og-badge--primary', text: t('settings.about.version.val', { v: OG.version }) }),
          h('span', { class: 'og-badge', text: 'HTML + CSS + JS' }),
          h('span', { class: 'og-badge og-badge--ok', text: t('home.trust.nobackend') }),
          h('span', { class: 'og-badge', text: 'GPL-3.0' })
        ])
      ])
    ]);

    function block(iconName, titleKey, bodyKey, vars) {
      return h('div', { class: 'og-about-block' }, [
        h('h3', {}, [h('span', { html: icon(iconName) }), h('span', { text: t(titleKey) })]),
        h('p', { text: t(bodyKey, vars) })
      ]);
    }

    var grid = h('div', { class: 'og-about-grid' }, [
      block('info', 'about.intro.title', 'about.intro.body'),
      block('alert', 'about.limit.title', 'about.limit.body'),
      block('shield', 'about.ethic.title', 'about.ethic.body'),
      block('file', 'about.tech.title', 'about.tech.body', { size: OG.utils.fmtBytes(size) })
    ]);

    grid.appendChild(block('zap', 'engine.local.name', 'engine.local.hint'));

    var keys = h('div', { class: 'og-about-block' }, [
      h('h3', {}, [h('span', { html: icon('command') }), h('span', { text: t('about.keys.title') })]),
      h('div', { class: 'og-keys' }, [
        h('div', { class: 'og-keys__row' }, [h('span', { text: t('about.keys.palette') }), h('span', {}, [h('span', { class: 'og-kbd', text: 'Ctrl' }), h('span', { class: 'og-kbd', text: 'K' })])]),
        h('div', { class: 'og-keys__row' }, [h('span', { text: t('about.keys.nav') }), h('span', {}, [h('span', { class: 'og-kbd', text: 'Ctrl' }), h('span', { class: 'og-kbd', text: '1 … 6' })])]),
        h('div', { class: 'og-keys__row' }, [h('span', { text: t('about.keys.close') }), h('span', { class: 'og-kbd', text: 'Esc' })])
      ])
    ]);

    var foot = h('p', { class: 'og-home-footer', style: 'text-align:left' }, [
      h('span', { text: t('about.footer') + ' · ' }),
      h('a', { href: 'https://github.com/OpenSelena/omniget', target: '_blank', rel: 'noopener noreferrer', text: 'OpenSelena/omniget' })
    ]);

    root.appendChild(h('div', { class: 'og-about' }, [hero, grid, keys, foot]));
  });

  /* ============================================================
   * 启动时的 URL 参数：?url=... （方便从别处唤起）
   * ========================================================== */
  (function () {
    try {
      var params = new URLSearchParams(location.search);
      var url = params.get('url');
      if (url) OG._pendingUrl = url;
    } catch (e) {}
  })();
})();
