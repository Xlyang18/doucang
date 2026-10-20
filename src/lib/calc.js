/* 豆藏核心计算 · 唯一真相源
 * 所有页面/导出/提醒的日期、状态、份数、成本都从 resolveBean / summarize 取，禁止页面自行重算。
 */

/* 按烘焙度推荐的养豆 / 赏味天数 */
export const ROAST_DEFAULTS = {
  light: { restDays: 12, peakDays: 40 },
  medium: { restDays: 7, peakDays: 30 },
  dark: { restDays: 4, peakDays: 20 }
};

export function recommendedParams(roastLevel) {
  return ROAST_DEFAULTS[roastLevel] || ROAST_DEFAULTS.medium;
}

export const ROAST_LEVELS = [
  { value: 'light', label: '浅烘' },
  { value: 'medium', label: '中烘' },
  { value: 'dark', label: '深烘' }
];

export const BREW_METHODS = [
  { value: 'pour', label: '手冲', gramKey: 'pourGrams' },
  { value: 'espresso', label: '意式', gramKey: 'espressoGrams' },
  { value: 'immersion', label: '浸泡/冷萃', gramKey: 'immersionGrams' }
];

/* 按烘焙度推荐的养豆 / 赏味天数（ROAST_DEFAULTS 定义见文件顶部） */

export function roastLabel(value) {
  const found = ROAST_LEVELS.find((r) => r.value === value);
  return found ? found.label : (value || '—');
}

export function methodLabel(value) {
  const found = BREW_METHODS.find((m) => m.value === value);
  return found ? found.label : '—';
}

export function parseDate(s) {
  if (!s) return null;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function toDateStr(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  if (!d) return '';
  d.setDate(d.getDate() + Number(days));
  return toDateStr(d);
}

export function diffDays(aStr, bStr) {
  const a = parseDate(aStr);
  const b = parseDate(bStr);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/* ---------- 每袋参数解析（可覆盖全局默认） ---------- */

export function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function beanParams(bean = {}, settings = {}) {
  const fallback = ROAST_DEFAULTS[bean.roastLevel] || {
    restDays: numOrNull(settings.restDays) ?? 7,
    peakDays: numOrNull(settings.peakDays) ?? 30
  };
  const restDays = numOrNull(bean.restDaysOverride) ?? fallback.restDays;
  const peakDays = numOrNull(bean.peakDaysOverride) ?? fallback.peakDays;
  const method = bean.brewMethod || 'pour';
  const m = BREW_METHODS.find((x) => x.value === method) || BREW_METHODS[0];
  const servingGrams = numOrNull(settings[m.gramKey])
    ?? (m.value === 'espresso' ? 18 : m.value === 'immersion' ? 20 : (numOrNull(settings.servingGrams) ?? 15));
  return { restDays, peakDays, method, servingGrams };
}

export function beanWindows(bean, settings) {
  const { restDays, peakDays } = beanParams(bean, settings);
  const restEnd = addDays(bean.roastDate, restDays);
  const peakEnd = addDays(restEnd, peakDays);
  return { restEnd, peakStart: restEnd, peakEnd, restDays, peakDays };
}

export function beanStatus(bean, settings, today = todayStr()) {
  if (bean.finished) return 'finished';
  if (!bean.roastDate) return 'unknown';
  const { restEnd, peakEnd } = beanWindows(bean, settings);
  if (today < restEnd) return 'resting';
  if (today <= peakEnd) return 'peak';
  return 'past';
}

export const STATUS_META = {
  resting: { label: '养豆中', cls: 'orange' },
  peak: { label: '最佳赏味期', cls: 'green' },
  past: { label: '已过赏味期', cls: 'red' },
  finished: { label: '已喝完', cls: 'gray' },
  unknown: { label: '未填烘焙时间', cls: 'gray' }
};

export function statusLabel(status) {
  return STATUS_META[status] ? STATUS_META[status].label : status;
}

/* ---------- 消耗与成本 ---------- */

export function brewingsOf(bean = {}) {
  return Array.isArray(bean.brewings) ? bean.brewings : [];
}

export function usedGrams(bean = {}) {
  const total = Number(bean.totalWeight) || 0;
  const fw = numOrNull(bean.finishedWeight);
  /*
   * finishedWeight 的语义是「喝完时还剩多少克」（残渣/损耗），不是「用了多少」。
   * 所以喝完的豆子，已用量 = 总量 − 剩余；
   * 若剩余没记录（null），则退回用冲煮记录求和。
   */
  if (bean.finished && fw != null && fw >= 0) {
    return Math.max(0, total - fw);
  }
  return brewingsOf(bean).reduce((s, b) => s + (Number(b.grams) || 0), 0);
}

export function brewCount(bean = {}) {
  return brewingsOf(bean).length;
}

export function remainingGrams(bean = {}) {
  const left = (Number(bean.totalWeight) || 0) - usedGrams(bean);
  return Math.max(0, Math.round(left * 10) / 10);
}

export function servings(totalWeight, servingGrams) {
  if (!totalWeight || !servingGrams) return 0;
  return Math.round((totalWeight / servingGrams) * 10) / 10;
}

export function costPerServing(price, totalWeight, servingGrams) {
  const s = servings(totalWeight, servingGrams);
  if (!s) return 0;
  return Math.round((price / s) * 100) / 100;
}

/** 已消耗部分的实际单价（元/克）· 用来算「真实已花成本」 */
export function costPerGram(bean = {}) {
  const w = Number(bean.totalWeight) || 0;
  const p = Number(bean.price) || 0;
  if (!w) return 0;
  return p / w;
}

export function purchaseDateOf(bean) {
  return bean.purchaseDate || bean.roastDate || '';
}

/** 结束日期：喝完取喝完日，否则取今天（用于估算喝的节奏） */
export function activeEndDate(bean, today = todayStr()) {
  return bean.finished ? (bean.finishedDate || today) : today;
}

export function beanProgress(bean, settings, today = todayStr()) {
  const status = beanStatus(bean, settings, today);
  const { restEnd, peakEnd } = beanWindows(bean, settings);
  if (status === 'resting') {
    const left = diffDays(today, restEnd);
    return { text: `还有 ${left} 天完成养豆`, days: left };
  }
  if (status === 'peak') {
    const left = diffDays(today, peakEnd);
    return { text: `赏味期还剩 ${left} 天`, days: left };
  }
  if (status === 'past') {
    const over = diffDays(peakEnd, today);
    return { text: `已过赏味期 ${over} 天`, days: -over };
  }
  if (status === 'finished') {
    return { text: bean.finishedDate ? `${bean.finishedDate} 喝完` : '已喝完', days: 0 };
  }
  return { text: '—', days: 0 };
}

/**
 * 一袋豆子的完整快照 —— 页面、报表、导出、分享图统一从这里取。
 */
export function resolveBean(bean, settings = {}, today = todayStr()) {
  const params = beanParams(bean, settings);
  const windows = beanWindows(bean, settings);
  const status = beanStatus(bean, settings, today);
  const total = Number(bean.totalWeight) || 0;
  const price = Number(bean.price) || 0;
  const brewings = brewingsOf(bean);
  const used = usedGrams(bean);
  const left = remainingGrams(bean);
  const theoreticalServings = servings(total, params.servingGrams);
  const leftServings = bean.finished ? 0 : servings(left, params.servingGrams);
  const cps = costPerServing(price, total, params.servingGrams);
  const cpg = costPerGram(bean);
  const realSpent = Math.round(used * cpg * 100) / 100;
  const stockValue = Math.round(left * cpg * 100) / 100;
  const progress = beanProgress(bean, settings, today);
  const dataDays = Math.max(1, diffDays(purchaseDateOf(bean) || today, activeEndDate(bean, today)) || 1);
  const cupsPerDay = brewings.length ? Math.round((brewings.length / dataDays) * 100) / 100 : 0;
  const actualDays = bean.roastDate
    ? Math.max(0, diffDays(bean.roastDate, activeEndDate(bean, today)) || 0)
    : null;
  return {
    status,
    meta: STATUS_META[status] || STATUS_META.unknown,
    progress,
    params,
    windows,
    total,
    price,
    used,
    left,
    brewings,
    brewCount: brewings.length,
    theoreticalServings,
    leftServings,
    costPerServing: cps,
    costPerGram: cpg,
    realSpent,
    stockValue,
    cupsPerDay,
    actualDays,
    isFinished: !!bean.finished
  };
}

/**
 * 全局汇总：花费口径三档 + 消耗节奏。
 * - spentAll       全部购入总价（含囤着没开的）
 * - spentConsumed  已喝掉部分对应的成本（真实已花）
 * - stockValue     剩余库存的"市值"
 */
export function summarize(beans = [], settings = {}, today = todayStr()) {
  const rows = beans.map((b) => ({ bean: b, snap: resolveBean(b, settings, today) }));
  const sum = (fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
  const active = rows.filter((r) => !r.snap.isFinished);
  const allBrewings = rows.flatMap((r) => r.snap.brewings);
  const finished = rows.filter((r) => r.snap.isFinished && r.snap.actualDays != null);
  const monthly = {};
  for (const r of rows) {
    const d = purchaseDateOf(r.bean);
    if (!d) continue;
    const k = d.slice(0, 7);
    monthly[k] = Math.round(((monthly[k] || 0) + r.snap.price) * 100) / 100;
  }
  const theoreticalTotal = sum((r) => r.snap.theoreticalServings);
  return {
    rows,
    activeRows: active,
    finishedRows: rows.filter((r) => r.snap.isFinished),
    count: rows.length,
    activeCount: active.length,
    finishedCount: finished.length,
    spentAll: Math.round(sum((r) => r.snap.price) * 100) / 100,
    spentConsumed: Math.round(sum((r) => r.snap.realSpent) * 100) / 100,
    stockValue: Math.round(sum((r) => (r.snap.isFinished ? 0 : r.snap.stockValue)) * 100) / 100,
    stockGrams: Math.round(sum((r) => (r.snap.isFinished ? 0 : r.snap.left)) * 10) / 10,
    brewCount: allBrewings.length,
    consumedGrams: Math.round(sum((r) => r.snap.used) * 10) / 10,
    avgCostPerCupReal: allBrewings.length ? Math.round((sum((r) => r.snap.realSpent) / allBrewings.length) * 100) / 100 : 0,
    avgCostPerCupTheoretical: theoreticalTotal > 0 ? Math.round((sum((r) => r.snap.price) / theoreticalTotal) * 100) / 100 : 0,
    avgDaysPerBag: finished.length ? Math.round((finished.reduce((s, r) => s + r.snap.actualDays, 0) / finished.length) * 10) / 10 : null,
    monthly,
    lastBrewDate: allBrewings.map((b) => b.date).sort().pop() || '',
    today
  };
}

/** 该喝了推荐：赏味期内优先、剩余天数少优先、余量大优先 */
export function recommendBeans(beans = [], settings = {}, today = todayStr(), limit = 3) {
  const priority = { peak: 0, past: 1, resting: 2 };
  const list = beans
    .filter((b) => !b.finished)
    .map((b) => ({ bean: b, snap: resolveBean(b, settings, today) }))
    .filter((x) => x.snap.status !== 'unknown' && x.snap.left > 0)
    .sort((a, b) => {
      const pa = priority[a.snap.status] ?? 3;
      const pb = priority[b.snap.status] ?? 3;
      if (pa !== pb) return pa - pb;
      const da = a.snap.progress.days;
      const db = b.snap.progress.days;
      if (pa === 1) return da - db; // 过期越久越靠前（负数更小）
      if (da !== db) return da - db;
      return b.snap.left - a.snap.left;
    })
    .map((x) => x.bean);
  const ready = list.filter((b) => beanStatus(b, settings, today) !== 'resting');
  return (ready.length ? ready : list).slice(0, limit);
}
