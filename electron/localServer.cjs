"use strict";
/* 豆藏本地服务 · 供浏览器扩展（剪贴板捕获 / 页面采集）使用
 * 只监听 127.0.0.1，默认端口 47823；带 Origin 白名单与自定义头校验，防止任意网页跨域写入。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 47823;
const ALLOWED_ORIGIN_PREFIXES = [
  'chrome-extension://', 'moz-extension://', 'safari-web-extension://', 'safari-extension://'
];
const ALLOWED_HOSTS = new Set(['detail.tmall.com', 'item.taobao.com', 'world.taobao.com', 'www.taobao.com', 'item.jd.com', 'detail.tmall.hk']);

function isAllowedOrigin(origin) {
  if (!origin) return true; // 扩展 background 有时不带 Origin，仍要求 X-Doucang 头
  if (origin === 'null') return true;
  if (origin.startsWith('file://')) return true;
  return ALLOWED_ORIGIN_PREFIXES.some((p) => origin.startsWith(p));
}

function readClips(file, limit = 50) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).slice(0, limit);
  } catch (e) {
    return [];
  }
}

function writeClips(file, list) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list.slice(0, 200), null, 2));
  fs.renameSync(tmp, file);
}

/**
 * start({ port, file, onClip, getData })
 * - onClip(item): 新采集写入后的回调（用于刷新渲染层）
 * - getData(): 返回最新整库快照，供 /status 使用
 */
function start({ port = DEFAULT_PORT, file, onClip, getData, onNotes, log } = {}) {
  const server = http.createServer((req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': req.headers.origin && isAllowedOrigin(req.headers.origin) ? req.headers.origin : '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Doucang',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(obj));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Doucang',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      });
      res.end();
      return;
    }

    if (!isAllowedOrigin(req.headers.origin)) return send(403, { ok: false, error: 'origin not allowed' });

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/status') {
      let data = null;
      try { data = getData ? getData() : null; } catch (e) { /* ignore */ }
      return send(200, {
        ok: true,
        app: '豆藏',
        version: 2,
        counts: data ? { beans: (data.beans || []).length, wishlist: (data.wishlist || []).length, clips: (data.clips || []).length } : null,
        time: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/clips') {
      return send(200, { ok: true, clips: readClips(file) });
    }

    if (req.method === 'GET' && url.pathname === '/beans') {
      const data = getData ? getData() : {};
      return send(200, {
        ok: true,
        beans: (data.beans || []).map((b) => ({
          id: b.id, brand: b.brand, name: b.name, origin: b.origin, processor: b.processor,
          roastDate: b.roastDate, price: b.price, totalWeight: b.totalWeight, flavors: b.flavors
        }))
      });
    }

    if (req.method === 'POST' && (url.pathname === '/clip' || url.pathname === '/notes')) {
      if (!req.headers['x-doucang']) return send(403, { ok: false, error: 'missing X-Doucang header' });
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 256 * 1024) req.destroy();
      });
      req.on('end', () => {
        let payload;
        try { payload = JSON.parse(body || '{}'); } catch (e) { return send(400, { ok: false, error: 'bad json' }); }
        const pageUrl = String(payload.url || '');
        let host = '';
        try { host = new URL(pageUrl).host; } catch (e) { host = ''; }
        if (url.pathname === '/clip' && pageUrl && !ALLOWED_HOSTS.has(host) && !/taobao|tmall|jd\.com/.test(host)) {
          return send(400, { ok: false, error: `unsupported host: ${host}` });
        }
        if (url.pathname === '/notes') {
          try { if (onNotes) onNotes(payload); } catch (e) { /* ignore */ }
          return send(200, { ok: true });
        }
        const item = {
          id: `clip-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          url: pageUrl,
          host,
          title: String(payload.title || '').slice(0, 300),
          text: String(payload.text || '').slice(0, 20000),
          image: typeof payload.image === 'string' && payload.image.startsWith('data:image/') ? payload.image.slice(0, 4 * 1024 * 1024) : '',
          source: String(payload.source || 'extension'),
          createdAt: new Date().toISOString(),
          handled: false
        };
        const list = readClips(file);
        list.unshift(item);
        writeClips(file, list);
        if (log) log(`采集：${item.title || item.host}`);
        if (onClip) { try { onClip(item); } catch (e) { /* ignore */ } }
        send(200, { ok: true, id: item.id });
      });
      return;
    }

    send(404, { ok: false, error: 'not found' });
  });

  return new Promise((resolve) => {
    server.on('error', (err) => resolve({ ok: false, error: err.message }));
    server.listen(port, '127.0.0.1', () => {
      resolve({ ok: true, port: server.address().port, server });
    });
  });
}

module.exports = { start, DEFAULT_PORT, readClips, writeClips };
