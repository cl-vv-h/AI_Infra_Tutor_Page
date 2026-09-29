import { isParallelSize } from '../types/model.ts'

export const topologyVersion = 'communication-topology/1'
export type GroupKind = 'attention' | 'dense' | 'moe' | 'ep' | 'pp'
export type CollectiveMode = 'ring-allreduce' | 'tree-allreduce' | 'ring-allgather' | 'ring-reducescatter' | 'pairwise-alltoall' | 'pipeline'
export interface TopologyConfig {
  tp:number; ep:number; adp:number; pp:number; replicas:number; devices:number
  placement:'packed'|'striped'; rank:number; group:GroupKind; mode:CollectiveMode
  sizeKiB:number; localGBs:number; remoteGBs:number; nicGBs:number; localUs:number; remoteUs:number
}
export const defaultTopology:TopologyConfig = {
  tp:8,ep:4,adp:1,pp:2,replicas:1,devices:8,placement:'packed',rank:0,group:'dense',mode:'ring-allreduce',
  sizeKiB:1024,localGBs:300,remoteGBs:25,nicGBs:25,localUs:2,remoteUs:8,
}
export const topologyKeys=Object.keys(defaultTopology) as (keyof TopologyConfig)[]
export const groupNames:Record<GroupKind,string>={attention:'Attention TP',dense:'完整 TP（Dense）',moe:'专家内部 TP',ep:'EP 专家组',pp:'PP 流水线'}
export const modeNames:Record<CollectiveMode,string>={
  'ring-allreduce':'Ring All-Reduce','tree-allreduce':'Tree All-Reduce',
  'ring-allgather':'Ring All-Gather','ring-reducescatter':'Ring Reduce-Scatter',
  'pairwise-alltoall':'Pairwise All-to-All','pipeline':'PP 相邻阶段传递',
}
export const modesForGroup=(g:GroupKind):CollectiveMode[]=>g==='ep'?['pairwise-alltoall']:g==='pp'?['pipeline']:['ring-allreduce','tree-allreduce','ring-allgather','ring-reducescatter']
export const worldSize=(c:TopologyConfig)=>c.tp*c.pp*c.replicas
export function validateTopology(c:TopologyConfig){
  for(const key of ['tp','ep','adp','replicas','devices'] as const)if(!isParallelSize(c[key]))throw new Error(`${key} 必须为 1、2、4、8、16、32 或 64。`)
  if(!Number.isInteger(c.pp)||c.pp<1||c.pp>64)throw new Error('PP 必须为 1–64 的整数。')
  if(c.tp%c.ep||c.tp%c.adp)throw new Error('EP 与 Attention DP 都必须整除总 TP；它们不是额外的卡数乘数。')
  if(!Number.isInteger(c.rank)||c.rank<0||c.rank>=worldSize(c))throw new Error(`观察 rank 必须在 0–${worldSize(c)-1} 之间。`)
  if(!['packed','striped'].includes(c.placement))throw new Error('未知的 rank 放置规则。')
  if(!Object.prototype.hasOwnProperty.call(groupNames,c.group)||!modesForGroup(c.group).includes(c.mode))throw new Error('通信算法与所选逻辑组不匹配。')
  if(!Number.isInteger(c.sizeKiB)||c.sizeKiB<1||c.sizeKiB>1048576)throw new Error('逻辑缓冲区必须为 1–1048576 KiB 的整数。')
  for(const k of ['localGBs','remoteGBs','nicGBs'] as const)if(!Number.isFinite(c[k])||c[k]<.1||c[k]>2000)throw new Error(`${k} 必须在 0.1–2000 GB/s 之间。`)
  for(const k of ['localUs','remoteUs'] as const)if(!Number.isFinite(c[k])||c[k]<.01||c[k]>10000)throw new Error(`${k} 必须在 0.01–10000 µs 之间。`)
}
export function readTopologyQuery(search:string):TopologyConfig {
  const q=new URLSearchParams(search),c={...defaultTopology}
  for(const k of q.keys())if(!['v',...topologyKeys].includes(k)||q.getAll(k).length!==1)throw new Error('链接含未知或重复参数。')
  if(q.has('v')&&q.get('v')!=='1')throw new Error('不支持此拓扑参数版本。')
  for(const k of topologyKeys){const v=q.get(k);if(v===null)continue;if(typeof c[k]==='number'){if(!/^\d+(\.\d+)?$/.test(v))throw new Error(`${k} 不是有效数值。`);Object.assign(c,{[k]:Number(v)})}else Object.assign(c,{[k]:v})}
  validateTopology(c);return c
}
export function writeTopologyQuery(c:TopologyConfig){validateTopology(c);return new URLSearchParams([['v','1'],...topologyKeys.map(k=>[k,String(c[k])])]).toString()}

/** Matches the existing model-lab rank convention; EP and Attention DP are axes inside TP. */
export function logicalRank(c:TopologyConfig,rank:number){
  const t=rank%c.tp,stage=Math.floor(rank/c.tp)%c.pp,replica=Math.floor(rank/(c.tp*c.pp))
  return {rank,t,stage,replica,attentionGroup:Math.floor(t/(c.tp/c.adp)),attentionRank:t%(c.tp/c.adp),expertGroup:Math.floor(t/(c.tp/c.ep)),expertTpRank:t%(c.tp/c.ep)}
}
export function placeRank(c:TopologyConfig,rank:number){
  const hosts=Math.ceil(worldSize(c)/c.devices)
  return c.placement==='packed'?{host:Math.floor(rank/c.devices),slot:rank%c.devices}:{host:rank%hosts,slot:Math.floor(rank/hosts)}
}
export function groupMembers(c:TopologyConfig){
  validateTopology(c)
  const r=logicalRank(c,c.rank),start=(r.replica*c.pp+r.stage)*c.tp,atp=c.tp/c.adp,mtp=c.tp/c.ep
  const range=(n:number,f:(i:number)=>number)=>Array.from({length:n},(_,i)=>f(i))
  switch(c.group){
    case 'attention':return range(atp,i=>start+r.attentionGroup*atp+i)
    case 'dense':return range(c.tp,i=>start+i)
    case 'moe':return range(mtp,i=>start+r.expertGroup*mtp+i)
    case 'ep':return range(c.ep,i=>start+i*mtp+r.expertTpRank)
    case 'pp':return range(c.pp,i=>(r.replica*c.pp+i)*c.tp+r.t)
  }
}
export interface TopologyTransfer {
  from:number;to:number;chunk:number;targetChunk:number;bytes:number;mask:bigint;action:'sum'|'copy'
}
export interface RoundCost {durationUs:number;localBytes:number;remoteBytes:number;nicPeakBytes:number;limit:'local'|'rank-network'|'host-network'|'none'}
export interface TopologyRound extends RoundCost {label:string;phase:string;transfers:TopologyTransfer[]}

/** Full duplex, independent local/network paths, one shared NIC budget per host and direction.
 * Rounds are synchronous and non-overlapping. This is a model, not a performance lower bound.
 */
export function roundCost(c:TopologyConfig,members:number[],transfers:TopologyTransfer[]):RoundCost {
  const counters=new Map<string,number>()
  const add=(key:string,n:number)=>counters.set(key,(counters.get(key)||0)+n)
  let localBytes=0,remoteBytes=0
  for(const t of transfers){
    const a=placeRank(c,members[t.from]),b=placeRank(c,members[t.to]),remote=a.host!==b.host
    const kind=remote?'net':'local'
    add(`${kind}:tx:${t.from}`,t.bytes);add(`${kind}:rx:${t.to}`,t.bytes)
    if(remote){remoteBytes+=t.bytes;add(`host:tx:${a.host}`,t.bytes);add(`host:rx:${b.host}`,t.bytes)}else localBytes+=t.bytes
  }
  let durationUs=0,nicPeakBytes=0,limit:RoundCost['limit']='none'
  for(const [key,count] of counters){
    const kind=key.split(':')[0],bw=kind==='local'?c.localGBs:kind==='net'?c.remoteGBs:c.nicGBs
    const time=(kind==='local'?c.localUs:c.remoteUs)+count/(bw*1000)
    if(kind==='host')nicPeakBytes=Math.max(nicPeakBytes,count)
    // Report the shared-host limiter on equal network terms, without double counting them.
    if(time>=durationUs){durationUs=time;limit=kind==='local'?'local':kind==='net'?'rank-network':'host-network'}
  }
  return {durationUs,localBytes,remoteBytes,nicPeakBytes,limit}
}
export function applyTransfers(state:bigint[][],transfers:TopologyTransfer[]){
  const next=state.map(row=>[...row])
  for(const t of transfers)next[t.to][t.targetChunk]=t.action==='sum'?next[t.to][t.targetChunk]|t.mask:t.mask
  return next
}
export function simulateTopology(c:TopologyConfig){
  const members=groupMembers(c),n=members.length,size=c.sizeKiB*1024,one=(i:number)=>1n<<BigInt(i)
  const single=c.mode==='tree-allreduce'||c.mode==='pipeline'
  const initial=Array.from({length:n},(_,r)=>Array.from({length:single?1:n},(_,k)=>{
    if(c.mode==='pipeline')return r===0?one(0):0n
    if(c.mode==='ring-allgather'||c.mode==='pairwise-alltoall')return r===k?one(r):0n
    return one(r)
  }))
  let state=initial
  const rounds:TopologyRound[]=[]
  const transfer=(from:number,to:number,chunk:number,action:'sum'|'copy',bytes:number,targetChunk=chunk,mask=state[from][chunk]):TopologyTransfer=>({from,to,chunk,targetChunk,action,bytes,mask})
  const add=(label:string,phase:string,transfers:TopologyTransfer[])=>{rounds.push({label,phase,transfers,...roundCost(c,members,transfers)});state=applyTransfers(state,transfers)}
  if(c.mode==='tree-allreduce'){
    const levels:TopologyTransfer[][]=[]
    for(let d=1;d<n;d*=2){
      const messages:TopologyTransfer[]=[]
      for(let r=0;r<n;r+=2*d)if(r+d<n)messages.push(transfer(r+d,r,0,'sum',size))
      levels.push(messages);add(`归约 · 距离 ${d}`,'Reduce',messages)
    }
    for(let level=levels.length-1;level>=0;level--)add(`广播 · 距离 ${2**level}`,'Broadcast',levels[level].map(t=>transfer(t.to,t.from,0,'copy',size)))
  }else if(c.mode==='pairwise-alltoall'){
    for(let d=1;d<n;d++)add(`交换 · 偏移 ${d}`,'All-to-All',members.map((_,r)=>{
      const to=(r+d)%n
      // Immutable original input, not the progressively overwritten receive buffer.
      return transfer(r,to,to,'copy',size/n,r,one(r))
    }))
  }else if(c.mode==='pipeline'){
    for(let r=0;r<n-1;r++)add(`阶段 ${r} → ${r+1}`,'Send / Recv',[transfer(r,r+1,0,'copy',size)])
  }else{
    if(c.mode!=='ring-allgather')for(let step=0;step<n-1;step++)add(`归约分片 · ${step+1}/${n-1}`,'Reduce-Scatter',members.map((_,r)=>transfer(r,(r+1)%n,(r-1-step+2*n)%n,'sum',size/n)))
    if(c.mode!=='ring-reducescatter')for(let step=0;step<n-1;step++)add(`收集分片 · ${step+1}/${n-1}`,'All-Gather',members.map((_,r)=>transfer(r,(r+1)%n,(r-step+n)%n,'copy',size/n)))
  }
  const sent=Array(n).fill(0) as number[],received=Array(n).fill(0) as number[]
  const links=new Map<string,{from:number;to:number;bytes:number;messages:number;remote:boolean}>()
  for(const round of rounds)for(const t of round.transfers){
    sent[t.from]+=t.bytes;received[t.to]+=t.bytes
    const key=`${t.from}:${t.to}`,link=links.get(key)||{from:t.from,to:t.to,bytes:0,messages:0,remote:placeRank(c,members[t.from]).host!==placeRank(c,members[t.to]).host}
    link.bytes+=t.bytes;link.messages++;links.set(key,link)
  }
  return {members,initial,final:state,rounds,sent,received,links:[...links.values()],
    totalBytes:sent.reduce((a,b)=>a+b,0),remoteBytes:rounds.reduce((n,r)=>n+r.remoteBytes,0),
    durationUs:rounds.reduce((n,r)=>n+r.durationUs,0),hosts:new Set(members.map(r=>placeRank(c,r).host)).size,
  }
}
export type TopologySimulation=ReturnType<typeof simulateTopology>
export function snapshotTopology(result:TopologySimulation,completed:number){
  if(!Number.isInteger(completed)||completed<0||completed>result.rounds.length)throw new Error('无效的轮次位置。')
  return result.rounds.slice(0,completed).reduce((state,r)=>applyTransfers(state,r.transfers),result.initial)
}
export function contributors(mask:bigint,n:number){return Array.from({length:n},(_,i)=>i).filter(i=>(mask&(1n<<BigInt(i)))!==0n)}
export function witnessValue(c:TopologyConfig,mask:bigint,chunk:number,destination:number,n:number){
  const owners=contributors(mask,n)
  if(!owners.length)return null
  if(c.mode==='pairwise-alltoall')return 1000*(owners[0]+1)+destination+1
  if(c.mode==='pipeline')return 1
  if(c.mode==='ring-allgather')return chunk+1
  return owners.reduce((sum,r)=>sum+r+1,0)*(chunk+1)
}
