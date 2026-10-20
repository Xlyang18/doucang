import React, { useEffect, useMemo, useState } from 'react';
import { CHANGELOG, TYPE_META } from '../lib/changelog.js';
import { PageHead } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import Sticker from '../components/Sticker.jsx';

/** 相对时间：今天 / 3 天前 / 2 个月前，比纯日期更有「刚更新过」的感觉 */
function relativeLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

/** 版本号比较：把 "2.10.0" 正确排在 "2.9.0" 之后 */
function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return y - x;
  }
  return 0;
}

function StatusPill({ current, latest }) {
  if (current) {
    return <span className="cl-pill cl-pill-current"><Icon name="check" size={11} /> 当前版本</span>;
  }
  if (latest) {
    return <span className="cl-pill cl-pill-new"><Icon name="sparkle" size={11} /> 最新</span>;
  }
  return <span className="cl-pill cl-pill-old">已归档</span>;
}

function Entry({ item, current, latest, open, onToggle }) {
  const counts = item.sections.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + s.items.length;
    return acc;
  }, {});

  return (
    <article className={`cl-entry ${open ? 'is-open' : ''}`}>
      <button className="cl-head" onClick={onToggle} aria-expanded={open}>
        <div className="cl-rail">
          <span className={`cl-dot ${current ? 'is-current' : ''}`} />
        </div>
        <div className="cl-summary-row">
          <div className="cl-title-row">
            <span className="cl-version">v{item.version}</span>
            <StatusPill current={current} latest={latest} />
            <span className="cl-mood" aria-hidden="true">{item.mood}</span>
          </div>
          <h3 className="cl-title">{item.title}</h3>
          <div className="cl-meta">
            <span>{item.date}</span>
            <span className="cl-dot-sep">·</span>
            <span>{relativeLabel(item.date)}</span>
            <span className="cl-counts">
              {Object.entries(counts).map(([t, n]) => (
                <span key={t} className={`cl-count cl-count-${t}`}>
                  {TYPE_META[t]?.emoji || '·'} {n}
                </span>
              ))}
            </span>
          </div>
          {!open && <p className="cl-peek">{item.summary}</p>}
        </div>
        <span className="cl-chevron"><Icon name="chevron" size={14} /></span>
      </button>

      {open && (
        <div className="cl-body">
          <p className="cl-lede">{item.summary}</p>
          {item.sections.map((sec) => (
            <section key={sec.type} className={`cl-section cl-${sec.type}`}>
              <h4>
                <span className="cl-sec-emoji">{TYPE_META[sec.type]?.emoji || '·'}</span>
                {sec.label}
                <span className="cl-sec-n">{sec.items.length}</span>
              </h4>
              <ul>
                {sec.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

export default function ChangelogPage() {
  const [version, setVersion] = useState('');
  const [openSet, setOpenSet] = useState({});

  useEffect(() => {
    window.api.getVersion?.().then((v) => setVersion(v || '')).catch(() => {});
  }, []);

  const entries = useMemo(() => [...CHANGELOG].sort((a, b) => cmpVersion(a.version, b.version)), []);

  // 首次进入默认展开第一条（最新）
  useEffect(() => {
    if (entries[0]) setOpenSet({ [entries[0].version]: true });
  }, [entries]);

  const totalCount = entries.reduce(
    (n, e) => n + e.sections.reduce((m, s) => m + s.items.length, 0), 0
  );

  const toggle = (v) => setOpenSet((prev) => ({ ...prev, [v]: !prev[v] }));

  return (
    <div className="page-inner changelog notebook-lines">
      <PageHead
        title={(
          <span className="head-with-sticker">
            更新日志
            <span className="head-sticker"><Sticker name="pin" size={40} rotate={-12} /></span>
          </span>
        )}
        sub={`${entries.length} 个版本 · ${totalCount} 条改动 · 每次更新都记在这里 (๑•̀ㅂ•́)✧`}
        actions={
          <button
            className="btn btn-ghost"
            onClick={() => {
              const all = {};
              const anyClosed = entries.some((e) => !openSet[e.version]);
              entries.forEach((e) => { all[e.version] = anyClosed; });
              setOpenSet(all);
            }}
          >
            <Icon name="filter" size={14} />
            {entries.some((e) => !openSet[e.version]) ? '全部展开' : '全部收起'}
          </button>
        }
      />

      <div className="cl-timeline">
        {entries.map((item, idx) => (
          <Entry
            key={item.version}
            item={item}
            current={!!version && item.version === version}
            latest={idx === 0 && (!version || item.version !== version)}
            open={!!openSet[item.version]}
            onToggle={() => toggle(item.version)}
          />
        ))}
      </div>

      <div className="cl-foot">
        <p>豆藏的老规矩：每一次改动都留痕，喝过的每一杯都算数 ☕</p>
        <p className="muted small">版本号遵循语义化版本：主版本.次版本.修订号</p>
      </div>
    </div>
  );
}
