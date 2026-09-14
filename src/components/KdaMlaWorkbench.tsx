import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatBytes } from '@/lib/model-lab'
import { kdaMlaCacheParts, pooledIndexReads } from '@/lib/kda-mla-cache'

export default function KdaMlaWorkbench({ model, layer, scenario, onBatch, onSequence, onBytes }: {
  model: ModelArchitecture; layer: number; scenario: InferenceScenario; onBatch: (n: number) => void; onSequence: (n: number) => void; onBytes: (n: 1 | 2) => void
}) {
  const c = model.execution.cache
  if (c.kind !== 'kda-mla') return null
  const p = kdaMlaCacheParts(c, scenario.sequence, scenario.batch, scenario.tp, scenario.cacheBytes)
  const current = pooledIndexReads(scenario.sequence, c.indexPool, c.indexTopk)
  const rows = [
    [`${p.kvLayers} 层 MLA 主历史`, `B × ${p.kvLayers} × S × ${c.latentWidth} × bytes`, p.kvBytes, '#70e1f5'],
    [`${p.kvLayers} 层池化 Index K`, `B × ${p.kvLayers} × ⌊S/${c.indexPool}⌋ × ${c.indexWidth} × bytes`, p.indexBytes, '#c7a8ff'],
    ['Index key / score 尾部 · BF16', `B × ${p.kvLayers} × 2 × ${c.tailSlots} × ${c.indexWidth} × ${c.tailBytes}`, p.tailBytes, '#ffc98b'],
    [`${p.recurrentLayers} 层 KDA 矩阵 · FP32`, `B × ${p.recurrentLayers} × (${c.heads}/TP) × ${c.headDim}² × ${c.stateBytes}`, p.recurrentBytes, '#a8e8c5'],
    [`${p.recurrentLayers} 层 KDA 卷积 · BF16`, `B × ${p.recurrentLayers} × (3×${c.heads}×${c.headDim}/TP) × ${c.convSlots} × ${c.convBytes}`, p.convBytes, '#d8ff78'],
  ] as const
  const probes = [...new Set([1, Math.min(2047, scenario.sequence), Math.min(2048, scenario.sequence), scenario.sequence])]
  const control = 'rounded-xl border border-white/20 bg-[#0c131c] px-3 py-2 text-base text-white'
  return <section aria-label="KDA 与池化 DSA 缓存实验" className="mt-4 rounded-3xl border border-emerald-200/20 bg-[#0b131b] p-5">
    <h2 className="text-lg font-semibold text-white">定长记忆 + 可检索历史</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">当前 Layer {layer} 是 {c.layerTypes[layer] === 'kda' ? 'KDA：只更新矩阵与短卷积窗口，不创建该层的历史 KV。' : 'DSA：保存完整 MLA latent，靠池化索引选择原始 token。'} 下方容量始终计算整模型，不把 KDA 层当成 DSA 层。</p>
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="flex flex-col gap-2 text-sm text-white/70">请求 B<select aria-label="并发请求数" className={control} value={scenario.batch} onChange={e => onBatch(Number(e.target.value))}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">历史 S<select aria-label="每请求序列 token 数" className={control} value={scenario.sequence} onChange={e => onSequence(Number(e.target.value))}>{[...new Set([1024, 2047, 2048, 2049, 4095, 4096, 4097, 32768, 131072, model.execution.maxContext, scenario.sequence])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">主 latent / Index K 精度假设<select aria-label="KV 缓存精度" className={control} value={scenario.cacheBytes} onChange={e => onBytes(Number(e.target.value) as 1 | 2)}><option value={2}>2 字节 / 元素</option><option value={1}>1 字节 / 元素（逻辑假设）</option></select></label>
    </div>
    <section aria-label="索引池展开实验" className="mt-5 rounded-2xl border border-violet-200/25 bg-violet-200/5 p-4">
      <h3 className="text-base font-medium text-violet-100">DSA 层：压缩索引，不压缩主历史</h3>
      <p className="mt-3 text-sm leading-6 text-white/70">{scenario.phase === 'decode' ? 'Decode 当前 query' : 'Prefill 最后 query'}：{current.completePools.toLocaleString('en-US')} 个完整索引池 → 最多选 {current.selectedPools} 池 → 展开 {current.selectedPools * c.indexPool} 个原始 token，再加 {current.tail} 个尾部 token。不是直接对池均值做主 Attention。</p>
      <output aria-live="polite" className="mt-3 block font-mono text-2xl text-violet-100">{current.rawTokens.toLocaleString('en-US')} 个有效读取位置</output>
      <p className="mt-3 text-sm leading-6 text-white/65">完整主历史仍是 {scenario.sequence.toLocaleString('en-US')} 条；最多 {c.indexTopk + c.indexPool - 1} 个有效读取位置不意味着历史被裁掉。具体哪些池获选取决于模型权重，这里只演示数量与因果边界。</p>
      <div className="mt-4"><table className="w-full table-fixed text-left text-xs sm:text-sm"><caption className="mb-3 text-left text-white/60">同一段输入中，不同 query 的可见位置（编号从 0 开始）</caption><thead className="text-violet-100"><tr>{['Query', '完整池', '选中池', '原始+尾部'].map(text => <th className="px-1 py-2 font-medium" key={text}>{text}</th>)}</tr></thead><tbody className="font-mono text-white/75">{probes.map(t => { const r = pooledIndexReads(t, c.indexPool, c.indexTopk); return <tr key={t} className="border-t border-white/10"><td className="px-1 py-3">{t - 1}</td><td className="px-1 py-3">{r.completePools}</td><td className="px-1 py-3">{r.selectedPools}</td><td className="px-1 py-3">{r.selectedPools * c.indexPool}+{r.tail}</td></tr> })}</tbody></table></div>
    </section>
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-sm text-white/65">全部 {model.dimensions.layers} 层 · 每 rank 逻辑缓存与状态</p><output aria-live="polite" className="mt-2 block font-mono text-3xl text-white">{formatBytes(p.total)}</output>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">{rows.map(([label, , bytes, color]) => <span key={label} style={{ width: `${bytes / p.total * 100}%`, backgroundColor: color }} />)}</div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, formula, bytes, color]) => <div key={label} className="rounded-xl border border-white/10 p-3"><dt className="text-sm" style={{ color }}>{label}</dt><dd className="mt-2 font-mono text-lg text-white">{formatBytes(bytes)}</dd><dd className="mt-2 break-words text-xs leading-6 text-white/55">{formula}</dd></div>)}</dl>
      <p className="mt-4 text-sm leading-6 text-white/65">{scenario.sequence < model.execution.maxContext ? `单请求下一个 token 增长 ${formatBytes(p.growthBytesPerToken)} / rank。` : '已达配置上下文上限，不外推下一 token。'} TP={scenario.tp} 合计 {formatBytes(p.total * scenario.tp)}。KDA 状态按 head 切分；主 latent、Index K 与尾部状态按 rank 复制，因此 TP 翻倍不会把总容量简单减半。</p>
    </div>
    <details className="mt-4 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-emerald-100">缓存口径与精度边界</summary><div className="mt-3 space-y-3 text-sm leading-6 text-white/65"><p>{model.execution.contextNote}</p><p>一/两字节选项仅改变主 latent 与 Index K，不改变 KDA FP32 矩阵、BF16 卷积历史或 BF16 Index key/score 尾部。索引池每四 token 追加，主 latent 每个 token 都增长；四路 mHC 不把这些缓存乘四。</p><p>不计 FP8 scale、分页空位、最大请求数预分配、哨兵槽、视觉塔临时激活、MTP、前缀快照、ReplaySSM、图捕获与通信。只有选定实现口径下的逻辑上界，不是整卡部署或吞吐承诺。</p></div></details>
  </section>
}
