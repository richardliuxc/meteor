/* ============================================================
 * OmniGet Studio · 单文件版
 * core.js — 命名空间 / 状态 / i18n / 图标 / 路由 / UI 原语 / 主题
 * 纯前端、零后端；所有模块挂在 window.OG 下
 * ============================================================ */
(function () {
  'use strict';

  var OG = (window.OG = window.OG || {});
  OG.version = '1.1.0';
  OG.storageKey = 'omniget.studio.v1';

  /* ------------------------------------------------------------
   * 1. 默认状态与持久化
   * ---------------------------------------------------------- */
  var DEFAULTS = {
    lang: 'zh',
    theme: 'dark',            // dark | light | auto
    accent: 'orange',         // orange | sky | violet | emerald | rose | amber
    settings: {
      concurrency: 2,
      speedLimit: 0,
      reduceMotion: false,
      compact: false
    },
    library: [],
    history: [],
    stats: { bytes: 0, files: 0, parsed: 0 }
  };

  OG.state = {
    lang: DEFAULTS.lang,
    theme: DEFAULTS.theme,
    accent: DEFAULTS.accent,
    settings: Object.assign({}, DEFAULTS.settings),
    library: [],
    history: [],
    stats: Object.assign({}, DEFAULTS.stats),
    downloads: []
  };

  OG.ACCENTS = {
    orange: '#FF7D38',
    sky: '#38BDF8',
    violet: '#8B5CF6',
    emerald: '#10B981',
    rose: '#F43F5E',
    amber: '#F59E0B'
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(OG.storageKey);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return false;
      OG.state.lang = saved.lang === 'en' ? 'en' : 'zh';
      OG.state.theme = ['dark', 'light', 'auto'].indexOf(saved.theme) >= 0 ? saved.theme : 'dark';
      OG.state.accent = OG.ACCENTS[saved.accent] ? saved.accent : 'orange';
      if (saved.settings && typeof saved.settings === 'object') {
        Object.keys(DEFAULTS.settings).forEach(function (k) {
          if (saved.settings[k] !== undefined) OG.state.settings[k] = saved.settings[k];
        });
      }
      OG.state.library = Array.isArray(saved.library) ? saved.library.slice(0, 500) : [];
      OG.state.history = Array.isArray(saved.history) ? saved.history.slice(0, 20) : [];
      if (saved.stats && typeof saved.stats === 'object') {
        OG.state.stats = Object.assign({}, DEFAULTS.stats, saved.stats);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  var saveTimer = null;
  OG.saveState = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(OG.storageKey, JSON.stringify({
          lang: OG.state.lang,
          theme: OG.state.theme,
          accent: OG.state.accent,
          settings: OG.state.settings,
          library: OG.state.library,
          history: OG.state.history,
          stats: OG.state.stats
        }));
      } catch (e) {
        /* 隐私模式 / 配额不足时静默降级 */
      }
    }, 250);
  };

  /* ------------------------------------------------------------
   * 2. i18n
   * ---------------------------------------------------------- */
  OG.dict = {
    zh: {
      'app.name': 'Meteor',
      'app.tagline': '流星下载 · 单文件 · 零后端',
      'app.version': 'v{v}',

      'nav.home': '首页',
      'nav.downloads': '下载',
      'nav.library': '资料库',
      'nav.tools': '工具',
      'nav.settings': '设置',
      'nav.about': '关于',
      'nav.section.main': '主菜单',
      'nav.section.app': '应用',
      'nav.badge.local': '本地',

      'topbar.search': '搜索',
      'topbar.menu': '菜单',

      'sidebar.storage.title': '本地存储',
      'sidebar.storage.used': '{n} 个文件 · {size}',
      'sidebar.storage.empty': '还没有保存记录',
      'sidebar.storage.badge': '零上传',
      'sidebar.storage.left': '剩余可用',
      'sidebar.footer': 'Meteor · {v}',

      'route.home.title': '首页',
      'route.home.sub': '粘贴链接，拿到文件',
      'route.downloads.title': '下载',
      'route.downloads.sub': '实时队列与速度',
      'route.library.title': '资料库',
      'route.library.sub': '你保存过的一切',
      'route.tools.title': '工具',
      'route.tools.sub': '离线可用的本地工作台',
      'route.settings.title': '设置',
      'route.settings.sub': '让它更像你的工具',
      'route.about.title': '关于',
      'route.about.sub': '单文件、零后端、本地优先',

      'home.hero.kicker': '一个文件，就是整个应用',
      'home.hero.title': '粘贴链接，拿到文件。',
      'home.hero.title.accent': '拿到文件。',
      'home.hero.sub': '直链、视频页、图片、压缩包——拖进来就能存。不上传、不注册、不依赖服务器。',
      'home.omnibox.placeholder': '粘贴链接、直链，或拖入文件…',
      'home.omnibox.action': '解析',
      'home.omnibox.paste': '从剪贴板粘贴',
      'home.omnibox.clear': '清空',
      'home.omnibox.hint': '支持直链文件与 YouTube / Vimeo / X 等页面解析',
      'home.sample.title': '试试这些',
      'home.sample.video': '示例视频',
      'home.sample.image': '示例图片',
      'home.sample.css': '示例文本',
      'home.sample.youtube': 'YouTube 页面',
      'home.trust.offline': '离线可用',
      'home.trust.nobackend': '零后端',
      'home.trust.privacy': '数据不出本机',
      'home.trust.single': '单文件应用',
      'home.recent.title': '最近解析',
      'home.recent.empty': '还没有记录，先解析一个链接吧。',
      'home.recent.viewAll': '查看下载',
      'home.features.title': '这一个小文件能做什么',
      'home.features.direct.title': '直连下载',
      'home.features.direct.desc': '带进度、速度、剩余时间与断点续传，支持队列与重试。',
      'home.features.meta.title': '链接预览',
      'home.features.meta.desc': '自动识别平台，抓取标题、作者与封面，再决定要不要下。',
      'home.features.tools.title': '本地工具集',
      'home.features.tools.desc': '哈希、编码、密码、图片、字幕、颜色——全部离线运行。',
      'home.features.player.title': '内置播放器',
      'home.features.player.desc': '拖入本地视频或音频即可播放，支持字幕与倍速。',
      'home.footer.terms': '仅下载你有权保存的内容。不绕过 DRM、不破解付费墙。',

      'preview.analyzing': '正在解析…',
      'preview.ready': '解析完成',
      'preview.kind.direct': '直连文件',
      'preview.kind.media': '媒体页面',
      'preview.kind.torrent': '种子 / 磁力',
      'preview.kind.unknown': '未知链接',
      'preview.kind.audio': '音频',
      'preview.kind.video': '视频',
      'preview.kind.image': '图片',
      'preview.kind.pdf': 'PDF',
      'preview.kind.archive': '压缩包',
      'preview.kind.file': '文件',
      'preview.meta.size': '大小',
      'preview.meta.type': '类型',
      'preview.meta.name': '文件名',
      'preview.meta.platform': '平台',
      'preview.action.download': '开始下载',
      'preview.action.open': '打开原页',
      'preview.action.copy': '复制直链',
      'preview.action.command': '复制 yt-dlp 命令',
      'preview.action.play': '预览播放',
      'preview.note.direct': '浏览器直连下载，文件不经过任何服务器。',
      'preview.note.media': '浏览器端受跨域限制，无法直接解析该平台的视频流。可用原版 OmniGet / yt-dlp 完成下载，本工具继续负责其余本地工作。',
      'preview.note.torrent': '浏览器无法运行 BitTorrent 客户端。请使用原版 OmniGet 处理磁力链与种子。',
      'preview.note.cors': '该地址未开放跨域访问（CORS），浏览器无法读取内容。可复制直链到浏览器，或用原版 OmniGet 下载。',
      'preview.note.large': '文件较大：手机浏览器会先读入内存再保存。桌面 Chrome 可选择保存位置并流式写盘。',
      'preview.error': '解析失败',
      'preview.error.cors': '跨域受限',
      'preview.error.network': '网络异常',
      'preview.error.unsupported': '浏览器无法直连',
      'preview.retry': '重新解析',
      'preview.unknown.title': '未命名文件',
      'preview.unknown.author': '未知来源',
      'preview.badge.estimated': '预估',

      'download.status.queued': '排队中',
      'download.status.active': '下载中',
      'download.status.paused': '已暂停',
      'download.status.done': '已完成',
      'download.status.error': '失败',
      'download.status.canceled': '已取消',
      'download.action.pause': '暂停',
      'download.action.resume': '继续',
      'download.action.cancel': '取消',
      'download.action.retry': '重试',
      'download.action.remove': '移除',
      'download.action.copyLink': '复制直链',
      'download.action.play': '播放',
      'download.action.folder': '保存',
      'download.waiting': '等待中',
      'download.eta': '剩余 {t}',
      'download.speed': '{s}/s',
      'download.of': '{received} / {total}',
      'download.doneAt': '完成于 {t}',
      'download.saved': '已保存',
      'download.memoryRisk': '大文件将先读入内存',
      'download.pendingSize': '大小未知',

      'downloads.title': '下载队列',
      'downloads.sub': '{active} 个进行中 · {done} 个已完成',
      'downloads.filter.all': '全部',
      'downloads.filter.active': '进行中',
      'downloads.filter.queued': '排队',
      'downloads.filter.done': '已完成',
      'downloads.filter.failed': '失败',
      'downloads.empty.title': '队列是空的',
      'downloads.empty.sub': '去首页粘贴一个链接，文件会出现在这里。',
      'downloads.empty.cta': '去解析链接',
      'downloads.clear': '清理已完成',
      'downloads.clearConfirm': '移除所有已完成与已取消的记录？文件本身不受影响。',
      'downloads.speedLimit': '限速',
      'downloads.speedLimit.off': '不限速',
      'downloads.activeCount': '{n} 个任务',

      'library.title': '资料库',
      'library.sub': '共 {n} 个文件 · {size}',
      'library.empty.title': '资料库还是空的',
      'library.empty.sub': '每次下载完成后会自动收录在这里。',
      'library.empty.cta': '去下载',
      'library.search': '搜索文件名或来源',
      'library.filter.all': '全部',
      'library.filter.video': '视频',
      'library.filter.audio': '音频',
      'library.filter.image': '图片',
      'library.filter.file': '文件',
      'library.action.play': '播放',
      'library.action.copy': '复制直链',
      'library.action.remove': '从资料库移除',
      'library.clear': '清空资料库',
      'library.clearConfirm': '清空资料库记录？已下载到磁盘的文件不会被删除。',
      'library.view.grid': '网格',
      'library.view.list': '列表',

      'tools.title': '工具',
      'tools.sub': '{n} 个离线工具，打开即用',
      'tools.search': '搜索工具…',
      'tools.all': '全部',
      'tools.count': '{n} 个工具',
      'tools.open': '打开',
      'tools.status.ready': '可用',
      'tools.status.beta': 'Beta',
      'tools.empty': '没有匹配的工具',
      'tools.modal.sub': '完全在本地运行 · 不联网',

      'settings.appearance': '外观',
      'settings.theme': '主题',
      'settings.theme.dark': '深色',
      'settings.theme.light': '浅色',
      'settings.theme.auto': '跟随系统',
      'settings.accent': '强调色',
      'settings.lang': '语言',
      'settings.lang.zh': '简体中文',
      'settings.lang.en': 'English',
      'settings.reduceMotion': '减少动画',
      'settings.compact': '紧凑布局',
      'settings.downloads': '下载',
      'settings.concurrency': '并发下载数',
      'settings.concurrency.hint': '同时进行的下载任务上限',
      'settings.speedLimit': '速度限制',
      'settings.speedLimit.off': '不限速',
      'settings.speedLimit.hint': '单位 MB/s，0 表示不限速',
      'settings.data': '数据',
      'settings.data.storage': '本地记录',
      'settings.data.storage.val': '{n} 个文件 · {size}',
      'settings.data.note': '所有数据只保存在当前浏览器的 localStorage，不上传、不同步。',
      'settings.data.export': '导出数据',
      'settings.data.import': '导入数据',
      'settings.data.clear': '清空全部数据',
      'settings.data.clearConfirm': '将清空设置、资料库与历史记录。已下载到磁盘的文件不受影响。',
      'settings.reset': '恢复默认设置',
      'settings.about': '关于',
      'settings.about.version': '版本',
      'settings.about.version.val': '{v} · 单文件',
      'settings.about.license': '界面灵感来自 OmniGet（GPL-3.0）',
      'settings.about.open': '打开关于页',

      'about.intro.title': '关于这个单文件版',
      'about.intro.body': 'Meteor 把 OmniGet 的体验压缩进一个 HTML 文件：没有安装包、没有服务器、没有账号。打开即用，关掉即走，所有数据留在你的设备上。',
      'about.limit.title': '能力边界（说实话）',
      'about.limit.body': '浏览器沙盒无法运行 yt-dlp、FFmpeg 与 BitTorrent 客户端，因此 YouTube 等平台的视频流、磁力链和需要登录的站点无法在这里直接下载。这类链接会给出清晰的提示与 yt-dlp 命令；直连文件、本地工具、播放器、资料库则完全可用。',
      'about.ethic.title': '使用原则',
      'about.ethic.body': '只保存你有权保存的内容；不绕过 DRM、不破解付费墙、不分享账号凭据。你的行为需要遵守内容平台的服务条款与当地法律。',
      'about.tech.title': '技术',
      'about.tech.body': '原生 HTML/CSS/JS，零依赖；单文件约 {size}，可离线打开。数据存储使用 localStorage，下载使用 Fetch Streams + File System Access API（不可用时自动降级）。',
      'about.keys.title': '快捷键',
      'about.keys.palette': '打开命令面板',
      'about.keys.nav': '在页面间切换',
      'about.keys.close': '关闭弹层',
      'about.footer': '源自 OpenSelena/omniget 的界面与理念 · GPL-3.0',

      'common.close': '关闭',
      'common.confirm': '确认',
      'common.cancel': '取消',
      'common.delete': '删除',
      'common.copy': '复制',
      'common.copied': '已复制',
      'common.retry': '重试',
      'common.loading': '加载中…',
      'common.search': '搜索',
      'common.none': '无',
      'common.unknown': '未知',

      'toast.copied': '已复制到剪贴板',
      'toast.copyFail': '复制失败，请手动选择文本',
      'toast.downloadStarted': '已加入下载队列',
      'toast.downloadDone': '下载完成',
      'toast.downloadFailed': '下载失败',
      'toast.saved': '已保存',
      'toast.cleared': '已清空',
      'toast.exported': '数据已导出',
      'toast.imported': '数据已导入',
      'toast.importFail': '导入失败：文件格式不正确',
      'toast.lang': '语言已切换',
      'toast.theme': '主题已切换',
      'toast.noClipboard': '无法读取剪贴板，请手动粘贴',
      'toast.noFile': '没有选择文件',
      'toast.localSaved': '已记录到资料库',

      'command.title': '命令面板',
      'command.placeholder': '搜索页面、工具或操作…',
      'command.nav': '导航',
      'command.actions': '操作',
      'command.tools': '工具',
      'command.theme': '切换主题',
      'command.lang': '切换语言',
      'command.export': '导出数据',
      'command.shortcut': '快捷打开',
      'command.empty': '没有匹配项',
      'command.hint': '↑↓ 选择 · Enter 执行 · Esc 关闭'
    },
    en: {
      'app.name': 'Meteor',
      'app.tagline': 'Meteor · Single file · No backend',
      'app.version': 'v{v}',

      'nav.home': 'Home',
      'nav.downloads': 'Downloads',
      'nav.library': 'Library',
      'nav.tools': 'Tools',
      'nav.settings': 'Settings',
      'nav.about': 'About',
      'nav.section.main': 'Main',
      'nav.section.app': 'App',
      'nav.badge.local': 'Local',

      'topbar.search': 'Search',
      'topbar.menu': 'Menu',

      'sidebar.storage.title': 'Local storage',
      'sidebar.storage.used': '{n} files · {size}',
      'sidebar.storage.empty': 'Nothing saved yet',
      'sidebar.storage.badge': 'Zero upload',
      'sidebar.storage.left': 'Free',
      'sidebar.footer': 'Meteor · {v}',

      'route.home.title': 'Home',
      'route.home.sub': 'Paste a link, get the file',
      'route.downloads.title': 'Downloads',
      'route.downloads.sub': 'Live queue and speed',
      'route.library.title': 'Library',
      'route.library.sub': 'Everything you saved',
      'route.tools.title': 'Tools',
      'route.tools.sub': 'An offline workbench',
      'route.settings.title': 'Settings',
      'route.settings.sub': 'Make it yours',
      'route.about.title': 'About',
      'route.about.sub': 'Single file, no backend, local first',

      'home.hero.kicker': 'One file is the whole app',
      'home.hero.title': 'Paste a link, get the file.',
      'home.hero.title.accent': 'get the file.',
      'home.hero.sub': 'Direct files, videos, images, archives — drop it and it is saved. No upload, no sign-up, no server.',
      'home.omnibox.placeholder': 'Paste a link, direct URL, or drop a file…',
      'home.omnibox.action': 'Analyze',
      'home.omnibox.paste': 'Paste from clipboard',
      'home.omnibox.clear': 'Clear',
      'home.omnibox.hint': 'Direct files and YouTube / Vimeo / X pages supported',
      'home.sample.title': 'Try one',
      'home.sample.video': 'Sample video',
      'home.sample.image': 'Sample image',
      'home.sample.css': 'Sample text',
      'home.sample.youtube': 'YouTube page',
      'home.trust.offline': 'Works offline',
      'home.trust.nobackend': 'No backend',
      'home.trust.privacy': 'Data stays here',
      'home.trust.single': 'Single file',
      'home.recent.title': 'Recent',
      'home.recent.empty': 'No history yet — analyze a link first.',
      'home.recent.viewAll': 'Open downloads',
      'home.features.title': 'What one file can do',
      'home.features.direct.title': 'Direct downloads',
      'home.features.direct.desc': 'Progress, speed, ETA, resume, queue and retry.',
      'home.features.meta.title': 'Link preview',
      'home.features.meta.desc': 'Detects the platform and fetches title, author and cover.',
      'home.features.tools.title': 'Local toolkit',
      'home.features.tools.desc': 'Hashes, encodings, ciphers, images, subtitles, colors — offline.',
      'home.features.player.title': 'Built-in player',
      'home.features.player.desc': 'Drop a local video or audio file to play it with subtitles.',
      'home.footer.terms': 'Only download what you have the right to keep. No DRM bypass, no paywall breaking.',

      'preview.analyzing': 'Analyzing…',
      'preview.ready': 'Ready',
      'preview.kind.direct': 'Direct file',
      'preview.kind.media': 'Media page',
      'preview.kind.torrent': 'Torrent / magnet',
      'preview.kind.unknown': 'Unknown link',
      'preview.kind.audio': 'Audio',
      'preview.kind.video': 'Video',
      'preview.kind.image': 'Image',
      'preview.kind.pdf': 'PDF',
      'preview.kind.archive': 'Archive',
      'preview.kind.file': 'File',
      'preview.meta.size': 'Size',
      'preview.meta.type': 'Type',
      'preview.meta.name': 'Filename',
      'preview.meta.platform': 'Platform',
      'preview.action.download': 'Download',
      'preview.action.open': 'Open page',
      'preview.action.copy': 'Copy direct link',
      'preview.action.command': 'Copy yt-dlp command',
      'preview.action.play': 'Preview',
      'preview.note.direct': 'Browser-native download. The file never touches a server.',
      'preview.note.media': 'Cross-origin limits stop the browser from extracting this platform stream. Use the original OmniGet / yt-dlp for that; this tool handles everything else locally.',
      'preview.note.torrent': 'Browsers cannot run a BitTorrent client. Use the original OmniGet for magnets and torrents.',
      'preview.note.cors': 'This host does not allow cross-origin reads (CORS), so the browser cannot fetch it. Copy the direct link into a browser tab or use the original OmniGet.',
      'preview.note.large': 'Large file: mobile browsers buffer it in memory before saving. Desktop Chrome can stream straight to disk.',
      'preview.error': 'Analysis failed',
      'preview.error.cors': 'Blocked by CORS',
      'preview.error.network': 'Network error',
      'preview.error.unsupported': 'Not browser-downloadable',
      'preview.retry': 'Analyze again',
      'preview.unknown.title': 'Untitled file',
      'preview.unknown.author': 'Unknown source',
      'preview.badge.estimated': 'estimated',

      'download.status.queued': 'Queued',
      'download.status.active': 'Downloading',
      'download.status.paused': 'Paused',
      'download.status.done': 'Done',
      'download.status.error': 'Failed',
      'download.status.canceled': 'Canceled',
      'download.action.pause': 'Pause',
      'download.action.resume': 'Resume',
      'download.action.cancel': 'Cancel',
      'download.action.retry': 'Retry',
      'download.action.remove': 'Remove',
      'download.action.copyLink': 'Copy link',
      'download.action.play': 'Play',
      'download.action.folder': 'Save',
      'download.waiting': 'Waiting',
      'download.eta': 'ETA {t}',
      'download.speed': '{s}/s',
      'download.of': '{received} / {total}',
      'download.doneAt': 'Finished {t}',
      'download.saved': 'Saved',
      'download.memoryRisk': 'Large file buffered in memory',
      'download.pendingSize': 'Size unknown',

      'downloads.title': 'Download queue',
      'downloads.sub': '{active} active · {done} completed',
      'downloads.filter.all': 'All',
      'downloads.filter.active': 'Active',
      'downloads.filter.queued': 'Queued',
      'downloads.filter.done': 'Done',
      'downloads.filter.failed': 'Failed',
      'downloads.empty.title': 'Queue is empty',
      'downloads.empty.sub': 'Paste a link on the home screen and it lands here.',
      'downloads.empty.cta': 'Analyze a link',
      'downloads.clear': 'Clear completed',
      'downloads.clearConfirm': 'Remove all completed and canceled records? Files on disk are untouched.',
      'downloads.speedLimit': 'Speed limit',
      'downloads.speedLimit.off': 'Unlimited',
      'downloads.activeCount': '{n} tasks',

      'library.title': 'Library',
      'library.sub': '{n} files · {size}',
      'library.empty.title': 'Library is empty',
      'library.empty.sub': 'Finished downloads are collected here automatically.',
      'library.empty.cta': 'Download something',
      'library.search': 'Search name or source',
      'library.filter.all': 'All',
      'library.filter.video': 'Video',
      'library.filter.audio': 'Audio',
      'library.filter.image': 'Images',
      'library.filter.file': 'Files',
      'library.action.play': 'Play',
      'library.action.copy': 'Copy link',
      'library.action.remove': 'Remove from library',
      'library.clear': 'Clear library',
      'library.clearConfirm': 'Clear the library records? Files on disk are not deleted.',
      'library.view.grid': 'Grid',
      'library.view.list': 'List',

      'tools.title': 'Tools',
      'tools.sub': '{n} offline tools, ready to use',
      'tools.search': 'Search tools…',
      'tools.all': 'All',
      'tools.count': '{n} tools',
      'tools.open': 'Open',
      'tools.status.ready': 'Ready',
      'tools.status.beta': 'Beta',
      'tools.empty': 'No matching tools',
      'tools.modal.sub': 'Runs entirely on your device · offline',

      'settings.appearance': 'Appearance',
      'settings.theme': 'Theme',
      'settings.theme.dark': 'Dark',
      'settings.theme.light': 'Light',
      'settings.theme.auto': 'System',
      'settings.accent': 'Accent',
      'settings.lang': 'Language',
      'settings.lang.zh': '简体中文',
      'settings.lang.en': 'English',
      'settings.reduceMotion': 'Reduce motion',
      'settings.compact': 'Compact layout',
      'settings.downloads': 'Downloads',
      'settings.concurrency': 'Concurrent downloads',
      'settings.concurrency.hint': 'Maximum tasks downloading at once',
      'settings.speedLimit': 'Speed limit',
      'settings.speedLimit.off': 'Unlimited',
      'settings.speedLimit.hint': 'MB/s, 0 means unlimited',
      'settings.data': 'Data',
      'settings.data.storage': 'Local records',
      'settings.data.storage.val': '{n} files · {size}',
      'settings.data.note': 'Everything is stored in this browser\'s localStorage. Nothing is uploaded or synced.',
      'settings.data.export': 'Export data',
      'settings.data.import': 'Import data',
      'settings.data.clear': 'Erase all data',
      'settings.data.clearConfirm': 'This clears settings, library and history. Files on disk are untouched.',
      'settings.reset': 'Restore defaults',
      'settings.about': 'About',
      'settings.about.version': 'Version',
      'settings.about.version.val': '{v} · single file',
      'settings.about.license': 'UI inspired by OmniGet (GPL-3.0)',
      'settings.about.open': 'Open About',

      'about.intro.title': 'About this single-file build',
      'about.intro.body': 'Meteor compresses the OmniGet experience into one HTML file: no installer, no server, no account. Open it, use it, close it — data stays on your device.',
      'about.limit.title': 'Honest limits',
      'about.limit.body': 'A browser sandbox cannot run yt-dlp, FFmpeg or a BitTorrent client, so platform streams (YouTube etc.), magnets and login-walled sites cannot be downloaded here. Those links get a clear note and a yt-dlp command instead; direct files, local tools, the player and the library are fully functional.',
      'about.ethic.title': 'Fair use',
      'about.ethic.body': 'Only save what you have the right to keep. No DRM bypass, no paywall breaking, no credential sharing. Follow the terms of each platform and your local law.',
      'about.tech.title': 'Tech',
      'about.tech.body': 'Vanilla HTML/CSS/JS with zero dependencies; {size} as a single offline file. Data uses localStorage; downloads use Fetch Streams plus File System Access API with automatic fallback.',
      'about.keys.title': 'Shortcuts',
      'about.keys.palette': 'Command palette',
      'about.keys.nav': 'Switch pages',
      'about.keys.close': 'Close overlay',
      'about.footer': 'Inspired by OpenSelena/omniget · GPL-3.0',

      'common.close': 'Close',
      'common.confirm': 'Confirm',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.copy': 'Copy',
      'common.copied': 'Copied',
      'common.retry': 'Retry',
      'common.loading': 'Loading…',
      'common.search': 'Search',
      'common.none': 'None',
      'common.unknown': 'Unknown',

      'toast.copied': 'Copied to clipboard',
      'toast.copyFail': 'Copy failed — select the text manually',
      'toast.downloadStarted': 'Added to the queue',
      'toast.downloadDone': 'Download complete',
      'toast.downloadFailed': 'Download failed',
      'toast.saved': 'Saved',
      'toast.cleared': 'Cleared',
      'toast.exported': 'Data exported',
      'toast.imported': 'Data imported',
      'toast.importFail': 'Import failed: invalid file',
      'toast.lang': 'Language switched',
      'toast.theme': 'Theme switched',
      'toast.noClipboard': 'Clipboard unavailable — paste manually',
      'toast.noFile': 'No file selected',
      'toast.localSaved': 'Added to library',

      'command.title': 'Command palette',
      'command.placeholder': 'Search pages, tools or actions…',
      'command.nav': 'Navigation',
      'command.actions': 'Actions',
      'command.tools': 'Tools',
      'command.theme': 'Toggle theme',
      'command.lang': 'Switch language',
      'command.export': 'Export data',
      'command.shortcut': 'Quick open',
      'command.empty': 'No matches',
      'command.hint': '↑↓ select · Enter run · Esc close'
    }
  };

  OG.addDict = function (patch) {
    if (!patch || typeof patch !== 'object') return;
    ['zh', 'en'].forEach(function (lang) {
      if (!patch[lang]) return;
      OG.dict[lang] = OG.dict[lang] || {};
      Object.keys(patch[lang]).forEach(function (key) {
        OG.dict[lang][key] = patch[lang][key];
      });
    });
  };

  OG.t = function (key, vars) {
    var table = OG.dict[OG.state.lang] || OG.dict.zh;
    var text = table[key];
    if (text === undefined) text = OG.dict.zh[key];
    if (text === undefined) text = key;
    if (vars && typeof vars === 'object') {
      text = String(text).replace(/\{(\w+)\}/g, function (m, name) {
        var v = vars[name];
        return v === undefined || v === null ? m : String(v);
      });
    }
    return text;
  };

  OG.applyI18n = function (root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      node.textContent = OG.t(key);
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      node.setAttribute('aria-label', OG.t(node.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (node) {
      node.setAttribute('title', OG.t(node.getAttribute('data-i18n-title')));
    });
    document.documentElement.setAttribute('lang', OG.state.lang === 'zh' ? 'zh-CN' : 'en');
  };

  /* ------------------------------------------------------------
   * 3. 图标
   * ---------------------------------------------------------- */
  var ICONS = {
    home: '<path d="M3 10.8 12 3.4l9 7.4V20a1 1 0 0 1-1 1h-5.2v-6.2H9.2V21H4a1 1 0 0 1-1-1z"/>',
    download: '<path d="M12 3.5v11.6m0 0 4.2-4.2M12 15.1l-4.2-4.2"/><path d="M4 16.8V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.2"/>',
    library: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6l2 2h8A2.2 2.2 0 0 1 21 9.2v8.6A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
    tools: '<path d="M14.5 6.2a3.9 3.9 0 0 0-5 5L3 17.7 6.3 21l6.5-6.5a3.9 3.9 0 0 0 5-5l-2.5 2.5-2.3-2.3z"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.3 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1.03z"/>',
    info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m20.2 20.2-4.7-4.7"/>',
    command: '<path d="M9 4.5a2.5 2.5 0 1 0 0 5h6a2.5 2.5 0 1 0 0-5v15a2.5 2.5 0 1 0 0-5H9a2.5 2.5 0 1 0 0 5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"/>',
    moon: '<path d="M21 12.9A9 9 0 1 1 11.1 3a7.1 7.1 0 0 0 9.9 9.9z"/>',
    monitor: '<rect x="3" y="4.2" width="18" height="12.2" rx="2"/><path d="M8.5 20.2h7M12 16.4v3.8"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m4.5 12.3 5 5L19.7 6.8"/>',
    copy: '<rect x="9" y="9" width="11.2" height="11.2" rx="2"/><path d="M15.2 5.8V4.6a1.6 1.6 0 0 0-1.6-1.6H4.6A1.6 1.6 0 0 0 3 4.6v9a1.6 1.6 0 0 0 1.6 1.6h1.2"/>',
    trash: '<path d="M4 7h16M9.2 7V4.4h5.6V7M6.4 7l.9 12.1a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.6 7"/>',
    folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6l2 2h8A2.2 2.2 0 0 1 21 9.2v8.6A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
    link: '<path d="M10.2 13.8a4.8 4.8 0 0 0 6.8 0l2.6-2.6a4.8 4.8 0 0 0-6.8-6.8l-1.4 1.4"/><path d="M13.8 10.2a4.8 4.8 0 0 0-6.8 0l-2.6 2.6a4.8 4.8 0 0 0 6.8 6.8l1.4-1.4"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"/>',
    play: '<path d="M8.2 5.3 19 12 8.2 18.7z"/>',
    pause: '<path d="M9 5.2v13.6M15 5.2v13.6"/>',
    refresh: '<path d="M20.4 11.2A8.4 8.4 0 1 0 18 17.2"/><path d="M20.4 4.6v6.6h-6.6"/>',
    shield: '<path d="M12 3.2 20 6.1v5.3c0 4.8-3.4 8.2-8 9.9-4.6-1.7-8-5.1-8-9.9V6.1z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    sparkle: '<path d="M12 3.2 13.7 8.3 18.8 10l-5.1 1.7L12 16.8l-1.7-5.1L5.2 10l5.1-1.7z"/><path d="M18.6 16.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/>',
    zap: '<path d="M13.2 2.6 4.4 14h6.1l-.9 7.4L18.8 10h-6.2z"/>',
    harddrive: '<rect x="3" y="13" width="18" height="7.2" rx="2"/><path d="M7 16.6h.1M3 13 5.2 5.4h13.6L21 13"/>',
    file: '<path d="M6.2 3.2h7.6l4 4V20a.8.8 0 0 1-.8.8H6.2a.8.8 0 0 1-.8-.8V4a.8.8 0 0 1 .8-.8z"/><path d="M13.6 3.4v4h4"/>',
    image: '<rect x="3" y="4.8" width="18" height="14.4" rx="2"/><circle cx="8.6" cy="9.8" r="1.6"/><path d="m21 16.2-4.8-4.8-3.8 3.8-2-2L3.4 20"/>',
    music: '<path d="M9.2 18V5.4l10.2-2v12.2"/><circle cx="6.4" cy="18" r="2.8"/><circle cx="16.6" cy="15.6" r="2.8"/>',
    video: '<rect x="2.4" y="6" width="13.8" height="12" rx="2"/><path d="m16.2 10.4 5.4-2.8v8.8l-5.4-2.8"/>',
    pdf: '<path d="M6.2 3.2h7.6l4 4V20a.8.8 0 0 1-.8.8H6.2a.8.8 0 0 1-.8-.8V4a.8.8 0 0 1 .8-.8z"/><path d="M13.6 3.4v4h4"/><path d="M7.6 15.6h1.2l.9-2.4.9 2.4h1.2"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.2"/><path d="M4.8 9v10a1 1 0 0 0 1 1h12.4a1 1 0 0 0 1-1V9"/><path d="M10 13.4h4"/>',
    hash: '<path d="M10 3.4 8.2 20.6M16 3.4l-1.8 17.2M4.2 8.4h16M3.4 15.6h16"/>',
    key: '<circle cx="8.4" cy="15.4" r="3.6"/><path d="m11 12.8 8.4-8.2M16.8 5.6l2.4 2.4M14.4 8l1.8 1.8"/>',
    clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2"/>',
    text: '<path d="M4 6h16M4 11.4h10M4 16.8h13"/>',
    palette: '<path d="M12 3.2a8.8 8.8 0 1 0 0 17.6h1.4a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4.2a4.9 4.9 0 0 0 4.9-4.9c0-2.8-4.1-4.7-9.5-4.7z"/><circle cx="8" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="6.8" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r=".9" fill="currentColor" stroke="none"/>',
    json: '<path d="M8.2 4H6.4a2 2 0 0 0-2 2v3.4L2.6 12l1.8 2.6V18a2 2 0 0 0 2 2h1.8M15.8 4h1.8a2 2 0 0 1 2 2v3.4l1.8 2.6-1.8 2.6V18a2 2 0 0 1-2 2h-1.8"/>',
    subtitle: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.6 14.8h4.2M13.2 14.8h4.2M6.6 11h6"/>',
    duplicate: '<rect x="8.2" y="8.2" width="12" height="12" rx="2"/><path d="M15.8 8.2V5.6a1.4 1.4 0 0 0-1.4-1.4H5.6a1.4 1.4 0 0 0-1.4 1.4v8.8a1.4 1.4 0 0 0 1.4 1.4h2.6"/>',
    contrast: '<circle cx="12" cy="12" r="8.8"/><path d="M12 3.2v17.6a8.8 8.8 0 0 0 0-17.6z" fill="currentColor" stroke="none"/>',
    chevronDown: '<path d="m6.4 9.4 5.6 5.6 5.6-5.6"/>',
    chevronRight: '<path d="m9.4 6.4 5.6 5.6-5.6 5.6"/>',
    plus: '<path d="M12 4.6v14.8M4.6 12h14.8"/>',
    arrowDown: '<path d="M12 4.4v15.2m0 0 5.6-5.6M12 19.6l-5.6-5.6"/>',
    arrowUp: '<path d="M12 19.6V4.4m0 0 5.6 5.6M12 4.4 6.4 10"/>',
    filter: '<path d="M3.4 5.2h17.2l-6.8 7.8v5.4l-3.6-1.8v-3.6z"/>',
    grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="1.4"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.4"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.4"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.2" cy="6" r=".9" fill="currentColor" stroke="none"/><circle cx="4.2" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="4.2" cy="18" r=".9" fill="currentColor" stroke="none"/>',
    clouddown: '<path d="M7 18.6a4.4 4.4 0 0 1-.6-8.8 5.6 5.6 0 0 1 10.9-1.2A4.2 4.2 0 0 1 17.6 18.6"/><path d="M12 12v7.4m0 0-2.8-2.8M12 19.4l2.8-2.8"/>',
    alert: '<path d="M12 3.6 21.2 20H2.8z"/><path d="M12 9.6v4.6"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4.6" y="10.6" width="14.8" height="9.4" rx="2"/><path d="M8 10.6V8a4 4 0 0 1 8 0v2.6"/>',
    globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2z"/>',
    more: '<circle cx="5.4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    wifiOff: '<path d="M2.8 9.4A14.6 14.6 0 0 1 12 6.4c2.2 0 4.2.5 6 1.3M6 13a9.4 9.4 0 0 1 4-1.9M18 13a9.4 9.4 0 0 0-1.2-.9"/><path d="M8.8 16.6a5 5 0 0 1 4.6-1M12 20h.1"/><path d="m3 3 18 18"/>',
    logo: '<path d="M12 2.6 21 7.4v9.2L12 21.4 3 16.6V7.4z"/><path d="M12 7v7.4m0 0 3-3M12 14.4l-3-3"/>',
    speed: '<path d="M12 20a8 8 0 1 0-8-8"/><path d="M12 12l4.4-4.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    star: '<path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    eye: '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/>',
    clock2: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.4V12l3 1.8"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2"/>'
  };

  OG.icons = ICONS;
  OG.registerIcon = function (name, inner) { ICONS[name] = inner; };
  OG.icon = function (name, cls) {
    var inner = ICONS[name] || ICONS.file;
    return '<svg class="' + (cls || 'og-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  };

  /* ------------------------------------------------------------
   * 4. 工具函数
   * ---------------------------------------------------------- */
  var utils = {};
  utils.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  };
  utils.clamp = function (n, min, max) { return Math.min(max, Math.max(min, n)); };
  utils.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  utils.fmtBytes = function (n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var d = digits === undefined ? 1 : digits;
    n = Number(n);
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB', 'TB'];
    var i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    var val = n >= 100 ? n.toFixed(0) : n.toFixed(d);
    return val.replace(/\.0$/, '') + ' ' + units[i];
  };
  utils.fmtSpeed = function (bps) {
    if (!bps || bps < 0) return '0 B';
    return utils.fmtBytes(bps, 1);
  };
  utils.fmtEta = function (sec) {
    if (sec === null || sec === undefined || !isFinite(sec) || sec < 0) return '--:--';
    sec = Math.round(sec);
    if (sec < 60) return '00:' + String(sec).padStart(2, '0');
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    var h = Math.floor(m / 60);
    m = m % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  utils.fmtDate = function (ts, withTime) {
    if (!ts) return '—';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    var locale = OG.state.lang === 'zh' ? 'zh-CN' : 'en-US';
    var opts = { month: 'short', day: 'numeric' };
    if (withTime !== false) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    try {
      return d.toLocaleString(locale, opts);
    } catch (e) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  };
  utils.fmtDuration = function (sec) {
    if (!sec || !isFinite(sec)) return '—';
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
  };
  utils.escapeHtml = function (str) {
    return String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  utils.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };
  utils.parseUrl = function (url) {
    try {
      var u = new URL(String(url).trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u;
    } catch (e) { return null; }
  };
  utils.basename = function (url) {
    try {
      var u = new URL(url);
      var name = u.pathname.split('/').filter(Boolean).pop() || '';
      return decodeURIComponent(name);
    } catch (e) {
      var s = String(url || '').split('#')[0].split('?')[0];
      var parts = s.split('/').filter(Boolean);
      return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
    }
  };
  utils.extOf = function (nameOrUrl) {
    if (!nameOrUrl) return '';
    var name = String(nameOrUrl).split('#')[0].split('?')[0];
    var m = name.match(/\.([a-z0-9]{1,8})$/i);
    return m ? m[1].toLowerCase() : '';
  };
  var TYPE_MAP = {
    video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm4v', 'ts', 'm3u8', 'mpd', 'wmv'],
    audio: ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'wma', 'aiff'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic', 'ico', 'tif', 'tiff'],
    pdf: ['pdf'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'iso', 'apk', 'dmg', 'exe', 'msi', 'deb', 'rpm', 'appimage'],
    doc: ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub', 'srt', 'vtt', 'ass']
  };
  utils.guessType = function (ext) {
    ext = String(ext || '').toLowerCase();
    var found = 'file';
    Object.keys(TYPE_MAP).forEach(function (type) {
      if (TYPE_MAP[type].indexOf(ext) >= 0) found = type;
    });
    return found;
  };
  utils.copyText = function (text) {
    var value = String(text === null || text === undefined ? '' : text);
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).then(function () { return true; }).catch(function () { return fallbackCopy(value); });
    }
    return Promise.resolve(fallbackCopy(value));
  };
  function fallbackCopy(value) {
    try {
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-2000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  utils.hasFS = function () {
    return typeof window.showSaveFilePicker === 'function';
  };
  utils.storageEstimate = function () {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (e) {
        return { usage: e.usage || 0, quota: e.quota || 0 };
      }).catch(function () { return { usage: 0, quota: 0 }; });
    }
    return Promise.resolve({ usage: 0, quota: 0 });
  };
  utils.truncate = function (str, n) {
    str = String(str || '');
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  };
  utils.groupBy = function (arr, fn) {
    return arr.reduce(function (acc, item) {
      var key = fn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  };
  OG.utils = utils;

  /* ------------------------------------------------------------
   * 5. 事件总线
   * ---------------------------------------------------------- */
  var listeners = {};
  OG.on = function (event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return function () {
      var arr = listeners[event] || [];
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  };
  OG.emit = function (event, payload) {
    (listeners[event] || []).slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error('[OG] listener error', e); }
    });
  };

  /* ------------------------------------------------------------
   * 6. 数据：资料库 / 历史
   * ---------------------------------------------------------- */
  OG.library = {
    all: function () { return OG.state.library.slice(); },
    add: function (entry) {
      if (!entry || !entry.id) return;
      var list = OG.state.library.filter(function (x) { return x.id !== entry.id; });
      list.unshift(entry);
      OG.state.library = list.slice(0, 500);
      OG.state.stats.files = (OG.state.stats.files || 0) + 1;
      if (entry.size) OG.state.stats.bytes = (OG.state.stats.bytes || 0) + entry.size;
      OG.saveState();
      OG.emit('library:update');
      updateChrome();
    },
    remove: function (id) {
      OG.state.library = OG.state.library.filter(function (x) { return x.id !== id; });
      OG.saveState();
      OG.emit('library:update');
      updateChrome();
    },
    clear: function () {
      OG.state.library = [];
      OG.state.stats.files = 0;
      OG.state.stats.bytes = 0;
      OG.saveState();
      OG.emit('library:update');
      updateChrome();
    },
    bytes: function () {
      return OG.state.library.reduce(function (sum, x) { return sum + (Number(x.size) || 0); }, 0);
    }
  };

  OG.addHistory = function (entry) {
    if (!entry || !entry.url) return;
    var list = OG.state.history.filter(function (x) { return x.url !== entry.url; });
    list.unshift(entry);
    OG.state.history = list.slice(0, 20);
    OG.state.stats.parsed = (OG.state.stats.parsed || 0) + 1;
    OG.saveState();
  };

  /* ------------------------------------------------------------
   * 7. 主题与语言
   * ---------------------------------------------------------- */
  function resolvedMode() {
    if (OG.state.theme === 'auto') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return OG.state.theme;
  }

  OG.applyTheme = function () {
    var html = document.documentElement;
    html.setAttribute('data-theme', resolvedMode());
    html.setAttribute('data-accent', OG.state.accent);
    html.setAttribute('data-compact', OG.state.settings.compact ? 'true' : 'false');
    html.setAttribute('data-motion', OG.state.settings.reduceMotion ? 'reduced' : 'full');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedMode() === 'light' ? '#F7F8FA' : '#0B0F19');
    var btn = document.getElementById('og-theme-btn');
    if (btn) {
      btn.innerHTML = OG.icon(OG.state.theme === 'dark' ? 'moon' : OG.state.theme === 'light' ? 'sun' : 'monitor', 'og-icon');
      btn.setAttribute('aria-label', OG.t('settings.theme'));
      btn.setAttribute('title', OG.t('settings.theme') + ': ' + OG.t('settings.theme.' + OG.state.theme));
    }
    OG.emit('theme:change', OG.state.theme);
  };

  OG.setTheme = function (mode) {
    OG.state.theme = ['dark', 'light', 'auto'].indexOf(mode) >= 0 ? mode : 'dark';
    OG.saveState();
    OG.applyTheme();
  };

  OG.setAccent = function (accent) {
    if (!OG.ACCENTS[accent]) return;
    OG.state.accent = accent;
    OG.saveState();
    OG.applyTheme();
  };

  OG.setLang = function (lang) {
    OG.state.lang = lang === 'en' ? 'en' : 'zh';
    OG.saveState();
    OG.applyI18n();
    renderRoute();
    updateChrome();
    OG.emit('lang:change', OG.state.lang);
  };

  OG.toggleLang = function () {
    OG.setLang(OG.state.lang === 'zh' ? 'en' : 'zh');
    OG.ui.toast(OG.t('toast.lang'));
  };

  /* ------------------------------------------------------------
   * 8. 路由
   * ---------------------------------------------------------- */
  var ROUTES = ['home', 'downloads', 'library', 'tools', 'settings', 'about'];
  OG.views = {};
  OG._cleanup = null;

  OG.registerView = function (name, fn) { OG.views[name] = fn; };

  OG.route = function () {
    var raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(raw) >= 0 ? raw : 'home';
  };

  OG.nav = function (route) {
    if (ROUTES.indexOf(route) < 0) route = 'home';
    if (OG.route() === route && document.getElementById('og-view')) {
      renderRoute();
      return;
    }
    // 用 history.pushState 而不是 location.hash：WebView 里 hash 导航
    // 在部分机型（如华为 WebView）会触发网络导航，导致页面变成错误页。
    try {
      history.pushState({ route: route }, '', '#/' + route);
      renderRoute();
    } catch (e) {
      try {
        location.hash = '#/' + route;
      } catch (e2) {
        renderRoute();
      }
    }
  };

  OG.openTool = function (id) {
    var go = function () {
      if (OG.route() !== 'tools') {
        OG.nav('tools');
        setTimeout(function () { OG.emit('tools:open', { id: id }); }, 80);
      } else {
        OG.emit('tools:open', { id: id });
      }
    };
    go();
  };

  function renderRoute() {
    var route = OG.route();
    var view = document.getElementById('og-view');
    if (!view) return;
    if (typeof OG._cleanup === 'function') {
      try { OG._cleanup(); } catch (e) { console.error(e); }
      OG._cleanup = null;
    }
    view.classList.remove('og-view--enter');
    view.innerHTML = '';
    void view.offsetWidth;
    view.classList.add('og-view--enter');
    var fn = OG.views[route] || OG.views.home;
    if (fn) {
      try { fn(view); } catch (e) {
        console.error('[OG] view error', e);
        view.innerHTML = '<div class="og-empty"><p>' + OG.utils.escapeHtml(String(e && e.message ? e.message : e)) + '</p></div>';
      }
    }
    updateActiveNav(route);
    updateChrome();
    OG.emit('view:change', route);
    window.scrollTo({ top: 0, behavior: 'auto' });
    var main = document.getElementById('og-view');
    if (main) main.focus({ preventScroll: true });
  }
  OG.renderRoute = renderRoute;

  function updateActiveNav(route) {
    document.querySelectorAll('[data-route]').forEach(function (el) {
      var active = el.getAttribute('data-route') === route;
      el.classList.toggle('is-active', active);
      if (active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    document.documentElement.setAttribute('data-route', route);
  }

  function updateChrome() {
    var route = OG.route();
    var titleEl = document.getElementById('og-page-title');
    var subEl = document.getElementById('og-page-sub');
    if (titleEl) titleEl.textContent = OG.t('route.' + route + '.title');
    if (subEl) subEl.textContent = OG.t('route.' + route + '.sub');
    document.title = OG.t('route.' + route + '.title') + ' · ' + OG.t('app.name');

    var libCount = document.getElementById('og-lib-count');
    if (libCount) libCount.textContent = String(OG.state.library.length);

    var storageText = document.getElementById('og-storage-text');
    if (storageText) {
      storageText.textContent = OG.state.library.length
        ? OG.t('sidebar.storage.used', { n: OG.state.library.length, size: OG.utils.fmtBytes(OG.library.bytes()) })
        : OG.t('sidebar.storage.empty');
    }
    var storageBar = document.getElementById('og-storage-bar');
    if (storageBar) {
      var used = OG.library.bytes();
      var pct = OG.utils.clamp(Math.log10(used + 1) / 10 * 100, 3, 100);
      storageBar.style.width = (used ? pct : 3) + '%';
    }
    var badge = document.getElementById('og-download-badge');
    if (badge) {
      var active = (OG.state.downloads || []).filter(function (d) {
        return d.status === 'active' || d.status === 'queued' || d.status === 'paused';
      }).length;
      badge.textContent = active ? String(active) : '';
      badge.classList.toggle('is-hidden', !active);
    }
    var langBtn = document.getElementById('og-lang-btn');
    if (langBtn) {
      langBtn.textContent = OG.state.lang === 'zh' ? 'EN' : '中';
      langBtn.setAttribute('aria-label', OG.state.lang === 'zh' ? 'Switch to English' : '切换到中文');
    }
    OG.applyI18n();
  }
  OG.updateChrome = updateChrome;

  /* ------------------------------------------------------------
   * 9. UI 原语
   * ---------------------------------------------------------- */
  var ui = {};
  var modalStack = [];

  function ensureRoot() {
    var root = document.getElementById('og-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'og-modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  ui.toast = function (message, type) {
    var host = document.getElementById('og-toasts');
    if (!host) return;
    var t = type || 'success';
    var iconName = t === 'success' ? 'check' : t === 'error' ? 'alert' : t === 'warn' ? 'alert' : 'info';
    var node = document.createElement('div');
    node.className = 'og-toast og-toast--' + t;
    node.setAttribute('role', 'status');
    node.innerHTML = '<span class="og-toast__icon">' + OG.icon(iconName) + '</span><span class="og-toast__text"></span>';
    node.querySelector('.og-toast__text').textContent = message;
    host.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('is-in'); });
    setTimeout(function () {
      node.classList.remove('is-in');
      setTimeout(function () { node.remove(); }, 260);
    }, 3400);
  };

  ui.modal = function (opts) {
    opts = opts || {};
    var root = ensureRoot();
    var veil = document.createElement('div');
    veil.className = 'og-modal-veil';
    var panel = document.createElement('div');
    panel.className = 'og-modal' + (opts.wide ? ' og-modal--wide' : '') + (opts.sheet ? ' og-modal--sheet' : '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    var head = document.createElement('div');
    head.className = 'og-modal__head';
    var titles = document.createElement('div');
    var h = document.createElement('h2');
    h.className = 'og-modal__title';
    h.textContent = opts.title || '';
    titles.appendChild(h);
    if (opts.subtitle) {
      var sub = document.createElement('p');
      sub.className = 'og-modal__subtitle';
      sub.textContent = opts.subtitle;
      titles.appendChild(sub);
    }
    head.appendChild(titles);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'og-icon-btn og-modal__close';
    closeBtn.setAttribute('aria-label', OG.t('common.close'));
    closeBtn.innerHTML = OG.icon('close');
    head.appendChild(closeBtn);

    var body = document.createElement('div');
    body.className = 'og-modal__body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    panel.appendChild(head);
    panel.appendChild(body);

    if (opts.actions && opts.actions.length) {
      var foot = document.createElement('div');
      foot.className = 'og-modal__foot';
      opts.actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'og-btn' + (a.primary ? ' og-btn--primary' : '') + (a.danger ? ' og-btn--danger' : '');
        b.textContent = a.label;
        b.addEventListener('click', function () {
          if (typeof a.onClick === 'function') a.onClick(close);
          else close();
        });
        foot.appendChild(b);
      });
      panel.appendChild(foot);
    }

    veil.appendChild(panel);
    root.appendChild(veil);
    document.body.classList.add('og-modal-open');
    requestAnimationFrame(function () { veil.classList.add('is-open'); });

    var prevFocus = document.activeElement;
    var closed = false;

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      veil.classList.remove('is-open');
      document.body.classList.remove('og-modal-open');
      var idx = modalStack.indexOf(close);
      if (idx >= 0) modalStack.splice(idx, 1);
      setTimeout(function () {
        veil.remove();
        if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true });
      }, 200);
      if (typeof opts.onClose === 'function') opts.onClose();
    }

    closeBtn.addEventListener('click', close);
    veil.addEventListener('click', function (e) {
      if (e.target === veil && opts.closeOnBackdrop !== false) close();
    });
    document.addEventListener('keydown', onKey);
    modalStack.push(close);

    setTimeout(function () {
      var focusable = panel.querySelector('input, textarea, button.og-btn--primary, button, [tabindex]');
      if (focusable) focusable.focus({ preventScroll: true });
    }, 30);

    return { el: panel, body: body, close: close };
  };

  ui.sheet = function (opts) {
    opts = opts || {};
    opts.sheet = true;
    return ui.modal(opts);
  };

  ui.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var m = ui.modal({
        title: opts.title || OG.t('common.confirm'),
        body: opts.message ? '<p class="og-confirm-text">' + OG.utils.escapeHtml(opts.message) + '</p>' : '',
        closeOnBackdrop: true,
        actions: [
          {
            label: opts.cancelLabel || OG.t('common.cancel'),
            onClick: function (close) { done = true; resolve(false); close(); }
          },
          {
            label: opts.confirmLabel || OG.t('common.confirm'),
            primary: !opts.danger,
            danger: !!opts.danger,
            onClick: function (close) { done = true; resolve(true); close(); }
          }
        ],
        onClose: function () { if (!done) resolve(false); }
      });
      return m;
    });
  };

  ui.refresh = function () { renderRoute(); };
  ui.setTitle = function (title, sub) {
    var t = document.getElementById('og-page-title');
    var s = document.getElementById('og-page-sub');
    if (t && title) t.textContent = title;
    if (s && sub !== undefined) s.textContent = sub;
  };
  ui.setBadge = function (n) {
    var badge = document.getElementById('og-download-badge');
    if (!badge) return;
    badge.textContent = n ? String(n) : '';
    badge.classList.toggle('is-hidden', !n);
  };
  OG.ui = ui;

  /* ------------------------------------------------------------
   * 10. 命令面板
   * ---------------------------------------------------------- */
  function paletteItems() {
    var items = [];
    ROUTES.forEach(function (r) {
      items.push({
        group: OG.t('command.nav'),
        title: OG.t('route.' + r + '.title'),
        sub: OG.t('route.' + r + '.sub'),
        icon: r,
        run: function () { OG.nav(r); }
      });
    });
    items.push({
      group: OG.t('command.actions'),
      title: OG.t('command.theme'),
      sub: OG.state.theme,
      icon: 'moon',
      run: function () { OG.setTheme(OG.state.theme === 'dark' ? 'light' : 'dark'); OG.ui.toast(OG.t('toast.theme')); }
    });
    items.push({
      group: OG.t('command.actions'),
      title: OG.t('command.lang'),
      sub: OG.state.lang === 'zh' ? 'English' : '简体中文',
      icon: 'globe',
      run: function () { OG.toggleLang(); }
    });
    items.push({
      group: OG.t('command.actions'),
      title: OG.t('command.export'),
      sub: OG.t('settings.data.export'),
      icon: 'download',
      run: function () { OG.exportData(); }
    });
    if (OG.tools && Array.isArray(OG.tools.list)) {
      OG.tools.list.forEach(function (tool) {
        items.push({
          group: OG.t('command.tools'),
          title: OG.toolText ? OG.toolText(tool.title) : (tool.title && (tool.title[OG.state.lang] || tool.title.zh)) || tool.id,
          sub: OG.toolText ? OG.toolText(tool.desc) : (tool.desc && (tool.desc[OG.state.lang] || tool.desc.zh)) || '',
          icon: tool.icon || 'tools',
          run: function () { OG.openTool(tool.id); }
        });
      });
    }
    return items;
  }

  OG.toolText = function (obj) {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    return obj[OG.state.lang] || obj.zh || obj.en || '';
  };

  var paletteEl = null;

  function openPalette() {
    if (paletteEl) { closePalette(); return; }
    var root = ensureRoot();
    var veil = document.createElement('div');
    veil.className = 'og-palette-veil';
    var panel = document.createElement('div');
    panel.className = 'og-palette';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML =
      '<div class="og-palette__search">' + OG.icon('search') +
      '<input id="og-palette-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + OG.t('command.placeholder') + '" aria-label="' + OG.t('command.title') + '">' +
      '<kbd class="og-kbd">Esc</kbd></div>' +
      '<div class="og-palette__list" id="og-palette-list" role="listbox"></div>' +
      '<div class="og-palette__hint">' + OG.t('command.hint') + '</div>';
    veil.appendChild(panel);
    root.appendChild(veil);
    document.body.classList.add('og-modal-open');
    requestAnimationFrame(function () { veil.classList.add('is-open'); });
    paletteEl = veil;

    var input = panel.querySelector('#og-palette-input');
    var list = panel.querySelector('#og-palette-list');
    var items = paletteItems();
    var filtered = items;
    var cursor = 0;

    function close() {
      veil.classList.remove('is-open');
      document.body.classList.remove('og-modal-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { veil.remove(); }, 180);
      paletteEl = null;
    }

    function renderList() {
      var q = input.value.trim().toLowerCase();
      filtered = q ? items.filter(function (it) {
        return (it.title + ' ' + (it.sub || '') + ' ' + it.group).toLowerCase().indexOf(q) >= 0;
      }) : items.slice(0, 14);
      cursor = 0;
      if (!filtered.length) {
        list.innerHTML = '<div class="og-palette__empty">' + OG.t('command.empty') + '</div>';
        return;
      }
      var seenGroup = null;
      list.innerHTML = filtered.map(function (it, i) {
        var groupLabel = it.group !== seenGroup ? '<div class="og-palette__group">' + OG.utils.escapeHtml(it.group) + '</div>' : '';
        seenGroup = it.group;
        return groupLabel + '<button type="button" class="og-palette__item' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '" role="option">' +
          '<span class="og-palette__item-icon">' + OG.icon(it.icon || 'file') + '</span>' +
          '<span class="og-palette__item-main"><span class="og-palette__item-title">' + OG.utils.escapeHtml(it.title) + '</span>' +
          (it.sub ? '<span class="og-palette__item-sub">' + OG.utils.escapeHtml(it.sub) + '</span>' : '') + '</span>' +
          '<span class="og-palette__item-enter">↵</span></button>';
      }).join('');
    }

    function moveCursor(delta) {
      if (!filtered.length) return;
      cursor = (cursor + delta + filtered.length) % filtered.length;
      Array.prototype.forEach.call(list.querySelectorAll('.og-palette__item'), function (node, i) {
        node.classList.toggle('is-active', i === cursor);
        if (i === cursor && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
      });
    }

    function run(idx) {
      var item = filtered[idx];
      if (!item) return;
      close();
      setTimeout(function () { item.run(); }, 30);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
    }

    input.addEventListener('input', renderList);
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.og-palette__item');
      if (btn) run(Number(btn.getAttribute('data-idx')));
    });
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    document.addEventListener('keydown', onKey);
    renderList();
    setTimeout(function () { input.focus(); }, 20);
  }
  OG.openPalette = openPalette;
  function closePalette() { if (paletteEl) { var ev = new KeyboardEvent('keydown', { key: 'Escape' }); document.dispatchEvent(ev); } }
  OG.closePalette = closePalette;

  /* ------------------------------------------------------------
   * 11. 数据导入导出
   * ---------------------------------------------------------- */
  OG.exportData = function () {
    var payload = {
      app: 'omniget-studio',
      version: OG.version,
      exportedAt: Date.now(),
      lang: OG.state.lang,
      theme: OG.state.theme,
      accent: OG.state.accent,
      settings: OG.state.settings,
      library: OG.state.library,
      history: OG.state.history,
      stats: OG.state.stats
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'omniget-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    OG.ui.toast(OG.t('toast.exported'));
  };

  OG.importData = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object') throw new Error('bad');
        if (typeof data.lang === 'string') OG.state.lang = data.lang === 'en' ? 'en' : 'zh';
        if (['dark', 'light', 'auto'].indexOf(data.theme) >= 0) OG.state.theme = data.theme;
        if (OG.ACCENTS[data.accent]) OG.state.accent = data.accent;
        if (data.settings && typeof data.settings === 'object') {
          Object.keys(OG.state.settings).forEach(function (k) {
            if (data.settings[k] !== undefined) OG.state.settings[k] = data.settings[k];
          });
        }
        if (Array.isArray(data.library)) {
          var seen = {};
          OG.state.library = data.library.filter(function (x) { return x && x.id && !seen[x.id] && (seen[x.id] = 1); }).slice(0, 500);
        }
        if (Array.isArray(data.history)) OG.state.history = data.history.slice(0, 20);
        OG.saveState();
        OG.applyTheme();
        OG.applyI18n();
        renderRoute();
        updateChrome();
        OG.ui.toast(OG.t('toast.imported'));
      } catch (e) {
        OG.ui.toast(OG.t('toast.importFail'), 'error');
      }
    };
    reader.readAsText(file);
  };

  OG.clearAllData = function () {
    OG.state.library = [];
    OG.state.history = [];
    OG.state.stats = Object.assign({}, DEFAULTS.stats);
    OG.state.settings = Object.assign({}, DEFAULTS.settings);
    OG.state.lang = DEFAULTS.lang;
    OG.state.theme = DEFAULTS.theme;
    OG.state.accent = DEFAULTS.accent;
    try { localStorage.removeItem(OG.storageKey); } catch (e) { /* ignore */ }
    OG.applyTheme();
    OG.applyI18n();
    renderRoute();
    updateChrome();
    OG.ui.toast(OG.t('toast.cleared'));
  };

  /* ------------------------------------------------------------
   * 12. 启动与壳层事件
   * ---------------------------------------------------------- */
  function bindShell() {
    document.addEventListener('click', function (e) {
      var navEl = e.target.closest('[data-route]');
      if (navEl) {
        e.preventDefault();
        OG.nav(navEl.getAttribute('data-route'));
        closeMobileNav();
        return;
      }
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        var action = actionEl.getAttribute('data-action');
        if (action === 'palette') { e.preventDefault(); openPalette(); }
        else if (action === 'lang') { e.preventDefault(); OG.toggleLang(); }
        else if (action === 'theme') { e.preventDefault(); OG.setTheme(OG.state.theme === 'dark' ? 'light' : OG.state.theme === 'light' ? 'auto' : 'dark'); }
        else if (action === 'menu') { e.preventDefault(); toggleMobileNav(); }
        else if (action === 'home') { e.preventDefault(); OG.nav('home'); }
      }
    });

    var themeBtn = document.getElementById('og-theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var order = { dark: 'light', light: 'auto', auto: 'dark' };
      OG.setTheme(order[OG.state.theme] || 'dark');
      OG.ui.toast(OG.t('settings.theme') + ': ' + OG.t('settings.theme.' + OG.state.theme));
    });

    var langBtn = document.getElementById('og-lang-btn');
    if (langBtn) langBtn.addEventListener('click', function () { OG.toggleLang(); });

    var searchBtn = document.getElementById('og-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', openPalette);

    document.getElementById('og-menu-btn') && document.getElementById('og-menu-btn').addEventListener('click', toggleMobileNav);
    var scrim = document.getElementById('og-nav-scrim');
    if (scrim) scrim.addEventListener('click', closeMobileNav);

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var listener = function () { if (OG.state.theme === 'auto') OG.applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', listener);
      else if (mq.addListener) mq.addListener(listener);
    }
  }

  function toggleMobileNav() {
    var shell = document.getElementById('og-app');
    if (shell) shell.classList.toggle('is-nav-open');
    document.body.classList.toggle('og-nav-open', shell ? shell.classList.contains('is-nav-open') : false);
  }
  function closeMobileNav() {
    var shell = document.getElementById('og-app');
    if (shell) shell.classList.remove('is-nav-open');
    document.body.classList.remove('og-nav-open');
  }

  function bindGlobal() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
      var meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        openPalette();
        return;
      }
      if (meta && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        OG.nav(ROUTES[Number(e.key) - 1]);
      }
    });

    document.addEventListener('paste', function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
      var text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!text) return;
      var url = text.trim();
      if (!/^https?:\/\//i.test(url)) return;
      if (OG.route() !== 'home') OG.nav('home');
      setTimeout(function () {
        OG.emit('omnibox:fill', { url: url });
        OG.ui.toast(OG.t('toast.downloadStarted').replace(OG.t('toast.downloadStarted'), OG.t('preview.ready')));
      }, 60);
    });

    window.addEventListener('hashchange', function () { renderRoute(); });
    window.addEventListener('popstate', function () { renderRoute(); });

    document.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) {
        e.preventDefault();
        document.body.classList.add('og-dragging');
      }
    });
    document.addEventListener('dragleave', function (e) {
      if (!e.relatedTarget) document.body.classList.remove('og-dragging');
    });
    document.addEventListener('drop', function (e) {
      document.body.classList.remove('og-dragging');
    });
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (node) {
      if (node.getAttribute('data-icon-done') === '1') return;
      node.innerHTML = OG.icon(node.getAttribute('data-icon'));
      node.setAttribute('data-icon-done', '1');
    });
    (root || document).querySelectorAll('[data-icon-text]').forEach(function (node) {
      node.textContent = OG.t(node.getAttribute('data-icon-text'));
    });
  }
  OG.hydrateIcons = hydrateIcons;

  function boot() {
    loadState();
    OG.applyI18n();
    OG.applyTheme();
    hydrateIcons(document);
    var versionText = document.getElementById('og-version-text');
    if (versionText) versionText.textContent = 'v' + OG.version;
    bindShell();
    bindGlobal();
    if (!location.hash) {
      try { history.replaceState({ route: 'home' }, '', '#/home'); } catch (e) { location.hash = '#/home'; }
    }
    renderRoute();
    var moduleErrors = window.__OG_MODULE_ERRORS__ || [];
    if (moduleErrors.length && OG.ui) {
      setTimeout(function () {
        OG.ui.toast('部分模块加载失败：' + moduleErrors.map(function (x) { return x.m; }).join('、'), 'error');
      }, 600);
    }
    document.body.classList.add('og-ready');
    var bootEl = document.getElementById('og-boot');
    if (bootEl) {
      bootEl.classList.add('is-done');
      setTimeout(function () { bootEl.remove(); }, 520);
    }
    OG.emit('app:ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
