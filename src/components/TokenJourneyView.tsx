import { useState } from 'react'
import { journeySnapshot, type JourneyConfig, type JourneyEvent } from '@/lib/token-journey'

const tokenName=(i:number,c:JourneyConfig)=>i<c.prompt?`P${i+1}`:`G${i-c.prompt+1}`
const button='min-h-11 rounded-lg border px-2 py-2 text-xs'

/** A per-sequence view; batch multiplication belongs to byte/shape calculations. */
export default function TokenJourneyView({config:c,event:e}:{config:JourneyConfig;event:JourneyEvent}) {
  const [page,setPage]=useState(()=>Math.floor((e.newOutput?c.prompt+e.newOutput-1:e.inputStart)/16)),[operation,setOperation]=useState(0),[queryOffset,setQueryOffset]=useState(0)
  const snapshot=journeySnapshot(c,e),total=c.prompt+c.output,pages=Math.ceil(total/16)
  const first=page*16,indices=Array.from({length:Math.min(16,total-first)},(_,i)=>first+i)
  const cacheState=(i:number)=>{
    if(e.kind==='release')return i<e.retained?'保留前缀':'无引用'
    if(i>=e.kv)return '未写入'
    if(snapshot.forward&&i>=e.past)return '本轮写入'
    return i<c.prefix?'复用前缀':'已有 KV'
  }
  const color=(state:string)=>state==='本轮写入'?'border-emerald-300/60 bg-emerald-300/10 text-emerald-200':state.includes('前缀')?'border-sky-300/60 bg-sky-300/10 text-sky-200':state==='已有 KV'?'border-accent/60 bg-accent/10 text-accent':'border-line text-muted'
  const rows=snapshot.forward?Array.from({length:Math.min(8,e.input-queryOffset)},(_,i)=>e.past+queryOffset+i):[]
  const shapes=snapshot.shapes
  const operations=shapes?[
    ['Embedding / Norm',shapes.hidden,'将当前输入位置转为隐藏状态。此处 N = Batch × 本轮输入长度；不重复送入历史 Token。'],
    ['QKV / RoPE',shapes.q,`每 rank 的 Q 为该形状；新 K、V 各为 ${shapes.newKv}。位置编码遵循模型定义，历史 KV 复用。`],
    ['写入 KV → Attention',shapes.cache,`每层 K、V 各为该形状。当前 Q 读取历史及允许的当前位置；因果遮罩禁止读取未来位置。逻辑分数形状 ${shapes.scores} 不等于分配同尺寸的物理矩阵。`],
    ['Attention 输出归约',c.tp>1?`TP ${c.tp} · All-Reduce`:'TP 1 · 无组内归约','常规张量并行基线：O 投影产生的局部贡献在 TP 组内求和，恢复主干隐藏状态。'],
    ['Dense MLP',shapes.ffn,'显示 FFN 中间激活的每 rank 形状。不是专家路由，也不包含权重显存。'],
    ['MLP 输出归约',c.tp>1?`TP ${c.tp} · All-Reduce`:'TP 1 · 无组内归约','常规行并行 down 投影后求和。教学计数不包含词表、采样、融合或序列并行的通信变体。'],
    ['最终层 → Logits',shapes.logits,'完成全部 Decoder 层后，使用当前序列末位置产生下一 Token 的分布。显示逻辑完整词表，未模拟词表分片或采样通信。'],
  ]:[]
  return <div className="space-y-5">
    <section aria-label="输出与缓存位置" className="rounded-xl border border-line bg-field p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">输出与 KV · 单条请求视图</h3><span className="text-xs text-secondary">位置 {first+1}–{first+indices.length} / {total}</span></div>
      <p className="my-3 text-xs leading-5 text-secondary">P = 提示位置，G = 输出序号（不是实际文本）。每格下方同时代表该位置的 K 和 V；图示一条请求，字节统计包含整个 Batch。</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" data-testid="token-cells">
        {indices.map(i=>{
          const exists=i<c.prompt||i<c.prompt+e.generated,state=cacheState(i),justSampled=e.newOutput>0&&i===c.prompt+e.newOutput-1
          return <div key={i} className={`min-w-0 rounded-lg border p-2 ${color(state)}`} data-token={tokenName(i,c)} data-cache={state}>
            <p className={`font-mono text-sm ${justSampled?'text-amber-200':'text-ink'}`}>{tokenName(i,c)}</p>
            <p className="my-1 text-[11px] text-secondary">{i<c.prompt?'提示':exists?(justSampled?'刚采样':'已输出'):'待生成'}</p>
            <div key={`${e.id}-${state}`} className={`rounded border py-1 text-center text-xs ${state==='本轮写入'?'journey-kv-enter':''}`}>{state}</div>
          </div>
        })}
      </div>
      {pages>1&&<div className="mt-3 flex flex-wrap gap-2"><button className="button-secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>前 16 个位置</button><button className="button-secondary" disabled={page+1>=pages} onClick={()=>setPage(p=>p+1)}>后 16 个位置</button></div>}
      <p className="mt-3 text-xs leading-5 text-secondary">绿：本轮写入 · 紫：已有 KV · 蓝：复用／保留前缀 · 灰：未写入或引用已释放。停止后的最终输出仍然存在，但不会再为它执行 forward。</p>
    </section>
    {shapes?<>
      <section aria-label="当前 forward 内部路径"><h3 className="text-sm font-medium">放大当前 forward · 代表性 Decoder 层</h3><p className="my-2 text-xs leading-5 text-secondary">选择一个算子查看数据依赖。上方统计是整次 forward 完成后的快照，不随这里的算子选择变化。</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{operations.map(([name],i)=><button key={name} aria-pressed={operation===i} className={`${button} ${operation===i?'border-accent bg-accent/10 text-accent':'border-line text-secondary'}`} onClick={()=>setOperation(i)}>{i+1}. {name}</button>)}</div>
        <div className="mt-3 rounded-lg border border-line bg-raised p-4" aria-live="polite"><p className="text-sm">{operations[operation][0]}</p><p className="mt-2 break-words font-mono text-accent">{operations[operation][1]}</p><p className="mt-2 text-sm leading-6 text-secondary">{operations[operation][2]}</p></div>
      </section>
      <details className="rounded-lg border border-line p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm">因果 Attention · 哪些位置允许被读取？</summary>
        <p className="my-2 text-xs leading-5 text-secondary">单条请求、单个 Q head 的逻辑遮罩；✓ 可读，× 未来位置，— 尚无 KV。列跟随上方位置分页。只解释可见性，不显示实际 Attention 权重或物理显存布局。</p>
        <div role="region" aria-label="因果可见性矩阵" tabIndex={0} className="overflow-x-auto"><table className="text-center text-xs"><thead><tr><th className="min-w-20 p-2">Q ↓ / K →</th>{indices.map(i=><th key={i} className="min-w-11 p-2 font-mono font-normal">{tokenName(i,c)}</th>)}</tr></thead><tbody>{rows.map(q=><tr key={q}><th className="p-2 font-mono font-normal">{tokenName(q,c)}</th>{indices.map(k=><td key={k} className={`border border-line p-2 ${k<e.kv&&k<=q?'bg-accent/10 text-accent':'text-muted'}`} aria-label={`${tokenName(q,c)} 读取 ${tokenName(k,c)}：${k>=e.kv?'尚无 KV':k<=q?'允许':'禁止'}`}>{k>=e.kv?'—':k<=q?'✓':'×'}</td>)}</tr>)}</tbody></table></div>
        {e.input>8&&<div className="mt-3 flex flex-wrap gap-2"><button className="button-secondary" disabled={!queryOffset} onClick={()=>setQueryOffset(n=>Math.max(0,n-8))}>前 8 个 Q</button><button className="button-secondary" disabled={queryOffset+8>=e.input} onClick={()=>setQueryOffset(n=>n+8)}>后 8 个 Q</button></div>}
        <p className="mt-2 text-xs text-secondary">本轮全部 Batch、每 rank 所有 Q heads 的可读位置对：{snapshot.causalPairs.toLocaleString()}。这是逻辑计数，不是实测 FLOPs。</p>
      </details>
    </>:<p className="rounded-lg border border-line p-4 text-sm leading-6 text-secondary">{e.kind==='sample'?'此事件只有采样／输出；没有新 forward，因此不会为刚输出的 Token 新增 KV。':e.kind==='release'?'请求引用已释放。前缀保留量单独列出；引用清零不代表设备缓存池立刻归还内存。':'此事件不执行 Decoder forward。使用下一步或事件选择查看 Prefill / Decode 的张量变化。'}</p>}
  </div>
}
