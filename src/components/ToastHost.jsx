import React from 'react';
import { useApp } from '../store/AppContext.jsx';
import Icon from './Icon.jsx';

export default function ToastHost() {
  const { toasts } = useApp();
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            <Icon name={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'info'} size={14} />
          </span>
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={async () => {
                try { await t.action(); } finally { t.dismiss && t.dismiss(); }
              }}
            >
              {t.actionLabel || '撤销'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
