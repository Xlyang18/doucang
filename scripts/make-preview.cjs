#!/usr/bin/env node
/* 生成「预览页」：把 dist 的内联资源 + 模拟 Electron API 拼成一个纯静态 HTML，
 * 方便在普通浏览器里检查渲染层（Electron 窗口无法截图时用）。
 * 用法：node scripts/make-preview.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, '.preview');

const seedPath = process.env.SEED || '/tmp/visiontest/data-real.json';
let seed = {};
try {
  seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  seed = seed.data || seed;
} catch (e) {
  seed = { schemaVersion: 2, settings: { theme: 'system' }, flavorTags: [], beans: [], wishlist: [] };
}

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const assetUrl = (rel) => path.join(distDir, rel.replace(/^\.?\//, ''));
const cssFiles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
const jsFiles = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);

const css = cssFiles.map((f) => `<style>${fs.readFileSync(assetUrl(f), 'utf8')}</style>`).join('\n');
const js = jsFiles.map((f) => fs.readFileSync(assetUrl(f), 'utf8')).join('\n');
const mock = fs.readFileSync(path.join(outDir, 'mock-preload.js'), 'utf8');

const page = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>豆藏预览</title>
<script>window.onerror = function (m, s, l) { document.title = 'ERR: ' + m; console.error(m); };</script>
${css}
</head><body>
<div id="root"></div>
<script>window.__dcSeed = ${JSON.stringify(seed).replace(/<\//g, '<\\/')};</script>
<script>${mock}</script>
<script type="module">${js}</script>
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), page);
console.log('preview ->', path.join(outDir, 'index.html'), (page.length / 1024).toFixed(0) + 'KB');
