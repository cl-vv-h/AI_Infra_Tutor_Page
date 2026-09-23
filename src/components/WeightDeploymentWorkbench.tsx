import { useMemo } from 'react'
import type { ModelArchitecture, TensorParallelSize } from '@/types/model'
import { parallelSizes } from '@/types/model'
import type { ExplorerState } from '@/lib/model-explorer'
import { attentionDpSizes, deploymentWeightBudget } from '@/lib/weight-deployment'
import { expertParallelSizes } from '@/lib/model-weights'
import { formatBytes } from '@/lib/model-lab'
import { supportsMixedPrecision } from '@/lib/mixed-precision'
import MixedPrecisionControls from './MixedPrecisionControls'
import MixedWeightDetails from './MixedWeightDetails'

const selectClass = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#101e29] px-3 py-2 text-sm text-white'
const memory = (value: number | null) => value === null ? '未计算' : formatBytes(value)

export default function WeightDeploymentWorkbench({ model, state, onChange }: {
  model: ModelArchitecture; state: ExplorerState; onChange: (next: Partial<ExplorerState>) => void
}) {
  const { tp } = state.scenario
  const ep = state.ep ?? 1, pp = state.pp ?? 1, stage = state.ppStage ?? 0, attentionDp = state.attentionDp ?? 1, replicas = state.replicas ?? 1
  const budget = useMemo(() => deploymentWeightBudget(model, state.layer, state.weightBits ?? 16,
    { tp, ep, pp, stage, attentionDp, replicas }, state.mixed), [model, state.layer, state.weightBits, tp, ep, pp, stage, attentionDp, replicas, state.mixed])
  const field = (label: string, value: number, options: readonly number[], change: (n: number) => void, help: string) => <label className="min-w-0 text-xs text-white/65">{label}<select aria-label={label} value={value} onChange={e => change(Number(e.target.value))} className={selectClass}>{options.map(n => <option key={n} value={n}>{n}</option>)}</select><span className="mt-1 block text-[11px] leading-4 text-white/45">{help}</span></label>
  return <section aria-label="并行权重计算器" className="mt-4">
    <div aria-label="实时权重结果" aria-live="polite" className="sticky top-16 z-20 grid grid-cols-3 gap-2 rounded-2xl border border-cyan-200/25 bg-[#0b1822]/95 p-3 shadow-xl backdrop-blur-xl sm:gap-4 sm:p-4">
      {[
        [`PP ${stage} · 每卡`, budget.selectedStage.bytes, 'current'],
        ['最重阶段 · 每卡', budget.maxRankBytes, 'peak'],
        [`全部署 · ${budget.cards} 卡`, budget.fleetBytes, 'fleet'],
      ].map(([label, value, id]) => <div key={String(id)} className="min-w-0"><p className="text-[11px] text-white/60 sm:text-xs">{label}</p><output data-testid={`weight-${id}`} data-bytes={value === null ? '' : String(value)} className="mt-1 block break-words font-mono text-sm font-semibold text-cyan-100 sm:text-2xl">{memory(value as number | null)}</output></div>)}
      <p className="col-span-3 text-[11px] text-white/55">图示 Decoder 权重{state.mixed ? '（含 scale）' : '理论载荷'}，非整卡显存。当前卡负责 Layer {budget.selectedStage.start}–{budget.selectedStage.end - 1}。</p>
    </div>
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <section aria-label="权重并行参数" className="rounded-2xl border border-white/10 bg-[#0b1119] p-4">
          <h3 className="text-sm font-semibold text-white">并行设置</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {field('每阶段 TP', tp, model.supportedTp, n => onChange({ scenario: { ...state.scenario, tp: n as TensorParallelSize }, ep: 1, attentionDp: 1 }), '每个 PP 阶段的卡数')}
            {field('Expert EP', ep, expertParallelSizes(model, tp), n => onChange({ ep: n as TensorParallelSize }), `MoE-TP = ${budget.moeTp}`)}
            {field('Attention DP', attentionDp, attentionDpSizes(model, tp), n => onChange({ attentionDp: n as TensorParallelSize }), `Attention TP = ${budget.attentionTp}`)}
            {field('Pipeline PP', pp, Array.from({ length: Math.min(64, model.dimensions.layers) }, (_, i) => i + 1), n => onChange({ pp: n, ppStage: Math.min(stage, n - 1) }), '最多 64 阶段，且不超过层数')}
            {field('观察 PP 阶段', stage, budget.stages.map(s => s.stage), n => onChange({ ppStage: n }), '各阶段的权重可能不同')}
            {field('独立 DP 副本', replicas, parallelSizes, n => onChange({ replicas: n as TensorParallelSize }), '复制完整 TP × PP 部署')}
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100">{tp} TP × {pp} PP × {replicas} 独立 DP = {budget.cards} 卡。EP 和 Attention DP 划分同一组 TP 卡，不额外相乘。</p>
          <p className="mt-2 text-xs leading-5 text-white/50">并行度范围扩展至 64，按当前模型的完整头、分组和维度分片规则筛选。此处 TP 表示每阶段并行组规模；实际 Attention TP 与 MoE-TP 见对应选项。可计算容量不代表后端已验证可部署。</p>
          {!state.mixed && <label className="mt-3 block text-xs text-white/65">统一权重位宽<select aria-label="统一权重位宽" className={selectClass} value={state.weightBits ?? 16} onChange={e => onChange({ weightBits: Number(e.target.value) as 4 | 8 | 16 | 32 })}>{[16, 8, 4, 32].map(n => <option key={n} value={n}>{n}-bit · 不含量化 scale</option>)}</select></label>}
        </section>
        {supportsMixedPrecision(model.id) && <MixedPrecisionControls compact value={state.mixed} hasDense={model.execution.denseLayers > 0} denseOnly={model.id === 'qwen3-8b'} modelId={model.id} tp={tp} ep={ep} attentionTp={budget.attentionTp} layer={state.layer} onChange={mixed => onChange({ mixed })} />}
      </div>
      <section aria-label="Decoder 权重账本" id="weight-decoder-section" tabIndex={-1} className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1119] p-4 lg:sticky lg:top-48">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Layer {state.layer} · 模块占用</h3><span className="font-mono text-sm text-violet-100">{memory(budget.bytes)} / 卡</span></div>
        {!budget.layerIsLocal && <p role="status" className="mt-2 text-xs leading-5 text-amber-100">此层不在 PP {stage}；下方是该层所属卡的分片明细，不计入当前卡。</p>}
        {!budget.complete && <p role="status" className="mt-2 text-xs text-amber-100">存在未解析 Shape，相关汇总不展示估计数字。</p>}
        <div className="mt-3 divide-y divide-white/10">{budget.rows.map(row => <details key={row.node.id} data-weight-module={row.node.id} className="py-3">
          <summary className="cursor-pointer text-sm text-white/75"><span className="ml-1 inline-flex w-[90%] flex-wrap justify-between gap-1 align-top"><span>{row.node.title}</span><span className="font-mono text-violet-100">{memory(row.bytes)}</span></span></summary>
          <div aria-hidden="true" className="mt-2 h-1 rounded bg-white/5"><div className="h-full rounded bg-cyan-200/70" style={{ width: `${budget.bytes && row.bytes ? row.bytes / budget.bytes * 100 : 0}%` }} /></div>
          <ul className="mt-3 space-y-3">{row.weights.map(weight => <li key={weight.name} className="min-w-0 rounded-lg bg-white/[0.025] p-3"><p className="break-words font-mono text-xs text-cyan-100">{weight.name}</p><p className="mt-1 break-words font-mono text-xs text-white/60">{weight.shape}{weight.copies > 1 ? ` × ${weight.copies}` : ''} · {memory(weight.bytes)}</p>{weight.storage && <MixedWeightDetails storage={weight.storage} copies={weight.copies} />}</li>)}</ul>
        </details>)}</div>
        <details className="mt-4 border-t border-white/10 pt-3 text-xs text-white/65"><summary className="cursor-pointer">全部 PP 阶段 · 展开分段账本</summary><div className="mt-2 space-y-1">{budget.stages.map(part => <button key={part.stage} type="button" aria-pressed={stage === part.stage} onClick={() => onChange({ ppStage: part.stage })} className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 text-left ${stage === part.stage ? 'bg-cyan-200/10 text-cyan-100' : 'hover:bg-white/5'}`}><span>PP {part.stage} · L{part.start}–{part.end - 1}</span><span>{memory(part.bytes)} / 卡</span></button>)}</div></details>
        <details className="mt-3 text-xs leading-6 text-white/55"><summary className="cursor-pointer">统计边界与公式</summary>
          <p className="mt-2">Attention 投影按 TP / Attention DP 分片，Dense / Shared 使用总 TP，Routed 按 EP 与 TP / EP 分片。Norm、Router 和低秩输入等复制项不强行除并行度；Top-k 不减少常驻专家。</p>
          <p>PP 按层数均分，余数层放末尾阶段；各层根据层型与精度覆盖单独计算。全部署 = 各阶段每卡之和 × TP × 独立 DP；不是当前阶段 × PP。</p>
          <p>仅计算图示 Decoder，排除 Embedding、LM Head、视觉塔、辅助预测层、KV、激活、运行缓冲与额外对齐。此处是组合存储模型，不保证对应模型后端支持该 PP / DPA 组合。A2A=none、MoE-DP=1；不模拟 EPLB 或专家冗余。</p>
          <a className="text-cyan-100 hover:underline" href="https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/distributed/utils.py#L86" target="_blank" rel="noreferrer">SGLang PP 分段依据 ↗</a>
        </details>
      </section>
    </div>
  </section>
}
