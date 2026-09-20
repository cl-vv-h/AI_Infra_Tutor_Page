import { v41RankFlow, v41Weights, v41WeightStorage } from '@/lib/deepseek-v41-reference'
import type { V41Scenario } from '@/lib/deepseek-v41-reference'
import { formatBytes } from '@/lib/model-lab'

export default function V41RankFlow({ state, onChange }: { state: V41Scenario; onChange: (next: Partial<V41Scenario>) => void }) {
  const flow = v41RankFlow(state)
  const weights = v41Weights(state.layer, state.world)
  const bits = state.weightMode === 'native' ? undefined : Number(state.weightMode) as 4 | 8 | 16 | 32
  const stages = flow[state.flow]
  return <section id="v41-rank-flow" tabIndex={-1} className="mt-5 scroll-mt-24 rounded-2xl border border-cyan-200/20 bg-[#0b141e] p-4 sm:p-6" aria-label="V4.1 逐 rank 张量流">
    <p className="font-mono text-xs tracking-widest text-cyan-200">RANK MICROSCOPE</p>
    <h2 className="mt-2 text-xl font-semibold">Rank {state.rank}：输入、分片、部分和与输出</h2>
    <p className="mt-3 text-sm leading-6 text-white/65">N = {flow.tokens.toLocaleString('en-US')}（{state.phase === 'prefill' ? '本次完整 Prefill 的 B×S' : 'Decode 的 B'}）。下列 Shape 将 B 与本次 query 长度合并为 N；历史 S 不等于本次 Decode 的 query 数。阶段快照包含并行支路，不表示串行调度或 GPU trace。</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="V4.1 当前副本 ranks">{flow.peers.map((rank) => <button key={rank} type="button" aria-pressed={state.rank === rank} onClick={() => onChange({ rank })} className={`min-h-11 rounded-lg border px-3 text-sm ${state.rank === rank ? 'border-cyan-200 bg-cyan-200/15 text-cyan-100' : 'border-white/15 text-white/65'}`}>Rank {rank}</button>)}</div>
    <p className="mt-3 text-sm leading-6 text-cyan-100">副本 {flow.replica} 内归约组：[{flow.peers.join(', ')}]；本地 Q heads {flow.headStart}–{flow.headEnd}；本地完整专家 {flow.expertStart}–{flow.expertEnd}。</p>
    <p className="mt-2 text-sm leading-6 text-white/60">独立副本之间没有这些归约；增加副本不改变本卡 Shape 或权重载荷，只增加不同请求。Top-6 下本卡 assignment 总数范围为 {flow.assignmentMin.toLocaleString('en-US')}–{flow.assignmentMax.toLocaleString('en-US')}；实际 T_e 未知，不能由平均值代替。</p>
    <label className="mt-4 block text-sm">观察支路<select aria-label="V4.1 张量流支路" value={state.flow} onChange={(e) => onChange({ flow: e.target.value as V41Scenario['flow'] })} className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#101e29] p-3 text-white"><option value="attention">Attention · Q / KV / 分组输出</option><option value="moe">MoE · routed 与 shared</option><option value="engram">Engram · 哈希表行分片</option></select></label>
    {state.flow === 'engram' && (flow.engramRows ? <p className="mt-3 text-sm leading-6 text-lime-100">本卡有效全局行 {flow.engramRows.start}–{flow.engramRows.end}；分配 {flow.engramRows.allocated} 行，其中 padding {flow.engramRows.padding} 行。最后一张卡的补齐行仍占存储，不是合法 hash ID。</p> : <div className="mt-4 rounded-xl border border-white/10 p-4 text-sm text-white/65">当前层没有 Engram。<div className="mt-3 flex gap-4">{[1, 14].map((layer) => <button type="button" key={layer} onClick={() => onChange({ layer })} className="min-h-11 text-lime-100 hover:underline">查看 Engram Layer {layer}</button>)}</div></div>)}
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{stages.map((stage) => {
      const selected = weights.filter((weight) => stage.weightNames.includes(weight.name))
      const bytes = selected.reduce((sum, weight) => sum + v41WeightStorage(weight, bits).bytes, 0)
      return <article key={stage.id} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-label={stage.title}>
        <h3 className="font-medium text-cyan-100">{stage.title}</h3>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-white/45">本卡输入</dt><dd className="mt-1 break-words font-mono text-white/90">[{stage.input.join(', ')}]</dd></div><div><dt className="text-white/45">本卡输出</dt><dd className="mt-1 break-words font-mono text-violet-100">[{stage.output.join(', ')}]</dd></div></dl>
        <p className="mt-3 text-sm leading-6 text-white/65">{stage.note}</p>
        {selected.length > 0 ? <details className="mt-3 border-t border-white/10 pt-3 text-xs"><summary className="cursor-pointer leading-6 text-violet-100">关联权重 · {formatBytes(bytes)} / rank{state.flow === 'moe' && stage.id.startsWith('expert-') ? ' · 全部本地专家合计' : ''}</summary><ul className="mt-2 list-none space-y-3 p-0">{selected.map((weight) => <li key={weight.name} className="break-words leading-6 text-white/65"><span className="block text-white/80">{weight.name}</span><span className="font-mono">[{weight.shape.join(', ')}] × {weight.copies} · {formatBytes(v41WeightStorage(weight, bits).bytes)}</span></li>)}</ul></details> : <p className="mt-3 text-xs text-white/45">无新增可学习权重；不代表没有临时激活或通信开销。</p>}
      </article>
    })}</div>
    <p className="mt-4 text-xs leading-6 text-white/50">关联权重沿用当前 {bits ? `${bits}-bit 理论` : '参考混合（含 scale）'} 口径，统计完整常驻本地专家，不只计被当前 token 激活的专家。不是运行时激活 dtype 或整卡显存估计。</p>
  </section>
}
