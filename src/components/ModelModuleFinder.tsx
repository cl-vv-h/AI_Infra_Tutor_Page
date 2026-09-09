import { useMemo, useState } from 'react'
import { ArrowDownRight, Search } from 'lucide-react'
import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import { findModules, moduleIndex, nearestModuleLayer } from '@/lib/model-explorer'

export default function ModelModuleFinder({ model, layer, selectedId, onSelect }: { model: ModelArchitecture; layer: number; selectedId: string; onSelect: (node: ArchitectureNode, layer: number) => void }) {
  const [query, setQuery] = useState('')
  const index = useMemo(() => moduleIndex(model), [model])
  const results = findModules(index, query)
  return <details className="mt-4 rounded-2xl border border-cyan-200/15 bg-[#0b1119] p-4">
    <summary className="cursor-pointer text-base text-cyan-100"><Search className="mx-2 inline h-4 w-4" />模块与权重检索 <span className="ml-2 text-sm text-white/55">覆盖所有 Decoder 层与全局模块</span></summary>
    <div className="mt-4"><label className="text-sm text-white/70" htmlFor="module-search">输入模块、权重或中间张量名称</label><input id="module-search" type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 q_proj、router、recurrent state" className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-base text-white outline-cyan-200 placeholder:text-white/40" /></div>
    <p aria-live="polite" className="mt-3 text-sm text-white/60">{results.length} 个模块。若当前层没有该模块，会定位到最近的适用层。</p>
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{results.map((target) => {
      const destination = nearestModuleLayer(target, layer)
      return <li key={target.node.id}><button type="button" aria-pressed={selectedId === target.node.id && destination === layer} onClick={() => onSelect(target.node, destination)} className="h-full w-full rounded-xl border border-white/10 p-4 text-left transition hover:border-cyan-200/40 focus-visible:outline-cyan-200">
        <span className="block text-base font-medium text-white">{target.node.title}<ArrowDownRight className="ml-2 inline h-4 w-4 text-cyan-200" /></span>
        <span className="mt-2 block text-sm text-cyan-100/80">{target.global ? '全局模块' : `${target.layers.length} 层适用`} · {destination === layer ? `当前 Layer ${layer}` : `跳转 Layer ${destination}`}</span>
        <span className="mt-2 block break-words text-xs leading-5 text-white/55">{target.node.weights.map((weight) => weight.name).join(' · ') || target.node.subtitle}</span>
      </button></li>
    })}</ul>
    {!results.length && <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/60">没有匹配的模块。试试更短的名称，或清空搜索查看全部模块。</p>}
  </details>
}
