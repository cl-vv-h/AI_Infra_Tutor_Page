import { memo, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { RankComparison } from '@/lib/multi-rank-profile'
const number=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})
const channels=[['compute','计算','#a9a3ff'],['communication','通信','#67d5cf'],['wait','等待','#e9c17b'],['other','其他 / 拷贝','#9497a5']] as const

const CoverageLanes=memo(function CoverageLanes({result,page}:{result:RankComparison;page:number}){
  return <>{result.rows.slice(page*8,page*8+8).map(row=><div key={row.id} className="flex min-w-0 items-center gap-3 border-t border-line/60 py-4">
    <div className="w-16 shrink-0 text-xs"><p className="font-medium text-ink">Rank {row.label}</p><p className="mt-1 text-muted">{row.calls} 次</p></div>
    <svg viewBox="0 0 960 54" preserveAspectRatio="none" className="h-16 min-w-0 flex-1" role="img" aria-label={`Rank ${row.label} 计算、通信、等待和其他任务覆盖`}>
      {channels.map(([key,label,color],c)=><g key={key}><rect width="960" height="10" y={c*14} rx="3" fill="var(--surface-raised, #1a1b20)"/>{row.bins.map((bin,i)=>bin[key]>0?<rect key={i} x={i*10} y={c*14} width="9.5" height="10" rx="2" fill={color} opacity={.2+.8*bin[key]}><title>{label} · 区间 {i+1} · 覆盖 {number(bin[key]*100)}%</title></rect>:null)}</g>)}
      {row.selected&&<g><line x1={960*(row.selected.start-result.start)/(result.end-result.start)} x2={960*(row.selected.start-result.start)/(result.end-result.start)} y1="0" y2="54" stroke="#f4f4f5" strokeWidth="2" strokeDasharray="3 3"/><title>已选通信事件起点</title></g>}
    </svg>
  </div>)}</>
})

export default function MultiRankTimeline({result,active,disabled}:{result:RankComparison;active:boolean;disabled:boolean}){
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[page,setPage]=useState(0)
  const [reduced,setReduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches)
  const latestPosition=useRef(position)
  useEffect(()=>{latestPosition.current=position},[position])
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{setReduced(media.matches);setPlaying(false)};media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  useEffect(()=>{setPosition(0);setPlaying(false);setPage(0)},[result])
  useEffect(()=>{if(!active||disabled||reduced)setPlaying(false)},[active,disabled,reduced])
  useEffect(()=>{
    const stop=()=>setPlaying(false),visibility=()=>{if(document.hidden)stop()}
    // A lazy sibling may suspend before its inactive prop commits. Stop on the
    // navigation intent too, including a rapid back action during chunk loading.
    const navigation=(event:MouseEvent)=>{const a=(event.target as Element)?.closest?.('a');if(a?.getAttribute('href')?.startsWith('#/')&&a.hash!==location.hash)stop()}
    document.addEventListener('visibilitychange',visibility);document.addEventListener('click',navigation,true)
    window.addEventListener('popstate',stop);window.addEventListener('hashchange',stop)
    return()=>{document.removeEventListener('visibilitychange',visibility);document.removeEventListener('click',navigation,true);window.removeEventListener('popstate',stop);window.removeEventListener('hashchange',stop)}
  },[])
  useEffect(()=>{
    if(!playing||!active||disabled||reduced)return
    let frame=0,previous=performance.now(),lastDraw=0,p=latestPosition.current>=1?0:latestPosition.current
    const tick=(now:number)=>{p=Math.min(1,p+(now-previous)*speed/12000);previous=now;if(now-lastDraw>=40||p===1){setPosition(p);lastDraw=now}if(p<1)frame=requestAnimationFrame(tick);else setPlaying(false)}
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
  },[playing,speed,active,disabled,reduced])
  const bin=Math.min(95,Math.floor(position*96)),width=(result.end-result.start)/96,shownPage=Math.min(page,Math.ceil(result.rows.length/8)-1)
  const at=result.start+position*(result.end-result.start)
  const step=(direction:number)=>{setPlaying(false);setPosition(p=>Math.min(1,Math.max(0,p+direction/96)))}
  return <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-label="多 rank 联合时间线">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-accent">Timeline / 01</p><h2 className="mt-2 text-xl font-medium text-ink">{result.synchronized?'同一时间轴，观察各 rank':'先看形态，不比较先后'}</h2></div><span className="rounded-md border border-line px-2 py-1 text-xs text-secondary">{result.synchronized?'已声明校时':'各自起点归零'}</span></div>
    <p className="mt-3 text-sm leading-6 text-muted">每行四条轨道由全部已计时记录汇总为 96 个区间。亮度表示时间覆盖，不是算力利用率；不同轨道可重叠，不能相加。</p>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-secondary">{channels.map(([,label,color])=><span key={label} className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-sm" style={{background:color}}/>{label}</span>)}<span>┊ 已选通信事件</span></div>
    <div className="mt-5 overflow-x-auto" role="region" aria-label="Rank 时间覆盖图" tabIndex={0}><div className="min-w-[520px]">
      <div className="ml-[76px] flex justify-between pb-2 font-mono text-xs text-muted"><span>{number(result.start)} µs</span><span>{number(result.end)} µs</span></div>
      <div className="relative"><CoverageLanes result={result} page={shownPage}/><div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-[76px] right-0 top-0"><div data-testid="rank-playhead" data-position={position} className="absolute bottom-2 top-0 w-px bg-ink" style={{left:`${position*100}%`}}><span className="absolute -left-[3px] top-0 h-2 w-2 rounded-full bg-ink"/></div></div></div>
    </div></div>
    {result.rows.length>8&&<div className="mt-2 flex items-center gap-3 text-xs"><button className="button-secondary" disabled={!shownPage} onClick={()=>setPage(shownPage-1)}>上一组 rank</button><span>{shownPage+1} / {Math.ceil(result.rows.length/8)}</span><button className="button-secondary" disabled={(shownPage+1)*8>=result.rows.length} onClick={()=>setPage(shownPage+1)}>下一组 rank</button></div>}
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button className="button-primary" disabled={disabled||reduced} onClick={()=>setPlaying(p=>!p)} aria-label={playing?'暂停时间线':'播放时间线'}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'暂停':'播放'}</button>
      <button className="button-secondary" disabled={disabled} onClick={()=>step(-1)} aria-label="上一个时间区间"><ChevronLeft size={16}/></button>
      <button className="button-secondary" disabled={disabled} onClick={()=>step(1)} aria-label="下一个时间区间"><ChevronRight size={16}/></button>
      <button className="button-secondary" disabled={disabled} onClick={()=>{setPlaying(false);setPosition(0)}} aria-label="重置时间游标"><RotateCcw size={16}/></button>
      <label className="ml-auto flex items-center gap-2 text-xs text-muted">演示速度<select aria-label="时间线播放速度" className="min-h-11 rounded-lg border border-line bg-field px-2 text-ink" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
    </div>
    <label className="mt-3 block text-xs text-secondary">观察游标 · {number(at)} µs<input aria-label="时间线观察游标" type="range" min="0" max="96" step="1" value={Math.round(position*96)} disabled={disabled} onChange={e=>{setPlaying(false);setPosition(Number(e.target.value)/96)}} className="mt-2 min-h-6 w-full accent-accent"/></label>
    <p className="mt-2 text-xs leading-5 text-muted">{reduced?'已遵循系统减少动态效果设置；可用方向按钮或滑块逐步查看。':'动画只移动观察游标；12 秒走完当前窗口，不代表真实运行速度。离开本页或隐藏标签页会暂停。'}</p>
    {result.pairing.ready&&<div className="mt-3 flex flex-wrap gap-2">{(['最早','最晚'] as const).map((label,i)=><button key={label} className="button-secondary" disabled={disabled} onClick={()=>{setPlaying(false);const starts=result.pairing.arrivals.map(a=>a.at),time=i?Math.max(...starts):Math.min(...starts);setPosition(Math.max(0,Math.min(1,(time-result.start)/(result.end-result.start))))}}>跳到{label}通信起点</button>)}</div>}
    <div className="mt-4 rounded-xl border border-line bg-field p-4"><h3 className="text-sm text-ink">区间 {bin+1} · {number(result.start+bin*width)}–{number(result.start+(bin+1)*width)} µs</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{result.rows.slice(shownPage*8,shownPage*8+8).map(r=><p key={r.id} className="text-xs leading-6 text-secondary"><span className="mr-2 text-ink">Rank {r.label}</span>{channels.filter(([key])=>r.bins[bin][key]>0).map(([key,label])=>`${label} ${number(r.bins[bin][key]*100)}%`).join(' · ')||'所选记录无覆盖'}</p>)}</div></div>
  </section>
}
