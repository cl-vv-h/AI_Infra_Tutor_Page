import { useEffect, useId, useState } from 'react'
import { Calculator, ArrowRight } from 'lucide-react'
import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatBytes } from '@/lib/model-lab'
import { defaultCacheBudgetGiB, gibibyte, parseCacheBudget, planCacheCapacity } from '@/lib/cache-capacity'

export default function CacheCapacityPlanner({ model, scenario, budgetGiB = defaultCacheBudgetGiB, onBudget, onBatch, onSequence }: {
  model: ModelArchitecture; scenario: InferenceScenario; budgetGiB?: number
  onBudget: (value: number) => void; onBatch: (value: number) => void; onSequence: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(budgetGiB))
  const [open, setOpen] = useState(budgetGiB !== defaultCacheBudgetGiB)
  const hintId = useId()
  useEffect(() => { setDraft(String(budgetGiB)) }, [budgetGiB])
  const value = parseCacheBudget(draft)
  const plan = value === null ? null : planCacheCapacity(model, scenario, Math.floor(value * gibibyte))
  function change(raw: string) {
    setDraft(raw)
    const next = parseCacheBudget(raw)
    if (next !== null) onBudget(next)
  }
  const actionClass = 'mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-200/30 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-40'
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-4 overflow-hidden rounded-3xl border border-lime-200/20 bg-[#0b1418]">
    <summary className="cursor-pointer p-5 text-base font-semibold text-lime-100"><Calculator className="mr-2 inline h-4 w-4" />缓存预算反算 · 并发与上下文</summary>
    <div className="border-t border-white/10 p-5">
      <p id={hintId} className="max-w-4xl text-sm leading-6 text-slate-300">输入每卡已留给 KV／循环状态的预算，不是显卡总容量。请先扣除权重、激活、图捕获、通信缓冲及安全余量。按等长、无共享前缀请求估算；结果是逻辑容量上界，不是吞吐、QPS 或部署承诺。</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm text-white/70">每卡缓存预算 · GiB<input type="text" inputMode="decimal" maxLength={8} aria-label="每卡缓存预算 GiB" aria-describedby={hintId} aria-invalid={value === null} value={draft} onChange={(event) => change(event.target.value)} className="w-40 rounded-xl border border-white/20 bg-[#080f16] px-3 py-2.5 font-mono text-base text-white focus-visible:outline-cyan-200" /></label>
        {[1, 4, 8, 16, 32].map((preset) => <button key={preset} type="button" aria-pressed={value === preset} onClick={() => change(String(preset))} className={`rounded-xl border px-3 py-2.5 text-sm ${value === preset ? 'border-lime-200/40 text-lime-100' : 'border-white/15 text-white/65 hover:text-white'}`}>{preset} GiB</button>)}
        <p className="text-sm text-white/50">1 GiB = 1,024³ 字节；0–1024，最多三位小数。默认 8 GiB 仅为示例预算。</p>
      </div>
      {!plan ? <p role="status" className="mt-4 text-sm text-amber-100">预算无效，暂不计算。请输入 0–1024 GiB 的数值（最多三位小数）。</p> : <>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4" aria-live="polite">
          <p className={`text-sm ${plan.fits ? 'text-lime-100' : 'text-amber-100'}`}>当前 B={scenario.batch}、S={scenario.sequence.toLocaleString('en-US')}：需要 {formatBytes(plan.currentBytes)} / 卡 · {plan.fits ? `预算内剩余 ${formatBytes(plan.remainingBytes)}` : `超出预算 ${formatBytes(plan.deficitBytes)}`}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><div className={`h-full ${plan.fits ? 'bg-lime-200/75' : 'bg-amber-200/80'}`} style={{ width: `${plan.budgetBytes ? Math.min(100, 100 * plan.currentBytes / plan.budgetBytes) : 100}%` }} /></div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-4"><h3 className="text-sm text-white/65">保持 S={scenario.sequence.toLocaleString('en-US')}，最多多少并发？</h3><output className="mt-3 block font-mono text-3xl text-white">{plan.maximumBatch.toLocaleString('en-US')} <span className="text-base text-white/60">请求</span></output><p className="mt-3 text-sm leading-6 text-white/60">⌊预算 ÷ 单请求 {formatBytes(plan.perRequestBytes)}⌋。每个请求都已计入全部层的 KV 和适用的循环状态。</p><button type="button" disabled={plan.applicableBatch < 1 || plan.applicableBatch === scenario.batch} onClick={() => onBatch(plan.applicableBatch)} className={actionClass}>应用 B={plan.applicableBatch}<ArrowRight className="h-4 w-4" /></button><p className="mt-2 text-sm text-white/50">{plan.maximumBatch > 64 ? '图解控件上限为 64，应用只带入 B=64，不将它冒充理论极限。' : plan.maximumBatch === 0 ? '当前 S 下连 1 个完整请求也超出预算。' : '仅改变 B；保持 S、TP、精度、层号与已选模块。'}</p></div>
          <div className="rounded-2xl border border-white/10 p-4"><h3 className="text-sm text-white/65">保持 B={scenario.batch}，最长多少上下文？</h3><output className="mt-3 block font-mono text-3xl text-white">{plan.maximumSequence?.toLocaleString('en-US') ?? '无可用 S'} <span className="text-base text-white/60">{plan.maximumSequence !== null ? 'tokens / 请求' : ''}</span></output><p className="mt-3 text-sm leading-6 text-white/60">{plan.maximumSequence === null ? '在本工具 S≥1,024 的范围内都超预算；可以降低 B 或增加缓存预算。' : plan.contextLimited ? '已达到模型配置上限；即使预算仍有余量，也不外推更长上下文。' : '按该模型实际缓存公式逐 token 求边界，包含滑窗拐点与循环状态。'}</p><button type="button" disabled={plan.maximumSequence === null || plan.maximumSequence === scenario.sequence} onClick={() => { if (plan.maximumSequence !== null) onSequence(plan.maximumSequence) }} className={actionClass}>应用最长 S<ArrowRight className="h-4 w-4" /></button><p className="mt-2 text-sm text-white/50">两个结果分别固定另一变量，不能将各自最大 B 和最大 S 同时组合。</p></div>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/55">模型的 KV 分片／复制、滑窗与混合状态口径与上方一致。不计页尾填充、量化元数据、前缀共享或推测解码额外副本；实际容量还需引擎实测。有效预算随图解链接分享，不读取硬件信息或上传数据。</p>
      </>}
    </div>
  </details>
}
