import type { ProfileData } from './profile-analysis.ts'

/** These views intentionally use the whole capture, not the current filter. */
export function profileSummaryEvidence(data:ProfileData){
  const tables=data.evidence?.tables??[]
  const byType=new Map<string,{calls:number;work:number}>()
  for(const e of data.events){
    if(e.role&&e.role!=='execution')continue
    const key=JSON.stringify([e.device,e.type]),old=byType.get(key)??{calls:0,work:0}
    old.calls++;old.work+=e.duration;byType.set(key,old)
  }
  const summaries=new Map<string,{name:string;device:string;calls:number;work:number}>()
  for(const r of tables.find(t=>t.kind==='operators')?.rows??[]){
    const key=JSON.stringify([r.device,r.name]),old=summaries.get(key)??{name:r.name,device:r.device,calls:0,work:0}
    old.calls+=r.count??0;old.work+=r.total??0;summaries.set(key,old)
  }
  const reconciliation=[...summaries].map(([key,r])=>{
    const detail=byType.get(key)
    return {...r,detailCalls:detail?.calls??null,detailWork:detail?.work??null,
      status:!detail?'missing' as const:detail.calls===r.calls&&Math.abs(detail.work-r.work)<=Math.max(1,r.work*.001)?'matched' as const:'different' as const}
  })
  const hostSignals:{name:string;basis:string;calls:number;work:number;share:number;next:string}[]=[]
  const api=tables.find(t=>t.kind==='api')?.rows??[]
  const levelTotals=new Map<string,number>()
  for(const r of api)levelTotals.set(r.category,(levelTotals.get(r.category)??0)+(r.total??0))
  for(const r of [...api].sort((a,b)=>(b.total??0)-(a.total??0)).slice(0,3)){
    hostSignals.push({name:r.name,basis:`API 层级 ${r.category||'未标注'}`,calls:r.count??0,work:r.total??0,share:levelTotals.get(r.category)?(r.total??0)/levelTotals.get(r.category)!:0,next:'在 Host 时间线核对 API 是否阻塞、下发是否串行，并检查它与设备未覆盖区间的关系。同一层级累计占比仅用于筛选，不是端到端占比。'})
  }
  const framework=new Map<string,{calls:number;self:number}>()
  for(const r of tables.find(t=>t.kind==='framework')?.rows??[]){const old=framework.get(r.name)??{calls:0,self:0};old.calls++;old.self+=r.hostSelf??0;framework.set(r.name,old)}
  const allSelf=[...framework.values()].reduce((s,r)=>s+r.self,0)
  for(const [name,r] of [...framework].sort((a,b)=>b[1].self-a[1].self).slice(0,3))hostSignals.push({name,basis:'框架 Host Self（按名称聚合）',calls:r.calls,work:r.self,share:allSelf?r.self/allSelf:0,next:'检查该调用自身的 CPU 工作、Python/框架边界和同步行为；Self 排除了子调用，但不同线程仍可能重叠。用 Host/Device 对齐或关联 ID 验证，不以 Host Total 求和代替墙钟时间。'})
  return {reconciliation,hostSignals}
}
