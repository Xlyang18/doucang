"use strict";
/* 桌面提醒（本地通知）：养豆完成 / 赏味期将尽 / 该补货
 * 只在 macOS 原生通知里出现，不联网；同一事项每天最多提醒一次。
 */
const { Notification } = require('electron');

const HOUR = 3600 * 1000;

function fmtList(items, n = 3) {
  const head = items.slice(0, n).map((x) => x.label);
  const more = items.length > n ? ` 等 ${items.length} 袋` : '';
  return head.join('、') + more;
}

/**
 * buildNotifications(beans, settings, today, resolveBeanFn)
 * → [{ id, title, body }]  只返回「今天该提醒」的
 */
function buildNotifications(beans, settings, today, resolveBean, todayStr) {
  const out = [];
  if (!settings || settings.overdueNotify === false) return out;
  const pendingRest = [];
  const nearPeak = [];
  const overPast = [];
  const lowStock = [];
  for (const b of beans) {
    if (b.finished) continue;
    const s = resolveBean(b, settings, today);
    const label = `${b.brand ? b.brand + ' · ' : ''}${b.name}`;
    // 养豆完成「次日」提醒：10-06 烘焙 + 深烘 4 天 = 10-10 完成，此日 status 已是 peak 且满 20 天
    const justRested = s.status === 'peak' && s.windows && s.windows.restEnd === today;
    if ((s.status === 'resting' && s.progress.days === 1) || justRested) pendingRest.push({ label, s, b });
    if (s.status === 'peak' && s.progress.days <= 5) nearPeak.push({ label, s, b });
    if (s.status === 'past' && b.overdueNotify !== false) overPast.push({ label, s, b });
    if (s.left > 0 && s.left <= (b.brewMethod === 'espresso' ? 60 : 40)) lowStock.push({ label, left: s.left });
  }
  if (pendingRest.length) {
    out.push({
      id: 'rest-done',
      title: `养豆完成 · ${pendingRest.length} 袋今天可以开喝了`,
      body: fmtList(pendingRest) + '，今天开始风味最佳。'
    });
  }
  if (nearPeak.length) {
    out.push({
      id: 'peak-ending',
      title: `赏味期快结束了 · ${nearPeak.length} 袋`,
      body: fmtList(nearPeak.map((x) => ({ label: `${x.label}（剩 ${x.s.progress.days} 天）` }))) + '，抓紧喝。'
    });
  }
  if (overPast.length) {
    out.push({
      id: 'past-peak',
      title: `已过最佳赏味期 · ${overPast.length} 袋`,
      body: fmtList(overPast.map((x) => ({ label: `${x.label}（超 ${-x.s.progress.days} 天）` }))) + '，建议优先消耗。'
    });
  }
  if (lowStock.length) {
    out.push({
      id: 'low-stock',
      title: `豆子快见底了 · ${lowStock.length} 袋`,
      body: lowStock.slice(0, 3).map((x) => `${x.label}（剩 ${x.left}g）`).join('、') + '，要记得补货。'
    });
  }
  return out;
}

/**
 * 提醒调度器：启动即检查一次，之后每小时检查一次；同 id 一天只发一次（除非用户点"稍后"）。
 */
class Notifier {
  constructor({ getState, resolveBean, todayStr, showWindow, log }) {
    this.getState = getState;
    this.resolveBean = resolveBean;
    this.todayStr = todayStr;
    this.showWindow = showWindow;
    this.log = log || (() => {});
    this.sent = new Map(); // id -> dateStr
    this.timer = null;
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), HOUR);
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(force = false) {
    try {
      if (!Notification.isSupported || !Notification.isSupported()) return [];
      const { beans = [], settings = {} } = this.getState();
      const today = this.todayStr();
      const list = buildNotifications(beans, settings, today, this.resolveBean, this.todayStr);
      const fired = [];
      for (const n of list) {
        if (!force && this.sent.get(n.id) === today) continue;
        this.sent.set(n.id, today);
        const notif = new Notification({
          title: n.title,
          body: n.body,
          silent: false,
          timeoutType: 'default'
        });
        notif.on('click', () => this.showWindow && this.showWindow());
        notif.show();
        fired.push(n);
      }
      if (fired.length) this.log(`提醒：${fired.map((f) => f.id).join(',')}`);
      return fired;
    } catch (e) {
      return [];
    }
  }
}

module.exports = { Notifier, buildNotifications };
