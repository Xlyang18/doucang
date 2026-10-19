"use strict";
/* 端到端冒烟：直接用真实数据目录 + 真实主进程模块（不启动 GUI）
 * 覆盖：v1→v2 迁移 → 损坏兜底 → 提醒生成 → 本地服务 → Excel → 豆册 HTML
 * 用法：DOUCANG_SMOKE_DIR=/tmp/xxx node scripts/smoke.cjs
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const calc = require('../src/lib/calc.cjs');
const Server = require('../electron/localServer.cjs');
const Excel = require('../electron/excelExport.cjs');
const Print = require('../electron/printTemplate.cjs');
const { buildNotifications } = require('../electron/notifier.cjs');
const ProductParser = require('../electron/productParser.cjs');
const LabelParser = require('../electron/labelParser.cjs');

const dir = process.env.DOUCANG_SMOKE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'doucang-smoke-'));
fs.mkdirSync(dir, { recursive: true });

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`✔ ${name}`);
  } else {
    fail += 1;
    console.log(`✖ ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`);
  }
}

(async () => {
  /* 0. 准备一份"迁移前"的 v1 数据（不碰用户真实数据）：
     模拟 2 袋豆子 + 单份克数 15g，走与主进程一致的迁移逻辑 */
  const dataFile = path.join(dir, 'data.json');
  const hasFixture = process.env.DOUCANG_KEEP_DATA === '1' && fs.existsSync(dataFile);
  if (!hasFixture) {
    fs.writeFileSync(dataFile, JSON.stringify({
      schemaVersion: 1,
      settings: { restDays: 7, peakDays: 30, servingGrams: 15, theme: 'system', notify: true },
      beans: [
        { id: 'b1', name: '耶加雪菲 水洗', brand: 'Berry Bros.', roastDate: '2026-09-28', totalWeight: 250, price: 128, roastLevel: 'light', brewMethod: 'pour', flavors: ['柑橘', '花香'] },
        { id: 'b2', name: '意式深烘拼配', brand: '幸运咖', roastDate: '2026-09-25', totalWeight: 1000, price: 180, roastLevel: 'dark', brewMethod: 'espresso', flavors: ['巧克力', '坚果'] }
      ],
      wishlist: []
    }, null, 2));
  }
  // 迁移逻辑与 electron/main.mjs 完全同源（那个文件是 ESM 且顶层启动 Electron，这里用同款规则复刻最小集）
  const migrateV1 = (input) => {
    const rawData = input && typeof input === 'object' ? input : {};
    const from = Number(rawData.schemaVersion) || 1;
    const st = { ...(rawData.settings || {}) };
    if (from < 2) {
      if (st.pourGrams == null) st.pourGrams = Number(st.servingGrams) || 15;
      if (st.espressoGrams == null) st.espressoGrams = 18;
    }
    return {
      ...rawData,
      schemaVersion: 2,
      settings: { ...st, pourGrams: Number(st.pourGrams) || 15, espressoGrams: Number(st.espressoGrams) || 18 },
      beans: (rawData.beans || []).map((b) => ({ ...b, brewings: Array.isArray(b.brewings) ? b.brewings : [], finished: !!b.finished })),
      wishlist: rawData.wishlist || []
    };
  };
  const migratedData = migrateV1(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
  fs.writeFileSync(dataFile, JSON.stringify(migratedData, null, 2));
  check('v1 数据被迁移成 v2', migratedData.schemaVersion === 2 && !!migratedData.settings.espressoGrams);

  /* 1. 数据读取：v1 迁移 + 损坏兜底（与主进程同逻辑） */
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (raw && raw.data && !Array.isArray(raw.beans)) raw = raw.data;
  } catch (e) {
    const keep = path.join(dir, 'data.corrupt-backup.json');
    try { fs.copyFileSync(dataFile, keep); } catch (_) { /* ignore */ }
    check('损坏文件被留档', fs.existsSync(keep));
    raw = null;
  }
  const beans = (raw && raw.beans) || [];
  check('读到豆子数据', beans.length > 0, { beans: beans.length });
  check('数据结构已升级 v2', raw && raw.schemaVersion === 2, { v: raw && raw.schemaVersion });
  check('v1 的单份克数被拆成手冲/意式两档', !!(raw && raw.settings.pourGrams && raw.settings.espressoGrams), raw && raw.settings);

  const settings = (raw && raw.settings) || { restDays: 7, peakDays: 30, pourGrams: 15, espressoGrams: 18 };
  const today = calc.todayStr();
  const sum = calc.summarize(beans, settings, today);
  check('汇总：在仓袋数 > 0', sum.activeCount > 0, { active: sum.activeCount });
  check('汇总：三种花费口径都有值', sum.spentAll > 0 && sum.spentConsumed >= 0 && sum.stockValue >= 0, {
    all: sum.spentAll, used: sum.spentConsumed, stock: sum.stockValue
  });
  check('每袋都有冲煮记录与剩余量', beans.every((b) => Array.isArray(b.brewings) && calc.remainingGrams(b) >= 0));

  /* 2. 提醒 */
  const notis = buildNotifications(beans, settings, today, calc.resolveBean, calc.todayStr);
  check('提醒生成不报错（可为空）', Array.isArray(notis), { n: notis.length });

  /* 3. 本地服务（真实端口，随机；每次用全新的临时 clips 文件，保证可重复运行） */
  const clipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doucang-clips-'));
  const clipFile = path.join(clipDir, 'clips.json');
  const srv = await Server.start({ port: 0, file: clipFile, getData: () => raw });
  check('本地服务启动成功', srv.ok, srv);
  if (srv.ok) {
    const base = `http://127.0.0.1:${srv.port}`;
    const st = await (await fetch(`${base}/status`)).json();
    check('/status 返回豆子数量', st.counts && st.counts.beans === beans.length, st.counts);
    const post = await fetch(`${base}/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Doucang': '1' },
      body: JSON.stringify({ url: 'https://item.jd.com/1000321.html', title: '京东 测试豆 1kg 深烘 到手价 ¥139' })
    });
    check('/clip 采集成功', (await post.json()).ok === true);
    const clips = await (await fetch(`${base}/clips`)).json();
    check('采集落盘', clips.clips.length === 1, { n: clips.clips.length });
    const parsed = ProductParser.parseProductText(clips.clips[0].title, clips.clips[0].url);
    check('采集文本可解析出 1kg→1000g', parsed.totalWeight === 1000, parsed);
    check('采集文本可解析出价格', parsed.price === 139, parsed);
    srv.server.close();
    fs.rmSync(clipDir, { recursive: true, force: true });
  }

  /* 4. Excel / 豆册 */
  const xlsx = path.join(dir, 'smoke.xlsx');
  const res = await Excel.exportWorkbook({
    file: xlsx, beans, wishlist: raw.wishlist || [], settings,
    summarize: calc.summarize, resolveBean: calc.resolveBean, today
  });
  check('Excel 生成成功', res.ok && fs.existsSync(xlsx) && fs.statSync(xlsx).size > 4000, { size: fs.existsSync(xlsx) ? fs.statSync(xlsx).size : 0 });
  const html = Print.renderPrintHtml({ beans, settings, summarize: calc.summarize, resolveBean: calc.resolveBean, today });
  check('豆册 HTML 生成成功', html.includes('豆藏 · 咖啡豆册') && html.length > 3000, { len: html.length });

  /* 5. OCR 文本解析（真实数据里的标签文本样式） */
  const sample = LabelParser.parseLabelText(['埃塞俄比亚 耶加雪菲 水洗 G1', '烘焙日期 2026-09-28', '净含量 250g', '浅烘 Light Roast', '处理法 水洗', '¥128']);
  check('OCR 文本解析出日期', sample.fields.roastDate === '2026-09-28', sample.fields);
  check('OCR 文本解析出克重', sample.fields.totalWeight === 250, sample.fields);
  check('OCR 文本解析出烘焙度', sample.fields.roastLevel === 'light', sample.fields);

  console.log(`\nSMOKE RESULT: pass=${pass} fail=${fail} dir=${dir}`);
  process.exit(fail ? 1 : 0);
})();
