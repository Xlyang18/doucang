import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
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
export function EmptyState({ icon = 'coffee', title, desc, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={30} /></div>
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
export function StatCard({ label, value, sub, icon, accent, onClick, hint }) {
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} title={hint || ''}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon ${accent || ''}`}><Icon name={icon} size={16} /></span>}
      </div>
      <div className="stat-value">{value}</div>
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
