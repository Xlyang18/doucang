import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { analyzeImport } from '../lib/dedup.js';
import { ROAST_DEFAULTS } from '../lib/calc.js';
import { Modal, ConfirmDialog, Segmented, PageHead, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const THEME_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
];

export default function SettingsPage() {
  const { data, update, toast, setSetting, importBundle, go } = useApp();
  const settings = data.settings;
  const [newTag, setNewTag] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState([]);
  const [logs, setLogs] = useState([]);
  const [preview, setPreview] = useState(null); // { analysis, incoming, fileName }
  const [previewMode, setPreviewMode] = useState('skip');
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [server, setServer] = useState(null);
  const [dir, setDir] = useState('');

  const refreshMeta = async () => {
    try {
      setBackups((await window.api.listBackups?.()) || []);
      setLogs((await window.api.readLogs?.()) || []);
      setServer((await window.api.serverStatus?.()) || null);
      setDir((await window.api.getDataDir?.()) || '');
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { refreshMeta(); }, []);

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (data.flavorTags.includes(t)) { toast('该风味标签已存在', 'info'); return; }
    update((d) => ({ ...d, flavorTags: [...d.flavorTags, t] }));
    toast(`已创建风味标签「${t}」`);
    setNewTag('');
  };

  const removeTag = (tag) => {
    update((d) => ({
      ...d,
      flavorTags: d.flavorTags.filter((t) => t !== tag),
      beans: d.beans.map((b) => ({ ...b, flavors: (b.flavors || []).filter((f) => f !== tag) })),
      wishlist: d.wishlist.map((w) => ({ ...w, flavors: (w.flavors || []).filter((f) => f !== tag) }))
    }));
    toast(`已删除风味标签「${tag}」`, 'info');
  };

  const doExport = async () => {
    const res = await window.api.exportData(data);
    if (res && !res.canceled) { toast(`备份已导出：${res.filePath}`); refreshMeta(); }
  };

  /* A4：导入先出预览，再按策略合并 */
  const doImport = async () => {
    const res = await window.api.importData();
    if (!res || res.canceled) return;
    if (res.error) { toast(res.error, 'error'); return; }
    const analysis = analyzeImport(data, res.data || {});
    setPreviewMode('skip');
    setRestoreSettings(false);
    setPreview({ analysis, incoming: res.data || {}, fileName: res.filePath });
  };

  const applyImport = () => {
    if (!preview) return;
    const decisions = {};
    preview.analysis.beanConflicts.forEach((c) => { decisions[c.incoming.id] = previewMode; });
    preview.analysis.wishConflicts.forEach((c) => { decisions[c.incoming.id] = previewMode === 'copy' ? 'skip' : previewMode; });
    const stats = importBundle(preview.incoming, decisions, { restoreSettings });
    if (stats) {
      toast(`导入完成 · 新增豆子 ${stats.addedBeans} / 覆盖 ${stats.overwrittenBeans} / 心愿 +${stats.addedWish} / 标签 +${stats.addedTags} / 跳过 ${stats.skipped}`);
    }
    setPreview(null);
  };

  const doClear = () => {
    update((d) => ({ ...d, beans: [], wishlist: [], wishHistory: [] }));
    toast('已清空豆仓与心愿单', 'info');
    setConfirmClear(false);
  };

  const doExcel = async () => {
    setBusy(true);
    try {
      const res = await window.api.exportExcel(data, new Date().toISOString().slice(0, 10));
      if (res && !res.canceled) toast(`已导出 Excel：${res.file}`);
    } finally { setBusy(false); }
  };

  const doPdf = async () => {
    setBusy(true);
    try {
      const res = await window.api.exportPrintPdf(data);
      if (res && !res.canceled) toast(`豆册 PDF 已保存：${res.filePath}`);
    } finally { setBusy(false); }
  };

  const conflicts = preview ? (preview.analysis.beanConflicts.length + preview.analysis.wishConflicts.length) : 0;

  return (
    <div className="page-inner settings">
      <PageHead title="设置" sub="参数、外观、导出与数据管理" />

      <section className="settings-section">
        <h2 className="section-title">冲煮参数</h2>
        <div className="settings-cards">
          <div className="settings-card">
            <div className="sc-head"><b>手冲单份克数</b><span className="sc-unit">克</span></div>
            <div className="sc-body">
              <button className="stepper" onClick={() => setSetting('pourGrams', Math.max(1, (settings.pourGrams || 15) - 1))}>−</button>
              <input className="input num" type="number" min="1" value={settings.pourGrams || 15}
                onChange={(e) => setSetting('pourGrams', Math.max(1, Number(e.target.value) || 1))} />
              <button className="stepper" onClick={() => setSetting('pourGrams', (settings.pourGrams || 15) + 1)}>+</button>
            </div>
            <p className="sc-desc">默认 15g（1:15 = 一杯 225g）。手冲豆的份数与单杯按这一档算。</p>
          </div>

          <div className="settings-card">
            <div className="sc-head"><b>意式单份克数</b><span className="sc-unit">克</span></div>
            <div className="sc-body">
              <button className="stepper" onClick={() => setSetting('espressoGrams', Math.max(1, (settings.espressoGrams || 18) - 1))}>−</button>
              <input className="input num" type="number" min="1" value={settings.espressoGrams || 18}
                onChange={(e) => setSetting('espressoGrams', Math.max(1, Number(e.target.value) || 1))} />
              <button className="stepper" onClick={() => setSetting('espressoGrams', (settings.espressoGrams || 18) + 1)}>+</button>
            </div>
            <p className="sc-desc">默认 18g 双份。意式豆（深烘拼配）按这一档算，不再和手冲混用。</p>
          </div>

          <div className="settings-card">
            <div className="sc-head"><b>冷萃 / 浸泡单份克数</b><span className="sc-unit">克</span></div>
            <div className="sc-body">
              <button className="stepper" onClick={() => setSetting('immersionGrams', Math.max(1, (settings.immersionGrams || 20) - 1))}>−</button>
              <input className="input num" type="number" min="1" value={settings.immersionGrams || 20}
                onChange={(e) => setSetting('immersionGrams', Math.max(1, Number(e.target.value) || 1))} />
              <button className="stepper" onClick={() => setSetting('immersionGrams', (settings.immersionGrams || 20) + 1)}>+</button>
            </div>
            <p className="sc-desc">默认 20g（1:10 = 200g 冷萃）。快记的第三档方案，不需要可以不管。</p>
          </div>

          <div className="settings-card">
            <div className="sc-head"><b>兜底养豆期</b><span className="sc-unit">天</span></div>
            <div className="sc-body">
              <button className="stepper" onClick={() => setSetting('restDays', Math.max(1, settings.restDays - 1))}>−</button>
              <input className="input num" type="number" min="1" value={settings.restDays}
                onChange={(e) => setSetting('restDays', Math.max(1, Number(e.target.value) || 1))} />
              <button className="stepper" onClick={() => setSetting('restDays', settings.restDays + 1)}>+</button>
            </div>
            <p className="sc-desc">按烘焙度推荐：浅 {ROAST_DEFAULTS.light.restDays} / 中 {ROAST_DEFAULTS.medium.restDays} / 深 {ROAST_DEFAULTS.dark.restDays} 天；每袋都可单独覆盖。</p>
          </div>

          <div className="settings-card">
            <div className="sc-head"><b>兜底赏味期</b><span className="sc-unit">天</span></div>
            <div className="sc-body">
              <button className="stepper" onClick={() => setSetting('peakDays', Math.max(1, settings.peakDays - 1))}>−</button>
              <input className="input num" type="number" min="1" value={settings.peakDays}
                onChange={(e) => setSetting('peakDays', Math.max(1, Number(e.target.value) || 1))} />
              <button className="stepper" onClick={() => setSetting('peakDays', settings.peakDays + 1)}>+</button>
            </div>
            <p className="sc-desc">按烘焙度推荐：浅 {ROAST_DEFAULTS.light.peakDays} / 中 {ROAST_DEFAULTS.medium.peakDays} / 深 {ROAST_DEFAULTS.dark.peakDays} 天。</p>
          </div>
        </div>
        <div className="settings-note">
          <Icon name="info" size={14} />
          <span>可做份数 = 总量 ÷ 单份克数；单杯费用 = 整袋价格 ÷ 可做份数。记录冲煮后还会显示「真实已花」与真实单杯成本。</span>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">提醒与外观</h2>
        <div className="settings-row">
          <div className="row-label"><b>到期提醒</b><span>养豆完成 / 赏味期将尽 / 已过赏味期 / 豆子快见底</span></div>
          <label className="switch-row">
            <input type="checkbox" checked={settings.overdueNotify !== false} onChange={(e) => setSetting('overdueNotify', e.target.checked)} />
            <span>{settings.overdueNotify !== false ? '已开启' : '已关闭'}</span>
          </label>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>测试提醒</b><span>立即检查一次是否有到期项（会弹一条系统通知）</span></div>
          <button className="btn" onClick={async () => { await window.api.notifyTest?.(); toast('已触发提醒检查', 'info'); }}>
            <Icon name="bell" size={14} /> 立即检查
          </button>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>主题模式</b><span>深色 / 浅色 / 跟随系统</span></div>
          <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(v) => setSetting('theme', v)} />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">风味标签</h2>
        <p className="section-desc">创建后可复用于豆仓与心愿单；删除标签会同时从豆子中移除。</p>
        <div className="tag-manage">
          {(data.flavorTags || []).map((t) => (
            <span key={t} className="tag tag-lg">
              {t}
              <button className="tag-remove" onClick={() => removeTag(t)} aria-label={`删除 ${t}`}><Icon name="x" size={11} /></button>
            </span>
          ))}
          <div className="tag-add">
            <input className="input" placeholder="新标签，回车添加" value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <button className="btn btn-sm" onClick={addTag}><Icon name="plus" size={13} /> 添加</button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">导出</h2>
        <div className="settings-row">
          <div className="row-label"><b>导出 Excel 台账</b><span>6 个工作表：豆仓总表 / 冲煮记录 / 采购台账 / 心愿单 / 风味评分 / 年度汇总</span></div>
          <button className="btn" onClick={doExcel} disabled={busy}><Icon name="sheet" size={14} /> 导出 Excel</button>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>打印豆册 / 导出 PDF</b><span>A4 两列排版、每袋一张卡片，可裁切装订成册</span></div>
          <div className="row-actions">
            <button className="btn" onClick={doPdf} disabled={busy}><Icon name="printer" size={14} /> 存为 PDF</button>
            <button className="btn btn-ghost" onClick={() => window.api.openPrintPreview?.(data)}><Icon name="external" size={14} /> 打印预览</button>
          </div>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>本季分享卡片</b><span>生成 1080px 图片，可发朋友圈或推荐给朋友</span></div>
          <button className="btn" onClick={() => go('shared', { mode: 'season' })}><Icon name="share" size={14} /> 去生成</button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">数据管理</h2>
        <div className="settings-row">
          <div className="row-label"><b>导出备份</b><span>将全部数据导出为 JSON 文件</span></div>
          <button className="btn" onClick={doExport} disabled={busy}><Icon name="download" size={14} /> 导出 JSON</button>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>导入恢复</b><span>先预览冲突，再选择跳过 / 覆盖 / 作为新批次</span></div>
          <button className="btn" onClick={doImport} disabled={busy}><Icon name="upload" size={14} /> 导入 JSON</button>
        </div>
        <div className="settings-row">
          <div className="row-label"><b>自动备份</b><span>每天一份滚动备份，保留最近 20 天</span></div>
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => window.api.revealBackups?.()}>打开备份目录</button>
            <span className="muted small">{backups.length} 份</span>
          </div>
        </div>
        <div className="settings-row danger">
          <div className="row-label"><b>清空数据</b><span>删除豆仓与心愿单的所有记录（设置与风味标签保留）</span></div>
          <button className="btn btn-danger" onClick={() => setConfirmClear(true)}><Icon name="trash" size={14} /> 清空</button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">本地抓取服务</h2>
        <div className="settings-row">
          <div className="row-label">
            <b>服务状态</b>
            <span>{server ? (server.ok ? `运行中 · 127.0.0.1:${server.port}` : `未启动${server.error ? ' · ' + server.error : ''}`) : '检测中…'}</span>
          </div>
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => window.api.openExtensionGuide?.()}>打开扩展目录</button>
            <button className="btn btn-ghost" onClick={refreshMeta}><Icon name="refresh" size={13} /> 刷新</button>
          </div>
        </div>
        <div className="settings-note">
          <Icon name="info" size={14} />
          <span>只在 127.0.0.1 监听、只接受带 X-Doucang 头的请求，用于浏览器扩展把淘宝/京东商品页送给豆藏。数据目录：{dir || '—'}</span>
        </div>
      </section>

      {logs.length > 0 && (
        <section className="settings-section">
          <h2 className="section-title">活动日志</h2>
          <div className="log-list">
            {logs.slice(0, 30).map((l, i) => <div key={i} className="log-row">{l}</div>)}
          </div>
        </section>
      )}

      {/* 导入预览 */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="导入预览"
        width={660}
        footer={
          <>
            <button className="btn" onClick={() => setPreview(null)}>取消</button>
            <button className="btn btn-primary" onClick={applyImport}>
              <Icon name="check" size={14} /> 执行导入
            </button>
          </>
        }
      >
        {preview && (
          <>
            <p className="section-desc">文件：<b>{String(preview.fileName || '').split('/').pop()}</b></p>
            <div className="import-summary">
              <div><i>新增豆子</i><b>{preview.analysis.freshBeans.length}</b></div>
              <div><i>重复豆子</i><b className={preview.analysis.beanConflicts.length ? 'warn-text' : ''}>{preview.analysis.beanConflicts.length}</b></div>
              <div><i>新增心愿</i><b>{preview.analysis.freshWish.length}</b></div>
              <div><i>重复心愿</i><b className={preview.analysis.wishConflicts.length ? 'warn-text' : ''}>{preview.analysis.wishConflicts.length}</b></div>
              <div><i>新增标签</i><b>{preview.analysis.newTags.length}</b></div>
            </div>

            {conflicts > 0 && (
              <>
                <Field label="重复记录怎么处理" hint="重复判定：品牌 + 名字 + 烘焙时间">
                  <Segmented
                    options={[
                      { value: 'skip', label: '跳过（保留本地）' },
                      { value: 'overwrite', label: '用备份覆盖' },
                      { value: 'copy', label: '作为新批次导入' }
                    ]}
                    value={previewMode}
                    onChange={setPreviewMode}
                  />
                </Field>
                <div className="conflict-list">
                  {preview.analysis.beanConflicts.slice(0, 8).map((c, i) => (
                    <div key={i} className="conflict-row">
                      <span>{c.incoming.brand} · {c.incoming.name}</span>
                      <span className="muted small">{c.incoming.roastDate} · 本地 {c.existing.totalWeight || 0}g / 备份 {c.incoming.totalWeight || 0}g</span>
                    </div>
                  ))}
                  {conflicts > 8 && <p className="muted small">还有 {conflicts - 8} 条…</p>}
                </div>
              </>
            )}

            {preview.incoming.settings && (
              <label className="check-row">
                <input type="checkbox" checked={restoreSettings} onChange={(e) => setRestoreSettings(e.target.checked)} />
                <span>同时恢复备份里的参数设置（养豆期 / 赏味期 / 单份克数）</span>
              </label>
            )}
            <div className="settings-note">
              <Icon name="info" size={14} />
              <span>「作为新批次导入」适合同一只豆子回购两次的情况，会保留两份记录。</span>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        title="清空全部数据"
        message="确定清空豆仓与心愿单的所有记录吗？此操作不可恢复，建议先导出备份。"
        confirmText="清空"
        danger
        onConfirm={doClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
