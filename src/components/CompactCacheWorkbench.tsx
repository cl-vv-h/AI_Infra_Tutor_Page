import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { cacheEstimate, formatBytes } from '@/lib/model-lab'

export default function CompactCacheWorkbench({ model, scenario, onChange }: { model: ModelArchitecture; scenario: InferenceScenario; onChange: (next: Partial<InferenceScenario>) => void }) {
  const result = cacheEstimate(model, scenario)
  const select = 'mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#101e29] px-3 text-sm text-white'
  return <section aria-label="缓存核心计算" className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-[#0b1119] p-5 lg:grid-cols-2">
    <div><h2 className="text-base font-semibold text-white">缓存容量</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-white/60">请求数 B<select aria-label="缓存请求数" className={select} value={scenario.batch} onChange={e => onChange({ batch: Number(e.target.value) })}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a,b) => a-b).map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="text-xs text-white/60">上下文 S<select aria-label="缓存上下文" className={select} value={scenario.sequence} onChange={e => onChange({ sequence: Number(e.target.value) })}>{[...new Set([1024, 4096, 16384, 32768, 65536, 131072, model.execution.maxContext, scenario.sequence])].filter(n => n <= model.execution.maxContext).sort((a,b) => a-b).map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}</select></label>
      <label className="text-xs text-white/60">KV 格式<select aria-label="缓存格式" className={select} value={scenario.cacheBytes} onChange={e => onChange({ cacheBytes: Number(e.target.value) as 1 | 2 })}><option value={2}>BF16 / FP16</option><option value={1}>FP8 · 容量假设</option></select></label>
    </div><p className="mt-3 text-xs leading-5 text-white/50">B {scenario.batch} · S {scenario.sequence.toLocaleString('en-US')} · 缓存 {scenario.cacheBytes * 8}-bit。基础缓存口径：TP {scenario.tp}，全部 {model.dimensions.layers} 层，PP=1 / Attention DP=1。权重页的组合分段不套用此缓存数字。</p></div>
    <div className="rounded-2xl border border-lime-200/15 bg-lime-200/5 p-4"><p className="text-xs text-lime-100">每卡逻辑缓存 / 持久状态</p><output aria-live="polite" className="mt-2 block font-mono text-3xl text-white">{formatBytes(result.perRankBytes)}</output><p className="mt-3 text-xs text-white/60">TP 组总计 {formatBytes(result.allRankBytes)} · 不含权重、页尾填充与运行缓冲</p><p className="mt-2 text-xs text-white/50">{scenario.sequence < model.execution.maxContext ? `每请求增加 1 token：+${formatBytes(result.growthBytesPerToken)} / 卡` : '已达到配置上下文上限'}。循环与卷积状态沿用模型固定 dtype。</p></div>
  </section>
}
