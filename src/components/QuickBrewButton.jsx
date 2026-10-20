import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext.jsx';
import { methodLabel } from '../lib/calc.js';
import { presetGrams, buildQuickBrew, brewResultText, QUICK_DEDUPE_MS, resolveDefaultMethod } from '../lib/quickBrew.js';
import Icon from './Icon.jsx';

/**
 * 一键记一杯（v2.1）
 * 主按钮 = 「所在位置」的默认方案（卡片里跟随该豆默认，详情/首页跟随场景）
 * 小箭头 = 展开方案选择，用 Portal 挂到 body，永远不被卡片 overflow 裁切
 */
export default function QuickBrewButton({
  bean, size = 'sm', block = false,
  onLogged, label = '喝一杯'
}) {
  const { data, toast, logBrewing, undoBrewing, finishBean } = useApp();
  const settings = data.settings;
  const [open, setOpen] = useState(false);
  const [dupGuard, setDupGuard] = useState(null);
  const [rect, setRect] = useState(null);
  const [flying, setFlying] = useState(null);
  const [tilting, setTilting] = useState(false);
  const mainRef = useRef(null);
  const rootRef = useRef(null);
  const lastRef = useRef({ method: '', at: 0 });

  const grams = presetGrams(settings);
  // 默认方案：设置的全局默认 > 豆子自身冲煮方式 > 历史习惯
  const resolved = resolveDefaultMethod(bean || {}, settings);
  const defaultMethod = resolved.method;
  const main = { method: defaultMethod, grams: grams[defaultMethod] };
  const disabled = !bean || bean.finished;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.bottom + 6, width: r.width });
    };
    place();
    const onDown = (e) => {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.qbrew-pop')) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const doRecord = (method) => {
    if (!bean) return;
    const built = buildQuickBrew(bean, settings, method);
    // 用 store 真正落库的那条记录（带 uid），撤销才删得掉
    const saved = logBrewing(bean.id, built.brewing) || built.brewing;
    const brewingId = saved.id;
    lastRef.current = { method, at: Date.now() };
    if (built.willFinish) {
      finishBean(bean.id);
      toast(`「${bean.name}」喝完啦 · 已归档`, 'success', {
        actionLabel: '撤销',
        action: () => undoBrewing(bean.id, brewingId, { autoFinished: true })
      });
    } else {
      toast(`已记 ${built.grams}g ${methodLabel(method)} · ${brewResultText(built.leftAfter, built.servingGrams)}`, 'success', {
        actionLabel: '撤销',
        action: () => undoBrewing(bean.id, brewingId, { autoFinished: false })
      });
    }
    setFlying({ id: Date.now(), method, grams: built.grams });
    setTilting(true);
    setTimeout(() => setFlightDone(), 760);
    if (onLogged) onLogged(built);
  };

  const record = (method) => {
    const now = Date.now();
    const last = lastRef.current;
    const dup = last && last.method === method && now - last.at < QUICK_DEDUPE_MS;
    if (dup) {
      // 60 秒内重复点同一方案：按钮内直接问"再记一杯？"，确认后才记，避免手抖双击
      setDupGuard({ method, at: now });
      setTimeout(() => setDupGuard((d) => (d && d.at === now ? null : d)), 4000);
      return;
    }
    doRecord(method);
  };

  const setFlightDone = () => { setFlying(null); setTilting(false); };

  const methods = ['pour', 'espresso', 'immersion'];

  return (
    <div ref={rootRef} className={`qbrew ${block ? 'qbrew-block' : ''} qbrew-${size} ${open ? 'is-open' : ''}`}>
      <button
        ref={mainRef}
        className={`qbrew-main ${tilting ? 'tilt' : ''}`}
        disabled={disabled}
        onMouseDown={(e) => { e.stopPropagation(); e.currentTarget.classList.add('pressed'); }}
        onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
        onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
        onClick={(e) => { e.stopPropagation(); record(main.method); }}
        title={disabled ? '这袋已经喝完' : `一键记 ${methodLabel(main.method)} ${main.grams}g`}
      >
        <Icon name="cup" size={13} />
        <span className="qbrew-text">{label}</span>
        <span className="qbrew-grams">{main.grams}g</span>
        <span className="qbrew-glow" aria-hidden="true" />
        <span className="qbrew-drops" aria-hidden="true">
          <i style={{ '--dx': '-10px', '--dy': '11px', animationDelay: '0ms' }} />
          <i style={{ '--dx': '-3px', '--dy': '14px', animationDelay: '60ms' }} />
          <i style={{ '--dx': '5px', '--dy': '12px', animationDelay: '110ms' }} />
        </span>
      </button>
      <button
        className="qbrew-more"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="更多方案"
        aria-expanded={open}
        title="切换方案"
      >
        <Icon name="chevron" size={12} />
      </button>

      {flying && (
        <span className="qbrew-float" aria-hidden="true">
          <Icon name="cup" size={12} /> {flying.grams}g {methodLabel(flying.method)}
        </span>
      )}

      {dupGuard && (
        <div className="qbrew-guard" role="alertdialog" aria-label="确认再记一杯">
          <span>再记一杯 {methodLabel(dupGuard.method)} {grams[dupGuard.method]}g？</span>
          <button className="qg-yes" onClick={(e) => { e.stopPropagation(); setDupGuard(null); doRecord(dupGuard.method); }}>确认</button>
          <button className="qg-no" onClick={(e) => { e.stopPropagation(); setDupGuard(null); }}>取消</button>
        </div>
      )}

      {open && rect && createPortal(
        <div
          className="qbrew-pop"
          style={{ left: rect.left, top: rect.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {methods.map((m, i) => (
            <button
              key={m}
              className={`qbrew-pop-item ${m === main.method ? 'is-default' : ''}`}
              style={{ animationDelay: `${i * 24}ms` }}
              onClick={() => { setOpen(false); record(m); }}
            >
              <span className="qp-label">{methodLabel(m)}</span>
              <span className="qp-grams">{grams[m]}g</span>
              {m === main.method && <span className="qp-tag">默认</span>}
            </button>
          ))}
          <div className="qbrew-pop-foot">预设克数可在「设置 → 冲煮参数」修改</div>
        </div>,
        document.body
      )}
    </div>
  );
}
