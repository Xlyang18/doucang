import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { analyzeImport, applyImport } from '../lib/dedup.js';
import { DEFAULT_SETTINGS, DEFAULT_FLAVOR_TAGS, SCHEMA_VERSION, normalizeBrewing } from '../lib/schema.mjs';

const AppContext = createContext(null);

function blankData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    flavorTags: [...DEFAULT_FLAVOR_TAGS],
    beans: [],
    wishlist: [],
    wishHistory: [],
    clips: [],
    logs: []
  };
}

export function AppProvider({ children }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('home');
  const [pageParam, setPageParam] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [loadError, setLoadError] = useState(null);
  const saveTimer = useRef(null);
  // 最新数据的同步副本：update() 靠它取"上一份"并立即拍板要保存的值
  const dataRef = useRef(null);

  useEffect(() => {
    window.api.loadData().then((res) => {
      // 兼容旧 preload（直接返回数据对象）
      const d = res && res.data ? res.data : res;
      if (res && res.loadError) setLoadError(res.loadError);
      const initial = d && d.schemaVersion ? d : blankData();
      dataRef.current = initial;
      setData(initial);
    });
  }, []);

  const theme = data ? data.settings.theme : 'system';

  useEffect(() => {
    if (!data) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      setResolvedTheme(resolved);
    };
    apply();
    mq.addEventListener?.('change', apply);
    window.api.setTheme(theme);
    return () => mq.removeEventListener?.('change', apply);
  }, [theme, data]);

  /** 所有写操作都走这里：先落地状态，再拍板"要保存的那份"。
   *  原因：setState 的更新函数会被 React 延到渲染时执行，不能在里面顺手写盘——
   *  撤销 / 连续两次快记时，先后两次写入可能乱序，导致后写的旧值盖掉新值。 */
  const update = useCallback((fn) => {
    const prev = dataRef.current;
    if (!prev) return;
    const next = typeof fn === 'function' ? fn(prev) : fn;
    dataRef.current = next;
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.api.saveData(dataRef.current);
      window.api.syncData?.(dataRef.current);
    }, 150);
  }, []);

  const toast = useCallback((message, type = 'success', opts = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    const duration = opts.duration || (opts.action ? 6000 : 3200);
    setToasts((t) => [...t, {
      id,
      message,
      type,
      action: opts.action || null,
      actionLabel: opts.actionLabel || '撤销',
      dismiss: () => setToasts((t) => t.filter((x) => x.id !== id))
    }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
    return id;
  }, []);

  const go = useCallback((target, param = null) => {
    setPage(target);
    setPageParam(param);
  }, []);

  /* ---------- 领域操作（统一入口，页面不直接拼数据） ---------- */

  const addBean = useCallback((bean) => {
    update((d) => ({ ...d, beans: [{ ...bean, updatedAt: new Date().toISOString() }, ...d.beans] }));
  }, [update]);

  const saveBean = useCallback((bean) => {
    update((d) => {
      const exists = d.beans.some((b) => b.id === bean.id);
      const next = { ...bean, updatedAt: new Date().toISOString() };
      return { ...d, beans: exists ? d.beans.map((b) => (b.id === bean.id ? next : b)) : [next, ...d.beans] };
    });
  }, [update]);

  const removeBean = useCallback((id) => {
    update((d) => ({ ...d, beans: d.beans.filter((b) => b.id !== id) }));
  }, [update]);

  /** 喝了一杯：追加冲煮记录（剩余量由记录推导，不单独存字段） */
  const logBrewing = useCallback((beanId, brewing) => {
    let saved;
    update((d) => ({
      ...d,
      beans: d.beans.map((x) => {
        if (x.id !== beanId) return x;
        saved = normalizeBrewing({ ...brewing, date: brewing.date || new Date().toISOString().slice(0, 10) });
        return { ...x, brewings: [saved, ...(x.brewings || [])], updatedAt: new Date().toISOString() };
      })
    }));
    return saved;
  }, [update]);

  /** 撤销一杯：删掉这条记录；若它当时触发了"自动喝完"，一并回滚 */
  const undoBrewing = useCallback((beanId, brewingId, opts = {}) => {
    update((d) => ({
      ...d,
      beans: d.beans.map((x) => {
        if (x.id !== beanId) return x;
        const brewings = (x.brewings || []).filter((br) => br.id !== brewingId);
        const rollbackFinish = opts.autoFinished === true && x.finished;
        return {
          ...x,
          brewings,
          finished: rollbackFinish ? false : x.finished,
          finishedDate: rollbackFinish ? '' : x.finishedDate,
          finishedWeight: rollbackFinish ? null : x.finishedWeight,
          updatedAt: new Date().toISOString()
        };
      })
    }));
  }, [update]);

  const removeBrewing = useCallback((beanId, brewingId) => {
    update((d) => ({
      ...d,
      beans: d.beans.map((x) => (x.id === beanId
        ? { ...x, brewings: (x.brewings || []).filter((br) => br.id !== brewingId) }
        : x))
    }));
  }, [update]);

  /** 标记喝完：记录已用总量，避免最后一杯没记导致"剩余"残留 */
  const finishBean = useCallback((beanId) => {
    update((d) => ({
      ...d,
      beans: d.beans.map((b) => {
        if (b.id !== beanId) return b;
        const used = (b.brewings || []).reduce((s, br) => s + (Number(br.grams) || 0), 0);
        return {
          ...b,
          finished: true,
          finishedDate: new Date().toISOString().slice(0, 10),
          finishedWeight: b.finishedWeight != null && b.finishedWeight > 0 ? b.finishedWeight : (used || Number(b.totalWeight) || 0),
          updatedAt: new Date().toISOString()
        };
      })
    }));
  }, [update]);

  const restoreBean = useCallback((beanId) => {
    update((d) => ({
      ...d,
      beans: d.beans.map((b) => (b.id === beanId ? { ...b, finished: false, finishedDate: '', finishedWeight: null, updatedAt: new Date().toISOString() } : b))
    }));
  }, [update]);

  /** 撤销"喝完"（快记自动归档 / 手动标记通用）：回到在喝状态并清掉记满的余量 */
  const undoFinish = useCallback((beanId) => restoreBean(beanId), [restoreBean]);

  const addWish = useCallback((wish) => {
    update((d) => ({ ...d, wishlist: [{ ...wish, updatedAt: new Date().toISOString() }, ...d.wishlist] }));
  }, [update]);

  const saveWish = useCallback((wish) => {
    update((d) => {
      const exists = d.wishlist.some((w) => w.id === wish.id);
      const next = { ...wish, updatedAt: new Date().toISOString() };
      return { ...d, wishlist: exists ? d.wishlist.map((w) => (w.id === wish.id ? next : w)) : [next, ...d.wishlist] };
    });
  }, [update]);

  const removeWish = useCallback((id) => {
    update((d) => ({ ...d, wishlist: d.wishlist.filter((w) => w.id !== id) }));
  }, [update]);

  /** 回购：把喝完的豆子带回心愿单，带上原价与原链接 */
  const rebuyToWishlist = useCallback((bean, opts = {}) => {
    const now = new Date().toISOString();
    const wish = {
      id: `wish-${now}-${Math.random().toString(16).slice(2, 6)}`,
      brand: bean.brand || '',
      name: bean.name || '',
      flavors: bean.flavors || [],
      roastLevel: bean.roastLevel || 'medium',
      price: bean.price || 0,
      totalWeight: bean.totalWeight || 0,
      notes: opts.note || '回购',
      brewMethod: bean.brewMethod || 'pour',
      targetPrice: opts.targetPrice ?? (bean.price || null),
      productUrl: bean.productUrl || '',
      retailer: bean.retailer || '',
      rebuyFrom: bean.id,
      rebuyCount: (bean.rebuyCount || 0) + 1,
      createdAt: now,
      updatedAt: now
    };
    update((d) => ({ ...d, wishlist: [wish, ...d.wishlist] }));
    return wish;
  }, [update]);

  const transferWish = useCallback((wish, bean) => {
    update((d) => ({
      ...d,
      beans: [{ ...bean, updatedAt: new Date().toISOString() }, ...d.beans],
      wishlist: d.wishlist.filter((w) => w.id !== wish.id),
      wishHistory: [{ ...wish, transferredAt: new Date().toISOString(), beanId: bean.id }, ...(d.wishHistory || [])].slice(0, 200)
    }));
  }, [update]);

  const setSetting = useCallback((key, value) => {
    update((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  }, [update]);

  /** 导入：先出分析报告，再由页面逐条决策 */
  const importBundle = useCallback((incoming, decisions, opts) => {
    const d = dataRef.current;
    if (!d) return null;
    const analysis = analyzeImport(d, incoming);
    const res = applyImport(d, analysis, decisions || {}, opts || {});
    update(res.data);
    return { ...res, analysis };
  }, [update]);

  if (!data) {
    return (
      <div className="boot">
        <div className="boot-logo">豆</div>
        <p>正在唤醒豆仓…</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      data, update, page, pageParam, setPage: go, go, toast, toasts, resolvedTheme, loadError,
      addBean, saveBean, removeBean, logBrewing, undoBrewing, removeBrewing, finishBean, restoreBean, undoFinish,
      addWish, saveWish, removeWish, rebuyToWishlist, transferWish, setSetting, importBundle
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
