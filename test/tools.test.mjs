/**
 * tools.js 单元测试（node:test + node:assert）
 *
 * 运行：node --test test/tools.test.mjs
 *
 * 说明：src/tools.js 是浏览器 IIFE（只依赖 window.OG），
 * 这里用一个最小 core.js stub 注入 window.OG，再用 vm 加载源文件，
 * 然后直接断言挂载在 OG.tools._impl 上的纯函数。
 * 不加载 core.js / index.html，不依赖 DOM。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../src/tools.js', import.meta.url), 'utf8');

/* ---------- 最小 core.js stub ---------- */
const dict = { zh: {}, en: {} };
const OG = {
  state: { lang: 'zh' },
  dict,
  icons: {},
  addDict(patch) {
    ['zh', 'en'].forEach((lang) => {
      if (!patch[lang]) return;
      dict[lang] = dict[lang] || {};
      Object.keys(patch[lang]).forEach((key) => { dict[lang][key] = patch[lang][key]; });
    });
  },
  t(key, vars) {
    let text = dict.zh[key] !== undefined ? dict.zh[key] : key;
    if (vars && typeof vars === 'object') {
      text = String(text).replace(/\{(\w+)\}/g, (match, name) => (
        vars[name] === undefined ? match : String(vars[name])
      ));
    }
    return text;
  },
  icon() { return '<svg></svg>'; },
  utils: {
    escapeHtml(str) {
      return String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
  },
  toolText(obj) {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    return obj[OG.state.lang] || obj.zh || obj.en || '';
  }
};

globalThis.window = { OG };
vm.runInThisContext(SOURCE, { filename: 'src/tools.js' });

const I = OG.tools._impl;

/* ============================================================
 * 0. 模块结构与工具清单
 * ========================================================== */
test('模块挂载与工具清单', () => {
  assert.equal(typeof OG.tools, 'object');
  assert.equal(typeof OG.tools.open, 'function');
  assert.ok(Array.isArray(OG.tools.list));
  assert.ok(Array.isArray(OG.tools.categories));
  assert.ok(OG.tools.list.length >= 14, '至少 14 个工具');
  assert.equal(OG.tools.list.length, 16);
  assert.equal(OG.tools.categories.length, 5);
  const ids = OG.tools.list.map((tool) => tool.id);
  assert.equal(new Set(ids).size, ids.length, '工具 id 唯一');
  const categoryIds = OG.tools.categories.map((category) => category.id);
  OG.tools.list.forEach((tool) => {
    assert.equal(typeof tool.id, 'string');
    assert.ok(tool.title.zh && tool.title.en, tool.id + ' 需要中英标题');
    assert.ok(tool.desc.zh && tool.desc.en, tool.id + ' 需要中英描述');
    assert.ok(typeof tool.icon === 'string' && tool.icon.length > 0);
    assert.ok(categoryIds.indexOf(tool.category) >= 0, tool.id + ' 分类合法');
    assert.ok(tool.status === 'ready' || tool.status === 'beta');
  });
  assert.equal(OG.tools.get('hash').title.zh, '文件哈希校验');
  assert.equal(OG.tools.get('nope'), null);
});

test('_impl 导出了全部纯函数', () => {
  const names = [
    'toBase64', 'fromBase64', 'toBase32', 'fromBase32', 'toHex', 'fromHex',
    'toBinary', 'fromBinary', 'urlEncode', 'urlDecode', 'htmlEncode', 'htmlDecode',
    'toMorse', 'fromMorse', 'detectEncoding', 'caesar', 'rot13', 'caesarBrute',
    'atbash', 'vigenere', 'railFence', 'freq', 'shannonEntropy', 'indexOfCoincidence',
    'jsonValidate', 'jsonFormat', 'jsonMinify', 'jsonStats', 'jsonTreeHtml',
    'parseTimestamp', 'timestampInfo', 'relativeTime', 'formatDurationMs',
    'textStats', 'sortLines', 'uniqueLines', 'removeEmptyLines', 'numberLines',
    'reverseText', 'reverseLines', 'trimLines', 'toTitleCase', 'camelCase',
    'snakeCase', 'kebabCase', 'slugify', 'caseConvert', 'transformText',
    'csvParse', 'csvToObjects', 'csvStringify', 'csvStats', 'detectDelimiter',
    'diffLines', 'diffStats', 'unifiedDiff', 'hexToRgb', 'rgbToHex', 'rgbToHsl',
    'hslToRgb', 'colorToHsl', 'parseColor', 'relativeLuminance', 'contrastRatio',
    'wcagLevel', 'sniffFile', 'entropyOfBytes', 'printableStrings', 'formatHexDump',
    'calcScaledSize', 'paletteFromPixels', 'crc32', 'parseTimecode', 'formatTimecode',
    'parseSrt', 'serializeSrt', 'srtToVtt', 'vttToSrt', 'shiftSrt', 'mergeBilingual',
    'srtStats', 'groupByHash', 'wastedBytes'
  ];
  names.forEach((name) => {
    assert.equal(typeof I[name], 'function', '_impl.' + name + ' 应该是函数');
  });
});

/* ============================================================
 * 1. Base64 / Base32 / Hex / Binary
 * ========================================================== */
test('Base64 编解码', () => {
  assert.equal(I.toBase64('hello'), 'aGVsbG8=');
  assert.equal(I.fromBase64('aGVsbG8='), 'hello');
  assert.equal(I.toBase64('中文'), '5Lit5paH');
  assert.equal(I.fromBase64('5Lit5paH'), '中文');
  assert.equal(I.toBase64(''), '');
  assert.equal(I.fromBase64(''), '');
  assert.equal(I.fromBase64(' aGVs bG8= '), 'hello');
  assert.deepEqual(Array.from(I.base64ToBytes('AQID')), [1, 2, 3]);
  assert.equal(I.bytesToBase64(new Uint8Array([255, 254])), '//4=');
  assert.throws(() => I.fromBase64('!!!!'), /base64/);
  assert.throws(() => I.fromBase64('abcde'), /base64/);
});

test('Base32 编解码', () => {
  assert.equal(I.toBase32('hello'), 'NBSWY3DP');
  assert.equal(I.fromBase32('NBSWY3DP'), 'hello');
  assert.equal(I.fromBase32('nbswy3dp'), 'hello');
  assert.equal(I.toBase32(''), '');
  assert.equal(I.fromBase32(''), '');
  assert.deepEqual(Array.from(I.base32ToBytes('MFRGG===')), [97, 98, 99]);
  assert.throws(() => I.base32ToBytes('0189'), /base32/);
});

test('Hex / 二进制 编解码', () => {
  assert.equal(I.toHex('ABC'), '414243');
  assert.equal(I.fromHex('414243'), 'ABC');
  assert.equal(I.fromHex('e4b8ad'), '中');
  assert.equal(I.toHex(''), '');
  assert.deepEqual(Array.from(I.hexToBytes('0x0a, 0b')), [10, 11]);
  assert.throws(() => I.hexToBytes('abc'), /hex/);
  assert.throws(() => I.hexToBytes('zz'), /hex/);
  assert.equal(I.toBinary('A'), '01000001');
  assert.equal(I.fromBinary('01000001'), 'A');
  assert.equal(I.fromBinary('0100 0001'), 'A');
  assert.equal(I.toBinary(''), '');
  assert.throws(() => I.fromBinary('0100000'), /binary/);
  assert.throws(() => I.fromBinary('0100x000'), /binary/);
});

/* ============================================================
 * 2. URL / HTML 实体 / 摩斯
 * ========================================================== */
test('URL 与 HTML 实体', () => {
  assert.equal(I.urlEncode('中文 a&b'), '%E4%B8%AD%E6%96%87%20a%26b');
  assert.equal(I.urlDecode('%E4%B8%AD%E6%96%87'), '中文');
  assert.throws(() => I.urlDecode('%E4'), URIError);
  assert.equal(I.htmlEncode('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  assert.equal(I.htmlEncode("it's"), 'it&#39;s');
  assert.equal(I.htmlDecode('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;'), '<b>"x" & y</b>');
  assert.equal(I.htmlDecode('&#20013;&#x6587;'), '中文');
  assert.equal(I.htmlDecode('&nbsp;'), '\u00a0');
  assert.equal(I.htmlDecode('&fake;'), '&fake;');
});

test('摩斯电码', () => {
  assert.equal(I.toMorse('SOS'), '... --- ...');
  assert.equal(I.toMorse('HELLO WORLD'), '.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  assert.equal(I.fromMorse('... --- ...'), 'SOS');
  assert.equal(I.fromMorse(I.toMorse('SOS 123')), 'SOS 123');
  assert.equal(I.toMorse('中文'), '');
  assert.equal(I.fromMorse(''), '');
});

test('编码自动识别', () => {
  assert.equal(I.detectEncoding('aGVsbG8='), 'base64');
  assert.equal(I.detectEncoding('... --- ...'), 'morse');
  assert.equal(I.detectEncoding('01101000 01100101'), 'binary');
  assert.equal(I.detectEncoding('68656c6c6f'), 'hex');
  assert.equal(I.detectEncoding('hello%20world'), 'url');
  assert.equal(I.detectEncoding('hello world'), 'text');
  assert.equal(I.detectEncoding(''), 'text');
});

/* ============================================================
 * 3. 古典密码
 * ========================================================== */
test('Caesar / ROT13 / Atbash', () => {
  assert.equal(I.caesar('Hello, World!', 3), 'Khoor, Zruog!');
  assert.equal(I.caesar('abc', 0), 'abc');
  assert.equal(I.caesar('abc', -1), 'zab');
  assert.equal(I.caesar('中文abc', 1), '中文bcd');
  assert.equal(I.caesar(I.caesar('Hello', 5), -5), 'Hello');
  assert.equal(I.caesar('', 3), '');
  assert.equal(I.rot13('Hello'), 'Uryyb');
  assert.equal(I.rot13(I.rot13('Test')), 'Test');
  assert.equal(I.atbash('abcXYZ'), 'zyxCBA');
  assert.equal(I.atbash(I.atbash('Hello')), 'Hello');
  const brute = I.caesarBrute('abc');
  assert.equal(brute.length, 26);
  assert.equal(brute[0].text, 'abc');
  assert.equal(brute[0].shift, 0);
});

test('Vigenère', () => {
  assert.equal(I.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(I.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
  assert.equal(I.vigenere('Attack at dawn', 'LEMON'), 'Lxfopv ef rnhr');
  assert.equal(I.vigenere('abc', 'lemon'), 'lfo');
  assert.throws(() => I.vigenere('abc', '123'), /key/);
  assert.equal(I.vigenere('', 'LEMON'), '');
});

test('Rail Fence', () => {
  assert.equal(I.railFence('HELLO', 3), 'HOELL');
  assert.equal(I.railFence('HOELL', 3, true), 'HELLO');
  assert.equal(I.railFence('ABCDEF', 2), 'ACEBDF');
  assert.equal(I.railFence('', 3), '');
  const zigzag = 'WEAREDISCOVEREDFLEEATONCE';
  assert.equal(I.railFence(I.railFence(zigzag, 3), 3, true), zigzag);
  assert.throws(() => I.railFence('abc', 1), /rails/);
});

/* ============================================================
 * 4. 频率分析
 * ========================================================== */
test('频率分析与熵', () => {
  const empty = I.freq('');
  assert.equal(empty.total, 0);
  assert.equal(empty.entropy, 0);
  assert.equal(empty.ic, 0);
  assert.deepEqual(empty.letters, []);

  const result = I.freq('AAB');
  assert.equal(result.total, 3);
  assert.equal(result.counts.A, 2);
  assert.equal(result.counts.B, 1);
  assert.equal(result.letters[0].ch, 'A');
  assert.equal(result.letters[0].count, 2);
  assert.ok(Math.abs(result.entropy - 0.918) < 0.01);
  assert.ok(Math.abs(result.ic - 1 / 3) < 1e-9);

  assert.equal(I.freq('中文abc').total, 3);
  assert.equal(I.shannonEntropy({ A: 4 }, 4), 0);
  assert.equal(I.indexOfCoincidence({ A: 4 }, 4), 1);
  assert.equal(I.indexOfCoincidence({ A: 1, B: 1 }, 2), 0);
  assert.ok(Math.abs(I.freq('Hello').ic - 0.1) < 1e-9);
});

/* ============================================================
 * 5. JSON
 * ========================================================== */
test('JSON 校验 / 格式化 / 压缩', () => {
  assert.equal(I.jsonValidate('{"a":1}').ok, true);
  assert.equal(I.jsonValidate('[1,2,3]').ok, true);
  assert.equal(I.jsonValidate('').ok, false);
  const bad = I.jsonValidate('{bad');
  assert.equal(bad.ok, false);
  assert.ok(typeof bad.error === 'string');
  assert.ok(bad.line >= 0);
  assert.equal(I.jsonFormat('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(I.jsonFormat('[1,2]', 4), '[\n    1,\n    2\n]');
  assert.equal(I.jsonFormat('[1,2]', 0), '[1,2]');
  assert.equal(I.jsonMinify(' { "a" : 1 } '), '{"a":1}');
  assert.equal(I.jsonMinify('"中文"'), '"中文"');
  assert.throws(() => I.jsonFormat('{oops'), SyntaxError);
  assert.throws(() => I.jsonMinify('{oops'), SyntaxError);
});

test('JSON 树与统计', () => {
  assert.ok(I.jsonTreeHtml({ a: 1 }).indexOf('a') >= 0);
  assert.ok(I.jsonTreeHtml({ x: '<script>' }).indexOf('&lt;script&gt;') >= 0);
  assert.ok(I.jsonTreeHtml([1, 2]).indexOf('2') >= 0);
  assert.equal(I.jsonTreeHtml(null), '<div><span class="og-mono">null</span></div>');
  const stats = I.jsonStats({ a: { b: 1 }, c: [1, 2] });
  assert.equal(stats.keys, 3);
  assert.equal(stats.arrays, 1);
  assert.equal(stats.depth, 3);
  assert.equal(I.jsonStats([1, [2]]).arrays, 2);
});

/* ============================================================
 * 6. 时间戳
 * ========================================================== */
test('时间戳解析与格式化', () => {
  assert.equal(I.parseTimestamp('1700000000'), 1700000000000);
  assert.equal(I.parseTimestamp('1700000000000'), 1700000000000);
  assert.equal(I.parseTimestamp(1700000000), 1700000000000);
  assert.equal(I.parseTimestamp('2023-11-14T22:13:20Z'), 1700000000000);
  assert.equal(I.parseTimestamp(''), null);
  assert.equal(I.parseTimestamp('nope'), null);
  assert.equal(I.parseTimestamp(null), null);
  assert.equal(I.parseTimestamp(new Date(1700000000000)), 1700000000000);
  assert.equal(I.formatIso(1700000000000), '2023-11-14T22:13:20.000Z');
  assert.equal(I.formatIso('nope'), '');
  assert.equal(I.timestampInfo(0).iso, '1970-01-01T00:00:00.000Z');
  assert.equal(I.timestampInfo(1700000000000).seconds, 1700000000);
  assert.equal(I.timestampInfo('bad'), null);
});

test('相对时间与时长', () => {
  const now = 1700000000000;
  assert.equal(I.relativeTime(now - 7200000, now).en, '2 hours ago');
  assert.equal(I.relativeTime(now - 7200000, now).zh, '2 小时前');
  assert.equal(I.relativeTime(now + 2 * 86400000, now).en, 'in 2 days');
  assert.equal(I.relativeTime(now - 5000, now).en, 'just now');
  assert.equal(I.relativeTime(now, now).en, 'just now');
  assert.equal(I.formatDurationMs(3661000), '1:01:01');
  assert.equal(I.formatDurationMs(65000), '01:05');
  assert.equal(I.formatDurationMs(-5), '00:00');
});

/* ============================================================
 * 7. 文本统计与处理
 * ========================================================== */
test('文本统计', () => {
  const empty = I.textStats('');
  assert.equal(empty.chars, 0);
  assert.equal(empty.words, 0);
  assert.equal(empty.lines, 0);
  assert.equal(empty.paragraphs, 0);
  assert.equal(empty.sentences, 0);
  assert.equal(empty.readingMinutes, 0);
  assert.equal(empty.bytes, 0);

  const stats = I.textStats('Hello world');
  assert.equal(stats.chars, 11);
  assert.equal(stats.charsNoSpaces, 10);
  assert.equal(stats.words, 2);
  assert.equal(stats.lines, 1);
  assert.equal(stats.paragraphs, 1);
  assert.equal(stats.sentences, 1);
  assert.equal(stats.bytes, 11);
  assert.equal(stats.readingMinutes, 1);

  const cjk = I.textStats('你好世界');
  assert.equal(cjk.cjk, 4);
  assert.equal(cjk.words, 4);
  assert.equal(cjk.bytes, 12);

  const multi = I.textStats('a\n\nb');
  assert.equal(multi.lines, 3);
  assert.equal(multi.paragraphs, 2);
  assert.equal(I.countWords('你好 world'), 3);
  assert.equal(I.readingMinutes('word '.repeat(250)), 2);
});

test('文本处理', () => {
  assert.equal(I.sortLines('b\na'), 'a\nb');
  assert.equal(I.sortLines('b\na', 'desc'), 'b\na');
  assert.equal(I.sortLines('10\n2', 'numeric'), '2\n10');
  assert.equal(I.sortLines('aa\nb', 'length'), 'aa\nb');
  assert.equal(I.sortLines(''), '');
  assert.equal(I.uniqueLines('b\na\nb'), 'b\na');
  assert.equal(I.removeEmptyLines('a\n\n b \n'), 'a\n b ');
  assert.equal(I.numberLines('a\nb'), '1. a\n2. b');
  assert.equal(I.numberLines(''), '');
  assert.equal(I.reverseText('abc'), 'cba');
  assert.equal(I.reverseText('中文ab'), 'ba文中');
  assert.equal(I.reverseText('😀ab'), 'ba😀');
  assert.equal(I.reverseLines('a\nb'), 'b\na');
  assert.equal(I.trimLines('  a \n b  '), 'a\nb');
  assert.equal(I.toTitleCase('hello wORLD'), 'Hello World');
  assert.equal(I.camelCase('hello world'), 'helloWorld');
  assert.equal(I.camelCase('HTTP server'), 'httpServer');
  assert.equal(I.camelCase(''), '');
  assert.equal(I.snakeCase('Hello World'), 'hello_world');
  assert.equal(I.kebabCase('Hello World'), 'hello-world');
  assert.equal(I.slugify('Hello, World! 2024'), 'hello-world-2024');
  assert.equal(I.slugify('中文'), '');
  assert.equal(I.slugify('  --A__B-- '), 'a-b');
  assert.equal(I.caseConvert('abc', 'upper'), 'ABC');
  assert.equal(I.caseConvert('ABC', 'lower'), 'abc');
  assert.throws(() => I.caseConvert('x', 'nope'));
  assert.equal(I.transformText('a\nb', 'reverseLines'), 'b\na');
  assert.throws(() => I.transformText('x', 'nope'));
});

/* ============================================================
 * 8. CSV 与 Diff
 * ========================================================== */
test('CSV 解析 / 生成 / 统计', () => {
  assert.deepEqual(I.csvParse(''), []);
  assert.deepEqual(I.csvParse('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.equal(I.csvParse('"a,b",c')[0][0], 'a,b');
  assert.equal(I.csvParse('a,"x""y"')[0][1], 'x"y');
  assert.equal(I.csvParse('a,b\n\n1,2').length, 2);
  assert.equal(I.csvParse('a;b;c\n1;2;3', ';').length, 2);
  assert.deepEqual(I.csvToObjects([['a', 'b'], ['1', '2']]), [{ a: '1', b: '2' }]);
  assert.deepEqual(I.csvToObjects([]), []);
  assert.equal(I.csvStringify([['a,b', 'c']]), '"a,b",c');
  assert.equal(I.csvStringify([['a"b']]), '"a""b"');
  assert.equal(I.csvStringify([]), '');
  assert.equal(I.detectDelimiter('a;b;c'), ';');
  assert.equal(I.detectDelimiter('a,b'), ',');
  assert.equal(I.detectDelimiter(''), ',');
  const stats = I.csvStats([['n'], ['1'], ['2'], ['']]);
  assert.equal(stats[0].name, 'n');
  assert.equal(stats[0].numeric, 2);
  assert.equal(stats[0].unique, 2);
  assert.equal(stats[0].min, 1);
  assert.equal(stats[0].max, 2);
  assert.equal(stats[0].mean, 1.5);
  assert.deepEqual(I.csvStats([]), []);
});

test('文本 Diff', () => {
  const ops = I.diffLines('a\nb', 'a\nc');
  assert.equal(ops.length, 3);
  assert.equal(ops[0].type, 'equal');
  assert.equal(ops[1].type, 'remove');
  assert.equal(ops[2].type, 'add');
  const stats = I.diffStats(ops);
  assert.equal(stats.added, 1);
  assert.equal(stats.removed, 1);
  assert.equal(stats.same, 1);
  assert.deepEqual(I.diffLines('', ''), []);
  assert.equal(I.diffStats([]).added, 0);
  assert.equal(I.unifiedDiff('same', 'same'), '');
  const patch = I.unifiedDiff('a', 'b');
  assert.ok(patch.indexOf('--- a') === 0);
  assert.ok(patch.indexOf('+++ b') >= 0);
  assert.ok(patch.indexOf('-a') >= 0);
  assert.ok(patch.indexOf('+b') >= 0);
});

/* ============================================================
 * 9. 颜色
 * ========================================================== */
test('颜色互转与 WCAG 对比度', () => {
  assert.deepEqual(I.hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(I.hexToRgb('#f00'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(I.hexToRgb('red'), { r: 255, g: 0, b: 0 });
  assert.equal(I.hexToRgb('nope'), null);
  assert.equal(I.hexToRgb(''), null);
  assert.equal(I.rgbToHex({ r: 255, g: 0, b: 0 }), '#ff0000');
  assert.equal(I.rgbToHex({ r: 0, g: 128, b: 255 }), '#0080ff');
  assert.deepEqual(I.rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(I.rgbToHsl({ r: 51, g: 102, b: 204 }), { h: 220, s: 60, l: 50 });
  assert.deepEqual(I.hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(I.hslToRgb({ h: 0, s: 0, l: 50 }), { r: 128, g: 128, b: 128 });
  assert.deepEqual(I.colorToHsl('#3366cc'), { h: 220, s: 60, l: 50 });
  assert.equal(I.colorToHsl('nope'), null);
  assert.deepEqual(I.parseColor('rgb(255, 0, 0)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(I.parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(I.parseColor('white'), { r: 255, g: 255, b: 255 });
  assert.equal(I.parseColor('bad-color'), null);
  assert.equal(I.relativeLuminance('#ffffff'), 1);
  assert.equal(I.relativeLuminance('#000000'), 0);
  assert.equal(I.contrastRatio('#000', '#fff'), 21);
  assert.equal(I.contrastRatio('#000', '#000'), 1);
  assert.equal(I.contrastRatio('nope', '#fff'), null);
  assert.equal(I.wcagLevel(4.54).aa, true);
  assert.equal(I.wcagLevel(2).aa, false);
  assert.equal(I.wcagLevel(7).aaa, true);
  assert.equal(I.wcagLevel(NaN), null);
});

/* ============================================================
 * 10. 文件指纹 / 字节工具 / 图片
 * ========================================================== */
const bytesOf = (...values) => new Uint8Array(values);
const textBytes = (text) => new TextEncoder().encode(text);

test('文件魔数识别', () => {
  assert.equal(I.sniffFile(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).ext, 'png');
  assert.equal(I.sniffFile(bytesOf(0xff, 0xd8, 0xff, 0xe0)).ext, 'jpg');
  assert.equal(I.sniffFile(textBytes('%PDF-1.7')).ext, 'pdf');
  assert.equal(I.sniffFile(bytesOf(0x50, 0x4b, 0x03, 0x04)).ext, 'zip');
  assert.equal(I.sniffFile(bytesOf(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70)).ext, 'mp4');
  assert.equal(I.sniffFile(textBytes('hello world')).ext, 'txt');
  assert.equal(I.sniffFile(bytesOf(1, 2, 3, 4, 250, 251)).known, false);
  assert.equal(I.sniffFile(new Uint8Array(0)).known, false);
});

test('字节熵 / 字符串 / Hex dump', () => {
  assert.equal(I.entropyOfBytes(new Uint8Array(0)), 0);
  assert.equal(I.entropyOfBytes(bytesOf(0, 0, 0, 0)), 0);
  const uniform = new Uint8Array(256);
  for (let i = 0; i < 256; i++) uniform[i] = i;
  assert.ok(Math.abs(I.entropyOfBytes(uniform) - 8) < 1e-9);
  const strings = I.printableStrings(textBytes('xxhello worldxx'), 4);
  assert.deepEqual(strings, ['xxhello worldxx']);
  assert.deepEqual(I.printableStrings(bytesOf(0, 65, 66, 67, 68, 0), 3), ['ABCD']);
  assert.deepEqual(I.printableStrings(bytesOf(0, 1, 2)), []);
  const dump = I.formatHexDump(textBytes('hello'), 16);
  assert.ok(dump.indexOf('68 65 6c 6c 6f') >= 0);
  assert.ok(dump.indexOf('hello') >= 0);
});

test('图片缩放与调色板', () => {
  assert.deepEqual(I.calcScaledSize(4000, 3000, 1600, 0), { w: 1600, h: 1200, scale: 0.4, scaled: true });
  assert.equal(I.calcScaledSize(800, 600, 1600, 1080).scaled, false);
  assert.equal(I.calcScaledSize(0, 100, 100, 100), null);
  assert.equal(I.calcScaledSize(100, 0, 100, 100), null);
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    255, 0, 0, 255,
    255, 0, 0, 255,
    0, 255, 0, 255
  ]);
  const palette = I.paletteFromPixels(pixels, 8);
  assert.equal(palette.length, 2);
  assert.equal(palette[0].hex, '#ff0000');
  assert.equal(palette[0].count, 3);
  assert.ok(Math.abs(palette[0].pct - 75) < 1e-9);
  assert.equal(palette[1].hex, '#00ff00');
  assert.deepEqual(I.paletteFromPixels(new Uint8ClampedArray(0)), []);
});

test('CRC32', () => {
  assert.equal(I.crc32(textBytes('123456789')), 0xcbf43926);
  assert.equal(I.crc32(new Uint8Array(0)), 0);
});

/* ============================================================
 * 11. 字幕
 * ========================================================== */
const SRT = [
  '1',
  '00:00:01,000 --> 00:00:02,500',
  'Hello',
  '',
  '2',
  '00:00:03,000 --> 00:00:04,000',
  'World',
  ''
].join('\n');

test('SRT 解析 / 序列化 / 转换', () => {
  const cues = I.parseSrt(SRT);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1000);
  assert.equal(cues[0].end, 2500);
  assert.equal(cues[0].text, 'Hello');
  assert.equal(cues[1].start, 3000);
  assert.deepEqual(I.parseSrt(''), []);
  assert.deepEqual(I.parseSrt('not a subtitle'), []);
  assert.equal(I.serializeSrt(cues), SRT);
  assert.equal(I.serializeSrt([]), '');
  assert.equal(I.parseTimecode('00:00:01,000'), 1000);
  assert.equal(I.parseTimecode('01:02:03.500'), 3723500);
  assert.equal(I.parseTimecode('bad'), null);
  assert.equal(I.parseTimecode('00:60:00,000'), null);
  assert.equal(I.formatTimecode(3661000), '01:01:01,000');
  assert.equal(I.formatTimecode(1500, '.'), '00:00:01.500');
  const vtt = I.srtToVtt(SRT);
  assert.equal(vtt.indexOf('WEBVTT'), 0);
  assert.ok(vtt.indexOf('00:00:01.000 --> 00:00:02.500') >= 0);
  assert.equal(I.srtToVtt(''), 'WEBVTT\n\n');
  assert.ok(I.vttToSrt(vtt).indexOf('00:00:01,000 --> 00:00:02,500') >= 0);
  assert.equal(I.vttToSrt('WEBVTT\n\n'), '');
});

test('字幕平移 / 双语合并 / 统计', () => {
  const shifted = I.parseSrt(I.shiftSrt(SRT, 1000));
  assert.equal(shifted[0].start, 2000);
  assert.equal(shifted[1].end, 5000);
  const clamped = I.parseSrt(I.shiftSrt(SRT, -999999));
  assert.equal(clamped[0].start, 0);
  assert.equal(I.shiftSrt('', 1000), '');
  const second = [
    '1',
    '00:00:01,000 --> 00:00:02,500',
    '你好',
    '',
    '2',
    '00:00:03,000 --> 00:00:04,000',
    '世界',
    ''
  ].join('\n');
  const merged = I.mergeBilingual(SRT, second);
  assert.ok(merged.indexOf('Hello\n你好') >= 0);
  assert.ok(merged.indexOf('World\n世界') >= 0);
  assert.equal(I.mergeBilingual('', second), '');
  const stats = I.srtStats(SRT);
  assert.equal(stats.cues, 2);
  assert.equal(stats.duration, 4000);
  assert.ok(stats.chars > 0);
  assert.equal(I.srtStats('').cues, 0);
});

/* ============================================================
 * 12. 重复文件
 * ========================================================== */
test('重复文件分组与可省空间', () => {
  const files = [
    { name: 'a.txt', size: 10, hash: 'x' },
    { name: 'b.txt', size: 10, hash: 'x' },
    { name: 'c.txt', size: 5, hash: 'y' }
  ];
  const groups = I.groupByHash(files);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].files.length, 2);
  assert.equal(groups[0].size, 10);
  assert.equal(I.wastedBytes(groups), 10);
  assert.equal(I.wastedBytes([]), 0);
  assert.deepEqual(I.groupByHash([]), []);
  assert.deepEqual(I.groupByHash(null), []);
  const twoGroups = I.groupByHash([
    { name: 'a', size: 2, hash: 'h1' },
    { name: 'b', size: 2, hash: 'h1' },
    { name: 'c', size: 3, hash: 'h2' },
    { name: 'd', size: 3, hash: 'h2' },
    { name: 'e', size: 3, hash: 'h2' }
  ]);
  assert.equal(twoGroups.length, 2);
  assert.equal(twoGroups[0].files.length, 3);
  assert.equal(I.wastedBytes(twoGroups), 2 + 6);
});
