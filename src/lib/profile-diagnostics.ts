import { intervalCoverage, percentile, signature } from './profile-analysis.ts'
import type { ProfileData, ProfileEvent } from './profile-analysis.ts'

export const pipeMetrics = ['cube', 'vector', 'aicMte2', 'aivMte2', 'aicScalar', 'aivScalar'] as const
export type PipeMetric = typeof pipeMetrics[number]
export const pipeLabels: Record<PipeMetric, string> = { cube: 'Cube / MAC', vector: 'Vector', aicMte2: 'AIC MTE2', aivMte2: 'AIV MTE2', aicScalar: 'AIC Scalar', aivScalar: 'AIV Scalar' }
export type Phase = 'prefill' | 'decode'
export type PhaseBucket = Phase | 'conflict' | 'unassigned'
export interface Counter { value: number; percent: boolean }
export interface Annotation { name: string; source: string; start: number; duration: number }
export interface ManualPhase { phase: Phase; from: number; to: number }
export interface DiagnosticConfig {
  ratioUnit: 'auto' | 'fraction' | 'percent'
  metric: 'auto' | PipeMetric
  threshold: number
  hostSource: string
  aligned: boolean
  prefillName: string
  decodeName: string
  scheduleName: string
  manual: ManualPhase[]
}
export const defaultDiagnosticConfig = (): DiagnosticConfig => ({ ratioUnit: 'auto', metric: 'auto', threshold: 30, hostSource: '', aligned: false, prefillName: '', decodeName: '', scheduleName: '', manual: [] })
type Range = { start: number; end: number }
type Band = Range & { phase: PhaseBucket }
export function mergeRanges(ranges: Range[]): Range[] {
  const out: Range[] = []
  for (const r of ranges.slice().sort((a,b)=>a.start-b.start || a.end-b.end)) {
    if (r.end <= r.start) continue
    const last = out.at(-1)
    if (last && r.start <= last.end) last.end = Math.max(last.end,r.end)
    else out.push({...r})
  }
  return out
}
const length = (ranges: Range[]) => ranges.reduce((s,r)=>s+r.end-r.start,0)
function intersections(a: Range[], b: Range[]): Range[] {
  const out: Range[] = []; let i=0,j=0
  while(i<a.length && j<b.length) {
    const start=Math.max(a[i].start,b[j].start),end=Math.min(a[i].end,b[j].end)
    if(end>start)out.push({start,end})
    if(a[i].end<b[j].end)i++;else j++
  }
  return out
}
function complement(covered: Range[], start: number, end: number) {
  const out: Range[]=[]; let cursor=start
  for(const r of covered) { if(r.start>cursor)out.push({start:cursor,end:Math.min(r.start,end)});cursor=Math.max(cursor,r.end) }
  if(cursor<end)out.push({start:cursor,end})
  return out.filter(r=>r.end>r.start)
}
export function annotationKind(name: string): Phase | 'schedule' | undefined {
  // Only explicit stage/scheduler labels, never kernel names or the first Step.
  const n=name.toLowerCase().replace(/[:/ .-]+/g,'_')
  if (/^(?:model_)?(?:forward_)?prefill(?:_step)?$/.test(n)) return 'prefill'
  if (/^(?:model_)?(?:forward_)?decode(?:_step)?$/.test(n)) return 'decode'
  if (/^(?:scheduler|schedule|schedule_batch|get_next_batch_to_run)$/.test(n)) return 'schedule'
}
export interface PhaseSummary {
  phase: PhaseBucket; work: number; wall: number | null; busy: number | null; uncovered: number | null
  schedule: number | null; calls: number; clipped: number
  groups: { key: string; type: string; shape: string; work: number; share: number; calls: number }[]
}
export interface DiagnosticAnalysis {
  config: DiagnosticConfig
  sources: { id: string; names: string[]; count: number }[]
  phases: PhaseSummary[]; phaseBasis: 'manual' | 'annotations' | 'task-labels' | 'none'
  iterations: { count: number; p50: number | null; p95: number | null; max: number | null; rows: { start: number; duration: number; outlier: boolean }[]; truncated: boolean }
  scheduling: { recorded: number | null; betweenPhases: number | null; phaseGap: number | null; unrecordedGap: number | null }
  gaps: { total: number | null; count: number; rows: { start: number; duration: number; schedule: number | null }[] }
  utilization: { key: string; type: string; shape: string; metric: PipeMetric; mean: number | null; samples: number; calls: number; measuredWork: number; totalWork: number; lowWork: number; lowCalls: number }[]
  counterCalls: number; warnings: string[]
}
export function diagnoseProfile(data: ProfileData, events: ProfileEvent[], origin: number, domainEnd: number, selectedDevice: string, config = defaultDiagnosticConfig()): DiagnosticAnalysis {
  if(!Number.isFinite(config.threshold)||config.threshold<0||config.threshold>100)throw new Error('低活跃阈值须为 0–100%。')
  if(config.manual.length>1000)throw new Error('最多支持 1000 个手动阶段区间。')
  const mapped=[config.prefillName,config.decodeName,config.scheduleName].filter(Boolean)
  if(new Set(mapped).size!==mapped.length)throw new Error('Prefill、Decode 和调度不能映射为同一个事件名称。')
  const warnings: string[]=[]
  const sourcesMap=new Map<string,{id:string;names:Set<string>;count:number}>()
  for(const a of data.annotations??[]) {
    if(!sourcesMap.has(a.source))sourcesMap.set(a.source,{id:a.source,names:new Set(),count:0})
    const s=sourcesMap.get(a.source)!;s.names.add(a.name);s.count++
  }
  const sources=[...sourcesMap.values()].map(s=>({id:s.id,names:[...s.names].sort(),count:s.count}))
  const host=(data.annotations??[]).filter(a=>config.aligned && a.source===config.hostSource)
  const kind=(a:Annotation)=>{
    if(a.name===config.prefillName)return 'prefill'
    if(a.name===config.decodeName)return 'decode'
    if(a.name===config.scheduleName)return 'schedule'
    const k=annotationKind(a.name)
    return k && !config[`${k}Name`] ? k : undefined
  }
  const manual=config.manual.map(r=> {
    if(!['prefill','decode'].includes(r.phase)||!Number.isFinite(r.from)||!Number.isFinite(r.to)||r.from<0||r.to<=r.from||r.to>domainEnd-origin)throw new Error('手动阶段需要 0 ≤ 起点 < 终点 ≤ 设备时间范围，单位 µs。')
    return {start:origin+r.from,end:origin+r.to,phase:r.phase}
  })
  let windows: (Range & {phase:Phase})[]=manual
  let phaseBasis: DiagnosticAnalysis['phaseBasis']=manual.length?'manual':'none'
  if(!manual.length && host.length) {
    windows=host.flatMap(a=>{const k=kind(a);return k==='prefill'||k==='decode'?[{start:a.start,end:a.start+a.duration,phase:k}]:[]})
    if(windows.length)phaseBasis='annotations'
  }
  const taskLabels = !windows.length && events.some(e=>e.phase)
  if(taskLabels) {
    phaseBasis='task-labels'
    const envelopes=new Map<string,Range & {phase:Phase}>()
    for(const e of events)if(e.phase&&e.start!==undefined) {
      const k=JSON.stringify([e.phase,e.step]),old=envelopes.get(k)
      if(old){old.start=Math.min(old.start,e.start);old.end=Math.max(old.end,e.start+e.duration)}
      else envelopes.set(k,{start:e.start,end:e.start+e.duration,phase:e.phase})
    }
    windows=[...envelopes.values()]
    warnings.push('CSV / 设备任务 Phase 标签按 Phase + Step 构造任务包络；不是完整前向时延。无 Step 的 Decode 不计算逐步分位数。')
  }
  const timed=events.filter(e=>e.start!==undefined)
  const complete=events.length>0&&timed.length===events.length
  let start=Infinity,end=-Infinity
  for(const e of timed){start=Math.min(start,e.start!);end=Math.max(end,e.start!+e.duration)}
  // Explicit annotation windows can include Host work before/after the first/last device task.
  const scopedWindows=windows.filter(w=>w.end>start&&w.start<end)
  if(phaseBasis==='annotations'||phaseBasis==='manual')for(const w of scopedWindows){start=Math.min(start,w.start);end=Math.max(end,w.end)}
  const covered=mergeRanges(timed.map(e=>({start:e.start!,end:e.start!+e.duration})))
  const gaps=complete?complement(covered,start,end):[]
  const schedules=mergeRanges(host.filter(a=>kind(a)==='schedule').map(a=>({start:a.start,end:a.start+a.duration})))
  const scheduleEvidence=config.aligned && !!config.hostSource && schedules.length>0
  const phaseRanges={prefill:mergeRanges(scopedWindows.filter(w=>w.phase==='prefill')),decode:mergeRanges(scopedWindows.filter(w=>w.phase==='decode'))}
  const edges=[...phaseRanges.prefill.flatMap(r=>[{t:r.start,p:'prefill' as const,d:1},{t:r.end,p:'prefill' as const,d:-1}]),...phaseRanges.decode.flatMap(r=>[{t:r.start,p:'decode' as const,d:1},{t:r.end,p:'decode' as const,d:-1}])].sort((a,b)=>a.t-b.t)
  const bands: Band[]=[];let cursor=start;const active={prefill:0,decode:0}
  for(let i=0;i<edges.length;) {
    const t=edges[i].t
    if(t>cursor)bands.push({start:cursor,end:Math.min(t,end),phase:active.prefill&&active.decode?'conflict':active.prefill?'prefill':active.decode?'decode':'unassigned'})
    while(i<edges.length&&edges[i].t===t){const x=edges[i++];active[x.p]+=x.d}
    cursor=t
  }
  if(cursor<end)bands.push({start:cursor,end,phase:'unassigned'})
  const validBands=bands.filter(b=>b.end>b.start && b.end>start && b.start<end).map(b=>({...b,start:Math.max(b.start,start),end:Math.min(b.end,end)}))
  const pieces: Record<PhaseBucket,ProfileEvent[]>={prefill:[],decode:[],conflict:[],unassigned:[]}
  const counts: Record<PhaseBucket,Set<ProfileEvent>>={prefill:new Set(),decode:new Set(),conflict:new Set(),unassigned:new Set()}
  const clipped={prefill:0,decode:0,conflict:0,unassigned:0}
  let fragments=0
  for(const e of events) {
    if(taskLabels||e.start===undefined||!windows.length) {
      const p=taskLabels?e.phase??'unassigned':'unassigned';pieces[p].push(e);counts[p].add(e);continue
    }
    let low=0,high=validBands.length
    while(low<high){const mid=(low+high)>>>1;if(validBands[mid].end<=e.start)low=mid+1;else high=mid}
    for(let i=low;i<validBands.length&&validBands[i].start<e.start+e.duration;i++) {
      const band=validBands[i],s=Math.max(e.start,band.start),f=Math.min(e.start+e.duration,band.end)
      if(f>s){pieces[band.phase].push({...e,start:s,duration:f-s});counts[band.phase].add(e);if(f-s<e.duration)clipped[band.phase]++;fragments++}
      if(fragments>500000)throw new Error('阶段边界产生超过 500000 个任务片段，请减少阶段区间或缩小范围。')
    }
  }
  const phases=(['prefill','decode','conflict','unassigned'] as const).map(phase=> {
    const es=pieces[phase],work=es.reduce((s,e)=>s+e.duration,0),ranges=taskLabels?(phase==='prefill'||phase==='decode'?phaseRanges[phase]:mergeRanges(es.filter(e=>e.start!==undefined).map(e=>({start:e.start!,end:e.start!+e.duration})))):validBands.filter(b=>b.phase===phase)
    const valid=complete && (phase==='unassigned'||(phase==='conflict'?phaseBasis!=='none':scopedWindows.some(w=>w.phase===phase)))
    const wall=valid?length(ranges):null,busy=valid?intervalCoverage(es).busy:null
    const grouped=new Map<string,{key:string;type:string;shape:string;work:number;share:number;calls:number}>()
    for(const e of es){const k=signature(e);if(!grouped.has(k))grouped.set(k,{key:k,type:e.type,shape:e.shape,work:0,share:0,calls:0});const g=grouped.get(k)!;g.work+=e.duration;g.calls++}
    const groups=[...grouped.values()].sort((a,b)=>b.work-a.work).map(g=>({...g,share:work?g.work/work:0}))
    return {phase,work,wall,busy,uncovered:wall===null||busy===null?null:Math.max(0,wall-busy),schedule:valid&&scheduleEvidence?length(intersections(mergeRanges(ranges),schedules)):null,calls:counts[phase].size,clipped:clipped[phase],groups}
  })
  if(phases.find(p=>p.phase==='conflict')!.wall)warnings.push('Prefill 与 Decode 标记重叠：重叠部分单列为阶段冲突，不强行归属，也不重复计算。')
  if(taskLabels && intersections(phaseRanges.prefill,phaseRanges.decode).length)warnings.push('不同 Phase 的任务包络存在重叠，阶段墙钟时间不能相加；累计工作量仍按逐任务标签归属。')
  const decode=scopedWindows.filter(w=>w.phase==='decode').sort((a,b)=>a.start-b.start||b.end-a.end)
  const steps: Range[]=[];let overlap=false
  for(const r of decode){const last=steps.at(-1);if(last&&r.start<last.end){overlap=true;last.end=Math.max(last.end,r.end)}else steps.push({...r})}
  if(overlap)warnings.push('Decode 标记存在嵌套或重叠，已合并计时，但逐步时长统计停用；请用外层步标记或手动区间。')
  const phaseConflict=phases.find(p=>p.phase==='conflict')!.wall??0
  const reliableSteps=complete&&!overlap&&!phaseConflict&&(!taskLabels||events.filter(e=>e.phase==='decode').every(e=>e.step))?steps:[]
  const durations=reliableSteps.map(r=>r.end-r.start).sort((a,b)=>a-b),p50=durations.length?percentile(durations,.5):null,p95=durations.length?percentile(durations,.95):null
  const allPhaseRanges=mergeRanges([...phaseRanges.prefill,...phaseRanges.decode])
  const between=allPhaseRanges.length?complement(allPhaseRanges,allPhaseRanges[0].start,allPhaseRanges.at(-1)!.end):[]
  const gapTime=phaseBasis==='none'||!complete?null:length(between)
  const scheduledGap=scheduleEvidence&&gapTime!==null?length(intersections(between,schedules)):null
  const utilizationMap=new Map<string,DiagnosticAnalysis['utilization'][number]>()
  let counterCalls=0,ambiguous=0,invalid=0
  for(const e of events) {
    if(e.counters&&Object.keys(e.counters).length)counterCalls++
    const metric=config.metric==='auto'?(/matmul|gemm/i.test(e.type)?'cube':/norm|softmax|gelu|silu|relu|add|mul|gather|cast/i.test(e.type)?'vector':undefined):config.metric
    if(!metric)continue
    const k=signature(e),id=JSON.stringify([k,metric])
    if(!utilizationMap.has(id))utilizationMap.set(id,{key:k,type:e.type,shape:e.shape,metric,mean:null,samples:0,calls:0,measuredWork:0,totalWork:0,lowWork:0,lowCalls:0})
    const r=utilizationMap.get(id)!;r.calls++;r.totalWork+=e.duration
    const c=e.counters?.[metric];if(!c)continue
    if(!c.percent&&config.ratioUnit==='auto'){ambiguous++;continue}
    const percent=c.value*(c.percent||config.ratioUnit==='percent'?1:100)
    if(!Number.isFinite(percent)||percent<0||percent>100){invalid++;continue}
    r.mean=(r.mean??0)+percent*e.duration;r.measuredWork+=e.duration;r.samples++
    if(percent<config.threshold){r.lowWork+=e.duration;r.lowCalls++}
  }
  const utilization=[...utilizationMap.values()].map(r=>({...r,mean:r.samples?r.mean!/r.measuredWork:null})).sort((a,b)=>b.lowWork-a.lowWork||b.totalWork-a.totalWork)
  if(ambiguous)warnings.push(`${ambiguous} 条所选流水线指标无单位；请确认原始 ratio 是 0–1 还是 0–100，未确认前不参与低活跃统计。`)
  if(invalid)warnings.push(`${invalid} 条所选流水线指标超出 0–100%，已排除；请检查比例单位。`)
  if(!windows.length)warnings.push('未识别到有效阶段：选择并确认 Host 标记来源，或手动标注 Prefill / Decode 区间；不会按首步或 kernel 名猜测。')
  if(!scheduleEvidence)warnings.push('缺少已确认的调度事件：调度耗时显示未知，时间空隙仍可独立查看。')
  if(selectedDevice==='')warnings.push('未选择设备执行域。')
  return {config,sources,phases,phaseBasis,iterations:{count:durations.length,p50,p95,max:durations.at(-1)??null,rows:reliableSteps.slice(0,200).map(r=>({start:r.start-origin,duration:r.end-r.start,outlier:p50!==null&&r.end-r.start>2*p50})),truncated:reliableSteps.length>200},
    scheduling:{recorded:scheduleEvidence&&complete?length(intersections(schedules,[{start,end}])):null,betweenPhases:scheduledGap,phaseGap:gapTime,unrecordedGap:gapTime===null?null:scheduledGap===null?gapTime:gapTime-scheduledGap},
    gaps:{total:complete?length(gaps):null,count:gaps.length,rows:gaps.slice().sort((a,b)=>(b.end-b.start)-(a.end-a.start)).slice(0,20).map(r=>({start:r.start-origin,duration:r.end-r.start,schedule:scheduleEvidence?length(intersections([r],schedules)):null}))},utilization,counterCalls,warnings}
}
