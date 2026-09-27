import { useState } from 'react'
import type { ProfileAnalysis, ProfileFilter } from '@/lib/profile-analysis'
const control='min-h-11 rounded-lg border border-line bg-field px-3 py-2 text-xs text-ink'
const num=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})
export default function ProfileTimeline({analysis:a,onWindow}:{analysis:ProfileAnalysis;onWindow:(filter:ProfileFilter)=>void}){
  const t=a.timelineOverview,[page,setPage]=useState(0),[bin,setBin]=useState(0)
  const pages=Math.max(1,Math.ceil(t.lanes.length/12)),current=Math.min(page,pages-1),width=(t.end-t.start)/64
  return <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label="完整采样时间线">
    <h2 className="text-base font-medium text-ink">完整采样 · Stream 覆盖总览</h2>
    <p className="mt-2 text-xs leading-6 text-muted">当前筛选内全部有时间戳的任务，均纳入 64 个等宽区间；不是仅展示最早 1200 条。每行上带为执行覆盖，下带为等待覆盖，亮度表示该区间的时间覆盖比例，并非硬件利用率。重叠任务按并集计算。</p>
    <p className="mt-2 text-xs text-secondary">相对 {num(t.start)}–{num(t.end)} µs · {t.lanes.reduce((s,l)=>s+l.count,0)} 条记录 · {t.lanes.length} 条 Stream · {t.missing} 条缺少时间戳</p>
    {!t.lanes.length?<p className="mt-3 text-xs text-muted">无可用时间戳。</p>:<>
      <div className="mt-3 overflow-x-auto" role="region" aria-label="Stream 时间覆盖图" tabIndex={0}><div className="min-w-[640px] space-y-2">{t.lanes.slice(current*12,current*12+12).map(l=><div key={l.stream} className="flex items-center gap-3"><div className="w-24 shrink-0 text-xs"><p className="truncate" title={l.stream}>Stream {l.stream}</p><p className="text-muted">{num(l.count)} 条</p></div><div className="grid h-8 flex-1 grid-cols-[repeat(64,minmax(0,1fr))] gap-px" role="img" aria-label={`Stream ${l.stream} 全时段执行与等待覆盖`}>{l.bins.map((b,i)=><div key={i} className="grid grid-rows-2 gap-px bg-raised" title={`区间 ${i+1} · 执行 ${num(b.execution*100)}% · 等待 ${num(b.wait*100)}%`}><div className="bg-accent" style={{opacity:b.execution}}/><div className="bg-amber-300" style={{opacity:b.wait}}/></div>)}</div></div>)}</div></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><button className={control} disabled={current===0} onClick={()=>setPage(current-1)}>前 12 条 Stream</button><span>{current+1} / {pages}</span><button className={control} disabled={current+1>=pages} onClick={()=>setPage(current+1)}>后 12 条 Stream</button></div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-xs text-secondary">聚焦区间<select aria-label="时间线聚焦区间" className={`${control} ml-2 max-w-full`} value={bin} onChange={e=>setBin(Number(e.target.value))}>{Array.from({length:64},(_,i)=><option key={i} value={i}>{i+1} · {num(t.start+i*width)}–{num(t.start+(i+1)*width)} µs</option>)}</select></label><button className={control} onClick={()=>onWindow({...a.selectedFilter,from:String(Math.max(0,t.start+bin*width)),to:String(t.start+(bin+1)*width)})}>分析所选时间区间</button><button className={control} onClick={()=>onWindow({...a.selectedFilter,from:'',to:''})}>恢复完整时间范围</button></div>
      <p className="mt-2 text-xs leading-5 text-muted">聚焦后重算统计与热点，只保留完整落入区间的调用；跨边界任务会排除。可在导入卡片的范围筛选中调整精确边界和 Stream。</p>
    </>}
  </section>
}
