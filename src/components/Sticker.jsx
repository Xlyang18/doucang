import React from 'react';

/**
 * 平面贴纸集（v2.4）
 *
 * 设计语言：手账贴纸
 * · 统一 2.5~3px 深色描边 + 白色外圈（模拟贴纸切边）
 * · 参考线微斜（默认 -2° ~ 3°），像手贴上去的
 * · 尺寸由 size 控制，viewBox 固定 64×64
 * · 颜色全部走 CSS 变量，随主题自适应
 *
 * 可用贴纸见 STICKERS，页面通过 <Sticker name="..." /> 使用。
 */

const S = 'var(--sticker-ink, #3A2A20)';       // 描边墨色
const CREAM = '#FFF8EC';
const PAPER = '#FFFDF8';

/* 通用外框：给内部图形加白色切边 */
function Frame({ children, rotate = 0, shadow = true }) {
  return (
    <g transform={`rotate(${rotate} 32 32)`} style={{ filter: shadow ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.10)) drop-shadow(0 3px 6px rgba(0,0,0,0.10))' : undefined }}>
      {children}
    </g>
  );
}

/* ---------- 1. 手冲壶 ---------- */
function PourOver() {
  return (
    <Frame rotate={-4}>
      {/* 白色切边 */}
      <g stroke="#fff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M18 32 h24 a5 5 0 0 1 5 5 v8 a6 6 0 0 1 -6 6 h-22 a5 5 0 0 1 -5 -5 v-9 a5 5 0 0 1 4 -5z" />
        <path d="M47 36 l10 -9 c2 -2 5 0 3 3 l-8 11" />
      </g>
      {/* 壶身 */}
      <path d="M18 32 h24 a5 5 0 0 1 5 5 v8 a6 6 0 0 1 -6 6 h-22 a5 5 0 0 1 -5 -5 v-9 a5 5 0 0 1 4 -5z"
        fill="#E9D3BE" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      {/* 壶嘴 */}
      <path d="M47 36 l10 -9 c2 -2 5 0 3 3 l-8 11" fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* 细口壶嘴尖 */}
      <path d="M57 29 l3 -2" stroke={S} strokeWidth="2.6" strokeLinecap="round" />
      {/* 把手 */}
      <path d="M13 38 c-6 0 -8 5 -6 9 c1 3 4 5 8 5" fill="none" stroke={S} strokeWidth="3" strokeLinecap="round" />
      {/* 高光 */}
      <path d="M23 38 v11" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity="0.85" />
      {/* 壶盖 */}
      <path d="M24 32 h16" stroke={S} strokeWidth="2.4" strokeLinecap="round" opacity="0.35" />
    </Frame>
  );
}

/* ---------- 2. 咖啡杯（冒热气） ---------- */
function Cup() {
  return (
    <Frame rotate={2}>
      <g stroke="#fff" strokeWidth="7" strokeLinejoin="round" fill="none">
        <path d="M18 28 h26 v10 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10z" />
        <path d="M44 31 c6 0 7 8 0 8" />
      </g>
      <path d="M18 28 h26 v10 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10z"
        fill={CREAM} stroke={S} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M44 31 c6 0 7 8 0 8" fill="none" stroke={S} strokeWidth="2.6" strokeLinecap="round" />
      {/* 咖啡液面 */}
      <ellipse cx="31" cy="29" rx="13" ry="3.2" fill="#8B5E3C" stroke={S} strokeWidth="2.2" />
      {/* 热气 */}
      <path d="M26 22 c-2 -3 2 -4 0 -7" fill="none" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
      <path d="M33 21 c-2 -3 2 -4 0 -8" fill="none" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
    </Frame>
  );
}

/* ---------- 3. 咖啡豆 ---------- */
function Bean() {
  return (
    <Frame rotate={-8}>
      <ellipse cx="32" cy="32" rx="15" ry="10" fill="#fff" stroke="#fff" strokeWidth="7" transform="rotate(-30 32 32)" />
      <ellipse cx="32" cy="32" rx="15" ry="10" fill="#A9714B" stroke={S} strokeWidth="2.6" transform="rotate(-30 32 32)" />
      <path d="M24 24 c4 4 12 12 16 16" stroke={S} strokeWidth="2.4" strokeLinecap="round" fill="none" transform="rotate(-30 32 32)" />
      <path d="M22 20 c3 2 6 3 9 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.65" fill="none" transform="rotate(-30 32 32)" />
    </Frame>
  );
}

/* ---------- 4. 研磨器 ---------- */
function Grinder() {
  return (
    <Frame rotate={3}>
      <g stroke="#fff" strokeWidth="7" strokeLinejoin="round" fill="none">
        <rect x="22" y="30" width="20" height="22" rx="4" />
        <path d="M26 30 v-5 a6 6 0 0 1 12 0 v5" />
      </g>
      <rect x="22" y="30" width="20" height="22" rx="4" fill="#D9C3AC" stroke={S} strokeWidth="2.6" />
      <path d="M26 30 v-5 a6 6 0 0 1 12 0 v5" fill={PAPER} stroke={S} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="32" cy="21" r="2.4" fill={S} />
      <path d="M22 38 h20" stroke={S} strokeWidth="2" opacity="0.55" />
      <path d="M26 44 h12" stroke={S} strokeWidth="2" strokeLinecap="round" opacity="0.35" />
    </Frame>
  );
}

/* ---------- 5. 星标（评分） ---------- */
function StarMark() {
  return (
    <Frame rotate={-6}>
      <path d="M32 14 l5.3 11 12 1.7 -8.7 8.5 2 12 -10.6 -5.6 -10.6 5.6 2 -12 -8.7 -8.5 12 -1.7z"
        fill="#fff" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d="M32 14 l5.3 11 12 1.7 -8.7 8.5 2 12 -10.6 -5.6 -10.6 5.6 2 -12 -8.7 -8.5 12 -1.7z"
        fill="#F7C948" stroke={S} strokeWidth="2.6" strokeLinejoin="round" />
    </Frame>
  );
}

/* ---------- 6. 日历印章（烘焙日） ---------- */
function DateStamp() {
  return (
    <Frame rotate={4}>
      <rect x="14" y="18" width="36" height="32" rx="4" fill="#fff" stroke="#fff" strokeWidth="7" />
      <rect x="14" y="18" width="36" height="32" rx="4" fill={PAPER} stroke={S} strokeWidth="2.6" />
      <rect x="14" y="18" width="36" height="9" rx="4" fill="#E8A87C" stroke={S} strokeWidth="2.6" />
      <path d="M22 14 v7 M42 14 v7" stroke={S} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M22 34 h20 M22 41 h13" stroke={S} strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
    </Frame>
  );
}

/* ---------- 7. 叶子（新鲜 / 生豆） ---------- */
function Leaf() {
  return (
    <Frame rotate={-12}>
      <path d="M32 50 C20 42 18 26 32 14 C46 26 44 42 32 50z"
        fill="#fff" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d="M32 50 C20 42 18 26 32 14 C46 26 44 42 32 50z"
        fill="#8CC084" stroke={S} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M32 18 v26" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <path d="M32 30 l-6 -5 M32 38 l6 -5" stroke={S} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </Frame>
  );
}

/* ---------- 8. 发票（花钱） ---------- */
function Receipt() {
  return (
    <Frame rotate={5}>
      <path d="M20 14 h24 v36 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3z"
        fill="#fff" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d="M20 14 h24 v36 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3z"
        fill={PAPER} stroke={S} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M25 24 h14 M25 31 h14 M25 38 h8" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </Frame>
  );
}

/* ---------- 9. 波浪尺（时间刻度） ---------- */
function Ruler() {
  return (
    <Frame rotate={-4}>
      <rect x="10" y="24" width="44" height="16" rx="3" fill="#fff" stroke="#fff" strokeWidth="7" />
      <rect x="10" y="24" width="44" height="16" rx="3" fill="#F2E4D4" stroke={S} strokeWidth="2.6" />
      <path d="M17 24 v6 M24 24 v9 M31 24 v6 M38 24 v9 M45 24 v6" stroke={S} strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </Frame>
  );
}

/* ---------- 10. 图钉 ---------- */
function Pin() {
  return (
    <Frame rotate={0}>
      <circle cx="32" cy="26" r="13" fill="#fff" stroke="#fff" strokeWidth="7" />
      <circle cx="32" cy="26" r="13" fill="#E4572E" stroke={S} strokeWidth="2.6" />
      <circle cx="27" cy="21" r="3.4" fill="#fff" opacity="0.75" />
      <path d="M32 39 v10" stroke={S} strokeWidth="2.8" strokeLinecap="round" />
    </Frame>
  );
}


/* ---------- 11. 咖啡袋（首页主贴纸） ---------- */
function Bag() {
  return (
    <Frame rotate={-3}>
      {/* 白切边 */}
      <g stroke="#fff" strokeWidth="9" strokeLinejoin="round" fill="none">
        <path d="M18 22 l4 -6 h20 l4 6 v30 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4z" />
        <path d="M18 22 h28" />
      </g>
      {/* 袋身 */}
      <path d="M18 22 l4 -6 h20 l4 6 v30 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4z"
        fill="#C89066" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      {/* 顶部封口 */}
      <path d="M18 22 h28" stroke={S} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 16 h20" stroke={S} strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
      {/* 标签牌 */}
      <rect x="24" y="30" width="16" height="16" rx="2.5" fill={PAPER} stroke={S} strokeWidth="2.6" />
      <path d="M28 36 h8 M28 41 h5" stroke={S} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* 咖啡豆小图标 */}
      <ellipse cx="32" cy="55" rx="0" ry="0" fill="none" />
    </Frame>
  );
}

/* ---------- 12. 手账本（首页副贴纸） ---------- */
function Notebook() {
  return (
    <Frame rotate={4}>
      <g stroke="#fff" strokeWidth="9" strokeLinejoin="round" fill="none">
        <rect x="16" y="14" width="32" height="40" rx="4" />
      </g>
      <rect x="16" y="14" width="32" height="40" rx="4" fill="#F3E2CE" stroke={S} strokeWidth="3" />
      {/* 书脊 */}
      <path d="M24 14 v40" stroke={S} strokeWidth="3" />
      <path d="M20 18 v32" stroke={S} strokeWidth="2" opacity="0.45" />
      {/* 横线 */}
      <path d="M30 24 h13 M30 31 h13 M30 38 h9" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
      {/* 书签 */}
      <path d="M40 14 v12 l3 -3 l3 3 v-12z" fill="#E4572E" stroke={S} strokeWidth="2.2" strokeLinejoin="round" />
    </Frame>
  );
}

/* ---------- 13. 牛皮纸标签 ---------- */
function Tag() {
  return (
    <Frame rotate={-6}>
      <g stroke="#fff" strokeWidth="9" strokeLinejoin="round" fill="none">
        <path d="M22 18 h18 l12 14 -12 14 h-18 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 h-2 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3z" />
      </g>
      <path d="M22 18 h18 l12 14 -12 14 h-18 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z"
        fill="#E8D5B7" stroke={S} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="32" r="3" fill={PAPER} stroke={S} strokeWidth="2.4" />
      <path d="M32 28 h10 M32 36 h7" stroke={S} strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
    </Frame>
  );
}

export const STICKERS = {
  pourover: PourOver,
  cup: Cup,
  bean: Bean,
  grinder: Grinder,
  star: StarMark,
  date: DateStamp,
  leaf: Leaf,
  receipt: Receipt,
  ruler: Ruler,
  pin: Pin,
  bag: Bag,
  notebook: Notebook,
  tag: Tag
};

/**
 * @param {string} name  贴纸名（见 STICKERS）
 * @param {number} size  像素尺寸
 * @param {number} rotate 额外旋转角度，会叠加在贴纸自带角度上
 * @param {string} className
 */
export default function Sticker({ name, size = 56, rotate = 0, className = '', title }) {
  const Comp = STICKERS[name];
  if (!Comp) return null;
  return (
    <span
      className={`sticker sticker-${name} ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flex: 'none',
        display: 'inline-block',
        transform: rotate ? `rotate(${rotate}deg)` : undefined
      }}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{ width: size, height: size, minWidth: size, minHeight: size, flex: 'none' }}
        focusable="false"
      >
        <Comp />
      </svg>
    </span>
  );
}
