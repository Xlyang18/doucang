import React, { useEffect, useRef, useState } from 'react';

/**
 * 数字滚动（C2）
 * 数值变化时从旧值平滑滚到新值，遵循 Apple 的「数值变化要有连续性」原则。
 *
 * - 默认用 requestAnimationFrame + easeOutCubic，时长 520ms
 * - 尊重系统「减弱动态效果」：开了就直接跳值
 * - 首次挂载不滚动（避免页面一进来所有数字一起动，像在抽搐）
 * - 保留原千分位与小数位，由 format 决定
 */
export default function CountUp({
  value = 0,
  format = (n) => String(Math.round(n)),
  duration = 520,
  className = ''
}) {
  const to = Number(value) || 0;
  const [shown, setShown] = useState(to);
  const fromRef = useRef(to);
  const rafRef = useRef(0);
  const didMount = useRef(false);

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // 首次渲染直接显示，不做动画
    if (!didMount.current) {
      didMount.current = true;
      fromRef.current = to;
      setShown(to);
      return undefined;
    }
    const from = fromRef.current;
    if (reduceMotion || from === to) {
      fromRef.current = to;
      setShown(to);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic：先快后缓，与 Apple 的减速曲线一致
      const k = 1 - (1 - t) ** 3;
      const next = from + (to - from) * k;
      setShown(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setShown(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration, reduceMotion]);

  return <span className={className}>{format(shown)}</span>;
}
