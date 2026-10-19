import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImport, applyImport, normalizeBean, normalizeWish, normalizeBrewing, mergeImport } from '../src/lib/dedup.js';

const bean = (over = {}) => ({
  brand: 'Manner', name: '耶加雪菲', roastDate: '2026-09-28', price: 128, totalWeight: 250,
  flavors: ['花香'], roastLevel: 'light', brewings: [], ...over
});

/* ---------- 归一化 ---------- */

test('normalizeBean 补齐 v2 字段并保留 id', () => {
  const b = normalizeBean({ id: 'keep-me', name: 'X' }, true);
  assert.equal(b.id, 'keep-me');
  assert.equal(b.brewMethod, 'pour');
  assert.deepEqual(b.brewings, []);
  assert.equal(b.overdueNotify, true);
  assert.equal(b.restDaysOverride, null);
});

test('normalizeBrewing 过滤非法器具', () => {
  const br = normalizeBrewing({ grams: '15', method: 'weird' });
  assert.equal(br.method, 'pour');
  assert.equal(br.grams, 15);
  assert.ok(br.id);
});

test('normalizeWish 保留回购来源与目标价', () => {
  const w = normalizeWish({ name: 'A', rebuyFrom: 'bean-1', targetPrice: '99' });
  assert.equal(w.rebuyFrom, 'bean-1');
  assert.equal(w.targetPrice, 99);
  assert.equal(w.rebuyCount, 0);
});

/* ---------- A4：导入预览与三种冲突策略 ---------- */

const current = {
  beans: [bean({ id: 'b1', totalWeight: 250 })],
  wishlist: [normalizeWish({ id: 'w1', brand: 'Manner', name: '耶加雪菲', price: 128 }, true)],
  flavorTags: ['花香']
};

const incoming = {
  beans: [
    bean({ id: 'in-1', totalWeight: 300, price: 140 }),          // 与 b1 撞键（品牌+名字+烘焙日）
    bean({ id: 'in-2', name: '哥伦比亚 慧兰', roastDate: '2026-10-06' })
  ],
  wishlist: [normalizeWish({ id: 'in-3', brand: 'Manner', name: '耶加雪菲' }, true)],
  flavorTags: ['花香', '红茶']
};

test('A4 导入分析：拆出新增与冲突，不写库', () => {
  const a = analyzeImport(current, incoming);
  assert.equal(a.freshBeans.length, 1);
  assert.equal(a.beanConflicts.length, 1);
  assert.equal(a.beanConflicts[0].incoming.totalWeight, 300);
  assert.equal(a.beanConflicts[0].existing.id, 'b1');
  assert.equal(a.wishConflicts.length, 1);
  assert.equal(a.freshWish.length, 0);
  assert.deepEqual(a.newTags, ['红茶']);
});

test('A4 策略 skip：保留本地，跳过重复', () => {
  const a = analyzeImport(current, incoming);
  const res = applyImport(current, a, {});
  assert.equal(res.addedBeans, 1);
  assert.equal(res.overwrittenBeans, 0);
  assert.equal(res.skipped, 2); // 一条豆子 + 一条心愿
  const kept = res.data.beans.find((b) => b.name === '耶加雪菲');
  assert.equal(kept.totalWeight, 250);
  assert.equal(res.data.beans.length, 2);
});

test('A4 策略 overwrite：用备份覆盖，但保留本地 id 与创建时间', () => {
  const a = analyzeImport(current, incoming);
  const res = applyImport(current, a, { 'in-1': 'overwrite', 'in-3': 'overwrite' });
  assert.equal(res.overwrittenBeans, 1);
  assert.equal(res.overwrittenWish, 1);
  const kept = res.data.beans.find((b) => b.name === '耶加雪菲');
  assert.equal(kept.totalWeight, 300);
  assert.equal(kept.id, 'b1');
  assert.equal(res.data.beans.length, 2);
});

test('A4 策略 copy：同一只豆子作为新批次保留两份（回购场景）', () => {
  const a = analyzeImport(current, incoming);
  const res = applyImport(current, a, { 'in-1': 'copy' });
  assert.equal(res.addedBeans, 2);
  const same = res.data.beans.filter((b) => b.name === '耶加雪菲');
  assert.equal(same.length, 2);
  assert.notEqual(same[0].id, same[1].id);
});

test('A4 导入不覆盖设置，除非显式要求', () => {
  const a = analyzeImport(current, { ...incoming, settings: { restDays: 99 } });
  const no = applyImport(current, a, {});
  assert.equal(no.data.settings, undefined); // 原对象没有 settings 时不凭空造
  const yes = applyImport({ ...current, settings: { restDays: 7 } }, a, {}, { restoreSettings: true });
  assert.equal(yes.data.settings.restDays, 99);
});

test('A4 老接口 mergeImport 行为不变（默认跳过重复）', () => {
  const res = mergeImport(current, incoming);
  assert.equal(res.addedBeans, 1);
  assert.equal(res.data.beans.length, 2);
});

test('A4 无名字的记录被忽略，不会污染库', () => {
  const a = analyzeImport(current, { beans: [{ name: '' }, null], wishlist: [{ }, null], flavorTags: [] });
  assert.equal(a.freshBeans.length, 0);
  assert.equal(a.freshWish.length, 0);
});
