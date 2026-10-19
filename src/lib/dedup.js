import { ROAST_LEVELS, BREW_METHODS, numOrNull } from './calc.js';

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFlavors(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function normalizeRoast(v) {
  return ROAST_LEVELS.some((r) => r.value === v) ? v : 'medium';
}

function normalizeMethod(v) {
  return BREW_METHODS.some((m) => m.value === v) ? v : 'pour';
}

function normalizeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStr(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

export function normalizeBrewing(b, preserveId = false) {
  return {
    id: preserveId && b.id ? b.id : uid(),
    date: b.date || '',
    grams: normalizeNum(b.grams),
    method: normalizeMethod(b.method),
    dose: normalizeNum(b.dose),
    ratio: normalizeStr(b.ratio),
    rating: b.rating || null,
    note: normalizeStr(b.note)
  };
}

export function normalizeBean(b, preserveId = false) {
  return {
    id: preserveId && b.id ? b.id : uid(),
    brand: normalizeStr(b.brand),
    name: normalizeStr(b.name),
    flavors: normalizeFlavors(b.flavors),
    roastLevel: normalizeRoast(b.roastLevel),
    roastDate: normalizeStr(b.roastDate),
    purchaseDate: normalizeStr(b.purchaseDate),
    price: normalizeNum(b.price),
    totalWeight: normalizeNum(b.totalWeight),
    rating: b.rating || null,
    notes: normalizeStr(b.notes),
    // v2 新增字段
    brewMethod: normalizeMethod(b.brewMethod),
    restDaysOverride: numOrNull(b.restDaysOverride),
    peakDaysOverride: numOrNull(b.peakDaysOverride),
    origin: normalizeStr(b.origin),
    processor: normalizeStr(b.processor),
    variety: normalizeStr(b.variety),
    altitude: normalizeStr(b.altitude),
    retailer: normalizeStr(b.retailer),
    productUrl: normalizeStr(b.productUrl),
    overdueNotify: b.overdueNotify === undefined ? true : !!b.overdueNotify,
    brewings: Array.isArray(b.brewings) ? b.brewings.filter(Boolean).map((x) => normalizeBrewing(x, true)) : [],
    finishedWeight: numOrNull(b.finishedWeight),
    finished: !!b.finished,
    finishedDate: normalizeStr(b.finishedDate),
    updatedAt: b.updatedAt || new Date().toISOString(),
    createdAt: b.createdAt || new Date().toISOString()
  };
}

export function normalizeWish(w, preserveId = false) {
  const price = normalizeNum(w.price);
  const target = numOrNull(w.targetPrice);
  return {
    id: preserveId && w.id ? w.id : uid(),
    brand: normalizeStr(w.brand),
    name: normalizeStr(w.name),
    flavors: normalizeFlavors(w.flavors),
    roastLevel: normalizeRoast(w.roastLevel),
    price,
    totalWeight: normalizeNum(w.totalWeight),
    notes: normalizeStr(w.notes),
    brewMethod: normalizeMethod(w.brewMethod || 'pour'),
    // 回购/心愿增强
    targetPrice: target,
    productUrl: normalizeStr(w.productUrl),
    retailer: normalizeStr(w.retailer),
    rebuyFrom: normalizeStr(w.rebuyFrom),
    rebuyCount: normalizeNum(w.rebuyCount),
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: w.updatedAt || new Date().toISOString()
  };
}

export function beanKey(b) {
  return `${b.brand || ''}|${b.name || ''}|${b.roastDate || ''}`;
}

export function wishKey(w) {
  return `${w.brand || ''}|${w.name || ''}`;
}

/**
 * 分析导入文件与现有数据的冲突（不写库，只出报告）。
 * 返回 { incoming: { beans, wishlist, flavorTags, settings }, beans: {new, conflicts}, wishlist: {...}, tagsAdded }
 */
export function analyzeImport(current, incoming = {}) {
  const curBeans = [...(current.beans || [])].map((b) => normalizeBean(b, true));
  const curWish = [...(current.wishlist || [])].map((w) => normalizeWish(w, true));
  const beanKeys = new Map(curBeans.map((b) => [beanKey(b), b]));
  const wishKeys = new Map(curWish.map((w) => [wishKey(w), w]));

  const freshBeans = [];
  const beanConflicts = [];
  for (const raw of incoming.beans || []) {
    if (!raw || !raw.name) continue;
    const b = normalizeBean(raw, true);
    const k = beanKey(b);
    if (beanKeys.has(k)) beanConflicts.push({ incoming: b, existing: beanKeys.get(k) });
    else freshBeans.push(b);
  }
  const freshWish = [];
  const wishConflicts = [];
  for (const raw of incoming.wishlist || []) {
    if (!raw || !raw.name) continue;
    const w = normalizeWish(raw, true);
    const k = wishKey(w);
    if (wishKeys.has(k)) wishConflicts.push({ incoming: w, existing: wishKeys.get(k) });
    else freshWish.push(w);
  }
  const curTags = [...(current.flavorTags || [])];
  const newTags = [];
  for (const t of incoming.flavorTags || []) {
    if (t && typeof t === 'string' && !curTags.includes(t) && !newTags.includes(t)) newTags.push(t);
  }
  return {
    freshBeans,
    beanConflicts,
    freshWish,
    wishConflicts,
    newTags,
    incomingSettings: incoming.settings || null
  };
}

/**
 * 按逐条决策执行导入。decisions = { '<beanId>': 'skip'|'overwrite'|'copy', '<wishId>': 'skip'|'overwrite' }
 * copy 表示「作为新批次导入」，即保留两份。
 */
export function applyImport(current, analysis, decisions = {}, opts = {}) {
  const out = {
    ...current,
    beans: [...(current.beans || [])].map((b) => normalizeBean(b, true)),
    wishlist: [...(current.wishlist || [])].map((w) => normalizeWish(w, true)),
    flavorTags: [...(current.flavorTags || [])]
  };
  const now = new Date().toISOString();
  let addedBeans = 0;
  let overwrittenBeans = 0;
  let addedWish = 0;
  let overwrittenWish = 0;
  let skipped = 0;

  for (const b of analysis.freshBeans) {
    out.beans.push(normalizeBean({ ...b, updatedAt: now }, false));
    addedBeans += 1;
  }
  for (const c of analysis.beanConflicts) {
    const d = decisions[c.incoming.id] || 'skip';
    if (d === 'overwrite') {
      out.beans = out.beans.map((x) => (beanKey(x) === beanKey(c.incoming) ? normalizeBean({ ...c.incoming, id: x.id, createdAt: x.createdAt, updatedAt: now }, true) : x));
      overwrittenBeans += 1;
    } else if (d === 'copy') {
      out.beans.push(normalizeBean({ ...c.incoming, updatedAt: now }, false));
      addedBeans += 1;
    } else {
      skipped += 1;
    }
  }
  for (const w of analysis.freshWish) {
    out.wishlist.push(normalizeWish({ ...w, updatedAt: now }, false));
    addedWish += 1;
  }
  for (const c of analysis.wishConflicts) {
    const d = decisions[c.incoming.id] || 'skip';
    if (d === 'overwrite') {
      out.wishlist = out.wishlist.map((x) => (wishKey(x) === wishKey(c.incoming) ? normalizeWish({ ...c.incoming, id: x.id, createdAt: x.createdAt, updatedAt: now }, true) : x));
      overwrittenWish += 1;
    } else {
      skipped += 1;
    }
  }
  let addedTags = 0;
  for (const t of analysis.newTags) {
    if (!out.flavorTags.includes(t)) {
      out.flavorTags.push(t);
      addedTags += 1;
    }
  }
  if (opts.restoreSettings && analysis.incomingSettings) {
    out.settings = { ...out.settings, ...analysis.incomingSettings };
  }
  return { data: out, addedBeans, addedWish, addedTags, overwrittenBeans, overwrittenWish, skipped };
}

/** 老接口（保留兼容）：默认策略=跳过重复 */
export function mergeImport(current, incoming) {
  const analysis = analyzeImport(current, incoming);
  return applyImport(current, analysis, {}, {});
}
