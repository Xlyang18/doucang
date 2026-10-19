import React from 'react';
import { useApp } from '../store/AppContext.jsx';
import { formatMoney } from '../lib/format.js';
import { Modal, EmptyState } from './ui.jsx';
import { takePendingPrefill } from '../lib/prefill.js';
import Icon from '../components/Icon.jsx';

/**
 * 导入 / OCR 结果「确认卡」：从任何入口解析出字段后，统一在这里确认入仓。
 * prefill 变化即弹出。
 */
export default function PrefillConfirm() {
  const { data, addBean, toast, go } = useApp();
  const [pending, setPending] = React.useState(null);

  React.useEffect(() => {
    const handler = () => {
      const p = takePendingPrefill();
      if (p) setPending(p);
    };
    window.addEventListener('doucang:prefill', handler);
    handler();
    return () => window.removeEventListener('doucang:prefill', handler);
  }, []);

  const brands = React.useMemo(() => {
    const s = new Set();
    (data.beans || []).forEach((b) => b.brand && s.add(b.brand));
    return [...s].sort();
  }, [data.beans]);

  return (
    <Modal
      open={!!pending}
      onClose={() => setPending(null)}
      title="确认导入"
      width={680}
      footer={
        <>
          <button className="btn" onClick={() => setPending(null)}>取消</button>
          <button className="btn" onClick={() => { setPending(null); go('beans', 'add'); }}>手动填写</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              addBean(pending);
              toast(`已导入「${pending.name}」`);
              setPending(null);
            }}
            disabled={!String(pending?.name || '').trim()}
          >
            <Icon name="check" size={14} /> 直接入仓
          </button>
        </>
      }
    >
      {pending && (
        <>
          <div className="prefill-grid">
            <div><i>品牌</i><b>{pending.brand || '—'}</b></div>
            <div><i>名字</i><b>{pending.name || '—'}</b></div>
            <div><i>烘焙时间</i><b>{pending.roastDate || '未识别'}</b></div>
            <div><i>净含量</i><b>{pending.totalWeight ? `${pending.totalWeight}g` : '未识别'}</b></div>
            <div><i>价格</i><b>{pending.price ? formatMoney(pending.price) : '未识别'}</b></div>
            <div><i>产地</i><b>{pending.origin || '—'}</b></div>
            <div><i>处理法</i><b>{pending.processor || '—'}</b></div>
            <div><i>风味</i><b>{(pending.flavors || []).join(' / ') || '—'}</b></div>
          </div>
          <p className="muted small">{pending.imported || '信息来自本地解析，确认前可先手动填写修正。'}</p>
        </>
      )}
      {!pending && <EmptyState icon="search" title="暂无待确认导入" />}
    </Modal>
  );
}
