/* ============================================================
 * OmniGet Studio · 单文件版
 * tools.js — 16 个纯离线工具（自渲染 UI）+ 可单测的纯函数
 *
 * 依赖 core.js：OG.utils / OG.ui / OG.t / OG.addDict / OG.icons / OG.icon
 * 约束：原生 ES2022、无外部依赖、不请求网络、所有处理都在本地完成
 * ============================================================ */
(function () {
  'use strict';

  const OG = window.OG;
  if (!OG) return;

  const T = (key, vars) => (typeof OG.t === 'function' ? OG.t(key, vars) : key);
  const esc = (s) => (OG.utils && typeof OG.utils.escapeHtml === 'function')
    ? OG.utils.escapeHtml(s)
    : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (obj) => (typeof OG.toolText === 'function'
    ? OG.toolText(obj)
    : ((obj && (obj[OG.state.lang] || obj.zh || obj.en)) || ''));

  /* ============================================================
   * 1. i18n（key 统一使用 tools.* 前缀）
   * ========================================================== */
  const DICT = {
    zh: {
      'tools.ui.input': '输入',
      'tools.ui.output': '输出',
      'tools.ui.result': '结果',
      'tools.ui.run': '执行',
      'tools.ui.copy': '复制',
      'tools.ui.download': '下载',
      'tools.ui.clear': '清空',
      'tools.ui.chooseFile': '选择文件',
      'tools.ui.dropHint': '也可以把文件拖到虚线框内',
      'tools.ui.paste': '粘贴',
      'tools.ui.empty': '还没有结果',
      'tools.ui.error': '出错了',
      'tools.ui.processing': '处理中…',
      'tools.ui.detected': '自动识别',
      'tools.ui.plain': '纯文本',
      'tools.ui.optional': '可选',
      'tools.ui.file': '文件',
      'tools.ui.size': '大小',
      'tools.ui.type': '类型',
      'tools.ui.done': '完成',
      'tools.ui.noFile': '请先选择文件',
      'tools.ui.invalid': '输入不合法',
      'tools.ui.bytes': '字节',
      'tools.ui.notImage': '请选择图片文件',
      'tools.ui.loadFailed': '无法读取该文件',
      'tools.ui.tooBig': '文件太大，换个小一点的',
      'tools.ui.readonly': '只读',
      'tools.ui.sample': '示例',
      'tools.ui.stats': '统计',
      'tools.ui.actions': '操作',

      'tools.hash.alg': '算法',
      'tools.hash.text': '文本',
      'tools.hash.textPh': '粘贴文本，计算它的哈希…',
      'tools.hash.file': '文件',
      'tools.hash.compute': '计算哈希',
      'tools.hash.hint': 'MD5 不在 WebCrypto 中，这里提供 SHA 系列与 CRC32；文件不会离开本机。',
      'tools.hash.noInput': '请输入文本或选择一个文件',
      'tools.hash.copied': '哈希已复制',

      'tools.fp.header': '文件头（前 64 字节）',
      'tools.fp.magic': '识别结果',
      'tools.fp.entropy': '字节熵',
      'tools.fp.strings': '可打印字符串',
      'tools.fp.hex': '十六进制',
      'tools.fp.kind': '类型',
      'tools.fp.mime': 'MIME',
      'tools.fp.none': '没有找到可打印字符串',
      'tools.fp.empty': '请选择一个文件',
      'tools.fp.hint': '只读取文件开头 4 KB，不会上传任何内容。',

      'tools.enc.codec': '编码格式',
      'tools.enc.encode': '编码',
      'tools.enc.decode': '解码',
      'tools.enc.detect': '自动识别',
      'tools.enc.ph': '输入要转换的文本…',
      'tools.enc.badData': '输入不是合法的编码数据',
      'tools.enc.autoHint': '自动识别只是启发式判断，可手动指定格式。',
      'tools.enc.textPh': '解码结果会显示在这里…',

      'tools.cipher.type': '密码类型',
      'tools.cipher.caesar': 'Caesar 移位',
      'tools.cipher.rot13': 'ROT13',
      'tools.cipher.atbash': 'Atbash',
      'tools.cipher.vigenere': 'Vigenère',
      'tools.cipher.railfence': 'Rail Fence',
      'tools.cipher.shift': '位移',
      'tools.cipher.key': '密钥',
      'tools.cipher.decrypt': '解密',
      'tools.cipher.brute': 'Caesar 爆破',
      'tools.cipher.encrypt': '加密',
      'tools.cipher.keyNeeded': '该密码需要一个字母密钥',
      'tools.cipher.ph': '输入要加密或解密的文本…',
      'tools.cipher.bruteHint': '26 种位移全部列出，按可读性自行挑选。',

      'tools.freq.ph': '粘贴密文进行频率分析…',
      'tools.freq.letters': '字母频率',
      'tools.freq.entropy': '香农熵',
      'tools.freq.ic': '重合指数',
      'tools.freq.none': '没有找到英文字母',
      'tools.freq.hint': '英语自然文本的重合指数约为 0.066，随机文本约为 0.038。',

      'tools.json.ph': '粘贴 JSON…',
      'tools.json.format': '格式化',
      'tools.json.minify': '压缩',
      'tools.json.validate': '校验',
      'tools.json.valid': 'JSON 合法',
      'tools.json.invalid': 'JSON 不合法',
      'tools.json.line': '行 {n}',
      'tools.json.col': '列 {n}',
      'tools.json.tree': '树状预览',
      'tools.json.indent': '缩进',
      'tools.json.stats': '{keys} 个键 · {arrays} 个数组 · 深度 {depth}',

      'tools.ts.ph': 'Unix 时间戳（秒/毫秒）、ISO 时间或日期字符串…',
      'tools.ts.now': '当前时间',
      'tools.ts.seconds': 'Unix 秒',
      'tools.ts.ms': 'Unix 毫秒',
      'tools.ts.iso': 'ISO 8601',
      'tools.ts.utc': 'UTC',
      'tools.ts.local': '本地时间',
      'tools.ts.relative': '相对时间',
      'tools.ts.invalid': '无法解析这个时间',
      'tools.ts.convert': '转换',

      'tools.stats.ph': '粘贴要统计的文本…',
      'tools.stats.chars': '字符数',
      'tools.stats.charsNoSpace': '不含空白',
      'tools.stats.words': '词数',
      'tools.stats.cjk': '中日韩字符',
      'tools.stats.lines': '行数',
      'tools.stats.paragraphs': '段落',
      'tools.stats.sentences': '句子',
      'tools.stats.bytes': 'UTF-8 字节',
      'tools.stats.reading': '阅读时长',
      'tools.stats.longest': '最长行',
      'tools.stats.uniqueWords': '不重复词',
      'tools.stats.min': '{n} 分钟',

      'tools.tp.ph': '粘贴要处理的文本…',
      'tools.tp.op': '操作',
      'tools.tp.upper': '全大写',
      'tools.tp.lower': '全小写',
      'tools.tp.title': '标题格式',
      'tools.tp.sentence': '句首大写',
      'tools.tp.camel': 'camelCase',
      'tools.tp.snake': 'snake_case',
      'tools.tp.kebab': 'kebab-case',
      'tools.tp.slug': 'URL slug',
      'tools.tp.dedupe': '去除重复行',
      'tools.tp.sortAsc': '按字母升序',
      'tools.tp.sortDesc': '按字母降序',
      'tools.tp.sortLen': '按长度排序',
      'tools.tp.sortNum': '按数字排序',
      'tools.tp.removeEmpty': '删除空行',
      'tools.tp.number': '添加行号',
      'tools.tp.reverse': '反转字符',
      'tools.tp.reverseLines': '反转行序',
      'tools.tp.trim': '去掉行首尾空白',
      'tools.tp.apply': '执行操作',
      'tools.tp.reset': '还原',

      'tools.img.ph': '选择一张图片…',
      'tools.img.maxW': '最大宽度',
      'tools.img.maxH': '最大高度',
      'tools.img.quality': '质量',
      'tools.img.format': '输出格式',
      'tools.img.auto': '保持原格式',
      'tools.img.original': '原图',
      'tools.img.output': '输出',
      'tools.img.saving': '已节省',
      'tools.img.compress': '压缩并下载',
      'tools.img.source': '源图信息',
      'tools.img.resized': '输出尺寸',
      'tools.img.same': '尺寸未变，仅按质量重新编码',
      'tools.img.bigger': '输出反而更大，建议调低质量或换 WebP',

      'tools.pal.ph': '选择一张图片提取主色…',
      'tools.pal.colors': '主色',
      'tools.pal.count': '颜色数',
      'tools.pal.hint': '点击色块即可复制 HEX。',
      'tools.pal.copy': '已复制 ',

      'tools.color.ph': 'HEX、rgb() 或 hsl()…',
      'tools.color.fg': '前景色',
      'tools.color.bg': '背景色',
      'tools.color.ratio': '对比度',
      'tools.color.aa': 'AA 正文',
      'tools.color.aaa': 'AAA 正文',
      'tools.color.large': '大字号',
      'tools.color.pass': '通过',
      'tools.color.fail': '不通过',
      'tools.color.formats': '格式',
      'tools.color.bad': '颜色格式无法识别',
      'tools.color.preview': '预览',

      'tools.sub.ph': '粘贴 SRT 或 VTT 字幕…',
      'tools.sub.toVtt': 'SRT → VTT',
      'tools.sub.toSrt': 'VTT → SRT',
      'tools.sub.shift': '平移 {n} 毫秒',
      'tools.sub.merge': '合并双语',
      'tools.sub.second': '第二条字幕（SRT）',
      'tools.sub.cues': '字幕条数',
      'tools.sub.duration': '总时长',
      'tools.sub.invalid': '没有解析到合法的字幕条目',
      'tools.sub.downloadSrt': '下载 .srt',
      'tools.sub.downloadVtt': '下载 .vtt',
      'tools.sub.merged': '合并后的双语字幕',
      'tools.sub.none': '没有结果',

      'tools.dup.ph': '选择多个文件，按内容哈希查找重复…',
      'tools.dup.pick': '选择文件',
      'tools.dup.computing': '正在计算 SHA-256…',
      'tools.dup.groups': '重复组',
      'tools.dup.group': '第 {n} 组',
      'tools.dup.wasted': '可省空间',
      'tools.dup.none': '没有发现重复文件',
      'tools.dup.addMore': '继续添加',
      'tools.dup.files': '{n} 个文件',
      'tools.dup.noDup': '没有内容完全相同的文件。',
      'tools.dup.clear': '清空列表',
      'tools.dup.hint': '文件只在本机读取，不上传。',

      'tools.csv.ph': '粘贴 CSV 文本…',
      'tools.csv.delimiter': '分隔符',
      'tools.csv.preview': '表格预览',
      'tools.csv.stats': '列统计',
      'tools.csv.export': '导出 JSON',
      'tools.csv.rows': '行数',
      'tools.csv.cols': '列数',
      'tools.csv.column': '列',
      'tools.csv.empty': '没有解析到内容',
      'tools.csv.unique': '唯一值',
      'tools.csv.mean': '均值',

      'tools.diff.ph1': '原始文本…',
      'tools.diff.ph2': '修改后的文本…',
      'tools.diff.added': '新增',
      'tools.diff.removed': '删除',
      'tools.diff.same': '相同',
      'tools.diff.unified': '复制补丁',
      'tools.diff.identical': '两段文本完全相同',
      'tools.diff.mode': '对比结果'
    },
    en: {
      'tools.ui.input': 'Input',
      'tools.ui.output': 'Output',
      'tools.ui.result': 'Result',
      'tools.ui.run': 'Run',
      'tools.ui.copy': 'Copy',
      'tools.ui.download': 'Download',
      'tools.ui.clear': 'Clear',
      'tools.ui.chooseFile': 'Choose file',
      'tools.ui.dropHint': 'You can also drop a file onto the dashed box',
      'tools.ui.paste': 'Paste',
      'tools.ui.empty': 'No result yet',
      'tools.ui.error': 'Something went wrong',
      'tools.ui.processing': 'Working…',
      'tools.ui.detected': 'Detected',
      'tools.ui.plain': 'Plain text',
      'tools.ui.optional': 'optional',
      'tools.ui.file': 'File',
      'tools.ui.size': 'Size',
      'tools.ui.type': 'Type',
      'tools.ui.done': 'Done',
      'tools.ui.noFile': 'Choose a file first',
      'tools.ui.invalid': 'Invalid input',
      'tools.ui.bytes': 'bytes',
      'tools.ui.notImage': 'Choose an image file',
      'tools.ui.loadFailed': 'Could not read this file',
      'tools.ui.tooBig': 'File is too large, try a smaller one',
      'tools.ui.readonly': 'read-only',
      'tools.ui.sample': 'Sample',
      'tools.ui.stats': 'Stats',
      'tools.ui.actions': 'Actions',

      'tools.hash.alg': 'Algorithm',
      'tools.hash.text': 'Text',
      'tools.hash.textPh': 'Paste text to hash…',
      'tools.hash.file': 'File',
      'tools.hash.compute': 'Compute hashes',
      'tools.hash.hint': 'MD5 is not in WebCrypto, so SHA family plus CRC32 are provided. Files never leave your device.',
      'tools.hash.noInput': 'Enter text or choose a file',
      'tools.hash.copied': 'Hash copied',

      'tools.fp.header': 'Header (first 64 bytes)',
      'tools.fp.magic': 'Detection',
      'tools.fp.entropy': 'Byte entropy',
      'tools.fp.strings': 'Printable strings',
      'tools.fp.hex': 'Hex',
      'tools.fp.kind': 'Type',
      'tools.fp.mime': 'MIME',
      'tools.fp.none': 'No printable strings found',
      'tools.fp.empty': 'Choose a file first',
      'tools.fp.hint': 'Only the first 4 KB is read. Nothing is uploaded.',

      'tools.enc.codec': 'Format',
      'tools.enc.encode': 'Encode',
      'tools.enc.decode': 'Decode',
      'tools.enc.detect': 'Auto-detect',
      'tools.enc.ph': 'Enter text to convert…',
      'tools.enc.badData': 'Input is not valid for this format',
      'tools.enc.autoHint': 'Auto-detect is heuristic; pick a format manually if it guesses wrong.',
      'tools.enc.textPh': 'Decoded text appears here…',

      'tools.cipher.type': 'Cipher',
      'tools.cipher.caesar': 'Caesar shift',
      'tools.cipher.rot13': 'ROT13',
      'tools.cipher.atbash': 'Atbash',
      'tools.cipher.vigenere': 'Vigenère',
      'tools.cipher.railfence': 'Rail Fence',
      'tools.cipher.shift': 'Shift',
      'tools.cipher.key': 'Key',
      'tools.cipher.decrypt': 'Decrypt',
      'tools.cipher.brute': 'Caesar brute force',
      'tools.cipher.encrypt': 'Encrypt',
      'tools.cipher.keyNeeded': 'This cipher needs a letter key',
      'tools.cipher.ph': 'Enter text to encrypt or decrypt…',
      'tools.cipher.bruteHint': 'All 26 shifts are listed; pick the readable one.',

      'tools.freq.ph': 'Paste ciphertext for frequency analysis…',
      'tools.freq.letters': 'Letter frequency',
      'tools.freq.entropy': 'Shannon entropy',
      'tools.freq.ic': 'Index of coincidence',
      'tools.freq.none': 'No Latin letters found',
      'tools.freq.hint': 'Natural English text has an IC near 0.066; random text is around 0.038.',

      'tools.json.ph': 'Paste JSON…',
      'tools.json.format': 'Format',
      'tools.json.minify': 'Minify',
      'tools.json.validate': 'Validate',
      'tools.json.valid': 'Valid JSON',
      'tools.json.invalid': 'Invalid JSON',
      'tools.json.line': 'line {n}',
      'tools.json.col': 'column {n}',
      'tools.json.tree': 'Tree preview',
      'tools.json.indent': 'Indent',
      'tools.json.stats': '{keys} keys · {arrays} arrays · depth {depth}',

      'tools.ts.ph': 'Unix timestamp (s/ms), ISO time or a date string…',
      'tools.ts.now': 'Now',
      'tools.ts.seconds': 'Unix seconds',
      'tools.ts.ms': 'Unix milliseconds',
      'tools.ts.iso': 'ISO 8601',
      'tools.ts.utc': 'UTC',
      'tools.ts.local': 'Local time',
      'tools.ts.relative': 'Relative',
      'tools.ts.invalid': 'Cannot parse this time',
      'tools.ts.convert': 'Convert',

      'tools.stats.ph': 'Paste text to analyse…',
      'tools.stats.chars': 'Characters',
      'tools.stats.charsNoSpace': 'No spaces',
      'tools.stats.words': 'Words',
      'tools.stats.cjk': 'CJK characters',
      'tools.stats.lines': 'Lines',
      'tools.stats.paragraphs': 'Paragraphs',
      'tools.stats.sentences': 'Sentences',
      'tools.stats.bytes': 'UTF-8 bytes',
      'tools.stats.reading': 'Reading time',
      'tools.stats.longest': 'Longest line',
      'tools.stats.uniqueWords': 'Unique words',
      'tools.stats.min': '{n} min',

      'tools.tp.ph': 'Paste text to transform…',
      'tools.tp.op': 'Operation',
      'tools.tp.upper': 'UPPERCASE',
      'tools.tp.lower': 'lowercase',
      'tools.tp.title': 'Title Case',
      'tools.tp.sentence': 'Sentence case',
      'tools.tp.camel': 'camelCase',
      'tools.tp.snake': 'snake_case',
      'tools.tp.kebab': 'kebab-case',
      'tools.tp.slug': 'URL slug',
      'tools.tp.dedupe': 'Remove duplicate lines',
      'tools.tp.sortAsc': 'Sort A → Z',
      'tools.tp.sortDesc': 'Sort Z → A',
      'tools.tp.sortLen': 'Sort by length',
      'tools.tp.sortNum': 'Sort numerically',
      'tools.tp.removeEmpty': 'Remove blank lines',
      'tools.tp.number': 'Number lines',
      'tools.tp.reverse': 'Reverse characters',
      'tools.tp.reverseLines': 'Reverse line order',
      'tools.tp.trim': 'Trim each line',
      'tools.tp.apply': 'Apply',
      'tools.tp.reset': 'Reset',

      'tools.img.ph': 'Choose an image…',
      'tools.img.maxW': 'Max width',
      'tools.img.maxH': 'Max height',
      'tools.img.quality': 'Quality',
      'tools.img.format': 'Output format',
      'tools.img.auto': 'Keep original',
      'tools.img.original': 'Original',
      'tools.img.output': 'Output',
      'tools.img.saving': 'Saved',
      'tools.img.compress': 'Compress & download',
      'tools.img.source': 'Source',
      'tools.img.resized': 'Output size',
      'tools.img.same': 'Size unchanged; re-encoded with the chosen quality',
      'tools.img.bigger': 'Output got bigger — lower quality or pick WebP',

      'tools.pal.ph': 'Choose an image to extract its palette…',
      'tools.pal.colors': 'Palette',
      'tools.pal.count': 'Colors',
      'tools.pal.hint': 'Click a swatch to copy its HEX.',
      'tools.pal.copy': 'Copied ',

      'tools.color.ph': 'HEX, rgb() or hsl()…',
      'tools.color.fg': 'Foreground',
      'tools.color.bg': 'Background',
      'tools.color.ratio': 'Contrast',
      'tools.color.aa': 'AA normal',
      'tools.color.aaa': 'AAA normal',
      'tools.color.large': 'Large text',
      'tools.color.pass': 'Pass',
      'tools.color.fail': 'Fail',
      'tools.color.formats': 'Formats',
      'tools.color.bad': 'Unrecognised color format',
      'tools.color.preview': 'Preview',

      'tools.sub.ph': 'Paste SRT or VTT subtitles…',
      'tools.sub.toVtt': 'SRT → VTT',
      'tools.sub.toSrt': 'VTT → SRT',
      'tools.sub.shift': 'Shift {n} ms',
      'tools.sub.merge': 'Merge bilingual',
      'tools.sub.second': 'Second subtitle (SRT)',
      'tools.sub.cues': 'Cues',
      'tools.sub.duration': 'Duration',
      'tools.sub.invalid': 'No valid cue found',
      'tools.sub.downloadSrt': 'Download .srt',
      'tools.sub.downloadVtt': 'Download .vtt',
      'tools.sub.merged': 'Merged bilingual subtitle',
      'tools.sub.none': 'No result',

      'tools.dup.ph': 'Select multiple files to find duplicates by hash…',
      'tools.dup.pick': 'Select files',
      'tools.dup.computing': 'Computing SHA-256…',
      'tools.dup.groups': 'Duplicate groups',
      'tools.dup.group': 'Group {n}',
      'tools.dup.wasted': 'Reclaimable',
      'tools.dup.none': 'No duplicate files found',
      'tools.dup.addMore': 'Add more',
      'tools.dup.files': '{n} files',
      'tools.dup.noDup': 'No two files have identical content.',
      'tools.dup.clear': 'Clear list',
      'tools.dup.hint': 'Files are read locally and never uploaded.',

      'tools.csv.ph': 'Paste CSV text…',
      'tools.csv.delimiter': 'Delimiter',
      'tools.csv.preview': 'Preview',
      'tools.csv.stats': 'Column stats',
      'tools.csv.export': 'Export JSON',
      'tools.csv.rows': 'Rows',
      'tools.csv.cols': 'Columns',
      'tools.csv.column': 'Column',
      'tools.csv.empty': 'Nothing parsed',
      'tools.csv.unique': 'Unique',
      'tools.csv.mean': 'Mean',

      'tools.diff.ph1': 'Original text…',
      'tools.diff.ph2': 'Modified text…',
      'tools.diff.added': 'Added',
      'tools.diff.removed': 'Removed',
      'tools.diff.same': 'Unchanged',
      'tools.diff.unified': 'Copy patch',
      'tools.diff.identical': 'Both texts are identical',
      'tools.diff.mode': 'Diff'
    }
  };
  if (typeof OG.addDict === 'function') OG.addDict(DICT);

  /* ============================================================
   * 2. 分类与工具清单
   * ========================================================== */
  const CATEGORIES = [
    { id: 'analysis', name: { zh: '分析与安全', en: 'Analysis & Security' }, color: '#38BDF8', icon: 'shield' },
    { id: 'encoding', name: { zh: '编码与密码', en: 'Encoding & Ciphers' }, color: '#8B5CF6', icon: 'key' },
    { id: 'data', name: { zh: '文本与数据', en: 'Text & Data' }, color: '#10B981', icon: 'text' },
    { id: 'image', name: { zh: '图像', en: 'Images' }, color: '#F59E0B', icon: 'image' },
    { id: 'media', name: { zh: '媒体', en: 'Media' }, color: '#F43F5E', icon: 'video' }
  ];

  const TOOLS = [
    {
      id: 'hash', category: 'analysis', icon: 'hash', status: 'ready',
      title: { zh: '文件哈希校验', en: 'File Hash' },
      desc: {
        zh: '拖入文件或粘贴文本，计算 SHA-1 / 256 / 384 / 512 与 CRC32，校验完整性。',
        en: 'Drop a file or paste text to compute SHA-1/256/384/512 and CRC32 checksums.'
      }
    },
    {
      id: 'fingerprint', category: 'analysis', icon: 'eye', status: 'ready',
      title: { zh: '文件指纹识别', en: 'File Fingerprint' },
      desc: {
        zh: '读取文件头字节，识别真实类型，查看十六进制、字节熵与可打印字符串。',
        en: 'Reads the first bytes to identify the real type, with hex, entropy and printable strings.'
      }
    },
    {
      id: 'encode', category: 'encoding', icon: 'globe', status: 'ready',
      title: { zh: '编码转换', en: 'Encoding' },
      desc: {
        zh: 'Base64 / Base32 / Hex / URL / HTML 实体 / 二进制 / 摩斯，双向转换与自动识别。',
        en: 'Two-way Base64, Base32, Hex, URL, HTML entities, binary and Morse with auto-detect.'
      }
    },
    {
      id: 'cipher', category: 'encoding', icon: 'lock', status: 'ready',
      title: { zh: '古典密码', en: 'Classical Ciphers' },
      desc: {
        zh: 'Caesar 爆破、ROT13、Atbash、Vigenère、Rail Fence，附带加密与解密。',
        en: 'Caesar brute force, ROT13, Atbash, Vigenère and Rail Fence with encrypt and decrypt.'
      }
    },
    {
      id: 'freq', category: 'analysis', icon: 'radio', status: 'ready',
      title: { zh: '频率分析', en: 'Frequency Analysis' },
      desc: {
        zh: '字母频率柱状图、香农熵与重合指数，快速判断文本是否被替换加密。',
        en: 'Letter frequency chart, Shannon entropy and index of coincidence for substitution analysis.'
      }
    },
    {
      id: 'json', category: 'data', icon: 'json', status: 'ready',
      title: { zh: 'JSON 工具', en: 'JSON Toolkit' },
      desc: {
        zh: '格式化、压缩、校验、树状预览，错误定位到行列，全程本地。',
        en: 'Format, minify, validate and tree-preview JSON with line/column error locations.'
      }
    },
    {
      id: 'timestamp', category: 'data', icon: 'clock', status: 'ready',
      title: { zh: '时间戳转换', en: 'Timestamp' },
      desc: {
        zh: 'Unix 秒/毫秒、本地时间、UTC、ISO 与相对时间互转，支持一键取当前时间。',
        en: 'Convert Unix seconds/milliseconds, local time, UTC, ISO and relative time.'
      }
    },
    {
      id: 'textstats', category: 'data', icon: 'text', status: 'ready',
      title: { zh: '文本统计', en: 'Text Stats' },
      desc: {
        zh: '字符、中英混排词数、行、段落、句子、阅读时长与 UTF-8 字节数。',
        en: 'Characters, mixed CN/EN words, lines, paragraphs, sentences, reading time and bytes.'
      }
    },
    {
      id: 'textproc', category: 'data', icon: 'list', status: 'ready',
      title: { zh: '文本处理', en: 'Text Tools' },
      desc: {
        zh: '大小写、去重行、排序、去空行、行号、反转、slug —— 一次点按完成。',
        en: 'Case conversion, dedupe, sort, blank-line removal, numbering, reverse and slug.'
      }
    },
    {
      id: 'resize', category: 'image', icon: 'image', status: 'ready',
      title: { zh: '图片压缩缩放', en: 'Image Resize' },
      desc: {
        zh: '本地 canvas 缩放与质量压缩，实时显示体积对比，一键下载。',
        en: 'Scale and compress images locally with live size comparison and one-click download.'
      }
    },
    {
      id: 'palette', category: 'image', icon: 'palette', status: 'ready',
      title: { zh: '图片调色板', en: 'Image Palette' },
      desc: {
        zh: '从图片提取主色并生成 HEX 色板，点击色块即可复制。',
        en: 'Extract the dominant palette as HEX swatches; click any swatch to copy it.'
      }
    },
    {
      id: 'color', category: 'image', icon: 'contrast', status: 'ready',
      title: { zh: '颜色转换与对比度', en: 'Color & Contrast' },
      desc: {
        zh: 'HEX / RGB / HSL 互转，WCAG AA / AAA 对比度检查与前景背景预览。',
        en: 'HEX / RGB / HSL conversion with WCAG AA / AAA contrast checks and a preview.'
      }
    },
    {
      id: 'subtitle', category: 'media', icon: 'subtitle', status: 'ready',
      title: { zh: '字幕工具', en: 'Subtitles' },
      desc: {
        zh: 'SRT ↔ VTT 互转、整体平移时间轴、双语合并，支持导出文件。',
        en: 'SRT ↔ VTT conversion, timeline shift, bilingual merge and file export.'
      }
    },
    {
      id: 'duplicate', category: 'analysis', icon: 'duplicate', status: 'ready',
      title: { zh: '重复文件查找', en: 'Duplicate Finder' },
      desc: {
        zh: '多选文件，按 SHA-256 分组，展示重复项与可省空间。',
        en: 'Multi-select files, group by SHA-256 and see duplicates plus reclaimable space.'
      }
    },
    {
      id: 'csv', category: 'data', icon: 'grid', status: 'ready',
      title: { zh: 'CSV 预览统计', en: 'CSV Studio' },
      desc: {
        zh: '解析 CSV、表格预览、逐列统计，并一键导出 JSON。',
        en: 'Parse CSV, preview as a table, compute per-column stats and export JSON.'
      }
    },
    {
      id: 'diff', category: 'data', icon: 'filter', status: 'ready',
      title: { zh: '文本对比', en: 'Text Diff' },
      desc: {
        zh: '逐行对比两段文本，标出新增与删除，可复制统一补丁。',
        en: 'Compare two texts line by line, highlight changes and copy a unified patch.'
      }
    }
  ];

  /* ============================================================
   * 3. 纯函数：UTF-8 / Base64 / Base32 / Hex / 二进制
   *    （挂到 OG.tools._impl，node:test 直接断言）
   * ========================================================== */
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder('utf-8');

  function utf8Encode(str) {
    return textEncoder.encode(String(str === null || str === undefined ? '' : str));
  }
  function utf8Decode(bytes) {
    return textDecoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []));
  }
  function toHex(str) {
    return bytesToHex(utf8Encode(str));
  }
  function fromHex(hex) {
    return utf8Decode(hexToBytes(hex));
  }

  const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B64_LOOKUP = (() => {
    const map = Object.create(null);
    for (let i = 0; i < B64_CHARS.length; i++) map[B64_CHARS[i]] = i;
    return map;
  })();

  function bytesToBase64(bytes) {
    const src = bytes || new Uint8Array(0);
    let out = '';
    for (let i = 0; i < src.length; i += 3) {
      const b0 = src[i];
      const b1 = src[i + 1];
      const b2 = src[i + 2];
      out += B64_CHARS[b0 >> 2];
      if (b1 === undefined) {
        out += B64_CHARS[(b0 & 3) << 4] + '==';
        break;
      }
      out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
      if (b2 === undefined) {
        out += B64_CHARS[(b1 & 15) << 2] + '=';
        break;
      }
      out += B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)];
      out += B64_CHARS[b2 & 63];
    }
    return out;
  }

  function base64ToBytes(input) {
    const s = String(input === null || input === undefined ? '' : input)
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/=+$/, '');
    if (!s) return new Uint8Array(0);
    if (s.length % 4 === 1) throw new Error('invalid base64 length');
    const out = [];
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64_LOOKUP[s[i]];
      if (v === undefined) throw new Error('invalid base64 character: ' + s[i]);
      buf = ((buf << 6) | v) & 0xffffff;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buf >> bits) & 0xff);
      }
    }
    return new Uint8Array(out);
  }

  function toBase64(str) {
    return bytesToBase64(utf8Encode(str));
  }
  function fromBase64(str) {
    return utf8Decode(base64ToBytes(str));
  }

  const B32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const B32_LOOKUP = (() => {
    const map = Object.create(null);
    for (let i = 0; i < B32_CHARS.length; i++) map[B32_CHARS[i]] = i;
    return map;
  })();

  function bytesToBase32(bytes) {
    const src = bytes || new Uint8Array(0);
    let bits = 0;
    let value = 0;
    let out = '';
    for (let i = 0; i < src.length; i++) {
      value = (value << 8) | src[i];
      bits += 8;
      while (bits >= 5) {
        out += B32_CHARS[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
      value &= (1 << bits) - 1;
    }
    if (bits > 0) out += B32_CHARS[(value << (5 - bits)) & 31];
    while (out.length % 8 !== 0) out += '=';
    return out;
  }

  function base32ToBytes(input) {
    const s = String(input === null || input === undefined ? '' : input)
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/=+$/, '');
    if (!s) return new Uint8Array(0);
    const out = [];
    let bits = 0;
    let value = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B32_LOOKUP[s[i]];
      if (v === undefined) throw new Error('invalid base32 character: ' + s[i]);
      value = (value << 5) | v;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
      }
      value &= (1 << bits) - 1;
    }
    return new Uint8Array(out);
  }

  function toBase32(str) {
    return bytesToBase32(utf8Encode(str));
  }
  function fromBase32(str) {
    return utf8Decode(base32ToBytes(str));
  }

  function bytesToHex(bytes) {
    const src = bytes || new Uint8Array(0);
    let out = '';
    for (let i = 0; i < src.length; i++) out += src[i].toString(16).padStart(2, '0');
    return out;
  }

  function hexToBytes(input) {
    let s = String(input === null || input === undefined ? '' : input)
      .replace(/[\s,]/g, '')
      .replace(/^0x/i, '');
    if (!s) return new Uint8Array(0);
    if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error('invalid hex string');
    if (s.length % 2 !== 0) throw new Error('hex string must have an even length');
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function bytesToBinary(bytes) {
    const src = bytes || new Uint8Array(0);
    const parts = new Array(src.length);
    for (let i = 0; i < src.length; i++) parts[i] = src[i].toString(2).padStart(8, '0');
    return parts.join(' ');
  }

  function binaryToBytes(input) {
    const s = String(input === null || input === undefined ? '' : input).replace(/\s+/g, '');
    if (!s) return new Uint8Array(0);
    if (!/^[01]+$/.test(s)) throw new Error('invalid binary string');
    if (s.length % 8 !== 0) throw new Error('binary string length must be a multiple of 8');
    const out = new Uint8Array(s.length / 8);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 8, 8), 2);
    return out;
  }

  function toBinary(str) {
    return bytesToBinary(utf8Encode(str));
  }
  function fromBinary(str) {
    return utf8Decode(binaryToBytes(str));
  }

  /* ---------- URL / HTML 实体 ---------- */
  function urlEncode(str) {
    return encodeURIComponent(String(str === null || str === undefined ? '' : str));
  }
  function urlDecode(str) {
    return decodeURIComponent(String(str === null || str === undefined ? '' : str));
  }

  const HTML_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026',
    mdash: '\u2014', ndash: '\u2013', laquo: '\u00ab', raquo: '\u00bb',
    times: '\u00d7', divide: '\u00f7', deg: '\u00b0', plusmn: '\u00b1',
    euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2',
    sect: '\u00a7', para: '\u00b6', middot: '\u00b7', bull: '\u2022'
  };

  function htmlEncode(str) {
    return String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function htmlDecode(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
        if (body.charAt(0) === '#') {
          const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
          const num = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
          if (!isFinite(num) || num < 0 || num > 0x10ffff) return match;
          try { return String.fromCodePoint(num); } catch (e) { return match; }
        }
        const value = HTML_ENTITIES[body.toLowerCase()];
        return value === undefined ? match : value;
      });
  }

  /* ---------- 摩斯电码 ---------- */
  const MORSE_MAP = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
    5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
  };
  const MORSE_REVERSE = (() => {
    const map = Object.create(null);
    Object.keys(MORSE_MAP).forEach((k) => { map[MORSE_MAP[k]] = k; });
    return map;
  })();

  function toMorse(text) {
    const s = String(text === null || text === undefined ? '' : text).toUpperCase();
    const words = s.split(/\s+/).filter(Boolean);
    const encoded = [];
    for (const word of words) {
      const chars = [];
      for (const ch of word) {
        if (MORSE_MAP[ch]) chars.push(MORSE_MAP[ch]);
      }
      if (chars.length) encoded.push(chars.join(' '));
    }
    return encoded.join(' / ');
  }

  function fromMorse(text) {
    const s = String(text === null || text === undefined ? '' : text).trim();
    if (!s) return '';
    return s.split(/\s*\/\s*/).map((word) => word.trim().split(/\s+/).filter(Boolean)
      .map((code) => (MORSE_REVERSE[code] === undefined ? '' : MORSE_REVERSE[code]))
      .join('')).join(' ');
  }

  function detectEncoding(text) {
    const s = String(text === null || text === undefined ? '' : text).trim();
    if (!s) return 'text';
    if (/^[./\-|]+(?:[\s|/]+[./\-]+)*$/.test(s) && /[.-]/.test(s)) return 'morse';
    if (/^[01\s]+$/.test(s) && s.replace(/\s/g, '').length % 8 === 0 && s.replace(/\s/g, '').length > 0) return 'binary';
    if (/^[0-9a-fA-F\s]+$/.test(s) && s.replace(/\s/g, '').length % 2 === 0 && /[a-fA-F]/.test(s)) return 'hex';
    if (/%[0-9a-fA-F]{2}/.test(s) || /\+/.test(s) && /%/.test(s)) return 'url';
    if (/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(s)) return 'html';
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(s.replace(/\s/g, '')) && s.replace(/\s/g, '').length % 4 === 0 && s.replace(/\s/g, '').length >= 8) return 'base64';
    return 'text';
  }

  /* ============================================================
   * 4. 古典密码
   * ========================================================== */
  function caesar(text, shift) {
    const n = ((Number(shift) || 0) % 26 + 26) % 26;
    return String(text === null || text === undefined ? '' : text).replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26) + base);
    });
  }

  function rot13(text) {
    return caesar(text, 13);
  }

  function caesarBrute(text) {
    const out = [];
    for (let i = 0; i < 26; i++) out.push({ shift: i, text: caesar(text, i) });
    return out;
  }

  function atbash(text) {
    return String(text === null || text === undefined ? '' : text).replace(/[a-zA-Z]/g, (ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCharCode(90 - (c - 65));
      return String.fromCharCode(122 - (c - 97));
    });
  }

  function vigenere(text, key, decrypt) {
    const k = String(key === null || key === undefined ? '' : key).toUpperCase().replace(/[^A-Z]/g, '');
    if (!k) throw new Error('key must contain at least one letter');
    const s = String(text === null || text === undefined ? '' : text);
    let j = 0;
    return s.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= 'Z' ? 65 : 97;
      const kc = k.charCodeAt(j % k.length) - 65;
      const shift = decrypt ? (26 - kc) % 26 : kc;
      j++;
      return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
  }

  function railFence(text, rails, decrypt) {
    const n = Math.floor(Number(rails));
    if (!(n >= 2)) throw new Error('rails must be >= 2');
    const s = String(text === null || text === undefined ? '' : text);
    if (!s.length) return '';
    const pattern = new Array(s.length);
    let row = 0;
    let dir = 1;
    for (let i = 0; i < s.length; i++) {
      pattern[i] = row;
      if (n === 1) { dir = 0; } else if (row === 0) { dir = 1; } else if (row === n - 1) { dir = -1; }
      row += dir;
    }
    if (!decrypt) {
      let out = '';
      for (let r = 0; r < n; r++) {
        for (let i = 0; i < s.length; i++) if (pattern[i] === r) out += s[i];
      }
      return out;
    }
    const counts = new Array(n).fill(0);
    for (let i = 0; i < s.length; i++) counts[pattern[i]]++;
    const rows = [];
    let pos = 0;
    for (let r = 0; r < n; r++) {
      rows.push(s.slice(pos, pos + counts[r]));
      pos += counts[r];
    }
    const idx = new Array(n).fill(0);
    let out = '';
    for (let i = 0; i < s.length; i++) out += rows[pattern[i]][idx[pattern[i]]++];
    return out;
  }

  /* ============================================================
   * 5. 频率分析
   * ========================================================== */
  function shannonEntropy(counts, total) {
    const sum = total || Object.keys(counts || {}).reduce((acc, k) => acc + counts[k], 0);
    if (!sum) return 0;
    let h = 0;
    Object.keys(counts || {}).forEach((k) => {
      const p = counts[k] / sum;
      if (p > 0) h -= p * Math.log2(p);
    });
    return h;
  }

  function indexOfCoincidence(counts, total) {
    const n = total || Object.keys(counts || {}).reduce((acc, k) => acc + counts[k], 0);
    if (n < 2) return 0;
    let sum = 0;
    Object.keys(counts || {}).forEach((k) => { sum += counts[k] * (counts[k] - 1); });
    return sum / (n * (n - 1));
  }

  function freq(text) {
    const s = String(text === null || text === undefined ? '' : text);
    const counts = Object.create(null);
    let total = 0;
    for (const ch of s) {
      if (/^[a-zA-Z]$/.test(ch)) {
        const upper = ch.toUpperCase();
        counts[upper] = (counts[upper] || 0) + 1;
        total++;
      }
    }
    const letters = Object.keys(counts)
      .sort((a, b) => (counts[b] - counts[a]) || (a < b ? -1 : 1))
      .map((ch) => ({ ch, count: counts[ch], pct: total ? (counts[ch] / total) * 100 : 0 }));
    return {
      total,
      counts,
      letters,
      entropy: shannonEntropy(counts, total),
      ic: indexOfCoincidence(counts, total)
    };
  }

  /* ============================================================
   * 6. JSON 工具（校验 / 格式化 / 压缩 / 树状预览）
   * ========================================================== */
  function lineColOf(text, pos) {
    if (typeof pos !== 'number' || pos < 0) return { line: 0, col: 0 };
    const before = String(text).slice(0, pos);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  function jsonValidate(text) {
    const src = String(text === null || text === undefined ? '' : text);
    if (!src.trim()) return { ok: false, value: undefined, error: 'empty input', pos: -1, line: 0, col: 0 };
    try {
      const value = JSON.parse(src);
      return { ok: true, value: value, error: null, pos: -1, line: 0, col: 0 };
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      const match = /position (\d+)/i.exec(message);
      const pos = match ? Number(match[1]) : -1;
      const lc = lineColOf(src, pos);
      return { ok: false, value: undefined, error: message, pos: pos, line: lc.line, col: lc.col };
    }
  }

  function jsonFormat(text, indent) {
    const result = jsonValidate(text);
    if (!result.ok) {
      const err = new SyntaxError(result.error);
      err.pos = result.pos;
      err.line = result.line;
      err.col = result.col;
      throw err;
    }
    const spaces = indent === undefined ? 2 : Number(indent);
    return JSON.stringify(result.value, null, isFinite(spaces) ? spaces : 2);
  }

  function jsonMinify(text) {
    const result = jsonValidate(text);
    if (!result.ok) {
      const err = new SyntaxError(result.error);
      err.pos = result.pos;
      err.line = result.line;
      err.col = result.col;
      throw err;
    }
    return JSON.stringify(result.value);
  }

  function jsonStats(value) {
    let keys = 0;
    let arrays = 0;
    let maxDepth = 0;
    const walk = (v, depth) => {
      if (depth > maxDepth) maxDepth = depth;
      if (Array.isArray(v)) {
        arrays++;
        v.forEach((item) => walk(item, depth + 1));
      } else if (v && typeof v === 'object') {
        const names = Object.keys(v);
        keys += names.length;
        names.forEach((name) => walk(v[name], depth + 1));
      }
    };
    walk(value, 1);
    return { keys: keys, arrays: arrays, depth: maxDepth };
  }

  function jsonTreeHtml(value, key, depth) {
    const level = depth || 0;
    const keyHtml = key === undefined ? '' : '<span class="og-mono">' + esc(String(key)) + '</span>: ';
    if (value === null) return '<div>' + keyHtml + '<span class="og-mono">null</span></div>';
    if (Array.isArray(value)) {
      if (!value.length) return '<div>' + keyHtml + '<span class="og-mono">[]</span></div>';
      let html = '<details' + (level < 2 ? ' open' : '') + '><summary>' + keyHtml + '[' + value.length + ']</summary>';
      for (let i = 0; i < value.length; i++) html += jsonTreeHtml(value[i], i, level + 1);
      return html + '</details>';
    }
    if (typeof value === 'object') {
      const names = Object.keys(value);
      if (!names.length) return '<div>' + keyHtml + '<span class="og-mono">{}</span></div>';
      let html = '<details' + (level < 2 ? ' open' : '') + '><summary>' + keyHtml + '{' + names.length + '}</summary>';
      for (const name of names) html += jsonTreeHtml(value[name], name, level + 1);
      return html + '</details>';
    }
    const shown = typeof value === 'string' ? '"' + esc(value) + '"' : esc(String(value));
    return '<div>' + keyHtml + '<span class="og-mono">' + shown + '</span></div>';
  }

  /* ============================================================
   * 7. 时间戳
   * ========================================================== */
  function parseTimestamp(input) {
    if (input === null || input === undefined) return null;
    if (input instanceof Date) {
      const value = input.getTime();
      return isFinite(value) ? value : null;
    }
    if (typeof input === 'number') {
      if (!isFinite(input)) return null;
      return Math.abs(input) < 1e11 ? Math.round(input * 1000) : Math.round(input);
    }
    const s = String(input).trim();
    if (!s) return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const num = Number(s);
      return Math.abs(num) < 1e11 ? Math.round(num * 1000) : Math.round(num);
    }
    const parsed = Date.parse(s);
    return isFinite(parsed) ? parsed : null;
  }

  function formatIso(ms) {
    const date = new Date(Number(ms));
    if (!isFinite(date.getTime())) return '';
    return date.toISOString();
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function timestampInfo(input) {
    const ms = parseTimestamp(input);
    if (ms === null) return null;
    const date = new Date(ms);
    const iso = date.toISOString();
    return {
      ms: ms,
      seconds: Math.floor(ms / 1000),
      iso: iso,
      date: iso.slice(0, 10),
      time: iso.slice(11, 19),
      utc: date.toUTCString(),
      local: date.toString(),
      weekday: date.getUTCDay()
    };
  }

  function relativeTime(ms, now) {
    const base = typeof now === 'number' ? now : Date.now();
    const value = Number(ms);
    if (!isFinite(value)) return { en: '—', zh: '—' };
    const diff = base - value;
    const abs = Math.abs(diff);
    const future = diff < 0;
    let en;
    let zh;
    if (abs < 45000) { en = future ? 'in a moment' : 'just now'; zh = future ? '马上' : '刚刚'; }
    else if (abs < 90000) { en = future ? 'in a minute' : 'a minute ago'; zh = future ? '1 分钟后' : '1 分钟前'; }
    else if (abs < 2700000) {
      const minutes = Math.max(2, Math.round(abs / 60000));
      en = future ? 'in ' + minutes + ' minutes' : minutes + ' minutes ago';
      zh = minutes + ' 分钟' + (future ? '后' : '前');
    } else if (abs < 5400000) { en = future ? 'in an hour' : 'an hour ago'; zh = future ? '1 小时后' : '1 小时前'; }
    else if (abs < 79200000) {
      const hours = Math.round(abs / 3600000);
      en = future ? 'in ' + hours + ' hours' : hours + ' hours ago';
      zh = hours + ' 小时' + (future ? '后' : '前');
    } else if (abs < 129600000) { en = future ? 'tomorrow' : 'yesterday'; zh = future ? '明天' : '昨天'; }
    else {
      const days = Math.round(abs / 86400000);
      en = future ? 'in ' + days + ' days' : days + ' days ago';
      zh = days + ' 天' + (future ? '后' : '前');
    }
    return { en: en, zh: zh };
  }

  function formatDurationMs(ms) {
    let t = Math.max(0, Math.round(Number(ms) || 0));
    const h = Math.floor(t / 3600000);
    t -= h * 3600000;
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    if (h) return h + ':' + pad2(m) + ':' + pad2(s);
    return pad2(m) + ':' + pad2(s);
  }

  /* ============================================================
   * 8. 文本统计
   * ========================================================== */
  const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

  function splitLines(text) {
    const s = String(text === null || text === undefined ? '' : text);
    if (!s) return [];
    return s.split(/\r\n|\r|\n/);
  }

  function countWords(text) {
    const s = String(text === null || text === undefined ? '' : text);
    const latin = (s.match(/[A-Za-z0-9_'\u2019-]+/g) || []).length;
    const cjk = (s.match(CJK_RE) || []).length;
    return latin + cjk;
  }

  function readingMinutes(text, wpm) {
    const words = countWords(text);
    if (!words) return 0;
    const rate = Number(wpm) > 0 ? Number(wpm) : 200;
    return Math.max(1, Math.ceil(words / rate));
  }

  function textStats(text) {
    const s = String(text === null || text === undefined ? '' : text);
    const chars = Array.from(s).length;
    const charsNoSpaces = Array.from(s.replace(/\s+/g, '')).length;
    const lines = s === '' ? 0 : splitLines(s).length;
    const paragraphs = s.trim() === '' ? 0 : s.split(/\n\s*\n/).filter((p) => p.trim() !== '').length;
    const latinWords = (s.match(/[A-Za-z0-9_'\u2019-]+/g) || []).length;
    const cjk = (s.match(CJK_RE) || []).length;
    const words = latinWords + cjk;
    const punctuationGroups = (s.match(/[.!?\u3002\uff01\uff1f]+/g) || []).length;
    const trailing = /[^\s.!?\u3002\uff01\uff1f]$/.test(s);
    const sentences = s.trim() === '' ? 0 : punctuationGroups + (trailing ? 1 : 0);
    const lineList = splitLines(s);
    let longestLine = 0;
    lineList.forEach((line) => { longestLine = Math.max(longestLine, Array.from(line).length); });
    const uniqueLatin = new Set((s.toLowerCase().match(/[a-z0-9_'\u2019-]+/g) || []));
    const uniqueWords = uniqueLatin.size + new Set(s.match(CJK_RE) || []).size;
    return {
      chars: chars,
      charsNoSpaces: charsNoSpaces,
      words: words,
      latinWords: latinWords,
      cjk: cjk,
      lines: lines,
      paragraphs: paragraphs,
      sentences: sentences,
      bytes: utf8Encode(s).length,
      readingMinutes: readingMinutes(s),
      longestLine: longestLine,
      uniqueWords: uniqueWords
    };
  }

  /* ============================================================
   * 9. 文本处理
   * ========================================================== */
  function sortLines(text, mode) {
    const lines = splitLines(text).slice();
    const numeric = (value) => {
      const n = parseFloat(value);
      return isFinite(n) ? n : Infinity;
    };
    if (mode === 'length') lines.sort((a, b) => (b.length - a.length) || (a < b ? -1 : a > b ? 1 : 0));
    else if (mode === 'numeric') lines.sort((a, b) => (numeric(a) - numeric(b)) || (a < b ? -1 : a > b ? 1 : 0));
    else if (mode === 'desc') lines.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    else lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return lines.join('\n');
  }

  function uniqueLines(text) {
    const seen = new Set();
    const out = [];
    splitLines(text).forEach((line) => {
      if (!seen.has(line)) { seen.add(line); out.push(line); }
    });
    return out.join('\n');
  }

  function removeEmptyLines(text) {
    return splitLines(text).filter((line) => line.trim() !== '').join('\n');
  }

  function numberLines(text, start) {
    const lines = splitLines(text);
    const first = Number(start) || 1;
    return lines.map((line, i) => (first + i) + '. ' + line).join('\n');
  }

  function reverseText(text) {
    return Array.from(String(text === null || text === undefined ? '' : text)).reverse().join('');
  }

  function reverseLines(text) {
    return splitLines(text).reverse().join('\n');
  }

  function trimLines(text) {
    return splitLines(text).map((line) => line.trim()).join('\n');
  }

  function toTitleCase(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(/[A-Za-z][A-Za-z'\u2019-]*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  function camelCase(text) {
    const parts = String(text === null || text === undefined ? '' : text).split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (!parts.length) return '';
    return parts[0].toLowerCase() + parts.slice(1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
  }

  function snakeCase(text) {
    return String(text === null || text === undefined ? '' : text)
      .split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part.toLowerCase()).join('_');
  }

  function kebabCase(text) {
    return String(text === null || text === undefined ? '' : text)
      .split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part.toLowerCase()).join('-');
  }

  function slugify(text) {
    return String(text === null || text === undefined ? '' : text)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  function caseConvert(text, mode) {
    const s = String(text === null || text === undefined ? '' : text);
    switch (mode) {
      case 'upper': return s.toUpperCase();
      case 'lower': return s.toLowerCase();
      case 'title': return toTitleCase(s);
      case 'sentence': return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
      case 'camel': return camelCase(s);
      case 'snake': return snakeCase(s);
      case 'kebab': return kebabCase(s);
      case 'slug': return slugify(s);
      default: throw new Error('unknown case mode: ' + mode);
    }
  }

  function transformText(text, mode) {
    switch (mode) {
      case 'upper': return caseConvert(text, 'upper');
      case 'lower': return caseConvert(text, 'lower');
      case 'title': return caseConvert(text, 'title');
      case 'sentence': return caseConvert(text, 'sentence');
      case 'camel': return caseConvert(text, 'camel');
      case 'snake': return caseConvert(text, 'snake');
      case 'kebab': return caseConvert(text, 'kebab');
      case 'slug': return caseConvert(text, 'slug');
      case 'dedupe': return uniqueLines(text);
      case 'sortAsc': return sortLines(text, 'asc');
      case 'sortDesc': return sortLines(text, 'desc');
      case 'sortLen': return sortLines(text, 'length');
      case 'sortNum': return sortLines(text, 'numeric');
      case 'removeEmpty': return removeEmptyLines(text);
      case 'number': return numberLines(text, 1);
      case 'reverse': return reverseText(text);
      case 'reverseLines': return reverseLines(text);
      case 'trim': return trimLines(text);
      default: throw new Error('unknown transform: ' + mode);
    }
  }

  /* ============================================================
   * 10. CSV 解析与统计
   * ========================================================== */
  function detectDelimiter(text) {
    const firstLine = splitLines(String(text === null || text === undefined ? '' : text))[0] || '';
    const candidates = [',', ';', '\t', '|'];
    let best = ',';
    let bestCount = 0;
    candidates.forEach((delimiter) => {
      const count = firstLine.split(delimiter).length - 1;
      if (count > bestCount) { bestCount = count; best = delimiter; }
    });
    return best;
  }

  function csvParse(text, delimiter) {
    const src = String(text === null || text === undefined ? '' : text);
    if (!src) return [];
    const delim = delimiter || detectDelimiter(src);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    while (i < src.length) {
      const ch = src.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (src.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') {
        if (src.charAt(i + 1) === '\n') i++;
        row.push(field); rows.push(row); row = []; field = ''; i++;
        continue;
      }
      if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; i++;
        continue;
      }
      field += ch;
      i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
  }

  function csvToObjects(rows) {
    if (!rows || !rows.length) return [];
    const headers = rows[0].map((h, i) => String(h).trim() || 'column' + (i + 1));
    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((name, i) => { obj[name] = row[i] === undefined ? '' : row[i]; });
      return obj;
    });
  }

  function csvStringify(rows, delimiter) {
    if (!rows || !rows.length) return '';
    const delim = delimiter || ',';
    const quote = (value) => {
      const s = String(value === null || value === undefined ? '' : value);
      if (s.indexOf(delim) >= 0 || s.indexOf('"') >= 0 || /[\r\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    return rows.map((row) => row.map(quote).join(delim)).join('\n');
  }

  function csvStats(rows) {
    if (!rows || rows.length < 1) return [];
    const headers = rows[0].map((h, i) => String(h).trim() || 'column' + (i + 1));
    const data = rows.slice(1);
    return headers.map((name, index) => {
      const values = data.map((row) => (row[index] === undefined ? '' : String(row[index])));
      const nonEmpty = values.filter((v) => v.trim() !== '');
      const numeric = nonEmpty.map((v) => Number(v.replace(/,/g, ''))).filter((n) => isFinite(n));
      let min = null;
      let max = null;
      let mean = null;
      if (numeric.length) {
        min = Math.min.apply(null, numeric);
        max = Math.max.apply(null, numeric);
        mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
      }
      return {
        name: name,
        index: index,
        count: nonEmpty.length,
        empty: values.length - nonEmpty.length,
        unique: new Set(nonEmpty).size,
        numeric: numeric.length,
        min: min,
        max: max,
        mean: mean
      };
    });
  }

  /* ============================================================
   * 11. 文本 Diff
   * ========================================================== */
  function diffLines(a, b) {
    const A = splitLines(a);
    const B = splitLines(b);
    const n = A.length;
    const m = B.length;
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push({ type: 'equal', text: A[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'remove', text: A[i] }); i++; }
      else { ops.push({ type: 'add', text: B[j] }); j++; }
    }
    while (i < n) { ops.push({ type: 'remove', text: A[i] }); i++; }
    while (j < m) { ops.push({ type: 'add', text: B[j] }); j++; }
    return ops;
  }

  function diffStats(ops) {
    const stats = { added: 0, removed: 0, same: 0 };
    (ops || []).forEach((op) => {
      if (op.type === 'add') stats.added++;
      else if (op.type === 'remove') stats.removed++;
      else stats.same++;
    });
    return stats;
  }

  function unifiedDiff(a, b) {
    const ops = diffLines(a, b);
    const stats = diffStats(ops);
    if (!stats.added && !stats.removed) return '';
    const aCount = splitLines(a).length;
    const bCount = splitLines(b).length;
    const body = ops.map((op) => {
      if (op.type === 'add') return '+' + op.text;
      if (op.type === 'remove') return '-' + op.text;
      return ' ' + op.text;
    }).join('\n');
    return '--- a\n+++ b\n@@ -1,' + aCount + ' +1,' + bCount + ' @@\n' + body;
  }

  /* ============================================================
   * 12. 颜色：互转 / 亮度 / WCAG 对比度
   * ========================================================== */
  const NAMED_COLORS = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080',
    orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', cyan: '#00ffff',
    magenta: '#ff00ff', lime: '#00ff00', teal: '#008080', navy: '#000080',
    maroon: '#800000', silver: '#c0c0c0', olive: '#808000', transparent: '#000000'
  };

  function hexToRgb(input) {
    let s = String(input === null || input === undefined ? '' : input).trim().toLowerCase();
    if (NAMED_COLORS[s]) s = NAMED_COLORS[s];
    s = s.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
    else if (/^[0-9a-f]{4}$/.test(s)) s = s.slice(0, 3).split('').map((c) => c + c).join('');
    else if (/^[0-9a-f]{8}$/.test(s)) s = s.slice(0, 6);
    if (!/^[0-9a-f]{6}$/.test(s)) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function clampChannel(value) {
    const n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function rgbToHex(rgb) {
    if (!rgb) return null;
    const part = (v) => clampChannel(v).toString(16).padStart(2, '0');
    return '#' + part(rgb.r) + part(rgb.g) + part(rgb.b);
  }

  function rgbToHsl(rgb) {
    if (!rgb) return null;
    const r = clampChannel(rgb.r) / 255;
    const g = clampChannel(rgb.g) / 255;
    const b = clampChannel(rgb.b) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(hsl) {
    if (!hsl) return null;
    const h = (((Number(hsl.h) || 0) % 360) + 360) % 360 / 360;
    const s = Math.max(0, Math.min(100, Number(hsl.s) || 0)) / 100;
    const l = Math.max(0, Math.min(100, Number(hsl.l) || 0)) / 100;
    if (s === 0) {
      const value = Math.round(l * 255);
      return { r: value, g: value, b: value };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (tInput) => {
      let t = tInput;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(channel(h + 1 / 3) * 255),
      g: Math.round(channel(h) * 255),
      b: Math.round(channel(h - 1 / 3) * 255)
    };
  }

  function colorToHsl(input) {
    const rgb = typeof input === 'string' ? parseColor(input) : input;
    return rgb ? rgbToHsl(rgb) : null;
  }

  function parseColor(input) {
    const s = String(input === null || input === undefined ? '' : input).trim().toLowerCase();
    if (!s) return null;
    if (NAMED_COLORS[s]) return hexToRgb(NAMED_COLORS[s]);
    if (s.charAt(0) === '#') return hexToRgb(s);
    const rgbMatch = /^rgba?\(\s*([0-9.]+%?)\s*[,\s]\s*([0-9.]+%?)\s*[,\s]\s*([0-9.]+%?)/.exec(s);
    if (rgbMatch) {
      const parse = (v) => (v.indexOf('%') >= 0 ? (parseFloat(v) / 100) * 255 : parseFloat(v));
      return { r: clampChannel(parse(rgbMatch[1])), g: clampChannel(parse(rgbMatch[2])), b: clampChannel(parse(rgbMatch[3])) };
    }
    const hslMatch = /^hsla?\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)%\s*[,\s]\s*([0-9.]+)%/.exec(s);
    if (hslMatch) {
      return hslToRgb({ h: parseFloat(hslMatch[1]), s: parseFloat(hslMatch[2]), l: parseFloat(hslMatch[3]) });
    }
    return hexToRgb(s);
  }

  function relativeLuminance(color) {
    const rgb = typeof color === 'string' ? parseColor(color) : color;
    if (!rgb) return null;
    const linear = (value) => {
      const v = clampChannel(value) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
  }

  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    if (l1 === null || l2 === null) return null;
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function wcagLevel(ratio) {
    const value = Number(ratio);
    if (!isFinite(value)) return null;
    return {
      ratio: value,
      aa: value >= 4.5,
      aaa: value >= 7,
      aaLarge: value >= 3,
      aaaLarge: value >= 4.5
    };
  }

  /* ============================================================
   * 13. 文件指纹 / 字节工具 / 图片辅助
   * ========================================================== */
  function matchesSignature(bytes, signature, offset) {
    const start = offset || 0;
    if (!bytes || bytes.length < start + signature.length) return false;
    for (let i = 0; i < signature.length; i++) if (bytes[start + i] !== signature[i]) return false;
    return true;
  }

  function asciiSignature(text) {
    return Array.from(text).map((ch) => ch.charCodeAt(0));
  }

  const MAGIC_LIST = [
    { ext: 'png', mime: 'image/png', label: 'PNG image', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { ext: 'jpg', mime: 'image/jpeg', label: 'JPEG image', sig: [0xff, 0xd8, 0xff] },
    { ext: 'gif', mime: 'image/gif', label: 'GIF image', sig: asciiSignature('GIF8') },
    { ext: 'bmp', mime: 'image/bmp', label: 'BMP image', sig: asciiSignature('BM') },
    { ext: 'ico', mime: 'image/x-icon', label: 'Icon', sig: [0x00, 0x00, 0x01, 0x00] },
    { ext: 'webp', mime: 'image/webp', label: 'WebP image', sig: asciiSignature('RIFF'), offset: 0, extra: { offset: 8, sig: asciiSignature('WEBP') } },
    { ext: 'pdf', mime: 'application/pdf', label: 'PDF document', sig: asciiSignature('%PDF') },
    { ext: 'zip', mime: 'application/zip', label: 'ZIP archive', sig: [0x50, 0x4b, 0x03, 0x04] },
    { ext: 'zip', mime: 'application/zip', label: 'Empty ZIP archive', sig: [0x50, 0x4b, 0x05, 0x06] },
    { ext: 'rar', mime: 'application/vnd.rar', label: 'RAR archive', sig: asciiSignature('Rar!') },
    { ext: '7z', mime: 'application/x-7z-compressed', label: '7-Zip archive', sig: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
    { ext: 'gz', mime: 'application/gzip', label: 'Gzip archive', sig: [0x1f, 0x8b] },
    { ext: 'bz2', mime: 'application/x-bzip2', label: 'Bzip2 archive', sig: asciiSignature('BZh') },
    { ext: 'xz', mime: 'application/x-xz', label: 'XZ archive', sig: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
    { ext: 'mp4', mime: 'video/mp4', label: 'MP4 / ISO BMFF video', sig: asciiSignature('ftyp'), offset: 4 },
    { ext: 'mkv', mime: 'video/x-matroska', label: 'Matroska / WebM', sig: [0x1a, 0x45, 0xdf, 0xa3] },
    { ext: 'avi', mime: 'video/x-msvideo', label: 'AVI video', sig: asciiSignature('RIFF'), offset: 0, extra: { offset: 8, sig: asciiSignature('AVI ') } },
    { ext: 'wav', mime: 'audio/wav', label: 'WAV audio', sig: asciiSignature('RIFF'), offset: 0, extra: { offset: 8, sig: asciiSignature('WAVE') } },
    { ext: 'flac', mime: 'audio/flac', label: 'FLAC audio', sig: asciiSignature('fLaC') },
    { ext: 'ogg', mime: 'audio/ogg', label: 'OGG audio', sig: asciiSignature('OggS') },
    { ext: 'mp3', mime: 'audio/mpeg', label: 'MP3 audio', sig: asciiSignature('ID3') },
    { ext: 'wasm', mime: 'application/wasm', label: 'WebAssembly module', sig: [0x00, 0x61, 0x73, 0x6d] },
    { ext: 'elf', mime: 'application/x-elf', label: 'ELF executable', sig: [0x7f, 0x45, 0x4c, 0x46] },
    { ext: 'exe', mime: 'application/vnd.microsoft.portable-executable', label: 'Windows executable', sig: asciiSignature('MZ') },
    { ext: 'class', mime: 'application/java-vm', label: 'Java class', sig: [0xca, 0xfe, 0xba, 0xbe] },
    { ext: 'sqlite', mime: 'application/vnd.sqlite3', label: 'SQLite database', sig: asciiSignature('SQLite format 3') },
    { ext: 'woff', mime: 'font/woff', label: 'WOFF font', sig: asciiSignature('wOFF') },
    { ext: 'woff2', mime: 'font/woff2', label: 'WOFF2 font', sig: asciiSignature('wOF2') },
    { ext: 'otf', mime: 'font/otf', label: 'OpenType font', sig: asciiSignature('OTTO') },
    { ext: 'ttf', mime: 'font/ttf', label: 'TrueType font', sig: [0x00, 0x01, 0x00, 0x00] },
    { ext: 'psd', mime: 'image/vnd.adobe.photoshop', label: 'Photoshop document', sig: asciiSignature('8BPS') }
  ];

  function isProbablyText(bytes) {
    if (!bytes || !bytes.length) return false;
    let printable = 0;
    const limit = Math.min(bytes.length, 512);
    for (let i = 0; i < limit; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) printable++;
    }
    return printable / limit >= 0.9;
  }

  function sniffFile(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const hex = bytesToHex(data.subarray(0, Math.min(16, data.length)));
    for (const entry of MAGIC_LIST) {
      if (!matchesSignature(data, entry.sig, entry.offset || 0)) continue;
      if (entry.extra && !matchesSignature(data, entry.extra.sig, entry.extra.offset)) continue;
      return { ext: entry.ext, mime: entry.mime, label: entry.label, hex: hex, known: true };
    }
    if (isProbablyText(data)) {
      const head = utf8Decode(data.subarray(0, Math.min(256, data.length))).trim().toLowerCase();
      if (head.indexOf('<!doctype html') === 0 || head.indexOf('<html') === 0) {
        return { ext: 'html', mime: 'text/html', label: 'HTML document', hex: hex, known: true };
      }
      if (head.indexOf('<svg') === 0 || (head.indexOf('<?xml') === 0 && head.indexOf('<svg') >= 0)) {
        return { ext: 'svg', mime: 'image/svg+xml', label: 'SVG image', hex: hex, known: true };
      }
      if (head.charAt(0) === '{' || head.charAt(0) === '[') {
        return { ext: 'json', mime: 'application/json', label: 'JSON text', hex: hex, known: true };
      }
      return { ext: 'txt', mime: 'text/plain', label: 'Plain text', hex: hex, known: true };
    }
    return { ext: 'bin', mime: 'application/octet-stream', label: 'Unknown binary', hex: hex, known: false };
  }

  function entropyOfBytes(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (!data.length) return 0;
    const counts = new Uint32Array(256);
    for (let i = 0; i < data.length; i++) counts[data[i]]++;
    let h = 0;
    for (let i = 0; i < 256; i++) {
      if (!counts[i]) continue;
      const p = counts[i] / data.length;
      h -= p * Math.log2(p);
    }
    return h;
  }

  function printableStrings(bytes, minLength) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const min = Number(minLength) > 0 ? Number(minLength) : 4;
    const out = [];
    let current = '';
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b >= 32 && b <= 126) {
        current += String.fromCharCode(b);
      } else {
        if (current.length >= min) out.push(current);
        current = '';
      }
      if (out.length >= 40) return out;
    }
    if (current.length >= min) out.push(current);
    return out.slice(0, 40);
  }

  function formatHexDump(bytes, maxBytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const limit = Math.min(data.length, Number(maxBytes) > 0 ? Number(maxBytes) : 64);
    const lines = [];
    for (let offset = 0; offset < limit; offset += 16) {
      const chunk = data.subarray(offset, Math.min(offset + 16, limit));
      const hexPart = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
      const asciiPart = Array.from(chunk, (b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
      lines.push(offset.toString(16).padStart(8, '0') + '  ' + hexPart.padEnd(47, ' ') + '  |' + asciiPart + '|');
    }
    return lines.join('\n');
  }

  function calcScaledSize(width, height, maxWidth, maxHeight) {
    const w = Math.floor(Number(width) || 0);
    const h = Math.floor(Number(height) || 0);
    if (!(w > 0) || !(h > 0)) return null;
    const limitW = Number(maxWidth) > 0 ? Number(maxWidth) : Infinity;
    const limitH = Number(maxHeight) > 0 ? Number(maxHeight) : Infinity;
    const scale = Math.min(1, limitW / w, limitH / h);
    return {
      w: Math.max(1, Math.round(w * scale)),
      h: Math.max(1, Math.round(h * scale)),
      scale: scale,
      scaled: scale < 1
    };
  }

  function paletteFromPixels(pixels, maxColors) {
    const data = pixels || null;
    if (!data || data.length < 4) return [];
    const buckets = new Map();
    let total = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n++;
      buckets.set(key, bucket);
      total++;
    }
    if (!total) return [];
    const byHex = new Map();
    buckets.forEach((bucket) => {
      const hex = rgbToHex({ r: Math.round(bucket.r / bucket.n), g: Math.round(bucket.g / bucket.n), b: Math.round(bucket.b / bucket.n) });
      const entry = byHex.get(hex) || { hex: hex, count: 0 };
      entry.count += bucket.n;
      byHex.set(hex, entry);
    });
    const list = Array.from(byHex.values()).map((entry) => ({
      hex: entry.hex,
      count: entry.count,
      pct: (entry.count / total) * 100
    }));
    list.sort((a, b) => (b.count - a.count) || (a.hex < b.hex ? -1 : 1));
    const limit = Number(maxColors) > 0 ? Number(maxColors) : 8;
    return list.slice(0, limit);
  }

  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  /* ============================================================
   * 14. 字幕 SRT / VTT
   * ========================================================== */
  const TIMECODE_RE = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

  function parseTimecode(value) {
    const s = String(value === null || value === undefined ? '' : value).trim();
    const match = TIMECODE_RE.exec(s);
    if (!match) return null;
    const hours = match[1] ? Number(match[1]) : 0;
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = Number(match[4].padEnd(3, '0'));
    if (minutes > 59 || seconds > 59) return null;
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  }

  function formatTimecode(ms, separator) {
    const total = Math.max(0, Math.round(Number(ms) || 0));
    const h = Math.floor(total / 3600000);
    const m = Math.floor(total / 60000) % 60;
    const s = Math.floor(total / 1000) % 60;
    const frac = total % 1000;
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + (separator || ',') + String(frac).padStart(3, '0');
  }

  function parseSrt(srt) {
    const text = String(srt === null || srt === undefined ? '' : srt)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    if (!text.trim()) return [];
    const cues = [];
    text.split(/\n{2,}/).forEach((block) => {
      const lines = block.split('\n').filter((line) => line.trim() !== '');
      if (!lines.length) return;
      const timingIndex = lines.findIndex((line) => line.indexOf('-->') >= 0);
      if (timingIndex < 0) return;
      const parts = lines[timingIndex].split('-->');
      const start = parseTimecode(parts[0]);
      const end = parseTimecode((parts[1] || '').trim().split(/\s+/)[0]);
      if (start === null || end === null) return;
      cues.push({ start: start, end: end, text: lines.slice(timingIndex + 1).join('\n').trim() });
    });
    return cues;
  }

  function serializeSrt(cues) {
    const list = cues || [];
    if (!list.length) return '';
    return list.map((cue, index) => (index + 1) + '\n' +
      formatTimecode(cue.start, ',') + ' --> ' + formatTimecode(cue.end, ',') + '\n' +
      cue.text).join('\n\n') + '\n';
  }

  function srtToVtt(srt) {
    const cues = parseSrt(srt);
    const header = 'WEBVTT\n\n';
    if (!cues.length) return header;
    return header + cues.map((cue) => formatTimecode(cue.start, '.') + ' --> ' +
      formatTimecode(cue.end, '.') + '\n' + cue.text).join('\n\n') + '\n';
  }

  function vttToSrt(vtt) {
    return serializeSrt(parseSrt(vtt));
  }

  function shiftSrt(srt, offsetMs) {
    const offset = Number(offsetMs) || 0;
    const cues = parseSrt(srt).map((cue) => ({
      start: Math.max(0, cue.start + offset),
      end: Math.max(0, cue.end + offset),
      text: cue.text
    }));
    return serializeSrt(cues);
  }

  function mergeBilingual(primary, secondary, separator) {
    const a = parseSrt(primary);
    const b = parseSrt(secondary);
    if (!a.length) return '';
    const sep = separator === undefined ? '\n' : String(separator);
    return serializeSrt(a.map((cue, index) => ({
      start: cue.start,
      end: cue.end,
      text: b[index] && b[index].text ? cue.text + sep + b[index].text : cue.text
    })));
  }

  function srtStats(srt) {
    const cues = parseSrt(srt);
    let duration = 0;
    let chars = 0;
    cues.forEach((cue) => {
      duration = Math.max(duration, cue.end);
      chars += Array.from(cue.text).length;
    });
    return { cues: cues.length, duration: duration, chars: chars };
  }

  /* ============================================================
   * 15. 重复文件分组
   * ========================================================== */
  function groupByHash(files) {
    const list = Array.isArray(files) ? files : [];
    const map = new Map();
    list.forEach((file) => {
      const key = String(file.hash) + ':' + String(file.size);
      const bucket = map.get(key) || [];
      bucket.push(file);
      map.set(key, bucket);
    });
    const groups = [];
    map.forEach((bucket) => {
      if (bucket.length > 1) {
        const sorted = bucket.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
        groups.push({ hash: sorted[0].hash, size: Number(sorted[0].size) || 0, files: sorted });
      }
    });
    groups.sort((a, b) => (b.files.length - a.files.length) || (b.size - a.size));
    return groups;
  }

  function wastedBytes(groups) {
    return (groups || []).reduce((sum, group) => {
      const size = Number(group.size) || 0;
      return sum + size * Math.max(0, group.files.length - 1);
    }, 0);
  }

  /* ============================================================
   * 16. UI 公共层（自渲染，使用 core 的公共 CSS 类与图标）
   * ========================================================== */
  function h(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  }

  function fmtBytes(n) {
    if (OG.utils && typeof OG.utils.fmtBytes === 'function') return OG.utils.fmtBytes(n);
    const value = Number(n) || 0;
    if (value < 1024) return value + ' B';
    return (value / 1024).toFixed(1) + ' KB';
  }

  function fieldHtml(label, controlHtml, hint) {
    return '<div class="og-field"><label class="og-label">' + esc(label) + '</label>' +
      controlHtml + (hint ? '<p class="og-hint">' + esc(hint) + '</p>' : '') + '</div>';
  }

  function textareaHtml(role, placeholder, rows) {
    return '<textarea class="og-textarea og-mono" data-role="' + role + '" rows="' + (rows || 6) +
      '" placeholder="' + esc(placeholder || '') + '" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>';
  }

  function inputHtml(role, value, placeholder, type) {
    return '<input class="og-input" data-role="' + role + '" type="' + (type || 'text') +
      '" value="' + esc(value === undefined ? '' : value) + '" placeholder="' + esc(placeholder || '') +
      '" spellcheck="false" autocomplete="off">';
  }

  function selectHtml(role, options, extraAttrs) {
    return '<select class="og-select" data-role="' + role + '"' + (extraAttrs ? ' ' + extraAttrs : '') + '>' +
      options.map((opt) => '<option value="' + esc(opt.value) + '"' + (opt.selected ? ' selected' : '') + '>' +
        esc(opt.label) + '</option>').join('') + '</select>';
  }

  function btnHtml(label, variant, role) {
    return '<button type="button" class="og-btn' + (variant ? ' og-btn--' + variant : '') +
      '" data-role="' + role + '">' + esc(label) + '</button>';
  }

  function btnRowHtml(buttons) {
    return '<div class="og-row">' + buttons.join('') + '</div>';
  }

  function resultHtml(role) {
    return '<div class="og-result" data-role="' + role + '"></div>';
  }

  function hintHtml(role) {
    return '<p class="og-hint" data-role="' + role + '"></p>';
  }

  function fileInputHtml(role, accept, multiple) {
    return '<input class="og-input" data-role="' + role + '" type="file"' +
      (accept ? ' accept="' + esc(accept) + '"' : '') + (multiple ? ' multiple' : '') + '>';
  }

  function dropZoneHtml(role) {
    return '<div class="og-card og-card--flat" data-role="' + role + '-drop">' +
      '<p class="og-hint">' + esc(T('tools.ui.dropHint')) + '</p></div>';
  }

  function kvHtml(label, value) {
    return '<div class="og-row"><span class="og-hint">' + esc(label) + '</span>' +
      '<span class="og-spacer"></span><span class="og-mono">' + esc(String(value)) + '</span></div>';
  }

  function statsHtml(items) {
    return '<div class="og-grid">' + items.map((item) => (
      '<div class="og-card og-card--flat"><div class="og-hint">' + esc(item[0]) + '</div>' +
      '<div class="og-mono">' + esc(String(item[1])) + '</div></div>'
    )).join('') + '</div>';
  }

  function badgeHtml(label, type) {
    return '<span class="og-badge' + (type ? ' og-badge--' + type : '') + '">' + esc(label) + '</span>';
  }

  const UI = {
    h: h,
    esc: esc,
    fmtBytes: fmtBytes,
    icon: (name) => OG.icon(name),
    toast: function (message, type) {
      if (OG.ui && typeof OG.ui.toast === 'function') OG.ui.toast(message, type || 'success');
    },
    copy: function (text) {
      if (!text) { UI.toast(T('tools.ui.empty'), 'warn'); return Promise.resolve(false); }
      if (OG.utils && typeof OG.utils.copyText === 'function') {
        return Promise.resolve(OG.utils.copyText(text)).then(function (ok) {
          UI.toast(ok ? T('toast.copied') : T('toast.copyFail'), ok ? 'success' : 'error');
          return !!ok;
        }).catch(function () { return false; });
      }
      return Promise.resolve(false);
    },
    downloadBlob: function (name, blob) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        UI.toast(T('toast.saved'), 'success');
      } catch (err) {
        UI.toast(T('tools.ui.error'), 'error');
      }
    },
    downloadText: function (name, text, mime) {
      UI.downloadBlob(name, new Blob([String(text)], { type: mime || 'text/plain;charset=utf-8' }));
    },
    readBuffer: function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error || new Error('read failed')); };
        reader.readAsArrayBuffer(file);
      });
    },
    readText: function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(reader.error || new Error('read failed')); };
        reader.readAsText(file);
      });
    },
    readDataUrl: function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result)); };
        reader.onerror = function () { reject(reader.error || new Error('read failed')); };
        reader.readAsDataURL(file);
      });
    },
    loadImage: function (src) {
      return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('image decode failed')); };
        img.src = src;
      });
    },
    shaHex: async function (algorithm, buffer) {
      if (!(window.crypto && window.crypto.subtle)) throw new Error('WebCrypto unavailable');
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const digest = await window.crypto.subtle.digest(algorithm, bytes);
      return bytesToHex(new Uint8Array(digest));
    },
    crc32Hex: function (bytes) {
      return '0x' + crc32(bytes).toString(16).padStart(8, '0').toUpperCase();
    }
  };

  function toolRoot(container, item) {
    const title = L(item.title);
    const desc = L(item.desc);
    const iconMarkup = item.icon && String(item.icon).trim().indexOf('<svg') === 0
      ? item.icon
      : OG.icon(item.icon || 'tools');
    const wrap = h('<div class="og-tool-body">' +
      '<div class="og-tool-head">' +
        '<div class="og-tool-icon">' + iconMarkup + '</div>' +
        '<div class="og-col">' +
          '<div class="og-label">' + esc(title) + '</div>' +
          '<p class="og-hint">' + esc(desc) + '</p>' +
        '</div>' +
        '<span class="og-spacer"></span>' +
        badgeHtml(T('tools.status.' + item.status), item.status === 'beta' ? 'warn' : 'ok') +
      '</div>' +
      '<div class="og-section" data-role="tool-content"></div>' +
    '</div>');
    if (container) {
      container.innerHTML = '';
      container.appendChild(wrap);
    }
    return { wrap: wrap, content: wrap.querySelector('[data-role="tool-content"]') };
  }

  function makeCtx(root, cleanups) {
    const $ = (selector) => root.querySelector(selector);
    const $$ = (selector) => Array.prototype.slice.call(root.querySelectorAll(selector));
    return {
      root: root,
      $: $,
      $$: $$,
      on: function (selector, event, handler) {
        const node = $(selector);
        if (node) node.addEventListener(event, handler);
      },
      val: function (selector) {
        const node = $(selector);
        return node ? node.value : '';
      },
      set: function (selector, value) {
        const node = $(selector);
        if (!node) return;
        if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT' || node.tagName === 'SELECT') node.value = value;
        else node.textContent = value;
      },
      html: function (selector, markup) {
        const node = $(selector);
        if (node) node.innerHTML = markup;
      },
      msg: function (selector, message, type) {
        const node = $(selector);
        if (!node) return;
        node.textContent = message || '';
        node.className = type === 'error' ? 'og-badge og-badge--err' : 'og-hint';
      },
      cleanup: function (fn) {
        if (typeof fn === 'function') cleanups.push(fn);
      },
      toast: UI.toast,
      copy: UI.copy,
      downloadText: UI.downloadText,
      downloadBlob: UI.downloadBlob
    };
  }

  function bindFile(ctx, role, onFile) {
    const input = ctx.$('[data-role="' + role + '"]');
    if (input) {
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (file) onFile(file, input);
      });
    }
    const drop = ctx.$('[data-role="' + role + '-drop"]');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (name) {
        drop.addEventListener(name, function (event) {
          event.preventDefault();
          drop.classList.add('is-drop');
        });
      });
      ['dragleave', 'drop'].forEach(function (name) {
        drop.addEventListener(name, function (event) {
          event.preventDefault();
          drop.classList.remove('is-drop');
        });
      });
      drop.addEventListener('drop', function (event) {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) onFile(file, input);
      });
    }
  }

  function wireCopyDownload(ctx, outRole, filename, mime) {
    const read = function () { return ctx.val('[data-role="' + outRole + '"]'); };
    ctx.on('[data-role="copy-out"]', 'click', function () { UI.copy(read()); });
    ctx.on('[data-role="download-out"]', 'click', function () {
      const text = read();
      if (!text) { UI.toast(T('tools.ui.empty'), 'warn'); return; }
      UI.downloadText(filename, text, mime);
    });
    return read;
  }

  /* ============================================================
   * 17. 工具渲染器（每个工具独立 UI）
   * ========================================================== */

  /* ---------- 1. 文件哈希校验 ---------- */
  function renderHash(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.hash.text'), textareaHtml('hash-text', T('tools.hash.textPh'), 4)) +
      fieldHtml(T('tools.hash.file'), fileInputHtml('hash-file') + dropZoneHtml('hash-file'), T('tools.hash.hint')) +
      '<div data-role="hash-file-info"></div>' +
      btnRowHtml([
        btnHtml(T('tools.hash.compute'), 'primary', 'hash-run'),
        btnHtml(T('tools.ui.clear'), 'ghost', 'hash-clear')
      ]) +
      hintHtml('hash-msg') +
      resultHtml('hash-result');
    let selected = null;

    bindFile(ctx, 'hash-file', function (file) {
      selected = file;
      ctx.$('[data-role="hash-file-info"]').innerHTML =
        kvHtml(T('tools.ui.file'), file.name) +
        kvHtml(T('tools.ui.size'), fmtBytes(file.size)) +
        kvHtml(T('tools.ui.type'), file.type || '—');
      ctx.msg('[data-role="hash-msg"]', '');
    });

    ctx.on('[data-role="hash-run"]', 'click', async function () {
      ctx.msg('[data-role="hash-msg"]', T('tools.ui.processing'), 'info');
      let bytes;
      try {
        if (selected) {
          bytes = new Uint8Array(await UI.readBuffer(selected));
        } else {
          const text = ctx.val('[data-role="hash-text"]');
          if (!text) {
            ctx.msg('[data-role="hash-msg"]', T('tools.hash.noInput'), 'error');
            return;
          }
          bytes = utf8Encode(text);
        }
      } catch (err) {
        ctx.msg('[data-role="hash-msg"]', T('tools.ui.loadFailed'), 'error');
        return;
      }
      ctx.msg('[data-role="hash-msg"]', '');
      const rows = [['CRC32', UI.crc32Hex(bytes)]];
      const algorithms = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
      for (const algorithm of algorithms) {
        try {
          rows.push([algorithm, await UI.shaHex(algorithm, bytes)]);
        } catch (err) {
          rows.push([algorithm, '—']);
        }
      }
      const host = ctx.$('[data-role="hash-result"]');
      host.innerHTML = rows.map(function (row) {
        return '<div class="og-row">' + badgeHtml(row[0], 'info') +
          '<span class="og-spacer"></span>' +
          '<span class="og-mono">' + esc(row[1]) + '</span>' +
          '<button type="button" class="og-btn og-btn--sm" data-hash="' + esc(row[1]) + '">' +
          esc(T('tools.ui.copy')) + '</button></div>';
      }).join('');
    });

    ctx.on('[data-role="hash-result"]', 'click', function (event) {
      const btn = event.target && event.target.closest ? event.target.closest('[data-hash]') : null;
      if (btn) UI.copy(btn.getAttribute('data-hash'));
    });

    ctx.on('[data-role="hash-clear"]', 'click', function () {
      selected = null;
      ctx.set('[data-role="hash-text"]', '');
      ctx.html('[data-role="hash-file-info"]', '');
      ctx.html('[data-role="hash-result"]', '');
      ctx.msg('[data-role="hash-msg"]', '');
      const input = ctx.$('[data-role="hash-file"]');
      if (input) input.value = '';
    });
  }

  /* ---------- 2. 文件指纹识别 ---------- */
  function renderFingerprint(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.fp.magic'), fileInputHtml('fp-file', '') + dropZoneHtml('fp-file'), T('tools.fp.hint')) +
      hintHtml('fp-msg') +
      resultHtml('fp-result');
    bindFile(ctx, 'fp-file', async function (file) {
      ctx.msg('[data-role="fp-msg"]', T('tools.ui.processing'));
      try {
        const head = new Uint8Array(await UI.readBuffer(file.slice(0, 4096)));
        const info = sniffFile(head);
        const strings = printableStrings(head, 4);
        const stringsHtml = strings.length
          ? '<div class="og-row">' + strings.map((s) => '<span class="og-chip">' + esc(s) + '</span>').join('') + '</div>'
          : '<p class="og-hint">' + esc(T('tools.fp.none')) + '</p>';
        ctx.$('[data-role="fp-result"]').innerHTML =
          statsHtml([
            [T('tools.ui.file'), file.name],
            [T('tools.ui.size'), fmtBytes(file.size)],
            [T('tools.fp.kind'), info.ext.toUpperCase() + ' · ' + info.label],
            [T('tools.fp.mime'), info.mime],
            [T('tools.fp.entropy'), entropyOfBytes(head).toFixed(3) + ' / 8']
          ]) +
          '<div class="og-label">' + esc(T('tools.fp.header')) + '</div>' +
          '<pre class="og-mono og-result">' + esc(formatHexDump(head, 64)) + '</pre>' +
          '<div class="og-label">' + esc(T('tools.fp.strings')) + '</div>' + stringsHtml +
          badgeHtml(info.known ? T('tools.ui.detected') : T('common.unknown'), info.known ? 'ok' : 'warn');
        ctx.msg('[data-role="fp-msg"]', '');
      } catch (err) {
        ctx.msg('[data-role="fp-msg"]', T('tools.ui.loadFailed'), 'error');
      }
    });
  }

  /* ---------- 3. 编码转换 ---------- */
  const CODECS = {
    base64: { encode: toBase64, decode: fromBase64 },
    base32: { encode: toBase32, decode: fromBase32 },
    hex: { encode: toHex, decode: fromHex },
    url: { encode: urlEncode, decode: urlDecode },
    html: { encode: htmlEncode, decode: htmlDecode },
    binary: { encode: toBinary, decode: fromBinary },
    morse: { encode: toMorse, decode: fromMorse }
  };

  function renderEncode(content, ctx) {
    const options = [
      { value: 'base64', label: 'Base64' },
      { value: 'base32', label: 'Base32' },
      { value: 'hex', label: 'Hex' },
      { value: 'url', label: 'URL' },
      { value: 'html', label: 'HTML entities' },
      { value: 'binary', label: 'Binary' },
      { value: 'morse', label: 'Morse' }
    ];
    content.innerHTML =
      fieldHtml(T('tools.enc.codec'), selectHtml('enc-codec', options), T('tools.enc.autoHint')) +
      fieldHtml(T('tools.ui.input'), textareaHtml('enc-in', T('tools.enc.ph'), 5)) +
      btnRowHtml([
        btnHtml(T('tools.enc.encode'), 'primary', 'enc-encode'),
        btnHtml(T('tools.enc.decode'), '', 'enc-decode'),
        btnHtml(T('tools.enc.detect'), 'ghost', 'enc-detect')
      ]) +
      hintHtml('enc-msg') +
      fieldHtml(T('tools.ui.output'), textareaHtml('enc-out', T('tools.enc.textPh'), 6) +
        btnRowHtml([
          btnHtml(T('tools.ui.copy'), 'ghost', 'copy-out'),
          btnHtml(T('tools.ui.download'), 'ghost', 'download-out')
        ]));
    wireCopyDownload(ctx, 'enc-out', 'omniget-encoded.txt', 'text/plain;charset=utf-8');

    function convert(mode) {
      const codec = ctx.val('[data-role="enc-codec"]');
      const def = CODECS[codec];
      const input = ctx.val('[data-role="enc-in"]');
      if (!def) return;
      try {
        const out = mode === 'encode' ? def.encode(input) : def.decode(input);
        ctx.set('[data-role="enc-out"]', out);
        ctx.msg('[data-role="enc-msg"]', '');
      } catch (err) {
        ctx.set('[data-role="enc-out"]', '');
        ctx.msg('[data-role="enc-msg"]', T('tools.enc.badData') + ' — ' + String(err && err.message ? err.message : err), 'error');
      }
    }

    ctx.on('[data-role="enc-encode"]', 'click', function () { convert('encode'); });
    ctx.on('[data-role="enc-decode"]', 'click', function () { convert('decode'); });
    ctx.on('[data-role="enc-detect"]', 'click', function () {
      const detected = detectEncoding(ctx.val('[data-role="enc-in"]'));
      ctx.msg('[data-role="enc-msg"]',
        T('tools.ui.detected') + ': ' + (detected === 'text' ? T('tools.ui.plain') : detected), 'info');
      if (detected !== 'text') ctx.set('[data-role="enc-codec"]', detected);
    });
  }

  /* ---------- 4. 古典密码 ---------- */
  function renderCipher(content, ctx) {
    const options = [
      { value: 'caesar', label: T('tools.cipher.caesar') },
      { value: 'rot13', label: T('tools.cipher.rot13') },
      { value: 'atbash', label: T('tools.cipher.atbash') },
      { value: 'vigenere', label: T('tools.cipher.vigenere') },
      { value: 'railfence', label: T('tools.cipher.railfence') }
    ];
    content.innerHTML =
      fieldHtml(T('tools.cipher.type'), selectHtml('cipher-type', options)) +
      fieldHtml(T('tools.ui.input'), textareaHtml('cipher-in', T('tools.cipher.ph'), 5)) +
      '<div class="og-grid">' +
        fieldHtml(T('tools.cipher.shift'), inputHtml('cipher-shift', '3', '3', 'number')) +
        fieldHtml(T('tools.cipher.key'), inputHtml('cipher-key', 'LEMON', 'LEMON')) +
        fieldHtml('Rail Fence', inputHtml('cipher-rails', '3', '3', 'number')) +
      '</div>' +
      btnRowHtml([
        btnHtml(T('tools.cipher.encrypt'), 'primary', 'cipher-enc'),
        btnHtml(T('tools.cipher.decrypt'), '', 'cipher-dec'),
        btnHtml(T('tools.cipher.brute'), 'ghost', 'cipher-brute')
      ]) +
      hintHtml('cipher-msg') +
      fieldHtml(T('tools.ui.output'), textareaHtml('cipher-out', '', 5) +
        btnRowHtml([
          btnHtml(T('tools.ui.copy'), 'ghost', 'copy-out'),
          btnHtml(T('tools.ui.download'), 'ghost', 'download-out')
        ])) +
      resultHtml('cipher-brute-result');
    wireCopyDownload(ctx, 'cipher-out', 'omniget-cipher.txt', 'text/plain;charset=utf-8');

    function currentType() {
      return ctx.val('[data-role="cipher-type"]');
    }

    function run(decrypt) {
      const type = currentType();
      const text = ctx.val('[data-role="cipher-in"]');
      if (!text) {
        ctx.msg('[data-role="cipher-msg"]', T('tools.ui.invalid'), 'error');
        return;
      }
      try {
        let out;
        if (type === 'caesar') {
          const shift = Number(ctx.val('[data-role="cipher-shift"]')) || 0;
          out = caesar(text, decrypt ? -shift : shift);
        } else if (type === 'rot13') {
          out = rot13(text);
        } else if (type === 'atbash') {
          out = atbash(text);
        } else if (type === 'vigenere') {
          out = vigenere(text, ctx.val('[data-role="cipher-key"]'), decrypt);
        } else {
          out = railFence(text, Number(ctx.val('[data-role="cipher-rails"]')), decrypt);
        }
        ctx.set('[data-role="cipher-out"]', out);
        ctx.msg('[data-role="cipher-msg"]', '');
      } catch (err) {
        const message = String(err && err.message ? err.message : err);
        ctx.set('[data-role="cipher-out"]', '');
        ctx.msg('[data-role="cipher-msg"]',
          message.indexOf('key') >= 0 ? T('tools.cipher.keyNeeded') : message, 'error');
      }
    }

    ctx.on('[data-role="cipher-enc"]', 'click', function () { run(false); });
    ctx.on('[data-role="cipher-dec"]', 'click', function () { run(true); });
    ctx.on('[data-role="cipher-brute"]', 'click', function () {
      const text = ctx.val('[data-role="cipher-in"]');
      if (!text) {
        ctx.msg('[data-role="cipher-msg"]', T('tools.ui.invalid'), 'error');
        return;
      }
      const host = ctx.$('[data-role="cipher-brute-result"]');
      host.innerHTML = '<p class="og-hint">' + esc(T('tools.cipher.bruteHint')) + '</p>' +
        caesarBrute(text).map(function (item) {
          return '<div class="og-row">' + badgeHtml('ROT ' + item.shift, 'info') +
            '<span class="og-mono">' + esc(item.text) + '</span>' +
            '<span class="og-spacer"></span>' +
            '<button type="button" class="og-btn og-btn--sm" data-copy="' + esc(item.text) + '">' +
            esc(T('tools.ui.copy')) + '</button></div>';
        }).join('');
    });

    ctx.on('[data-role="cipher-brute-result"]', 'click', function (event) {
      const btn = event.target && event.target.closest ? event.target.closest('[data-copy]') : null;
      if (btn) UI.copy(btn.getAttribute('data-copy'));
    });
  }

  /* ---------- 5. 频率分析 ---------- */
  function renderFreq(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('freq-in', T('tools.freq.ph'), 6)) +
      btnRowHtml([btnHtml(T('tools.ui.run'), 'primary', 'freq-run')]) +
      hintHtml('freq-msg') +
      '<p class="og-hint">' + esc(T('tools.freq.hint')) + '</p>' +
      resultHtml('freq-result');
    const debounced = (OG.utils && OG.utils.debounce)
      ? OG.utils.debounce(run, 220)
      : run;
    ctx.on('[data-role="freq-in"]', 'input', debounced);
    ctx.on('[data-role="freq-run"]', 'click', run);

    function run() {
      const result = freq(ctx.val('[data-role="freq-in"]'));
      const host = ctx.$('[data-role="freq-result"]');
      if (!result.total) {
        host.innerHTML = '<p class="og-hint">' + esc(T('tools.freq.none')) + '</p>';
        return;
      }
      const max = result.letters.length ? result.letters[0].count : 1;
      const bars = result.letters.map(function (item) {
        const width = Math.max(2, Math.round((item.count / max) * 100));
        return '<div class="og-row">' +
          badgeHtml(item.ch, 'info') +
          '<div class="og-spacer"></div>' +
          '<div style="height:9px;width:' + width + '%;max-width:58%;background:var(--og-primary);border-radius:99px"></div>' +
          '<span class="og-mono">' + item.count + ' · ' + item.pct.toFixed(1) + '%</span></div>';
      }).join('');
      host.innerHTML = statsHtml([
        [T('tools.freq.entropy'), result.entropy.toFixed(3) + ' bits'],
        [T('tools.freq.ic'), result.ic.toFixed(4)],
        [T('tools.stats.chars'), result.total]
      ]) + '<div class="og-label">' + esc(T('tools.freq.letters')) + '</div>' + bars;
    }
  }

  /* ---------- 6. JSON 工具 ---------- */
  function renderJson(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('json-in', T('tools.json.ph'), 8)) +
      '<div class="og-grid">' +
        fieldHtml(T('tools.json.indent'), selectHtml('json-indent', [
          { value: '2', label: '2' }, { value: '4', label: '4' }, { value: '0', label: '0' }
        ])) +
        fieldHtml(T('tools.json.tree'), selectHtml('json-tree-mode', [
          { value: '1', label: T('common.none') }, { value: '0', label: T('tools.json.tree') }
        ])) +
      '</div>' +
      btnRowHtml([
        btnHtml(T('tools.json.format'), 'primary', 'json-format'),
        btnHtml(T('tools.json.minify'), '', 'json-minify'),
        btnHtml(T('tools.json.validate'), 'ghost', 'json-validate')
      ]) +
      hintHtml('json-msg') +
      fieldHtml(T('tools.ui.output'), textareaHtml('json-out', '', 8) +
        btnRowHtml([
          btnHtml(T('tools.ui.copy'), 'ghost', 'copy-out'),
          btnHtml(T('tools.ui.download'), 'ghost', 'download-out')
        ])) +
      resultHtml('json-tree');
    wireCopyDownload(ctx, 'json-out', 'omniget.json', 'application/json;charset=utf-8');

    function indentValue() {
      const value = ctx.val('[data-role="json-indent"]');
      return value === '0' ? 0 : Number(value || 2);
    }

    function showResult(text, markValid) {
      ctx.set('[data-role="json-out"]', text);
      if (markValid) {
        ctx.msg('[data-role="json-msg"]',
          T('tools.json.valid') + ' · ' + T('tools.json.stats', jsonStats(JSON.parse(text))), 'info');
      } else {
        ctx.msg('[data-role="json-msg"]', '');
      }
    }

    function renderTree(text) {
      const host = ctx.$('[data-role="json-tree"]');
      if (ctx.val('[data-role="json-tree-mode"]') !== '0') { host.innerHTML = ''; return; }
      try {
        host.innerHTML = '<div class="og-label">' + esc(T('tools.json.tree')) + '</div>' + jsonTreeHtml(JSON.parse(text), undefined, 0);
      } catch (err) {
        host.innerHTML = '';
      }
    }

    ctx.on('[data-role="json-format"]', 'click', function () {
      try {
        const out = jsonFormat(ctx.val('[data-role="json-in"]'), indentValue());
        ctx.set('[data-role="json-out"]', out);
        ctx.msg('[data-role="json-msg"]', T('tools.json.valid') + ' · ' +
          T('tools.json.stats', jsonStats(JSON.parse(out))), 'info');
        renderTree(out);
      } catch (err) {
        ctx.set('[data-role="json-out"]', '');
        ctx.msg('[data-role="json-msg"]', T('tools.json.invalid') + ' · ' +
          (err.line ? T('tools.json.line', { n: err.line }) + ' ' + T('tools.json.col', { n: err.col }) + ' · ' : '') +
          String(err.message || err), 'error');
      }
    });

    ctx.on('[data-role="json-minify"]', 'click', function () {
      try {
        const out = jsonMinify(ctx.val('[data-role="json-in"]'));
        ctx.set('[data-role="json-out"]', out);
        ctx.msg('[data-role="json-msg"]', T('tools.json.valid') + ' · ' + fmtBytes(out.length), 'info');
        renderTree(out);
      } catch (err) {
        ctx.set('[data-role="json-out"]', '');
        ctx.msg('[data-role="json-msg"]', T('tools.json.invalid') + ' · ' + String(err.message || err), 'error');
      }
    });

    ctx.on('[data-role="json-validate"]', 'click', function () {
      const result = jsonValidate(ctx.val('[data-role="json-in"]'));
      if (result.ok) {
        ctx.msg('[data-role="json-msg"]', T('tools.json.valid') + ' · ' + T('tools.json.stats', jsonStats(result.value)), 'info');
        renderTree(ctx.val('[data-role="json-in"]'));
      } else {
        ctx.msg('[data-role="json-msg"]', T('tools.json.invalid') + ' · ' +
          (result.line ? T('tools.json.line', { n: result.line }) + ' ' + T('tools.json.col', { n: result.col }) + ' · ' : '') +
          result.error, 'error');
      }
    });
  }

  /* ---------- 7. 时间戳转换 ---------- */
  function renderTimestamp(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), inputHtml('ts-in', '', T('tools.ts.ph'))) +
      btnRowHtml([
        btnHtml(T('tools.ts.convert'), 'primary', 'ts-run'),
        btnHtml(T('tools.ts.now'), 'ghost', 'ts-now')
      ]) +
      hintHtml('ts-msg') +
      resultHtml('ts-result');
    const debounced = (OG.utils && OG.utils.debounce) ? OG.utils.debounce(run, 200) : run;
    ctx.on('[data-role="ts-in"]', 'input', debounced);
    ctx.on('[data-role="ts-run"]', 'click', run);
    ctx.on('[data-role="ts-now"]', 'click', function () {
      ctx.set('[data-role="ts-in"]', String(Date.now()));
      run();
    });

    function run() {
      const value = ctx.val('[data-role="ts-in"]');
      const info = timestampInfo(value);
      if (!info) {
        ctx.html('[data-role="ts-result"]', '');
        ctx.msg('[data-role="ts-msg"]', value ? T('tools.ts.invalid') : '', value ? 'error' : '');
        return;
      }
      ctx.msg('[data-role="ts-msg"]', '');
      const rel = relativeTime(info.ms, Date.now());
      const lang = OG.state.lang === 'en' ? 'en' : 'zh';
      ctx.html('[data-role="ts-result"]', statsHtml([
        [T('tools.ts.seconds'), info.seconds],
        [T('tools.ts.ms'), info.ms],
        [T('tools.ts.iso'), info.iso],
        [T('tools.ts.utc'), info.utc],
        [T('tools.ts.local'), info.local],
        [T('tools.ts.relative'), rel[lang]]
      ]));
    }
  }

  /* ---------- 8. 文本统计 ---------- */
  function renderTextStats(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('stats-in', T('tools.stats.ph'), 7)) +
      resultHtml('stats-result');
    const debounced = (OG.utils && OG.utils.debounce) ? OG.utils.debounce(run, 180) : run;
    ctx.on('[data-role="stats-in"]', 'input', debounced);

    function run() {
      const stats = textStats(ctx.val('[data-role="stats-in"]'));
      ctx.html('[data-role="stats-result"]', statsHtml([
        [T('tools.stats.chars'), stats.chars],
        [T('tools.stats.charsNoSpace'), stats.charsNoSpaces],
        [T('tools.stats.words'), stats.words],
        [T('tools.stats.cjk'), stats.cjk],
        [T('tools.stats.lines'), stats.lines],
        [T('tools.stats.paragraphs'), stats.paragraphs],
        [T('tools.stats.sentences'), stats.sentences],
        [T('tools.stats.bytes'), stats.bytes],
        [T('tools.stats.reading'), T('tools.stats.min', { n: stats.readingMinutes })],
        [T('tools.stats.longest'), stats.longestLine],
        [T('tools.stats.uniqueWords'), stats.uniqueWords]
      ]));
    }
    run();
  }

  /* ---------- 9. 文本处理 ---------- */
  function renderTextProc(content, ctx) {
    const options = [
      { value: 'upper', label: T('tools.tp.upper') },
      { value: 'lower', label: T('tools.tp.lower') },
      { value: 'title', label: T('tools.tp.title') },
      { value: 'sentence', label: T('tools.tp.sentence') },
      { value: 'camel', label: T('tools.tp.camel') },
      { value: 'snake', label: T('tools.tp.snake') },
      { value: 'kebab', label: T('tools.tp.kebab') },
      { value: 'slug', label: T('tools.tp.slug') },
      { value: 'dedupe', label: T('tools.tp.dedupe') },
      { value: 'sortAsc', label: T('tools.tp.sortAsc') },
      { value: 'sortDesc', label: T('tools.tp.sortDesc') },
      { value: 'sortLen', label: T('tools.tp.sortLen') },
      { value: 'sortNum', label: T('tools.tp.sortNum') },
      { value: 'removeEmpty', label: T('tools.tp.removeEmpty') },
      { value: 'number', label: T('tools.tp.number') },
      { value: 'reverse', label: T('tools.tp.reverse') },
      { value: 'reverseLines', label: T('tools.tp.reverseLines') },
      { value: 'trim', label: T('tools.tp.trim') }
    ];
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('tp-in', T('tools.tp.ph'), 7)) +
      fieldHtml(T('tools.tp.op'), selectHtml('tp-op', options)) +
      btnRowHtml([
        btnHtml(T('tools.tp.apply'), 'primary', 'tp-apply'),
        btnHtml(T('tools.tp.reset'), 'ghost', 'tp-reset')
      ]) +
      hintHtml('tp-msg') +
      fieldHtml(T('tools.ui.output'), textareaHtml('tp-out', '', 7) +
        btnRowHtml([
          btnHtml(T('tools.ui.copy'), 'ghost', 'copy-out'),
          btnHtml(T('tools.ui.download'), 'ghost', 'download-out')
        ]));
    wireCopyDownload(ctx, 'tp-out', 'omniget-text.txt', 'text/plain;charset=utf-8');
    ctx.on('[data-role="tp-apply"]', 'click', function () {
      try {
        const out = transformText(ctx.val('[data-role="tp-in"]'), ctx.val('[data-role="tp-op"]'));
        ctx.set('[data-role="tp-out"]', out);
        ctx.msg('[data-role="tp-msg"]', '');
      } catch (err) {
        ctx.msg('[data-role="tp-msg"]', String(err.message || err), 'error');
      }
    });
    ctx.on('[data-role="tp-reset"]', 'click', function () {
      ctx.set('[data-role="tp-out"]', ctx.val('[data-role="tp-in"]'));
    });
  }

  /* ---------- 10. 图片压缩缩放 ---------- */
  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      if (typeof canvas.toBlob !== 'function') { reject(new Error('canvas.toBlob unavailable')); return; }
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('encode failed'));
      }, mime, quality);
    });
  }

  function imageMimeFor(format, originalType) {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'webp') return 'image/webp';
    if (format === 'png') return 'image/png';
    if (originalType === 'image/png' || originalType === 'image/webp' || originalType === 'image/jpeg') return originalType;
    return 'image/jpeg';
  }

  function renderResize(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.img.ph'), fileInputHtml('img-file', 'image/*') + dropZoneHtml('img-file')) +
      '<div class="og-grid">' +
        fieldHtml(T('tools.img.maxW'), inputHtml('img-maxw', '1920', '1920', 'number')) +
        fieldHtml(T('tools.img.maxH'), inputHtml('img-maxh', '1080', '1080', 'number')) +
      '</div>' +
      fieldHtml(T('tools.img.quality'), '<input class="og-range" data-role="img-quality" type="range" min="0.2" max="1" step="0.05" value="0.82">') +
      fieldHtml(T('tools.img.format'), selectHtml('img-format', [
        { value: 'auto', label: T('tools.img.auto') },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
        { value: 'png', label: 'PNG' }
      ])) +
      btnRowHtml([btnHtml(T('tools.img.compress'), 'primary', 'img-run')]) +
      hintHtml('img-msg') +
      resultHtml('img-result');
    let source = null;
    let image = null;

    bindFile(ctx, 'img-file', async function (file) {
      source = file;
      if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
        ctx.msg('[data-role="img-msg"]', T('tools.ui.notImage'), 'error');
        return;
      }
      try {
        const dataUrl = await UI.readDataUrl(file);
        image = await UI.loadImage(dataUrl);
        const target = calcScaledSize(image.width, image.height,
          Number(ctx.val('[data-role="img-maxw"]')), Number(ctx.val('[data-role="img-maxh"]')));
        ctx.$('[data-role="img-result"]').innerHTML =
          '<img data-role="img-preview" class="og-result" alt="" style="max-width:100%;height:auto" src="' + esc(dataUrl) + '">' +
          statsHtml([
            [T('tools.img.source'), image.width + ' × ' + image.height],
            [T('tools.ui.size'), fmtBytes(file.size)],
            [T('tools.img.resized'), target.w + ' × ' + target.h]
          ]);
        ctx.msg('[data-role="img-msg"]', '');
      } catch (err) {
        ctx.msg('[data-role="img-msg"]', T('tools.ui.loadFailed'), 'error');
      }
    });

    ctx.on('[data-role="img-run"]', 'click', async function () {
      if (!source || !image) {
        ctx.msg('[data-role="img-msg"]', T('tools.ui.notImage'), 'error');
        return;
      }
      ctx.msg('[data-role="img-msg"]', T('tools.ui.processing'));
      try {
        const target = calcScaledSize(image.width, image.height,
          Number(ctx.val('[data-role="img-maxw"]')), Number(ctx.val('[data-role="img-maxh"]')));
        const canvas = document.createElement('canvas');
        canvas.width = target.w;
        canvas.height = target.h;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, target.w, target.h);
        const format = ctx.val('[data-role="img-format"]');
        const mime = imageMimeFor(format, source.type);
        const quality = Number(ctx.val('[data-role="img-quality"]')) || 0.82;
        const blob = await canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : quality);
        const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
        const name = (source.name.replace(/\.[^.]+$/, '') || 'image') + '-omniget.' + ext;
        const pct = Math.round((1 - blob.size / source.size) * 100);
        ctx.$('[data-role="img-result"]').innerHTML = statsHtml([
          [T('tools.img.source'), image.width + ' × ' + image.height + ' · ' + fmtBytes(source.size)],
          [T('tools.img.output'), target.w + ' × ' + target.h + ' · ' + fmtBytes(blob.size)],
          [T('tools.ui.type'), mime],
          [T('tools.img.saving'), (pct > 0 ? pct : 0) + '%']
        ]) + (pct > 0
          ? badgeHtml('−' + pct + '%', 'ok')
          : badgeHtml(T('tools.img.bigger'), 'warn')) +
          (target.scaled ? '' : '<p class="og-hint">' + esc(T('tools.img.same')) + '</p>');
        ctx.msg('[data-role="img-msg"]', '');
        UI.downloadBlob(name, blob);
      } catch (err) {
        ctx.msg('[data-role="img-msg"]', String(err.message || err), 'error');
      }
    });
  }

  /* ---------- 11. 图片调色板 ---------- */
  function renderPalette(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.pal.ph'), fileInputHtml('pal-file', 'image/*') + dropZoneHtml('pal-file')) +
      fieldHtml(T('tools.pal.count'), selectHtml('pal-count', [
        { value: '6', label: '6' }, { value: '8', label: '8', selected: true }, { value: '12', label: '12' }
      ])) +
      hintHtml('pal-msg') +
      '<p class="og-hint">' + esc(T('tools.pal.hint')) + '</p>' +
      resultHtml('pal-result');

    bindFile(ctx, 'pal-file', async function (file) {
      try {
        const dataUrl = await UI.readDataUrl(file);
        const image = await UI.loadImage(dataUrl);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 256 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = paletteFromPixels(pixels, Number(ctx.val('[data-role="pal-count"]')) || 8);
        if (!colors.length) {
          ctx.msg('[data-role="pal-msg"]', T('tools.ui.loadFailed'), 'error');
          return;
        }
        ctx.msg('[data-role="pal-msg"]', '');
        const swatches = colors.map(function (color) {
          return '<div class="og-col">' +
            '<button type="button" class="og-card og-card--flat" data-hex="' + esc(color.hex) + '"' +
            ' aria-label="' + esc(color.hex) + '" style="background:' + esc(color.hex) + ';min-height:64px;border:none"></button>' +
            '<span class="og-mono">' + esc(color.hex) + '</span>' +
            '<span class="og-hint">' + color.pct.toFixed(1) + '%</span></div>';
        }).join('');
        ctx.$('[data-role="pal-result"]').innerHTML =
          '<div class="og-grid" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">' +
          swatches + '</div>';
      } catch (err) {
        ctx.msg('[data-role="pal-msg"]', T('tools.ui.loadFailed'), 'error');
      }
    });

    ctx.on('[data-role="pal-result"]', 'click', function (event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-hex]') : null;
      if (target) UI.copy(target.getAttribute('data-hex'));
    });
  }

  /* ---------- 12. 颜色转换与对比度 ---------- */
  function renderColor(content, ctx) {
    content.innerHTML =
      '<div class="og-grid">' +
        fieldHtml(T('tools.color.fg'),
          '<div class="og-row">' +
          '<input class="og-input" data-role="color-fg" type="text" value="#ffffff" spellcheck="false">' +
          '<input data-role="color-fg-pick" type="color" value="#ffffff" aria-label="' + esc(T('tools.color.fg')) + '">' +
          '</div>') +
        fieldHtml(T('tools.color.bg'),
          '<div class="og-row">' +
          '<input class="og-input" data-role="color-bg" type="text" value="#0b0f19" spellcheck="false">' +
          '<input data-role="color-bg-pick" type="color" value="#0b0f19" aria-label="' + esc(T('tools.color.bg')) + '">' +
          '</div>') +
      '</div>' +
      hintHtml('color-msg') +
      resultHtml('color-result');

    function recalc() {
      const fgText = ctx.val('[data-role="color-fg"]');
      const bgText = ctx.val('[data-role="color-bg"]');
      const fg = parseColor(fgText);
      const bg = parseColor(bgText);
      if (!fg || !bg) {
        ctx.msg('[data-role="color-msg"]', T('tools.color.bad'), 'error');
        return;
      }
      ctx.msg('[data-role="color-msg"]', '');
      const fgHex = rgbToHex(fg);
      const bgHex = rgbToHex(bg);
      const fgHsl = rgbToHsl(fg);
      const bgHsl = rgbToHsl(bg);
      const ratio = contrastRatio(fg, bg) || 0;
      const level = wcagLevel(ratio) || { aa: false, aaa: false, aaLarge: false };
      const mark = (ok) => badgeHtml(ok ? T('tools.color.pass') : T('tools.color.fail'), ok ? 'ok' : 'err');
      const pickerFg = ctx.$('[data-role="color-fg-pick"]');
      const pickerBg = ctx.$('[data-role="color-bg-pick"]');
      if (pickerFg) pickerFg.value = fgHex;
      if (pickerBg) pickerBg.value = bgHex;
      ctx.$('[data-role="color-result"]').innerHTML =
        '<div data-role="color-preview" class="og-result" style="background:' + esc(bgHex) +
        ';color:' + esc(fgHex) + ';padding:16px;border-radius:12px">' +
        '<div class="og-label" style="color:inherit">' + esc(T('tools.color.preview')) + '</div>' +
        '<p class="og-mono" style="color:inherit">OmniGet Studio · 本地工具 · Offline tools</p></div>' +
        statsHtml([
          [T('tools.color.fg'), fgHex + ' · rgb(' + fg.r + ', ' + fg.g + ', ' + fg.b + ') · hsl(' + fgHsl.h + ', ' + fgHsl.s + '%, ' + fgHsl.l + '%)'],
          [T('tools.color.bg'), bgHex + ' · rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ') · hsl(' + bgHsl.h + ', ' + bgHsl.s + '%, ' + bgHsl.l + '%)'],
          [T('tools.color.ratio'), ratio.toFixed(2) + ' : 1']
        ]) +
        '<div class="og-row">' +
        badgeHtml(T('tools.color.aa') + ' 4.5:1', level.aa ? 'ok' : 'err') +
        badgeHtml(T('tools.color.aaa') + ' 7:1', level.aaa ? 'ok' : 'err') +
        badgeHtml(T('tools.color.large') + ' 3:1', level.aaLarge ? 'ok' : 'err') +
        '</div>' +
        '<div class="og-row">' +
        '<button type="button" class="og-btn og-btn--sm" data-copy-color="' + esc(fgHex) + '">' + esc(T('tools.ui.copy')) + ' ' + esc(fgHex) + '</button>' +
        '<button type="button" class="og-btn og-btn--sm" data-copy-color="' + esc(bgHex) + '">' + esc(T('tools.ui.copy')) + ' ' + esc(bgHex) + '</button>' +
        '</div>';
    }

    const debounced = (OG.utils && OG.utils.debounce) ? OG.utils.debounce(recalc, 120) : recalc;
    ctx.on('[data-role="color-fg"]', 'input', debounced);
    ctx.on('[data-role="color-bg"]', 'input', debounced);
    ctx.on('[data-role="color-fg-pick"]', 'input', function () {
      ctx.set('[data-role="color-fg"]', ctx.val('[data-role="color-fg-pick"]'));
      recalc();
    });
    ctx.on('[data-role="color-bg-pick"]', 'input', function () {
      ctx.set('[data-role="color-bg"]', ctx.val('[data-role="color-bg-pick"]'));
      recalc();
    });
    ctx.on('[data-role="color-result"]', 'click', function (event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-copy-color]') : null;
      if (target) UI.copy(target.getAttribute('data-copy-color'));
    });
    recalc();
  }

  /* ---------- 13. 字幕工具 ---------- */
  function renderSubtitle(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('sub-in', T('tools.sub.ph'), 7)) +
      fieldHtml(T('tools.sub.second'), textareaHtml('sub-second', T('tools.ui.optional'), 4)) +
      '<div class="og-grid">' +
        fieldHtml(T('tools.sub.shift'), inputHtml('sub-shift', '500', '500', 'number')) +
      '</div>' +
      btnRowHtml([
        btnHtml(T('tools.sub.toVtt'), 'primary', 'sub-vtt'),
        btnHtml(T('tools.sub.toSrt'), '', 'sub-srt'),
        btnHtml('−500 ms', 'ghost', 'sub-shift-minus'),
        btnHtml('+500 ms', 'ghost', 'sub-shift-plus'),
        btnHtml(T('tools.sub.merge'), 'ghost', 'sub-merge')
      ]) +
      hintHtml('sub-msg') +
      fieldHtml(T('tools.ui.output'), textareaHtml('sub-out', '', 8) +
        btnRowHtml([
          btnHtml(T('tools.ui.copy'), 'ghost', 'copy-out'),
          btnHtml(T('tools.sub.downloadSrt'), 'ghost', 'sub-dl-srt'),
          btnHtml(T('tools.sub.downloadVtt'), 'ghost', 'sub-dl-vtt')
        ])) +
      resultHtml('sub-stats');
    wireCopyDownload(ctx, 'sub-out', 'subtitles.vtt', 'text/vtt;charset=utf-8');

    function updateStats(text) {
      const stats = srtStats(text);
      if (!stats.cues) {
        ctx.html('[data-role="sub-stats"]', '');
        return;
      }
      ctx.html('[data-role="sub-stats"]', statsHtml([
        [T('tools.sub.cues'), stats.cues],
        [T('tools.sub.duration'), formatDurationMs(stats.duration)],
        [T('tools.ui.bytes'), fmtBytes(utf8Encode(text).length)]
      ]));
    }

    function transform(fn, label) {
      const source = ctx.val('[data-role="sub-in"]');
      if (!source.trim()) {
        ctx.msg('[data-role="sub-msg"]', T('tools.ui.invalid'), 'error');
        return;
      }
      try {
        const out = fn(source);
        if (!out) {
          ctx.set('[data-role="sub-out"]', '');
          ctx.msg('[data-role="sub-msg"]', T('tools.sub.invalid'), 'error');
          return;
        }
        ctx.set('[data-role="sub-out"]', out);
        ctx.msg('[data-role="sub-msg"]', label || '');
        updateStats(out);
      } catch (err) {
        ctx.msg('[data-role="sub-msg"]', String(err.message || err), 'error');
      }
    }

    ctx.on('[data-role="sub-vtt"]', 'click', function () { transform(function (s) { return srtToVtt(s); }, T('tools.sub.toVtt')); });
    ctx.on('[data-role="sub-srt"]', 'click', function () { transform(function (s) { return vttToSrt(s); }, T('tools.sub.toSrt')); });
    ctx.on('[data-role="sub-shift-plus"]', 'click', function () {
      const offset = Math.abs(Number(ctx.val('[data-role="sub-shift"]')) || 0);
      transform(function (s) { return shiftSrt(s, offset); }, '+' + offset + 'ms');
    });
    ctx.on('[data-role="sub-shift-minus"]', 'click', function () {
      const offset = Math.abs(Number(ctx.val('[data-role="sub-shift"]')) || 0);
      transform(function (s) { return shiftSrt(s, -offset); }, '−' + offset + 'ms');
    });
    ctx.on('[data-role="sub-merge"]', 'click', function () {
      transform(function (s) { return mergeBilingual(s, ctx.val('[data-role="sub-second"]')); }, T('tools.sub.merged'));
    });
    ctx.on('[data-role="sub-dl-srt"]', 'click', function () {
      const out = ctx.val('[data-role="sub-out"]');
      if (!out) { ctx.toast(T('tools.ui.empty'), 'warn'); return; }
      const srt = parseSrt(out).length ? serializeSrt(parseSrt(out)) : out;
      UI.downloadText('subtitles.srt', srt, 'text/plain;charset=utf-8');
    });
    ctx.on('[data-role="sub-dl-vtt"]', 'click', function () {
      const out = ctx.val('[data-role="sub-out"]');
      if (!out) { ctx.toast(T('tools.ui.empty'), 'warn'); return; }
      UI.downloadText('subtitles.vtt', out, 'text/vtt;charset=utf-8');
    });
  }

  /* ---------- 14. 重复文件查找 ---------- */
  function renderDuplicate(content, ctx) {
    const state = { entries: [] };
    content.innerHTML =
      fieldHtml(T('tools.dup.pick'), fileInputHtml('dup-file', '', true) + dropZoneHtml('dup-file')) +
      btnRowHtml([btnHtml(T('tools.dup.clear'), 'ghost', 'dup-clear')]) +
      hintHtml('dup-msg') +
      '<p class="og-hint">' + esc(T('tools.dup.hint')) + '</p>' +
      resultHtml('dup-result');

    const input = ctx.$('[data-role="dup-file"]');
    if (input) {
      input.addEventListener('change', function () {
        collect(Array.prototype.slice.call(input.files || []));
        input.value = '';
      });
    }
    const drop = ctx.$('[data-role="dup-file-drop"]');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (name) {
        drop.addEventListener(name, function (event) { event.preventDefault(); drop.classList.add('is-drop'); });
      });
      ['dragleave', 'drop'].forEach(function (name) {
        drop.addEventListener(name, function (event) { event.preventDefault(); drop.classList.remove('is-drop'); });
      });
      drop.addEventListener('drop', function (event) {
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length) collect(Array.prototype.slice.call(files));
      });
    }

    async function collect(files) {
      if (!files.length) return;
      ctx.msg('[data-role="dup-msg"]', T('tools.dup.computing'));
      for (const file of files) {
        try {
          const bytes = new Uint8Array(await UI.readBuffer(file));
          const hash = await UI.shaHex('SHA-256', bytes);
          state.entries.push({ name: file.name, size: file.size, hash: hash });
        } catch (err) {
          /* 跳过无法读取的文件 */
        }
      }
      ctx.msg('[data-role="dup-msg"]', '');
      renderGroups();
    }

    function renderGroups() {
      const groups = groupByHash(state.entries);
      const wasted = wastedBytes(groups);
      const host = ctx.$('[data-role="dup-result"]');
      if (!state.entries.length) {
        host.innerHTML = '<p class="og-hint">' + esc(T('tools.ui.empty')) + '</p>';
        return;
      }
      if (!groups.length) {
        host.innerHTML = statsHtml([
          [T('tools.dup.files', { n: state.entries.length }), state.entries.length],
          [T('tools.dup.groups'), 0]
        ]) + '<p class="og-hint">' + esc(T('tools.dup.noDup')) + '</p>';
        return;
      }
      host.innerHTML = statsHtml([
        [T('tools.dup.files', { n: state.entries.length }), state.entries.length],
        [T('tools.dup.groups'), groups.length],
        [T('tools.dup.wasted'), fmtBytes(wasted)]
      ]) + groups.map(function (group, index) {
        return '<div class="og-card og-card--flat">' +
          '<div class="og-row">' + badgeHtml(T('tools.dup.group', { n: index + 1 }), 'warn') +
          '<span class="og-spacer"></span><span class="og-mono">' + esc(fmtBytes(group.size)) + '</span></div>' +
          group.files.map(function (file) {
            return kvHtml(file.name, fmtBytes(file.size));
          }).join('') +
          '<p class="og-mono">' + esc(group.hash.slice(0, 32)) + '…</p></div>';
      }).join('');
    }

    ctx.on('[data-role="dup-clear"]', 'click', function () {
      state.entries = [];
      ctx.html('[data-role="dup-result"]', '');
      ctx.msg('[data-role="dup-msg"]', '');
    });
  }

  /* ---------- 15. CSV 预览统计 ---------- */
  function renderCsv(content, ctx) {
    content.innerHTML =
      fieldHtml(T('tools.ui.input'), textareaHtml('csv-in', T('tools.csv.ph'), 7)) +
      '<div class="og-grid">' +
        fieldHtml(T('tools.csv.delimiter'), selectHtml('csv-delim', [
          { value: 'auto', label: T('tools.ui.detected') },
          { value: ',', label: ', (comma)' },
          { value: ';', label: '; (semicolon)' },
          { value: '\t', label: 'Tab' },
          { value: '|', label: '| (pipe)' }
        ])) +
        fieldHtml(T('tools.ui.actions'), btnRowHtml([
          btnHtml(T('tools.csv.export'), 'primary', 'csv-json'),
          btnHtml(T('tools.ui.copy'), 'ghost', 'csv-copy')
        ])) +
      '</div>' +
      hintHtml('csv-msg') +
      resultHtml('csv-result');

    function currentDelimiter(text) {
      const value = ctx.val('[data-role="csv-delim"]');
      return value === 'auto' ? detectDelimiter(text) : value;
    }

    function compute() {
      const text = ctx.val('[data-role="csv-in"]');
      if (!text.trim()) {
        ctx.html('[data-role="csv-result"]', '');
        return;
      }
      const rows = csvParse(text, currentDelimiter(text));
      if (!rows.length) {
        ctx.html('[data-role="csv-result"]', '<p class="og-hint">' + esc(T('tools.csv.empty')) + '</p>');
        return;
      }
      const header = rows[0];
      const body = rows.slice(1, 51);
      const table = '<table class="og-mono">' +
        '<thead><tr>' + header.map(function (cell) {
          return '<th>' + esc(cell) + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        body.map(function (row) {
          return '<tr>' + header.map(function (unused, i) {
            return '<td>' + esc(row[i] === undefined ? '' : row[i]) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
      const stats = csvStats(rows);
      const statRows = stats.map(function (column) {
        return '<tr><td>' + esc(column.name) + '</td><td>' + column.count + '</td><td>' + column.unique + '</td>' +
          '<td>' + (column.numeric ? column.numeric : '—') + '</td>' +
          '<td>' + (column.min === null ? '—' : String(column.min)) + '</td>' +
          '<td>' + (column.max === null ? '—' : String(column.max)) + '</td>' +
          '<td>' + (column.mean === null ? '—' : column.mean.toFixed(2)) + '</td></tr>';
      }).join('');
      ctx.$('[data-role="csv-result"]').innerHTML =
        statsHtml([
          [T('tools.csv.rows'), rows.length - 1],
          [T('tools.csv.cols'), header.length]
        ]) +
        '<div class="og-label">' + esc(T('tools.csv.preview')) + '</div>' +
        '<div class="og-result">' + table + '</div>' +
        '<div class="og-label">' + esc(T('tools.csv.stats')) + '</div>' +
        '<div class="og-result"><table class="og-mono"><thead><tr>' +
        '<th>' + esc(T('tools.csv.column')) + '</th><th>count</th><th>' + esc(T('tools.csv.unique')) + '</th><th>numeric</th><th>min</th><th>max</th><th>' + esc(T('tools.csv.mean')) + '</th>' +
        '</tr></thead><tbody>' + statRows + '</tbody></table></div>';
    }

    const debounced = (OG.utils && OG.utils.debounce) ? OG.utils.debounce(compute, 200) : compute;
    ctx.on('[data-role="csv-in"]', 'input', debounced);
    ctx.on('[data-role="csv-delim"]', 'change', compute);
    ctx.on('[data-role="csv-json"]', 'click', function () {
      const text = ctx.val('[data-role="csv-in"]');
      if (!text.trim()) { ctx.toast(T('tools.ui.empty'), 'warn'); return; }
      const rows = csvParse(text, currentDelimiter(text));
      UI.downloadText('omniget-csv.json', JSON.stringify(csvToObjects(rows), null, 2), 'application/json;charset=utf-8');
    });
    ctx.on('[data-role="csv-copy"]', 'click', function () {
      const text = ctx.val('[data-role="csv-in"]');
      if (!text.trim()) { ctx.toast(T('tools.ui.empty'), 'warn'); return; }
      const rows = csvParse(text, currentDelimiter(text));
      UI.copy(JSON.stringify(csvToObjects(rows), null, 2));
    });
  }

  /* ---------- 16. 文本对比 ---------- */
  function renderDiff(content, ctx) {
    content.innerHTML =
      '<div class="og-grid">' +
        fieldHtml(T('tools.ui.input'), textareaHtml('diff-a', T('tools.diff.ph1'), 6)) +
        fieldHtml(T('tools.ui.output'), textareaHtml('diff-b', T('tools.diff.ph2'), 6)) +
      '</div>' +
      btnRowHtml([
        btnHtml(T('tools.ui.run'), 'primary', 'diff-run'),
        btnHtml(T('tools.diff.unified'), 'ghost', 'diff-copy')
      ]) +
      hintHtml('diff-msg') +
      resultHtml('diff-result');
    let lastPatch = '';

    function run() {
      const a = ctx.val('[data-role="diff-a"]');
      const b = ctx.val('[data-role="diff-b"]');
      const ops = diffLines(a, b);
      const stats = diffStats(ops);
      lastPatch = unifiedDiff(a, b);
      if (!stats.added && !stats.removed) {
        ctx.$('[data-role="diff-result"]').innerHTML =
          '<p class="og-hint">' + esc(T('tools.diff.identical')) + '</p>';
        return;
      }
      ctx.$('[data-role="diff-result"]').innerHTML =
        '<div class="og-row">' +
        badgeHtml(T('tools.diff.added') + ' ' + stats.added, 'ok') +
        badgeHtml(T('tools.diff.removed') + ' ' + stats.removed, 'err') +
        badgeHtml(T('tools.diff.same') + ' ' + stats.same, 'info') +
        '</div>' +
        ops.map(function (op) {
          const type = op.type === 'add' ? 'ok' : op.type === 'remove' ? 'err' : null;
          const prefix = op.type === 'add' ? '+' : op.type === 'remove' ? '−' : ' ';
          return '<div class="og-row">' + badgeHtml(prefix, type) +
            '<span class="og-mono">' + esc(op.text) + '</span></div>';
        }).join('');
    }

    ctx.on('[data-role="diff-run"]', 'click', run);
    ctx.on('[data-role="diff-copy"]', 'click', function () {
      if (!lastPatch) { ctx.toast(T('tools.diff.identical'), 'warn'); return; }
      UI.copy(lastPatch);
    });
  }

  /* ============================================================
   * 18. 注册表 / open() / _impl 导出
   * ========================================================== */
  const RENDERERS = {
    hash: renderHash,
    fingerprint: renderFingerprint,
    encode: renderEncode,
    cipher: renderCipher,
    freq: renderFreq,
    json: renderJson,
    timestamp: renderTimestamp,
    textstats: renderTextStats,
    textproc: renderTextProc,
    resize: renderResize,
    palette: renderPalette,
    color: renderColor,
    subtitle: renderSubtitle,
    duplicate: renderDuplicate,
    csv: renderCsv,
    diff: renderDiff
  };

  const TOOL_BY_ID = Object.create(null);
  TOOLS.forEach(function (tool) { TOOL_BY_ID[tool.id] = tool; });

  OG.tools = {
    categories: CATEGORIES,
    list: TOOLS,
    get: function (id) { return TOOL_BY_ID[id] || null; },
    open: function (id, containerEl) {
      const item = TOOL_BY_ID[id];
      const container = containerEl || null;
      if (!item) {
        if (container) container.innerHTML = '<div class="og-empty">' + esc(T('tools.empty')) + '</div>';
        return { destroy: function () {} };
      }
      const cleanups = [];
      try {
        const rootInfo = toolRoot(container, item);
        const ctx = makeCtx(rootInfo.content, cleanups);
        const render = RENDERERS[id];
        if (render) render(rootInfo.content, ctx);
      } catch (err) {
        if (container) {
          container.innerHTML = '<div class="og-empty">' + esc(T('tools.ui.error')) + ': ' +
            esc(String(err && err.message ? err.message : err)) + '</div>';
        }
      }
      return {
        destroy: function () {
          for (let i = 0; i < cleanups.length; i++) {
            try { cleanups[i](); } catch (e) { /* ignore */ }
          }
          cleanups.length = 0;
          if (container) container.innerHTML = '';
        }
      };
    },
    _impl: {
      utf8Encode: utf8Encode,
      utf8Decode: utf8Decode,
      bytesToBase64: bytesToBase64,
      base64ToBytes: base64ToBytes,
      toBase64: toBase64,
      fromBase64: fromBase64,
      bytesToBase32: bytesToBase32,
      base32ToBytes: base32ToBytes,
      toBase32: toBase32,
      fromBase32: fromBase32,
      bytesToHex: bytesToHex,
      hexToBytes: hexToBytes,
      toHex: toHex,
      fromHex: fromHex,
      bytesToBinary: bytesToBinary,
      binaryToBytes: binaryToBytes,
      toBinary: toBinary,
      fromBinary: fromBinary,
      urlEncode: urlEncode,
      urlDecode: urlDecode,
      htmlEncode: htmlEncode,
      htmlDecode: htmlDecode,
      toMorse: toMorse,
      fromMorse: fromMorse,
      detectEncoding: detectEncoding,
      caesar: caesar,
      rot13: rot13,
      caesarBrute: caesarBrute,
      atbash: atbash,
      vigenere: vigenere,
      railFence: railFence,
      shannonEntropy: shannonEntropy,
      indexOfCoincidence: indexOfCoincidence,
      freq: freq,
      jsonValidate: jsonValidate,
      jsonFormat: jsonFormat,
      jsonMinify: jsonMinify,
      jsonStats: jsonStats,
      jsonTreeHtml: jsonTreeHtml,
      parseTimestamp: parseTimestamp,
      formatIso: formatIso,
      timestampInfo: timestampInfo,
      relativeTime: relativeTime,
      formatDurationMs: formatDurationMs,
      textStats: textStats,
      countWords: countWords,
      readingMinutes: readingMinutes,
      sortLines: sortLines,
      uniqueLines: uniqueLines,
      removeEmptyLines: removeEmptyLines,
      numberLines: numberLines,
      reverseText: reverseText,
      reverseLines: reverseLines,
      trimLines: trimLines,
      toTitleCase: toTitleCase,
      camelCase: camelCase,
      snakeCase: snakeCase,
      kebabCase: kebabCase,
      slugify: slugify,
      caseConvert: caseConvert,
      transformText: transformText,
      detectDelimiter: detectDelimiter,
      csvParse: csvParse,
      csvToObjects: csvToObjects,
      csvStringify: csvStringify,
      csvStats: csvStats,
      diffLines: diffLines,
      diffStats: diffStats,
      unifiedDiff: unifiedDiff,
      hexToRgb: hexToRgb,
      rgbToHex: rgbToHex,
      rgbToHsl: rgbToHsl,
      hslToRgb: hslToRgb,
      colorToHsl: colorToHsl,
      parseColor: parseColor,
      relativeLuminance: relativeLuminance,
      contrastRatio: contrastRatio,
      wcagLevel: wcagLevel,
      sniffFile: sniffFile,
      entropyOfBytes: entropyOfBytes,
      printableStrings: printableStrings,
      formatHexDump: formatHexDump,
      calcScaledSize: calcScaledSize,
      paletteFromPixels: paletteFromPixels,
      crc32: crc32,
      parseTimecode: parseTimecode,
      formatTimecode: formatTimecode,
      parseSrt: parseSrt,
      serializeSrt: serializeSrt,
      srtToVtt: srtToVtt,
      vttToSrt: vttToSrt,
      shiftSrt: shiftSrt,
      mergeBilingual: mergeBilingual,
      srtStats: srtStats,
      groupByHash: groupByHash,
      wastedBytes: wastedBytes
    }
  };
})();
