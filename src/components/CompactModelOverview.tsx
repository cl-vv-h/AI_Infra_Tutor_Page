import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import { attentionKind, decoderGroups } from '@/lib/model-lab'

/** Archify's primary-path/progressive-disclosure design, kept native for live state. */
export default function CompactModelOverview({ model, layer, onSelect }: {
  model: ModelArchitecture; layer: number; onSelect: (node: ArchitectureNode) => void
}) {
  const groups = decoderGroups(model, layer)
  const attention = groups.flat().find(node => node.id === attentionKind(model, layer))!
  const ffn = groups.flat().find(node => ['moe', 'dense-ffn', 'ffn'].includes(node.id)) ?? groups[1]?.find(node => node.weights.length && !node.id.includes('norm'))
  const embedding = model.nodes.find(node => node.id === 'embedding')!
  const head = model.nodes.find(node => node.id === 'lm-head')!
  const parallel = model.execution.residualLayout === 'parallel'
  const residual = model.execution.residualLayout
  const card = (node: ArchitectureNode, label: string) => <button type="button" onClick={() => onSelect(node)} className={`min-h-28 min-w-0 rounded-2xl border p-4 text-left transition hover:bg-white/10 focus-visible:outline-cyan-200 ${node.tone === 'ffn' ? 'border-violet-200/30 bg-violet-200/5' : 'border-cyan-200/20 bg-cyan-200/5'}`}><span className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</span><span className="mt-2 block text-base font-semibold text-white">{node.title}</span><span className="mt-2 block text-xs leading-5 text-white/60">{node.subtitle}</span></button>
  return <section aria-label="模型核心结构" className="mt-4 rounded-3xl border border-white/10 bg-[#0b1119] p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">{model.name}</h2><p className="text-xs text-white/55">{model.parameters} · {model.dimensions.layers} 层 · 点击模块查看细节</p></div>
    <div className="mt-5 grid items-center gap-3 lg:grid-cols-[1fr_auto_2.5fr_auto_1fr]">
      {card(embedding, '输入')}<span aria-hidden="true" className="text-center text-cyan-200">→</span>
      <div className="min-w-0 rounded-2xl border border-dashed border-white/20 p-3">
        <p className="mb-3 text-xs text-white/60">Decoder × {model.dimensions.layers} · 当前 Layer {layer}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">{card(attention, 'Attention')}<span className="self-center text-center text-white/50">{parallel ? '∥' : '→'}</span>{ffn && card(ffn, 'FFN')}</div>
        <p className="mt-3 text-xs leading-5 text-white/55">{parallel ? 'Attention 与 MLP 同读 x，最后 x + A + M；不是串行依赖。' : residual === 'mhc' ? 'mHC：每个子层通过 Pre / Post 混合四路残差。' : residual === 'attn-res' ? 'AttnRes：子层前深度聚合，子层后写入块内残差。' : '每个子层均保留残差连接；Norm 与加法在详细图中展开。'}</p>
      </div><span aria-hidden="true" className="text-center text-cyan-200">→</span>{card(head, '输出')}
    </div>
    {model.nodes.some(node => node.id === 'vision') && <p className="mt-3 text-xs text-amber-100">多模态输入还包含视觉编码支路，见完整结构图。</p>}
  </section>
}
