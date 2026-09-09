import { comparisonColors, comparisonSeries, contextProbes, memoryValue } from '@/lib/model-comparison'
import type { MemoryScope } from '@/lib/model-comparison'
import { formatBytes } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'
import type { ModelArchitecture } from '@/types/model'

export default function ModelComparisonChart({ models, scenario, scope, onSequence }: {
  models: ModelArchitecture[]
  scenario: InferenceScenario
  scope: MemoryScope
  onSequence: (sequence: number) => void
}) {
  const series = models.map((model) => ({ model, points: comparisonSeries(model, scenario) }))
  const maxBytes = Math.max(1, ...series.flatMap(({ points }) => points.map((point) => memoryValue(point, scope))))
  const x = (sequence: number) => 90 + (Math.log2(sequence) - 10) / 8 * 720
  const y = (bytes: number) => 265 - bytes / maxBytes * 215

  return <section className="mt-6 rounded-3xl border border-white/10 bg-[#0b131b] p-5 sm:p-6" aria-labelledby="comparison-growth-title">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 id="comparison-growth-title" className="text-xl font-semibold text-white">上下文变长，缓存如何增长？</h2><p className="mt-2 text-sm leading-6 text-slate-400">横轴为对数长度，纵轴为统一线性容量；曲线止于各模型当前配置上限。</p></div>
      <span className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-300">{scope === 'rank' ? '每卡' : `全部 ${scenario.tp} 卡`} · B = {scenario.batch}</span>
    </div>
    <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="缓存增长图，可横向滚动">
      <svg viewBox="0 0 880 320" className="min-w-[640px] w-full" role="img" aria-labelledby="growth-chart-title growth-chart-desc">
        <title id="growth-chart-title">模型缓存随上下文长度的变化</title>
        <desc id="growth-chart-desc">{series.map(({ model, points }) => `${model.name}：${points.length ? points.map((point) => `${point.sequence} tokens 对应 ${formatBytes(memoryValue(point, scope))}`).join('；') : '当前 TP 不在图解覆盖范围内'}`).join('。')}</desc>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line x1={90} x2={810} y1={y(ratio * maxBytes)} y2={y(ratio * maxBytes)} stroke="#ffffff15" /><text x={78} y={y(ratio * maxBytes) + 4} textAnchor="end" fill="#94a3b8" fontSize={12}>{formatBytes(ratio * maxBytes)}</text></g>)}
        {contextProbes.map((size) => <text key={size} x={x(size)} y={294} textAnchor="middle" fill="#94a3b8" fontSize={13}>{size / 1024}K</text>)}
        <line x1={x(scenario.sequence)} x2={x(scenario.sequence)} y1={35} y2={265} stroke="#ffffff60" strokeDasharray="4 5" />
        <text x={Math.min(765, Math.max(130, x(scenario.sequence)))} y={22} textAnchor="middle" fill="#e2e8f0" fontSize={13}>当前 S = {scenario.sequence.toLocaleString('en-US')}</text>
        {series.map(({ model, points }, index) => <g key={model.id}>
          <polyline points={points.map((point) => `${x(point.sequence)},${y(memoryValue(point, scope))}`).join(' ')} fill="none" stroke={comparisonColors[index]} strokeWidth={2.5} strokeDasharray={index === 1 ? '8 4' : index === 2 ? '2 4' : undefined} />
          {points.map((point) => <circle key={point.sequence} cx={x(point.sequence)} cy={y(memoryValue(point, scope))} r={point.sequence === scenario.sequence ? 5 : 3} fill={comparisonColors[index]}><title>{model.name} · S {point.sequence.toLocaleString('en-US')} · {formatBytes(memoryValue(point, scope))}</title></circle>)}
        </g>)}
      </svg>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{series.map(({ model, points }, index) => <span key={model.id} className="flex items-center gap-2 text-sm" style={{ color: comparisonColors[index] }}><span aria-hidden="true">{index === 0 ? '━━' : index === 1 ? '┄┄' : '···'}</span>{model.name}{!points.length && ' · 未计算'}</span>)}</div>
    <div className="mt-5 flex flex-wrap gap-2" aria-label="选择对照上下文长度">{contextProbes.map((size) => <button key={size} type="button" aria-pressed={size === scenario.sequence} onClick={() => onSequence(size)} className={`rounded-xl border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 ${size === scenario.sequence ? 'border-cyan-200/50 bg-cyan-200/10 text-cyan-100' : 'border-white/10 text-slate-300 hover:border-white/30'}`}>{size / 1024}K</button>)}</div>
    <details className="mt-5 border-t border-white/10 pt-4">
      <summary className="cursor-pointer text-sm text-cyan-100">查看各长度的精确容量</summary>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="各长度精确缓存容量">
        <table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">同一 B、TP、KV 精度下的精确容量；破折号表示超出配置或图解范围。</caption><thead><tr><th scope="col" className="p-3 text-slate-300">S / tokens</th>{models.map((model) => <th scope="col" className="p-3 text-white" key={model.id}>{model.name}</th>)}</tr></thead>
          <tbody>{contextProbes.map((size) => <tr key={size} className="border-t border-white/10"><th scope="row" className="p-3 font-mono font-normal text-slate-300">{size.toLocaleString('en-US')}</th>{series.map(({ model, points }) => { const point = points.find((item) => item.sequence === size); return <td key={model.id} className="p-3 font-mono text-slate-300">{point ? formatBytes(memoryValue(point, scope)) : '—'}</td> })}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>
}
