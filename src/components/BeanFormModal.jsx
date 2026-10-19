import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { normalizeBean as normalizeBeanCompat } from '../lib/dedup.js';
import { ROAST_LEVELS, BREW_METHODS, ROAST_DEFAULTS, servings, costPerServing, addDays, todayStr, numOrNull } from '../lib/calc.js';
import { formatMoney, formatNum } from '../lib/format.js';
import { Modal, Field, TagInput, Segmented, Stars } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const RETAILERS = ['淘宝', '天猫', '京东', '小红书', '抖音', '独立烘焙商', '线下门店'];

const EMPTY = () => ({
  brand: '',
  name: '',
  flavors: [],
  roastLevel: 'medium',
  roastDate: todayStr(),
  purchaseDate: '',
  price: '',
  totalWeight: '',
  rating: null,
  notes: '',
  brewMethod: 'pour',
  restDaysOverride: '',
  peakDaysOverride: '',
  origin: '',
  processor: '',
  variety: '',
  altitude: '',
  retailer: '',
  productUrl: '',
  overdueNotify: true
});

/**
 * 豆子表单（添加 / 编辑 / 导入预览三合一）
 * props:
 *  open, bean（编辑时传）, initial（导入时预填）, brands, suggestions,
 *  imported（来源说明：来自链接 / 来自照片 / 来自心愿单）, onClose, onSave
 */
export default function BeanFormModal({ open, bean, initial, brands = [], suggestions = [], imported = '', onClose, onSave }) {
  const { data } = useApp();
  const settings = data.settings;
  const [f, setF] = useState(EMPTY);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = bean ? { ...bean } : EMPTY();
    const merged = { ...base, ...(initial || {}) };
    const clean = {};
    for (const k of Object.keys(EMPTY())) {
      clean[k] = merged[k] === undefined || merged[k] === null ? EMPTY()[k] : merged[k];
    }
    if (merged.flavors && !Array.isArray(merged.flavors)) clean.flavors = [];
    setF(clean);
    setShowMore(!!(merged.origin || merged.processor || merged.productUrl || merged.restDaysOverride));
  }, [open, bean, initial]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  /* 烘焙度变化时，如果用户没手填过，自动带出推荐养豆天数 */
  const applyRoastDefaults = (level) => {
    setF((p) => {
      const d = ROAST_DEFAULTS[level] || ROAST_DEFAULTS.medium;
      const untouched = (p.restDaysOverride === '' || p.restDaysOverride === null) && (p.peakDaysOverride === '' || p.peakDaysOverride === null);
      return {
        ...p,
        roastLevel: level,
        restDaysOverride: untouched ? d.restDays : p.restDaysOverride,
        peakDaysOverride: untouched ? d.peakDays : p.peakDaysOverride
      };
    });
  };

  const restDays = numOrNull(f.restDaysOverride) ?? ROAST_DEFAULTS[f.roastLevel].restDays;
  const peakDays = numOrNull(f.peakDaysOverride) ?? ROAST_DEFAULTS[f.roastLevel].peakDays;
  const restEnd = addDays(f.roastDate || todayStr(), restDays);
  const peakEnd = addDays(restEnd, peakDays);

  const method = f.brewMethod || 'pour';
  const gramKey = BREW_METHODS.find((m) => m.value === method)?.gramKey || 'pourGrams';
  const servingGrams = settings[gramKey] || 15;
  const s = servings(Number(f.totalWeight) || 0, servingGrams);
  const cps = costPerServing(Number(f.price) || 0, Number(f.totalWeight) || 0, servingGrams);
  const leftGrams = Number(f.totalWeight) || 0;

  const submit = () => {
    if (!String(f.name).trim()) return;
    const payload = normalizeBeanCompat({
      ...f,
      name: String(f.name).trim(),
      brand: String(f.brand).trim(),
      price: Number(f.price) || 0,
      totalWeight: Number(f.totalWeight) || 0,
      restDaysOverride: numOrNull(f.restDaysOverride),
      peakDaysOverride: numOrNull(f.peakDaysOverride),
      updatedAt: new Date().toISOString()
    }, !!bean);
    onSave(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bean ? '编辑豆子' : '添加豆子'}
      width={700}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={submit} disabled={!String(f.name).trim()}>
            <Icon name="check" size={14} /> {bean ? '保存修改' : '加入豆仓'}
          </button>
        </>
      }
    >
      {imported && (
        <div className="imported-note">
          <Icon name="sparkle" size={14} />
          <span>{imported}</span>
        </div>
      )}

      <div className="form-grid">
        <Field label="品牌">
          <input className="input" list="brand-options" placeholder="例如：Manner" value={f.brand} onChange={(e) => set('brand', e.target.value)} />
          <datalist id="brand-options">
            {brands.map((b) => <option key={b} value={b} />)}
          </datalist>
        </Field>
        <Field label="豆子名字">
          <input className="input" placeholder="例如：耶加雪菲 水洗" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>

        <Field label="风味倾向（多选，可自建）" className="span-2">
          <TagInput value={Array.isArray(f.flavors) ? f.flavors : []} onChange={(v) => set('flavors', v)} suggestions={suggestions} />
        </Field>

        <Field label="烘焙程度" className="span-2" hint="切换烘焙度会自动带出推荐的养豆 / 赏味天数，可再手动改">
          <Segmented options={ROAST_LEVELS} value={f.roastLevel} onChange={applyRoastDefaults} />
        </Field>

        <Field label="冲煮方式" hint="决定用哪一档单份克数算份数与单杯费用">
          <Segmented
            options={BREW_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            value={method}
            onChange={(v) => set('brewMethod', v)}
          />
        </Field>
        <Field label="烘焙时间" hint="养豆期与赏味期均由此计算">
          <input className="input" type="date" value={f.roastDate} onChange={(e) => set('roastDate', e.target.value)} />
        </Field>

        <Field label="购买时间（可选）" hint="不填则按烘焙时间统计">
          <input className="input" type="date" value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
        </Field>
        <Field label="整袋价格（元）">
          <input className="input" type="number" min="0" step="0.01" placeholder="128" value={f.price} onChange={(e) => set('price', e.target.value)} />
        </Field>

        <Field label="总量（克）">
          <input className="input" type="number" min="0" step="1" placeholder="250" value={f.totalWeight} onChange={(e) => set('totalWeight', e.target.value)} />
        </Field>
        <Field label="烘焙渠道（可选）">
          <input className="input" list="retailer-options" placeholder="淘宝 / 独立烘焙商" value={f.retailer} onChange={(e) => set('retailer', e.target.value)} />
          <datalist id="retailer-options">
            {RETAILERS.map((r) => <option key={r} value={r} />)}
          </datalist>
        </Field>

        <Field label="养豆天数" hint={`推荐 ${ROAST_DEFAULTS[f.roastLevel].restDays} 天`}>
          <input className="input" type="number" min="0" max="90" value={f.restDaysOverride === null ? '' : f.restDaysOverride}
            onChange={(e) => set('restDaysOverride', e.target.value)} />
        </Field>
        <Field label="赏味期天数" hint={`推荐 ${ROAST_DEFAULTS[f.roastLevel].peakDays} 天`}>
          <input className="input" type="number" min="1" max="365" value={f.peakDaysOverride === null ? '' : f.peakDaysOverride}
            onChange={(e) => set('peakDaysOverride', e.target.value)} />
        </Field>

        <Field label="我的评分（可选）" className="span-2">
          <Stars value={f.rating} onChange={(v) => set('rating', v)} />
        </Field>
        <Field label="备注（可选）" className="span-2">
          <textarea className="input textarea" rows={3} placeholder="冲煮心得、烘焙商信息…" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      <button className="more-toggle" onClick={() => setShowMore((v) => !v)}>
        <Icon name="chevron" size={13} /> {showMore ? '收起产地与商品信息' : '补充产地与商品信息（可选）'}
      </button>

      {showMore && (
        <div className="form-grid more-grid">
          <Field label="产地">
            <input className="input" placeholder="埃塞俄比亚 耶加雪菲" value={f.origin} onChange={(e) => set('origin', e.target.value)} />
          </Field>
          <Field label="处理法">
            <input className="input" placeholder="水洗 / 日晒 / 蜜处理" value={f.processor} onChange={(e) => set('processor', e.target.value)} />
          </Field>
          <Field label="品种">
            <input className="input" placeholder="Heirloom / Caturra" value={f.variety} onChange={(e) => set('variety', e.target.value)} />
          </Field>
          <Field label="海拔">
            <input className="input" placeholder="1900-2200m" value={f.altitude} onChange={(e) => set('altitude', e.target.value)} />
          </Field>
          <Field label="商品链接" className="span-2" hint="用于回购时一键打开原商品页">
            <input className="input" placeholder="https://item.taobao.com/…" value={f.productUrl} onChange={(e) => set('productUrl', e.target.value)} />
          </Field>
          <Field label="赏味期提醒" className="span-2">
            <label className="check-row">
              <input type="checkbox" checked={!!f.overdueNotify} onChange={(e) => set('overdueNotify', e.target.checked)} />
              <span>这袋豆子过了最佳赏味期时，在桌面提醒我</span>
            </label>
          </Field>
        </div>
      )}

      <div className="preview">
        <div className="preview-row">
          <span>养豆完成</span><b>{restEnd}</b>
          <span>最佳赏味期</span><b>{restEnd} ~ {peakEnd}</b>
        </div>
        <div className="preview-row">
          <span>可做份数</span><b>{formatNum(s)} 份（{servingGrams}g/份）</b>
          <span>单杯费用</span><b>{formatMoney(cps)}</b>
        </div>
        {leftGrams > 0 && (
          <div className="preview-row">
            <span>起始余量</span><b>{formatNum(leftGrams)}g</b>
            <span>喝掉后自动扣减</span><b>每记一杯扣 1 份</b>
          </div>
        )}
      </div>
    </Modal>
  );
}
