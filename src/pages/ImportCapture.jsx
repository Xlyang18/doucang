import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { Modal, Field, EmptyState, PageHead, Panel } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { setPendingPrefill } from '../lib/prefill.js';

const METHOD = { paste: '粘贴文本', image: '识别图片' };

/**
 * 豆子导入面板：贴链接 / 粘贴商品文案 / 选图片识别
 * 解析在主进程完成（纯本地规则），这里负责预览与校正。
 */
export default function ImportCapture({ open, onClose, initialMode = 'paste' }) {
  const { data, toast, go } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState('');
  const [fields, setFields] = useState(null);
  const [rawText, setRawText] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const [imageInfo, setImageInfo] = useState(null);
  const [clips, setClips] = useState([]);
  const [serverOk, setServerOk] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setFields(null);
    setRawText('');
    setImageInfo(null);
    setSource('');
    loadClips();
    window.api.serverStatus?.().then((s) => setServerOk(!!(s && s.ok))).catch(() => setServerOk(false));
  }, [open, initialMode]);

  async function loadClips() {
    try {
      const list = await window.api.listClips();
      setClips(list || []);
    } catch (e) {
      setClips([]);
    }
  }

  const brands = useMemo(() => {
    const s = new Set();
    (data.beans || []).forEach((b) => b.brand && s.add(b.brand));
    return [...s].sort();
  }, [data.beans]);

  const parse = async (raw) => {
    if (!raw || !raw.trim()) return;
    setBusy(true);
    try {
      const res = await window.api.parseLink(raw);
      setFields(res.fields || {});
      setRawText(res.rawText || '');
      setSource('从链接 / 文案解析');
      if (res.url) toast(`已识别 ${res.retailer || '商品'} 链接`, 'info');
    } finally {
      setBusy(false);
    }
  };

  const pasteFromClipboard = async () => {
    const t = await window.api.readClipboard();
    setText(t || '');
    if (t) parse(t);
  };

  const pickImage = async () => {
    const res = await window.api.pickImage();
    if (!res || res.canceled) return;
    setBusy(true);
    try {
      const out = await window.api.recognizeLabel(res.filePath);
      if (!out.ok) {
        toast(`识别失败：${out.error}`, 'error');
        return;
      }
      setFields(out.fields || {});
      setImageInfo({ lines: out.lines || [], elapsed: out.elapsed, confidence: out.confidence || {} });
      setSource('从包装照片识别');
    } finally {
      setBusy(false);
    }
  };

  const useClip = (clip) => {
    setMode('paste');
    setText(`${clip.title}\n${clip.url}`);
    parse(`${clip.title}\n${clip.url}`);
  };

  const confidenceHint = (key) => {
    const c = imageInfo && imageInfo.confidence ? imageInfo.confidence[key] : 1;
    if (c === undefined) return null;
    if (c >= 0.8) return <span className="conf high">高</span>;
    if (c >= 0.5) return <span className="conf mid">需核对</span>;
    return <span className="conf low">建议手填</span>;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="导入豆子"
      width={760}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            disabled={!fields || !String(fields.name || '').trim()}
            onClick={() => {
              // 先落暂存，再跳转：豆仓页挂载时会自己取走，避免「先跳页后塞值」的时序竞争
              setPendingPrefill({ ...fields, imported: `${source} · 请核对后保存` });
              onClose();
              go('beans', 'add');
            }}
          >
            <Icon name="check" size={14} /> 去豆仓确认
          </button>
        </>
      }
    >
      <div className="import-tabs">
        {Object.entries(METHOD).map(([k, label]) => (
          <button key={k} className={`import-tab ${mode === k ? 'active' : ''}`} onClick={() => setMode(k)}>
            <Icon name={k === 'paste' ? 'link' : 'camera'} size={14} /> {label}
          </button>
        ))}
      </div>

      {mode === 'paste' ? (
        <>
          <p className="section-desc">
            粘贴淘宝 / 天猫 / 京东的商品链接或整段商品文案，豆藏会在本地解析品牌、价格、克重、烘焙日期、产地与处理法。
          </p>
          <textarea
            className="input textarea"
            rows={5}
            placeholder={'https://item.taobao.com/item.htm?id=123456…\n或直接粘贴：\n【幸运咖】埃塞俄比亚 耶加雪菲 水洗 G1 浅烘\n到手价 ¥88 净含量 250g 烘焙日期 2026-09-28'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="import-actions">
            <button className="btn" onClick={pasteFromClipboard}><Icon name="download" size={13} /> 读剪贴板</button>
            <button className="btn btn-primary" onClick={() => parse(text)} disabled={busy || !text.trim()}>
              <Icon name="sparkle" size={13} /> {busy ? '解析中…' : '解析'}
            </button>
          </div>

          {clips.length > 0 && (
            <div className="clip-list">
              <div className="clip-head">
                <b>来自浏览器扩展的采集</b>
                <span className="muted small">共 {clips.length} 条 · 本地服务{serverOk ? '已连接' : '未连接'}</span>
              </div>
              {clips.slice(0, 6).map((c) => (
                <div key={c.id} className="clip-row">
                  <div className="clip-main">
                    <span className="clip-title">{c.title || c.url}</span>
                    <span className="clip-meta">{c.host} · {String(c.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <button className="btn btn-sm" onClick={() => useClip(c)}>使用</button>
                </div>
              ))}
            </div>
          )}

          <div className="clip-guide">
            <Icon name="info" size={13} />
            <span>
              想从商品页一键采集？<button className="link-btn" onClick={() => window.api.openExtensionGuide()}>打开采集扩展目录</button>
              ，在 Chrome 里「加载已解压的扩展程序」，之后浏览淘宝/京东页面即可把商品信息送到这里（只在本机通信）。
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="section-desc">
            选一张包装标签照片，用 macOS Vision 在本地识别（不上传图片），自动带出烘焙日期、产区、处理法、净含量与风味。
          </p>
          <button className="btn btn-primary" onClick={pickImage} disabled={busy}>
            <Icon name="camera" size={14} /> {busy ? '识别中（首次需编译约 15 秒）…' : '选择照片'}
          </button>
          {imageInfo && (
            <div className="ocr-result">
              <div className="ocr-head">
                <b>识别到 {imageInfo.lines.length} 行文本</b>
                <span className="muted small">{imageInfo.elapsed}ms · 低置信字段请在下一步核对</span>
              </div>
              <div className="ocr-lines">
                {imageInfo.lines.slice(0, 24).map((l, i) => <span key={i}>{l.text}</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {fields && (
        <div className="parse-result">
          <div className="parse-head">
            <b>{source}</b>
            <span className="muted small">有把握的字段已填好，其余留给你补</span>
          </div>
          <div className="form-grid">
            <Field label={<>品牌 {confidenceHint('brand')}</>}>
              <input className="input" value={fields.brand || ''} onChange={(e) => setFields({ ...fields, brand: e.target.value })} />
            </Field>
            <Field label={<>豆子名字 {confidenceHint('name')}</>}>
              <input className="input" value={fields.name || ''} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
            </Field>
            <Field label={<>烘焙日期 {confidenceHint('roastDate')}</>}>
              <input className="input" type="date" value={fields.roastDate || ''} onChange={(e) => setFields({ ...fields, roastDate: e.target.value })} />
            </Field>
            <Field label={<>净含量(g) {confidenceHint('totalWeight')}</>}>
              <input className="input" type="number" value={fields.totalWeight || ''} onChange={(e) => setFields({ ...fields, totalWeight: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={<>价格(元) {confidenceHint('price')}</>}>
              <input className="input" type="number" value={fields.price || ''} onChange={(e) => setFields({ ...fields, price: Number(e.target.value) || 0 })} />
            </Field>
            <Field label={<>产地 {confidenceHint('origin')}</>}>
              <input className="input" value={fields.origin || ''} onChange={(e) => setFields({ ...fields, origin: e.target.value })} />
            </Field>
            <Field label={<>处理法 {confidenceHint('processor')}</>}>
              <input className="input" value={fields.processor || ''} onChange={(e) => setFields({ ...fields, processor: e.target.value })} />
            </Field>
            <Field label={<>风味标签 {confidenceHint('flavors')}</>}>
              <input className="input" value={(fields.flavors || []).join(' / ')} onChange={(e) => setFields({ ...fields, flavors: e.target.value.split(/[\/,，、\s]+/).filter(Boolean) })} />
            </Field>
          </div>
          {rawText && (
            <details className="raw-text">
              <summary>查看解析原文</summary>
              <pre>{rawText}</pre>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}
