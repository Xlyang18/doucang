// ESM 入口（package.json "type": "module" 下 electron 可正常加载）
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell, Menu, clipboard, Notification } = require('electron');


// 测试/开发用：可通过环境变量覆盖数据目录，避免污染真实数据
if (process.env.DOUCANG_DATA_DIR) {
  app.setPath('userData', process.env.DOUCANG_DATA_DIR);
}

const calc = require('../src/lib/calc.cjs');
const Server = require('./localServer.cjs');
const ProductParser = require('./productParser.cjs');
const LabelParser = require('./labelParser.cjs');
const Ocr = require('./ocr/ocrBridge.cjs');
const Excel = require('./excelExport.cjs');
const Print = require('./printTemplate.cjs');
const { Notifier } = require('./notifier.cjs');

/* ---------- 数据结构与迁移 ---------- */
const SCHEMA_VERSION = 2;
const DEFAULT_SETTINGS = () => ({
  restDays: 7,
  peakDays: 30,
  servingGrams: 18,
  pourGrams: 15,
  espressoGrams: 18,
  immersionGrams: 20,
  theme: 'system',
  overdueNotify: true,
  servicePort: 47823
});
const DEFAULT_TAGS = ['花香', '果酸', '莓果', '柑橘', '坚果', '焦糖', '巧克力', '可可', '奶油', '蜂蜜', '酒香', '烟熏', '茶感', '香料', '红糖', '乌龙'];
const ROASTS = ['light', 'medium', 'dark'];
const METHODS = ['pour', 'espresso', 'immersion'];

const uid = () => {
  const g = globalThis;
  return g.crypto && g.crypto.randomUUID ? g.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

function normalizeBrewing(b = {}) {
  return {
    id: b.id || uid(),
    date: str(b.date),
    grams: num(b.grams),
    method: METHODS.includes(b.method) ? b.method : 'pour',
    dose: num(b.dose),
    ratio: str(b.ratio),
    rating: b.rating || null,
    note: str(b.note)
  };
}

function normalizeBean(b = {}) {
  return {
    id: b.id || uid(),
    brand: str(b.brand),
    name: str(b.name),
    flavors: arr(b.flavors),
    roastLevel: ROASTS.includes(b.roastLevel) ? b.roastLevel : 'medium',
    roastDate: str(b.roastDate),
    purchaseDate: str(b.purchaseDate),
    price: num(b.price),
    totalWeight: num(b.totalWeight),
    rating: b.rating || null,
    notes: str(b.notes),
    brewMethod: METHODS.includes(b.brewMethod) ? b.brewMethod : 'pour',
    restDaysOverride: numOrNull(b.restDaysOverride),
    peakDaysOverride: numOrNull(b.peakDaysOverride),
    origin: str(b.origin),
    processor: str(b.processor),
    variety: str(b.variety),
    altitude: str(b.altitude),
    retailer: str(b.retailer),
    productUrl: str(b.productUrl),
    overdueNotify: b.overdueNotify === undefined ? true : !!b.overdueNotify,
    brewings: arr(b.brewings).map(normalizeBrewing),
    finishedWeight: numOrNull(b.finishedWeight),
    finished: !!b.finished,
    finishedDate: str(b.finishedDate),
    createdAt: b.createdAt || new Date().toISOString(),
    updatedAt: b.updatedAt || new Date().toISOString()
  };
}

function normalizeWish(w = {}) {
  return {
    id: w.id || uid(),
    brand: str(w.brand),
    name: str(w.name),
    flavors: arr(w.flavors),
    roastLevel: ROASTS.includes(w.roastLevel) ? w.roastLevel : 'medium',
    price: num(w.price),
    totalWeight: num(w.totalWeight),
    notes: str(w.notes),
    brewMethod: METHODS.includes(w.brewMethod) ? w.brewMethod : 'pour',
    targetPrice: numOrNull(w.targetPrice),
    productUrl: str(w.productUrl),
    retailer: str(w.retailer),
    rebuyFrom: str(w.rebuyFrom),
    rebuyCount: num(w.rebuyCount),
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: w.updatedAt || new Date().toISOString()
  };
}

/** v1 → v2 迁移（幂等），任何残缺数据都能补齐 */
function migrate(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const from = Number(raw.schemaVersion) || 1;
  const settings = { ...DEFAULT_SETTINGS(), ...(raw.settings || {}) };
  if (from < 2) {
    if (settings.pourGrams == null) settings.pourGrams = num(settings.servingGrams) || 15;
    if (settings.espressoGrams == null) settings.espressoGrams = 18;
  }
  const flavorTags = arr(raw.flavorTags).filter((t) => typeof t === 'string');
  const data = {
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    settings: {
      ...settings,
      restDays: num(settings.restDays) || 7,
      peakDays: num(settings.peakDays) || 30,
      pourGrams: num(settings.pourGrams) || 15,
      espressoGrams: num(settings.espressoGrams) || 18,
      immersionGrams: num(settings.immersionGrams) || 20,
      servingGrams: num(settings.servingGrams) || 18,
      theme: ['system', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'system',
      overdueNotify: settings.overdueNotify === undefined ? true : !!settings.overdueNotify,
      servicePort: num(settings.servicePort) || 47823
    },
    flavorTags: flavorTags.length ? flavorTags : [...DEFAULT_TAGS],
    beans: arr(raw.beans).filter((b) => b && typeof b === 'object').map(normalizeBean),
    wishlist: arr(raw.wishlist).filter((w) => w && typeof w === 'object').map(normalizeWish),
    wishHistory: arr(raw.wishHistory),
    clips: arr(raw.clips),
    logs: arr(raw.logs).slice(0, 500)
  };
  const tagSet = new Set(data.flavorTags);
  for (const b of [...data.beans, ...data.wishlist]) for (const f of b.flavors) tagSet.add(f);
  data.flavorTags = [...tagSet];
  return { data, migrated: from < SCHEMA_VERSION || !raw.schemaVersion, from };
}

/* ---------- 读写 ---------- */
function dataFile() {
  return path.join(app.getPath('userData'), 'data.json');
}
function backupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

let lastLoadError = null;

function loadData() {
  const file = dataFile();
  lastLoadError = null;
  if (!fs.existsSync(file)) return migrate(null).data;
  let raw;
  let keepPath = null;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // 兼容备份外壳格式 {app, appVersion, data:{...}}（用户可能直接把备份改名成 data.json）
    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.beans)) {
      raw = raw.data;
    }
  } catch (e) {
    // 损坏兜底：把原文件改名留档，绝不在"空数据"状态下覆盖用户的老文件
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const keep = path.join(app.getPath('userData'), `data.corrupt-${ts}.json`);
    try {
      fs.copyFileSync(file, keep);
      keepPath = keep;
      lastLoadError = { type: 'corrupt', keptAt: keep, message: e.message };
    } catch (err) {
      lastLoadError = { type: 'corrupt', message: e.message };
    }
    return migrate(null).data;
  }
  const { data, migrated, from } = migrate(raw);
  if (migrated) {
    try {
      // 覆盖前先留一份原文件，迁移出错也能找回
      if (!keepPath) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const keep = path.join(app.getPath('userData'), `data.pre-v${SCHEMA_VERSION}-${ts}.json`);
        try { fs.copyFileSync(file, keep); } catch (e) { /* ignore */ }
      }
      saveData(data);
      log(`数据结构升级 v${from} → v${SCHEMA_VERSION}`);
    } catch (e) { /* ignore */ }
  }
  return data;
}

function saveData(data) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** 每天一份滚动备份，保留最近 20 天 */
function autoBackup(data) {
  try {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true });
    const name = `data-${new Date().toISOString().slice(0, 10)}.json`;
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, JSON.stringify(data, null, 2));
    const files = fs.readdirSync(dir).filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    while (files.length > 20) fs.unlinkSync(path.join(dir, files.shift()));
  } catch (e) { /* ignore */ }
}

function log(message) {
  try {
    const file = path.join(app.getPath('userData'), 'activity.log');
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) { /* ignore */ }
}

/* ---------- 窗口 ---------- */
let win = null;
let liveCache = null; // 渲染层实时快照，供本地服务与提醒使用
let notifier = null;
let serverInfo = null;

function getLive() {
  if (liveCache && liveCache.data) return liveCache.data;
  return loadData();
}

function createWindow() {
  const initial = loadData();
  nativeTheme.themeSource = initial.settings.theme || 'system';

  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: '豆藏',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (lastLoadError && lastLoadError.type === 'corrupt') {
    win.webContents.once('did-finish-load', () => {
      dialog.showMessageBox(win, {
        type: 'warning',
        title: '数据文件读取失败',
        message: '原数据文件已损坏，已自动改名留档，本次以空数据启动。',
        detail: `${lastLoadError.message}\n留档位置：${lastLoadError.keptAt || '（改名失败）'}`
      });
    });
  }
}

function showWindow() {
  if (!win || win.isDestroyed()) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  notifier = new Notifier({
    getState: () => {
      const d = getLive();
      return { beans: d.beans || [], settings: d.settings || {} };
    },
    resolveBean: calc.resolveBean,
    todayStr: calc.todayStr,
    showWindow,
    log
  }).start();

  startServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function startServer() {
  try {
    const data = loadData();
    const port = data.settings.servicePort || 47823;
    serverInfo = await Server.start({
      port,
      file: path.join(app.getPath('userData'), 'clips.json'),
      getData: getLive,
      onClip: (item) => {
        if (win && !win.isDestroyed()) win.webContents.send('clip:new', item);
      },
      onNotes: (payload) => {
        if (win && !win.isDestroyed()) win.webContents.send('clip:new', { ...payload, source: 'extension-notes' });
      },
      log
    });
    if (serverInfo.ok) log(`本地抓取服务已启动 :${serverInfo.port}`);
  } catch (e) {
    log(`本地服务启动失败：${e.message}`);
  }
}

/* ---------- 菜单 ---------- */
function send(channel, payload) {
  if (win && !win.isDestroyed()) {
    showWindow();
    win.webContents.send(channel, payload);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '从链接添加豆子…', accelerator: 'CmdOrCtrl+Shift+V', click: () => send('menu', 'import-link') },
        { label: '从剪贴板添加豆子', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('menu', 'import-clipboard') },
        { label: '拍照识别包装…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('menu', 'ocr') },
        { type: 'separator' },
        { label: '导出备份（JSON）', click: () => send('menu', 'export') },
        { label: '导入备份（JSON）', click: () => send('menu', 'import') },
        { type: 'separator' },
        { label: '导出 Excel…', accelerator: 'CmdOrCtrl+E', click: () => send('menu', 'export-excel') },
        { label: '导出豆册 PDF…', accelerator: 'CmdOrCtrl+P', click: () => send('menu', 'print') },
        { label: '豆册打印预览…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('menu', 'print-preview') },
        { label: '导出本季分享卡片…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu', 'share') },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },
    { role: 'editMenu', label: '编辑' },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    { role: 'windowMenu', label: '窗口' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- IPC ---------- */
ipcMain.handle('data:load', () => ({ data: loadData(), loadError: lastLoadError }));

ipcMain.handle('data:save', (_e, data) => {
  const clean = migrate(data).data;
  saveData(clean);
  autoBackup(clean);
  liveCache = { data: clean };
  if (notifier) notifier.tick();
  return true;
});

/** 渲染层每次变更后推送最新快照（供本地服务 / 提醒 / 导出使用） */
ipcMain.handle('data:sync', (_e, data) => {
  liveCache = { data };
  return true;
});

ipcMain.handle('data:export', async (_e, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出备份',
    defaultPath: `豆藏备份-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, JSON.stringify({
    app: '豆藏', appVersion: app.getVersion(), schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(), data
  }, null, 2));
  log(`导出备份：${path.basename(filePath)}`);
  return { canceled: false, filePath };
});

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入备份恢复数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (canceled || !filePaths.length) return { canceled: true };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  } catch (e) {
    return { canceled: false, error: '文件不是有效的 JSON，无法导入' };
  }
  const payload = parsed && typeof parsed === 'object' && parsed.data ? parsed.data : parsed;
  return { canceled: false, filePath: filePaths[0], data: migrate(payload).data };
});

ipcMain.handle('settings:setTheme', (_e, theme) => {
  nativeTheme.themeSource = theme || 'system';
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('app:dataDir', () => app.getPath('userData'));

/* 自动备份 */
ipcMain.handle('backup:list', () => {
  try {
    const dir = backupDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => ({
      name: f,
      path: path.join(dir, f),
      size: fs.statSync(path.join(dir, f)).size
    }));
  } catch (e) {
    return [];
  }
});

ipcMain.handle('backup:restore', async (_e, filePath) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const data = migrate(parsed.data || parsed).data;
    saveData(data);
    liveCache = { data };
    log(`从自动备份恢复：${path.basename(filePath)}`);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('backup:reveal', () => shell.openPath(backupDir()));

/* 活动日志 */
ipcMain.handle('logs:read', () => {
  try {
    const file = path.join(app.getPath('userData'), 'activity.log');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-400).reverse();
  } catch (e) {
    return [];
  }
});

/* ---------- 链接解析 / 剪贴板 / 采集 ---------- */

function parseLink(text) {
  const raw = String(text || '').trim();
  const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/);
  const url = urlMatch ? urlMatch[0] : '';
  const parsed = ProductParser.parseProductText(raw, url);
  return {
    ok: true,
    url,
    retailer: parsed.retailer,
    host: ProductParser.hostOf(url),
    productId: ProductParser.productIdOf(url),
    fields: {
      brand: parsed.brand,
      name: parsed.name,
      price: parsed.price,
      totalWeight: parsed.totalWeight,
      roastDate: parsed.roastDate,
      roastLevel: parsed.roastLevel,
      processor: parsed.processor,
      origin: parsed.origin,
      flavors: parsed.flavors,
      altitude: parsed.altitude,
      variety: parsed.variety,
      retailer: parsed.retailer,
      productUrl: url
    },
    rawText: raw.slice(0, 2000)
  };
}

ipcMain.handle('link:parse', (_e, text) => parseLink(text));
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

/** 读取扩展采集的商品页（clips.json） */
ipcMain.handle('clip:list', () => {
  try {
    return Server.readClips(path.join(app.getPath('userData'), 'clips.json'), 20);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('clip:openGuide', () => {
  const extDir = path.join(__dirname, '..', 'extension');
  if (fs.existsSync(extDir)) return shell.openPath(extDir);
  return shell.openPath(app.getPath('userData'));
});

ipcMain.handle('server:status', () => ({
  ok: !!(serverInfo && serverInfo.ok),
  port: (serverInfo && serverInfo.port) || (loadData().settings.servicePort || 47823),
  error: serverInfo && serverInfo.error
}));

/* ---------- OCR ---------- */

ipcMain.handle('ocr:pickImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '选择包装照片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'heic', 'webp', 'tiff'] }]
  });
  if (canceled || !filePaths.length) return { canceled: true };
  return { canceled: false, filePath: filePaths[0] };
});

ipcMain.handle('ocr:recognize', async (_e, filePath) => {
  const appRoot = path.join(__dirname, '..');
  const started = Date.now();
  const res = await Ocr.recognize(filePath, appRoot);
  if (!res.ok) return { ok: false, error: res.error };
  const lines = (res.lines || []).map((l) => l.text);
  const parsedText = LabelParser.parseLabelText(lines);
  const parsedJoined = LabelParser.parseLabelText(lines.join('\n'));
  const score = (o) => Object.entries(o.fields).filter(([, v]) => (Array.isArray(v) ? v.length : v)).length;
  const best = score(parsedJoined) > score(parsedText) ? parsedJoined : parsedText;
  log(`OCR 识别：${path.basename(filePath)}（${lines.length} 行 / ${Date.now() - started}ms）`);
  return {
    ok: true,
    elapsed: Date.now() - started,
    lines: res.lines || [],
    fields: best.fields,
    confidence: best.confidence
  };
});

/* ---------- 导出 / 打印 / 分享 ---------- */

ipcMain.handle('export:excel', async (_e, data, today) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出 Excel 台账',
    defaultPath: `豆藏台账-${today || calc.todayStr()}.xlsx`,
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  const res = await Excel.exportWorkbook({
    file: filePath, beans: data.beans || [], wishlist: data.wishlist || [], settings: data.settings || {},
    summarize: calc.summarize, resolveBean: calc.resolveBean, today: today || calc.todayStr()
  });
  log(`导出 Excel：${path.basename(filePath)}`);
  return { canceled: false, ...res };
});

function printHtmlOf(data, today) {
  return Print.renderPrintHtml({
    beans: data.beans || [],
    settings: data.settings || {},
    summarize: calc.summarize,
    resolveBean: calc.resolveBean,
    today: today || calc.todayStr()
  });
}

ipcMain.handle('export:print', async (_e, data, today) => {
  const html = printHtmlOf(data, today);
  const pw = new BrowserWindow({
    width: 900, height: 1200, show: false, title: '豆册预览',
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  try {
    await pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await pw.webContents.printToPDF({
      printBackground: true, pageSize: 'A4', margins: { marginType: 'default' }, preferCSSPageSize: true
    });
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存豆册 PDF',
      defaultPath: `豆藏豆册-${today || calc.todayStr()}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, pdf);
    log(`导出豆册 PDF：${path.basename(filePath)}`);
    return { canceled: false, filePath };
  } finally {
    pw.destroy();
  }
});

ipcMain.handle('export:printPreview', async (_e, data, today) => {
  const html = printHtmlOf(data, today);
  const pw = new BrowserWindow({ width: 940, height: 1180, title: '豆册预览 · 可直接打印', backgroundColor: '#ffffff' });
  await pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return { ok: true };
});

/** 保存分享卡片 PNG（渲染层画好 → ArrayBuffer → 这里落盘） */
ipcMain.handle('share:savePng', async (_e, name, bytes) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '保存分享卡片',
    defaultPath: name || `豆藏分享-${calc.todayStr()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, Buffer.from(bytes));
  log(`导出分享卡片：${path.basename(filePath)}`);
  return { canceled: false, filePath };
});

ipcMain.handle('notify:test', () => {
  if (!notifier) return { ok: false };
  const fired = notifier.tick(true);
  if (!fired.length) {
    new Notification({ title: '豆藏 · 提醒已就绪', body: '当前没有到期的养豆 / 赏味提醒。' }).show();
  }
  return { ok: true, fired };
});

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (/^https?:\/\//.test(String(url))) shell.openExternal(url);
  return true;
});
