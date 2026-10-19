export function formatMoney(n) {
  const num = Number(n) || 0;
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(s) {
  if (!s) return '—';
  return String(s);
}

export function formatNum(n, digits = 1) {
  const num = Number(n) || 0;
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${y}年${m}月`;
}

export function shortMonthLabel(key) {
  const [, m] = key.split('-').map(Number);
  return `${m}月`;
}
