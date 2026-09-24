import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Download, ShieldCheck, Trash2 } from 'lucide-react'
import PerformanceNav from '@/components/PerformanceNav'
import { useProfileAnalysis } from '@/hooks/useProfileAnalysis'
import { anonymousProfileReport, compareProfiles, emptyProfileFilter, workWhatIf, type ProfileAnalysis, type ProfileFilter } from '@/lib/profile-analysis'
import { type TimeUnit } from '@/lib/profile-import'
import { demoProfile, singleProfileDemo } from '@/lib/profile-demo'
import SingleProfileDiagnostics from '@/components/SingleProfileDiagnostics'
import { clearProfileSample, transferProfileSample } from '@/lib/profile-estimate-bridge'

const panel='min-w-0 rounded-2xl border border-white/10 bg-[#0e1620] p-4 sm:p-5'
const control='mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-[#0a111a] px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none'
const button='rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:border-cyan-300 disabled:opacity-40'
const num=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:2})
const us=(v:number|null)=>v===null?'不可计算':Math.abs(v)>=1000?`${num(v/1000)} ms`:`${num(v)} µs`
const colors={compute:'#67e8f9',communication:'#c4b5fd',copy:'#fbbf24',other:'#94a3b8'}
type Slot=ReturnType<typeof useProfileAnalysis>
function ImportSlot({slot,label}:{slot:Slot;label:string}){
  const [unit,setUnit]=useState<TimeUnit>('auto'),[draft,setDraft]=useState<ProfileFilter>(emptyProfileFilter)
  const [expanded,setExpanded]=useState(true)
  const last=useRef<ProfileAnalysis|null>(null),inputRef=useRef<HTMLInputElement|null>(null)
  if(slot.analysis)last.current=slot.analysis
  if(!slot.loaded&&!slot.busy)last.current=null
  const meta=slot.loaded?last.current:null
  useEffect(()=>{setDraft(slot.filter)},[slot.filter])
  useEffect(()=>setExpanded(!slot.loaded),[slot.loaded])
  const edit=(k:keyof ProfileFilter,v:string)=>setDraft(p=>({...p,[k]:v}))
  return <section className={panel} aria-label={`${label}导入`}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-white">{label}</h2><button className="text-xs text-slate-400 hover:text-white" aria-label={`清空${label}`} onClick={()=>{slot.clear();if(inputRef.current)inputRef.current.value=''}}><Trash2 size={15}/></button></div>
    <details className="mt-3" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary className="cursor-pointer text-xs text-slate-400">导入 / 替换文件</summary>
    <p className="mt-2 text-xs leading-5 text-slate-400">kernel_details / op_summary CSV 或 trace_view / Chrome Trace JSON。单文件 ≤ 50 MiB，最多 20 万设备任务。</p>
    <label className="mt-3 block text-xs text-slate-400">无单位时间列<select aria-label={`${label}无单位时间列`} className={control} value={unit} onChange={e=>setUnit(e.target.value as TimeUnit)}><option value="auto">自动识别；不明确则拒绝</option><option value="us">按 µs 解释</option><option value="ms">按 ms 解释</option><option value="ns">按 ns 解释</option></select></label>
    <input ref={inputRef} className="mt-3 w-full min-w-0 text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-200/10 file:px-3 file:py-2 file:text-cyan-100" type="file" accept=".csv,.json,text/csv,application/json" aria-label={`导入${label}`} onChange={e=>{const f=e.target.files?.[0];if(f)void slot.loadFile(f,unit);e.target.value=''}}/>
    </details>
    {slot.busy&&<p role="status" className="mt-3 text-xs text-cyan-200">本地后台分析中…可清空以取消。</p>}
    {slot.error&&<p role="alert" className="mt-3 break-words text-xs leading-5 text-rose-200">{slot.error}</p>}
    {meta&&<details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-cyan-200">范围与稳态筛选 · {slot.analysis?`${slot.analysis.count} 个调用`:'调整后重新分析'}</summary>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {([['device','设备执行域',meta.devices],['stream','Stream',meta.streams],['step','Step',meta.steps]] as const).map(([k,title,options])=><label key={k} className="min-w-0 text-xs text-slate-400">{title}{options.length<=1000?<select aria-label={`${label}${title}`} className={control} value={draft[k]} onChange={e=>edit(k,e.target.value)}>{k!=='device'&&<option value="">全部</option>}{options.map(v=><option key={v} value={v}>{v}</option>)}</select>:<><input aria-label={`${label}${title}`} className={control} value={draft[k]} onChange={e=>edit(k,e.target.value)}/><span className="mt-1 block text-[10px]">共 {options.length} 个值，请输入完整 ID；空值使用默认范围。</span></>}</label>)}
        <label className="min-w-0 text-xs text-slate-400">任务搜索<input aria-label={`${label}任务搜索`} className={control} value={draft.search} onChange={e=>edit('search',e.target.value)} placeholder="类型 / 名称 / shape"/></label>
        {(['from','to'] as const).map((k,i)=><label key={k} className="text-xs text-slate-400">相对{i?'终点':'起点'} µs<input className={control} aria-label={`${label}${k}`} type="number" min="0" step="any" value={draft[k]} onChange={e=>edit(k,e.target.value)} placeholder={i?'直到结束':'0'}/></label>)}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">相对于各自设备采样最早任务。只保留完整落入窗口的调用；请主动排除预热、编译与不相关阶段。选择其他设备后可先清空 Stream/Step 条件。</p>
      <div className="mt-3 flex gap-2"><button className={button} disabled={slot.busy} onClick={()=>slot.updateFilter(draft)}>应用{label}筛选</button><button className={button} disabled={slot.busy} onClick={()=>slot.updateFilter(emptyProfileFilter())}>重置筛选</button></div>
    </details>}
  </section>
}
function Timeline({analysis:a}:{analysis:ProfileAnalysis}) {
  const shown=a.lanes.slice(0,12),events=shown.flatMap(l=>l.events)
  const min=events.length?Math.min(...events.map(e=>e.start)):0,max=Math.max(min+1,...events.map(e=>e.start+e.duration))
  return <section className={panel} aria-label="设备任务时间线">
    <h2 className="text-sm font-medium text-white">设备任务时间线预览</h2>
    <p className="mt-2 text-xs leading-5 text-slate-400">青色：计算 · 紫色：通信/同步 · 黄色：拷贝 · 灰色：未分类。分类按任务类型与名称启发式判断，需核对源码。</p>
    <p className="mt-2 text-[11px] text-slate-500">显示相对 {num(min)}–{num(max)} µs · 仅画最早 1200 个任务、前 12 条 stream；统计使用全部筛选任务。</p>
    {a.timedCount===0?<p className="mt-4 text-xs text-amber-200">无时间戳，不能重建时间线。</p>:<div className="mt-4 space-y-2">{shown.map(l=><div key={l.stream} className="flex min-w-0 items-center gap-2"><span title={l.stream} className="w-16 shrink-0 truncate font-mono text-[10px] text-slate-400">S {l.stream}</span><div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded bg-white/5">{l.events.map((e,i)=><div key={i} title={`${e.name} · ${us(e.duration)} · ${num(e.start)} µs`} className="absolute top-1 h-5 rounded-sm opacity-80" style={{left:`${100*(e.start-min)/(max-min)}%`,width:`${Math.max(.15,100*e.duration/(max-min))}%`,background:colors[e.kind]}}/>)}</div></div>)}</div>}
    {(a.timelineTruncated||a.lanes.length>12)&&<p className="mt-3 text-xs text-amber-200">预览已限量；用时间/Stream 筛选聚焦，不代表后续任务不存在。</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs"><div><span className="text-slate-500">通信/同步覆盖</span><p className="mt-1">{us(a.communication)}</p></div><div><span className="text-slate-500">与计算交集</span><p className="mt-1">{us(a.computeCommunication)}</p></div><div><span className="text-slate-500">未被计算覆盖的通信</span><p className="mt-1 text-violet-200">{us(a.exposedCommunication)}</p></div></div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">时间交集不证明有效并行：通信可能是等待，重叠任务也可能争用资源。没有依赖图，不能推导关键路径或端到端提速。</p>
  </section>
}
export default function ProfilingWorkbench(){
  const baseline=useProfileAnalysis(),candidate=useProfileAnalysis()
  const [tab,setTab]=useState<'single'|'hotspots'|'compare'>('single'),[selected,setSelected]=useState(''),[sort,setSort]=useState('total'),[page,setPage]=useState(0)
  const [speedup,setSpeedup]=useState('2'),[comparable,setComparable]=useState(false),[exported,setExported]=useState(false)
  const a=baseline.analysis,b=candidate.busy?null:candidate.analysis
  useEffect(()=>{setComparable(false);setPage(0);setExported(false)},[a,b])
  const groups=useMemo(()=>a?[...a.groups].sort((x,y)=>sort==='tail'?(y.p95/y.median)-(x.p95/x.median):sort==='exclusive'?(y.exclusive??0)-(x.exclusive??0):y.total-x.total):[],[a,sort])
  const chosen=groups.find(g=>g.key===selected)??groups[0]
  const diff=useMemo(()=>a&&b?compareProfiles(a,b):null,[a,b])
  let scenario:ReturnType<typeof workWhatIf>|undefined,scenarioError=''
  if(a&&chosen){try{scenario=workWhatIf(a,chosen.key,Number(speedup))}catch(e){scenarioError=(e as Error).message}}
  const download=()=>{
    if(!a)return
    const url=URL.createObjectURL(new Blob([JSON.stringify(anonymousProfileReport(a,comparable?b??undefined:undefined),null,2)],{type:'application/json'})),link=document.createElement('a')
    link.href=url;link.download='anonymous-profile-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExported(true)
  }
  const rows=tab==='hotspots'?groups:diff?.rows??[],pageCount=Math.ceil(rows.length/20)
  return <div className="mx-auto max-w-[1440px] px-4 py-8 text-slate-200 sm:px-8 lg:px-12">
    <PerformanceNav/>
    <header className="mb-6"><p className="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-cyan-300"><Activity size={15}/> PROFILE / EVIDENCE</p><h1 className="text-2xl font-semibold text-white sm:text-3xl">Profiling 分析工作台</h1><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">单份采样即可分析 Prefill / Decode、调度事件、算子占比与低活跃候选；可选 A/B 对照验证回归。真实采样优先，理论估算用于热点的二次校核。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className={button} onClick={()=>{baseline.loadText(singleProfileDemo());candidate.clear();setTab('single')}}>加载单份阶段分析示例</button><button className={button} onClick={()=>{baseline.loadText(demoProfile());candidate.loadText(demoProfile(true));setTab('hotspots')}}>加载合成 A/B 示例</button><button className={button} onClick={()=>{baseline.clear();candidate.clear();clearProfileSample();setSelected('');setComparable(false);setExported(false)}}>清空全部数据</button><span className="flex items-center gap-1.5 text-xs text-emerald-200/80"><ShieldCheck size={14}/>本地解析 · 不上传 · 不持久保存</span></div>
    </header>
    <p className="mb-3 text-xs text-slate-400">单份分析只需导入基线 A；候选 B 仅用于可选的 A/B 对照。</p>
    <div className="grid gap-4 lg:grid-cols-2"><ImportSlot slot={baseline} label="基线 A"/><ImportSlot slot={candidate} label="候选 B"/></div>
    {!a&&!baseline.busy&&!baseline.error&&<section className={`${panel} mt-5`}><h2 className="text-sm font-medium text-white">从一个真实问题开始</h2><ol className="mt-3 grid list-inside list-decimal gap-3 text-sm leading-6 text-slate-400 md:grid-cols-3"><li>导入设备逐任务记录，筛选同一设备与稳态阶段。</li><li>按累计耗时找热点，查看长尾与调用次数；不要只看单次最慢任务。</li><li>导入优化后的 B，区分单次速度变化与工作量变化，再回到 trace 验证依赖。</li></ol><p className="mt-4 text-xs text-slate-500">本工具不是 MindStudio 的完整替代品。暂不支持压缩包、DB、聚合 op_statistic 或仅有 Host 事件的 trace。没有真实数据时可先加载明确标注的合成示例。</p></section>}
    {a&&<>
      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="采样摘要">{[['任务累计工作量',us(a.total),'所有所选调用时长之和'],['任务窗口跨度',us(a.span),'最早开始至最晚结束，非端到端'],['覆盖 / 未覆盖',`${us(a.busy)} / ${us(a.idle)}`,'未覆盖只表示所选任务未覆盖'],['任务重叠覆盖',us(a.overlap),`${a.count} 次调用 · ${a.groups.length} 个签名`]].map(([label,value,note])=><div className={panel} key={label}><p className="text-xs text-slate-400">{label}</p><p className="mt-2 break-words text-lg font-medium text-white">{value}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{note}</p></div>)}</div>
      <details className={`${panel} mt-4`}><summary className="cursor-pointer text-xs text-amber-200">数据口径与质量提示（{a.warnings.length}）</summary><ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-6 text-slate-400">{a.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist" aria-label="分析视图"><button role="tab" aria-selected={tab==='single'} className={button} onClick={()=>{setTab('single');setPage(0)}}>单份阶段与利用率</button><button role="tab" aria-selected={tab==='hotspots'} className={button} onClick={()=>{setTab('hotspots');setPage(0)}}>热点与优化优先级</button><button role="tab" aria-selected={tab==='compare'} className={button} onClick={()=>{setTab('compare');setPage(0)}}>A/B 回归对照</button></div><button className={`${button} flex items-center gap-2`} disabled={baseline.busy} onClick={download}><Download size={14}/>导出匿名统计</button></div>
      {exported&&<p role="status" className="mt-2 text-xs text-emerald-200">已导出数值统计，不含文件名、算子名称、shape、设备标识或原始时间戳。数值本身仍可能敏感，请按团队政策分享。</p>}
      {tab==='single'?<SingleProfileDiagnostics analysis={a} busy={baseline.busy} onChange={baseline.updateConfig}/>:tab==='hotspots'?<>
        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <section className={panel} aria-label="热点清单"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium text-white">按类型 + shape + dtype + format 分组</h2><select aria-label="热点排序" className="max-w-full rounded-lg border border-white/15 bg-[#0a111a] p-2 text-xs" value={sort} onChange={e=>{setSort(e.target.value);setPage(0)}}><option value="total">累计耗时优先</option><option value="exclusive">独占覆盖优先</option><option value="tail">长尾倍率优先</option></select></div>
            <div className="mt-4 max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-white/10 text-slate-500"><tr>{['热点 / Shape','次数','累计 / 占比','P50 / P95','独占覆盖'].map(s=><th className="px-2 py-2 font-normal" key={s}>{s}</th>)}</tr></thead><tbody>{groups.slice(page*20,page*20+20).map((g,i)=><tr key={g.key} className={`border-b border-white/5 ${g.key===chosen?.key?'bg-cyan-200/5':''}`}><td className="max-w-64 px-2 py-3"><button className="text-left text-cyan-100 hover:underline" aria-label={`查看热点 ${page*20+i+1} ${g.type}`} onClick={()=>setSelected(g.key)}>{g.type}</button><p className="mt-1 max-w-64 break-words font-mono text-[10px] text-slate-500">{g.shape||'shape 未知'} · {g.dtype||'dtype 未知'}</p></td><td className="px-2">{g.count}</td><td className="whitespace-nowrap px-2">{us(g.total)}<span className="block text-slate-500">{num(g.share*100)}%</span></td><td className="whitespace-nowrap px-2">{us(g.median)}<span className="block text-slate-500">{us(g.p95)}</span></td><td className="whitespace-nowrap px-2">{us(g.exclusive)}</td></tr>)}</tbody></table></div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">独占覆盖：只有该签名任务活跃、没有其他已选签名任务活跃的时间。不是关键路径，也不等于可消除时延。筛选越窄，该值越容易增大。</p>
          </section>
          {chosen&&<section className={`${panel} xl:sticky xl:top-20`} aria-label="热点详情"><h2 className="break-words text-lg font-medium text-white">{chosen.type}</h2><p className="mt-2 break-words font-mono text-xs leading-5 text-slate-400">{chosen.shape||'缺少 shape'}<br/>{chosen.dtype||'缺少 dtype'} · {chosen.format||'缺少 format'}</p><p className="mt-3 text-xs text-slate-400">最小 {us(chosen.min)} · 最大 {us(chosen.max)} · 均值 {us(chosen.mean)}</p>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-6 text-amber-100/75">{(chosen.findings.length?chosen.findings:['当前统计没有触发高频短任务或长尾规则；不表示已达到最优。']).map(s=><li key={s}>{s}</li>)}</ul>
            <div className="mt-4 border-t border-white/10 pt-4"><label className="text-xs text-slate-300">假设该组单次加速倍数<input aria-label="假设加速倍数" type="number" min="1" max="100" step="any" className={control} value={speedup} onChange={e=>setSpeedup(e.target.value)}/></label>{scenarioError&&<p className="mt-2 text-xs text-rose-200" role="alert">{scenarioError}</p>}{scenario&&<div className="mt-3 text-xs leading-6" data-testid="profile-whatif"><p>累计工作量减少 <span className="text-cyan-200">{us(scenario.saved)}</span></p><p>折算工作量加速比 {num(scenario.workSpeedup)}×</p><p className="text-slate-500">固定调用次数；不是端到端加速比。需要依赖关系和重叠变化才能判断实际收益。</p></div>}</div>
            <Link className="mt-4 inline-block text-xs text-cyan-200 underline underline-offset-4" to="/operators/estimate" onClick={()=>transferProfileSample({type:chosen.type,shape:chosen.shape,dtype:chosen.dtype,format:chosen.format,median:chosen.median})}>带入热点进行理论校核 →</Link>
          </section>}
        </div>
        <div className="mt-4"><Timeline analysis={a}/></div>
      </>:<section className={`${panel} mt-4`} aria-label="A/B 对照结果">
        {!b?<p className="text-sm text-slate-400">请导入候选 B，或等待其分析完成。</p>:<>
          <label className="flex items-start gap-2 text-xs leading-6 text-amber-100"><input type="checkbox" className="mt-1.5 accent-cyan-300" checked={comparable} onChange={e=>setComparable(e.target.checked)}/>我已核对 A/B 的硬件、软件、精度、阶段、负载及计时口径可比较</label>
          <p className="mt-3 text-xs leading-6 text-slate-400">A：{a.count} 次调用 · B：{b.count} 次调用 · 完整签名匹配 {diff?.matched} 组。还需核对 transpose、布局、融合和其他未记录属性；相同签名不保证语义相同。</p>
          {a.count!==b.count&&<p className="mt-2 text-xs text-amber-200">调用次数不同：总耗时差不能直接解释为 kernel 提速。</p>}
          {!comparable?<p className="mt-4 text-sm text-slate-400">确认可比性后展示回归统计，不自动把不同实验当作同一负载。</p>:<>
            <p className="mt-4 text-sm text-cyan-200" data-testid="profile-diff">匹配组按 A 调用次数折算的工作量变化：{us(diff!.normalizedDelta)}</p>
            <div className="mt-4 max-w-full overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-white/10 text-slate-500"><tr>{['签名 / 状态','次数 A → B','P50 B/A','按 A 次数折算变化','实际累计差'].map(s=><th key={s} className="px-2 py-2 font-normal">{s}</th>)}</tr></thead><tbody>{diff!.rows.slice(page*20,page*20+20).map(r=><tr key={r.key} className="border-b border-white/5"><td className="max-w-72 px-2 py-3"><p className="text-white">{r.type} · {r.status}</p><p className="mt-1 break-words text-[10px] text-slate-500">{r.shape||'缺少 shape'} · {r.dtype} · {r.format}</p></td><td className="whitespace-nowrap px-2">{r.before?.count??0} → {r.after?.count??0}</td><td className={`px-2 ${(r.medianRatio??1)>1.1?'text-rose-200':'text-slate-300'}`}>{r.medianRatio===null?'—':`${num(r.medianRatio)}×`}</td><td className="whitespace-nowrap px-2">{us(r.normalizedDelta)}</td><td className="whitespace-nowrap px-2">{us(r.observedDelta)}</td></tr>)}</tbody></table></div>
            <p className="mt-3 text-[11px] leading-6 text-slate-500">折算变化 = (B 均值 − A 均值) × A 次数；正值为工作量增加。只对完整匹配签名计算，不计新增/消失组；不是端到端差值或显著性检验。P50 比率与均值变化可能因长尾不同而方向不一致。</p>
          </>}
          <details className="mt-4 text-xs"><summary className="cursor-pointer text-amber-200">候选 B 数据提示</summary><ul className="mt-2 list-disc pl-4 leading-6 text-slate-400">{b.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
        </>}
      </section>}
      {tab!=='single'&&pageCount>1&&<div className="mt-4 flex items-center justify-center gap-3 text-xs"><button className={button} disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page+1} / {pageCount}</span><button className={button} disabled={page+1>=pageCount} onClick={()=>setPage(p=>p+1)}>下一页</button></div>}
    </>}
    <details className={`${panel} mt-5`}><summary className="cursor-pointer text-sm text-white">采集建议、支持格式与分析边界</summary><div className="mt-3 space-y-3 text-xs leading-6 text-slate-400"><p>CSV 需要 Name / OP Type、Duration(us) / Task Duration(us)。Start Time(us)、Device ID、Stream ID、Step ID、Input Shapes / Data Types / Formats 用于细分分析。无起始时间仍可聚合，但不能报告时间重叠。未知列忽略；aicore_time 不能替代任务时长。JSON 仅解析 Ascend Hardware 设备进程或 kernel 类别中的完整 X 事件，不混入 Python/CANN Host API。</p><p>先预热，再采稳态；prefill 与 decode 分开比较。需要管线证据时按 profiling 规范使用 Level1 + PipeUtilization，另按需采 Memory / L2Cache。本版不会仅凭单个利用率阈值自动判定 compute-bound 或 memory-bound。</p><p>不从时间先后推断依赖，不声称识别关键路径。未覆盖时间可能有采样遗漏、Host 工作、等待或过滤掉的任务，并不直接等同于设备空闲。A/B 建议多次独立重复；组内调用分位数不能代替实验间置信区间。</p><p>解析在 Web Worker 内完成。替换文件、清空或离开性能板块会终止线程；板块内切换保留内存分析；不发送文件到网络、不写 localStorage/URL。只主动导出匿名数值统计；仍须注意业务性能数值的保密要求。</p><p>字段参考：<a className="text-cyan-200 underline" href="https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta2/devaids/Profiling/atlasprofiling_16_0067.html" target="_blank" rel="noreferrer">CANN 逐任务指标说明</a> · <a className="text-cyan-200 underline" href="https://www.hiascend.com/document/detail/en/mindstudio/2610/visualization_tool/MindStudioInsight/docs/en/user_guide/system_tuning.md" target="_blank" rel="noreferrer">MindStudio Insight 分析视图</a></p></div></details>
  </div>
}
