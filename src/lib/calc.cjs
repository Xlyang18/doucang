/* 豆藏核心计算 · 唯一真相源（CommonJS 版，供主进程 / 脚本 / cron 提醒使用）
 * 与 src/lib/calc.js 保持同一份逻辑，tests/logic.test.mjs 会校验两者结果一致。
 */
const ROAST_LEVELS = [
  { value: 'light', label: '浅烘' },
  { value: 'medium', label: '中烘' },
  { value: 'dark', label: '深烘' }
];

const BREW_METHODS = [
  { value: 'pour', label: '手冲', gramKey: 'pourGrams' },
  { value: 'espresso', label: '意式', gramKey: 'espressoGrams' },
  { value: 'immersion', label: '浸泡/冷萃', gramKey: 'immersionGrams' }
];

const ROAST_DEFAULTS = {
  light: { restDays: 12, peakDays: 40 },
  medium: { restDays: 7, peakDays: 30 },
  dark: { restDays: 4, peakDays: 20 }
};

const STATUS_META = {
  resting: { label: '养豆中', cls: 'orange' },
  peak: { label: '最佳赏味期', cls: 'green' },
  past: { label: '已过赏味期', cls: 'red' },
  finished: { label: '已喝完', cls: 'gray' },
  unknown: { label: '未填烘焙时间', cls: 'gray' }
};

function roastLabel(value) {
  const found = ROAST_LEVELS.find((r) => r.value === value);
  return found ? found.label : (value || '—');
}

function methodLabel(value) {
  const found = BREW_METHODS.find((m) => m.value === value);
  return found ? found.label : '—';
}

function parseDate(s) {
  if (!s) return null;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toDateStr(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  if (!d) return '';
  d.setDate(d.getDate() + Number(days));
  return toDateStr(d);
}

function diffDays(aStr, bStr) {
  const a = parseDate(aStr);
  const b = parseDate(bStr);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function beanParams(bean = {}, settings = {}) {
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

function beanWindows(bean, settings) {
  const { restDays, peakDays } = beanParams(bean, settings);
  const restEnd = addDays(bean.roastDate, restDays);
  const peakEnd = addDays(restEnd, peakDays);
  return { restEnd, peakStart: restEnd, peakEnd, restDays, peakDays };
}

function beanStatus(bean, settings, today = todayStr()) {
  if (bean.finished) return 'finished';
  if (!bean.roastDate) return 'unknown';
  const { restEnd, peakEnd } = beanWindows(bean, settings);
  if (today < restEnd) return 'resting';
  if (today <= peakEnd) return 'peak';
  return 'past';
}

function statusLabel(status) {
  return STATUS_META[status] ? STATUS_META[status].label : status;
}

function brewingsOf(bean = {}) {
  return Array.isArray(bean.brewings) ? bean.brewings : [];
}

function usedGrams(bean = {}) {
  if (bean.finished && numOrNull(bean.finishedWeight) > 0) return Number(bean.finishedWeight);
  return brewingsOf(bean).reduce((s, b) => s + (Number(b.grams) || 0), 0);
}

function brewCount(bean = {}) {
  return brewingsOf(bean).length;
}

function remainingGrams(bean = {}) {
  const left = (Number(bean.totalWeight) || 0) - usedGrams(bean);
  return Math.max(0, Math.round(left * 10) / 10);
}

function servings(totalWeight, servingGrams) {
  if (!totalWeight || !servingGrams) return 0;
  return Math.round((totalWeight / servingGrams) * 10) / 10;
}

function costPerServing(price, totalWeight, servingGrams) {
  const s = servings(totalWeight, servingGrams);
  if (!s) return 0;
  return Math.round((price / s) * 100) / 100;
}

function costPerGram(bean = {}) {
  const w = Number(bean.totalWeight) || 0;
  const p = Number(bean.price) || 0;
  if (!w) return 0;
  return p / w;
}

function purchaseDateOf(bean) {
  return bean.purchaseDate || bean.roastDate || '';
}

function activeEndDate(bean, today = todayStr()) {
  return bean.finished ? (bean.finishedDate || today) : today;
}

function beanProgress(bean, settings, today = todayStr()) {
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

function resolveBean(bean, settings = {}, today = todayStr()) {
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
  const actualDays = bean.roastDate ? Math.max(0, diffDays(bean.roastDate, activeEndDate(bean, today)) || 0) : null;
  return {
    status, meta: STATUS_META[status] || STATUS_META.unknown, progress, params, windows, total, price, used, left,
    brewings, brewCount: brewings.length, theoreticalServings, leftServings, costPerServing: cps, costPerGram: cpg,
    realSpent, stockValue, cupsPerDay, actualDays, isFinished: !!bean.finished
  };
}

function summarize(beans = [], settings = {}, today = todayStr()) {
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

function recommendBeans(beans = [], settings = {}, today = todayStr(), limit = 3) {
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
      if (pa === 1) return da - db;
      if (da !== db) return da - db;
      return b.snap.left - a.snap.left;
    })
    .map((x) => x.bean);
  const ready = list.filter((b) => beanStatus(b, settings, today) !== 'resting');
  return (ready.length ? ready : list).slice(0, limit);
}

module.exports = {
  ROAST_LEVELS, BREW_METHODS, ROAST_DEFAULTS, STATUS_META,
  roastLabel, methodLabel, parseDate, toDateStr, todayStr, addDays, diffDays, numOrNull,
  beanParams, beanWindows, beanStatus, statusLabel,
  brewingsOf, usedGrams, brewCount, remainingGrams, servings, costPerServing, costPerGram,
  purchaseDateOf, activeEndDate, beanProgress, resolveBean, summarize, recommendBeans
};
