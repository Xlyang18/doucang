"use strict";
/* 淘宝 / 天猫 / 京东 商品链接与页面文本解析 —— 纯本地、零网络。
 * 输出候选豆子字段，交给 OCR 解析器统一打分。
 */

const SHOP_MAP = [
  ['tmall.com', '天猫'], ['taobao.com', '淘宝'], ['jd.com', '京东'], ['jd.hk', '京东'],
  ['xiaohongshu.com', '小红书'], ['douyin.com', '抖音'], ['pinduoduo.com', '拼多多'], ['yangkeduo.com', '拼多多']
];

function hostOf(u) {
  try { return new URL(u).host.toLowerCase(); } catch (e) { return ''; }
}

function retailerFromUrl(u) {
  const h = hostOf(u);
  for (const [k, v] of SHOP_MAP) if (h.endsWith(k)) return v;
  return '';
}

/** 从链接里提取商品 ID */
function productIdOf(u) {
  const h = hostOf(u);
  try {
    const url = new URL(u);
    if (/taobao|tmall/.test(h)) return url.searchParams.get('id') || (u.match(/[?&]id=(\d+)/) || [])[1] || '';
    if (/jd\.com|jd\.hk/.test(h)) return (u.match(/item\.jd\.com\/(\d+)/) || [])[1] || (u.match(/\/(\d{6,})\.html/) || [])[1] || '';
  } catch (e) { /* ignore */ }
  return '';
}

const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*(克|g|G|千克|kg|KG|公斤|磅|lb)\b/;
const PRICE_RE = /(?:¥|￥|RMB|rmb|价格|售价|单价)\s*[:：]?\s*(\d+(?:\.\d+)?)/g;
const ROAST_RE = [
  [/(极浅|浅烘|浅焙|light\s*roast|lighter)/i, 'light'],
  [/(中深|深烘|深焙|dark\s*roast|法式烘焙|意式烘焙|french\s*roast)/i, 'dark'],
  [/(中浅|medium[\s-]*light)/i, 'medium'],
  [/(中烘|中焙|medium\s*roast|medium)/i, 'medium']
];
const PROCESSOR_RE = [['厌氧厌氧', '厌氧'], ['厌氧', '厌氧'], ['蜜处理', '蜜处理'], ['蜜', '蜜处理'], ['日晒', '日晒'], ['水洗', '水洗'], ['湿刨', '湿刨'], ['natural', '日晒'], ['washed', '水洗'], ['honey', '蜜处理'], ['anaerobic', '厌氧']];
const FLAVOR_WORDS = [
  '花香', '茉莉', '玫瑰', '果酸', '莓果', '蓝莓', '草莓', '樱桃', '柑橘', '橙', '柠檬', '柚子', '苹果', '桃', '葡萄', '荔枝',
  '坚果', '杏仁', '榛子', '焦糖', '太妃', '巧克力', '可可', '奶油', '蜂蜜', '红糖', '酒香', '朗姆', '威士忌', '烟熏',
  '茶感', '乌龙', '红茶', '绿茶', '香料', '肉桂', '丁香'
];
const ORIGIN_WORDS = ['埃塞俄比亚', '耶加雪菲', '西达摩', '古吉', '哥伦比亚', '巴西', '危地马拉', '哥斯达黎加', '巴拿马', '瑰夏', '肯尼亚', '印尼', '曼特宁', '苏门答腊', '云南', '保山', '普洱', '坦桑尼亚', '萨尔瓦多', '洪都拉斯', '秘鲁', '墨西哥', '卢旺达', '布隆迪', '厄瓜多尔'];

function normalizeWeight(g, unit) {
  const n = Number(g);
  if (!Number.isFinite(n)) return 0;
  const u = String(unit).toLowerCase();
  if (u === 'kg' || u === '千克' || u === '公斤') return n * 1000;
  if (u === '磅' || u === 'lb') return Math.round(n * 453.6);
  return n;
}

function dateFromText(t) {
  const s = String(t);
  const ymd = s.match(/(20\d{2})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})/);
  if (ymd) return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;
  const md = s.match(/(?<![\d])(\d{1,2})\s*[./月]\s*(\d{1,2})\s*日?/);
  if (md) {
    const now = new Date();
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      let year = now.getFullYear();
      // 烘焙日期一般不远：如果算出来比今天晚 30 天以上，视为去年的
      const cand = new Date(year, m - 1, d);
      if (cand.getTime() - now.getTime() > 30 * 86400000) year -= 1;
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return '';
}

function roastFromText(t) {
  for (const [re, v] of ROAST_RE) if (re.test(t)) return v;
  return '';
}

function processorFromText(t) {
  const s = String(t).toLowerCase();
  for (const [k, v] of PROCESSOR_RE) if (s.includes(k)) return v;
  return '';
}

function flavorsFromText(t) {
  const s = String(t);
  const out = [];
  for (const w of FLAVOR_WORDS) if (s.includes(w)) {
    // 简化到标签：橙/柠檬/柚子 → 柑橘，茉莉/玫瑰 → 花香
    let tag = w;
    if (['橙', '柠檬', '柚子', '橘子'].includes(w)) tag = '柑橘';
    if (['茉莉', '玫瑰', '花'].includes(w)) tag = '花香';
    if (['蓝莓', '草莓', '樱桃', '莓果', '葡萄', '荔枝'].includes(w)) tag = '莓果';
    if (['杏仁', '榛子', '坚果'].includes(w)) tag = '坚果';
    if (['太妃', '焦糖'].includes(w)) tag = '焦糖';
    if (['巧克力', '可可'].includes(w)) tag = '巧克力';
    if (['朗姆', '威士忌', '酒香'].includes(w)) tag = '酒香';
    if (['乌龙', '红茶', '绿茶', '茶'].includes(w)) tag = '茶感';
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 8);
}

/** 品牌名往往在标题开头 */
function brandFromTitle(t) {
  const s = String(t).replace(/【[^】]*】|\[[^\]]*\]/g, ' ').trim();
  const seg = s.split(/[\s·|｜,，:：/\\]/).filter(Boolean);
  return seg[0] ? seg[0].slice(0, 24) : '';
}

function originFromText(t) {
  const s = String(t);
  const hit = ORIGIN_WORDS.filter((w) => s.includes(w));
  if (!hit.length) return '';
  const chain = ['埃塞俄比亚', '埃塞'];
  const base = hit.find((h) => chain.includes(h)) || hit[0];
  const sub = hit.find((h) => h !== base);
  return sub ? `${base} ${sub}` : base;
}

/**
 * 解析商品页文本 → 候选字段（含置信度）
 * 返回 { brand, name, price, totalWeight, roastDate, roastLevel, processor, origin, flavors, altitude, variety, retailer, productUrl }
 */
function parseProductText(rawText, url = '') {
  const text = String(rawText || '');
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = {
    brand: '', name: '', price: 0, totalWeight: 0, roastDate: '', roastLevel: '', processor: '',
    origin: '', flavors: [], altitude: '', variety: '', retailer: retailerFromUrl(url), productUrl: url || ''
  };
  // 标题
  let title = '';
  const tm = text.match(/(?:商品标题|宝贝标题|商品名称|名称)\s*[:：]\s*(.+)/);
  if (tm) title = tm[1];
  if (!title && lines[0]) title = lines[0];
  if (title) {
    out.brand = brandFromTitle(title);
    // 豆子名字：去掉品牌后的主标题，压缩到 30 字
    const nm = title.replace(/^【[^】]*】|^\[[^\]]*\]/, '').replace(/¥\s*\d+(\.\d+)?/g, '').trim();
    out.name = nm.slice(0, 40);
  }
  // 价格：优先"到手价/券后价"，其次第一个 ¥ 数字
  const priceKey = text.match(/(?:到手价|券后价|活动价|实付|售价|价格)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
  if (priceKey) out.price = Number(priceKey[1]);
  else {
    const all = [...text.matchAll(PRICE_RE)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 100000);
    if (all.length) out.price = Math.min(...all);
  }
  // 克重
  const wm = text.match(WEIGHT_RE);
  if (wm) out.totalWeight = normalizeWeight(wm[1], wm[2]);
  // 烘焙日期
  const dm = text.match(/(?:烘焙日|烘焙时间|生产日期|日期)\s*[:：]?\s*([^\n]{4,24})/);
  out.roastDate = dateFromText(dm ? dm[1] : text.slice(0, 4000));
  // 烘焙度
  const rm = text.match(/(?:烘焙度|烘焙程度|烘焙)\s*[:：]?\s*([^\n]{1,20})/);
  out.roastLevel = roastFromText(rm ? rm[1] : text);
  // 处理法
  const pm = text.match(/(?:处理法|处理方式|工艺)\s*[:：]?\s*([^\n]{1,20})/);
  out.processor = processorFromText(pm ? pm[1] : text);
  out.origin = originFromText(text);
  out.flavors = flavorsFromText(text);
  const am = text.match(/(\d{3,4})\s*[-~—]\s*(\d{3,4})\s*(?:m|米|masl)/i);
  if (am) out.altitude = `${am[1]}-${am[2]}m`;
  const vm = text.match(/(?:品种|豆种)\s*[:：]?\s*([^\n]{2,30})/);
  if (vm) out.variety = vm[1].trim();
  return out;
}

module.exports = { parseProductText, retailerFromUrl, productIdOf, dateFromText, roastFromText, processorFromText, flavorsFromText, hostOf, SHOP_MAP };
