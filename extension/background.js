/* 豆藏 · 商品采集扩展（MV3 service worker）
 * 只和本机 127.0.0.1 通信，不发往任何其他服务器。
 */
const ENDPOINT = 'http://127.0.0.1:47823/clip';

async function grab(tab) {
  if (!tab || !tab.id) return { ok: false, error: '没有可采集的页面' };
  if (!/taobao\.com|tmall\.com|jd\.com/.test(tab.url || '')) {
    return { ok: false, error: '只在淘宝 / 天猫 / 京东商品页可用' };
  }
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage });
  const payload = res && res.result ? res.result : null;
  if (!payload) return { ok: false, error: '页面没读到内容' };

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Doucang': '1' },
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) return { ok: false, error: json.error || `豆藏返回 ${resp.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '连不上本机豆藏（请先打开豆藏应用）' };
  }
}

/* 注入到页面里的采集逻辑（必须自包含，不能引用外部变量） */
function collectPage() {
  const pick = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  };
  const title = pick(['#J_Title h3', '.tb-main-title', '.itemInfo-wrap .sku-name', 'h1']) || document.title;
  const price = pick(['#J_StrPrice .tb-rmb-num', '.tm-price', '.summary-price .price', '.price .p-price .price', '.price-now']);
  const sku = pick(['#J_DetailMeta .tm-clear', '#J_DetailMeta', '#detail .tb-detail-hd', '.Ptable', '.sku-wrap', '.p-parameter']);
  const attrs = Array.from(document.querySelectorAll('.attributes-list li, #J_AttrUL li, #J_AttrUL .attr-list li, .p-parameter li, ul#J_AttrUL li'))
    .map((li) => li.textContent.trim())
    .filter(Boolean)
    .join('\n');
  const desc = pick(['#J_DivItemDesc', '.parameter2', '.product-intro']);
  const text = [title, price ? `价格：¥${price}` : '', attrs, sku, desc].filter(Boolean).join('\n').slice(0, 18000);
  return { url: location.href, title, text, source: 'extension' };
}

chrome.action.onClicked.addListener(async (tab) => {
  const r = await grab(tab);
  if (r.ok) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '✓' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#4C9A5C' });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 2000);
  } else {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#C95A4C' });
    await chrome.action.setTitle({ tabId: tab.id, title: `豆藏：${r.error}` });
    setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 2500);
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'send-to-doucang') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await grab(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-doucang',
    title: '发送到豆藏',
    contexts: ['page', 'link']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'send-to-doucang') await grab(tab);
});
