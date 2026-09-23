export type TaskKind = 'compute' | 'communication' | 'copy' | 'other'
export interface ProfileEvent {
  name: string; type: string; shape: string; dtype: string; format: string
  device: string; stream: string; step: string; duration: number; start?: number; kind: TaskKind
}
export interface ProfileData {
  events: ProfileEvent[]; warnings: string[]; source: 'csv' | 'trace'; skipped: number
}
export interface ProfileFilter { device: string; stream: string; step: string; from: string; to: string; search: string }
export interface ProfileGroup {
  key: string; type: string; names: string[]; shape: string; dtype: string; format: string; kind: TaskKind
  count: number; total: number; mean: number; median: number; p95: number; min: number; max: number
  share: number; exclusive: number | null; completeSignature: boolean; findings: string[]
}
export interface ProfileAnalysis {
  groups: ProfileGroup[]; count: number; total: number; timedCount: number; span: number | null
  busy: number | null; idle: number | null; overlap: number | null; communication: number | null
  computeCommunication: number | null; exposedCommunication: number | null; maxConcurrency: number | null
  origin: number; end: number; devices: string[]; streams: string[]; steps: string[]; warnings: string[]
  lanes: { stream: string; events: { start: number; duration: number; kind: TaskKind; name: string }[] }[]
  timelineTruncated: boolean; selectedDevice: string; selectedFilter: ProfileFilter
}
export const emptyProfileFilter = (): ProfileFilter => ({device:'',stream:'',step:'',from:'',to:'',search:''})
export const signature = (e: ProfileEvent) => JSON.stringify([e.type,e.shape,e.dtype,e.format])
const sum = (v:number[])=>v.reduce((a,b)=>a+b,0)
export function percentile(sorted:number[],q:number) {
  if (!sorted.length) return 0
  const p=(sorted.length-1)*q, low=Math.floor(p),high=Math.ceil(p)
  return sorted[low]+(sorted[high]-sorted[low])*(p-low)
}
// Sweep intervals, never subtract summed kernel durations from wall-clock span.
export function intervalCoverage(events:ProfileEvent[]) {
  const edges:{t:number; delta:number; key:string; kind:TaskKind}[]=[]
  for(const e of events) if(e.start!==undefined) {
    const key=signature(e)
    edges.push({t:e.start,delta:1,key,kind:e.kind},{t:e.start+e.duration,delta:-1,key,kind:e.kind})
  }
  edges.sort((a,b)=>a.t-b.t)
  const active=new Map<string,number>(), kinds={compute:0,communication:0,copy:0,other:0}
  const exclusive=new Map<string,number>()
  let previous=edges[0]?.t??0,busy=0,overlap=0,comm=0,computeComm=0,count=0,maxConcurrency=0
  for(let i=0;i<edges.length;) {
    const t=edges[i].t,dt=t-previous
    if(count>0)busy+=dt
    if(count>1)overlap+=dt
    if(kinds.communication>0)comm+=dt
    if(kinds.communication>0&&kinds.compute>0)computeComm+=dt
    if(active.size===1) {const k=active.keys().next().value!;exclusive.set(k,(exclusive.get(k)??0)+dt)}
    while(i<edges.length&&edges[i].t===t) {
      const e=edges[i++],n=(active.get(e.key)??0)+e.delta
      if(n===0)active.delete(e.key);else active.set(e.key,n)
      kinds[e.kind]+=e.delta;count+=e.delta
    }
    maxConcurrency=Math.max(maxConcurrency,count);previous=t
  }
  return {busy,overlap,comm,computeComm,exclusive,maxConcurrency}
}
export function analyzeProfile(data:ProfileData, filter=emptyProfileFilter()):ProfileAnalysis {
  const devices=[...new Set(data.events.map(e=>e.device))].sort()
  const selectedDevice=filter.device||devices[0]||''
  const domain=data.events.filter(e=>e.device===selectedDevice)
  const timedDomain=domain.filter(e=>e.start!==undefined)
  let origin=Infinity,end=0
  for(const e of timedDomain){origin=Math.min(origin,e.start!);end=Math.max(end,e.start!+e.duration)}
  if(!Number.isFinite(origin))origin=0
  const lower=filter.from.trim()?Number(filter.from):0,upper=filter.to.trim()?Number(filter.to):Infinity
  if(!Number.isFinite(lower)||lower<0||Number.isNaN(upper)||upper<=lower||(filter.to.trim()&&!Number.isFinite(upper)))throw new Error('时间窗口需要满足 0 ≤ 起点 < 终点，单位 µs。')
  const useWindow=Boolean(filter.from.trim()||filter.to.trim())
  const events=domain.filter(e=>(!filter.stream||e.stream===filter.stream)&&(!filter.step||e.step===filter.step)&&(!filter.search||`${e.name} ${e.type} ${e.shape}`.toLowerCase().includes(filter.search.toLowerCase()))&&(!useWindow||(e.start!==undefined&&e.start-origin>=lower&&e.start+e.duration-origin<=upper)))
  const streams=[...new Set(domain.map(e=>e.stream))].sort(),steps=[...new Set(domain.map(e=>e.step).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  const timed=events.filter(e=>e.start!==undefined)
  const completeTimeline=events.length>0&&timed.length===events.length
  const coverage=intervalCoverage(timed)
  let start=Infinity,finish=0
  for(const e of timed){start=Math.min(start,e.start!);finish=Math.max(finish,e.start!+e.duration)}
  const span=completeTimeline?finish-start:null
  const total=sum(events.map(e=>e.duration)),buckets=new Map<string,ProfileEvent[]>()
  for(const e of events){const k=signature(e);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k)!.push(e)}
  const groups:ProfileGroup[]=[]
  for(const [key,es] of buckets){
    const durations=es.map(e=>e.duration).sort((a,b)=>a-b),totalGroup=sum(durations),median=percentile(durations,.5),p95=percentile(durations,.95),first=es[0]
    const findings:string[]=[]
    if(es.length>=5&&p95>2*median)findings.push('P95 > 2×P50：检查动态 shape、争用、首次编译/冷缓存或采样混入不同阶段。')
    if(es.length>=20&&median<=10)findings.push('高频短任务：检查算子融合、调度粒度与图模式收益；不能把每次时长全部当成可消除开销。')
    if(first.kind==='communication')findings.push('通信任务：优先核对未被计算覆盖的时间及同步依赖，再判断通信是否限制端到端延迟。')
    const completeSignature=Boolean(first.shape&&first.dtype&&first.format)
    if(!completeSignature)findings.push('shape / dtype / format 不完整：分组可能混合不同工作量，不提供可靠的跨采样单次回归判定。')
    groups.push({key,type:first.type,names:[...new Set(es.map(e=>e.name))].slice(0,5),shape:first.shape,dtype:first.dtype,format:first.format,kind:first.kind,count:es.length,total:totalGroup,mean:totalGroup/es.length,median,p95,min:durations[0],max:durations[durations.length-1],share:total?totalGroup/total:0,exclusive:completeTimeline?(coverage.exclusive.get(key)??0):null,completeSignature,findings})
  }
  groups.sort((a,b)=>b.total-a.total)
  const warnings=[...data.warnings]
  if(devices.length>1)warnings.push('检测到多个设备/进程执行域；仅分析所选域，不混合未校时的跨设备时间戳。')
  if(!completeTimeline)warnings.push('部分或全部任务缺少设备时间戳；窗口、重叠和独占覆盖不可完整计算。')
  if(useWindow)warnings.push('时间过滤仅保留完整落在窗口内的调用，不裁切时长；跨边界调用被排除。')
  if(!events.length)warnings.push('当前筛选没有匹配任务。')
  if(!steps.length)warnings.push('无 Step ID；请手动用相对时间窗口选择稳态或单阶段，不能自动识别 prefill / decode。')
  const drawn=timed.slice().sort((a,b)=>a.start!-b.start!).slice(0,1200)
  const laneMap=new Map<string,ProfileAnalysis['lanes'][number]['events']>()
  for(const e of drawn){if(!laneMap.has(e.stream))laneMap.set(e.stream,[]);laneMap.get(e.stream)!.push({start:e.start!-origin,duration:e.duration,kind:e.kind,name:e.type})}
  return {groups,count:events.length,total,timedCount:timed.length,span,busy:completeTimeline?coverage.busy:null,idle:span===null?null:Math.max(0,span-coverage.busy),overlap:completeTimeline?coverage.overlap:null,communication:completeTimeline?coverage.comm:null,computeCommunication:completeTimeline?coverage.computeComm:null,exposedCommunication:completeTimeline?coverage.comm-coverage.computeComm:null,maxConcurrency:completeTimeline?coverage.maxConcurrency:null,origin,end:end-origin,devices,streams,steps,warnings,lanes:[...laneMap].map(([stream,events])=>({stream,events})),timelineTruncated:timed.length>drawn.length,selectedDevice,selectedFilter:{...filter,device:selectedDevice}}
}
export function compareProfiles(baseline:ProfileAnalysis,candidate:ProfileAnalysis) {
  const before=new Map(baseline.groups.map(g=>[g.key,g])),after=new Map(candidate.groups.map(g=>[g.key,g]))
  const rows=[...new Set([...before.keys(),...after.keys()])].map(key=>{
    const a=before.get(key),b=after.get(key),reliable=Boolean(a?.completeSignature&&b?.completeSignature)
    return {key,type:(a??b)!.type,shape:(a??b)!.shape,dtype:(a??b)!.dtype,format:(a??b)!.format,before:a,after:b,reliable,
      status:!a?'新增':!b?'消失':!reliable?'签名不完整':'可对照',
      medianRatio:a&&b&&reliable?b.median/a.median:null,
      normalizedDelta:a&&b&&reliable?(b.mean-a.mean)*a.count:null,
      observedDelta:(b?.total??0)-(a?.total??0)}
  }).sort((a,b)=>Math.abs(b.normalizedDelta??b.observedDelta)-Math.abs(a.normalizedDelta??a.observedDelta))
  return {rows,matched:rows.filter(r=>r.reliable).length,baselineCount:baseline.count,candidateCount:candidate.count,
    normalizedDelta:rows.reduce((n,r)=>n+(r.normalizedDelta??0),0)}
}
export function workWhatIf(analysis:ProfileAnalysis,key:string,speedup:number) {
  if(!Number.isFinite(speedup)||speedup<1||speedup>100)throw new Error('加速倍数必须在 1～100 之间。')
  const group=analysis.groups.find(g=>g.key===key)
  const saved=(group?.total??0)*(1-1/speedup)
  return {saved,remaining:analysis.total-saved,workSpeedup:analysis.total?analysis.total/(analysis.total-saved):1}
}
// Export deliberately excludes all user-controlled text, filenames, ranks, timestamps and tensor shapes.
export function anonymousProfileReport(a:ProfileAnalysis,b?:ProfileAnalysis) {
  const metrics=(x:ProfileAnalysis)=>({calls:x.count,workUs:x.total,spanUs:x.span,busyUs:x.busy,idleUs:x.idle,overlapUs:x.overlap,commUs:x.communication,commComputeOverlapUs:x.computeCommunication})
  return {schema:'anonymous-profile-report',version:1,note:'Observed device tasks, not an end-to-end critical path. Group names/shapes and raw data omitted.',baseline:metrics(a),candidate:b?metrics(b):undefined,
    groups:a.groups.map((g,i)=>({id:`G${i+1}`,calls:g.count,workUs:g.total,p50Us:g.median,p95Us:g.p95,exclusiveUs:g.exclusive})),
    comparison:b?compareProfiles(a,b).rows.map((r,i)=>({id:`C${i+1}`,matched:r.reliable,baselineCalls:r.before?.count??0,candidateCalls:r.after?.count??0,medianRatio:r.medianRatio,normalizedDeltaUs:r.normalizedDelta})):undefined}
}
