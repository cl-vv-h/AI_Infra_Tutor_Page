import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatBytes } from '@/lib/model-lab'
import { kdaMlaCacheParts } from '@/lib/kda-mla-cache'

export default function KimiCacheWorkbench({ model, layer, scenario, onBatch, onSequence, onBytes }: {
  model: ModelArchitecture; layer: number; scenario: InferenceScenario; onBatch: (n: number) => void; onSequence: (n: number) => void; onBytes: (n: 1 | 2) => void
}) {
  const c = model.execution.cache
  if (c.kind !== 'kda-mla') return null
  const p = kdaMlaCacheParts(c, scenario.sequence, scenario.batch, scenario.tp, scenario.cacheBytes)
  const parts = [
    { label: `${p.kvLayers} 层 MLA · latent + 未旋转共享 K`, formula: `B × ${p.kvLayers} × S × (${c.latentWidth}+${c.sharedKeyWidth}) × bytes`, bytes: p.kvBytes, color: '#70e1f5' },
    { label: `${p.recurrentLayers} 层 KDA 矩阵 · FP32`, formula: `B × ${p.recurrentLayers} × (${c.heads}/TP) × ${c.headDim}² × ${c.stateBytes}`, bytes: p.recurrentBytes, color: '#a8e8c5' },
    { label: `${p.recurrentLayers} 层 KDA 卷积 · BF16`, formula: `B × ${p.recurrentLayers} × (3×${c.heads}×${c.headDim}/TP) × ${c.convSlots} × ${c.convBytes}`, bytes: p.convBytes, color: '#ffcd94' },
  ]
  const control = 'rounded-xl border border-white/20 bg-[#0c131c] px-3 py-2 text-base text-white'
  return <section aria-label="KDA 与 Gated MLA 缓存实验" className="mt-4 rounded-3xl border border-amber-200/25 bg-[#0b131b] p-5">
    <h2 className="text-lg font-semibold text-white">固定 KDA 状态 + 完整 MLA 历史</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">Layer {layer} 是 {c.layerTypes[layer] === 'kda' ? 'KDA，只更新矩阵和卷积窗口。' : 'Gated MLA，读取完整因果历史。'} 下方始终统计全部 {model.dimensions.layers} 层。没有 DSA 索引池，也没有 Top-k 历史截断。</p>
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="flex flex-col gap-2 text-sm text-white/70">请求 B<select aria-label="并发请求数" className={control} value={scenario.batch} onChange={e => onBatch(Number(e.target.value))}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">历史 S<select aria-label="每请求序列 token 数" className={control} value={scenario.sequence} onChange={e => onSequence(Number(e.target.value))}>{[...new Set([1024, 4096, 8192, 32768, 131072, model.execution.maxContext, scenario.sequence])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">MLA 精度假设<select aria-label="KV 缓存精度" className={control} value={scenario.cacheBytes} onChange={e => onBytes(Number(e.target.value) as 1 | 2)}><option value={2}>2 字节 / 元素</option><option value={1}>1 字节 / 元素（逻辑假设）</option></select></label>
    </div>
    <div className="mt-5 rounded-2xl border border-cyan-100/20 p-4 text-sm leading-6 text-white/70"><h3 className="font-medium text-cyan-100">NoPE ≠ 删除共享 K 通道</h3><p className="mt-2">每条 MLA 记录仍有 {c.latentWidth}+{c.sharedKeyWidth}=576 个元素。省略 RoPE 旋转，不省略内容向量。完整主历史为 {scenario.sequence.toLocaleString('en-US')} 条，各 TP rank 复制；将 TP 翻倍只缩小 KDA 部分。</p></div>
    <p className="mt-5 text-sm text-white/65">全部层 · 每 rank 逻辑持久缓存与状态</p><output aria-live="polite" className="mt-2 block font-mono text-3xl text-white">{formatBytes(p.total)}</output>
    <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">{parts.map(row => <span key={row.label} style={{ width: `${row.bytes / p.total * 100}%`, backgroundColor: row.color }} />)}</div>
    <dl className="mt-4 grid gap-3 sm:grid-cols-3">{parts.map(row => <div key={row.label} className="rounded-xl border border-white/10 p-3"><dt className="text-sm" style={{ color: row.color }}>{row.label}</dt><dd className="mt-2 font-mono text-xl text-white">{formatBytes(row.bytes)}</dd><dd className="mt-2 break-words text-xs leading-6 text-white/55">{row.formula}</dd></div>)}</dl>
    <p className="mt-4 text-sm leading-6 text-white/65">{scenario.sequence < model.execution.maxContext ? `单请求每追加 token 增长 ${formatBytes(p.growthBytesPerToken)} / rank；` : '已到上下文上限，不外推下一 token；'}TP={scenario.tp} 合计 {formatBytes(p.total * scenario.tp)}。改变 MLA 精度不会改变 FP32 矩阵与 BF16 卷积状态。</p>
    <details className="mt-4 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-amber-100">与临时 AttnRes bank、真实显存的区别</summary><p className="mt-3 text-sm leading-6 text-white/65">{model.execution.contextNote}</p></details>
  </section>
}
