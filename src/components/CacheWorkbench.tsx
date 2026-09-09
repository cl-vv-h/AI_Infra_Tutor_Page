import { Database, SlidersHorizontal } from 'lucide-react'
import type { ModelArchitecture } from '@/types/model'
import { cacheEstimate, formatBytes, localKvHeads, tokenCount } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'

export function CacheWorkbench({ model, scenario, onBatch, onSequence, onBytes }: {
  model: ModelArchitecture
  scenario: InferenceScenario
  onBatch: (value: number) => void
  onSequence: (value: number) => void
  onBytes: (value: 1 | 2) => void
}) {
  const estimate = cacheEstimate(model, scenario)
  const cache = model.execution.cache
  const hybrid = cache.kind === 'hybrid'
  const width = cache.kind === 'mla' ? `${cache.latentWidth} + ${cache.ropeWidth}` : `2 × ${localKvHeads(model, scenario.tp)} × ${model.dimensions.headDim}`
  const replication = cache.kind !== 'mla' && scenario.tp > model.dimensions.kvHeads
  const breakdown = [
    { label: `${estimate.kvLayers} 层完整 KV`, bytes: estimate.kvBytes, color: '#70e1f5' },
    ...(hybrid ? [
      { label: `${estimate.recurrentLayers} 层循环矩阵 · FP32`, bytes: estimate.recurrentBytes, color: '#d8ff78' },
      { label: `${estimate.recurrentLayers} 层卷积窗口 · BF16`, bytes: estimate.convBytes, color: '#c7a8ff' },
    ] : []),
  ]
  const controlClass = 'rounded-lg border border-white/15 bg-[#0c131c] px-3 py-2 text-sm text-white focus:outline-cyan-200'
  return <section className="mt-4 overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0b131b]" aria-label={hybrid ? 'KV 与循环状态容量实验' : 'KV Cache 容量实验'}>
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-200" />{hybrid ? 'KV + 循环状态容量实验' : 'KV Cache 容量实验'}</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col gap-2 text-sm text-white/65">并发请求 B<select aria-label="并发请求数" value={scenario.batch} onChange={(e) => onBatch(Number(e.target.value))} className={controlClass}>{[1, 2, 4, 8, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">每请求缓存 S<select aria-label="每请求缓存 token 数" value={scenario.sequence} onChange={(e) => onSequence(Number(e.target.value))} className={controlClass}>{[...new Set([1024, 4096, 16384, 32768, 65536, 131072, scenario.sequence, model.execution.maxContext].filter((n) => n <= model.execution.maxContext))].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString('en-US')} tokens</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">{hybrid ? '完整 KV 精度' : '缓存精度'}<select aria-label="KV 缓存精度" value={scenario.cacheBytes} onChange={(e) => onBytes(Number(e.target.value) as 1 | 2)} className={controlClass}><option value={2}>BF16 / FP16 · 2 B</option><option value={1}>FP8 · 1 B</option></select></label>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/65">{scenario.phase === 'prefill' ? `N = B × S = ${tokenCount(scenario).toLocaleString('en-US')}；本次处理完整输入。` : `N = B = ${scenario.batch}；S 包含刚写入的新 token，其余为历史。`}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center gap-2 text-sm text-lime-100"><Database className="h-4 w-4" />每卡{hybrid ? '持久状态合计' : '逻辑 KV Cache'} · 全部 {model.dimensions.layers} 层</div>
        <output aria-live="polite" className="mt-3 block font-mono text-3xl tracking-tight text-white">{formatBytes(estimate.perRankBytes)}</output>
        {hybrid && <><div className="mt-4 flex h-2 overflow-hidden rounded-full" aria-hidden="true">{breakdown.map((part) => <span key={part.label} style={{ width: `${100 * part.bytes / estimate.perRankBytes}%`, backgroundColor: part.color }} />)}</div><div className="mt-3 space-y-2">{breakdown.map((part) => <div key={part.label} className="flex flex-wrap justify-between gap-2 text-sm"><span style={{ color: part.color }}>{part.label}</span><span className="font-mono text-white/90">{formatBytes(part.bytes)}</span></div>)}</div></>}
        <p className="mt-3 break-words font-mono text-xs leading-6 text-cyan-100/80">KV = B × S × Lkv × ({width}) × bytes<br />{scenario.batch} × {scenario.sequence.toLocaleString('en-US')} × {estimate.kvLayers} × {estimate.valuesPerTokenPerLayer} × {scenario.cacheBytes}</p>
        <p className="mt-2 text-sm text-white/65">单请求新增 1 token：+{formatBytes(estimate.bytesPerToken)} / 卡<br />所有 TP 卡合计：{formatBytes(estimate.allRankBytes)}</p>
      </div>
    </div>
    <details className="border-t border-white/10 px-5 py-3">
      <summary className="cursor-pointer text-sm text-cyan-100/85">{hybrid ? '哪些状态随上下文增长？查看公式与长度对照' : '为什么 TP 不一定等比例减少缓存？查看计算口径'}</summary>
      <div className="mt-3 grid gap-3 pb-2 text-sm leading-6 text-white/65 md:grid-cols-2">
        <p>{cache.kind === 'mla' ? '当前采用常见的 latent-cache MLA 路径：每个 TP rank 持有完整的压缩 KV 与 RoPE 分量，TP 改变 attention head 投影分片，但不缩小这份 latent cache。' : replication ? `这个模型只有 ${model.dimensions.kvHeads} 个 KV heads。TP = ${scenario.tp} 时每卡仍需 1 个完整 KV head，head 在多卡间复制，所以集群总缓存会上升。` : `每卡缓存 ${localKvHeads(model, scenario.tp)} 个 KV heads。仅在 KV heads 能被 TP 整除时，缓存才随 TP 等比例下降；TP 大于 KV heads 时开始复制。`}</p>
        <p>这是有效 token 的理论缓存容量，未计入模型权重、激活、页尾填充、量化 scale、图捕获与通信缓冲，不是部署所需总显存。FP8 为容量假设，实际可用性和精度取决于引擎与硬件。S 上限取当前官方配置，未应用额外的上下文扩展。{model.execution.contextNote}</p>
        {hybrid && <><p>循环矩阵 = B × {estimate.recurrentLayers} 层 × ({cache.valueHeads} / TP) heads × {cache.keyDim} × {cache.valueDim} × {cache.recurrentBytes} 字节。矩阵固定为 FP32；仅调整 KV 精度不会将它减半。</p><p>卷积窗口 = B × {estimate.recurrentLayers} 层 × ((2 × {cache.keyHeads} × {cache.keyDim} + {cache.valueHeads} × {cache.valueDim}) / TP) 通道 × {cache.convStateSlots} 槽 × {cache.convBytes} 字节。本图按 Transformers 的完整窗口分配估算，部分引擎采用 K−1 个槽。</p></>}
      </div>
      {hybrid && <div className="mt-4 grid gap-2 pb-3 sm:grid-cols-4">{[1024, 4096, 32768, 131072].filter((size) => size <= model.execution.maxContext).map((size) => <button key={size} type="button" aria-label={`对照 ${size} tokens 的缓存容量`} onClick={() => onSequence(size)} className={`rounded-xl border p-3 text-left text-sm ${scenario.sequence === size ? 'border-cyan-200/50 bg-cyan-200/10' : 'border-white/15 hover:border-white/40'}`}><span className="block text-white/70">S = {size.toLocaleString('en-US')}</span><span className="mt-2 block font-mono text-cyan-100">{formatBytes(cacheEstimate(model, { ...scenario, sequence: size }).perRankBytes)}</span></button>)}</div>}
    </details>
  </section>
}
