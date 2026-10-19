import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './store/AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import ToastHost from './components/ToastHost.jsx';
import PrefillConfirm from './components/PrefillConfirm.jsx';
import HomePage from './pages/HomePage.jsx';
import BeansPage from './pages/BeansPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import SharePage from './pages/SharePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ImportCapture from './pages/ImportCapture.jsx';

function Shell() {
  const { page, pageParam, data, go, toast } = useApp();
  const [importOpen, setImportOpen] = useState(null); // 'paste' | 'image' | null

  /* 菜单 → 渲染层动作 */
  useEffect(() => {
    const off = window.api.onMenu?.((action) => {
      if (action === 'import-link') setImportOpen('paste');
      else if (action === 'ocr') setImportOpen('image');
      else if (action === 'import-clipboard') {
        window.api.readClipboard().then((t) => {
          if (!t || !String(t).trim()) { toast('剪贴板里没有内容', 'info'); return; }
          window.api.parseLink(t).then((r) => {
            window.__doucangPrefill = { ...(r.fields || {}), imported: '来自剪贴板 · 请核对后保存' };
            window.dispatchEvent(new CustomEvent('doucang:prefill'));
          });
        });
      } else if (action === 'export') {
        window.api.exportData(data).then((r) => { if (r && !r.canceled) toast(`备份已导出：${r.filePath}`); });
      } else if (action === 'import') {
        go('settings');
        setTimeout(() => toast('请在「数据管理 → 导入恢复」选择备份文件', 'info'), 200);
      } else if (action === 'export-excel') {
        window.api.exportExcel(data, new Date().toISOString().slice(0, 10))
          .then((r) => { if (r && !r.canceled) toast(`Excel 已导出：${r.file}`); });
      } else if (action === 'print') {
        window.api.exportPrintPdf(data).then((r) => { if (r && !r.canceled) toast(`豆册 PDF 已保存：${r.filePath}`); });
      } else if (action === 'print-preview') {
        window.api.openPrintPreview?.(data);
      } else if (action === 'share') {
        go('shared', { mode: 'season' });
      }
    });
    return () => { if (off) off(); };
  }, [data, go, toast]);

  /* 扩展推送新采集 */
  useEffect(() => {
    const off = window.api.onClip?.((item) => {
      toast(`收到一条采集：${item.title || item.host || ''}`, 'info');
    });
    return () => { if (off) off(); };
  }, [toast]);

  const body = () => {
    switch (page) {
      case 'beans': return <BeansPage />;
      case 'stats': return <StatsPage />;
      case 'wishlist': return <WishlistPage />;
      case 'shared': return <SharePage />;
      case 'settings': return <SettingsPage />;
      case 'about': return <AboutPage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <div className="page" key={`${page}-${JSON.stringify(pageParam || null)}`}>
          {body()}
        </div>
      </main>
      <ToastHost />
      <PrefillConfirm />
      <ImportCapture open={!!importOpen} initialMode={importOpen || 'paste'} onClose={() => setImportOpen(null)} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
