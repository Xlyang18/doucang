import React, { memo, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useApp } from '../store/AppContext.jsx';
import { resolveBean, recommendBeans, summarize, purchaseDateOf, STATUS_META, todayStr } from '../lib/calc.js';
import { formatMoney, formatNum } from '../lib/format.js';
import { StatCard, EmptyState, TripToggle, Panel, PageHead, Meter } from '../components/ui.jsx';
import QuickBrewButton from '../components/QuickBrewButton.jsx';
import Icon from '../components/Icon.jsx';
import { ROAST_COLORS, seasonSummary } from '../lib/stats.js';

function ChartTip({ active, payload, label, money = false }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      <span className="tip-label">{label}</span>
      {payload.map((p, i) => (
        <span key={i} className="tip-row">
          <i style={{ background: p.color || p.payload?.color || '#B0713F' }} />
          {money ? formatMoney(p.value) : `${p.name}：${p.value}`}
        </span>
      ))}
    </div>
  );
}

function HomePageInner() {
  const { data, resolvedTheme, go } = useApp();
  const settings = data.settings;
  const beans = data.beans || [];
  const [basis, setBasis] = useState('consumed');

  const dark = resolvedTheme === 'dark';
  const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const tickColor = dark ? '#98989D' : '#86868B';
  const accent = dark ? '#D98E5A' : '#B0713F';

  const sum = useMemo(() => summarize(beans, settings), [beans, settings]);
  const recommend = useMemo(() => recommendBeans(beans, settings, undefined, 3), [beans, settings]);

  const monthly = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: `${d.getMonth() + 1}月`, amount: 0 });
    }
    const map = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const b of beans) {
      const date = purchaseDateOf(b);
      if (!date) continue;
      const key = date.slice(0, 7);
      if (map[key]) map[key].amount += b.price || 0;
    }
    return months;
  }, [beans]);

  const roastData = useMemo(() => {
    const counts = { light: 0, medium: 0, dark: 0 };
    for (const b of beans) if (counts[b.roastLevel] != null) counts[b.roastLevel] += 1;
    const label = { light: '浅烘', medium: '中烘', dark: '深烘' };
    return Object.entries(counts)
      .map(([key, value]) => ({ name: label[key], value, color: ROAST_COLORS[key] }))
      .filter((d) => d.value > 0);
  }, [beans]);

  const statusRows = useMemo(() => {
    const g = { resting: [], peak: [], past: [] };
    for (const b of beans) {
      const s = resolveBean(b, settings);
      if (!b.finished && g[s.status]) g[s.status].push({ b, s });
    }
    for (const k of Object.keys(g)) g[k].sort((x, y) => x.s.progress.days - y.s.progress.days);
    return g;
  }, [beans, settings]);

  const finished = useMemo(
    () => beans.filter((b) => b.finished).sort((a, b) => String(b.finishedDate || '').localeCompare(String(a.finishedDate || ''))),
    [beans]
  );

  const season = useMemo(() => seasonSummary(beans, settings, todayStr()), [beans, settings]);

  const basisCard = basis === 'consumed'
    ? { label: '真实已花', value: formatMoney(sum.spentConsumed), sub: '按已喝掉的部分计 · 不含囤货' }
    : basis === 'all'
      ? { label: '全部购入', value: formatMoney(sum.spentAll), sub: '含囤着还没开的豆子' }
      : { label: '库存市值', value: formatMoney(sum.stockValue), sub: `还剩 ${formatNum(sum.stockGrams)}g` };

  const hasBeans = beans.length > 0;

  return (
    <div className="home">
      <PageHead
        title="首页"
        sub={`你的咖啡数据全景 · ${beans.length} 袋记录 · ${sum.brewCount} 杯冲煮`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => go('wishlist')}>
              <Icon name="star" size={15} /> 心愿单
            </button>
            <button className="btn btn-ghost" onClick={() => go('beans', 'add')}>
              <Icon name="plus" size={15} /> 添加豆子
            </button>
            <button className="btn btn-primary" onClick={() => go('stats')}>
              <Icon name="chart" size={15} /> 数据统计
            </button>
          </>
        }
      />

      {!hasBeans ? (
        <EmptyState
          icon="coffee"
          title="豆仓还是空的"
          desc="把手里这袋豆子收进来：贴个商品链接或拍张包装，养豆期、赏味期和花费都会自动算好。"
          action={
            <button className="btn btn-primary" onClick={() => go('beans', 'add')}>
              <Icon name="plus" size={15} /> 去添加第一袋豆子
            </button>
          }
        />
      ) : (
        <>
          <section className="stat-grid">
            <StatCard label="在仓豆子" value={sum.activeCount} sub={`袋 · 共 ${formatNum(sum.stockGrams)}g`} icon="coffee" accent="brown" onClick={() => go('beans')} />
            <div className="stat-wrap">
              <StatCard label={basisCard.label} value={basisCard.value} sub={basisCard.sub} icon="heart" accent="red" onClick={() => go('stats')} />
              <TripToggle value={basis} onChange={setBasis} />
            </div>
            <StatCard label="冲煮杯数" value={`${sum.brewCount} 杯`} sub={`已消耗 ${formatNum(sum.consumedGrams)}g`} icon="cup" accent="green" onClick={() => go('beans', 'brews')} />
            <StatCard
              label="真实单杯成本"
              value={formatMoney(sum.avgCostPerCupReal)}
              sub={sum.brewCount ? `理论 ${formatMoney(sum.avgCostPerCupTheoretical)} / 杯` : '记录一次冲煮后生效'}
              icon="leaf"
              accent="blue"
              onClick={() => go('stats')}
            />
          </section>

          <Panel
            title="该喝了"
            sub="赏味期内的优先 · 余量大的优先"
            actions={<button className="btn btn-sm btn-ghost" onClick={() => go('beans')}>全部豆子 <Icon name="arrow" size={12} /></button>}
          >
            {recommend.length === 0 ? (
              <p className="muted">暂时没有可以开喝的豆子，都在养豆期里。</p>
            ) : (
              <div className="recommend-row">
                {recommend.map((b) => {
                  const s = resolveBean(b, settings);
                  return (
                    <div key={b.id} className={`recommend-card status-${s.status}`}>
                      <button className="rc-open" onClick={() => go('beans', { detail: b.id })}>
                        <div className="rc-top">
                          <span className="rc-brand">{b.brand || '未知品牌'}</span>
                          <span className={`badge badge-${s.meta.cls}`}>{s.meta.label}</span>
                        </div>
                        <div className="rc-name">{b.name}</div>
                      </button>
                      <Meter
                        value={s.left}
                        max={s.total}
                        cls={s.status === 'peak' ? 'green' : s.status === 'past' ? 'red' : 'orange'}
                        label="余量"
                        suffix={`${formatNum(s.left)}g`}
                      />
                      <div className="rc-foot">
                        <span>{s.progress.text}</span>
                        <span>{formatMoney(s.costPerServing)}/杯</span>
                      </div>
                      <QuickBrewButton bean={b} size="sm" label="喝一杯" />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <section className="charts-grid">
            <div className="panel span-2">
              <div className="panel-head">
                <h3>近 12 个月豆子花费</h3>
                <span className="panel-sub">按购买日期（未填则按烘焙时间）</span>
              </div>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v}`} />
                    <Tooltip content={<ChartTip money />} cursor={{ stroke: accent, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="amount" name="花费" stroke={accent} strokeWidth={2.2} fill="url(#spendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>烘焙程度</h3>
                <span className="panel-sub">全部豆子分布</span>
              </div>
              <div className="chart-box center">
                {roastData.length === 0 ? (
                  <p className="muted">暂无数据</p>
                ) : (
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={roastData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3} stroke="none">
                        {roastData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="pie-legend">
                  {roastData.map((d) => (
                    <span key={d.name} className="legend-item"><i style={{ background: d.color }} /> {d.name} {d.value}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="charts-grid two">
            <div className="panel">
              <div className="panel-head">
                <h3>豆仓状态速览</h3>
                <span className="panel-sub">今日实时判断</span>
              </div>
              <div className="status-list">
                {(['resting', 'peak', 'past']).map((st) => {
                  const items = statusRows[st];
                  const meta = STATUS_META[st];
                  return (
                    <div key={st} className="status-group">
                      <div className="status-group-head">
                        <span className={`dot dot-${meta.cls}`} />
                        <span>{meta.label}</span>
                        <span className="count">{items.length}</span>
                      </div>
                      {items.length === 0 ? (
                        <p className="muted small">暂无</p>
                      ) : items.slice(0, 3).map(({ b, s }) => (
                        <div key={b.id} className="status-row clickable" onClick={() => go('beans', { detail: b.id })}>
                          <span className="s-name">{b.brand ? `${b.brand} · ${b.name}` : b.name}</span>
                          <span className="s-progress">{formatNum(s.left)}g · {s.progress.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>最近喝完</h3>
                <span className="panel-sub">可一键回购</span>
              </div>
              {finished.length === 0 ? (
                <p className="muted">还没有喝完的豆子，喝完记得标记一下。</p>
              ) : (
                <div className="finished-list">
                  {finished.slice(0, 5).map((b) => {
                    const s = resolveBean(b, settings);
                    return (
                      <div key={b.id} className="finished-row">
                        <div className="f-main">
                          <span className="f-name">{b.brand ? `${b.brand} · ${b.name}` : b.name}</span>
                          <span className="f-meta">
                            {s.actualDays != null ? `${s.actualDays} 天喝完 · ` : ''}{s.brewCount} 杯 · {formatMoney(b.price)}
                          </span>
                        </div>
                        <div className="f-side">
                          <span className="f-date">{b.finishedDate || '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <Panel
            title={`本季概览 · ${season.title}`}
            sub={`${season.cups} 杯 · ${season.beans} 袋 · ${season.grams}g`}
            actions={
              <button className="btn btn-sm" onClick={() => go('shared', { mode: 'season' })}>
                <Icon name="share" size={13} /> 生成本季分享卡片
              </button>
            }
          >
            <div className="season-brief">
              <div><i>平均单杯</i><b>{formatMoney(season.avgCostPerCup)}</b></div>
              <div><i>真实花费</i><b>{formatMoney(season.cost)}</b></div>
              <div><i>偏好风味</i><b>{season.topFlavors.slice(0, 4).join(' · ') || '—'}</b></div>
              <div><i>喝过的品牌</i><b>{season.topBrands.join(' · ') || '—'}</b></div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

export default memo(HomePageInner);
