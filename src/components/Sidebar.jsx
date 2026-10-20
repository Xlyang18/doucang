import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  { id: 'changelog', label: '更新日志', icon: 'clock' },
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

  // B4：当前页指示条 —— 量出 active 项的位置，用一个滑块平移过去
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState({ y: 0, h: 0, visible: false });

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector('.nav-item.active');
    if (!el) { setIndicator((s) => ({ ...s, visible: false })); return; }
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setIndicator({
      y: box.top - navBox.top + nav.scrollTop + 8,
      h: Math.max(0, box.height - 16),
      visible: true
    });
  }, [page]);

  // 窗口尺寸变化时重新量
  useEffect(() => {
    const onResize = () => {
      const nav = navRef.current;
      const el = nav && nav.querySelector('.nav-item.active');
      if (!nav || !el) return;
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setIndicator({ y: box.top - navBox.top + nav.scrollTop + 8, h: Math.max(0, box.height - 16), visible: true });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">豆藏</span>
          <span className="brand-sub">COFFEE VAULT</span>
        </div>
      </div>
      <nav className="nav" ref={navRef}>
        <span
          className={`nav-indicator ${indicator.visible ? 'is-visible' : ''}`}
          style={{ '--y': `${indicator.y}px`, '--h': `${indicator.h}px` }}
          aria-hidden="true"
        />
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
