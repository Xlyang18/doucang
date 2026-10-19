import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Cell
} from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { summarize, resolveBean, roastLabel, todayStr } from '../lib/calc.js';
import { formatMoney, formatNum } from '../lib/format.js';
import { PageHead, Panel, EmptyState, StatCard, Tabs, Meter } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import {
  ROAST_COLORS, brandRanking, roastMatrix, flavorMatrix, monthlyFlow, recentMonths,
  repurchaseStats, paceStats, ratingBoard, seasonSummary
} from '../lib/stats.js';

function Tip({ active, payload, label, money = false, unit = '' }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      <span className="tip-label">{label}</span>
      {payload.map((p, i) => (
        <span key={i} className="tip-row">
          <i style={{ background: p.color || p.stroke || '#B0713F' }} />
          {p.name}：{money ? formatMoney(p.value) : `${p.value}${unit}`}
        </span>
      ))}
    </div>
  );
}

const TABS = [
  { value: 'overview', label: '总览' },
  { value: 'brand', label: '品牌排行' },
  { value: 'cross', label: '烘焙 × 评分' },
  { value: 'flavor', label: '风味 × 评分' },
  { value: 'flow', label: '月度消耗' },
  { value: 'repurchase', label: '复购率' },
  { value: 'pace', label: '喝的速度' }
];

export default function StatsPage() {
  const { data, resolvedTheme, go, rebuyToWishlist, toast } = useApp();
  const settings = data.settings;
  const beans = data.beans || [];
  const [tab, setTab] = useState('overview');

  const dark = resolvedTheme === 'dark';
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const tick = dark ? '#98989D' : '#86868B';
  const accent = dark ? '#D98E5A' : '#B0713F';

  const sum = useMemo(() => summarize(beans, settings), [beans, settings]);
  const today = todayStr();
  const months = useMemo(() => recentMonths(12, today), [today]);
  const flow = useMemo(() => monthlyFlow(beans, months), [beans, months]);
  const brands = useMemo(() => brandRanking(beans, settings), [beans, settings]);
  const roast = useMemo(() => roastMatrix(sum.rows), [sum.rows]);
  const flavors = useMemo(() => flavorMatrix(beans), [beans]);
  const repurchase = useMemo(() => repurchaseStats(beans), [beans]);
  const pace = useMemo(() => paceStats(beans, settings), [beans, settings]);
  const board = useMemo(() => ratingBoard(beans, settings), [beans, settings]);
  const season = useMemo(() => seasonSummary(beans, settings, today), [beans, settings, today]);

  if (beans.length === 0) {
    return (
      <div className="page-inner">
        <PageHead title="数据统计" sub="还没有数据" />
        <EmptyState icon="chart" title="先记几袋豆子，这里才有东西可看" desc="添加豆子并记录几杯冲煮，统计页会自动生成。" action={<button className="btn btn-primary" onClick={() => go('beans')}>去添加豆子</button>} />
      </div>
    );
  }

  return (
    <div className="page-inner">
      <PageHead
        title="数据统计"
        sub={`${sum.count} 袋 · ${sum.brewCount} 杯 · 截至 ${sum.today}`}
        actions={
          <button className="btn btn-primary" onClick={() => go('shared', { mode: 'season' })}>
            <Icon name="share" size={14} /> 生成分享卡片
          </button>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <section className="stat-grid">
            <StatCard label="全部购入" value={formatMoney(sum.spentAll)} sub={`${sum.count} 袋`} icon="box" accent="brown" />
            <StatCard label="真实已花" value={formatMoney(sum.spentConsumed)} sub={`已喝 ${sum.brewCount} 杯`} icon="cup" accent="green" />
            <StatCard label="库存市值" value={formatMoney(sum.stockValue)} sub={`${formatNum(sum.stockGrams)}g 待喝`} icon="coffee" accent="red" />
            <StatCard label="真实单杯" value={formatMoney(sum.avgCostPerCupReal)} sub={`理论 ${formatMoney(sum.avgCostPerCupTheoretical)}`} icon="leaf" accent="blue" />
          </section>

          <section className="charts-grid two">
            <Panel title="月度流动" sub="购入金额 vs 实际消耗克数">
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={flow} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v}`} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}g`} />
                  <Tooltip content={<Tip />} />
                  <Bar yAxisId="l" dataKey="buy" name="购入金额" fill={accent} radius={[4, 4, 0, 0]} barSize={16} />
                  <Line yAxisId="r" type="monotone" dataKey="grams" name="消耗克数" stroke="#4C9A5C" strokeWidth={2.2} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="评分榜" sub="按我的评分排序">
              {board.length === 0 ? <p className="muted">还没有评分的豆子。</p> : (
                <div className="rank-list">
                  {board.slice(0, 8).map((r, i) => (
                    <div key={r.bean.id} className="rank-row" onClick={() => go('beans', { detail: r.bean.id })}>
                      <span className={`rank-no rank-${i + 1}`}>#{i + 1}</span>
                      <span className="rank-name">{r.bean.brand ? `${r.bean.brand} · ` : ''}{r.bean.name}</span>
                      <span className="rank-stars">{'★'.repeat(r.bean.rating)}</span>
                      <span className="rank-side">{formatMoney(r.snap.costPerServing)}/杯</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>

          <Panel title={`本季 · ${season.title}`} sub="分享卡片的数据来源" actions={<button className="btn btn-sm" onClick={() => go('shared', { mode: 'season' })}><Icon name="share" size={13} /> 生成卡片</button>}>
            <div className="season-brief">
              <div><i>喝了几杯</i><b>{season.cups}</b></div>
              <div><i>开了几袋</i><b>{season.beans}</b></div>
              <div><i>消耗克数</i><b>{season.grams}g</b></div>
              <div><i>真实花费</i><b>{formatMoney(season.cost)}</b></div>
              <div><i>平均单杯</i><b>{formatMoney(season.avgCostPerCup)}</b></div>
              <div><i>偏好风味</i><b>{season.topFlavors.slice(0, 3).join(' · ') || '—'}</b></div>
            </div>
          </Panel>
        </>
      )}

      {tab === 'brand' && (
        <Panel title="品牌排行" sub={`共 ${brands.length} 个品牌 · 按累计花费排序`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>品牌</th><th>入仓袋数</th><th>累计花费</th><th>平均评分</th><th>冲煮杯数</th><th>平均单杯</th><th>合计克数</th></tr>
              </thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr key={b.brand}>
                    <td>{i + 1}</td>
                    <td className="strong">{b.brand}</td>
                    <td>{b.bags}</td>
                    <td>{formatMoney(b.spent)}</td>
                    <td>{b.avgRating ? '★'.repeat(Math.round(b.avgRating)) : '—'}</td>
                    <td>{b.cups}</td>
                    <td>{b.avgCost ? formatMoney(b.avgCost) : '—'}</td>
                    <td>{b.grams}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-box" style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={Math.max(180, brands.slice(0, 8).length * 34)}>
              <BarChart data={brands.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 24, left: 16, bottom: 0 }}>
                <CartesianGrid stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v}`} />
                <YAxis type="category" dataKey="brand" width={92} tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip money />} cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="spent" name="累计花费" fill={accent} radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {tab === 'cross' && (
        <>
          <section className="charts-grid two">
            <Panel title="烘焙度 × 平均评分" sub="五颗星制">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={roast} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip unit=" 分" />} />
                  <Bar dataKey="avgRating" name="平均评分" radius={[6, 6, 0, 0]} barSize={46}>
                    {roast.map((r) => <Cell key={r.key} fill={ROAST_COLORS[r.key]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="烘焙度 × 平均单杯" sub="按该烘焙度所有豆子的单杯成本均值">
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>烘焙度</th><th>袋数</th><th>平均评分</th><th>平均单杯</th><th>冲煮杯数</th></tr></thead>
                  <tbody>
                    {roast.map((r) => (
                      <tr key={r.key}>
                        <td><span className="roast-chip">{r.label}</span></td>
                        <td>{r.bags}</td>
                        <td>{r.avgRating ? `${r.avgRating} ★` : '—'}</td>
                        <td>{r.avgCost ? formatMoney(r.avgCost) : '—'}</td>
                        <td>{r.cups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small" style={{ marginTop: 12 }}>
                提示：如果你给浅烘的平均分明显高于深烘，下一袋就可以优先补浅烘。
              </p>
            </Panel>
          </section>
        </>
      )}

      {tab === 'flavor' && (
        <Panel title="风味 × 评分" sub="降序：平均评分优先，其次出现次数">
          {flavors.length === 0 ? <p className="muted">还没有记录风味标签。</p> : (
            <>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={Math.max(200, Math.min(flavors.length, 12) * 34)}>
                  <BarChart data={flavors.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid stroke={grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="tag" width={72} tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip unit=" 分" />} cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="avgRating" name="平均评分" fill={accent} radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flavor-grid">
                {flavors.slice(0, 18).map((f) => (
                  <div key={f.tag} className="flavor-cell">
                    <div className="fc-head"><b>{f.tag}</b><span>{f.n} 次</span></div>
                    <Meter value={f.avgRating} max={5} cls="accent" suffix={f.avgRating ? `${f.avgRating} ★` : '未评分'} />
                    <span className="muted small">{f.brands.slice(0, 3).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === 'flow' && (
        <Panel title="月度消耗曲线" sub="购入（元）与消耗（克）分开看：买得多不代表喝得多">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={flow} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4C9A5C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4C9A5C" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v}`} />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}g`} />
              <Tooltip content={<Tip />} />
              <Bar yAxisId="l" dataKey="buy" name="购入金额" fill={accent} radius={[4, 4, 0, 0]} barSize={14} opacity={0.75} />
              <Area yAxisId="r" type="monotone" dataKey="grams" name="消耗克数" stroke="#4C9A5C" strokeWidth={2.4} fill="url(#flowGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead><tr><th>月份</th><th>购入金额</th><th>消耗克数</th><th>冲煮杯数</th></tr></thead>
              <tbody>
                {[...flow].reverse().map((m) => (
                  <tr key={m.key}><td>{m.key}</td><td>{formatMoney(m.buy)}</td><td>{m.grams}g</td><td>{m.cups}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'repurchase' && (
        <>
          <section className="stat-grid three">
            <StatCard label="复购率" value={`${repurchase.rate}%`} sub={`${repurchase.repeatedSkus} / ${repurchase.totalSkus} 个豆子买过两次以上`} icon="refresh" accent="green" />
            <StatCard label="回购袋数" value={repurchase.bagsRepeat} sub="来自复购豆子的入仓袋数" icon="box" accent="brown" />
            <StatCard label="只买过一次" value={repurchase.singleSkus} sub="没有回购的豆子数量" icon="star" accent="blue" />
          </section>
          <Panel title="回购清单" sub="同一豆子买过 ≥2 次 · 一键加回心愿单">
            {repurchase.repeated.length === 0 ? (
              <p className="muted">还没有回购过的豆子。喝完一袋觉得好喝，点「回购」就会进这里的统计。</p>
            ) : (
              <div className="rank-list">
                {repurchase.repeated.map((g) => (
                  <div key={g.key} className="rank-row">
                    <span className="rank-no">×{g.bags}</span>
                    <span className="rank-name">{g.brand ? `${g.brand} · ` : ''}{g.name}</span>
                    <span className="rank-stars">{g.avgRating ? '★'.repeat(Math.round(g.avgRating)) : ''}</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        const bean = beans.find((b) => b.name === g.name && (b.brand || '') === g.brand);
                        if (bean) { rebuyToWishlist(bean); toast(`「${bean.name}」已加入心愿单`); }
                      }}
                    >
                      <Icon name="refresh" size={12} /> 再买
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'pace' && (
        <>
          <section className="stat-grid">
            <StatCard label="平均每天" value={`${pace.cupsPerDay} 杯`} sub={pace.spanDays ? `统计跨度 ${pace.spanDays} 天` : '暂无跨度'} icon="cup" accent="green" />
            <StatCard label="平均每袋" value={pace.avgDaysPerBag != null ? `${pace.avgDaysPerBag} 天` : '—'} sub="按喝完日期计算" icon="calendar" accent="orange" />
            <StatCard label="库存可撑" value={pace.daysLeft != null ? `≈ ${pace.daysLeft} 天` : '—'} sub={`${formatNum(pace.stockGrams)}g / ${pace.stockCups} 杯`} icon="coffee" accent="brown" />
            <StatCard label="总杯数" value={pace.totalCups} sub={pace.from ? `${pace.from} → ${pace.to}` : '—'} icon="chart" accent="blue" />
          </section>
          <Panel title="喝的节奏" sub="用「库存可撑天数」决定什么时候补货">
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={flow} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip unit=" 杯" />} />
                  <Line type="monotone" dataKey="cups" name="每月杯数" stroke={accent} strokeWidth={2.4} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="muted small">
              按当前速度，库存大约还能撑 {pace.daysLeft != null ? `${pace.daysLeft} 天` : '（记录更多冲煮后估算）'}；到剩 7 天时豆藏会在桌面提醒你补货。
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
