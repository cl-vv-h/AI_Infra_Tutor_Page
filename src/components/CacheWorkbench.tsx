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
  const width = cache.kind === 'mla' ? `${cache.latentWidth} + ${cache.ropeWidth}` : `2 × ${localKvHeads(model, scenario.tp)} × ${model.dimensions.headDim}`
  const replication = cache.kind === 'gqa' && scenario.tp > model.dimensions.kvHeads
  const controlClass = 'rounded-lg border border-white/15 bg-[#0c131c] px-3 py-2 text-sm text-white focus:outline-cyan-200'
  return <section className="mt-4 overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0b131b]" aria-label="KV Cache 容量实验">
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><SlidersHorizontal className="h-4 w-4 text-cyan-200" /> KV Cache 容量实验</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col gap-2 text-sm text-white/65">并发请求 B<select aria-label="并发请求数" value={scenario.batch} onChange={(e) => onBatch(Number(e.target.value))} className={controlClass}>{[1, 2, 4, 8, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">每请求缓存 S<select aria-label="每请求缓存 token 数" value={scenario.sequence} onChange={(e) => onSequence(Number(e.target.value))} className={controlClass}>{[...new Set([1024, 4096, 16384, 32768, 65536, 131072, scenario.sequence, model.execution.maxContext].filter((n) => n <= model.execution.maxContext))].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString('en-US')} tokens</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">缓存精度<select aria-label="缓存精度" value={scenario.cacheBytes} onChange={(e) => onBytes(Number(e.target.value) as 1 | 2)} className={controlClass}><option value={2}>BF16 / FP16 · 2 B</option><option value={1}>FP8 · 1 B</option></select></label>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/65">{scenario.phase === 'prefill' ? `N = B × S = ${tokenCount(scenario).toLocaleString('en-US')}；本次处理完整输入。` : `N = B = ${scenario.batch}；S 包含刚写入的新 token，其余为历史。`}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center gap-2 text-sm text-lime-100"><Database className="h-4 w-4" />每卡逻辑 KV Cache · 全部 {model.dimensions.layers} 层</div>
        <output aria-live="polite" className="mt-3 block font-mono text-3xl tracking-tight text-white">{formatBytes(estimate.perRankBytes)}</output>
        <p className="mt-3 break-words font-mono text-xs leading-6 text-cyan-100/80">B × S × L × ({width}) × bytes<br />{scenario.batch} × {scenario.sequence.toLocaleString('en-US')} × {model.dimensions.layers} × {estimate.valuesPerTokenPerLayer} × {scenario.cacheBytes}</p>
        <p className="mt-2 text-sm text-white/65">每新增 token：{formatBytes(estimate.bytesPerToken)} / 卡 · 所有 TP 卡：{formatBytes(estimate.allRankBytes)}</p>
      </div>
    </div>
    <details className="border-t border-white/10 px-5 py-3">
      <summary className="cursor-pointer text-sm text-cyan-100/85">为什么 TP 不一定等比例减少缓存？查看计算口径</summary>
      <div className="mt-3 grid gap-3 pb-2 text-sm leading-6 text-white/65 md:grid-cols-2">
        <p>{cache.kind === 'mla' ? '当前采用常见的 latent-cache MLA 路径：每个 TP rank 持有完整的压缩 KV 与 RoPE 分量，TP 改变 attention head 投影分片，但不缩小这份 latent cache。' : replication ? `这个模型只有 ${model.dimensions.kvHeads} 个 KV heads。TP = ${scenario.tp} 时每卡仍需 1 个完整 KV head，head 在多卡间复制，所以集群总缓存会上升。` : `每卡缓存 ${localKvHeads(model, scenario.tp)} 个 KV heads。仅在 KV heads 能被 TP 整除时，缓存才随 TP 等比例下降；TP 大于 KV heads 时开始复制。`}</p>
        <p>这是有效 token 的理论缓存容量，未计入模型权重、激活、页尾填充、量化 scale、图捕获与通信缓冲，不是部署所需总显存。FP8 为容量假设，实际可用性和精度取决于引擎与硬件。S 上限取当前官方配置，未应用额外的上下文扩展。{model.execution.contextNote}</p>
      </div>
    </details>
  </section>
}
