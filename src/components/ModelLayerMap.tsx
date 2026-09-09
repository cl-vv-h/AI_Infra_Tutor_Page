import { attentionKind } from '@/lib/model-lab'
import type { ModelArchitecture } from '@/types/model'

const labels = { gqa: 'Full / GQA', mla: 'MLA', gdn: 'Gated DeltaNet', swa: 'Sliding / GQA' }
const colors = { gqa: 'border-cyan-200/35 bg-cyan-200/10 text-cyan-100', mla: 'border-violet-200/35 bg-violet-200/10 text-violet-100', gdn: 'border-lime-200/35 bg-lime-200/10 text-lime-100', swa: 'border-amber-200/35 bg-amber-200/10 text-amber-100' }

export function ModelLayerMap({ model, selectedLayer, onSelect }: { model: ModelArchitecture; selectedLayer: number; onSelect: (layer: number) => void }) {
  const kinds = Array.from({ length: model.dimensions.layers }, (_, i) => attentionKind(model, i))
  return <section aria-label="模型层分布" className="mt-4 rounded-2xl border border-white/10 bg-[#0b1119] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-white">层分布 <span className="ml-2 font-normal text-white/55">点击展开一层 · 编号从 0 开始</span></h2>
      <div className="flex flex-wrap gap-3 text-xs text-white/70">{([...new Set(kinds)]).map((kind) => <span key={kind} className={`rounded-full border px-2.5 py-1 ${colors[kind]}`}>{labels[kind]} × {kinds.filter((item) => item === kind).length}</span>)}</div>
    </div>
    <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1.5">
      {kinds.map((kind, layer) => <button key={layer} type="button" aria-label={`Layer ${layer} · ${labels[kind]} · ${layer < model.execution.denseLayers ? 'Dense FFN' : 'MoE'}`} aria-pressed={selectedLayer === layer} onClick={() => onSelect(layer)} className={`aspect-square rounded-lg border font-mono text-xs transition hover:brightness-150 ${colors[kind]} ${selectedLayer === layer ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b1119]' : ''}`}>{layer}</button>)}
    </div>
  </section>
}
