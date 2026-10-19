import React, { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';

const FEATURES = [
  { icon: 'coffee', title: '豆仓管理', desc: '记录品牌、风味、烘焙度与时间，自动计算养豆期与最佳赏味期。' },
  { icon: 'star', title: '心愿单', desc: '预存想买的豆子，买回后一键转入豆仓，只需补填烘焙时间。' },
  { icon: 'heart', title: '花费与风味', desc: '累计花费、单杯费用、风味偏好与烘焙程度分布，一目了然。' },
  { icon: 'box', title: '数据完全本地', desc: '所有数据保存在本机，支持 JSON 导出备份与去重导入恢复。' }
];

export default function AboutPage() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    window.api.getVersion().then(setVersion);
  }, []);

  return (
    <div className="page-inner about">
      <div className="about-hero">
        <Logo size={72} />
        <h1>豆藏</h1>
        <p className="about-tagline">COFFEE VAULT · 为每一杯好咖啡而生</p>
        <p className="about-version">版本 {version || '1.0.0'} · macOS</p>
      </div>

      <p className="about-intro">
        豆藏是一款专注咖啡豆记录与管理的本地应用：追踪每一只买到的豆子，从养豆到最佳赏味期，
        从心愿单到豆仓，帮你把花费、风味与口感偏好都整理得明明白白。
      </p>

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon"><Icon name={f.icon} size={20} /></span>
            <b>{f.title}</b>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="about-foot">
        <p>© 2026 豆藏 · 用 ❤ 与咖啡因打造</p>
        <p className="muted small">数据仅存储在本机，不会上传任何服务器。</p>
      </div>
    </div>
  );
}
