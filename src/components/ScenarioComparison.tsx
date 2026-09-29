import { useMemo, useState } from 'react'
import type { DeploymentScenarioSnapshot } from '@/lib/deployment-scenarios'
import { estimateScenario, scenarioDifferenceRows } from '@/lib/scenario-comparison'
import { calculatorVersion } from '@/lib/site-release'
import { formatBytes } from '@/lib/model-lab'

const memory = (bytes: number | null | undefined) => bytes == null ? '未计算' : formatBytes(bytes)
export default function ScenarioComparison({ items }: { items: DeploymentScenarioSnapshot[] }) {
  const estimates = useMemo(() => items.map(s => estimateScenario(s, calculatorVersion)), [items])
  const [differencesOnly, setDifferencesOnly] = useState(true)
  if (items.length < 2 || items.length > 3) return null
  const rows = scenarioDifferenceRows(estimates), visible = rows.filter(row => !differencesOnly || row.different)
  return <section id="scenario-comparison" tabIndex={-1} aria-label="部署方案对比" className="surface-card mb-6 scroll-mt-24 p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl text-ink">方案对比</h2><label className="flex min-h-11 items-center gap-2 text-sm text-secondary"><input type="checkbox" checked={differencesOnly} onChange={e => setDifferencesOnly(e.target.checked)} />仅显示参数差异</label></div>
    <p className="mb-4 text-xs leading-6 text-muted">每列保留自己的条件；B 为每副本请求数。图示 Decoder 权重与缓存分开计算，不相加为整卡显存，不代表吞吐或部署可行性。Embedding、LM Head、激活及通信工作区未计入此权重口径。</p>
    <div role="region" aria-label="方案结果横向表格" tabIndex={0} className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed text-left text-sm">
        <thead><tr className="border-b border-line"><th className="w-44 p-3 text-muted">按当前计算定义复核</th>{estimates.map(e => <th className="p-3 text-ink [overflow-wrap:anywhere]" key={e.snapshot.id}>{e.snapshot.name}</th>)}</tr></thead>
        <tbody>
          <tr className="border-b border-line"><th className="p-3 font-normal text-secondary">当前状态</th>{estimates.map(e => <td className="p-3 text-secondary" key={e.snapshot.id}>{!e.state ? e.reasons.join(' ') : e.changed ? '定义已更新；本列已重新计算' : '按当前版本计算'}</td>)}</tr>
          {[
            ['物理卡数', (e: typeof estimates[number]) => e.weights?.cards.toLocaleString() ?? '未计算'],
            ['最重 PP stage · 每卡 Decoder 权重', (e: typeof estimates[number]) => memory(e.weights?.maxRankBytes)],
            ['所选 PP stage · 每卡 Decoder 权重', (e: typeof estimates[number]) => memory(e.weights?.selectedStage.bytes)],
            ['全部副本 Decoder 权重', (e: typeof estimates[number]) => memory(e.weights?.fleetBytes)],
            ['当前缓存 / 循环状态 · 每卡', (e: typeof estimates[number]) => e.cacheReason || memory(e.cache?.currentBytes)],
            ['缓存专用预算余量', (e: typeof estimates[number]) => e.cache ? e.cache.fits ? memory(e.cache.remainingBytes) : `超出 ${memory(e.cache.deficitBytes)}` : '未计算'],
          ].map(([label, get]) => <tr key={String(label)} className="border-b border-line"><th className="p-3 font-normal text-secondary">{String(label)}</th>{estimates.map(e => <td key={e.snapshot.id} className="p-3 text-ink [overflow-wrap:anywhere]">{(get as (e: typeof estimates[number]) => string)(e)}</td>)}</tr>)}
          <tr className="border-b border-line"><th className="p-3 font-normal text-secondary">PP stage 明细</th>{estimates.map(e => <td key={e.snapshot.id} className="p-3 text-secondary">{e.weightReason || (e.weights ? <details><summary className="min-h-11 cursor-pointer text-accent">{e.weights.stages.length} 个阶段 · 展开</summary><ul className="mt-2 space-y-2">{e.weights.stages.map(s => <li key={s.stage}>PP {s.stage} · L{s.start}–{s.end - 1}<br />{memory(s.bytes)} / 卡</li>)}</ul></details> : '未计算')}</td>)}</tr>
          {visible.map(row => <tr key={row.label} className={`border-b border-line ${row.different ? 'bg-accent/5' : ''}`}><th className="p-3 font-normal text-secondary">{row.label}{row.different && <span className="block text-xs text-accent">有差异</span>}</th>{row.values.map((value,i) => <td key={items[i].id} className="p-3 text-secondary [overflow-wrap:anywhere]">{value.length > 150 ? <details><summary className="min-h-11 cursor-pointer text-accent">展开完整精度策略</summary><p className="mt-2 whitespace-pre-wrap break-all">{value}</p></details> : value}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
    {differencesOnly && !visible.length && <p className="mt-4 text-sm text-muted">配置相同，没有参数差异；方案名称与保存时间不影响计算。</p>}
    <p className="mt-4 break-all text-xs text-muted">当前计算指纹：{calculatorVersion}。本机方案选择不是跨设备分享链接，请导出 JSON 转移方案。</p>
  </section>
}
