import { useEffect, useState } from 'react'
import type { ProfileAnalysis } from '@/lib/profile-analysis'
import { defaultDiagnosticConfig, pipeLabels, pipeMetrics, type DiagnosticConfig, type Phase, type PhaseBucket } from '@/lib/profile-diagnostics'

const panel='min-w-0 rounded-2xl border border-white/10 bg-[#0e1620] p-4 sm:p-5'
const control='mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-[#0a111a] px-3 py-2 text-sm text-white'
const button='rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:border-cyan-300 disabled:opacity-40'
const num=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2})
const us=(n:number|null)=>n===null?'未知':Math.abs(n)>=1000?`${num(n/1000)} ms`:`${num(n)} µs`
const labels:Record<PhaseBucket,string>={prefill:'Prefill',decode:'Decode',conflict:'阶段冲突',unassigned:'未归属阶段'}
const palette=['#67e8f9','#a5b4fc','#fbbf24','#6ee7b7','#fda4af','#d8b4fe','#94a3b8']

export default function SingleProfileDiagnostics({analysis:a,busy,onChange}:{analysis:ProfileAnalysis;busy:boolean;onChange:(c:DiagnosticConfig)=>void}) {
  const d=a.diagnostics
  const [draft,setDraft]=useState(d.config),[phase,setPhase]=useState<PhaseBucket>('prefill'),[metricPage,setMetricPage]=useState(0)
  const [manual,setManual]=useState<Phase>('prefill'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[error,setError]=useState('')
  const [groupPage,setGroupPage]=useState(0),[onlyLow,setOnlyLow]=useState(false)
  useEffect(()=>{setDraft(d.config);setMetricPage(0);setGroupPage(0)},[d])
  const update=<K extends keyof DiagnosticConfig>(key:K,value:DiagnosticConfig[K])=>setDraft(s=>({...s,[key]:value}))
  const selected=d.phases.find(p=>p.phase===phase)!
  const rows=onlyLow?d.utilization.filter(r=>r.lowCalls>0):d.utilization
  const top=selected.groups.slice(0,6),rest=selected.groups.slice(6).reduce((s,g)=>s+g.work,0)
  const chart=[...top.map(g=>({label:g.type,work:g.work,share:g.share})),...(rest?[{label:'其他',work:rest,share:rest/selected.work}]:[])]
  const addManual=()=>{
    const start=Number(from),end=Number(to)
    if(!from.trim()||!to.trim()||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>a.end){setError('请输入设备范围内的有效起止时间：0 ≤ 起点 < 终点。');return}
    update('manual',[...draft.manual,{phase:manual,from:start,to:end}]);setFrom('');setTo('');setError('')
  }
  return <div className="mt-4 space-y-4" role="region" aria-label="单份采样诊断" aria-busy={busy}>
    {busy&&<p role="status" className="text-xs text-cyan-200">正在重新计算，以下保留上次结果；完成后统一更新。</p>}
    <section className={panel} aria-label="阶段与指标设置">
      <h2 className="text-base font-medium text-white">单份采样 · 阶段与利用率</h2>
      <p className="mt-2 text-xs leading-6 text-slate-400">只需基线 A。阶段时长来自明确标记或手动区间；低活跃清单来自实际计数器。缺失指标保持未知，不补零。</p>
      <details className="mt-3" open={d.phaseBasis==='none'}><summary className="cursor-pointer text-xs text-cyan-200">设置阶段来源与计数器口径</summary>
        <fieldset disabled={busy} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0 text-xs text-slate-400">Host 标记线程<select className={control} aria-label="Host 标记线程" value={draft.hostSource} onChange={e=>setDraft(s=>({...s,hostSource:e.target.value,aligned:false,prefillName:'',decodeName:'',scheduleName:''}))}><option value="">不使用 Host 标记</option>{d.sources.map(s=><option key={s.id} value={s.id}>{s.id} · {s.count} 条</option>)}</select></label>
            {(['prefillName','decodeName','scheduleName'] as const).map((key,i)=><label className="min-w-0 text-xs text-slate-400" key={key}>{['Prefill 标记','Decode 标记','调度标记'][i]}<select aria-label={['Prefill 标记','Decode 标记','调度标记'][i]} className={control} value={draft[key]} onChange={e=>update(key,e.target.value)}><option value="">识别标准阶段 / scheduler 名称</option>{(d.sources.find(s=>s.id===draft.hostSource)?.names??[]).map(n=><option key={n} value={n}>{n}</option>)}</select></label>)}
          </div>
          <label className="flex items-start gap-2 text-xs leading-6 text-amber-100"><input className="mt-1.5 accent-cyan-300" type="checkbox" checked={draft.aligned} onChange={e=>update('aligned',e.target.checked)} disabled={!draft.hostSource}/>我已确认所选 Host 线程属于当前设备/请求、时间戳同域且已对齐；阶段标记涵盖设备执行，而不只是异步提交</label>
          <p className="text-[11px] leading-5 text-slate-500">更换设备需重新确认。CPU forward 返回不等于设备完成；不确认时不使用 Host 阶段或调度事件。不从 kernel 名称推断阶段。</p>
          <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-xs text-cyan-200">手动标注阶段（覆盖自动标记）</summary>
            <p className="mt-2 text-xs leading-6 text-slate-400">相对设备最早任务：0–{num(a.end)} µs。可逐条添加 Decode step；重叠区间会提示，未标注部分保留。</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs">阶段<select className={control} aria-label="手动阶段类型" value={manual} onChange={e=>setManual(e.target.value as Phase)}><option value="prefill">Prefill</option><option value="decode">Decode</option></select></label>
              <label className="text-xs">起点 µs<input className={control} aria-label="阶段起点" type="number" min="0" step="any" value={from} onChange={e=>setFrom(e.target.value)}/></label>
              <label className="text-xs">终点 µs<input className={control} aria-label="阶段终点" type="number" min="0" step="any" value={to} onChange={e=>setTo(e.target.value)}/></label>
              <button className={`${button} self-end`} onClick={addManual} disabled={draft.manual.length>=1000}>添加阶段</button>
            </div>
            <ul className="mt-3 max-h-44 space-y-2 overflow-auto text-xs">{draft.manual.map((r,i)=><li className="flex items-center justify-between gap-2" key={i}><span>{labels[r.phase]} · {num(r.from)}–{num(r.to)} µs</span><button className={button} aria-label={`删除阶段 ${i+1}`} onClick={()=>update('manual',draft.manual.filter((_,j)=>j!==i))}>删除</button></li>)}</ul>
          </details>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-400">无单位 ratio 的取值范围<select aria-label="Ratio 单位" className={control} value={draft.ratioUnit} onChange={e=>update('ratioUnit',e.target.value as DiagnosticConfig['ratioUnit'])}><option value="auto">未确认：只使用明确 % 字段</option><option value="fraction">确认 0–1（例如 0.25 = 25%）</option><option value="percent">确认 0–100（例如 25 = 25%）</option></select></label>
            <label className="text-xs text-slate-400">低活跃观察指标<select aria-label="流水线指标" className={control} value={draft.metric} onChange={e=>update('metric',e.target.value as DiagnosticConfig['metric'])}><option value="auto">按算子类型建议 Cube / Vector</option>{pipeMetrics.map(m=><option key={m} value={m}>{pipeLabels[m]}</option>)}</select></label>
            <label className="text-xs text-slate-400">低活跃阈值 %<input aria-label="低活跃阈值" className={control} type="number" min="0" max="100" step="any" value={Number.isNaN(draft.threshold)?'':draft.threshold} onChange={e=>update('threshold',e.target.value===''?NaN:Number(e.target.value))}/></label>
          </div>
          <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>{if(!Number.isFinite(draft.threshold)||draft.threshold<0||draft.threshold>100){setError('低活跃阈值须为 0–100%。');return}setError('');onChange(draft)}}>应用诊断设置</button><button className={button} onClick={()=>{setDraft(defaultDiagnosticConfig());setError('');onChange(defaultDiagnosticConfig())}}>重置诊断设置</button></div>
          {error&&<p role="alert" className="text-xs text-rose-200">{error}</p>}
        </fieldset>
      </details>
    </section>
    <section className={panel} aria-label="阶段计时">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium text-white">阶段计时</h2><span className="text-xs text-slate-400">依据：{{manual:'手动时间区间',annotations:'已确认 Host 标记','task-labels':'Phase + Step 任务包络',none:'尚未标注'}[d.phaseBasis]}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(['prefill','decode'] as const).map(p=>{const row=d.phases.find(r=>r.phase===p)!;return <div className="rounded-xl bg-white/5 p-3" key={p}><p className="text-xs text-slate-400">{labels[p]} 阶段区间并集</p><output data-testid={`phase-${p}-wall`} data-us={row.wall??''} className="mt-2 block text-xl text-cyan-100">{us(row.wall)}</output><p className="mt-2 text-xs leading-5 text-slate-500">任务覆盖 {us(row.busy)} · 未覆盖 {us(row.uncovered)}</p></div>})}
        <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">Decode 单步 P50 / P95</p><output data-testid="decode-step-statistics" className="mt-2 block text-lg text-white">{us(d.iterations.p50)} / {us(d.iterations.p95)}</output><p className="mt-2 text-xs text-slate-500">{d.iterations.count} 个可分离区间 · 最大 {us(d.iterations.max)}</p></div>
        <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">阶段间调度事件覆盖</p><output data-testid="phase-scheduling" data-us={d.scheduling.betweenPhases??''} className="mt-2 block text-xl text-amber-100">{us(d.scheduling.betweenPhases)}</output><p className="mt-2 text-xs leading-5 text-slate-500">阶段间隔 {us(d.scheduling.phaseGap)} · 无调度记录覆盖 {us(d.scheduling.unrecordedGap)}</p></div>
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-400">所选窗口内调度事件总覆盖：{us(d.scheduling.recorded)}。调度与设备执行可能重叠，不能相加。阶段时长不是请求 TTFT / TPOT；推测解码或连续批处理下，一步不一定对应一个输出 token。</p>
    </section>
    <section className={panel} aria-label="阶段算子占比">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium text-white">阶段内算子分布</h2><label className="text-xs">观察阶段<select aria-label="观察阶段" className={control} value={phase} onChange={e=>{setPhase(e.target.value as PhaseBucket);setGroupPage(0)}}>{d.phases.map(p=><option key={p.phase} value={p.phase}>{labels[p.phase]} · {us(p.work)}</option>)}</select></label></div>
      <p className="mt-2 text-xs leading-6 text-slate-400">分母为该阶段算子累计耗时 {us(selected.work)}，不是墙钟时长。跨边界任务仅计落入阶段的片段（{selected.clipped} 个），不用于单次时延分位数。并行任务的累计耗时可能超过阶段时长。</p>
      {chart.length?<figure className="mt-4" aria-label={`${labels[phase]} 算子累计耗时占比图`}>
        <div className="flex h-5 overflow-hidden rounded" aria-hidden="true">{chart.map((g,i)=><span key={i} style={{width:`${100*g.share}%`,background:palette[i]}}/>)}</div>
        <figcaption className="mt-3 space-y-3">{chart.map((g,i)=><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs" key={i}><span className="min-w-0 break-words">{g.label}</span><span className="font-mono text-slate-400">{us(g.work)} · {num(100*g.share)}%</span><div className="col-span-2 h-1.5 overflow-hidden rounded bg-white/5"><div className="h-full" style={{width:`${100*g.share}%`,background:palette[i]}}/></div></div>)}</figcaption>
      </figure>:<p className="mt-4 text-xs text-amber-100">此阶段暂无已归属任务。请完成阶段设置，或查看“未归属阶段”。</p>}
      <details className="mt-4"><summary className="cursor-pointer text-xs text-cyan-200">阶段内完整分组（{selected.groups.length}）</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['类型 / Shape','片段数','累计耗时','占比'].map(s=><th className="p-2 font-normal text-slate-500" key={s}>{s}</th>)}</tr></thead><tbody>{selected.groups.slice(groupPage*20,groupPage*20+20).map(g=><tr key={g.key} className="border-t border-white/5"><td className="max-w-72 break-words p-2">{g.type}<p className="mt-1 text-[10px] text-slate-500">{g.shape||'未知 shape'}</p></td><td className="p-2">{g.calls}</td><td className="whitespace-nowrap p-2">{us(g.work)}</td><td className="p-2">{num(g.share*100)}%</td></tr>)}</tbody></table></div>{selected.groups.length>20&&<div className="mt-3 flex gap-3 text-xs"><button className={button} disabled={!groupPage} onClick={()=>setGroupPage(p=>p-1)}>上一组</button><span>{groupPage+1} / {Math.ceil(selected.groups.length/20)}</span><button className={button} disabled={(groupPage+1)*20>=selected.groups.length} onClick={()=>setGroupPage(p=>p+1)}>下一组</button></div>}</details>
    </section>
    <section className={panel} aria-label="低活跃算子清单">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium text-white">低流水线活跃候选 · 按低活跃调用耗时排序</h2><label className="flex gap-2 text-xs"><input type="checkbox" checked={onlyLow} onChange={e=>{setOnlyLow(e.target.checked);setMetricPage(0)}}/>仅看低于阈值的组</label></div>
      <p className="mt-2 text-xs leading-6 text-slate-400">范围：全部当前筛选任务，不随上方观察阶段切换。{d.counterCalls} / {a.count} 个调用带支持的计数器。阈值 {num(d.config.threshold)}%；均值按有效样本的任务时长加权，不是全芯片 FLOPS 利用率。缺失项不补零；低活跃耗时不是可直接节省的时长。</p>
      <p className="mt-2 text-[11px] leading-5 text-amber-100/70">自动建议只把 MatMul/GEMM 对应 Cube、Norm/Softmax 等对应 Vector；融合或未知算子请手动选择指标。Vector 算子的 Cube 为 0 通常正常。MTE 活跃率不等于带宽利用率，单项阈值不能判定根因。</p>
      <p className="mt-3 text-[11px] text-slate-500 sm:hidden">左右滑动表格查看完整指标 →</p>
      <div className="mt-4 overflow-x-auto" tabIndex={0} role="group" aria-label="可横向滚动的流水线指标表"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr>{['算子 / Shape','指标','加权活跃率','有效调用 / 总调用','有效耗时覆盖','低活跃调用耗时'].map(s=><th className="whitespace-nowrap px-2 py-2 font-normal text-slate-500" key={s}>{s}</th>)}</tr></thead><tbody>{rows.slice(metricPage*20,metricPage*20+20).map(r=><tr className="border-t border-white/5" key={`${r.key}/${r.metric}`}><td className="max-w-64 break-words p-2">{r.type}<p className="mt-1 text-[10px] text-slate-500">{r.shape||'未知 shape'}</p></td><td className="whitespace-nowrap p-2">{pipeLabels[r.metric]}</td><td className="p-2 text-cyan-100">{r.mean===null?'未知':`${num(r.mean)}%`}</td><td className="p-2">{r.samples} / {r.calls}</td><td className="p-2">{num(r.totalWork?100*r.measuredWork/r.totalWork:0)}%</td><td className="whitespace-nowrap p-2">{r.samples?us(r.lowWork):'未知'}<p className="text-slate-500">{r.lowCalls} 次</p></td></tr>)}</tbody></table></div>
      {!rows.length&&<p className="mt-3 text-xs text-amber-100">没有符合当前条件的候选；这不代表已达到硬件最优。</p>}
      {rows.length>20&&<div className="mt-3 flex items-center gap-3 text-xs"><button className={button} disabled={!metricPage} onClick={()=>setMetricPage(p=>p-1)}>上一页指标</button><span>{metricPage+1} / {Math.ceil(rows.length/20)}</span><button className={button} disabled={(metricPage+1)*20>=rows.length} onClick={()=>setMetricPage(p=>p+1)}>下一页指标</button></div>}
    </section>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className={panel} aria-label="Decode 步时延分布"><h2 className="text-sm font-medium text-white">Decode 步时延与抖动</h2><p className="mt-2 text-xs leading-6 text-slate-400">红色表示 &gt; 2×P50，仅为长尾提示，不证明异常原因。展示前 200 步，分位数使用全部可分离区间。</p>
        {d.iterations.rows.length?<><div className="mt-4 flex h-24 items-end gap-0.5 overflow-hidden" role="img" aria-label={`Decode ${d.iterations.count} 步时延柱状图，P50 ${us(d.iterations.p50)}，P95 ${us(d.iterations.p95)}`}>{d.iterations.rows.map((r,i)=><div className={`min-w-0 flex-1 rounded-t ${r.outlier?'bg-rose-300':'bg-cyan-300/70'}`} key={i} style={{height:`${100*r.duration/(d.iterations.max||1)}%`}} title={`区间 ${i+1} · 相对 ${us(r.start)} · 时长 ${us(r.duration)}`}/>)}</div><details className="mt-3"><summary className="cursor-pointer text-xs text-cyan-200">查看步时延数值{d.iterations.truncated?'（前 200 步）':''}</summary><ol className="mt-2 max-h-48 list-inside list-decimal overflow-auto text-xs leading-6 text-slate-400">{d.iterations.rows.map((r,i)=><li key={i}>起点 {us(r.start)} · 时长 {us(r.duration)}{r.outlier?' · 长尾':''}</li>)}</ol></details></>:<p className="mt-4 text-xs text-amber-100">尚无可分离的 Decode 步区间。</p>}
      </section>
      <section className={panel} aria-label="设备任务间隙"><h2 className="text-sm font-medium text-white">设备任务未覆盖区间 · Top 20</h2><p className="mt-2 text-xs leading-6 text-slate-400">共 {d.gaps.count} 段 · {us(d.gaps.total)}。仅指所选任务没有覆盖；可能是调度、等待、遗漏或筛选结果，不能全部当成调度开销。</p><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['相对起点','时长','调度记录交集'].map(s=><th className="p-2 font-normal text-slate-500" key={s}>{s}</th>)}</tr></thead><tbody>{d.gaps.rows.map((r,i)=><tr className="border-t border-white/5" key={i}><td className="p-2">{us(r.start)}</td><td className="p-2">{us(r.duration)}</td><td className="p-2">{us(r.schedule)}</td></tr>)}</tbody></table></div></section>
    </div>
    {!!d.warnings.length&&<section className={panel} aria-label="单份诊断数据提示"><h2 className="text-xs text-amber-100">证据与缺失项</h2><ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-6 text-slate-400">{d.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></section>}
  </div>
}
