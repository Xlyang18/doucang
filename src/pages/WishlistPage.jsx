import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { resolveBean, roastLabel, methodLabel, todayStr, ROAST_LEVELS } from '../lib/calc.js';
import { formatMoney, formatNum } from '../lib/format.js';
import { normalizeWish, normalizeBean } from '../lib/dedup.js';
import { Modal, ConfirmDialog, EmptyState, Segmented, Field, TagInput, PageHead, Panel } from '../components/ui.jsx';
import Sticker from '../components/Sticker.jsx';
import Icon from '../components/Icon.jsx';

const SORTS = [
  { value: 'recent', label: '最近加入' },
  { value: 'price', label: '参考价从低到高' },
  { value: 'gap', label: '距目标价从大到小' }
];

export default function WishlistPage() {
  const { data, addWish, saveWish, removeWish, transferWish, toast } = useApp();
  const settings = data.settings;
  const wishlist = data.wishlist || [];
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('recent');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [delTarget, setDelTarget] = useState(null);

  const brands = useMemo(() => {
    const s = new Set();
    (data.beans || []).forEach((b) => b.brand && s.add(b.brand));
    wishlist.forEach((w) => w.brand && s.add(w.brand));
    return [...s].sort();
  }, [wishlist, data.beans]);

  const list = useMemo(() => {
    let arr = wishlist.slice();
    if (tab === 'rebuy') arr = arr.filter((w) => w.rebuyFrom);
    if (tab === 'target') arr = arr.filter((w) => w.targetPrice != null);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((w) => `${w.brand} ${w.name} ${(w.flavors || []).join(' ')}`.toLowerCase().includes(t));
    }
    arr.sort((a, b) => {
      if (sort === 'price') return (a.price || 0) - (b.price || 0);
      if (sort === 'gap') return ((b.price || 0) - (b.targetPrice || 0)) - ((a.price || 0) - (a.targetPrice || 0));
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return arr;
  }, [wishlist, tab, sort, q]);

  const history = useMemo(
    () => [...(data.wishHistory || [])].sort((a, b) => String(b.transferredAt || '').localeCompare(String(a.transferredAt || ''))).slice(0, 10),
    [data.wishHistory]
  );

  return (
    <div className="page-inner">
      <PageHead
        title={(
          <span className="head-with-sticker">
            心愿单
            <span className="head-sticker"><Sticker name="star" size={40} rotate={10} /></span>
          </span>
        )}
        sub={`未来想买的豆子 · ${wishlist.length} 条 · 其中回购 ${wishlist.filter((w) => w.rebuyFrom).length} 条`}
        actions={
          <>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await window.api.writeClipboard(wishlist.map((w) => `${w.brand} ${w.name} ¥${w.price}`).join('\n'));
                toast('心愿清单已复制到剪贴板', 'info');
              }}
            >
              <Icon name="share" size={14} /> 复制清单
            </button>
            <button className="btn btn-primary" onClick={() => setForm({ wish: null })}>
              <Icon name="plus" size={15} /> 加入心愿单
            </button>
          </>
        }
      />

      {wishlist.length === 0 ? (
        <EmptyState
          icon="star"
          title="心愿单还是空的"
          desc="看到想试的豆子先存进来；豆子喝完后点「回购」会自动回到这里，并带上原价与原链接。"
          action={<button className="btn btn-primary" onClick={() => setForm({ wish: null })}><Icon name="plus" size={15} /> 添加心愿豆子</button>}
        />
      ) : (
        <>
          <div className="toolbar">
            <Segmented
              options={[
                { value: 'all', label: '全部' },
                { value: 'rebuy', label: '回购清单' },
                { value: 'target', label: '目标价' }
              ]}
              value={tab}
              onChange={setTab}
            />
            <div className="toolbar-right">
              <select className="input select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <div className="search">
                <Icon name="search" size={13} />
                <input className="input" placeholder="搜索品牌 / 名字" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState icon="search" title="没有匹配的心愿豆子" desc="试试换个关键词或切换筛选。" />
          ) : (
            <div className="card-grid">
              {list.map((w) => (
                <WishCard
                  key={w.id}
                  wish={w}
                  onEdit={() => setForm({ wish: w })}
                  onTransfer={() => setTransfer(w)}
                  onDelete={() => setDelTarget(w)}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <Panel title="已转入豆仓" sub="最近 10 条">
              <div className="finished-list">
                {history.map((h, i) => (
                  <div key={`${h.id}-${i}`} className="finished-row">
                    <div className="f-main">
                      <span className="f-name">{h.brand ? `${h.brand} · ` : ''}{h.name}</span>
                      <span className="f-meta">{formatMoney(h.price)} · {h.rebuyFrom ? '回购' : '心愿'}</span>
                    </div>
                    <div className="f-side"><span className="f-date">{String(h.transferredAt || '').slice(0, 10)} 转入</span></div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}

      <WishFormModal
        open={!!form}
        wish={form?.wish || null}
        brands={brands}
        suggestions={data.flavorTags}
        onClose={() => setForm(null)}
        onSave={(wish) => {
          if (form?.wish) {
            saveWish({ ...wish, id: form.wish.id, createdAt: form.wish.createdAt, rebuyFrom: form.wish.rebuyFrom, rebuyCount: form.wish.rebuyCount });
            toast(`已更新「${wish.name}」`);
          } else {
            addWish(normalizeWish(wish));
            toast(`已加入心愿单「${wish.name}」`);
          }
          setForm(null);
        }}
      />

      <TransferModal
        wish={transfer}
        onClose={() => setTransfer(null)}
        onConfirm={(bean) => {
          transferWish(transfer, bean);
          toast(`「${bean.name}」已转入豆仓`);
          setTransfer(null);
        }}
      />

      <ConfirmDialog
        open={!!delTarget}
        title="移除心愿豆子"
        message={delTarget ? `确定从心愿单移除「${delTarget.name}」吗？` : ''}
        confirmText="移除"
        danger
        onConfirm={() => {
          removeWish(delTarget.id);
          toast(`已从心愿单移除「${delTarget.name}」`, 'info');
          setDelTarget(null);
        }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}

/* ================= Wish Card ================= */
function WishCard({ wish, onEdit, onTransfer, onDelete }) {
  const { data } = useApp();
  const settings = data.settings;
  const s = resolveBean({ ...wish, roastDate: '' }, settings);
  const gap = wish.targetPrice != null ? (wish.price || 0) - wish.targetPrice : null;

  return (
    <div className="wish-card">
      <div className="bean-head">
        <div className="bean-id">
          <span className="bean-brand">{wish.brand || '未知品牌'}</span>
          <h3 className="bean-name">{wish.name || '未命名豆子'}</h3>
        </div>
        <span className="badge badge-accent">{wish.rebuyFrom ? `回购 ×${wish.rebuyCount || 1}` : '想买'}</span>
      </div>
      <div className="bean-chips">
        <span className="roast-chip">{roastLabel(wish.roastLevel)}</span>
        <span className="roast-chip muted-chip">{methodLabel(wish.brewMethod)}</span>
        {(wish.flavors || []).slice(0, 3).map((f) => <span key={f} className="chip">{f}</span>)}
        {(wish.flavors || []).length > 3 && <span className="chip more">+{(wish.flavors || []).length - 3}</span>}
      </div>
      <div className="bean-foot">
        <div className="bean-stats">
          <span className="bs"><i>参考价</i><b>{formatMoney(wish.price)}</b></span>
          <span className="bs"><i>总量</i><b>{formatNum(wish.totalWeight)}g</b></span>
          <span className="bs"><i>预计单杯</i><b>{formatMoney(s.costPerServing)}</b></span>
          {wish.targetPrice != null && (
            <span className="bs"><i>目标价</i><b className={gap > 0 ? 'warn-text' : ''}>{formatMoney(wish.targetPrice)}</b></span>
          )}
        </div>
        <div className="card-actions">
          <button className="btn btn-sm btn-primary" onClick={onTransfer}>
            <Icon name="arrow" size={13} /> 转入豆仓
          </button>
          {wish.productUrl && (
            <button className="icon-btn" title="打开商品页" onClick={() => window.api.openExternal(wish.productUrl)}>
              <Icon name="external" size={14} />
            </button>
          )}
          <button className="icon-btn" onClick={onEdit} aria-label="编辑"><Icon name="pencil" size={14} /></button>
          <button className="icon-btn" onClick={onDelete} aria-label="删除"><Icon name="trash" size={14} /></button>
        </div>
      </div>
      {wish.notes && <p className="wish-notes">{wish.notes}</p>}
    </div>
  );
}

/* ================= Form Modal ================= */
function WishFormModal({ open, wish, brands, suggestions, onClose, onSave }) {
  const { data } = useApp();
  const settings = data.settings;
  const blank = () => ({
    brand: '', name: '', flavors: [], roastLevel: 'medium', price: '', totalWeight: '',
    notes: '', targetPrice: '', productUrl: '', retailer: '', brewMethod: 'pour'
  });
  const [f, setF] = useState(wish ? { ...wish } : blank());
  useEffect(() => {
    if (!open) return;
    setF(wish ? { ...wish } : blank());
  }, [open, wish]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const s = resolveBean({ ...f, roastDate: '', totalWeight: Number(f.totalWeight) || 0, price: Number(f.price) || 0 }, settings);

  const submit = () => {
    if (!String(f.name).trim()) return;
    onSave(normalizeWish({
      ...f,
      name: String(f.name).trim(),
      brand: String(f.brand).trim(),
      price: Number(f.price) || 0,
      totalWeight: Number(f.totalWeight) || 0,
      targetPrice: f.targetPrice === '' ? null : Number(f.targetPrice)
    }, !!wish));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={wish ? '编辑心愿豆子' : '加入心愿单'}
      width={600}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit} disabled={!String(f.name).trim()}>
            <Icon name="check" size={14} /> {wish ? '保存修改' : '加入心愿单'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="品牌">
          <input className="input" list="wish-brands" placeholder="例如：Manner" value={f.brand} onChange={(e) => set('brand', e.target.value)} />
          <datalist id="wish-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        <Field label="豆子名字">
          <input className="input" placeholder="例如：耶加雪菲 水洗" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="风味倾向（多选，可自建）" className="span-2">
          <TagInput value={Array.isArray(f.flavors) ? f.flavors : []} onChange={(v) => set('flavors', v)} suggestions={suggestions} />
        </Field>
        <Field label="烘焙程度" className="span-2">
          <Segmented options={ROAST_LEVELS} value={f.roastLevel} onChange={(v) => set('roastLevel', v)} />
        </Field>
        <Field label="参考价（元）">
          <input className="input" type="number" min="0" step="0.01" placeholder="128" value={f.price || ''} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label="总量（克）">
          <input className="input" type="number" min="0" step="1" placeholder="250" value={f.totalWeight || ''} onChange={(e) => set('totalWeight', e.target.value)} />
        </Field>
        <Field label="目标价（可选）" hint="到价再买，心里有数">
          <input className="input" type="number" min="0" step="0.01" placeholder="99" value={f.targetPrice == null ? '' : f.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} />
        </Field>
        <Field label="商品链接（可选）">
          <input className="input" placeholder="https://…" value={f.productUrl || ''} onChange={(e) => set('productUrl', e.target.value)} />
        </Field>
        <Field label="备注（可选）" className="span-2">
          <textarea className="input textarea" rows={3} placeholder="种草理由、想去的店…" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className="preview">
        <div className="preview-row">
          <span>预计可做</span><b>{formatNum(s.theoreticalServings)} 份</b>
          <span>单杯费用</span><b>{formatMoney(s.costPerServing)}</b>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Transfer Modal ================= */
function TransferModal({ wish, onClose, onConfirm }) {
  const { data } = useApp();
  const settings = data.settings;
  const [roastDate, setRoastDate] = useState(todayStr());
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (!wish) return;
    setRoastDate(todayStr());
    setPurchaseDate(todayStr());
    setPrice(String(wish.price || ''));
    setWeight(String(wish.totalWeight || ''));
  }, [wish && wish.id]);

  if (!wish) return null;
  const s = resolveBean({ ...wish, roastDate, totalWeight: Number(weight) || 0, price: Number(price) || 0 }, settings);

  return (
    <Modal
      open
      onClose={onClose}
      title={`转入豆仓 · ${wish.name}`}
      width={540}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            disabled={!roastDate}
            onClick={() => onConfirm(normalizeBean({
              ...wish,
              roastDate,
              purchaseDate,
              price: Number(price) || 0,
              totalWeight: Number(weight) || 0,
              rating: null,
              finished: false,
              finishedDate: '',
              finishedWeight: null,
              brewings: []
            }))}
          >
            <Icon name="arrow" size={14} /> 确认转入
          </button>
        </>
      }
    >
      <p className="transfer-tip">心愿信息已带入，补填烘焙时间即可；价格与总量可顺手改成实际值。</p>
      <div className="form-grid">
        <Field label="烘焙时间" hint="养豆期与赏味期由此计算">
          <input className="input" type="date" value={roastDate} onChange={(e) => setRoastDate(e.target.value)} />
        </Field>
        <Field label="购买时间">
          <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </Field>
        <Field label="实际价格（元）">
          <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="总量（克）">
          <input className="input" type="number" min="0" step="1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
      </div>
      <div className="preview">
        <div className="preview-row">
          <span>可做份数</span><b>{formatNum(s.theoreticalServings)} 份</b>
          <span>单杯费用</span><b>{formatMoney(s.costPerServing)}</b>
        </div>
        <div className="preview-row">
          <span>赏味期</span><b>{s.windows.restEnd} ~ {s.windows.peakEnd}</b>
        </div>
      </div>
    </Modal>
  );
}
