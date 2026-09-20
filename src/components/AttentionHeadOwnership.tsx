import type { attentionHeadRanks } from '@/lib/attention-heads'
import { attentionHeadSource } from '@/lib/attention-heads'

const range = (start: number, end: number) => end === start + 1 ? String(start) : `${start}–${end - 1}`

export default function AttentionHeadOwnership({ ranks, rank }: { ranks: NonNullable<ReturnType<typeof attentionHeadRanks>>; rank: number }) {
  const current = ranks[rank] ?? ranks[0]
  return <details aria-label="Attention head 归属" className="mt-3 rounded-xl border border-cyan-200/20 p-3 text-sm leading-6 text-white/70">
    <summary className="cursor-pointer text-cyan-100">Q heads {range(current.qStart, current.qEnd)} · K/V heads {range(current.kvStart, current.kvEnd)} · 展开分片归属</summary>
    <p className="mt-3 text-xs leading-5">以下只列 DP 副本 {current.replica}；head ID 从 0 开始。Q 分片互不重叠，K/V {current.kvCopies > 1 ? `每个 head 在 ${current.kvCopies} 个 TP rank 复制` : '在当前 TP 组内不复制'}。独立 DP 的同坐标权重相同，但处理不同请求，激活与缓存值通常不同。</p>
    <table className="mt-3 w-full table-fixed text-left text-xs leading-5"><caption className="sr-only">当前独立副本的 Attention head 分片</caption><thead className="text-white/55"><tr><th scope="col">Rank</th><th scope="col">Q heads</th><th scope="col">K/V heads</th><th scope="col">同 K/V ranks</th></tr></thead><tbody>{ranks.filter(r => r.replica === current.replica).map(r => <tr key={r.rank} aria-label={`Attention Rank ${r.rank}`} aria-current={r.rank === current.rank ? 'true' : undefined} className={`border-t border-white/10 ${r.rank === current.rank ? 'bg-cyan-200/10 text-cyan-100' : ''}`}><th scope="row" className="py-2 font-normal">R{r.rank}</th><td>{range(r.qStart, r.qEnd)}</td><td>{range(r.kvStart, r.kvEnd)}</td><td className="break-words">{r.kvPeers.map(peer => `R${peer}`).join(' / ')}</td></tr>)}</tbody></table>
    <p className="mt-3 break-words font-mono text-xs">逻辑 Q 投影行 / O 投影列：[{current.qRows.join(', ')})<br />各 K / V 投影行：[{current.kvRows.join(', ')})</p>
    <p className="mt-2 text-xs leading-5">矩阵区间右端不包含；指单独逻辑投影，不是融合 QKV 的物理偏移或量化容器轴。同一 TP 组共享输入 token；O 的本地部分和仍需归约。EP 不改变这些 Attention 分片，不能用 MoE-TP 再除一次。此表不推断其他后端、DPA、QKV 全量汇集或特殊 KV TP 的归属。</p>
    <a className="mt-3 inline-block text-xs text-cyan-100 hover:underline" href={attentionHeadSource} target="_blank" rel="noreferrer">核对 SGLang Q/K/V shard ID 与复制规则 ↗</a>
  </details>
}
