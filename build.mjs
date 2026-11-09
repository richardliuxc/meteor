#!/usr/bin/env node
/**
 * OmniGet Studio · 构建脚本
 * 把 src/ 下的 CSS/JS 全部内联进单个 HTML 文件。
 *
 *   node build.mjs              → dist/OmniGet-Studio.html（浏览器单文件版）
 *   node build.mjs --android    → 同时生成 android/assets/index.html（APK 内嵌）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const ANDROID_ASSETS = path.join(ROOT, 'android', 'assets');

const isAndroid = process.argv.includes('--android');

const modules = isAndroid
  ? ['core.js', 'engine.js', 'tools.js', 'local-engine.js', 'android-bridge.js', 'views.js']
  : ['core.js', 'engine.js', 'tools.js', 'local-engine.js', 'views.js'];

const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

let js = '';
js += `/* ---- Meteor bootstrap ---- */
window.__OG_MODULE_ERRORS__ = window.__OG_MODULE_ERRORS__ || [];
try {
  window.addEventListener('error', function (e) {
    try {
      window.__OG_MODULE_ERRORS__.push({ m: 'window', e: String((e.error && (e.error.stack || e.error.message)) || e.message || '') });
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', function (e) {
    try {
      window.__OG_MODULE_ERRORS__.push({ m: 'promise', e: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || '') });
    } catch (_) {}
  });
} catch (_) {}
`;

const loaded = [];
for (const name of modules) {
  const file = path.join(SRC, name);
  if (!fs.existsSync(file)) {
    console.warn(`[build] 跳过缺失模块: ${name}`);
    continue;
  }
  if (name === 'engine.js' && !fs.existsSync(file)) {
    console.warn('[build] 警告: engine.js 缺失，下载功能将不可用');
  }
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('</script')) {
    console.warn(`[build] ${name} 中含 </script 字符串，已转义`);
    code = code.replace(/<\/script/gi, '<\\/script');
  }
  // 每个模块包一层 try/catch：单个模块异常不再阻断后续模块，界面仍可导航
  js += `\n/* ===== ${name} ===== */\n(function(){try{\n` + code +
    `\n}catch(__ogE){\n  try{\n    (window.__OG_MODULE_ERRORS__=window.__OG_MODULE_ERRORS__||[]).push({m:'${name}',e:String((__ogE&&__ogE.stack)||__ogE)});\n    if(window.console)console.error('[Meteor module] ${name}',__ogE);\n  }catch(_){}\n}})();\n`;
  loaded.push(name);
}

const shell = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
if (!shell.includes('/*__OG_STYLES__*/') || !shell.includes('/*__OG_SCRIPTS__*/')) {
  throw new Error('index.html 缺少占位符 /*__OG_STYLES__*/ 或 /*__OG_SCRIPTS__*/');
}

const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
const banner = `<!-- Meteor ${process.env.npm_package_version || '1.1.0'} · built ${stamp} · modules: ${loaded.join(', ')} -->`;
let html = shell
  .replace('/*__OG_STYLES__*/', () => css)
  .replace('/*__OG_SCRIPTS__*/', () => js)
  .replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
fs.mkdirSync(DIST, { recursive: true });
if (isAndroid) {
  fs.mkdirSync(ANDROID_ASSETS, { recursive: true });
  const assetOut = path.join(ANDROID_ASSETS, 'index.html');
  fs.writeFileSync(assetOut, html, 'utf8');
  console.log(`[build] ${loaded.length} 个模块 → ${path.relative(ROOT, assetOut)} (${kb} KB)`);
} else {
  const out = path.join(DIST, 'Meteor.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log(`[build] ${loaded.length} 个模块 → ${path.relative(ROOT, out)} (${kb} KB)`);
}
