"use strict";
/* 打印页 HTML 生成（主进程用，零依赖）
 * 「美式豆册」版式：每袋豆子一张 A6 大小的卡片，两列排版，A4 打印纸可裁切。
 */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ROAST = { light: '浅烘', medium: '中烘', dark: '深烘' };
const METHOD = { pour: '手冲', espresso: '意式', immersion: '浸泡' };
const STATUS = { resting: '养豆中', peak: '最佳赏味期', past: '已过赏味期', finished: '已喝完', unknown: '待补烘焙时间' };

function money(n) {
  const x = Number(n) || 0;
  return '¥' + x.toLocaleString('zh-CN', { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

function beanCard(bean, snap) {
  const flavors = (bean.flavors || []).map((f) => `<span class="fl">${esc(f)}</span>`).join('');
  const stars = bean.rating ? '★'.repeat(bean.rating) + '☆'.repeat(5 - bean.rating) : '';
  return `
  <div class="card status-${snap.status}">
    <div class="card-top">
      <div class="card-title">
        <div class="brand">${esc(bean.brand || '未知品牌')}</div>
        <div class="name">${esc(bean.name || '未命名豆子')}</div>
      </div>
      <div class="badge">${esc(STATUS[snap.status] || '')}</div>
    </div>
    <div class="meta">
      <span>${esc(ROAST[bean.roastLevel] || '')}</span>
      ${bean.processor ? `<span>${esc(bean.processor)}</span>` : ''}
      ${bean.origin ? `<span>${esc(bean.origin)}</span>` : ''}
      ${bean.altitude ? `<span>${esc(bean.altitude)}</span>` : ''}
    </div>
    <div class="dates">
      <div><i>烘焙</i><b>${esc(bean.roastDate || '—')}</b></div>
      <div><i>养豆完成</i><b>${esc(snap.windows.restEnd || '—')}</b></div>
      <div><i>赏味至</i><b>${esc(snap.windows.peakEnd || '—')}</b></div>
    </div>
    <div class="stats">
      <div><i>价格</i><b>${money(bean.price)}</b></div>
      <div><i>${snap.isFinished ? '已喝完' : '余量'}</i><b>${snap.isFinished ? (bean.finishedDate || '—') : snap.left + 'g'}</b></div>
      <div><i>单杯</i><b>${money(snap.costPerServing)}</b></div>
      <div><i>已喝</i><b>${snap.brewCount} 杯</b></div>
    </div>
    ${flavors ? `<div class="flavors">${flavors}</div>` : ''}
    <div class="card-foot">
      <span>${esc(METHOD[bean.brewMethod] || '')}</span>
      <span class="stars">${stars}</span>
      <span class="url">${bean.productUrl ? esc(bean.productUrl.slice(0, 48)) : ''}</span>
    </div>
    ${bean.notes ? `<div class="notes">${esc(String(bean.notes).slice(0, 120))}</div>` : ''}
  </div>`;
}

function renderPrintHtml({ beans = [], settings = {}, summarize, resolveBean, today, title = '豆藏 · 咖啡豆册' }) {
  const sum = summarize(beans, settings, today);
  const cards = beans.map((b) => beanCard(b, resolveBean(b, settings, today))).join('\n');
  const stat = (k, v) => `<div class="sum-item"><i>${esc(k)}</i><b>${esc(v)}</b></div>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  :root { --ink:#2a211b; --ink2:#7a6a5c; --line:#e6ddd2; --accent:#b0713f; --bg:#fffdfa; }
  * { box-sizing: border-box; }
  body { margin:0; padding:28px 32px; background:var(--bg); color:var(--ink);
    font-family:-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .cover { display:flex; align-items:flex-end; justify-content:space-between; border-bottom:2px solid var(--ink); padding-bottom:14px; margin-bottom:18px; }
  .cover h1 { margin:0; font-size:30px; letter-spacing:2px; }
  .cover .sub { color:var(--ink2); font-size:12px; margin-top:6px; letter-spacing:1px; }
  .cover .badge-bean { width:54px; height:54px; border-radius:50%; background:var(--accent); color:#fff;
    display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; }
  .summary { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:20px; }
  .sum-item { border:1px solid var(--line); border-radius:10px; padding:10px 12px; background:#fff; }
  .sum-item i { display:block; font-style:normal; color:var(--ink2); font-size:11px; margin-bottom:4px; }
  .sum-item b { font-size:17px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid var(--line); border-radius:12px; padding:12px 14px; background:#fff; break-inside:avoid; page-break-inside:avoid; }
  .card.status-peak { border-left:4px solid #4c9a5c; }
  .card.status-resting { border-left:4px solid #d98e3f; }
  .card.status-past { border-left:4px solid #c95a4c; }
  .card.status-finished { border-left:4px solid #b9aea4; }
  .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
  .brand { color:var(--ink2); font-size:11px; letter-spacing:.5px; }
  .name { font-size:16px; font-weight:700; line-height:1.35; margin-top:2px; }
  .badge { font-size:10px; color:var(--ink2); border:1px solid var(--line); border-radius:99px; padding:2px 8px; white-space:nowrap; }
  .meta { margin-top:6px; color:var(--ink2); font-size:11px; }
  .meta span + span::before { content:'·'; margin:0 6px; color:#cbbfb3; }
  .dates { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:9px; }
  .dates i, .stats i { display:block; font-style:normal; color:var(--ink2); font-size:10px; }
  .dates b, .stats b { font-size:12.5px; font-weight:600; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:7px; padding-top:7px; border-top:1px dashed var(--line); }
  .flavors { margin-top:8px; display:flex; flex-wrap:wrap; gap:4px; }
  .fl { font-size:10px; background:#f6efe6; color:#8a6547; border-radius:99px; padding:1px 7px; }
  .card-foot { margin-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--ink2); }
  .stars { color:var(--accent); letter-spacing:1px; }
  .url { max-width:46%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .notes { margin-top:6px; font-size:10.5px; color:#6a5a4d; line-height:1.5; border-top:1px dotted var(--line); padding-top:6px; }
  .foot { margin-top:24px; text-align:center; color:#b3a89e; font-size:10px; letter-spacing:1px; }
  @page { size: A4; margin: 12mm 10mm; }
  @media print { body { padding:0; } .summary { break-inside:avoid; } }
</style>
</head>
<body>
  <div class="cover">
    <div>
      <h1>豆藏 · 咖啡豆册</h1>
      <div class="sub">COFFEE VAULT · 生成于 ${esc(today)} · 共 ${beans.length} 袋</div>
    </div>
    <div class="badge-bean">豆</div>
  </div>
  <div class="summary">
    ${stat('累计采购', money(sum.spentAll))}
    ${stat('真实已花', money(sum.spentConsumed))}
    ${stat('库存市值', money(sum.stockValue))}
    ${stat('库存克数', sum.stockGrams + 'g')}
    ${stat('冲煮杯数', sum.brewCount)}
    ${stat('真实单杯', money(sum.avgCostPerCupReal))}
  </div>
  <div class="grid">${cards || '<div class="card">还没有豆子</div>'}</div>
  <div class="foot">豆藏 · COFFEE VAULT · 为每一杯好咖啡而生</div>
</body>
</html>`;
}

module.exports = { renderPrintHtml };
