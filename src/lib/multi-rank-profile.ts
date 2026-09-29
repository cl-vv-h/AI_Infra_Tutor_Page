import type { ProfileData, ProfileEvent } from './profile-analysis.ts'

export const rankLimits = { ranks: 64, events: 1000000, bytes: 256 * 1024 * 1024, bins: 96, candidates: 5000 }
export interface RankTrace { id: string; data: ProfileData; device: string; sourceIndex: number }
export interface RankSettings { id: string; label: string; included: boolean; offset: string; step: string; eventId: string }
export interface RankConfig {
  mode: 'relative' | 'clock'; clockConfirmed: boolean; workloadConfirmed: boolean
  pairingConfirmed: boolean; uncertainty: string; ranks: RankSettings[]
  window: { from: string; to: string }
}
export interface RankTask { id: string; name: string; stream: string; step: string; start: number; duration: number }
export interface RankInfo { id: string; device: string; sourceIndex: number; count: number; skipped: number; missing: number; steps: string[]; warnings: string[] }
type Interval = [number, number]
export interface RankMetrics {
  id: string; label: string; calls: number; missing: number; work: number
  span: number | null; start: number; end: number; execution: number; compute: number
  communication: number; wait: number; waitOutsideExecution: number; uncovered: number
  control: number; bins: { compute: number; communication: number; wait: number; other: number }[]
  candidates: RankTask[]; candidateCount: number; candidateTruncated: boolean
  selected?: RankTask; preceding: RankTask[]
}
export interface RankComparison {
  rows: RankMetrics[]; start: number; end: number; synchronized: boolean
  completionSpread: number | null; warnings: string[]
  pairing: { ready: boolean; reason: string; spread: number | null; latest: string[]; uncertainty: number | null; distinguishable: boolean; arrivals: { id: string; at: number; end: number; lead: number; waitBeforeLast: number }[] }
}

/** Exact unions, not summed task durations; nested and adjacent intervals are safe. */
export function mergeRankIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter(([a,b]) => b > a).sort((a,b) => a[0]-b[0] || a[1]-b[1])
  const out: Interval[] = []
  for (const [start,end] of sorted) {
    const previous=out.at(-1)
    if (previous && start <= previous[1]) previous[1]=Math.max(previous[1],end)
    else out.push([start,end])
  }
  return out
}
const measure=(xs:Interval[])=>xs.reduce((n,[a,b])=>n+b-a,0)
export function rankIntersection(a:Interval[],b:Interval[]):number {
  let i=0,j=0,total=0
  while(i<a.length&&j<b.length){total+=Math.max(0,Math.min(a[i][1],b[j][1])-Math.max(a[i][0],b[j][0]));if(a[i][1]<b[j][1])i++;else j++}
  return total
}
function bounds(events:ProfileEvent[]) {
  let start=Infinity,end=-Infinity
  for(const e of events)if(e.start!==undefined){start=Math.min(start,e.start);end=Math.max(end,e.start+e.duration)}
  return {start:Number.isFinite(start)?start:0,end:Number.isFinite(end)?end:0}
}
export function splitRankTraces(datasets:ProfileData[]):RankTrace[] {
  const ranks:RankTrace[]=[]
  let count=0
  datasets.forEach((data,sourceIndex)=>{
    count+=data.events.length
    const domains=new Map<string,ProfileEvent[]>()
    for(const event of data.events){const bucket=domains.get(event.device)??[];bucket.push(event);domains.set(event.device,bucket)}
    for(const [device,events] of domains)ranks.push({id:`r${ranks.length}`,sourceIndex,device,data:{...data,events,annotations:undefined,evidence:undefined}})
  })
  if(!ranks.length||ranks.length>rankLimits.ranks)throw new Error('联合分析支持 1–64 个执行域；每个设备/PID 单独保留，不自动合并。')
  if(count>rankLimits.events)throw new Error('联合分析最多 100 万条设备记录，请缩短采样窗口。')
  return ranks
}
export function rankInfo(traces:RankTrace[]):RankInfo[] {
  return traces.map(t=>({id:t.id,device:t.device,sourceIndex:t.sourceIndex,count:t.data.events.length,skipped:t.data.skipped,
    missing:t.data.events.filter(e=>e.start===undefined).length,steps:[...new Set(t.data.events.map(e=>e.step).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),warnings:t.data.warnings}))
}
export function defaultRankConfig(traces:RankTrace[]):RankConfig {
  return {mode:'relative',clockConfirmed:false,workloadConfirmed:false,pairingConfirmed:false,uncertainty:'',window:{from:'',to:''},
    ranks:traces.map((t,i)=>({id:t.id,label:String(i),included:true,offset:'0',step:'',eventId:''}))}
}
const numeric=(text:string,label:string,allowNegative=false)=>{
  if(!text.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()))throw new Error(`${label}需要明确的有限数值，单位 µs。`)
  const n=Number(text)
  if(!Number.isFinite(n)||Math.abs(n)>1e12||(!allowNegative&&n<0))throw new Error(`${label}超出范围。`)
  return n
}
function fractions(intervals:Interval[],start:number,end:number):number[] {
  const width=(end-start)/rankLimits.bins,values=Array<number>(rankLimits.bins).fill(0)
  if(width<=0)return values
  for(const [a,b] of intervals){
    const low=Math.max(0,Math.floor((a-start)/width)),high=Math.min(rankLimits.bins-1,Math.ceil((b-start)/width)-1)
    for(let i=low;i<=high;i++)values[i]+=Math.max(0,Math.min(b,start+(i+1)*width)-Math.max(a,start+i*width))/width
  }
  return values.map(v=>Math.min(1,Math.max(0,v)))
}
export function analyzeRanks(traces:RankTrace[],config:RankConfig):RankComparison {
  if(config.ranks.length!==traces.length||new Set(config.ranks.map(r=>r.id)).size!==traces.length||config.ranks.some(r=>!traces.some(t=>t.id===r.id)))throw new Error('执行域配置与已导入数据不一致，请重新导入。')
  const active=config.ranks.filter(r=>r.included)
  if(!active.length)throw new Error('至少选择一个执行域。')
  if(active.some(r=>!/^\d{1,6}$/.test(r.label))||new Set(active.map(r=>Number(r.label))).size!==active.length)throw new Error('Rank 编号需为 0–999999 的整数，且不能重复。')
  const synchronized=config.mode==='clock'&&config.clockConfirmed
  const warnings:string[]=[]
  if(config.mode==='clock'&&!config.clockConfirmed)warnings.push('尚未确认时钟：仍按各自起点归零展示，不比较跨 rank 先后。')
  if(!synchronized)warnings.push('形态对照不是同一真实时刻；不能据此判断哪个 rank 先到、谁在等谁。')
  if(!config.workloadConfirmed)warnings.push('尚未确认轮次、阶段、工作负载及参与者范围；不输出完成时差和通信配对结论。')
  if(config.window.from.trim()||config.window.to.trim())warnings.push('自定义窗口会裁切任务边界；不以裁切后的末尾计算记录完成时差。')
  const base=Math.min(...traces.filter(t=>active.some(r=>r.id===t.id)).map(t=>t.data.clockBaseUs??0))
  const mapped=active.map(setting=>{
    const t=traces.find(t=>t.id===setting.id)!,origin=bounds(t.data.events).start
    const correction=config.mode==='clock'?numeric(setting.offset,`Rank ${setting.label} 校时偏移`,true):0
    // Difference integral bases BEFORE adding fractional timestamps.
    const shift=synchronized?(t.data.clockBaseUs??0)-base+correction:-origin
    if(setting.step&&!t.data.events.some(e=>e.step===setting.step))throw new Error(`Rank ${setting.label} 没有该 Step，请选择已有值。`)
    const events=t.data.events.map((e,i)=>({...e,id:String(i),start:e.start===undefined?undefined:e.start+shift})).filter(e=>!setting.step||e.step===setting.step)
    return {setting,t,events}
  })
  let globalStart=Infinity,globalEnd=-Infinity
  for(const m of mapped){const b=bounds(m.events);if(m.events.some(e=>e.start!==undefined)){globalStart=Math.min(globalStart,b.start);globalEnd=Math.max(globalEnd,b.end)}}
  if(!Number.isFinite(globalStart)||globalEnd<=globalStart)throw new Error('联合时间线需要至少一条有 Start Time 的设备记录；仅有耗时的文件请使用单份分析。')
  if(globalEnd-globalStart>1e12)throw new Error('执行域的时间基准相差过大；请核对单位、是否同次采样及校时偏移。')
  const fullStart=globalStart
  if(config.window.from.trim())globalStart=fullStart+numeric(config.window.from,'窗口起点')
  if(config.window.to.trim())globalEnd=fullStart+numeric(config.window.to,'窗口终点')
  if(globalEnd<=globalStart)throw new Error('观察窗口需要满足起点 < 终点。')
  const waitById=new Map<string,Interval[]>()
  const rows:RankMetrics[]=mapped.map(({setting,t,events})=>{
    const timed=events.filter(e=>e.start!==undefined&&e.start<globalEnd&&e.start+e.duration>globalStart)
    const missing=events.filter(e=>e.start===undefined).length
    const clip=(e:ProfileEvent):Interval=>[Math.max(globalStart,e.start!),Math.min(globalEnd,e.start!+e.duration)]
    const isExecution=(e:ProfileEvent)=>!e.role||e.role==='execution'
    const intervals=(predicate:(e:ProfileEvent)=>boolean)=>mergeRankIntervals(timed.filter(predicate).map(clip))
    const execution=intervals(isExecution),compute=intervals(e=>isExecution(e)&&e.kind==='compute'),communication=intervals(e=>isExecution(e)&&e.kind==='communication'),wait=intervals(e=>e.role==='wait'),other=intervals(e=>isExecution(e)&&(e.kind==='other'||e.kind==='copy'))
    const all=mergeRankIntervals([...execution,...wait, ...intervals(e=>e.role==='control')])
    waitById.set(t.id,wait)
    const start=all[0]?.[0]??globalStart,end=all.at(-1)?.[1]??globalStart
    const values=[compute,communication,wait,other].map(xs=>fractions(xs,globalStart,globalEnd))
    const candidates=events.filter(e=>e.start!==undefined&&e.kind==='communication'&&isExecution(e)&&e.start<globalEnd&&e.start+e.duration>globalStart).sort((a,b)=>a.start!-b.start!)
    const task=(e:typeof events[number]):RankTask=>({id:e.id,name:e.name,stream:e.stream,step:e.step,start:e.start!,duration:e.duration})
    const selected=candidates.find(e=>e.id===setting.eventId)
    const preceding=selected?events.filter(e=>e.start!==undefined&&isExecution(e)&&e.kind==='compute'&&e.start<selected.start!).sort((a,b)=>(b.start!+b.duration)-(a.start!+a.duration)).slice(0,5).map(task):[]
    if(missing)warnings.push(`Rank ${setting.label} 有 ${missing} 条记录缺少起始时间：图表与覆盖仅表示已计时子集，完整窗口和完成时差不可用。`)
    if(t.data.skipped)warnings.push(`Rank ${setting.label} 所属文件有 ${t.data.skipped} 条无效记录被原解析器跳过；请核对完整性。`)
    return {id:t.id,label:setting.label,calls:timed.filter(isExecution).length,missing,work:timed.filter(isExecution).reduce((n,e)=>n+clip(e)[1]-clip(e)[0],0),span:missing||!all.length?null:end-start,start,end,
      execution:measure(execution),compute:measure(compute),communication:measure(communication),wait:measure(wait),waitOutsideExecution:measure(wait)-rankIntersection(wait,execution),uncovered:globalEnd-globalStart-measure(all),control:timed.filter(e=>e.role==='control').length,
      bins:values[0].map((compute,i)=>({compute,communication:values[1][i],wait:values[2][i],other:values[3][i]})),
      candidates:candidates.slice(0,rankLimits.candidates).map(task),candidateCount:candidates.length,candidateTruncated:candidates.length>rankLimits.candidates,selected:selected?task(selected):undefined,preceding}
  })
  const uncertainty=config.uncertainty.trim()?numeric(config.uncertainty,'单 rank 最大校时误差'):null
  let reason=''
  if(rows.length<2)reason='至少需要两个参与 rank。'
  else if(!synchronized)reason='先确认共享时钟或已知校时偏移。'
  else if(!config.workloadConfirmed)reason='先确认同一轮次、阶段、工作负载与参与者范围。'
  else if(!rows.every(r=>r.selected))reason='为每个参与 rank 选择同一通信实例对应的设备事件。'
  else if(!config.pairingConfirmed)reason='请核对通信组、轮次及任务粒度后确认人工配对。'
  else if(rows.some(r=>r.selected!.start<globalStart||r.selected!.start+r.selected!.duration>globalEnd))reason='所选通信事件跨出观察窗口；恢复完整范围后再比较。'
  const selected=rows.map(r=>r.selected),latest=reason?0:Math.max(...selected.map(t=>t!.start)),earliest=reason?0:Math.min(...selected.map(t=>t!.start))
  const ready=!reason,spread=ready?latest-earliest:null
  const complete=rows.every(r=>r.span!==null&&r.calls>0)&&mapped.every(m=>m.t.data.skipped===0)
  return {rows,start:globalStart,end:globalEnd,synchronized,warnings,
    completionSpread:synchronized&&config.workloadConfirmed&&complete&&rows.length>1&&!config.window.from.trim()&&!config.window.to.trim()?Math.max(...rows.map(r=>r.end))-Math.min(...rows.map(r=>r.end)):null,
    pairing:{ready,reason,spread,latest:ready?rows.filter(r=>r.selected!.start===latest).map(r=>r.id):[],uncertainty,
      distinguishable:ready&&uncertainty!==null&&spread!>2*uncertainty,
      arrivals:ready?rows.map(r=>({id:r.id,at:r.selected!.start,end:r.selected!.start+r.selected!.duration,lead:latest-r.selected!.start,waitBeforeLast:rankIntersection(waitById.get(r.id)!,[[r.selected!.start,Math.min(latest,r.selected!.start+r.selected!.duration)]])})):[]}}
}

/** Numeric whitelist only: no labels, source filenames, timestamps, event names or offsets. */
export function anonymousRankReport(result:RankComparison) {
  return {schema:'anonymous-multi-rank-profile',version:1,synchronizedByUser:result.synchronized,note:'Observed records only. Manual pairing is not a proven causal dependency.',
    windowSpanUs:result.end-result.start,completionSpreadUs:result.completionSpread,
    ranks:result.rows.map((r,i)=>({id:`R${i+1}`,calls:r.calls,missing:r.missing,workUs:r.work,executionCoverageUs:r.execution,computeCoverageUs:r.compute,communicationCoverageUs:r.communication,waitCoverageUs:r.wait,waitOutsideExecutionUs:r.waitOutsideExecution,uncoveredUs:r.uncovered})),
    pairedCommunication:result.pairing.ready?{entrySpreadUs:result.pairing.spread,uncertaintyUs:result.pairing.uncertainty,distinguishable:result.pairing.distinguishable,participants:result.pairing.arrivals.map((r,i)=>({id:`R${i+1}`,entryLeadUs:r.lead,waitBeforeLastEntryUs:r.waitBeforeLast}))}:null}
}
