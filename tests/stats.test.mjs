import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ROAST_COLORS, recentMonths, brandRanking, roastMatrix, flavorMatrix, monthlyFlow,
  repurchaseStats, paceStats, ratingBoard, seasonSummary
} from '../src/lib/stats.js';

const require = createRequire(import.meta.url);
const calc = require('../src/lib/calc.cjs');
const Server = require('../electron/localServer.cjs');
const Excel = require('../electron/excelExport.cjs');
const Ocr = require('../electron/ocr/ocrBridge.cjs');

const SETTINGS = { restDays: 7, peakDays: 30, pourGrams: 15, espressoGrams: 18 };
const TODAY = '2026-10-19';

const BEANS = [
  {
    id: 'b1', brand: 'Manner', name: '耶加雪菲', flavors: ['花香', '柑橘'], roastLevel: 'light',
    roastDate: '2026-09-28', purchaseDate: '2026-10-01', price: 128, totalWeight: 250, rating: 5,
    brewMethod: 'pour', brewings: [
      { grams: 15, date: '2026-10-02' }, { grams: 15, date: '2026-10-05' },
      { grams: 15, date: '2026-10-09' }, { grams: 15, date: '2026-10-12' }, { grams: 15, date: '2026-10-16' }
    ]
  },
  {
    id: 'b2', brand: 'Manner', name: '耶加雪菲', flavors: ['花香', '柑橘'], roastLevel: 'light',
    roastDate: '2026-08-01', purchaseDate: '2026-08-03', price: 128, totalWeight: 250, rating: 4,
    finished: true, finishedDate: '2026-08-25', finishedWeight: 250, brewMode: 'pour',
    brewMethod: 'pour', brewings: [{ grams: 250, date: '2026-08-24' }]
  },
  {
    id: 'b3', brand: '幸运咖', name: '意式深烘', flavors: ['巧克力', '坚果'], roastLevel: 'dark',
    roastDate: '2026-09-25', purchaseDate: '2026-09-27', price: 99, totalWeight: 1000, rating: 3,
    brewMethod: 'espresso', brewings: [{ grams: 18, date: '2026-10-03' }, { grams: 18, date: '2026-10-10' }]
  },
  {
    id: 'b4', brand: '治光师', name: '云南保山', flavors: ['蜂蜜', '茶感'], roastLevel: 'medium',
    roastDate: '2026-10-14', purchaseDate: '2026-10-15', price: 88, totalWeight: 250, rating: null,
    brewMethod: 'pour', brewings: []
  }
];

/* ---------- 统计聚合 ---------- */

test('统计 · recentMonths 返回连续 N 个月', () => {
  const m = recentMonths(12, '2026-10-19');
  assert.equal(m.length, 12);
  assert.equal(m[0], '2025-11');
  assert.equal(m[11], '2026-10');
});

test('统计 · 品牌排行按花费降序，并算平均评分', () => {
  const r = brandRanking(BEANS, SETTINGS, TODAY);
  assert.equal(r[0].brand, 'Manner');
  assert.equal(r[0].bags, 2);
  assert.equal(r[0].spent, 256);
  assert.equal(r[0].avgRating, 4.5);
  assert.equal(r.find((x) => x.brand === '幸运咖').bags, 1);
});

test('统计 · 烘焙度 × 评分', () => {
  const sum = calc.summarize(BEANS, SETTINGS, TODAY);
  const m = roastMatrix(sum.rows);
  const light = m.find((x) => x.key === 'light');
  assert.equal(light.bags, 2);
  assert.equal(light.avgRating, 4.5);
  const dark = m.find((x) => x.key === 'dark');
  assert.equal(dark.avgRating, 3);
});

test('统计 · 风味 × 评分（按平均分降序）', () => {
  const f = flavorMatrix(BEANS);
  assert.equal(f[0].avgRating, 4.5);
  const honey = f.find((x) => x.tag === '蜂蜜');
  assert.equal(honey.n, 1);
  assert.equal(honey.avgRating, 0); // 未评分按 0 计
});

test('统计 · 月度流动：购入按购买月，消耗按冲煮月', () => {
  const months = recentMonths(3, TODAY); // 2026-08, 09, 10
  const flow = monthlyFlow(BEANS, months);
  const oct = flow.find((f) => f.key === '2026-10');
  assert.equal(oct.buy, 128 + 88);
  assert.equal(oct.grams, 75 + 36);
  assert.equal(oct.cups, 7);
  const aug = flow.find((f) => f.key === '2026-08');
  assert.equal(aug.buy, 128);
});

test('统计 · 复购率：同一品牌+名字买过两次', () => {
  const r = repurchaseStats(BEANS);
  assert.equal(r.totalSkus, 3);
  assert.equal(r.repeatedSkus, 1);
  assert.equal(r.rate, 33.3);
  assert.equal(r.repeated[0].name, '耶加雪菲');
  assert.equal(r.repeated[0].bags, 2);
});

test('统计 · 喝的速度与库存可撑天数', () => {
  const p = paceStats(BEANS, SETTINGS, TODAY);
  assert.equal(p.totalCups, 8);
  assert.equal(p.from, '2026-08-24');
  assert.equal(p.to, '2026-10-16');
  assert.ok(p.cupsPerDay > 0);
  assert.equal(p.avgDaysPerBag, 24);
  assert.ok(p.daysLeft === null || p.daysLeft > 0);
});

test('统计 · 评分榜排序 & 本季总结', () => {
  const board = ratingBoard(BEANS, SETTINGS, TODAY);
  assert.equal(board[0].bean.rating, 5);
  const s = seasonSummary(BEANS, SETTINGS, TODAY, 3);
  assert.equal(s.end, TODAY);
  assert.ok(s.cups >= 6);
  assert.ok(s.topFlavors.length > 0);
  assert.equal(s.best.rating, 5);
  assert.ok(s.reorderList.length >= 2, '应能列出本季喝过的豆子，供分享卡片展示');
  assert.equal(s.reorderList[0].brand, 'Manner');
});

/* ---------- 本地服务（真实 HTTP） ---------- */

test('服务 · 真实收发：/clip 入库、/status、/clips、非法 host 拒绝', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doucang-srv-'));
  const file = path.join(dir, 'clips.json');
  const got = [];
  const info = await Server.start({
    port: 0,
    file,
    getData: () => ({ beans: [1, 2], wishlist: [1] }),
    onClip: (item) => got.push(item)
  });
  assert.equal(info.ok, true);
  const port = info.port;
  const base = `http://127.0.0.1:${port}`;

  // 正常采集
  const post = await fetch(`${base}/clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Doucang': '1' },
    body: JSON.stringify({ url: 'https://item.taobao.com/item.htm?id=1', title: '测试豆', text: '到手价 ¥88 250g' })
  });
  const postJson = await post.json();
  assert.equal(postJson.ok, true);
  assert.equal(got.length, 1);
  assert.equal(got[0].host, 'item.taobao.com');

  // 落盘
  const clips = await (await fetch(`${base}/clips`)).json();
  assert.equal(clips.clips.length, 1);
  assert.equal(clips.clips[0].title, '测试豆');

  // 状态
  const st = await (await fetch(`${base}/status`)).json();
  assert.equal(st.counts.beans, 2);

  // 缺 X-Doucang 头 → 403
  const noHeader = await fetch(`${base}/clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://item.taobao.com/item.htm?id=1' })
  });
  assert.equal(noHeader.status, 403);

  // 非商品域名 → 400
  const badHost = await fetch(`${base}/clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Doucang': '1' },
    body: JSON.stringify({ url: 'https://evil.example.com/x', title: 'x' })
  });
  assert.equal(badHost.status, 400);
  assert.equal((await badHost.json()).ok, false);

  // 未授权 Origin → 403
  const badOrigin = await fetch(`${base}/status`, { headers: { Origin: 'https://evil.example.com' } });
  assert.equal(badOrigin.status, 403);

  // 未知路径 → 404
  const nf = await fetch(`${base}/nope`);
  assert.equal(nf.status, 404);

  info.server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------- Excel 导出（真实写文件并读回） ---------- */

test('导出 · Excel 6 个工作表，数据与统计一致', async () => {
  const ExcelJS = require('exceljs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doucang-xlsx-'));
  const file = path.join(dir, 'out.xlsx');
  const res = await Excel.exportWorkbook({
    file, beans: BEANS, wishlist: [{ brand: 'X', name: '心愿豆', price: 99, targetPrice: 88 }],
    settings: SETTINGS, summarize: calc.summarize, resolveBean: calc.resolveBean, today: TODAY
  });
  assert.equal(res.ok, true);
  assert.ok(fs.existsSync(file));
  assert.ok(fs.statSync(file).size > 5000, 'xlsx 文件应有实际内容');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['豆仓总表', '冲煮记录', '采购台账', '心愿单', '风味评分', '年度汇总']);

  const sheet1 = wb.getWorksheet('豆仓总表');
  assert.equal(sheet1.rowCount, BEANS.length + 1);
  assert.equal(sheet1.getRow(1).getCell(1).value, '品牌');
  const first = sheet1.getRow(2);
  assert.equal(first.getCell(2).value, '耶加雪菲');

  const brews = wb.getWorksheet('冲煮记录');
  const totalBrews = BEANS.reduce((s, b) => s + b.brewings.length, 0);
  assert.equal(brews.rowCount, totalBrews + 1);

  const summary = wb.getWorksheet('年度汇总');
  const cells = [];
  summary.eachRow((row) => cells.push(String(row.getCell(2).value)));
  assert.ok(cells.includes('8'), '冲煮总杯数应写进年度汇总');

  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------- OCR 桥接（真实调用 macOS Vision） ---------- */

test('OCR · Vision 二进制可用（非 macOS 跳过真实识别）', async () => {
  if (process.platform !== 'darwin') {
    assert.ok(true);
    return;
  }
  const ensure = await Ocr.ensureBinary(path.join(process.cwd()));
  assert.equal(ensure.ok, true, ensure.error || '');
  assert.ok(ensure.bin);
});
