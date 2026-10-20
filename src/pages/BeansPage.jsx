import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import {
  resolveBean, beanStatus, roastLabel, ROAST_LEVELS, methodLabel, todayStr, numOrNull
} from '../lib/calc.js';
import { formatMoney, formatNum } from '../lib/format.js';
import { normalizeBean } from '../lib/dedup.js';
import { Modal, ConfirmDialog, EmptyState, Segmented, Stars, Field, Meter, Tabs, PageHead, Panel } from '../components/ui.jsx';
import BeanFormModal from '../components/BeanFormModal.jsx';
import Sticker from '../components/Sticker.jsx';
import QuickBrewButton from '../components/QuickBrewButton.jsx';
import ImportCapture from './ImportCapture.jsx';
import { takePendingPrefill, peekPendingPrefill } from '../lib/prefill.js';
import Icon from '../components/Icon.jsx';

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'resting', label: '养豆中' },
  { value: 'peak', label: '最佳赏味期' },
  { value: 'past', label: '已过赏味期' },
  { value: 'finished', label: '已喝完' }
];

export default function BeansPage() {
  const {
    data, pageParam, go, toast, addBean, saveBean, removeBean,
    logBrewing, removeBrewing, finishBean, restoreBean, rebuyToWishlist
  } = useApp();
  const settings = data.settings;
  const beans = data.beans || [];
  const [tab, setTab] = useState(pageParam === 'brews' ? 'brews' : 'beans');
  const [importOpen, setImportOpen] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [filter, setFilter] = useState('all');
  const [roast, setRoast] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [form, setForm] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [brewTarget, setBrewTarget] = useState(null);
  // C4：记录被点卡片的屏幕位置，让详情从这里「长出来」
  const [detailOrigin, setDetailOrigin] = useState(null);
  const [reorder, setReorder] = useState(null);

  /* 页面参数：'add' / { detail } / { brew } / 'brews'
   * 注意：导入解析结果要先从暂存取走，再接处理 'add'，否则会被「空表单」覆盖。 */
  useEffect(() => {
    if (!pageParam) return;
    if (pageParam === 'add') {
      const pending = takePendingPrefill();
      if (pending) {
        setPrefill(pending);
        setForm({ bean: null, initial: pending, imported: pending.imported || '已带入解析结果，请核对后保存' });
      } else {
        setForm({ bean: null });
      }
    }
    else if (pageParam === 'brews') setTab('brews');
    else if (pageParam.detail) { setTab('beans'); setDetailId(pageParam.detail); }
    else if (pageParam.brew) { setTab('beans'); setBrewTarget(pageParam.brew); }
  }, [pageParam]);

  const brands = useMemo(() => {
    const s = new Set();
    beans.forEach((b) => b.brand && s.add(b.brand));
    (data.wishlist || []).forEach((w) => w.brand && s.add(w.brand));
    return [...s].sort();
  }, [beans, data.wishlist]);

  const list = useMemo(() => {
    let arr = beans.slice();
    if (filter !== 'all') arr = arr.filter((b) => beanStatus(b, settings) === filter);
    if (roast !== 'all') arr = arr.filter((b) => b.roastLevel === roast);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((b) => `${b.brand} ${b.name} ${b.origin} ${b.processor} ${(b.flavors || []).join(' ')}`.toLowerCase().includes(t));
    }
    arr.sort((a, b) => {
      if (sort === 'roast') return String(b.roastDate || '').localeCompare(String(a.roastDate || ''));
      if (sort === 'price') return (b.price || 0) - (a.price || 0);
      if (sort === 'left') return (numOrNull(b.totalWeight) || 0) - (numOrNull(a.totalWeight) || 0);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return arr;
  }, [beans, filter, roast, q, sort, settings]);

  const allBrews = useMemo(() => {
    const arr = [];
    for (const b of beans) for (const br of b.brewings || []) arr.push({ bean: b, br });
    arr.sort((x, y) => String(y.br.date).localeCompare(String(x.br.date)));
    return arr;
  }, [beans]);

  const detail = detailId ? beans.find((b) => b.id === detailId) : null;
  const brewBean = brewTarget ? beans.find((b) => b.id === brewTarget) : null;

  return (
    <div className="page-inner">
      <PageHead
        title={(
          <span className="head-with-sticker">
            豆仓
            <span className="head-sticker">
              <Sticker name="bean" size={40} rotate={-10} />
              <Sticker name="grinder" size={40} rotate={6} />
              <Sticker name="leaf" size={32} rotate={12} />
            </span>
          </span>
        )}
        sub={`现在拥有的豆子 · ${beans.filter((b) => !b.finished).length} 袋在喝 · ${allBrews.length} 杯记录`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setImportOpen('paste')}><Icon name="link" size={15} /> 链接导入</button>
            <button className="btn btn-ghost" onClick={() => setImportOpen('image')}><Icon name="camera" size={15} /> 拍包装</button>
            <button className="btn btn-ghost" onClick={() => go('stats')}><Icon name="chart" size={15} /> 统计</button>
            <button className="btn btn-primary" onClick={() => setForm({ bean: null })}><Icon name="plus" size={15} /> 添加豆子</button>
          </>
        }
      />

      <ImportCapture open={!!importOpen} initialMode={importOpen || 'paste'} onClose={() => setImportOpen(null)} />

      <Tabs
        tabs={[
          { value: 'beans', label: '豆子', badge: beans.filter((b) => !b.finished).length },
          { value: 'brews', label: '冲煮记录', badge: allBrews.length }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'beans' ? (
        <>
          {beans.length === 0 ? (
            <EmptyState
              icon="coffee"
              title="豆仓空空如也"
              desc="贴一个淘宝/京东链接，或拍一张包装照片，剩下的交给豆藏。"
              action={<button className="btn btn-primary" onClick={() => setForm({ bean: null })}><Icon name="plus" size={15} /> 添加豆子</button>}
            />
          ) : (
            <>
              <div className="toolbar">
                <Segmented options={FILTERS} value={filter} onChange={setFilter} />
                <div className="toolbar-right">
                  <select className="input select" value={roast} onChange={(e) => setRoast(e.target.value)}>
                    <option value="all">全部烘焙度</option>
                    {ROAST_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <select className="input select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="recent">最近添加</option>
                    <option value="roast">烘焙时间</option>
                    <option value="price">价格从高到低</option>
                    <option value="left">总量从多到少</option>
                  </select>
                  <div className="search">
                    <Icon name="search" size={13} />
                    <input className="input" placeholder="搜索品牌 / 名字 / 产地 / 风味" value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                </div>
              </div>

              {list.length === 0 ? (
                <EmptyState icon="search" title="没有匹配的豆子" desc="试试调整筛选条件。" />
              ) : (
                <div className="card-grid">
                  {list.map((b) => (
                    <BeanCard
                      key={b.id}
                      bean={b}
                      onOpen={(rect) => { setDetailOrigin(rect); setDetailId(b.id); }}
                      onBrew={() => setBrewTarget(b.id)}
                      onEdit={() => setForm({ bean: b })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <Panel title="冲煮记录" sub={`共 ${allBrews.length} 杯 · 点豆子名回到那一袋`}>
          {allBrews.length === 0 ? (
            <EmptyState icon="cup" title="还没有冲煮记录" desc="在豆子卡片上点「喝一杯」，消耗与成本才会变成真实数据。" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日期</th><th>豆子</th><th>器具</th><th>粉量</th><th>粉水比</th><th>用量</th><th>该杯成本</th><th>评分</th><th>心得</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {allBrews.slice(0, 300).map(({ bean, br }) => {
                    const s = resolveBean(bean, settings);
                    return (
                      <tr key={br.id}>
                        <td>{br.date}</td>
                        <td className="link-cell" onClick={(e) => { setTab('beans'); setDetailOrigin(e.currentTarget.getBoundingClientRect()); setDetailId(bean.id); }}>
                          {bean.brand ? `${bean.brand} · ` : ''}{bean.name}
                        </td>
                        <td>{methodLabel(br.method)}</td>
                        <td>{br.dose ? `${br.dose}g` : '—'}</td>
                        <td>{br.ratio || '—'}</td>
                        <td>{br.grams || 0}g</td>
                        <td>{formatMoney((br.grams || 0) * s.costPerGram)}</td>
                        <td>{br.rating ? '★'.repeat(br.rating) : '—'}</td>
                        <td className="note-cell">{br.note || '—'}</td>
                        <td>
                          <button className="icon-btn" title="删除这条记录" onClick={() => removeBrewing(bean.id, br.id)}>
                            <Icon name="trash" size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <BeanFormModal
        open={!!form}
        bean={form?.bean || null}
        initial={form?.initial || prefill || null}
        brands={brands}
        suggestions={data.flavorTags}
        imported={form?.imported || ''}
        onClose={() => setForm(null)}
        onSave={(bean) => {
          if (form?.bean) {
            saveBean({ ...bean, id: form.bean.id, brewings: form.bean.brewings || [], finished: form.bean.finished, finishedDate: form.bean.finishedDate, finishedWeight: form.bean.finishedWeight, createdAt: form.bean.createdAt });
            toast(`已更新「${bean.name}」`);
          } else {
            addBean(normalizeBean(bean));
            toast(`已添加「${bean.name}」`);
          }
          setForm(null);
        }}
      />

      <BeanDetailModal
        bean={detail}
        origin={detailOrigin}
        onClose={() => setDetailId(null)}
        onEdit={(b) => { setDetailId(null); setForm({ bean: b }); }}
        onFinish={(b) => { finishBean(b.id); setDetailId(null); toast(`「${b.name}」已标记喝完`); }}
        onRestore={(b) => { restoreBean(b.id); toast(`「${b.name}」已恢复为在喝`); }}
        onDelete={(b) => setDelTarget(b)}
        onBrew={(b) => { setDetailId(null); setBrewTarget(b.id); }}
        onAfterQuickLog={() => setDetailId(null)}
        onRemoveBrewing={removeBrewing}
        onRebuy={(b) => { rebuyToWishlist(b); toast(`「${b.name}」已加入心愿单（回购）`); }}
        onReorder={(b) => { setDetailId(null); setReorder(b); }}
      />

      <BrewModal
        bean={brewBean}
        onClose={() => setBrewTarget(null)}
        onSave={(bean, brewing) => {
          logBrewing(bean.id, brewing);
          const snap = resolveBean(bean, settings);
          if ((Number(brewing.grams) || 0) >= snap.left) {
            finishBean(bean.id);
            toast(`喝完啦 · 「${bean.name}」已归档`);
          } else {
            toast(`已记录 1 杯 · 「${bean.name}」`);
          }
          setBrewTarget(null);
        }}
      />

      <BeanFormModal
        open={!!reorder}
        bean={null}
        initial={reorder ? {
          brand: reorder.brand, name: reorder.name, flavors: reorder.flavors, roastLevel: reorder.roastLevel,
          price: reorder.price, totalWeight: reorder.totalWeight, brewMethod: reorder.brewMethod,
          origin: reorder.origin, processor: reorder.processor, variety: reorder.variety,
          altitude: reorder.altitude, retailer: reorder.retailer, productUrl: reorder.productUrl,
          roastDate: todayStr(), purchaseDate: todayStr()
        } : null}
        brands={brands}
        suggestions={data.flavorTags}
        imported="再来一袋 · 已带入上一袋的全部信息，只需确认烘焙时间"
        onClose={() => setReorder(null)}
        onSave={(bean) => { addBean(normalizeBean(bean)); toast(`新的「${bean.name}」已入仓`); setReorder(null); }}
      />

      <ConfirmDialog
        open={!!delTarget}
        title="删除这袋豆子"
        message={delTarget ? `确定删除「${delTarget.name}」吗？冲煮记录会一起删除，此操作不可恢复。` : ''}
        confirmText="删除"
        danger
        onConfirm={() => {
          if (delTarget) { removeBean(delTarget.id); toast(`已删除「${delTarget.name}」`, 'info'); }
          setDelTarget(null);
          setDetailId(null);
        }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}

/* ================= Bean Card ================= */
function BeanCard({ bean, onOpen, onBrew, onEdit }) {
  const { data } = useApp();
  const s = resolveBean(bean, data.settings);
  const pct = s.total ? (s.left / s.total) * 100 : 0;

  return (
    <div
      className={`bean-card status-${s.status}`}
      onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
    >
      <div className="bean-head">
        <div className="bean-id">
          <span className="bean-brand">{bean.brand || '未知品牌'}</span>
          <h3 className="bean-name">{bean.name || '未命名豆子'}</h3>
        </div>
        <span className={`badge badge-${s.meta.cls}`}>{s.meta.label}</span>
      </div>

      <div className="bean-chips">
        <span className="roast-chip">{roastLabel(bean.roastLevel)}</span>
        <span className="roast-chip muted-chip">{methodLabel(bean.brewMethod)}</span>
        <span className="date-chip"><Icon name="calendar" size={11} /> {bean.roastDate || '未填'}</span>
        {(bean.flavors || []).slice(0, 3).map((f) => <span key={f} className="chip">{f}</span>)}
        {(bean.flavors || []).length > 3 && <span className="chip more">+{(bean.flavors || []).length - 3}</span>}
      </div>

      <div className="bean-usage">
        <div className="usage-bar">
          <div className={`usage-fill ${s.status}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="usage-text">
          <span>剩 <b>{formatNum(s.left)}g</b> / {formatNum(s.total)}g</span>
          <span>{s.brewCount} 杯</span>
        </div>
      </div>

      <div className={`bean-progress progress-${s.meta.cls}`}>
        <Icon name="clock" size={12} />
        <span>{s.progress.text}</span>
      </div>

      <div className="bean-foot">
        <div className="bean-stats">
          <span className="bs"><i>真实已花</i><b>{formatMoney(s.realSpent)}</b></span>
          <span className="bs"><i>单杯</i><b>{formatMoney(s.costPerServing)}</b></span>
          <span className="bs"><i>可用</i><b>{formatNum(s.leftServings)} 份</b></span>
        </div>
        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          {!bean.finished && s.left > 0 && (
            <QuickBrewButton bean={bean} size="sm" />
          )}
          <button className="icon-btn" onClick={onEdit} aria-label="编辑" title="编辑"><Icon name="pencil" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ================= Brew Modal ================= */
function BrewModal({ bean, onClose, onSave }) {
  const { data } = useApp();
  const settings = data.settings;
  const [grams, setGrams] = useState('');
  const [dose, setDose] = useState('');
  const [ratio, setRatio] = useState('');
  const [date, setDate] = useState(todayStr());
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!bean) return;
    const snap = resolveBean(bean, settings);
    const g = snap.params.servingGrams;
    setGrams(String(g));
    setDose(String(g));
    setRatio(bean.brewMethod === 'espresso' ? '1:2' : '1:15');
    setDate(todayStr());
    setRating(null);
    setNote('');
  }, [bean && bean.id]);

  if (!bean) return null;
  const s = resolveBean(bean, settings);
  const over = (Number(grams) || 0) > s.left;
  const lastBrew = [...(s.brewings || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  const applyLast = () => {
    if (!lastBrew) return;
    setGrams(String(lastBrew.grams));
    setDose(String(lastBrew.dose || lastBrew.grams));
    setRatio(lastBrew.ratio || '');
    setRating(lastBrew.rating || null);
    setNote(lastBrew.note || '');
    setDate(todayStr());
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`喝一杯 · ${bean.name}`}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onSave(bean, { grams: Number(grams) || 0, dose: Number(dose) || Number(grams) || 0, ratio, date, rating, note, method: bean.brewMethod })} disabled={!(Number(grams) > 0)}>
            <Icon name="check" size={14} /> 记录这杯
          </button>
        </>
      }
    >
      <div className="brew-head">
        <div>
          <span className="muted small">{bean.brand || '未知品牌'} · {methodLabel(bean.brewMethod)}</span>
          <h3>{bean.name}</h3>
        </div>
        <div className="brew-left"><i>剩余</i><b>{formatNum(s.left)}g</b></div>
      </div>

      {/* 补记入口：昨天喝的也能补，用上次的参数一键带入 */}
      {lastBrew && (
        <button className="brew-apply-last" onClick={applyLast} type="button">
          <Icon name="refresh" size={12} />
          用上次参数（{lastBrew.grams}g{lastBrew.ratio ? ` · ${lastBrew.ratio}` : ''}）
        </button>
      )}

      <div className="form-grid">
        <Field label="用量（克）" hint="默认按当前单份克数">
          <input className="input" type="number" min="1" step="0.5" value={grams} onChange={(e) => setGrams(e.target.value)} autoFocus />
        </Field>
        <Field label="日期">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="粉量（克，可选）">
          <input className="input" type="number" min="0" step="0.5" value={dose} onChange={(e) => setDose(e.target.value)} />
        </Field>
        <Field label="粉水比（可选）">
          <input className="input" placeholder="1:15" value={ratio} onChange={(e) => setRatio(e.target.value)} />
        </Field>
        <Field label="这杯怎么样" className="span-2">
          <Stars value={rating} onChange={setRating} />
        </Field>
        <Field label="心得（可选）" className="span-2">
          <input className="input" placeholder="水温 92℃ / 研磨中细 / 甜感明显…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className={`preview ${over ? 'warn' : ''}`}>
        <div className="preview-row">
          <span>这杯成本</span><b>{formatMoney((Number(grams) || 0) * s.costPerGram)}</b>
          <span>记录后剩余</span><b>{formatNum(Math.max(0, s.left - (Number(grams) || 0)))}g</b>
        </div>
        {over && <p className="small warn-text">用量超过剩余克数，会自动把这一袋标记为喝完。</p>}
      </div>
    </Modal>
  );
}

/* ================= Detail Modal ================= */
function BeanDetailModal({ bean, origin, onClose, onEdit, onFinish, onRestore, onDelete, onBrew, onAfterQuickLog, onRemoveBrewing, onRebuy, onReorder }) {
  const { data } = useApp();
  // 父层每次都传新函数，直接往下传会把 QuickBrewButton 里 ref 读取时机打乱 → 用 ref 固定住
  const afterLogRef = React.useRef(onAfterQuickLog);
  afterLogRef.current = onAfterQuickLog;
  const afterQuickLog = React.useCallback((built) => { afterLogRef.current && afterLogRef.current(built); }, []);
  const settings = data.settings;
  if (!bean) return null;
  const s = resolveBean(bean, settings);
  const stage = s.status === 'resting' ? 1 : s.status === 'peak' ? 2 : 3;
  const brews = [...(bean.brewings || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);

  return (
    <Modal
      open
      onClose={onClose}
      title="豆子详情"
      width={660}
      origin={origin}
      footer={
        <>
          <button className="btn btn-ghost danger-text" onClick={() => onDelete(bean)}>
            <Icon name="trash" size={14} /> 删除
          </button>
          {bean.finished ? (
            <>
              <button className="btn" onClick={() => onRebuy(bean)}><Icon name="refresh" size={14} /> 回购</button>
              <button className="btn" onClick={() => onRestore(bean)}>恢复为在喝</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => onFinish(bean)}><Icon name="check" size={14} /> 标记喝完</button>
              <button className="btn btn-primary" onClick={() => onBrew(bean)}><Icon name="cup" size={14} /> 精确记录</button>
            </>
          )}
          <button className="btn" onClick={() => onEdit(bean)}><Icon name="pencil" size={14} /> 编辑</button>
        </>
      }
    >
      <div className="detail-head">
        <div>
          <span className="detail-brand">{bean.brand || '未知品牌'}</span>
          <h2>{bean.name || '未命名豆子'}</h2>
        </div>
        <span className={`badge badge-${s.meta.cls}`}>{s.meta.label}</span>
      </div>

      <div className="detail-chips">
        <span className="roast-chip">{roastLabel(bean.roastLevel)}</span>
        <span className="roast-chip muted-chip">{methodLabel(bean.brewMethod)}</span>
        {bean.processor && <span className="chip">{bean.processor}</span>}
        {bean.origin && <span className="chip">{bean.origin}</span>}
        {bean.altitude && <span className="chip">{bean.altitude}</span>}
        {(bean.flavors || []).map((f) => <span key={f} className="chip">{f}</span>)}
      </div>

      <div className="detail-usage">
        <Meter value={s.left} max={s.total} cls={s.status === 'peak' ? 'green' : s.status === 'past' ? 'red' : 'orange'} label="余量" suffix={`${formatNum(s.left)}g / ${formatNum(s.total)}g`} />
        <span className="muted small">{s.brewCount} 杯 · 已消耗 {formatNum(s.used)}g · 按 {s.params.servingGrams}g/份还能喝 {formatNum(s.leftServings)} 份</span>
      </div>

      {/* 详情内一条「快记」：看清豆子顺手就能记，不必退出 */}
      {!bean.finished && (
        <div className="detail-quick">
          <QuickBrewButton bean={bean} size="md" block label="喝一杯" onLogged={afterQuickLog} />
          <button className="btn btn-sm btn-ghost detail-exact" onClick={() => onBrew(bean)} title="精确录入克数、日期、粉水比与心得">
            <Icon name="edit" size={13} /> 精确记录
          </button>
        </div>
      )}

      <div className="timeline">
        <div className={`tl-item ${stage >= 1 ? 'done' : ''} ${stage === 1 ? 'now' : ''}`}>
          <span className="tl-dot" />
          <div><b>烘焙时间</b><span>{bean.roastDate || '—'}</span></div>
        </div>
        <div className={`tl-item ${stage >= 2 ? 'done' : ''} ${stage === 2 ? 'now' : ''}`}>
          <span className="tl-dot" />
          <div><b>养豆完成（{s.params.restDays} 天）</b><span>{s.windows.restEnd || '—'}</span></div>
        </div>
        <div className={`tl-item ${stage >= 3 ? 'done' : ''} ${stage === 3 ? 'now' : ''}`}>
          <span className="tl-dot" />
          <div><b>最佳赏味期（{s.params.peakDays} 天）</b><span>{s.windows.restEnd} ~ {s.windows.peakEnd}</span></div>
        </div>
      </div>

      <div className="detail-stats">
        <div className="ds"><span>整袋价格</span><b>{formatMoney(bean.price)}</b></div>
        <div className="ds"><span>真实已花</span><b>{formatMoney(s.realSpent)}</b></div>
        <div className="ds"><span>库存价值</span><b>{formatMoney(s.stockValue)}</b></div>
        <div className="ds"><span>单杯成本</span><b>{formatMoney(s.costPerServing)}</b></div>
        <div className="ds"><span>购买时间</span><b>{bean.purchaseDate || bean.roastDate || '—'}</b></div>
        <div className="ds"><span>烘焙至今</span><b>{s.actualDays != null ? `${s.actualDays} 天` : '—'}</b></div>
      </div>

      {brews.length > 0 && (
        <div className="detail-brews">
          <div className="db-head">
            <b>冲煮记录</b>
            <span className="muted small">最近 {brews.length} 次</span>
          </div>
          {brews.map((br) => (
            <div key={br.id} className="db-row">
              <span className="db-date">{br.date}</span>
              <span className="db-meta">{methodLabel(br.method)} · {br.grams}g{br.ratio ? ` · ${br.ratio}` : ''}</span>
              <span className="db-rating">{br.rating ? '★'.repeat(br.rating) : ''}</span>
              <span className="db-note">{br.note || ''}</span>
              <button className="icon-btn" onClick={() => onRemoveBrewing(bean.id, br.id)} aria-label="删除记录"><Icon name="x" size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {bean.rating != null && (
        <div className="detail-rating"><span>我的评分</span><Stars value={bean.rating} size={18} /></div>
      )}
      {bean.notes && <p className="detail-notes">{bean.notes}</p>}

      <div className="detail-actions">
        {bean.productUrl && (
          <button className="btn btn-sm btn-ghost" onClick={() => window.api.openExternal(bean.productUrl)}>
            <Icon name="external" size={13} /> 打开原商品页 · {bean.retailer || '链接'}
          </button>
        )}
        {bean.finished && (
          <button className="btn btn-sm" onClick={() => onReorder(bean)}>
            <Icon name="refresh" size={13} /> 再来一袋（复制为新批次）
          </button>
        )}
      </div>
    </Modal>
  );
}
