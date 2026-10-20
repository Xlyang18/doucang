import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolveBean, summarize, ROAST_DEFAULTS, remainingGrams, usedGrams, todayStr
} from '../src/lib/calc.js';
import { migrate } from '../src/lib/schema.mjs';
import { resolveDefaultMethod, buildQuickBrew, presetGrams } from '../src/lib/quickBrew.js';
import { seasonSummary, brandRanking, roastMatrix, flavorMatrix, monthlyFlow, recentMonths } from '../src/lib/stats.js';

const load = (name) => JSON.parse(fs.readFileSync(`/tmp/dcshots/fake-${name}.json`, 'utf8'));
const DATASETS = ['small', 'medium', 'large'].filter((n) => fs.existsSync(`/tmp/dcshots/fake-${n}.json`));

for (const name of DATASETS) {
  const raw = load(name);
  const { data } = migrate(raw);
  const { beans, settings } = data;

  test(`[${name}] 迁移后每条豆子都有完整字段`, () => {
    for (const b of beans) {
      assert.ok(b.id, 'id 缺失');
      assert.ok(Array.isArray(b.brewings), 'brewings 不是数组');
      assert.ok(Number(b.totalWeight) >= 0, 'totalWeight 非法');
      assert.ok(Number(b.price) >= 0, 'price 非法');
      assert.ok(['light', 'medium', 'dark'].includes(b.roastLevel), `烘焙度非法: ${b.roastLevel}`);
      assert.ok(['pour', 'espresso', 'immersion'].includes(b.brewMethod), `冲煮方式非法: ${b.brewMethod}`);
    }
  });

  test(`[${name}] resolveBean 永不产出负余量 / NaN`, () => {
    for (const b of beans) {
      const s = resolveBean(b, settings);
      assert.ok(Number.isFinite(s.left), `left 非数字: ${b.name}`);
      assert.ok(s.left >= 0, `余量为负: ${b.name} ${s.left}`);
      assert.ok(Number.isFinite(s.used), `used 非数字: ${b.name}`);
      assert.ok(s.used >= 0, `已消耗为负: ${b.name}`);
      assert.ok(Number.isFinite(s.total) && s.total > 0, `总量非法: ${b.name}`);
      assert.ok(['resting', 'peak', 'past', 'finished', 'unknown'].includes(s.status), `状态非法: ${s.status}`);
      assert.ok(s.params.servingGrams > 0, `单份克数非法: ${s.params.servingGrams}`);
      assert.ok(s.costPerServing >= 0 && Number.isFinite(s.costPerServing), `单杯成本非法: ${b.name}`);
    }
  });

  test(`[${name}] 余量 = 总量 − 已用量（误差 < 0.01）`, () => {
    for (const b of beans) {
      if (b.finished) continue; // 喝完的以 finishedWeight 为准
      const s = resolveBean(b, settings);
      const diff = Math.abs(s.left - (s.total - s.used));
      assert.ok(diff < 0.01, `${b.name}: left=${s.left} total-${'used'}=${s.total - s.used}`);
    }
  });

  test(`[${name}] 已用量与冲煮记录一致（喝完的按剩余量反推，允许偏差）`, () => {
    for (const b of beans) {
      const sumBrew = (b.brewings || []).reduce((n, br) => n + (Number(br.grams) || 0), 0);
      const used = usedGrams(b);
      if (b.finished && b.finishedWeight != null) {
        // 喝完的豆子以「总量 − 剩余」为准，冲煮记录可能少记了几杯
        assert.equal(used, b.totalWeight - b.finishedWeight, `${b.name}: 反推不对`);
        assert.ok(used >= sumBrew - 0.01, `${b.name}: 已用 ${used} 小于记录和 ${sumBrew}`);
      } else {
        assert.equal(Math.round(used * 100) / 100, Math.round(sumBrew * 100) / 100,
          `${b.name}: used=${used} 但记录和=${sumBrew}`);
      }
    }
  });

  test(`[${name}] summarize 所有金额有限且非负`, () => {
    const s = summarize(beans, settings, todayStr());
    for (const key of ['spentAll', 'spentConsumed', 'stockValue', 'avgCostPerCupReal', 'avgCostPerCupTheoretical']) {
      assert.ok(Number.isFinite(s[key]), `${key} 非数字: ${s[key]}`);
      assert.ok(s[key] >= 0, `${key} 为负: ${s[key]}`);
    }
    assert.ok(Number.isFinite(s.brewCount) && s.brewCount >= 0);
    assert.ok(Number.isFinite(s.stockGrams) && s.stockGrams >= 0);
  });

  test(`[${name}] 统计函数不抛错且结果有限`, () => {
    const brands = brandRanking(beans, settings);
    assert.ok(Array.isArray(brands));
    for (const b of brands) {
      assert.ok(Number.isFinite(b.spent), `品牌花费非数字: ${b.brand}`);
      assert.ok(b.spent >= 0);
    }
    const rows = beans.map((bean) => ({ bean, snap: resolveBean(bean, settings) }));
    const roast = roastMatrix(rows);
    assert.ok(roast && typeof roast === 'object');
    for (const [k, v] of Object.entries(roast)) {
      assert.ok(Number.isFinite(v.cost), `烘焙度成本非数字: ${k}`);
      assert.ok(v.bags >= 0);
    }
    const flavor = flavorMatrix(beans);
    assert.ok(Array.isArray(flavor));
    for (const f of flavor) {
      // 没有评分的风味 avg 为 null，属正常
      if (f.avg != null) {
        assert.ok(Number.isFinite(f.avg), `风味均分非数字: ${f.tag} → ${f.avg}`);
        assert.ok(f.avg >= 0 && f.avg <= 5, `风味均分越界: ${f.tag} → ${f.avg}`);
      }
      assert.ok(Number.isFinite(f.n) && f.n > 0, `风味计数非法: ${f.tag}`);
    }
    const months = recentMonths(12, todayStr());
    const flow = monthlyFlow(beans, months);
    assert.ok(Array.isArray(flow));
    const season = seasonSummary(beans, settings, todayStr());
    assert.ok(season);
  });

  test(`[${name}] 默认方案始终返回合法值`, () => {
    for (const b of beans) {
      const r = resolveDefaultMethod(b, settings);
      assert.ok(['pour', 'espresso', 'immersion'].includes(r.method), `非法方案: ${r.method}`);
      assert.ok(['setting', 'bean', 'history', 'fallback'].includes(r.source), `非法来源: ${r.source}`);
    }
  });

  test(`[${name}] 快记不会记出负数或超量`, () => {
    for (const b of beans) {
      if (b.finished) continue;
      const s = resolveBean(b, settings);
      if (s.left <= 0) continue;
      const built = buildQuickBrew(b, settings, 'pour', todayStr());
      assert.ok(built.grams >= 1, `记了 0 或负数: ${built.grams}`);
      assert.ok(built.grams <= s.left + 0.001, `${b.name}: 记 ${built.grams}g 但只剩 ${s.left}g`);
      assert.ok(built.leftAfter >= 0, `记完变负: ${built.leftAfter}`);
    }
  });
}

/* ---------- 极端输入 ---------- */

test('极端：总量为 0 的豆子不崩溃', () => {
  const b = { id: 'x', name: '空袋', totalWeight: 0, price: 100, roastDate: '2026-01-01', brewings: [], brewMethod: 'pour' };
  const s = resolveBean(b, { pourGrams: 15 });
  assert.ok(Number.isFinite(s.left) && s.left >= 0);
  assert.ok(Number.isFinite(s.costPerServing));
});

test('极端：价格为 0 时单杯成本为 0 而非 NaN', () => {
  const b = { id: 'x', name: '白送的', totalWeight: 250, price: 0, roastDate: '2026-01-01', brewings: [], brewMethod: 'pour' };
  const s = resolveBean(b, { pourGrams: 15 });
  assert.equal(s.costPerServing, 0);
});

test('极端：没有烘焙日期时状态为 unknown', () => {
  const b = { id: 'x', name: '没日期', totalWeight: 250, price: 100, brewings: [], brewMethod: 'pour' };
  assert.equal(resolveBean(b, {}).status, 'unknown');
});

test('极端：冲煮记录总和超过总量时，余量仍不为负', () => {
  const b = {
    id: 'x', name: '超喝', totalWeight: 100, price: 100, roastDate: '2026-01-01', brewMethod: 'pour',
    brewings: [{ id: 'a', grams: 500, date: '2026-10-01' }]
  };
  const s = resolveBean(b, { pourGrams: 15 });
  assert.ok(s.left >= 0, `余量 ${s.left} 不该为负`);
});

test('极端：未来日期的冲煮记录不导致崩溃', () => {
  const b = {
    id: 'x', name: '时空穿越', totalWeight: 250, price: 100, roastDate: '2026-01-01', brewMethod: 'pour',
    brewings: [{ id: 'a', grams: 15, date: '2099-01-01' }]
  };
  const s = resolveBean(b, { pourGrams: 15 });
  assert.ok(Number.isFinite(s.left));
  assert.ok(s.left >= 0);
});

test('极端：大数据集汇总性能 < 200ms', () => {
  if (!fs.existsSync('/tmp/dcshots/fake-large.json')) return;
  const { data } = migrate(load('large'));
  const t0 = Date.now();
  summarize(data.beans, data.settings, todayStr());
  const ms = Date.now() - t0;
  assert.ok(ms < 200, `summarize 200 袋用时 ${ms}ms，太慢`);
});
