import React from 'react';

/**
 * 弧形仪表盘（A4）
 * 用 SVG 半圆描边路径画「库存健康度」，中间显示数字。
 *
 * 遵循 Apple Watch 圆环的视觉习惯：底轨用低对比度灰，填充用单色渐变，
 * 端点加圆角帽。数值变化时用 stroke-dashoffset 过渡，不动布局。
 *
 * 档位：0–33 偏少（黄）｜34–66 健康（绿）｜67–100 充裕（蓝）
 */
export default function Gauge({
  value = 0,        // 0~100
  label = '',
  center = '',      // 中间大数字
  sub = '',
  size = 168
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 240° 弧（从 -210° 到 30°），留出下方缺口放文字
  const startAngle = 150;
  const sweep = 240;
  const polar = (angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [x1, y1] = polar(startAngle);
  const [x2, y2] = polar(startAngle + sweep);
  const arcLen = (sweep / 360) * 2 * Math.PI * r;
  const track = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;

  const tier = pct <= 33 ? 'low' : pct <= 66 ? 'ok' : 'rich';
  const tierColor = { low: '#FF9F0A', ok: '#34C759', rich: '#B0713F' }[tier];

  return (
    <div className={`gauge gauge-${tier}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${pct}%`}>
        <defs>
          <linearGradient id={`gg-${tier}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tierColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={tierColor} stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={track} fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round" opacity="0.55" />
        <path
          d={track}
          fill="none"
          stroke={`url(#gg-${tier})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={arcLen * (1 - pct / 100)}
          className="gauge-fill"
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-label">{label}</span>
        <b>{center}</b>
        {sub && <em>{sub}</em>}
      </div>
    </div>
  );
}
