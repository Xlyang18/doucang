import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { resolveBean, roastLabel, todayStr } from '../lib/calc.js';
import { formatMoney } from '../lib/format.js';
import { renderSharePng } from '../lib/shareCard.js';
import { seasonSummary, ratingBoard } from '../lib/stats.js';
import { PageHead, Panel, EmptyState, Segmented } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

/**
 * 分享 / 对比
 * 1) 本季我喝了什么（1080×1080 卡片）
 * 2) 单袋豆子卡片（1080×760）—— 推荐给朋友
 */
export default function SharePage() {
  const { data, pageParam, toast } = useApp();
  const settings = data.settings;
  const beans = data.beans || [];
  const [mode, setMode] = useState((pageParam && pageParam.mode) || 'season');
  const [beanId, setBeanId] = useState(beans[0]?.id || '');
  const [preview, setPreview] = useState(null); // dataURL
  const [busy, setBusy] = useState(false);

  // 显式传入今天，避免各页面/卡片取到不同的「今天」
  const season = useMemo(() => seasonSummary(beans, settings, todayStr()), [beans, settings]);
  const board = useMemo(() => ratingBoard(beans, settings), [beans, settings]);
  const bean = beans.find((b) => b.id === beanId) || beans[0];
  const snap = bean ? resolveBean(bean, settings) : null;

  const build = async () => {
    setBusy(true);
    try {
      const payload = mode === 'season'
        ? {
          mode: 'season',
          season,
          beans: (season.reorderList.length ? season.reorderList : board.map((r) => ({ brand: r.bean.brand, name: r.bean.name, rating: r.bean.rating }))),
          generatedAt: new Date().toLocaleString('zh-CN')
        }
        : {
          mode: 'bean',
          season,
          beans: bean ? [{
            ...bean,
            roastLevel: bean.roastLevel,
            costPerServing: snap.costPerServing,
            restEnd: snap.windows.restEnd,
            peakEnd: snap.windows.peakEnd
          }] : [],
          generatedAt: new Date().toLocaleString('zh-CN')
        };
      const png = await renderSharePng(payload);
      const blob = new Blob([png.bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setPreview({ url, png });
    } catch (e) {
      toast(`生成失败：${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    const name = mode === 'season'
      ? `豆藏·${season.title.replace(/\s/g, '')}季报.png`
      : `豆藏·${bean?.name || '豆子'}.png`;
    const res = await window.api.savePng(name, preview.png.bytes);
    if (res && !res.canceled) toast(`已保存：${res.filePath}`);
  };

  const copy = async () => {
    if (!preview) return;
    try {
      const item = new ClipboardItem({ 'image/png': new Blob([preview.png.bytes], { type: 'image/png' }) });
      await navigator.clipboard.write([item]);
      toast('图片已复制到剪贴板，可直接粘贴到微信 / 小红书');
    } catch (e) {
      toast('复制失败，请改用「保存图片」', 'error');
    }
  };

  if (beans.length === 0) {
    return (
      <div className="page-inner">
        <PageHead title="分享与对比" />
        <EmptyState icon="share" title="先记几袋豆子再分享" desc="有数据之后可以生成「本季我喝了什么」或单袋豆子卡片。" />
      </div>
    );
  }

  return (
    <div className="page-inner">
      <PageHead
        title="分享与对比"
        sub="生成图片发朋友圈、小红书，或把某只豆子推荐给朋友"
        actions={<button className="btn btn-primary" onClick={build} disabled={busy}><Icon name="sparkle" size={14} /> {busy ? '生成中…' : '生成卡片'}</button>}
      />

      <Panel title="选择卡片类型">
        <div className="share-mode">
          <Segmented
            options={[
              { value: 'season', label: '本季我喝了什么' },
              { value: 'bean', label: '单袋豆子卡片' }
            ]}
            value={mode}
            onChange={(v) => { setMode(v); setPreview(null); }}
          />
          {mode === 'bean' && (
            <select className="input select" value={beanId} onChange={(e) => { setBeanId(e.target.value); setPreview(null); }}>
              {beans.map((b) => <option key={b.id} value={b.id}>{b.brand ? `${b.brand} · ` : ''}{b.name}</option>)}
            </select>
          )}
        </div>

        {mode === 'season' ? (
          <div className="season-brief">
            <div><i>时间范围</i><b>{season.title}</b></div>
            <div><i>杯数</i><b>{season.cups}</b></div>
            <div><i>袋数</i><b>{season.beans}</b></div>
            <div><i>消耗</i><b>{season.grams}g</b></div>
            <div><i>平均单杯</i><b>{formatMoney(season.avgCostPerCup)}</b></div>
            <div><i>最爱风味</i><b>{season.topFlavors.slice(0, 2).join(' · ') || '—'}</b></div>
          </div>
        ) : snap && (
          <div className="season-brief">
            <div><i>豆子</i><b>{bean.brand ? `${bean.brand} · ` : ''}{bean.name}</b></div>
            <div><i>烘焙度</i><b>{roastLabel(bean.roastLevel)}</b></div>
            <div><i>单杯</i><b>{formatMoney(snap.costPerServing)}</b></div>
            <div><i>评分</i><b>{bean.rating ? '★'.repeat(bean.rating) : '未评分'}</b></div>
          </div>
        )}
      </Panel>

      <Panel title="预览" sub="1080px 宽 · 2x 高清导出">
        {preview ? (
          <>
            <div className="share-preview">
              <img src={preview.url} alt="分享卡片预览" />
            </div>
            <div className="share-actions">
              <button className="btn btn-primary" onClick={save}><Icon name="download" size={14} /> 保存图片</button>
              <button className="btn" onClick={copy}><Icon name="share" size={14} /> 复制到剪贴板</button>
              <button className="btn btn-ghost" onClick={build}><Icon name="refresh" size={14} /> 重新生成</button>
            </div>
          </>
        ) : (
          <div className="share-empty">
            <Icon name="share" size={26} />
            <p>点右上角「生成卡片」预览效果</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
