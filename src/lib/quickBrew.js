/* 快速记一杯 · 预设方案（v2.1）
 * 设计：卡片上点一下 = 直接按该豆的默认方案记一杯，无弹窗；旁边小箭头切另一档。
 * 克数全部来自设置（手冲 pourGrams / 意式 espressoGrams / 冷萃 immersionGrams），可后期改。
 */
import { resolveBean, methodLabel, numOrNull } from './calc.js';

export const PRESET_ORDER = ['pour', 'espresso', 'immersion'];

const RATIO = { pour: '1:15', espresso: '1:2', immersion: '1:10' };

/** 各方案的克数（读设置，缺省回退） */
export function presetGrams(settings = {}) {
  return {
    pour: numOrNull(settings.pourGrams) ?? 15,
    espresso: numOrNull(settings.espressoGrams) ?? 18,
    immersion: numOrNull(settings.immersionGrams) ?? 20
  };
}

export function presetMeta(method, settings) {
  const g = presetGrams(settings)[method];
  return { method, label: methodLabel(method), grams: g, ratio: RATIO[method] || '' };
}

/** 该豆当前默认方案：以豆子设定的冲煮方式为准；历史里更常用的那一档超过它两次以上才替换 */
export function defaultMethodFor(bean = {}) {
  const base = bean.brewMethod || 'pour';
  const counts = {};
  for (const br of bean.brewings || []) {
    const m = br.method || base;
    counts[m] = (counts[m] || 0) + 1;
  }
  const baseCount = counts[base] || 0;
  const best = Object.entries(counts)
    .filter(([m]) => m !== base)
    .sort((a, b) => b[1] - a[1])[0];
  // 另一档至少比设定档多 2 次才改写默认，避免试喝一次就把主方案换掉
  if (best && best[1] >= Math.max(baseCount + 2, 3)) return best[0];
  return base;
}

/** 除默认方案外，其余可用方案（用于小箭头切换；冷萃只在豆子本身就是冷萃时才出现） */
export function altMethods(bean = {}, def) {
  const list = PRESET_ORDER.filter((m) => m !== def);
  if (bean.brewMethod === 'immersion') return list;
  // 意式 / 手冲豆都可能临时冷萃，统一给三档可选，避免"想冷萃却没入口"
  return list;
}

export const QUICK_DEDUPE_MS = 60000;

/**
 * 生成一杯记录（不落库）。剩余不足时，克数按剩余量记（不会记出负数）。
 * @returns {{ brewing, grams, shortBy, willFinish }}
 */
export function buildQuickBrew(bean, settings, method, date) {
  const s = resolveBean(bean, settings);
  const preset = presetMeta(method, settings);
  const grams = Math.max(1, Math.min(preset.grams, s.left > 0 ? s.left : preset.grams));
  const willFinish = grams >= s.left;
  const leftAfter = Math.max(0, s.left - grams);
  return {
    grams,
    shortBy: Math.max(0, preset.grams - grams),
    willFinish,
    leftAfter,
    servingGrams: s.params.servingGrams,
    brewing: {
      grams,
      dose: grams,
      ratio: preset.ratio,
      method,
      date: date || new Date().toISOString().slice(0, 10),
      rating: null,
      note: ''
    }
  };
}

/** 记完之后的口径：剩余克数与可喝杯数 */
export function brewResultText(leftGrams, servingGrams) {
  const cups = servingGrams > 0 ? Math.floor(leftGrams / servingGrams) : 0;
  return `剩 ${Math.round(leftGrams * 10) / 10}g ≈ ${cups} 杯`;
}
