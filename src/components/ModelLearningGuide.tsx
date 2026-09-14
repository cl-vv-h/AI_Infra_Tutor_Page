import { useState } from 'react'
import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react'
import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatShape } from '@/lib/model-lab'
import { adjacentLearningStop, learningStops } from '@/lib/model-learning'

export default function ModelLearningGuide({ model, layer, selectedId, scenario, onSelect }: {
  model: ModelArchitecture; layer: number; selectedId: string; scenario: InferenceScenario; onSelect: (node: ArchitectureNode) => void
}) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState('')
  const stops = learningStops(model, layer)
  const index = stops.findIndex(({ node }) => node.id === selectedId)
  const stop = stops[Math.max(0, index)]
  const previous = adjacentLearningStop(stops, selectedId, -1)
  const next = adjacentLearningStop(stops, selectedId, 1)
  const answerKey = `${model.id}/${layer}/${selectedId}/${scenario.phase}/${scenario.batch}/${scenario.sequence}/${scenario.tp}`
  const showing = revealed === answerKey
  const button = 'inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-35'
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-4 rounded-2xl border border-cyan-200/20 bg-[#0a161c]">
    <summary className="cursor-pointer p-4 text-base font-medium text-cyan-100"><GraduationCap className="mr-2 inline h-5 w-5" />逐步导览 · 先预测，再看 Shape</summary>
    <section aria-label="模型学习导览" className="border-t border-white/10 p-4 sm:p-5">
      <p className="text-sm leading-6 text-white/60">这是当前层的阅读路线，不是执行时间线。缓存与视觉是支路，并行残差也不会被改成串行依赖。切换层号会自动使用该层真实模块；当前步骤随图解链接分享，不记录学习身份或上传答案。</p>
      <ol className="mt-4 flex flex-wrap gap-2" aria-label="导览步骤">{stops.map(({ node }, position) => <li key={node.id}><button type="button" aria-current={selectedId === node.id ? 'step' : undefined} onClick={() => onSelect(node)} className={`rounded-xl border px-3 py-2 text-left text-sm ${selectedId === node.id ? 'border-cyan-200/60 bg-cyan-200/10 text-cyan-100' : 'border-white/15 text-white/65 hover:text-white'}`}><span className="mr-2 font-mono text-white/45">{position + 1}</span>{node.title}</button></li>)}</ol>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4" aria-live="polite">
        <p className="font-mono text-xs text-cyan-200/70">阅读位置 {Math.max(0, index) + 1} / {stops.length} · Layer {layer} · {scenario.phase}</p>
        <h3 className="mt-3 text-lg font-semibold text-white">{stop.node.title}</h3>
        <p className="mt-2 text-sm leading-6 text-amber-100">{stop.context}</p>
        <p className="mt-4 text-base leading-7 text-white/90">{stop.question}</p>
        <button type="button" aria-expanded={showing} aria-controls="learning-answer" onClick={() => setRevealed(showing ? '' : answerKey)} className={`${button} mt-3`}>{showing ? '收起讲解' : '查看本步讲解'}</button>
        <div id="learning-answer" hidden={!showing} className="mt-4 space-y-3 text-sm leading-6 text-white/70">
          <p>{stop.node.description}</p>
          <p className="break-words font-mono text-cyan-100">输入 {formatShape(stop.node.inputShape, model, scenario)}<br />输出 {formatShape(stop.node.outputShape, model, scenario)}</p>
          {stop.node.phaseNotes && <p>{stop.node.phaseNotes[scenario.phase]}</p>}
          <p>这不是自动判分。请结合下方权重、缓存和原始资料，自行检查推理。</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3"><button type="button" disabled={!previous} onClick={() => previous && onSelect(previous.node)} className={button}><ArrowLeft className="h-4 w-4" />上一步</button><button type="button" disabled={!next} onClick={() => next && onSelect(next.node)} className={button}>下一步<ArrowRight className="h-4 w-4" /></button></div>
    </section>
  </details>
}
