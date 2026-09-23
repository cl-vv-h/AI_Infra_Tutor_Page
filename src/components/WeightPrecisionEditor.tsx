import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getModelArchitecture } from '@/data/models'
import type { TensorParallelSize } from '@/types/model'
import { mixedPrecisionLabels } from '@/lib/mixed-precision'
import type { ExpertPrecision, MixedPrecision } from '@/lib/mixed-precision'
import { precisionRows } from '@/lib/weight-precision-policy'

export default function WeightPrecisionEditor({ modelId, tp, ep, attentionTp = tp, layer, value, onChange }: {
  modelId: string; tp: TensorParallelSize; ep: TensorParallelSize; attentionTp?: TensorParallelSize; layer: number; value: MixedPrecision; onChange: (value: MixedPrecision) => void
}) {
  const [scope, setScope] = useState<'all' | 'layer'>('all')
  const [module, setModule] = useState('')
  const [query, setQuery] = useState('')
  const latest = useRef(value)
  useLayoutEffect(() => { latest.current = value }, [value])
  const model = getModelArchitecture(modelId)
  const rows = useMemo(() => precisionRows(model, tp, ep, value, layer, scope, attentionTp), [model, tp, ep, value, layer, scope, attentionTp])
  const modules = [...new Map(rows.map(row => [row.nodeId, row.nodeTitle])).entries()]
  const selected = modules.some(([id]) => id === module) ? module : modules[0]?.[0]
  const count = Object.keys(value.weights ?? {}).length
  function change(key: string, format: string) {
    // Router transitions can defer a render; consecutive edits must merge with
    // the latest submitted policy, not the previous render's snapshot.
    const current = latest.current
    if (format && !current.weights?.[key] && Object.keys(current.weights ?? {}).length >= 256) return
    const weights = { ...current.weights }
    if (format) weights[key] = format as ExpertPrecision
    else delete weights[key]
    const next = { ...current, modelId, weights: Object.keys(weights).length ? weights : undefined }
    latest.current = next
    onChange(next)
  }
  return <details aria-label="逐权重精度" className="mt-5 rounded-xl border border-violet-200/20 bg-black/10 p-4">
    <summary className="cursor-pointer text-sm font-medium text-violet-100">逐权重精度<span className="ml-3 text-xs text-white/60">{count} 项覆盖</span></summary>
    <p className="mt-3 text-xs leading-5 text-white/60">优先级：当前层 → 同名权重 → 模块默认。专家格式作用于全部本地专家。</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-white/60">应用范围<select aria-label="精度覆盖范围" value={scope} onChange={e => setScope(e.target.value as 'all' | 'layer')} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#101e29] p-2 text-sm text-white"><option value="all">所有适用层的同名权重</option><option value="layer">仅 Layer {layer}</option></select></label>
      <label className="text-xs text-white/60">模块<select aria-label="精度权重模块" value={selected} onChange={e => setModule(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#101e29] p-2 text-sm text-white">{modules.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
    </div>
    <input aria-label="筛选权重名称" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 Gate、Up、Down、Q、K、V…" className="mt-3 min-h-11 w-full rounded-lg border border-white/15 bg-[#101e29] px-3 text-sm text-white placeholder:text-white/40" />
    <div className="mt-2 divide-y divide-white/10">{rows.filter(row => row.nodeId === selected && row.weight.name.toLowerCase().includes(query.trim().toLowerCase())).map(row => <div key={row.key} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.8fr)]">
      <div className="min-w-0"><p className="break-words font-mono text-sm text-cyan-100">{row.weight.name}</p><p className="mt-1 break-words font-mono text-xs text-white/60">{row.weight.shape} · {row.role}</p><p className="mt-1 text-xs text-white/60">有效格式：{mixedPrecisionLabels[row.effective]}</p></div>
      <select aria-label={`${row.weight.name} 权重格式`} value={value.weights?.[row.key] ?? ''} onChange={e => change(row.key, e.target.value)} className="min-h-11 min-w-0 self-center rounded-lg border border-white/20 bg-[#101e29] px-3 py-2 text-sm text-white"><option value="">继承默认</option>{row.options.map(format => <option key={format} value={format}>{mixedPrecisionLabels[format]}</option>)}</select>
    </div>)}</div>
    {!rows.some(row => row.nodeId === selected && row.weight.name.toLowerCase().includes(query.trim().toLowerCase())) && <p role="status" className="py-3 text-xs text-white/60">当前模块没有匹配权重，试试其他名称。</p>}
    <p className="text-xs leading-6 text-white/55">矩阵格式按当前 TP / EP 分片校验；Norm、bias 和非矩阵参数保留浮点选项。向量不套用矩阵分块 scale。改变并行配置后，不再满足对齐的覆盖会提示并清除。最多保存 256 项覆盖。</p>
    {count >= 256 && <p role="status" className="mt-2 text-xs text-amber-100">覆盖已达上限；可修改已有项或移除后新增。</p>}
    {!!count && <div className="mt-4 border-t border-white/10 pt-3"><button type="button" onClick={() => onChange({ ...value, weights: undefined, modelId: undefined })} className="min-h-11 rounded-lg border border-white/20 px-3 text-sm text-white/75">清除全部逐权重覆盖</button><details className="mt-3 text-xs text-white/60"><summary className="cursor-pointer">全部覆盖记录</summary><ul className="mt-2 space-y-2">{Object.entries(value.weights ?? {}).map(([key, format]) => <li key={key} className="flex min-w-0 items-center justify-between gap-3"><span className="break-all">{key} · {mixedPrecisionLabels[format]}</span><button type="button" aria-label={`移除覆盖 ${key}`} onClick={() => change(key, '')} className="min-h-11 shrink-0 px-2 text-cyan-100">移除</button></li>)}</ul></details></div>}
  </details>
}
