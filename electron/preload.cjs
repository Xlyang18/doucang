const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /* 数据 */
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  syncData: (data) => ipcRenderer.invoke('data:sync', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getDataDir: () => ipcRenderer.invoke('app:dataDir'),

  /* 自动备份 / 日志 */
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
  revealBackups: () => ipcRenderer.invoke('backup:reveal'),
  readLogs: () => ipcRenderer.invoke('logs:read'),

  /* 链接 / 剪贴板 / 采集服务 */
  parseLink: (text) => ipcRenderer.invoke('link:parse', text),
  readClipboard: () => ipcRenderer.invoke('clipboard:readText'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  listClips: () => ipcRenderer.invoke('clip:list'),
  openExtensionGuide: () => ipcRenderer.invoke('clip:openGuide'),
  serverStatus: () => ipcRenderer.invoke('server:status'),

  /* OCR */
  pickImage: () => ipcRenderer.invoke('ocr:pickImage'),
  recognizeLabel: (filePath) => ipcRenderer.invoke('ocr:recognize', filePath),

  /* 导出 / 打印 / 分享 */
  exportExcel: (data, today) => ipcRenderer.invoke('export:excel', data, today),
  exportPrintPdf: (data, today) => ipcRenderer.invoke('export:print', data, today),
  openPrintPreview: (data, today) => ipcRenderer.invoke('export:printPreview', data, today),
  savePng: (name, bytes) => ipcRenderer.invoke('share:savePng', name, bytes),
  notifyTest: () => ipcRenderer.invoke('notify:test'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  /* 事件 */
  onMenu: (cb) => {
    const h = (_e, action) => cb(action);
    ipcRenderer.on('menu', h);
    return () => ipcRenderer.removeListener('menu', h);
  },
  onClip: (cb) => {
    const h = (_e, item) => cb(item);
    ipcRenderer.on('clip:new', h);
    return () => ipcRenderer.removeListener('clip:new', h);
  }
});
