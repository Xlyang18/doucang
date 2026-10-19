/* 分享卡片绘制（离屏 Canvas → PNG），复用 TeamTally png.js 的套路：
 * 固定宽度 1080、2x 缩放、圆角矩形、手绘折线、页脚落款。
 */
const W = 1080;
const SCALE = 2;

const C = {
  bg: '#FBF7F2',
  card: '#FFFFFF',
  ink: '#2A211B',
  ink2: '#7A6A5C',
  ink3: '#B3A89E',
  line: '#EDE4D9',
  accent: '#B0713F',
  accentSoft: '#F3E6D8',
  green: '#4C9A5C',
  red: '#C95A4C',
  orange: '#D98E3F'
};

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function font(size, weight = '500') {
  return `${weight} ${size}px -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif`;
}

function money(n) {
  const x = Number(n) || 0;
  return `¥${x.toLocaleString('zh-CN', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function text(ctx, str, x, y, size, color, weight = '500', align = 'left') {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(str), x, y);
  ctx.textAlign = 'left';
}

function pill(ctx, str, x, y, size = 15) {
  ctx.font = font(size, '500');
  const w = ctx.measureText(str).width + 20;
  rr(ctx, x, y - size * 0.85, w, size * 1.7, size * 0.85);
  ctx.fillStyle = C.accentSoft;
  ctx.fill();
  text(ctx, str, x + 10, y, size, '#8A6547');
  return w + 8;
}

/**
 * drawShareCard(ctx, payload)
 * payload: { season, beans:[{brand,name,rating,flavors,roastLevel}], settings, generatedAt, mode:'season'|'bean' }
 * 返回 { width, height }
 */
export function drawShareCard(ctx, payload) {
  const { season, beans = [], generatedAt, mode = 'season' } = payload;
  const H = mode === 'bean' ? 760 : 1080;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部品牌行
  ctx.fillStyle = C.accent;
  rr(ctx, 56, 48, 52, 52, 16);
  ctx.fill();
  text(ctx, '豆', 82, 74, 26, '#fff', '700', 'center');
  text(ctx, '豆藏 · COFFEE VAULT', 126, 66, 22, C.ink, '700');
  text(ctx, generatedAt || '', 126, 92, 14, C.ink3, '400');

  if (mode === 'bean') {
    const b = beans[0] || {};
    text(ctx, b.brand || '未知品牌', 56, 156, 22, C.ink2, '500');
    wrapText(ctx, b.name || '未命名豆子', 56, 196, W - 112, 40, 36, C.ink, '700');
    const flavors = (b.flavors || []).slice(0, 6);
    let px = 56;
    let py = 300;
    ctx.font = font(17, '500');
    for (const f of flavors) {
      const w = ctx.measureText(f).width + 24;
      if (px + w > W - 56) { px = 56; py += 44; }
      rr(ctx, px, py - 17, w, 34, 17);
      ctx.fillStyle = C.accentSoft;
      ctx.fill();
      text(ctx, f, px + 12, py, 17, '#8A6547');
      px += w + 10;
    }
    const stats = [
      ['烘焙度', { light: '浅烘', medium: '中烘', dark: '深烘' }[b.roastLevel] || '—'],
      ['单杯成本', money(b.costPerServing)],
      ['价格', money(b.price)],
      ['评分', b.rating ? '★'.repeat(b.rating) : '未评分']
    ];
    statRow(ctx, stats, 56, H - 220, W - 112);
    text(ctx, b.notes || '一杯好咖啡，值得被记住。', 56, H - 130, 17, C.ink2, '400');
    footer(ctx, H);
    ctx.restore();
    return { width: W, height: H };
  }

  // 主张
  text(ctx, `这季我喝了 ${season.cups} 杯咖啡`, 56, 170, 38, C.ink, '700');
  text(ctx, `${season.title} · 一共开了 ${season.beans} 袋豆子`, 56, 214, 18, C.ink2, '400');

  // 四个数据块
  statRow(ctx, [
    ['消耗克数', `${season.grams} g`],
    ['真实花费', money(season.cost)],
    ['平均单杯', money(season.avgCostPerCup)],
    ['喝过的品牌', `${season.topBrands.length} 家`]
  ], 56, 300, W - 112);

  // 风味画像
  rr(ctx, 56, 400, W - 112, 190, 20);
  ctx.fillStyle = C.card;
  ctx.fill();
  text(ctx, '这一季的风味画像', 84, 436, 20, C.ink, '700');
  let px = 84;
  let py = 490;
  for (const f of (season.topFlavors.length ? season.topFlavors : ['还没记录风味'])) {
    const w = pill(ctx, f, px, py, 17);
    px += w;
    if (px > W - 200) { px = 84; py += 52; }
  }
  text(ctx, `烘焙度分布：浅 ${season.roastCounts.light || 0} · 中 ${season.roastCounts.medium || 0} · 深 ${season.roastCounts.dark || 0}`, 84, 556, 16, C.ink2);

  // 榜单
  text(ctx, '本季最爱', 56, 640, 22, C.ink, '700');
  const list = beans.slice(0, 4);
  let y = 686;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    rr(ctx, 56, y - 26, W - 112, 58, 14);
    ctx.fillStyle = C.card;
    ctx.fill();
    text(ctx, `#${i + 1}`, 80, y + 3, 16, C.accent, '700');
    text(ctx, `${b.brand ? b.brand + ' · ' : ''}${b.name}`, 126, y + 3, 18, C.ink, '600');
    text(ctx, b.rating ? '★'.repeat(b.rating) : '—', W - 84, y + 3, 16, C.accent, '600', 'right');
    y += 66;
  }

  footer(ctx, H);
  ctx.restore();
  return { width: W, height: H };
}

function statRow(ctx, items, x, y, totalW) {
  const gap = 14;
  const w = (totalW - gap * (items.length - 1)) / items.length;
  items.forEach(([label, value], i) => {
    const x0 = x + i * (w + gap);
    rr(ctx, x0, y, w, 78, 16);
    ctx.fillStyle = C.card;
    ctx.fill();
    text(ctx, label, x0 + 18, y + 26, 14, C.ink3, '400');
    text(ctx, value, x0 + 18, y + 54, 24, C.ink, '700');
  });
}

function wrapText(ctx, str, x, y, maxW, lineH, size, color, weight) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  const chars = String(str).split('');
  let line = '';
  let yy = y;
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineH;
    } else {
      line += ch;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function footer(ctx, H) {
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, H - 78);
  ctx.lineTo(W - 56, H - 78);
  ctx.stroke();
  text(ctx, '豆藏 · 为每一杯好咖啡而生', 56, H - 48, 14, C.ink3, '500');
  text(ctx, '由豆藏生成', W - 56, H - 48, 14, C.ink3, '500', 'right');
}

/**
 * drawBeanCard(ctx, payload)
 * 单袋豆子卡：1080×760，信息带（产地/烘焙度/处理法）+ 4 个数据块 + 风味 + 备注
 */
function drawBeanCard(ctx, payload) {
  const { beans = [], generatedAt } = payload;
  const b = beans[0] || {};
  const H = 760;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = C.accent;
  rr(ctx, 56, 48, 52, 52, 16);
  ctx.fill();
  text(ctx, '豆', 82, 74, 26, '#fff', '700', 'center');
  text(ctx, '豆藏 · COFFEE VAULT', 126, 66, 22, C.ink, '700');
  text(ctx, generatedAt || '', 126, 92, 14, C.ink3, '400');

  text(ctx, b.brand || '未知品牌', 56, 156, 22, C.ink2, '500');
  wrapText(ctx, b.name || '未命名豆子', 56, 196, W - 112, 42, 36, C.ink, '700');

  // 信息胶囊：产地 / 处理法 / 海拔
  let px = 56;
  const py = 268;
  ctx.font = font(17, '500');
  for (const v of [b.origin, b.processor, b.altitude].filter(Boolean)) {
    const pw = ctx.measureText(v).width + 24;
    if (px + pw > W - 56) break;
    rr(ctx, px, py - 17, pw, 34, 17);
    ctx.fillStyle = C.accentSoft;
    ctx.fill();
    text(ctx, v, px + 12, py, 17, '#8A6547');
    px += pw + 10;
  }

  // 风味
  let fx = 56;
  let fy = 336;
  for (const f of (b.flavors || []).slice(0, 8)) {
    const w = pill(ctx, f, fx, fy, 18);
    fx += w;
    if (fx > W - 200) { fx = 56; fy += 50; }
  }

  // 养豆 / 赏味时间轴
  const tl = { x: 80, y: 440, w: W - 160 };
  const dates = [b.roastDate, b.restEnd, b.peakEnd].filter(Boolean);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tl.x + tl.w, tl.y);
  ctx.stroke();
  const labels = ['烘焙', '养豆完成', '赏味截止'];
  dates.forEach((d, i) => {
    const x = tl.x + (dates.length > 1 ? (i / (dates.length - 1)) * tl.w : 0);
    ctx.beginPath();
    ctx.arc(x, tl.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? C.accent : C.ink3;
    ctx.fill();
    text(ctx, labels[i], x, tl.y - 22, 13, C.ink3, '400', i === 0 ? 'left' : i === dates.length - 1 ? 'right' : 'center');
    text(ctx, d, x, tl.y + 26, 15, C.ink2, '600', i === 0 ? 'left' : i === dates.length - 1 ? 'right' : 'center');
  });

  // 数据块
  const roast = { light: '浅烘', medium: '中烘', dark: '深烘' }[b.roastLevel] || '—';
  const method = { pour: '手冲', espresso: '意式', immersion: '浸泡' }[b.brewMethod] || '';
  statRow(ctx, [
    [method ? `${method}豆` : '烘焙度', roast],
    ['单杯成本', money(b.costPerServing)],
    ['整袋价格', money(b.price)],
    ['我的评分', b.rating ? '★'.repeat(b.rating) : '未评分']
  ], 56, H - 236, W - 112);

  // 备注 / 推荐语
  const note = String(b.notes || '').slice(0, 60) || '一杯好咖啡，值得被记住。';
  wrapText(ctx, `「${note}」`, 56, H - 118, W - 112, 30, 19, C.ink2, '400');

  footer(ctx, H);
  ctx.restore();
  return { width: W, height: H };
}

/** 生成 PNG 字节：在主线程用 OffscreenCanvas / DOM canvas 渲染 */
export async function renderSharePng(payload) {
  const mode = payload.mode || 'season';
  const H = mode === 'bean' ? 760 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (mode === 'bean') drawBeanCard(ctx, payload);
  else drawShareCard(ctx, payload);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  return { bytes: buf, width: W, height: H };
}
