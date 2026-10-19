import test from 'node:test';
import assert from 'node:assert/strict';
import {
  presetGrams, presetMeta, defaultMethodFor, altMethods, buildQuickBrew, QUICK_DEDUPE_MS
} from '../src/lib/quickBrew.js';

const SETTINGS = { pourGrams: 15, espressoGrams: 18, immersionGrams: 20, servingGrams: 18 };
const bean = (over = {}) => ({
  id: 'b1', name: '测试豆', roastDate: '2026-10-01', totalWeight: 250, price: 150,
  brewMethod: 'pour', brewings: [], finished: false, ...over
});

/* ---------- 预设克数 ---------- */

test('预设方案：意式 18g / 手冲 15g / 冷萃 20g', () => {
  const g = presetGrams(SETTINGS);
  assert.equal(g.espresso, 18);
  assert.equal(g.pour, 15);
  assert.equal(g.immersion, 20);
});

test('预设克数跟随设置改动', () => {
  const g = presetGrams({ pourGrams: 16, espressoGrams: 20, immersionGrams: 22 });
  assert.deepEqual(g, { pour: 16, espresso: 20, immersion: 22 });
});

test('预设克数缺省时回退，不会出现 0 或 NaN', () => {
  const g = presetGrams({});
  assert.deepEqual(g, { pour: 15, espresso: 18, immersion: 20 });
  const g2 = presetGrams({ pourGrams: null, espressoGrams: '' });
  assert.equal(g2.pour, 15);
  assert.equal(g2.espresso, 18);
});

test('presetMeta 带出器具标签与粉水比', () => {
  assert.equal(presetMeta('espresso', SETTINGS).label, '意式');
  assert.equal(presetMeta('espresso', SETTINGS).ratio, '1:2');
  assert.equal(presetMeta('pour', SETTINGS).ratio, '1:15');
  assert.equal(presetMeta('immersion', SETTINGS).ratio, '1:10');
});

/* ---------- 默认方案判定 ---------- */

test('默认方案：按豆子本身的冲煮方式', () => {
  assert.equal(defaultMethodFor(bean({ brewMethod: 'espresso' })), 'espresso');
  assert.equal(defaultMethodFor(bean({ brewMethod: 'pour' })), 'pour');
});

test('默认方案：历史习惯明显超过设定时，以实际习惯为准', () => {
  const b = bean({ brewMethod: 'pour', brewings: [{ method: 'espresso' }, { method: 'espresso' }, { method: 'espresso' }, { method: 'pour' }] });
  assert.equal(defaultMethodFor(b), 'espresso');
});

test('默认方案：设定本身就是意式时，不会被手冲记录带走', () => {
  const b = bean({ brewMethod: 'espresso', brewings: [{ method: 'pour' }, { method: 'pour' }] });
  assert.equal(defaultMethodFor(b), 'espresso');
});

test('默认方案：只记过一次时不抢豆子的设定', () => {
  const b = bean({ brewMethod: 'pour', brewings: [{ method: 'espresso' }] });
  assert.equal(defaultMethodFor(b), 'pour');
});

test('备选方案：永远包含其余两档（含冷萃）', () => {
  const alts = altMethods(bean(), 'pour');
  assert.deepEqual(alts.sort(), ['espresso', 'immersion']);
  assert.equal(altMethods(bean(), 'espresso').includes('pour'), true);
});

/* ---------- 生成记录 ---------- */

test('一键记：按预设克数生成完整记录（含粉量/粉水比/日期）', () => {
  const built = buildQuickBrew(bean(), SETTINGS, 'espresso', '2026-10-19');
  assert.equal(built.grams, 18);
  assert.equal(built.brewing.dose, 18);
  assert.equal(built.brewing.ratio, '1:2');
  assert.equal(built.brewing.method, 'espresso');
  assert.equal(built.brewing.date, '2026-10-19');
  assert.equal(built.willFinish, false);
  assert.equal(built.leftAfter, 232);
});

test('一键记：剩余不足时按剩余量记，不会记出负数', () => {
  const b = bean({ brewings: [{ grams: 240 }] }); // 剩 10g
  const built = buildQuickBrew(b, SETTINGS, 'espresso', '2026-10-19');
  assert.equal(built.grams, 10);
  assert.equal(built.shortBy, 8);
  assert.equal(built.willFinish, true);
  assert.equal(built.leftAfter, 0);
});

test('一键记：手冲记 15g 后剩 235g', () => {
  const built = buildQuickBrew(bean(), SETTINGS, 'pour', '2026-10-19');
  assert.equal(built.grams, 15);
  assert.equal(built.leftAfter, 235);
  assert.equal(built.servingGrams, 15); // 手冲豆按 15g/份算杯数
});

test('一键记：冷萃用 immersionGrams', () => {
  const built = buildQuickBrew(bean({ brewMethod: 'immersion' }), SETTINGS, 'immersion', '2026-10-19');
  assert.equal(built.grams, 20);
  assert.equal(built.servingGrams, 20);
});

test('双击去重窗口为 60 秒', () => {
  assert.equal(QUICK_DEDUPE_MS, 60000);
});
