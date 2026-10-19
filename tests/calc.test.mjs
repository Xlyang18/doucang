import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  addDays, beanStatus, beanWindows, servings, costPerServing, diffDays, todayStr,
  resolveBean, summarize, recommendBeans, beanParams, usedGrams, remainingGrams, ROAST_DEFAULTS
} from '../src/lib/calc.js';

const require = createRequire(import.meta.url);
const cjs = require('../src/lib/calc.cjs');

/* ---------- 原有计算 ---------- */

test('addDays / parseDate', () => {
  assert.equal(addDays('2026-08-01', 7), '2026-08-08');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('', 3), '');
});

test('diffDays', () => {
  assert.equal(diffDays('2026-08-01', '2026-08-08'), 7);
  assert.equal(diffDays('2026-08-10', '2026-08-08'), -2);
  assert.equal(diffDays('', '2026-08-08'), null);
});

test('todayStr returns YYYY-MM-DD', () => {
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('servings keeps 1 decimal', () => {
  assert.equal(servings(250, 18), 13.9);
  assert.equal(servings(340, 18), 18.9);
  assert.equal(servings(18, 18), 1);
  assert.equal(servings(0, 18), 0);
  assert.equal(servings(250, 0), 0);
});

test('costPerServing', () => {
  assert.equal(costPerServing(128, 250, 18), 9.21);
  assert.equal(costPerServing(98, 250, 18), 7.05);
  assert.equal(costPerServing(0, 250, 18), 0);
});

/* ---------- A2：每袋可覆盖参数 + 烘焙度推荐 ---------- */

const SETTINGS = { restDays: 7, peakDays: 30, pourGrams: 15, espressoGrams: 18, servingGrams: 18 };

test('A2 按烘焙度推荐参数（不再复用全局 7/30）', () => {
  const dark = beanParams({ roastLevel: 'dark' }, SETTINGS);
  assert.equal(dark.restDays, ROAST_DEFAULTS.dark.restDays);
  assert.equal(dark.peakDays, ROAST_DEFAULTS.dark.peakDays);
  const light = beanParams({ roastLevel: 'light' }, SETTINGS);
  assert.equal(light.restDays, ROAST_DEFAULTS.light.restDays);
  assert.equal(light.peakDays, ROAST_DEFAULTS.light.peakDays);
});

test('A2 豆子级覆盖优先于烘焙度推荐', () => {
  const p = beanParams({ roastLevel: 'dark', restDaysOverride: 10, peakDaysOverride: 45 }, SETTINGS);
  assert.equal(p.restDays, 10);
  assert.equal(p.peakDays, 45);
});

test('A2 深烘不再被误判为「已过赏味期」', () => {
  const bean = { roastLevel: 'dark', roastDate: '2026-08-01', finished: false };
  // 深烘：4 + 20 → 08-25 截止，08-20 仍在赏味期
  assert.equal(beanStatus(bean, SETTINGS, '2026-08-20'), 'peak');
  assert.equal(beanStatus(bean, SETTINGS, '2026-08-26'), 'past');
});

test('beanWindows 使用每袋参数', () => {
  const w = beanWindows({ roastLevel: 'light', roastDate: '2026-08-01' }, {});
  assert.equal(w.restDays, 12);
  assert.equal(w.restEnd, '2026-08-13');
  assert.equal(w.peakEnd, '2026-09-22');
});

/* ---------- A1：消耗与真实成本 ---------- */

test('A1 剩余克数 = 总量 - 冲煮累计', () => {
  const bean = {
    roastDate: '2026-10-01', price: 150, totalWeight: 250, brewMethod: 'pour',
    brewings: [{ grams: 15, date: '2026-10-02' }, { grams: 15, date: '2026-10-03' }]
  };
  assert.equal(usedGrams(bean), 30);
  assert.equal(remainingGrams(bean), 220);
  const snap = resolveBean(bean, SETTINGS, '2026-10-10');
  assert.equal(snap.brewCount, 2);
  assert.equal(snap.left, 220);
  assert.equal(snap.costPerGram.toFixed(3), '0.600');
  assert.equal(snap.realSpent, 18);
  assert.equal(snap.stockValue, 132);
});

test('A1 喝完时以 finishedWeight 为准', () => {
  const bean = { totalWeight: 250, price: 150, finished: true, finishedWeight: 250, brewings: [{ grams: 100 }] };
  assert.equal(usedGrams(bean), 250);
  assert.equal(remainingGrams(bean), 0);
});

test('A1 剩余不会为负', () => {
  const bean = { totalWeight: 100, brewings: [{ grams: 80 }, { grams: 80 }] };
  assert.equal(remainingGrams(bean), 0);
});

test('A1 意式 / 手冲各用各的单份克数', () => {
  const base = { roastDate: '2026-10-01', totalWeight: 1000, price: 99 };
  const esp = resolveBean({ ...base, brewMethod: 'espresso' }, SETTINGS, '2026-10-10');
  assert.equal(esp.params.servingGrams, 18);
  assert.equal(esp.theoreticalServings, 55.6);
  const pour = resolveBean({ ...base, brewMethod: 'pour' }, SETTINGS, '2026-10-10');
  assert.equal(pour.params.servingGrams, 15);
  assert.equal(pour.theoreticalServings, 66.7);
});

/* ---------- A3：花费口径三档 ---------- */

test('A3 summarize 三种口径互不混淆', () => {
  const beans = [
    { id: 'a', roastDate: '2026-10-01', price: 100, totalWeight: 200, brewings: [{ grams: 100, date: '2026-10-02' }] },
    { id: 'b', roastDate: '2026-10-05', price: 80, totalWeight: 200 }
  ];
  const s = summarize(beans, SETTINGS, '2026-10-10');
  assert.equal(s.spentAll, 180);
  assert.equal(s.spentConsumed, 50);
  assert.equal(s.stockValue, 130);
  assert.equal(s.count, 2);
  assert.equal(s.brewCount, 1);
});

/* ---------- A5：该喝了推荐 ---------- */

test('A5 推荐优先赏味期内、剩得少、量大的', () => {
  const beans = [
    { id: 'resting', roastLevel: 'light', roastDate: '2026-10-09', totalWeight: 250 },
    { id: 'peakShort', roastLevel: 'medium', roastDate: '2026-09-20', totalWeight: 100 },
    { id: 'peakLong', roastLevel: 'medium', roastDate: '2026-10-01', totalWeight: 250 }
  ];
  const list = recommendBeans(beans, SETTINGS, '2026-10-10', 3).map((b) => b.id);
  assert.equal(list[0], 'peakShort');
  assert.equal(list.includes('resting'), false);
});

/* ---------- 双实现一致性（ESM 与 CJS 不能漂移） ---------- */

test('calc.js 与 calc.cjs 结果完全一致', () => {
  const beans = [
    { id: 'x1', roastLevel: 'light', roastDate: '2026-09-20', price: 128, totalWeight: 250, brewMethod: 'pour', brewings: [{ grams: 15, date: '2026-09-28' }, { grams: 12, date: '2026-10-01' }] },
    { id: 'x2', roastLevel: 'dark', roastDate: '2026-10-05', price: 99, totalWeight: 1000, brewMethod: 'espresso', brewings: [] },
    { id: 'x3', roastLevel: 'medium', roastDate: '2026-08-01', price: 88, totalWeight: 227, finished: true, finishedDate: '2026-09-01', finishedWeight: 227 }
  ];
  const a = summarize(beans, SETTINGS, '2026-10-10');
  const b = cjs.summarize(beans, SETTINGS, '2026-10-10');
  for (const k of ['spentAll', 'spentConsumed', 'stockValue', 'stockGrams', 'brewCount', 'consumedGrams', 'avgCostPerCupReal', 'avgCostPerCupTheoretical', 'avgDaysPerBag', 'count', 'activeCount']) {
    assert.equal(a[k], b[k], `字段 ${k} 不一致`);
  }
  for (let i = 0; i < beans.length; i++) {
    const ra = a.rows[i].snap;
    const rb = b.rows[i].snap;
    assert.equal(ra.left, rb.left);
    assert.equal(ra.status, rb.status);
    assert.equal(ra.costPerServing, rb.costPerServing);
    assert.equal(ra.windows.peakEnd, rb.windows.peakEnd);
  }
  assert.deepEqual(
    recommendBeans(beans, SETTINGS, '2026-10-10', 3).map((x) => x.id),
    cjs.recommendBeans(beans, SETTINGS, '2026-10-10', 3).map((x) => x.id)
  );
});
