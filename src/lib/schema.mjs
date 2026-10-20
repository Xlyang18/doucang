/* 数据结构与版本迁移 —— 主进程、渲染层、cron 提醒共用同一份实现。
 * 规则：任何新增字段都在这里补默认值，旧备份导入时走同一条路径，禁止在页面里各写一套 normalize。
 */
import { ROAST_DEFAULTS } from './calc.js';

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  restDays: 7,
  peakDays: 30,
  servingGrams: 18,
  pourGrams: 15,
  espressoGrams: 18,
  immersionGrams: 20,
  defaultMethod: 'pour',
  theme: 'system',
  overdueNotify: true,
  servicePort: 47823
};

export const DEFAULT_FLAVOR_TAGS = [
  '花香', '果酸', '莓果', '柑橘', '坚果', '焦糖', '巧克力', '可可',
  '奶油', '蜂蜜', '酒香', '烟熏', '茶感', '香料', '红糖', '乌龙'
];

export const DEFAULT_DATA = () => ({
  schemaVersion: SCHEMA_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  flavorTags: [...DEFAULT_FLAVOR_TAGS],
  beans: [],
  wishlist: [],
  wishHistory: [],
  logs: []
});

/* ---------- 小工具 ---------- */
export const uid = () => {
  const g = globalThis;
  if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const ROASTS = ['light', 'medium', 'dark'];
const METHODS = ['pour', 'espresso', 'immersion'];

/* ---------- 实体归一 ---------- */
export function normalizeBrewing(b = {}, preserveId = false) {
  return {
    id: preserveId && b.id ? b.id : uid(),
    date: str(b.date),
    grams: num(b.grams),
    method: METHODS.includes(b.method) ? b.method : 'pour',
    dose: num(b.dose),
    ratio: str(b.ratio),
    rating: b.rating || null,
    note: str(b.note)
  };
}

export function normalizeBean(b = {}, preserveId = false) {
  return {
    id: preserveId && b.id ? b.id : uid(),
    brand: str(b.brand),
    name: str(b.name),
    flavors: arr(b.flavors),
    roastLevel: ROASTS.includes(b.roastLevel) ? b.roastLevel : 'medium',
    roastDate: str(b.roastDate),
    purchaseDate: str(b.purchaseDate),
    price: num(b.price),
    totalWeight: num(b.totalWeight),
    rating: b.rating || null,
    notes: str(b.notes),
    brewMethod: METHODS.includes(b.brewMethod) ? b.brewMethod : 'pour',
    restDaysOverride: numOrNull(b.restDaysOverride),
    peakDaysOverride: numOrNull(b.peakDaysOverride),
    origin: str(b.origin),
    processor: str(b.processor),
    variety: str(b.variety),
    altitude: str(b.altitude),
    retailer: str(b.retailer),
    productUrl: str(b.productUrl),
    overdueNotify: b.overdueNotify === undefined ? true : !!b.overdueNotify,
    brewings: arr(b.brewings).map((x) => normalizeBrewing(x, true)),
    finishedWeight: numOrNull(b.finishedWeight),
    finished: !!b.finished,
    finishedDate: str(b.finishedDate),
    createdAt: b.createdAt || new Date().toISOString(),
    updatedAt: b.updatedAt || new Date().toISOString()
  };
}

export function normalizeWish(w = {}, preserveId = false) {
  return {
    id: preserveId && w.id ? w.id : uid(),
    brand: str(w.brand),
    name: str(w.name),
    flavors: arr(w.flavors),
    roastLevel: ROASTS.includes(w.roastLevel) ? w.roastLevel : 'medium',
    price: num(w.price),
    totalWeight: num(w.totalWeight),
    notes: str(w.notes),
    brewMethod: METHODS.includes(w.brewMethod) ? w.brewMethod : 'pour',
    targetPrice: numOrNull(w.targetPrice),
    productUrl: str(w.productUrl),
    retailer: str(w.retailer),
    rebuyFrom: str(w.rebuyFrom),
    rebuyCount: num(w.rebuyCount),
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: w.updatedAt || new Date().toISOString()
  };
}

/* ---------- 迁移 ---------- */
/**
 * migrate(data) —— 幂等。任何来源的数据（v1 老备份 / 部分缺字段 / 陌生字段）都能落成 v2 结构。
 */
export function migrate(input) {
  const base = DEFAULT_DATA();
  const raw = input && typeof input === 'object' ? input : {};
  const from = Number(raw.schemaVersion) || 1;
  const settings = { ...base.settings, ...(raw.settings || {}) };
  // v1 -> v2：单份克数拆成手冲 / 意式两档，旧值沿用为手冲
  if (from < 2) {
    if (settings.pourGrams === undefined || settings.pourGrams === null) settings.pourGrams = num(settings.servingGrams) || 15;
    if (settings.espressoGrams === undefined || settings.espressoGrams === null) settings.espressoGrams = 18;
  }
  const flavorTags = arr(raw.flavorTags).filter((t) => typeof t === 'string');
  const data = {
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    settings: {
      ...settings,
      restDays: num(settings.restDays) || DEFAULT_SETTINGS.restDays,
      peakDays: num(settings.peakDays) || DEFAULT_SETTINGS.peakDays,
      pourGrams: num(settings.pourGrams) || 15,
      espressoGrams: num(settings.espressoGrams) || 18,
      immersionGrams: num(settings.immersionGrams) || 20,
      defaultMethod: ['pour','espresso','immersion'].includes(settings.defaultMethod) ? settings.defaultMethod : 'pour',
      servingGrams: num(settings.servingGrams) || 18,
      theme: ['system', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'system',
      overdueNotify: settings.overdueNotify === undefined ? true : !!settings.overdueNotify,
      servicePort: num(settings.servicePort) || DEFAULT_SETTINGS.servicePort
    },
    flavorTags: flavorTags.length ? flavorTags : [...DEFAULT_FLAVOR_TAGS],
    beans: arr(raw.beans).filter((b) => b && typeof b === 'object').map((b) => normalizeBean(b, true)),
    wishlist: arr(raw.wishlist).filter((w) => w && typeof w === 'object').map((w) => normalizeWish(w, true)),
    wishHistory: arr(raw.wishHistory),
    logs: arr(raw.logs)
  };
  // 标签补全：豆子里出现过但标签表里没有的
  const tagSet = new Set(data.flavorTags);
  for (const b of [...data.beans, ...data.wishlist]) for (const f of b.flavors) tagSet.add(f);
  data.flavorTags = [...tagSet];
  return { data, migratedFrom: from, migrated: from < SCHEMA_VERSION || !raw.schemaVersion };
}

/** 推荐参数：按烘焙度给出默认养豆 / 赏味天数 */
export function recommendedParams(roastLevel) {
  return ROAST_DEFAULTS[roastLevel] || ROAST_DEFAULTS.medium;
}
