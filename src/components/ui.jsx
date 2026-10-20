import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import CountUp from './CountUp.jsx';
import Sticker from './Sticker.jsx';

/* 全局滚动锁计数：多个弹窗同时打开时，只有计数归零才恢复滚动。
 *
 * 曾经的 bug：第一层弹窗打开时记下 body 原有 overflow（''），
 * 关闭时恢复——但如果此时第二层还开着，恢复成 '' 会让背景能滚；
 * 反过来若在计数为 0 时误调 unlock，又会把 hidden 记成「原始值」。
 * 现在用 data 属性保存原始值，且只在计数 0→1 时写、1→0 时读，
 * 绝不把 hidden 本身当成原始值。
 */
let scrollLockCount = 0;

function lockScroll() {
  if (scrollLockCount === 0) {
    // 只记住「不是 hidden」的原始值，避免把锁状态记成原始值
    const current = document.body.style.overflow;
    if (current !== 'hidden') document.body.dataset.prevOverflow = current;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
  window.__scrollLockCount = scrollLockCount;
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = document.body.dataset.prevOverflow || '';
    delete document.body.dataset.prevOverflow;
  }
  window.__scrollLockCount = scrollLockCount;
}

/* ---------- Modal ---------- */
/**
 * 共享元素过渡（C4）
 * 传入 origin（被点卡片的 getBoundingClientRect()），弹窗从那个位置「长出来」。
 * 依据 Apple 的连续性原则：动画起点必须与被点元素视觉相连，
 * 而不是凭空从屏幕中央淡入。曲线减速，320ms，可被「减弱动态效果」跳过。
 */
export function Modal({
  open, onClose, title, children, footer, width = 560, origin = null,
  overlayClass = '', role = 'dialog', closeOnBackdrop = true, closeOnEsc = true
}) {
  const panelRef = useRef(null);
  const [morph, setMorph] = useState(null);
  const downOnBackdrop = useRef(false);

  /* ---------- ESC 关闭 ---------- */
  useEffect(() => {
    if (!open || !closeOnEsc) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // 只让位于最上层的弹窗响应，避免一次 ESC 关掉两层
      const overlays = document.querySelectorAll('.modal-overlay');
      const last = overlays[overlays.length - 1];
      if (!last || !last.contains(panelRef.current)) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closeOnEsc]);

  /* ---------- 滚动锁：弹窗打开时禁止背景滚动 ----------
   * 用引用计数而不是「记住上一次的值」：
   * 两层弹窗叠加时，第二层会把已经锁定的 hidden 当成原始值保存，
   * 第一层关闭后把 hidden 写回去，背景就永远滚不动了。
   */
  useEffect(() => {
    if (!open) return undefined;
    lockScroll();
    return () => { unlockScroll(); };
  }, [open]);

  /* ---------- 焦点：打开时移到面板，关闭时还原 ---------- */
  useEffect(() => {
    if (!open) return undefined;
    const prevFocus = document.activeElement;
    const el = panelRef.current;
    if (el) {
      el.setAttribute('tabindex', '-1');
      // 下一帧再聚焦，等入场动画起步
      const t = setTimeout(() => el.focus({ preventScroll: true }), 30);
      return () => {
        clearTimeout(t);
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      };
    }
    return undefined;
  }, [open]);

  /* ---------- 共享元素过渡 ---------- */
  useLayoutEffect(() => {
    if (!open) { setMorph(null); return undefined; }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!origin || reduce) { setMorph(null); return undefined; }
    const el = panelRef.current;
    if (!el) return undefined;
    const target = el.getBoundingClientRect();
    const ow = origin.width || 1;
    const oh = origin.height || 1;
    if (!target.width || !target.height) return undefined;
    setMorph({
      transform: `translate3d(${(origin.left + ow / 2) - (target.left + target.width / 2)}px, `
        + `${(origin.top + oh / 2) - (target.top + target.height / 2)}px, 0) `
        + `scale(${ow / target.width}, ${oh / target.height})`,
      opacity: 0.6
    });
    const t = setTimeout(() => setMorph(null), 24);
    return () => clearTimeout(t);
  }, [open, origin]);

  if (!open) return null;

  /*
   * 遮罩关闭的正确做法：
   * 必须同时满足「按下在遮罩上」和「松开也在遮罩上」才关。
   * 只用 onMouseDown 会误关——用户在遮罩上按住、拖到面板里松开想选文字，
   * 弹窗就没了；在弹窗里按下、拖到遮罩松开也会误判。
   */
  const onDown = (e) => { downOnBackdrop.current = e.target === e.currentTarget; };
  const onUp = (e) => {
    const isBackdrop = e.target === e.currentTarget;
    if (closeOnBackdrop && isBackdrop && downOnBackdrop.current) onClose?.();
    downOnBackdrop.current = false;
  };

  return (
    <div
      className={`modal-overlay ${overlayClass}`}
      onMouseDown={onDown}
      onMouseUp={onUp}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`modal ${morph ? 'is-morphing' : ''}`}
        style={{ maxWidth: width, ...(morph || {}) }}
        role={role}
        aria-modal="true"
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- ConfirmDialog ---------- */
export function ConfirmDialog({ open, title = '确认操作', message, confirmText = '确认', danger = false, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      overlayClass="confirm-overlay"
      role="alertdialog"
      footer={
        <>
          <button className="btn" onClick={onCancel}>取消</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon = 'coffee', sticker = null, title, desc, action }) {
  return (
    <div className="empty">
      {sticker
        ? <span className="empty-sticker"><Sticker name={sticker} size={88} /></span>
        : <div className="empty-icon"><Icon name={icon} size={30} /></div>}
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/* ---------- Segmented ---------- */
export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className={`seg seg-${size}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`seg-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stars ---------- */
export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= (value || 0) ? 'on' : ''}`}
          onClick={() => onChange?.(n === value ? null : n)}
          aria-label={`${n} 星`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= (value || 0) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* ---------- TagInput ---------- */
export function TagInput({ value = [], onChange, suggestions = [], placeholder = '输入后回车添加' }) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);

  const filtered = text.trim()
    ? suggestions.filter((s) => s.includes(text.trim()) && !value.includes(s)).slice(0, 6)
    : [];

  const add = (tag) => {
    const t = (tag || text).trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };

  const remove = (tag) => onChange(value.filter((v) => v !== tag));

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1]);
    } else if (e.key === 'ArrowDown' && filtered.length && focus) {
      // allow quick pick via suggestions list click instead
    }
  };

  return (
    <div className="tag-input" onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 120)}>
      <div className="tag-wrap">
        {value.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" className="tag-remove" onClick={() => remove(t)} aria-label="移除">
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {focus && (filtered.length > 0 || text.trim()) && (
        <div className="suggest">
          {filtered.map((s) => (
            <button key={s} type="button" className="suggest-item" onMouseDown={(e) => { e.preventDefault(); add(s); }}>
              <Icon name="tag" size={12} /> {s}
            </button>
          ))}
          {text.trim() && !suggestions.includes(text.trim()) && (
            <button type="button" className="suggest-item create" onMouseDown={(e) => { e.preventDefault(); add(); }}>
              <Icon name="plus" size={12} /> 创建「{text.trim()}」
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({ label, value, sub, icon, accent, onClick, hint, countUp = true, format }) {
  // C2：纯数字值自动做滚动动画；带单位/货币的字符串保持原样
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} title={hint || ''}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon ${accent || ''}`}><Icon name={icon} size={16} /></span>}
      </div>
      <div className="stat-value">
        {isNumeric && countUp ? <CountUp value={value} format={format} /> : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ---------- TripToggle：花费口径三档切换 ---------- */
export function TripToggle({ value, onChange, options }) {
  const opts = options || [
    { value: 'consumed', label: '真实已花', hint: '按已喝掉的部分计算' },
    { value: 'all', label: '全部购入', hint: '含囤着没开的豆子' },
    { value: 'stock', label: '库存市值', hint: '剩余豆子的价值' }
  ];
  return (
    <div className="trip-toggle">
      {opts.map((o) => (
        <button
          key={o.value}
          className={`trip-btn ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Meter：横向进度条（余量 / 养豆进度） ---------- */
export function Meter({ value = 0, max = 100, cls = 'accent', label, suffix }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="meter">
      {label && <div className="meter-head"><span>{label}</span>{suffix && <b>{suffix}</b>}</div>}
      <div className="meter-track"><div className={`meter-fill ${cls}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ---------- Panel ---------- */
export function Panel({ title, sub, children, className = '', actions }) {
  return (
    <div className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <h3>{title}</h3>
          {sub && <span className="panel-sub">{sub}</span>}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- PageHead ---------- */
export function PageHead({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.badge != null && t.badge > 0 ? <span className="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
