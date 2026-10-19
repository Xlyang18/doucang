import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductText, retailerFromUrl, productIdOf } from '../electron/productParser.cjs';
import { parseLabelText } from '../electron/labelParser.cjs';
import { buildNotifications } from '../electron/notifier.cjs';
import { renderPrintHtml } from '../electron/printTemplate.cjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const calc = require('../src/lib/calc.cjs');

const SETTINGS = { restDays: 7, peakDays: 30, pourGrams: 15, espressoGrams: 18 };

/* ---------- 链接 / 商品文案解析 ---------- */

test('链接解析：淘宝完整商品文案', () => {
  const text = `【幸运咖】埃塞俄比亚 耶加雪菲 水洗 G1 浅烘 精品咖啡豆
到手价：¥88.00
原价 ¥128
净含量：250g
烘焙日期：2026-09-28
产地：埃塞俄比亚 耶加雪菲
处理法：水洗
风味：柑橘 茉莉 蜂蜜
海拔 1900-2200m
品种 原生种`;
  const r = parseProductText(text, 'https://item.taobao.com/item.htm?id=123456');
  assert.equal(r.price, 88);
  assert.equal(r.totalWeight, 250);
  assert.equal(r.roastDate, '2026-09-28');
  assert.equal(r.retailer, '淘宝');
  assert.equal(r.processor, '水洗');
  assert.ok(r.origin.includes('埃塞俄比亚'));
  assert.ok(r.flavors.includes('柑橘'));
  assert.ok(r.flavors.includes('花香'));
  assert.equal(r.altitude, '1900-2200m');
  assert.equal(r.variety, '原生种');
  assert.equal(r.productUrl, 'https://item.taobao.com/item.htm?id=123456');
});

test('链接解析：京东 / 天猫 识别渠道与商品 ID', () => {
  assert.equal(retailerFromUrl('https://item.jd.com/1000321.html'), '京东');
  assert.equal(retailerFromUrl('https://detail.tmall.com/item.htm?id=9'), '天猫');
  assert.equal(productIdOf('https://item.jd.com/100032123.html'), '100032123');
  assert.equal(productIdOf('https://item.taobao.com/item.htm?id=778899'), '778899');
});

test('链接解析：只有链接也能认出渠道，不瞎猜价格', () => {
  const r = parseProductText('https://item.taobao.com/item.htm?id=1', 'https://item.taobao.com/item.htm?id=1');
  assert.equal(r.retailer, '淘宝');
  assert.equal(r.price, 0);
});

test('链接解析：1kg 换算成 1000g', () => {
  const r = parseProductText('意式拼配咖啡豆 1kg 深烘 到手价 ¥139');
  assert.equal(r.totalWeight, 1000);
  assert.equal(r.price, 139);
  assert.equal(r.roastLevel, 'dark');
});

/* ---------- 包装标签 OCR 文本解析 ---------- */

const LABEL_CN = [
  'ETHIOPIA 耶加雪菲',
  'Yirgacheffe Washed G1',
  '产地', '处理法', '烘焙度', '烘焙日期', '净含量', '风味描述', '海拔', '豆种', '烘焙商', '价格',
  '埃塞俄比亚 耶加雪菲', '水洗 Water Washed', '浅烘 Light Roast', '2026-09-28', '250g',
  'citrus, bergamot,jasmine, peach', '1900-2200 masl', 'Heirloom 原生种', '幸运咖烘焙学院', '¥128.00'
];

test('OCR 解析：中英混排标签（日期 / 克重 / 烘焙度 / 处理法 / 产地 / 海拔）', () => {
  const r = parseLabelText(LABEL_CN);
  assert.equal(r.fields.roastDate, '2026-09-28');
  assert.equal(r.fields.totalWeight, 250);
  assert.equal(r.fields.price, 128);
  assert.equal(r.fields.roastLevel, 'light');
  assert.equal(r.fields.processor, '水洗');
  assert.equal(r.fields.origin, '埃塞俄比亚 耶加雪菲');
  assert.equal(r.fields.altitude, '1900-2200m');
  assert.ok(r.fields.flavors.includes('花香'));
  assert.ok(r.confidence.roastDate >= 0.9);
});

test('OCR 解析：形状规整的英文标签（中深烘 / 净含量 Net Weight / 日期带年月日）', () => {
  const lines = [
    'Berry Bros. Coffee Roasters',
    '哥伦比亚 慧兰 薇拉',
    'Colombia Huila ASOPEP',
    '风味：红糖／黑樱桃／乌龙茶',
    '水洗 Washed Process',
    '烘焙度：中深烘 Medium-Dark',
    '烘焙日期 2026年10月06日',
    '净含量 Net Weight 227g',
    '产地：哥伦比亚 Huila 省',
    '海拔1750m•品种 Caturra/Castillo',
    '单价 RMB 108'
  ];
  const r = parseLabelText(lines);
  assert.equal(r.fields.brand, 'Berry Bros. Coffee Roasters');
  assert.equal(r.fields.roastDate, '2026-10-06');
  assert.equal(r.fields.totalWeight, 227);
  assert.equal(r.fields.price, 108);
  assert.equal(r.fields.roastLevel, 'dark');
  assert.equal(r.fields.variety, 'Caturra/Castillo');
});

test('OCR 解析：没有日期的标签不会瞎编日期', () => {
  const r = parseLabelText(['某某咖啡', '深烘 意式拼配', '500g']);
  assert.equal(r.fields.roastDate, '');
  assert.equal(r.confidence.roastDate, 0);
  assert.equal(r.fields.totalWeight, 500);
});

test('OCR 解析：空输入不崩', () => {
  const r = parseLabelText('');
  assert.equal(r.fields.name, '');
  assert.deepEqual(r.rawLines, []);
});

/* ---------- 提醒 ---------- */

test('提醒：养豆完成 / 赏味将尽 / 已过期 / 快见底', () => {
  const beans = [
    { id: 'a', name: '养好了', roastLevel: 'dark', roastDate: '2026-10-06', totalWeight: 100 },  // 4 天后 = 10-10（今天）
    { id: 'b', name: '快过期', roastLevel: 'medium', roastDate: '2026-09-20', totalWeight: 250 }, // 9-27 ~ 10-27
    { id: 'c', name: '过量了', roastLevel: 'medium', roastDate: '2026-08-01', totalWeight: 250 },
    { id: 'd', name: '见底了', roastLevel: 'dark', roastDate: '2026-10-08', totalWeight: 250, brewings: [{ grams: 220 }] }
  ];
  const list = buildNotifications(beans, SETTINGS, '2026-10-10', calc.resolveBean, calc.todayStr);
  const ids = list.map((n) => n.id);
  assert.ok(ids.includes('rest-done'));
  assert.ok(ids.includes('past-peak'));
  assert.ok(ids.includes('low-stock'));
});

test('提醒：关闭开关后不再产生通知', () => {
  const beans = [{ id: 'c', name: '过量了', roastLevel: 'medium', roastDate: '2026-08-01', totalWeight: 250 }];
  const list = buildNotifications(beans, { ...SETTINGS, overdueNotify: false }, '2026-10-10', calc.resolveBean, calc.todayStr);
  assert.equal(list.length, 0);
});

test('提醒：已喝完的豆子不提醒', () => {
  const beans = [{ id: 'x', name: '喝完的', roastLevel: 'medium', roastDate: '2026-08-01', totalWeight: 250, finished: true }];
  const list = buildNotifications(beans, SETTINGS, '2026-10-10', calc.resolveBean, calc.todayStr);
  assert.equal(list.length, 0);
});

/* ---------- 打印豆册 ---------- */

test('打印豆册：HTML 含豆子卡片与汇总，且做 HTML 转义', () => {
  const beans = [{ id: 'a', brand: '<script>', name: 'A&B', roastDate: '2026-10-01', totalWeight: 250, price: 100, brewMethod: 'pour', brewings: [] }];
  const html = renderPrintHtml({ beans, settings: SETTINGS, summarize: calc.summarize, resolveBean: calc.resolveBean, today: '2026-10-10' });
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('豆藏 · 咖啡豆册'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('@page'));
});

test('打印豆册：空库也能生成', () => {
  const html = renderPrintHtml({ beans: [], settings: SETTINGS, summarize: calc.summarize, resolveBean: calc.resolveBean, today: '2026-10-10' });
  assert.ok(html.includes('还没有豆子'));
});
