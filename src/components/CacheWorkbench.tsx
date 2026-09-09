import { Database, SlidersHorizontal } from 'lucide-react'
import type { ModelArchitecture } from '@/types/model'
import { attentionKind, cacheEstimate, cacheKvHeads, formatBytes, tokenCount } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'

export function CacheWorkbench({ model, layer = 0, scenario, onBatch, onSequence, onBytes }: {
  model: ModelArchitecture
  layer?: number
  scenario: InferenceScenario
  onBatch: (value: number) => void
  onSequence: (value: number) => void
  onBytes: (value: 1 | 2) => void
}) {
  const estimate = cacheEstimate(model, scenario)
  const cache = model.execution.cache
  const hybrid = cache.kind === 'hybrid'
  const sliding = cache.kind === 'swa'
  const mixed = cache.kind === 'mixed'
  const hasWindow = sliding || mixed
  const currentSliding = hasWindow && attentionKind(model, layer) === 'swa'
  const width = cache.kind === 'mla' ? `${cache.latentWidth} + ${cache.ropeWidth}` : `2 × ${cacheKvHeads(model, scenario.tp)} × ${model.dimensions.headDim}`
  const gathered = cache.kind === 'gqa' && cache.layout === 'replicated'
  const replication = cache.kind !== 'mla' && scenario.tp > model.dimensions.kvHeads
  const breakdown = [
    { label: `${estimate.fullKvLayers} 层完整 KV`, bytes: estimate.fullKvBytes, color: '#70e1f5' },
    ...(mixed ? [{ label: `${estimate.slidingLayers} 层滑窗 KV`, bytes: estimate.slidingKvBytes, color: '#ffc98b' }] : []),
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
          <label className="flex flex-col gap-2 text-sm text-white/65">并发请求 B<select aria-label="并发请求数" value={scenario.batch} onChange={(e) => onBatch(Number(e.target.value))} className={controlClass}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">每请求序列 S<select aria-label="每请求序列 token 数" value={scenario.sequence} onChange={(e) => onSequence(Number(e.target.value))} className={controlClass}>{[...new Set([1024, 4096, 16384, 32768, 65536, 131072, scenario.sequence, model.execution.maxContext, ...(hasWindow ? [cache.window - 1, cache.window, cache.window + 1] : [])].filter((n) => n >= 1 && n <= model.execution.maxContext))].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString('en-US')} tokens</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-white/65">{hybrid ? '完整 KV 精度' : '缓存精度'}<select aria-label="KV 缓存精度" value={scenario.cacheBytes} onChange={(e) => onBytes(Number(e.target.value) as 1 | 2)} className={controlClass}><option value={2}>BF16 / FP16 · 2 B</option><option value={1}>FP8 · 1 B</option></select></label>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/65">{scenario.phase === 'prefill' ? `N = B × S = ${tokenCount(scenario).toLocaleString('en-US')}；本次处理完整输入。` : `N = B = ${scenario.batch}；S 包含刚写入的新 token，其余为历史。`}</p>
        {gathered && <p className="mt-3 rounded-xl border border-amber-200/25 bg-amber-200/5 p-3 text-sm leading-6 text-amber-100">汇集式 Attention TP：投影权重分片，Q/K/V 输出汇集。每卡缓存完整 {model.dimensions.kvHeads} 个 KV heads，不再除以 TP；这是当前参考实现的路径，不代表所有引擎。</p>}
        {mixed && <p className="mt-3 text-sm leading-6 text-cyan-100">当前 Layer {layer}：{currentSliding ? `滑窗注意力 · 保留最近 ${estimate.slidingRetainedTokens.toLocaleString('en-US')} 个位置` : `完整注意力 · 保留全部 ${scenario.sequence.toLocaleString('en-US')} 个位置`}。窗口饱和后，整模型仍有 {estimate.fullKvLayers} 层 KV 随 S 增长。</p>}
        {currentSliding && <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4">
          <h3 className="text-sm font-semibold text-amber-100">滚动窗口 · W = {cache.window.toLocaleString('en-US')}</h3>
          <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><span style={{ width: `${100 * (scenario.sequence - estimate.slidingRetainedTokens) / scenario.sequence}%` }} /><span className="bg-amber-200/80" style={{ width: `${100 * estimate.slidingRetainedTokens / scenario.sequence}%` }} /></div>
          <div className="mt-2 flex justify-between font-mono text-xs text-white/55"><span>0</span><span>位置 {(scenario.sequence - 1).toLocaleString('en-US')}</span></div>
          <p className="mt-3 text-sm leading-6 text-amber-100">本层当前直接可见：[{(scenario.sequence - estimate.slidingRetainedTokens).toLocaleString('en-US')}, {(scenario.sequence - 1).toLocaleString('en-US')}]，共 {estimate.slidingRetainedTokens.toLocaleString('en-US')} 个位置。</p>
          <p className="mt-2 text-sm leading-6 text-white/65">灰色部分已移出本层 KV 窗口；更深层仍可能间接接收较早信息。饱和后会替换旧 KV，容量不再增长，但仍有新 token 的计算与写入。</p>
        </div>}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center gap-2 text-sm text-lime-100"><Database className="h-4 w-4" />每卡{hybrid ? '持久状态合计' : '逻辑 KV Cache'} · 全部 {model.dimensions.layers} 层</div>
        <output aria-live="polite" className="mt-3 block font-mono text-3xl tracking-tight text-white">{formatBytes(estimate.perRankBytes)}</output>
        {(hybrid || mixed) && <><div className="mt-4 flex h-2 overflow-hidden rounded-full" aria-hidden="true">{breakdown.map((part) => <span key={part.label} style={{ width: `${100 * part.bytes / estimate.perRankBytes}%`, backgroundColor: part.color }} />)}</div><div className="mt-3 space-y-2">{breakdown.map((part) => <div key={part.label} className="flex flex-wrap justify-between gap-2 text-sm"><span style={{ color: part.color }}>{part.label}</span><span className="font-mono text-white/90">{formatBytes(part.bytes)}</span></div>)}</div></>}
        <p className="mt-3 break-words font-mono text-xs leading-6 text-cyan-100/80">KV = B × {mixed ? `(S × Lfull + min(S, ${cache.window}) × Lwindow)` : `${sliding ? `min(S, ${cache.window})` : 'S'} × Lkv`} × ({width}) × bytes<br />{scenario.batch} × {mixed ? `(${scenario.sequence} × ${estimate.fullKvLayers} + ${estimate.slidingRetainedTokens} × ${estimate.slidingLayers})` : `${estimate.retainedTokens.toLocaleString('en-US')} × ${estimate.kvLayers}`} × {estimate.valuesPerTokenPerLayer} × {scenario.cacheBytes}</p>
        <p className="mt-2 text-sm text-white/65">{scenario.sequence >= model.execution.maxContext ? '已达配置上下文上限，未估算下一 token。' : `单请求再增 1 token 的容量增长：+${formatBytes(estimate.growthBytesPerToken)} / 卡`}<br />所有 TP 卡合计：{formatBytes(estimate.allRankBytes)}</p>
      </div>
    </div>
    <details className="border-t border-white/10 px-5 py-3">
      <summary className="cursor-pointer text-sm text-cyan-100/85">{hasWindow ? '滑动窗口不等于上下文上限：查看计算口径' : hybrid ? '哪些状态随上下文增长？查看公式与长度对照' : '为什么 TP 不一定等比例减少缓存？查看计算口径'}</summary>
      <div className="mt-3 grid gap-3 pb-2 text-sm leading-6 text-white/65 md:grid-cols-2">
        <p>{cache.kind === 'mla' ? '当前采用常见的 latent-cache MLA 路径：每个 TP rank 持有完整的压缩 KV 与RoPE 分量，TP 改变 attention head 投影分片，但不缩小这份 latent cache。' : gathered ? `Q/K Norm 在汇集后的完整投影上计算。缓存按每卡 ${cacheKvHeads(model, scenario.tp)} 个 KV heads 的副本估算，TP 卡数增加会增加组内重复存储；不能套用 KV heads / TP。` : replication ? `这个模型只有 ${model.dimensions.kvHeads} 个 KV heads。TP = ${scenario.tp} 时每卡仍需 1 个完整 KV head，head 在多卡间复制，所以集群总缓存会上升。` : `在 head 分片路径下，每卡缓存 ${cacheKvHeads(model, scenario.tp)} 个 KV heads。KV heads 能被 TP 整除时缓存随 TP 等比例下降；TP 大于 KV heads 时开始复制。`}</p>
        <p>这是有效 token 的理论缓存容量，未计入模型权重、激活、页尾填充、量化 scale、图捕获与通信缓冲，不是部署所需总显存。FP8 为容量假设，实际可用性和精度取决于引擎与硬件。S 上限取当前官方配置，未应用额外的上下文扩展。{model.execution.contextNote}</p>
        {hybrid && <><p>循环矩阵 = B × {estimate.recurrentLayers} 层 × ({cache.valueHeads} / TP) heads × {cache.keyDim} × {cache.valueDim} × {cache.recurrentBytes} 字节。矩阵固定为 FP32；仅调整 KV 精度不会将它减半。</p><p>卷积窗口 = B × {estimate.recurrentLayers} 层 × ((2 × {cache.keyHeads} × {cache.keyDim} + {cache.valueHeads} × {cache.valueDim}) / TP) 通道 × {cache.convStateSlots} 槽 × {cache.convBytes} 字节。本图按 Transformers 的完整窗口分配估算，部分引擎采用 K−1 个槽。</p></>}
      </div>
      {hybrid && <div className="mt-4 grid gap-2 pb-3 sm:grid-cols-4">{[1024, 4096, 32768, 131072].filter((size) => size <= model.execution.maxContext).map((size) => <button key={size} type="button" aria-label={`对照 ${size} tokens 的缓存容量`} onClick={() => onSequence(size)} className={`rounded-xl border p-3 text-left text-sm ${scenario.sequence === size ? 'border-cyan-200/50 bg-cyan-200/10' : 'border-white/15 hover:border-white/40'}`}><span className="block text-white/70">S = {size.toLocaleString('en-US')}</span><span className="mt-2 block font-mono text-cyan-100">{formatBytes(cacheEstimate(model, { ...scenario, sequence: size }).perRankBytes)}</span></button>)}</div>}
    </details>
  </section>
}
