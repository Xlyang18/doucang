import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANGELOG, TYPE_META } from '../src/lib/changelog.js';

/* ---------- 数据结构 ---------- */

test('更新日志：每条都有必需字段', () => {
  for (const e of CHANGELOG) {
    assert.ok(e.version, '缺 version');
    assert.ok(/^\d+\.\d+\.\d+$/.test(e.version), `版本号格式不对：${e.version}`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(e.date), `日期格式不对：${e.date}`);
    assert.ok(e.title && e.title.length > 0, `${e.version} 缺标题`);
    assert.ok(e.summary && e.summary.length > 0, `${e.version} 缺摘要`);
    assert.ok(Array.isArray(e.sections) && e.sections.length > 0, `${e.version} 没有分区`);
  }
});

test('更新日志：每条至少有新增或修复', () => {
  for (const e of CHANGELOG) {
    const kinds = e.sections.map((s) => s.type);
    assert.ok(kinds.includes('feat') || kinds.includes('fix'), `${e.version} 既无新增也无修复`);
  }
});

test('更新日志：分区类型都是已知类型', () => {
  for (const e of CHANGELOG) {
    for (const s of e.sections) {
      assert.ok(TYPE_META[s.type], `${e.version} 出现未知分区类型：${s.type}`);
      assert.ok(s.label, `${e.version} 的分区 ${s.type} 缺中文标签`);
      assert.ok(Array.isArray(s.items) && s.items.length > 0, `${e.version}/${s.type} 是空的`);
    }
  }
});

test('更新日志：条目内容都是非空字符串，且无重复', () => {
  for (const e of CHANGELOG) {
    const seen = new Set();
    for (const s of e.sections) {
      for (const it of s.items) {
        assert.equal(typeof it, 'string');
        assert.ok(it.trim().length > 0, `${e.version} 有空条目`);
        assert.ok(!seen.has(it), `${e.version} 有重复条目：${it.slice(0, 20)}`);
        seen.add(it);
      }
    }
  }
});

/* ---------- 排序与版本比较 ---------- */

function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return y - x;
  }
  return 0;
}

test('版本比较：2.10.0 排在 2.9.0 之前（字符串排序会错）', () => {
  const list = ['2.9.0', '2.10.0', '2.1.0'].sort(cmpVersion);
  assert.deepEqual(list, ['2.10.0', '2.9.0', '2.1.0']);
});

test('版本比较：主版本不同时以主版本为准', () => {
  const list = ['1.9.9', '3.0.0', '2.5.0'].sort(cmpVersion);
  assert.deepEqual(list, ['3.0.0', '2.5.0', '1.9.9']);
});

test('更新日志：版本号唯一', () => {
  const vs = CHANGELOG.map((e) => e.version);
  assert.equal(new Set(vs).size, vs.length, '存在重复版本号');
});

/* ---------- 与 package.json 一致性 ---------- */

test('更新日志：最新一条的版本号与 package.json 一致', async () => {
  const { default: fs } = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const newest = [...CHANGELOG].sort((a, b) => cmpVersion(a.version, b.version))[0];
  assert.equal(newest.version, pkg.version,
    `最新日志是 ${newest.version}，但 package.json 是 ${pkg.version}——发版时忘写日志了？`);
});
