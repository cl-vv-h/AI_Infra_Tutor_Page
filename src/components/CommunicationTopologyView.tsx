import { useMemo, useState } from 'react'
import { contributors, placeRank, snapshotTopology, witnessValue, type TopologyConfig, type TopologySimulation } from '@/lib/communication-topology'

export default function CommunicationTopologyView({config:c,result:r,position}:{config:TopologyConfig;result:TopologySimulation;position:number}) {
  const [hostPage,setHostPage]=useState(()=>Math.floor([...new Set(r.members.map(rank=>placeRank(c,rank).host))].sort((a,b)=>a-b).indexOf(placeRank(c,c.rank).host)/4)),[focus,setFocus]=useState(()=>r.members.indexOf(c.rank)),[chunk,setChunk]=useState(0),[messageIndex,setMessageIndex]=useState(0)
  const completed=Math.floor(position),moving=position-completed>0,roundIndex=moving?completed:Math.max(0,completed-1)
  const round=r.rounds[roundIndex],progress=moving?position-completed:completed?1:0
  const state=useMemo(()=>snapshotTopology(r,completed),[r,completed])
  const hosts=useMemo(()=>{
    const map=new Map<number,number[]>()
    r.members.forEach((rank,i)=>{const host=placeRank(c,rank).host;map.set(host,[...(map.get(host)||[]),i])})
    return [...map.entries()].sort((a,b)=>a[0]-b[0])
  },[c,r])
  const message=round?.transfers[Math.min(messageIndex,round.transfers.length-1)]
  const from=message?placeRank(c,r.members[message.from]):null,to=message?placeRank(c,r.members[message.to]):null
  const local=from?.host===to?.host,mask=state[focus][chunk],owners=contributors(mask,r.members.length)
  const value=witnessValue(c,mask,chunk,focus,r.members.length)
  const final=completed===r.rounds.length,outputValid=c.mode!=='ring-reducescatter'||chunk===focus
  return <div className="space-y-4">
    <section className="rounded-xl border border-line bg-field p-3 sm:p-4" aria-label="物理主机与逻辑组">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">物理放置 · 本组 {r.members.length} 个 rank / {hosts.length} 台主机</h3><span className="text-xs text-secondary">仅显示本组参与者</span></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{hosts.slice(hostPage*4,hostPage*4+4).map(([host,indices])=><div key={host} className="rounded-lg border border-line p-3">
        <p className="mb-2 text-xs text-secondary">Host {host} · 本组 {indices.length} / 设备容量 {c.devices}</p>
        <div className="grid grid-cols-2 gap-2">{indices.slice(0,8).map(i=><button key={i} className={`min-h-11 rounded-lg border px-2 py-1 text-left text-xs ${focus===i?'border-accent bg-accent/10 text-accent':'border-line text-secondary'}`} aria-pressed={focus===i} onClick={()=>{setFocus(i);if(c.mode==='ring-reducescatter')setChunk(i)}}><span className="block font-mono">R{r.members[i]}</span><span>槽位 {placeRank(c,r.members[i]).slot} · 组序 {i}</span></button>)}</div>
        {indices.length>8&&<details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-xs">本机其余 {indices.length-8} 个参与者</summary><div className="grid grid-cols-2 gap-2">{indices.slice(8).map(i=><button key={i} className={`min-h-11 rounded-lg border px-2 text-xs ${focus===i?'border-accent text-accent':'border-line text-secondary'}`} aria-pressed={focus===i} onClick={()=>{setFocus(i);if(c.mode==='ring-reducescatter')setChunk(i)}}>R{r.members[i]} · 槽位 {placeRank(c,r.members[i]).slot}</button>)}</div></details>}
      </div>)}</div>
      {hosts.length>4&&<div className="mt-3 flex flex-wrap items-center gap-2"><button className="button-secondary" disabled={!hostPage} onClick={()=>setHostPage(n=>n-1)}>上一组主机</button><button className="button-secondary" disabled={(hostPage+1)*4>=hosts.length} onClick={()=>setHostPage(n=>n+1)}>下一组主机</button><span className="text-xs text-secondary">{hostPage+1} / {Math.ceil(hosts.length/4)}</span></div>}
      <p className="mt-3 text-xs leading-5 text-secondary">rank 是逻辑编号，槽位是教学放置编号，不是实际 PCIe 地址。点击参与者只切换数值观察，不改变通信组。</p>
    </section>
    {message&&from&&to?<section aria-label="当前轮消息路径" className="rounded-xl border border-line p-3 sm:p-4">
      <label className="text-xs text-secondary">观察本轮消息<select aria-label="观察本轮消息" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-field px-2 text-sm" value={Math.min(messageIndex,round.transfers.length-1)} onChange={e=>setMessageIndex(Number(e.target.value))}>{round.transfers.map((m,i)=><option key={i} value={i}>R{r.members[m.from]} → R{r.members[m.to]} · 分片 {m.chunk}{m.targetChunk!==m.chunk?` → 接收槽 ${m.targetChunk}`:''}</option>)}</select></label>
      <div className="my-4 grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-1" role="img" aria-label={`R${r.members[message.from]} Host ${from.host} 到 R${r.members[message.to]} Host ${to.host}，${local?'机内':'跨机'}，${Math.round(progress*100)}% 示意进度`}>
        <div className="min-w-0 rounded-lg border border-line bg-raised p-2 text-center"><p className="break-words font-mono text-sm">R{r.members[message.from]}</p><p className="mt-1 text-xs text-secondary">Host {from.host}</p></div>
        <svg viewBox="0 0 100 48" className={local?'text-accent':'text-amber-200'} aria-hidden="true"><path d="M8 24H90M80 16l10 8-10 8" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx={8+progress*80} cy="24" r="5" fill="currentColor"/></svg>
        <div className="min-w-0 rounded-lg border border-line bg-raised p-2 text-center"><p className="break-words font-mono text-sm">R{r.members[message.to]}</p><p className="mt-1 text-xs text-secondary">Host {to.host}</p></div>
      </div>
      <p className={`text-sm ${local?'text-accent':'text-amber-200'}`} data-testid="message-scope">{local?'机内消息':'跨机消息'} · {(message.bytes/1024).toLocaleString()} KiB · {message.action==='sum'?'接收端累加':'接收端复制'}</p>
      <p className="mt-2 text-xs leading-5 text-secondary">该消息携带来自组序 {contributors(message.mask,r.members.length).join('、')} 的贡献。线条表示一个逻辑消息；动画进度不是传输耗时，不模拟包、路由跳数或 NIC 内部流水。</p>
    </section>:<p className="rounded-lg border border-line p-4 text-sm text-secondary">组内仅一个参与者，无需传输，也不会虚构启动延迟。</p>}
    <details className="rounded-xl border border-line p-3 sm:p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">数值与分片归属 · 校验通信完成了什么</summary>
      <div className="mt-2 grid grid-cols-2 gap-3"><label className="text-xs text-secondary">接收 rank<select aria-label="接收 rank" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-field px-2" value={focus} onChange={e=>{const i=Number(e.target.value);setFocus(i);if(c.mode==='ring-reducescatter')setChunk(i)}}>{r.members.map((rank,i)=><option key={rank} value={i}>R{rank} · 组序 {i}</option>)}</select></label><label className="text-xs text-secondary">观察分片<select aria-label="观察分片" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-field px-2" value={chunk} onChange={e=>setChunk(Number(e.target.value))}>{state[focus].map((_,i)=><option key={i} value={i}>{c.mode==='tree-allreduce'?'完整缓冲区示例元素':c.mode==='pipeline'?'激活标记':`分片 ${i}`}</option>)}</select></label></div>
      <div className="mt-3 rounded-lg border border-line bg-field p-3"><p className="text-xs text-secondary">已完成 {completed} 轮后的状态（不包含正在传输的消息）</p><p className="mt-2 text-lg text-accent" data-testid="witness-value">{value===null?'尚未收到':value}</p><p className="mt-2 break-words text-xs leading-5 text-secondary" data-testid="witness-contributors">来源组序：{owners.length?owners.join('、'):'无'}</p><p className="mt-2 text-xs" data-testid="witness-status">{final?(outputValid?'此位置为完成后的输出':'此位置不是 Reduce-Scatter 的输出，仅为工作区残留'):'中间工作状态，不代表最终输出'}</p></div>
      <p className="mt-3 text-xs leading-5 text-secondary">{c.mode==='pairwise-alltoall'?'输入示例值 = 1000 × (源组序 + 1) + (目标组序 + 1)。接收缓冲区按源组序排列；本地那一块不计网络发送。':c.mode==='pipeline'?'激活用常量 1 标记，仅跟踪相邻阶段传递；真实阶段计算会改变激活，本演示不执行它。':c.mode==='ring-allgather'?'初始分片 k 的示例值为 k+1，完成后每个 rank 都按组序持有全部分片；不是求和。':'组序 j 的分片 k 示例值 = (j+1) × (k+1)。归约取求和；Tree 展示完整缓冲区中的第一个示例元素。Reduce-Scatter 最终只输出与接收组序相同的分片。'}</p>
    </details>
  </div>
}
