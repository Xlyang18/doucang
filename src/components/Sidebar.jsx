import React from 'react';
import { useApp } from '../store/AppContext.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { resolveBean } from '../lib/calc.js';

const ITEMS = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'beans', label: '豆仓', icon: 'coffee' },
  { id: 'stats', label: '数据统计', icon: 'chart' },
  { id: 'wishlist', label: '心愿单', icon: 'star' },
  { id: 'shared', label: '分享与对比', icon: 'share' },
  { id: 'settings', label: '设置', icon: 'sliders' },
  { id: 'about', label: '关于', icon: 'info' }
];

export default function Sidebar() {
  const { page, setPage, data } = useApp();
  const settings = data.settings;
  const beans = data.beans || [];
  const activeCount = beans.filter((b) => !b.finished).length;
  const wishCount = (data.wishlist || []).length;
  const dueCount = beans.filter((b) => {
    if (b.finished) return false;
    const s = resolveBean(b, settings);
    return (s.status === 'peak' && s.progress.days <= 5) || s.status === 'past';
  }).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">豆藏</span>
          <span className="brand-sub">COFFEE VAULT</span>
        </div>
      </div>
      <nav className="nav">
        {ITEMS.map((item) => {
          const badge = item.id === 'beans' ? activeCount : item.id === 'wishlist' ? wishCount : 0;
          return (
            <button
              key={item.id}
              data-nav={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {badge > 0 && <span className="nav-badge">{badge}</span>}
            </button>
          );
        })}
      </nav>
      {dueCount > 0 && (
        <div className="sidebar-alert" onClick={() => setPage('home')} title="赏味期将尽或已过">
          <Icon name="bell" size={13} />
          <span>{dueCount} 袋需要关注</span>
        </div>
      )}
      <div className="sidebar-foot">
        <Icon name="leaf" size={13} />
        <span>为每一杯好咖啡而生</span>
      </div>
    </aside>
  );
}
