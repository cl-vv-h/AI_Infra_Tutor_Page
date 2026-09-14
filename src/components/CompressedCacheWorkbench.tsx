import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { cacheEstimate, formatBytes } from '@/lib/model-lab'
import { compressedCacheParts } from '@/lib/compressed-cache'

export default function CompressedCacheWorkbench({ model, layer, scenario, onBatch, onSequence, onBytes }: {
  model: ModelArchitecture; layer: number; scenario: InferenceScenario; onBatch: (n: number) => void; onSequence: (n: number) => void; onBytes: (n: 1 | 2) => void
}) {
  const cache = model.execution.cache
  if (cache.kind !== 'compressed') return null
  const part = compressedCacheParts(model, scenario.sequence, scenario.batch, scenario.cacheBytes)
  const estimate = cacheEstimate(model, scenario)
  const ratio = cache.ratios[layer]
  const rows = [
    ['全部层近期窗口', `${model.dimensions.layers} × min(S, ${cache.window}) × ${cache.kvWidth}`, part.slidingBytes, '#70e1f5'],
    ['主压缩 KV', `(${part.counts.csa} × ⌊S/4⌋ + ${part.counts.hca} × ⌊S/128⌋) × ${cache.kvWidth}`, part.compressedBytes, '#c7a8ff'],
    ['C4 Index K', `${part.counts.csa} × ⌊S/4⌋ × ${cache.indexWidth}`, part.indexBytes, '#ffc98b'],
    ['Compressor 状态 · 固定 FP32', 'kv_state + score_state；不随 KV 精度改变', part.compressorBytes, '#d8ff78'],
  ] as const
  const control = 'rounded-xl border border-white/20 bg-[#0c131c] px-3 py-2 text-base text-white'
  return <section aria-label="压缩注意力缓存实验" className="mt-4 rounded-3xl border border-cyan-200/20 bg-[#0b131b] p-5">
    <h2 className="text-lg font-semibold text-white">保存多少，读取多少？</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">S 包含当前 token；这里只计算有效记录与参考实现的固定压缩窗口，不模拟权重或完整显存。mHC 四路主干不是四份 KV。单个 512 维表示同时作为 K 和 V，也不乘二。</p>
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="flex flex-col gap-2 text-sm text-white/70">请求 B<select aria-label="并发请求数" className={control} value={scenario.batch} onChange={e => onBatch(Number(e.target.value))}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">历史 S<select aria-label="每请求序列 token 数" className={control} value={scenario.sequence} onChange={e => onSequence(Number(e.target.value))}>{[...new Set([1024, 2047, 2048, 2049, 4095, 4096, 4097, 32768, 131072, 1048576, scenario.sequence])].filter(n => n <= model.execution.maxContext).sort((a, b) => a - b).map(n => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm text-white/70">主 KV / Index K 统一精度假设<select aria-label="KV 缓存精度" className={control} value={scenario.cacheBytes} onChange={e => onBytes(Number(e.target.value) as 1 | 2)}><option value={2}>2 字节 / 元素</option><option value={1}>1 字节 / 元素（逻辑假设）</option></select></label>
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-3" aria-label="当前层保留与读取位置">
      <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/5 p-4"><h3 className="text-sm text-cyan-100">Layer {layer} · 原始近期窗口</h3><p className="mt-3 font-mono text-2xl text-white">{part.slidingTokens} 条</p><p className="mt-2 text-sm leading-6 text-white/65">位置 [{Math.max(0, scenario.sequence - cache.window).toLocaleString('en-US')}, {(scenario.sequence - 1).toLocaleString('en-US')}]；Decode 全部可读。</p></div>
      <div className="rounded-2xl border border-violet-200/20 bg-violet-200/5 p-4"><h3 className="text-sm text-violet-100">本层完整压缩历史</h3><p className="mt-3 font-mono text-2xl text-white">{(ratio === 4 ? part.slots4 : ratio === 128 ? part.slots128 : 0).toLocaleString('en-US')} 条</p><p className="mt-2 text-sm leading-6 text-white/65">{ratio ? `⌊S/${ratio}⌋。尚未完成的 ${scenario.sequence % ratio} 个 token 留在增量状态中；不会提前生成未来块。` : '本层没有压缩器；并非完整历史 Attention。'}</p></div>
      <div className="rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4"><h3 className="text-sm text-amber-100">{scenario.phase === 'decode' ? '当前 Decode 读取压缩条数' : 'Prefill 最后 query 读取压缩条数'}</h3><p className="mt-3 font-mono text-2xl text-white">{(ratio === 4 ? Math.min(part.slots4, cache.indexTopk) : ratio === 128 ? part.slots128 : 0).toLocaleString('en-US')} 条</p><p className="mt-2 text-sm leading-6 text-white/65">{ratio === 4 ? '最多 Top-512；其余压缩 KV / Index K 仍然保存。' : ratio === 128 ? 'HCA 读取所有已形成的 C128 记录，不运行 C4 Indexer。' : '没有压缩读取，只有左侧近期窗口。'} Prefill 中更早的 query 只能访问当时已形成的块，仍需 causal mask；这里不是整次 Prefill 的读取总量。</p></div>
    </div>
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-sm text-white/65">全部 {model.dimensions.layers} 层 · 每 rank 逻辑缓存与状态</p><output aria-live="polite" className="mt-2 block font-mono text-3xl text-white">{formatBytes(part.total)}</output>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">{rows.map(([label, , bytes, color]) => <span key={label} style={{ width: `${bytes / part.total * 100}%`, backgroundColor: color }} />)}</div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, formula, bytes, color]) => <div key={label} className="rounded-xl border border-white/10 p-3"><dt style={{ color }} className="text-sm">{label}</dt><dd className="mt-2 font-mono text-lg text-white">{formatBytes(bytes)}</dd><dd className="mt-2 text-xs leading-6 text-white/55">{formula}{label.includes('FP32') ? '' : ' × B × bytes'}</dd></div>)}</dl>
      <p className="mt-4 text-sm leading-6 text-white/65">{scenario.sequence < model.execution.maxContext ? `单请求下一个 token 的容量增量：${formatBytes(estimate.growthBytesPerToken)} / rank。` : '已到上下文上限，不外推下一个 token。'} 压缩块按边界追加；某一步增量为 0 不代表没有计算或写入。TP={scenario.tp} 合计 {formatBytes(estimate.allRankBytes)}，KV 与压缩状态都按 rank 复制。</p>
    </div>
    <details className="mt-4 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm text-cyan-100">精度、增量状态与实现口径</summary><div className="mt-3 space-y-3 text-sm leading-6 text-white/65"><p>C4 的每个 compressor 有两份 FP32 状态，各为 [B,8,2D]，包含 overlap；C128 各为 [B,128,D]。C4 主 D=512、Indexer D=128；C128 仅主 D=512。按官方最小实现的完整窗口分配估算，合计不随 S 增长。</p><p>此处 KV 精度统一作用于主 KV 与 Index K，是可比较的逻辑假设。实际可能混用 noPE FP8、RoPE BF16、Indexer FP4/FP8 与量化 scale，不能把这里的一字节选项当成引擎实际布局。SGLang 的 online/ring compressor 也可使用不同状态大小。</p><p>不计最大上下文预分配、页填充、INT32 路由表、RoPE 表、检索矩阵、MTP、图捕获及通信缓冲。<a className="text-cyan-100 underline" href="https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/inference/model.py" target="_blank" rel="noreferrer">官方 Compressor / Indexer / Attention 参考实现</a></p></div></details>
  </section>
}
