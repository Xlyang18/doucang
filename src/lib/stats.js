/* 豆藏 · 统计聚合（纯函数）
 * 统计页、分享卡片、年度回顾都从这里取数，避免各处各算一套。
 */
import { resolveBean, beanStatus, purchaseDateOf, roastLabel, methodLabel, diffDays, parseDate, toDateStr } from './calc.js';

export const ROAST_COLORS = { light: '#D9A066', medium: '#B0713F', dark: '#6E4426' };

export function monthKey(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : '';
}

export function monthLabel(key) {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  return `${y}年${m}月`;
}

export function shortMonth(key) {
  const [, m] = key.split('-').map(Number);
  return `${m}月`;
}

/** 最近 N 个月的键（含本月） */
export function recentMonths(n = 12, today) {
  const base = parseDate(today) || new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** 品牌排行：入仓袋数、累计花费、平均评分、平均单杯 */
export function brandRanking(beans, settings, today) {
  const map = new Map();
  for (const b of beans) {
    const s = resolveBean(b, settings, today);
    const key = b.brand || '未填品牌';
    const cur = map.get(key) || { brand: key, bags: 0, spent: 0, ratings: [], cups: 0, grams: 0, beans: [] };
    cur.bags += 1;
    cur.spent += s.price;
    cur.cups += s.brewCount;
    cur.grams += s.total;
    if (b.rating) cur.ratings.push(Number(b.rating));
    cur.beans.push(b);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((x) => ({
      ...x,
      spent: Math.round(x.spent * 100) / 100,
      avgRating: x.ratings.length ? Math.round((x.ratings.reduce((a, b) => a + b, 0) / x.ratings.length) * 10) / 10 : null,
      avgCost: x.cups ? Math.round((x.spent / x.cups) * 100) / 100 : null
    }))
    .sort((a, b) => b.spent - a.spent);
}

/** 烘焙度 × 评分：每个烘焙度的袋数、平均评分、平均单杯 */
export function roastMatrix(rows) {
  const out = {};
  for (const r of rows) {
    const k = r.bean.roastLevel || 'medium';
    const cur = out[k] || { key: k, label: roastLabel(k), bags: 0, ratings: [], cost: 0, cups: 0 };
    cur.bags += 1;
    if (r.bean.rating) cur.ratings.push(Number(r.bean.rating));
    cur.cost += r.snap.costPerServing;
    cur.cups += r.snap.brewCount;
    out[k] = cur;
  }
  return ['light', 'medium', 'dark'].map((k) => {
    const cur = out[k] || { key: k, label: roastLabel(k), bags: 0, ratings: [], cost: 0, cups: 0 };
    return {
      ...cur,
      avgRating: cur.ratings.length ? Math.round((cur.ratings.reduce((a, b) => a + b, 0) / cur.ratings.length) * 10) / 10 : 0,
      avgCost: cur.bags ? Math.round((cur.cost / cur.bags) * 100) / 100 : 0
    };
  });
}

/** 风味 × 评分（同时含出现频次） */
export function flavorMatrix(beans) {
  const map = new Map();
  for (const b of beans) {
    for (const f of b.flavors || []) {
      const cur = map.get(f) || { tag: f, n: 0, ratings: [], brands: new Set() };
      cur.n += 1;
      if (b.rating) cur.ratings.push(Number(b.rating));
      if (b.brand) cur.brands.add(b.brand);
      map.set(f, cur);
    }
  }
  return [...map.values()]
    .map((x) => ({
      tag: x.tag,
      n: x.n,
      brands: [...x.brands],
      avgRating: x.ratings.length ? Math.round((x.ratings.reduce((a, b) => a + b, 0) / x.ratings.length) * 10) / 10 : 0
    }))
    .sort((a, b) => (b.avgRating - a.avgRating) || (b.n - a.n));
}

/** 月度消耗：购入（按购买日）+ 消耗克数（按冲煮日期） */
export function monthlyFlow(beans, months) {
  const buy = Object.fromEntries(months.map((m) => [m, 0]));
  const grams = Object.fromEntries(months.map((m) => [m, 0]));
  const cups = Object.fromEntries(months.map((m) => [m, 0]));
  for (const b of beans) {
    const k = monthKey(purchaseDateOf(b));
    if (k in buy) buy[k] += Number(b.price) || 0;
    for (const br of b.brewings || []) {
      const bk = monthKey(br.date);
      if (bk in grams) {
        grams[bk] += Number(br.grams) || 0;
        cups[bk] += 1;
      }
    }
  }
  return months.map((m) => ({
    key: m,
    label: shortMonth(m),
    buy: Math.round(buy[m] * 100) / 100,
    grams: Math.round(grams[m]),
    cups: cups[m]
  }));
}

/** 复购率：同一「品牌+名字」买过 ≥2 次的比例 */
export function repurchaseStats(beans) {
  const groups = new Map();
  for (const b of beans) {
    const k = `${b.brand || ''}|${b.name || ''}`;
    const cur = groups.get(k) || { key: k, brand: b.brand || '', name: b.name || '', bags: 0, ratings: [] };
    cur.bags += 1;
    if (b.rating) cur.ratings.push(Number(b.rating));
    groups.set(k, cur);
  }
  const all = [...groups.values()];
  const repeated = all.filter((g) => g.bags >= 2).map((g) => ({
    ...g,
    avgRating: g.ratings.length ? Math.round((g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length) * 10) / 10 : null
  })).sort((a, b) => b.bags - a.bags);
  return {
    totalSkus: all.length,
    singleSkus: all.filter((g) => g.bags === 1).length,
    repeatedSkus: repeated.length,
    rate: all.length ? Math.round((repeated.length / all.length) * 1000) / 10 : 0,
    bagsRepeat: repeated.reduce((s, g) => s + g.bags, 0),
    repeated
  };
}

/** 喝的速度：平均每天杯数、平均每袋喝完天数、预计库存可撑多少天 */
export function paceStats(beans, settings, today) {
  const rows = beans.map((b) => resolveBean(b, settings, today));
  let totalCups = 0;
  let from = null;
  let to = null;
  for (const r of rows) {
    for (const br of r.brewings) {
      if (!br.date) continue;
      totalCups += 1;
      if (!from || br.date < from) from = br.date;
      if (!to || br.date > to) to = br.date;
    }
  }
  const finished = rows.filter((r) => r.isFinished && r.actualDays != null);
  const spanDays = from && to ? Math.max(1, diffDays(from, to) + 1) : 0;
  const cupsPerDay = spanDays ? Math.round((totalCups / spanDays) * 100) / 100 : 0;
  const stockGrams = rows.filter((r) => !r.isFinished).reduce((s, r) => s + r.left, 0);
  const avgServing = rows.length ? rows.reduce((s, r) => s + r.params.servingGrams, 0) / rows.length : 15;
  const stockCups = avgServing ? stockGrams / avgServing : 0;
  const daysLeft = cupsPerDay > 0 ? Math.round(stockCups / cupsPerDay) : null;
  return {
    totalCups,
    from,
    to,
    spanDays,
    cupsPerDay,
    avgDaysPerBag: finished.length ? Math.round((finished.reduce((s, r) => s + r.actualDays, 0) / finished.length) * 10) / 10 : null,
    stockGrams: Math.round(stockGrams * 10) / 10,
    stockCups: Math.round(stockCups * 10) / 10,
    daysLeft
  };
}

/** 评分排行榜 */
export function ratingBoard(beans, settings, today) {
  return beans
    .filter((b) => b.rating)
    .map((b) => ({ bean: b, snap: resolveBean(b, settings, today) }))
    .sort((a, b) => (b.bean.rating - a.bean.rating) || String(b.bean.roastDate).localeCompare(String(a.bean.roastDate)));
}

/** 本季（默认最近 3 个自然月）喝了什么 —— 分享卡片用 */
export function seasonSummary(beans, settings, today, monthsBack = 3) {
  const base = parseDate(today) || new Date();
  const startD = new Date(base.getFullYear(), base.getMonth() - (monthsBack - 1), 1);
  const start = toDateStr(startD);
  // 每袋豆子在「本季」内发生的冲煮（按冲煮日期切，而不是整袋算）
  const inSeason = [];
  for (const b of beans) {
    for (const br of b.brewings || []) {
      if (br.date >= start && br.date <= today) inSeason.push({ bean: b, brewing: br });
    }
  }
  const touched = new Map();
  for (const x of inSeason) {
    const cur = touched.get(x.bean.id) || { bean: x.bean, cups: 0, grams: 0, cost: 0 };
    const cpg = (Number(x.bean.price) || 0) / (Number(x.bean.totalWeight) || 1);
    cur.cups += 1;
    cur.grams += Number(x.brewing.grams) || 0;
    cur.cost += (Number(x.brewing.grams) || 0) * cpg;
    touched.set(x.bean.id, cur);
  }
  // 本季买过但还没喝到的新豆，也算"开了几袋"
  const bought = beans.filter((b) => b.purchaseDate && b.purchaseDate >= start && b.purchaseDate <= today);
  const seasonBeans = [...new Map([
    ...[...touched.values()].map((x) => [x.bean.id, x.bean]),
    ...bought.map((b) => [b.id, b])
  ]).values()];

  const rows = touched.size ? [...touched.values()] : [];
  const flavorCount = new Map();
  for (const b of seasonBeans) for (const f of b.flavors || []) flavorCount.set(f, (flavorCount.get(f) || 0) + 1);
  const topFlavors = [...flavorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  const brands = new Map();
  for (const b of seasonBeans) brands.set(b.brand || '未填品牌', (brands.get(b.brand || '未填品牌') || 0) + 1);
  const topBrands = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const rated = seasonBeans.filter((b) => b.rating).sort((a, b) => b.rating - a.rating);
  const grams = rows.reduce((s, x) => s + x.grams, 0);
  const cost = rows.reduce((s, x) => s + x.cost, 0);
  const cups = rows.reduce((s, x) => s + x.cups, 0);
  const reorderList = [...rows]
    .map((x) => {
      const snap = resolveBean(x.bean, settings, today);
      return { brand: x.bean.brand, name: x.bean.name, rating: x.bean.rating, cups: x.cups, grams: Math.round(x.grams), costPerServing: snap.costPerServing };
    })
    .sort((a, b) => (b.cups - a.cups) || ((b.rating || 0) - (a.rating || 0)));

  return {
    start,
    end: today,
    title: `${startD.getFullYear()} ${startD.getMonth() + 1}–${base.getMonth() + 1} 月`,
    cups,
    grams: Math.round(grams),
    beans: seasonBeans.length,
    brewedBeans: rows.length,
    cost: Math.round(cost * 100) / 100,
    avgCostPerCup: cups ? Math.round((cost / cups) * 100) / 100 : 0,
    topFlavors,
    topBrands,
    best: rated[0] || null,
    worst: rated.length > 1 ? rated[rated.length - 1] : null,
    reorderList,
    roastCounts: seasonBeans.reduce((acc, b) => {
      const k = b.roastLevel || 'medium';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  };
}

export { methodLabel };
