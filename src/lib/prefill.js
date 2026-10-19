/* 导入暂存：任何入口（链接 / 剪贴板 / OCR / 扩展）解析出的字段都先放这里，
 * 由 BeansPage 消费 → 打开已预填的添加表单。避免「先跳页再塞值」的时序竞争。
 */
const KEY = 'doucang:pendingPrefill';

export function setPendingPrefill(fields) {
  try {
    window.__doucangPrefill = fields;
  } catch (e) { /* ignore */ }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(fields));
  } catch (e) { /* ignore */ }
}

export function takePendingPrefill() {
  let v = null;
  try {
    v = window.__doucangPrefill || null;
    window.__doucangPrefill = null;
  } catch (e) { /* ignore */ }
  if (!v) {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) v = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }
  try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return v;
}

export function peekPendingPrefill() {
  try {
    if (window.__doucangPrefill) return window.__doucangPrefill;
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
