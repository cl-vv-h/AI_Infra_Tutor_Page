import { ArrowLeft, ArrowRight, Layers3 } from 'lucide-react'
import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatShape } from '@/lib/model-lab'
import { adjacentLearningStop, learningStops } from '@/lib/model-learning'

export default function ModelLearningGuide({ model, layer, selectedId, scenario, onSelect }: {
  model: ModelArchitecture; layer: number; selectedId: string; scenario: InferenceScenario; onSelect: (node: ArchitectureNode) => void
}) {
  const stops = learningStops(model, layer)
  const index = Math.max(0, stops.findIndex(({ node }) => node.id === selectedId))
  const stop = stops[index]
  const previous = adjacentLearningStop(stops, selectedId, -1)
  const next = adjacentLearningStop(stops, selectedId, 1)
  const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 text-cyan-100 hover:bg-white/5 disabled:opacity-30'
  return <details className="mt-4 rounded-2xl border border-white/10 bg-[#0b141d]">
    <summary className="cursor-pointer p-4 text-base font-medium text-cyan-100"><Layers3 className="mr-2 inline h-4 w-4" />模块知识卡<span className="ml-3 text-xs font-normal text-white/50">{index + 1} / {stops.length}</span></summary>
    <section aria-label="模块知识卡" className="border-t border-white/10 p-4 sm:p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
        <button type="button" aria-label="上一模块" disabled={!previous} onClick={() => previous && onSelect(previous.node)} className={button}><ArrowLeft className="h-4 w-4" /></button>
        <select aria-label="知识卡模块" value={stop.node.id} onChange={event => onSelect(stops.find(item => item.node.id === event.target.value)!.node)} className="min-w-0 rounded-lg border border-white/15 bg-[#101e29] px-3 text-sm text-white">{stops.map(({ node }) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
        <button type="button" aria-label="下一模块" disabled={!next} onClick={() => next && onSelect(next.node)} className={button}><ArrowRight className="h-4 w-4" /></button>
      </div>
      <div id="module-knowledge-content" aria-live="polite" className="mt-4">
        <p className="font-mono text-xs text-cyan-200/60">LAYER {layer} / {scenario.phase.toUpperCase()}</p>
        <h3 className="mt-2 text-lg font-medium text-white">{stop.focus}</h3>
        <p className="mt-2 text-sm leading-7 text-white/75">{stop.node.description}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">{[['输入', stop.node.inputShape], ['输出', stop.node.outputShape]].map(([label, shape]) => <div key={label} className="min-w-0 rounded-xl bg-white/[0.035] p-3"><dt className="text-xs text-white/45">{label}</dt><dd className="mt-2 break-words font-mono text-sm text-cyan-100">{formatShape(shape, model, scenario)}</dd></div>)}</dl>
        {stop.node.phaseNotes && <p className="mt-3 text-sm leading-6 text-white/65">{stop.node.phaseNotes[scenario.phase]}</p>}
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-6 text-white/50">{stop.context}</p>
      </div>
    </section>
  </details>
}
