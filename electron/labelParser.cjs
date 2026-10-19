"use strict";
/* 包装标签 OCR 文本 → 豆子字段（纯规则，不联网）
 * 输入：Vision 识别出的文本行（已按视觉从上到下排序），或整段文本
 * 输出：候选字段 + 每项置信度（0~1），前端用低置信项高亮提示人工校对
 */

const ROAST_PATTERNS = [
  [/(极浅|浅烘|浅焙|light\s*roast|\blight\b)/i, 'light', 0.95],
  [/(中浅|medium[\s-]*light|中浅焙)/i, 'medium', 0.9],
  [/(中深|深烘|深焙|dark\s*roast|\bdark\b|中重度)/i, 'dark', 0.9],
  [/(中烘|中焙|medium\s*roast|\bmedium\b)/i, 'medium', 0.85],
  [/(浅|light)/i, 'light', 0.55],
  [/(深|dark)/i, 'dark', 0.55]
];

const PROCESSOR_PATTERNS = [
  [/厌氧\s*日晒|anaerobic\s*natural|双重厌氧/i, '厌氧日晒', 0.9],
  [/厌氧\s*水洗|anaerobic\s*washed/i, '厌氧水洗', 0.9],
  [/厌氧|anaerobic/i, '厌氧', 0.75],
  [/蜜处理|半日晒|honey\s*process|\bhoney\b/i, '蜜处理', 0.9],
  [/湿刨|wet[\s-]*hull/i, '湿刨', 0.9],
  [/日晒|natural\s*process|干法|\bnatural\b/i, '日晒', 0.85],
  [/水洗|washed|湿法/i, '水洗', 0.9]
];

const ORIGINS = [
  '埃塞俄比亚', '耶加雪菲', '西达摩', '古吉', '哈拉尔', '哥伦比亚', '慧兰', '薇拉', '娜玲珑', '巴西', '喜拉多',
  '危地马拉', '安提瓜', '哥斯达黎加', '塔拉珠', '巴拿马', '波奎特', '瑰夏', '肯尼亚', '涅里', '印尼', '曼特宁',
  '苏门答腊', '爪哇', '云南', '保山', '普洱', '孟连', '坦桑尼亚', '萨尔瓦多', '洪都拉斯', '秘鲁', '墨西哥',
  '卢旺达', '布隆迪', '厄瓜多尔', '印度', '越南', '牙买加', '蓝山', '夏威夷', 'Ethiopia', 'Kenya', 'Colombia',
  'Brazil', 'Guatemala', 'Panama', 'Costa Rica', 'Yirgacheffe', 'Sidamo', 'Guji', 'Huila', 'Sumatra'
];

const FLAVOR_MAP = [
  [/茉莉|jasmine|花香|玫瑰|floral/i, '花香'],
  [/蓝莓|草莓|樱桃|blackberry|berry|strawberry|cherry|葡萄|grape|树莓|覆盆子/i, '莓果'],
  [/柑橘|橙|柠檬|柚|citrus|orange|lemon/i, '柑橘'],
  [/苹果|apple|梨|pear|桃|peach|杏|apricot|果酸/i, '果酸'],
  [/坚果|杏仁|榛子|nut|almond|hazelnut|花生/i, '坚果'],
  [/焦糖|caramel|太妃|toffee|糖浆/i, '焦糖'],
  [/巧克力|chocolate|可可|cocoa/i, '巧克力'],
  [/奶油|creamy|butter|黄油/i, '奶油'],
  [/蜂蜜|红糖|brown\s*sugar|蔗糖/i, '蜂蜜'],
  [/酒香|朗姆|rum|威士忌|whisky|红酒|winey/i, '酒香'],
  [/烟熏|smoke|烘烤|雪松|cedar/i, '烟熏'],
  [/乌龙|红茶|绿茶|oolong|black\s*tea|green\s*tea|茶感/i, '茶感'],
  [/香料|spice|肉桂|cinnamon|丁香|clove|胡椒|pepper/i, '香料']
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const LABEL_WORDS = /^(产地|处理法|处理方式|烘焙度|烘焙程度|烘焙|烘焙日期|烘焙时间|净含量|净重|风味|风味描述|海拔|豆种|品种|烘焙商|价格|单价|赏味期|保质期|批次|roast|process|origin|variety|altitude|net\s*weight|weight|price|flavor|batch|best\s*before)\s*[:：]?$/i;

// 标签行/规格行：不能当豆子名字
const KEYWORD_LINE = /light|heirloom|原生种|风味描述|烘焙商|烘焙学院|roastery|处理法|处理方式|水洗|日晒|蜜处理|湿刨|厌氧|washed|natural|honey|烘焙度|烘焙程度|烘焙日期|净含量|净重|海拔|altitude|产地|origin|单价|价格|price|风味|flavor|赏味|保质期|批次|batch|自重|包装/i;

const NAME_PRIORITY = /耶加|雪菲|西达摩|古吉|哥伦比亚|慧兰|瑰夏|曼特宁|保山|普洱|薇拉|拼配|意式|手冲|ASOPEP|Huila|Guji|Yirgacheffe|Sidamo|Geisha|Colombia|Ethiopia|Kenya/i;

// 整行都是英文且没有中文的，多半是风味描述行
const FLAVOR_HEAD = /^[a-zA-Z][a-zA-Z\s,，/&]{5,}$/;

function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

/** 从任意文本里抽烘焙日期 */
function extractDate(text) {
  const s = String(text);
  const keyed = s.match(/(?:烘焙\s*(?:日期|时间|日)?|roast(?:ed)?\s*(?:on|date)?|生产\s*(?:日期|日)?|制造\s*(?:日期|日)?)\s*[:：]\s*([^\n]{4,26})/i)
    || s.match(/(?:烘焙\s*(?:日期|时间|日)|生产\s*日期)\s+([^\n]{4,26})/i)
    || s.match(/roast(?:ed)?\s*on\s*([^\n]{4,26})/i);
  const pool = keyed ? keyed[1] : s;

  const ymd = pool.match(/(20\d{2})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})/);
  if (ymd) {
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { date: `${ymd[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, confidence: 0.95 };
    }
  }
  const compact = pool.match(/(20\d{2})(\d{2})(\d{2})(?!\d)/);
  if (compact) {
    const m = Number(compact[2]);
    const d = Number(compact[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { date: `${compact[1]}-${compact[2]}-${compact[3]}`, confidence: 0.8 };
  }
  const en = pool.match(/(\d{1,2})[\s-]*([A-Za-z]{3,9})\.?[\s,-]*(\d{4})/);
  if (en) {
    const m = MONTHS[en[2].toLowerCase().slice(0, 4)];
    if (m) return { date: `${en[3]}-${String(m).padStart(2, '0')}-${String(Number(en[1])).padStart(2, '0')}`, confidence: 0.85 };
  }
  const en2 = pool.match(/([A-Za-z]{3,9})\.?\s*(\d{1,2}),?\s*(20\d{2})/);
  if (en2) {
    const m = MONTHS[en2[1].toLowerCase().slice(0, 4)];
    if (m) return { date: `${en2[3]}-${String(m).padStart(2, '0')}-${String(Number(en2[2])).padStart(2, '0')}`, confidence: 0.85 };
  }
  const md = pool.match(/(?<![\d])(\d{1,2})\s*[./月]\s*(\d{1,2})\s*日?/);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const t = todayParts();
      let year = t.y;
      const cand = new Date(year, m - 1, d);
      if (cand.getTime() - Date.now() > 30 * 86400000) year -= 1;
      return { date: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, confidence: keyed ? 0.8 : 0.6 };
    }
  }
  return { date: '', confidence: 0 };
}

function extractWeight(text) {
  const s = String(text);
  const keyed = s.match(/(?:净含量|净重|net\s*weight|n\.w\.?|weight|规格)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(克|kg|千克|公斤|g|oz|磅|lb)/i);
  const m = keyed || s.match(/(\d+(?:\.\d+)?)\s*(克|kg|千克|公斤|g\b|oz\b|磅|lb\b)/);
  if (!m) return { weight: 0, confidence: 0 };
  const n = Number(m[1]);
  const u = String(m[2]).toLowerCase();
  let g = n;
  if (u === 'kg' || u === '千克' || u === '公斤') g = n * 1000;
  else if (u === 'oz') g = Math.round(n * 28.35);
  else if (u === '磅' || u === 'lb') g = Math.round(n * 453.6);
  const plausible = g >= 20 && g <= 5000;
  return { weight: plausible ? Math.round(g) : 0, confidence: plausible ? (keyed ? 0.95 : 0.7) : 0 };
}

function extractPrice(text) {
  const s = String(text);
  const m = s.match(/(?:¥|￥|RMB|rmb|价格|售价|单价)\s*[:：]?\s*(\d+(?:\.\d+)?)/) || s.match(/(\d+(?:\.\d+)?)\s*(?:元|RMB|rmb)/);
  if (!m) return { price: 0, confidence: 0 };
  const n = Number(m[1]);
  return { price: n > 0 && n < 100000 ? n : 0, confidence: 0.85 };
}

function extractRoast(text) {
  const s = String(text);
  for (const [re, v, c] of ROAST_PATTERNS) if (re.test(s)) return { roastLevel: v, confidence: c };
  return { roastLevel: '', confidence: 0 };
}

function extractProcessor(text) {
  const s = String(text);
  for (const [re, v, c] of PROCESSOR_PATTERNS) if (re.test(s)) return { processor: v, confidence: c };
  return { processor: '', confidence: 0 };
}

function extractOrigin(text) {
  const s = String(text);
  const hits = ORIGINS.filter((o) => s.includes(o));
  if (!hits.length) return { origin: '', confidence: 0 };
  const cjk = hits.filter((h) => /[\u4e00-\u9fa5]/.test(h));
  const pick = (cjk.length ? cjk : hits).slice(0, 2).join(' ');
  return { origin: pick, confidence: cjk.length ? 0.8 : 0.6 };
}

function extractFlavors(text) {
  const s = String(text);
  const out = [];
  for (const [re, tag] of FLAVOR_MAP) if (re.test(s) && !out.includes(tag)) out.push(tag);
  return { flavors: out.slice(0, 8), confidence: out.length ? 0.7 : 0 };
}

function extractVariety(text) {
  const m = String(text).match(/(?:品种|豆种|variety|varietal)\s*[:：]?\s*([^\n]{2,30})/i);
  const v = m ? m[1].replace(/^\s*(品种|豆种)\s*[:：]?\s*/, '').trim() : '';
  const ok = v && !/^(品种|豆种|产地|处理法|烘焙度|风味|净含量|海拔|烘焙商|价格|单价|variety)$/i.test(v);
  return { variety: ok ? v.slice(0, 30) : '', confidence: ok ? 0.8 : 0 };
}

function extractAltitude(text) {
  const s = String(text);
  const m = s.match(/(\d{3,4})\s*[-~—至]\s*(\d{3,4})\s*(?:m|米|masl)/i) || s.match(/(?:海拔|altitude)\s*[:：]?\s*(\d{3,4})\s*(?:m|米|masl)?/i);
  if (!m) return { altitude: '', confidence: 0 };
  return { altitude: m[2] ? `${m[1]}-${m[2]}m` : `${m[1]}m`, confidence: 0.75 };
}

function isLabelLine(l) {
  const t = String(l).trim();
  if (!t) return true;
  if (LABEL_WORDS.test(t)) return true;
  if (/^[¥￥$]\s*\d/.test(t)) return true;
  if (/^\d+(\s*元|\s*RMB)?$/i.test(t)) return true;
  if (/^\d{1,4}\s*[-./年]\s*\d{1,2}/.test(t)) return true;
  if (/^\d+\s*(g|kg|克|oz)\b/i.test(t)) return true;
  return false;
}

function candidateLines(lines) {
  return (lines || [])
    .map((l) => String(l).trim())
    .filter((l) => !isLabelLine(l))
    .filter((l) => l.length >= 2 && l.length <= 60);
}

function extractBrand(lines) {
  const arr = candidateLines(lines);
  const hit = arr.slice(0, 4).find((l) => /roaster|roastery|coffee|咖啡|烘焙/i.test(l) && l.length <= 40);
  const first = arr[0] || '';
  const pick = (hit || (first.length <= 30 ? first : '')).slice(0, 30);
  return { brand: pick, confidence: pick ? (hit ? 0.8 : 0.5) : 0 };
}

function extractName(lines, brand) {
  const arr = candidateLines(lines);
  const originOnly = new RegExp('^(' + ORIGINS.join('|') + ')([\\s,·/]+(' + ORIGINS.join('|') + '))*$', 'i');
  const clean = arr.filter((l) => !originOnly.test(l) && !KEYWORD_LINE.test(l));
  const pool = clean.length ? clean : arr;
  const notBrand = brand ? pool.filter((l) => l !== brand) : pool;
  const base = notBrand.length ? notBrand : pool;
  const hit = base.find((l) => NAME_PRIORITY.test(l) && l !== brand);
  const noFlavor = base.filter((l) => !FLAVOR_HEAD.test(l));
  // 名字优先级：非品牌行的产地关键词行 > 非风味行 > 池中第一条
  const cand = hit || noFlavor[0] || base[0] || '';
  return { name: cand.slice(0, 40), confidence: cand ? (hit ? 0.75 : 0.5) : 0 };
}

/**
 * 主入口
 * @param {string|string[]} input 多行文本 或 Vision 行数组
 * @returns {{fields: object, confidence: object, rawLines: string[]}}
 */
function parseLabelText(input) {
  const rawLines = Array.isArray(input)
    ? input.map((x) => (typeof x === 'string' ? x : x.text || '')).filter(Boolean)
    : String(input || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const all = rawLines.join('\n');
  const brand = extractBrand(rawLines);
  const name = extractName(rawLines, brand.brand);
  // 名字没把握时（只拿到风味/规格行），用产地兜底
  const origin = extractOrigin(all);
  const weakName = FLAVOR_HEAD.test(name.name) || (origin.origin && origin.origin === name.name) || KEYWORD_LINE.test(name.name);
  const finalName = weakName ? (origin.origin || name.name) : name.name;
  const nameConfidence = weakName ? Math.max(name.confidence, 0.35) : name.confidence;
  const date = extractDate(all);
  const weight = extractWeight(all);
  const price = extractPrice(all);
  const roast = extractRoast(all);
  const processor = extractProcessor(all);
  const flavors = extractFlavors(all);
  const variety = extractVariety(all);
  const altitude = extractAltitude(all);
  return {
    fields: {
      brand: brand.brand,
      name: finalName,
      roastDate: date.date,
      totalWeight: weight.weight,
      price: price.price,
      roastLevel: roast.roastLevel,
      processor: processor.processor,
      origin: origin.origin,
      flavors: flavors.flavors,
      variety: variety.variety,
      altitude: altitude.altitude
    },
    confidence: {
      brand: brand.confidence, name: nameConfidence, roastDate: date.confidence, totalWeight: weight.confidence,
      price: price.confidence, roastLevel: roast.confidence, processor: processor.confidence,
      origin: origin.confidence, flavors: flavors.confidence, variety: variety.confidence, altitude: altitude.confidence
    },
    rawLines
  };
}

module.exports = { parseLabelText, extractDate, extractWeight, extractPrice, extractRoast, extractProcessor, extractOrigin, extractFlavors };
