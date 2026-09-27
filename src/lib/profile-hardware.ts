import { intervalCoverage, percentile, signature, type ProfileData, type ProfileEvent } from './profile-analysis.ts'
import type { ProfileImportEvidence } from './profile-bundle.ts'
import { pipeMetrics, type DiagnosticConfig, type PipeMetric } from './profile-diagnostics.ts'
import { profileSummaryEvidence } from './profile-summary-evidence.ts'

export interface HardwareAnalysis {
  records: number; execution: number; waits: number; controls: number
  waitWork: number; waitCoverage: number | null; waitOutsideExecution: number | null
  taskTypes: { name: string; role: string; count: number; work: number }[]
  waitGroups: { name: string; count: number; work: number; coverage: number | null; outsideExecution: number | null }[]
  pipelines: { key: string; metric: PipeMetric; mean: number | null; samples: number; calls: number; measuredWork: number; work: number }[]
  markers: { name: string; source: string; count: number; total: number; coverage: number; p50: number; p95: number }[]
  evidence?: ProfileImportEvidence
  summaries: ReturnType<typeof profileSummaryEvidence>
  candidates: { key: string; title: string; evidence: string; next: string; work: number; groupKey?: string }[]
}
function coverage(es: ProfileEvent[]) { return intervalCoverage(es).busy }
export function analyzeHardware(data: ProfileData, records: ProfileEvent[], config?: DiagnosticConfig): HardwareAnalysis {
  const execution=records.filter(e=>!e.role||e.role==='execution'),waits=records.filter(e=>e.role==='wait'),controls=records.filter(e=>e.role==='control')
  const types=new Map<string,HardwareAnalysis['taskTypes'][number]>()
  for(const e of records){const name=e.taskType||e.type,role=e.role||'execution',key=JSON.stringify([name,role]);if(!types.has(key))types.set(key,{name,role,count:0,work:0});const row=types.get(key)!;row.count++;row.work+=e.duration}
  const waitMap=new Map<string,ProfileEvent[]>()
  for(const e of waits){const name=e.taskType||e.type;if(!waitMap.has(name))waitMap.set(name,[]);waitMap.get(name)!.push(e)}
  const executionCoverage=coverage(execution)
  const timed=records.every(e=>e.start!==undefined)
  const waitGroups=[...waitMap].map(([name,es])=>({name,count:es.length,work:es.reduce((s,e)=>s+e.duration,0),coverage:timed?coverage(es):null,outsideExecution:timed?Math.max(0,coverage([...execution,...es])-executionCoverage):null})).sort((a,b)=>(b.outsideExecution??0)-(a.outsideExecution??0)||b.work-a.work)
  const markerMap=new Map<string,NonNullable<ProfileData['annotations']>>()
  for(const a of data.annotations??[]){
    if(!/^(?:step\[|ProfilerStep#|scheduler[._/]|(?:model[._/])?(?:forward[._/])?(?:prefill|decode)(?:[._/]|$))/i.test(a.name))continue
    const key=JSON.stringify([a.name,a.source]);if(!markerMap.has(key))markerMap.set(key,[]);markerMap.get(key)!.push(a)
  }
  const markers=[...markerMap].map(([key,es])=>{
    const [name,source]=JSON.parse(key),ds=es.map(e=>e.duration).sort((a,b)=>a-b)
    const events=es.map(e=>({...e,type:e.name,shape:'',dtype:'',format:'',device:'',stream:'',step:'',kind:'other' as const}))
    return {name,source,count:es.length,total:ds.reduce((s,d)=>s+d,0),coverage:coverage(events),p50:percentile(ds,.5),p95:percentile(ds,.95)}
  }).sort((a,b)=>b.coverage-a.coverage)
  const buckets=new Map<string,ProfileEvent[]>()
  for(const e of execution){const key=signature(e);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(e)}
  const total=execution.reduce((s,e)=>s+e.duration,0),candidates:HardwareAnalysis['candidates']=[]
  const pipelines:HardwareAnalysis['pipelines']=[]
  for(const [key,es] of buckets){
    const work=es.reduce((s,e)=>s+e.duration,0),ds=es.map(e=>e.duration).sort((a,b)=>a-b),median=percentile(ds,.5),p95=percentile(ds,.95)
    for(const metric of pipeMetrics){
      let measuredWork=0,weighted=0,samples=0,present=false
      for(const e of es){
        const c=e.counters?.[metric];if(!c)continue;present=true
        if(!c.percent&&!c.fraction&&(!config||config.ratioUnit==='auto'))continue
        const p=c.value*(c.percent?1:c.fraction?100:config?.ratioUnit==='percent'?1:100)
        if(!Number.isFinite(p)||p<0||p>100)continue
        samples++;measuredWork+=e.duration;weighted+=p*e.duration
      }
      if(present)pipelines.push({key,metric,mean:measuredWork?weighted/measuredWork:null,samples,calls:es.length,measuredWork,work})
    }
    if(es.length>=20&&median<=10&&work>=total*.01)candidates.push({key:`short:${key}`,groupKey:key,title:`${es[0].type} · 高频短任务`,evidence:`${es.length} 次调用，P50 ${median.toFixed(2)} µs，累计工作量占比 ${(work/total*100).toFixed(1)}%。`,next:'检查相邻算子与重复格式转换，验证融合或图模式是否减少实际下发开销；不要把全部任务时长视为可消除成本。',work})
    if(es.length>=5&&p95>2*median&&work>=total*.01)candidates.push({key:`tail:${key}`,groupKey:key,title:`${es[0].type} · 时延波动`,evidence:`P95/P50 = ${(p95/median).toFixed(2)}，共 ${es.length} 次。`,next:'按阶段、Shape 与 Stream 缩小窗口；排除启动、动态负载和争用，再用重复实验验证。',work})
    const vector=/AI_VECTOR_CORE|MIX_AIV/.test(es[0].taskType??''),metric=vector?'aivMte2':'aicMte2',compute=vector?'vector':'cube'
    let measured=0,mte=0,core=0
    for(const e of es){const a=e.counters?.[metric],b=e.counters?.[compute];if(!a||!b||(!a.percent&&!a.fraction)||(!b.percent&&!b.fraction))continue;const x=a.value*(a.percent?1:100),y=b.value*(b.percent?1:100);if(x<0||x>100||y<0||y>100)continue;measured+=e.duration;mte+=x*e.duration;core+=y*e.duration}
    if(measured&&mte/measured>50&&mte>core*1.5&&work>=total*.01)candidates.push({key:`mte:${key}`,groupKey:key,title:`${es[0].type} · 搬运活跃偏高`,evidence:`有效计数器覆盖 ${(measured/work*100).toFixed(1)}% 任务时长；MTE2 ${(mte/measured).toFixed(1)}%，${vector?'Vector':'MAC'} ${(core/measured).toFixed(1)}%（按调用时长加权）。`,next:'核对实际 Shape、分块、数据布局与复用。该信号不等于带宽饱和；结合 Memory/L2Cache 或定向微基准再判定瓶颈。',work})
  }
  const outside=timed?Math.max(0,coverage([...execution,...waits])-executionCoverage):null
  if(outside!==null&&outside>0)candidates.push({key:'wait-exposure',title:'同步等待存在未被执行任务覆盖的区间',evidence:`等待区间并集 ${(coverage(waits)/1000).toFixed(2)} ms，其中 ${(outside/1000).toFixed(2)} ms 没有所选执行任务覆盖。`,next:'检查对应 Stream 的生产者、跨卡依赖和 Host 下发。等待名称本身不能证明网络通信瓶颈，也不能把各 Stream 等待时长直接相加当作端到端损失。',work:outside})
  return {records:records.length,execution:execution.length,waits:waits.length,controls:controls.length,waitWork:waits.reduce((s,e)=>s+e.duration,0),waitCoverage:timed?coverage(waits):null,waitOutsideExecution:outside,taskTypes:[...types.values()].sort((a,b)=>b.work-a.work),waitGroups,pipelines,markers,evidence:data.evidence,summaries:profileSummaryEvidence(data),candidates:candidates.sort((a,b)=>b.work-a.work).slice(0,30)}
}
