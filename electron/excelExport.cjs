"use strict";
/* Excel 导出 —— 复刻 TeamTally 的排版套路（exceljs）：冻结表头 + 品牌色表头 + 金额格式 + 汇总行 */
const ExcelJS = require('exceljs');

const BRAND = 'FFB0713F';
const HEAD = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } },
  alignment: { vertical: 'middle', horizontal: 'center' }
};
const MONEY = '¥#,##0.00';
const CENTER = { alignment: { horizontal: 'center', vertical: 'middle' } };
const THIN = { style: 'thin', color: { argb: 'FFE8E2DA' } };

function money(n) {
  const x = Number(n) || 0;
  return Math.round(x * 100) / 100;
}

function styleHeader(ws, columns) {
  ws.columns = columns;
  const row = ws.getRow(1);
  row.height = 24;
  row.eachCell((c) => {
    c.style = HEAD;
    c.border = { bottom: { style: 'medium', color: { argb: 'FF6E4426' } } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const COL = (header, key, width, style) => ({ header, key, width, style });

/**
 * exportWorkbook({ file, beans, wishlist, settings, summarize, resolveBean, today })
 * 6 个 sheet：豆仓总表 / 冲煮记录 / 采购台账 / 心愿单 / 风味评分 / 年度汇总
 */
async function exportWorkbook({ file, beans = [], wishlist = [], settings = {}, summarize, resolveBean, today }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '豆藏';
  wb.created = new Date();
  wb.properties.title = `豆藏 · 咖啡豆台账（${today}）`;

  const sum = summarize(beans, settings, today);
  const methodName = { pour: '手冲', espresso: '意式', immersion: '浸泡/冷萃' };
  const roastName = { light: '浅烘', medium: '中烘', dark: '深烘' };

  /* ---------- 1. 豆仓总表 ---------- */
  const ws1 = wb.addWorksheet('豆仓总表');
  styleHeader(ws1, [
    COL('品牌', 'brand', 18), COL('豆子名称', 'name', 30), COL('产地', 'origin', 18),
    COL('处理法', 'processor', 12), COL('烘焙度', 'roast', 10, CENTER), COL('烘焙日期', 'roastDate', 13, CENTER),
    COL('购买日期', 'purchaseDate', 13, CENTER), COL('价格(元)', 'price', 12, { numFmt: MONEY }),
    COL('总量(g)', 'totalWeight', 10, CENTER), COL('已用(g)', 'used', 10, CENTER),
    COL('剩余(g)', 'left', 10, CENTER), COL('冲煮杯数', 'cups', 10, CENTER),
    COL('单杯成本(元)', 'cps', 13, { numFmt: MONEY }), COL('状态', 'status', 12, CENTER),
    COL('评分', 'rating', 8, CENTER), COL('风味', 'flavors', 26), COL('渠道', 'retailer', 10, CENTER),
    COL('链接', 'url', 30), COL('备注', 'notes', 36)
  ]);
  for (const b of beans) {
    const s = resolveBean(b, settings, today);
    ws1.addRow({
      brand: b.brand || '', name: b.name || '', origin: b.origin || '', processor: b.processor || '',
      roast: roastName[b.roastLevel] || '', roastDate: b.roastDate || '', purchaseDate: b.purchaseDate || '',
      price: money(b.price), totalWeight: Number(b.totalWeight) || 0, used: s.used, left: s.left,
      cups: s.brewCount, cps: money(s.costPerServing), status: s.meta.label,
      rating: b.rating || '', flavors: (b.flavors || []).join(' / '),
      retailer: b.retailer || '', url: b.productUrl || '', notes: (b.notes || '').replace(/\n/g, ' ')
    });
  }
  ws1.autoFilter = 'A1:S1';
  addBorder(ws1);

  /* ---------- 2. 冲煮记录 ---------- */
  const ws2 = wb.addWorksheet('冲煮记录');
  styleHeader(ws2, [
    COL('日期', 'date', 13, CENTER), COL('品牌', 'brand', 16), COL('豆子', 'name', 26),
    COL('器具', 'method', 10, CENTER), COL('粉量(g)', 'dose', 10, CENTER), COL('粉水比', 'ratio', 10, CENTER),
    COL('用量(g)', 'grams', 10, CENTER), COL('该杯成本(元)', 'cost', 13, { numFmt: MONEY }),
    COL('评分', 'rating', 8, CENTER), COL('心得', 'note', 40)
  ]);
  const brewRows = [];
  for (const b of beans) {
    const s = resolveBean(b, settings, today);
    (b.brewings || []).forEach((br) => brewRows.push({ b, s, br }));
  }
  brewRows.sort((x, y) => String(y.br.date).localeCompare(String(x.br.date)));
  for (const { b, s, br } of brewRows) {
    ws2.addRow({
      date: br.date || '', brand: b.brand || '', name: b.name || '', method: methodName[br.method] || br.method || '',
      dose: Number(br.dose) || '', ratio: br.ratio || '', grams: Number(br.grams) || 0,
      cost: money((Number(br.grams) || 0) * s.costPerGram), rating: br.rating || '', note: (br.note || '').replace(/\n/g, ' ')
    });
  }
  ws2.autoFilter = 'A1:J1';
  addBorder(ws2);

  /* ---------- 3. 采购台账（按月） ---------- */
  const ws3 = wb.addWorksheet('采购台账');
  styleHeader(ws3, [
    COL('月份', 'month', 12, CENTER), COL('购入袋数', 'bags', 11, CENTER), COL('采购金额(元)', 'spent', 15, { numFmt: MONEY }),
    COL('合计克数', 'grams', 11, CENTER), COL('冲煮杯数', 'cups', 11, CENTER),
    COL('已消耗成本(元)', 'consumed', 16, { numFmt: MONEY }), COL('单杯均成本(元)', 'avg', 16, { numFmt: MONEY })
  ]);
  const byMonth = new Map();
  for (const b of beans) {
    const s = resolveBean(b, settings, today);
    const d = b.purchaseDate || b.roastDate;
    if (!d) continue;
    const k = d.slice(0, 7);
    const cur = byMonth.get(k) || { bags: 0, spent: 0, grams: 0, cups: 0, consumed: 0 };
    cur.bags += 1;
    cur.spent = money(cur.spent + (Number(b.price) || 0));
    cur.grams += Number(b.totalWeight) || 0;
    cur.cups += s.brewCount;
    cur.consumed = money(cur.consumed + s.realSpent);
    byMonth.set(k, cur);
  }
  [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([k, v]) => {
    ws3.addRow({
      month: k, bags: v.bags, spent: v.spent, grams: v.grams, cups: v.cups, consumed: v.consumed,
      avg: v.cups ? money(v.consumed / v.cups) : ''
    });
  });
  addTotalRow(ws3, ['合计', sum.count, money(sum.spentAll), Math.round(beans.reduce((a, b) => a + (Number(b.totalWeight) || 0), 0)), sum.brewCount, money(sum.spentConsumed), sum.avgCostPerCupReal]);
  addBorder(ws3);

  /* ---------- 4. 心愿单 ---------- */
  const ws4 = wb.addWorksheet('心愿单');
  styleHeader(ws4, [
    COL('品牌', 'brand', 18), COL('豆子名称', 'name', 30), COL('烘焙度', 'roast', 10, CENTER),
    COL('参考价(元)', 'price', 12, { numFmt: MONEY }), COL('目标价(元)', 'target', 12, { numFmt: MONEY }),
    COL('总量(g)', 'weight', 10, CENTER), COL('渠道', 'retailer', 10, CENTER), COL('链接', 'url', 34),
    COL('来源(回购)', 'rebuy', 14, CENTER), COL('加入时间', 'created', 13, CENTER), COL('备注', 'notes', 34)
  ]);
  for (const w of wishlist) {
    ws4.addRow({
      brand: w.brand || '', name: w.name || '', roast: roastName[w.roastLevel] || '', price: money(w.price),
      target: w.targetPrice == null ? '' : money(w.targetPrice), weight: Number(w.totalWeight) || 0,
      retailer: w.retailer || '', url: w.productUrl || '', rebuy: w.rebuyFrom ? '回购' : '',
      created: (w.createdAt || '').slice(0, 10), notes: (w.notes || '').replace(/\n/g, ' ')
    });
  }
  addBorder(ws4);

  /* ---------- 5. 风味评分 ---------- */
  const ws5 = wb.addWorksheet('风味评分');
  styleHeader(ws5, [
    COL('风味', 'tag', 14), COL('出现次数', 'n', 11, CENTER), COL('涉及品牌', 'brands', 30),
    COL('平均评分', 'avgRating', 11, { numFmt: '0.00' }), COL('平均单杯成本(元)', 'avgCost', 18, { numFmt: MONEY })
  ]);
  const tagMap = new Map();
  for (const b of beans) {
    const s = resolveBean(b, settings, today);
    for (const f of b.flavors || []) {
      const cur = tagMap.get(f) || { n: 0, brands: new Set(), ratings: [], cost: 0 };
      cur.n += 1;
      if (b.brand) cur.brands.add(b.brand);
      if (b.rating) cur.ratings.push(Number(b.rating));
      cur.cost += s.costPerServing;
      tagMap.set(f, cur);
    }
  }
  [...tagMap.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([tag, v]) => {
    ws5.addRow({
      tag, n: v.n, brands: [...v.brands].join('、'),
      avgRating: v.ratings.length ? money(v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) : '',
      avgCost: v.n ? money(v.cost / v.n) : ''
    });
  });
  addBorder(ws5);

  /* ---------- 6. 年度汇总 ---------- */
  const ws6 = wb.addWorksheet('年度汇总');
  ws6.columns = [{ width: 26 }, { width: 22 }];
  const rows = [
    ['统计口径', `截至 ${today}`],
    ['豆子总数（含已喝完）', sum.count],
    ['在仓袋数', sum.activeCount],
    ['已喝完袋数', sum.finishedCount],
    ['累计采购金额', money(sum.spentAll)],
    ['已消耗成本（真实已花）', money(sum.spentConsumed)],
    ['库存市值（剩余豆子）', money(sum.stockValue)],
    ['库存克数', sum.stockGrams],
    ['冲煮总杯数', sum.brewCount],
    ['累计消耗克数', sum.consumedGrams],
    ['真实平均单杯成本', money(sum.avgCostPerCupReal)],
    ['理论平均单杯成本', money(sum.avgCostPerCupTheoretical)],
    ['平均每袋喝完天数(填过喝完日期)', sum.avgDaysPerBag ?? '—'],
    ['最近一次冲煮', sum.lastBrewDate || '—']
  ];
  rows.forEach(([k, v], i) => {
    const r = ws6.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF6E4426' } };
    if (i % 2 === 1) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF7F2' } }; });
  });

  await wb.xlsx.writeFile(file);
  return { ok: true, file, sheets: ['豆仓总表', '冲煮记录', '采购台账', '心愿单', '风味评分', '年度汇总'] };
}

function addBorder(ws) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = Object.fromEntries(['top', 'left', 'bottom', 'right'].map((k) => [k, THIN]));
      if (cell.alignment && cell.alignment.horizontal === undefined) cell.alignment = { vertical: 'middle' };
    });
  });
}

function addTotalRow(ws, values) {
  const r = ws.addRow(values);
  r.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5EDE4' } };
  });
}

module.exports = { exportWorkbook, money };
