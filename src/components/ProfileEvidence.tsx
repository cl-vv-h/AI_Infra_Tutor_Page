import { useMemo, useState } from 'react'
import type { ProfileAnalysis } from '@/lib/profile-analysis'
import type { ProfileSummaryTable } from '@/lib/profile-bundle'
import { pipeLabels } from '@/lib/profile-diagnostics'

const panel='min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5'
const button='min-h-11 rounded-lg border border-line px-3 py-2 text-xs text-secondary hover:border-accent disabled:opacity-40'
const input='min-h-11 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink'
const num=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:2})
const us=(v:number|null|undefined)=>v==null?'未知':v>=1000?`${num(v/1000)} ms`:`${v.toLocaleString('en-US',{maximumFractionDigits:3})} µs`
const labels={operators:'算子统计',api:'Host API',framework:'框架算子',steps:'Step 汇总'} as const

export function ProfilePipelines({analysis,groupKey}:{analysis:ProfileAnalysis;groupKey:string}){
  const rows=analysis.hardware.pipelines.filter(r=>r.key===groupKey)
  return <section className="mt-4 border-t border-line pt-4" aria-label="热点流水线指标">
    <h3 className="text-sm font-medium text-ink">流水线与计数器</h3>
    <p className="mt-2 text-xs leading-5 text-muted">按有效调用时长加权；覆盖率以本组任务时长为分母。流水线可以重叠，百分比不能相加。MAC 活跃占比与 Cube 利用率是不同指标。</p>
    {!rows.length?<p className="mt-3 text-xs text-muted">该热点没有可用计数器。请联合导入 kernel_details.csv；采集时按需启用 Level1 + PipeUtilization。</p>:<ul className="mt-3 space-y-3">{rows.map(r=><li key={r.metric} className="text-xs">
      <div className="flex flex-wrap justify-between gap-2"><span>{pipeLabels[r.metric]}</span><span className="font-mono text-ink">{r.mean===null?'单位未确认 / 无有效值':`${num(r.mean)}%`}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-raised"><div className="h-full bg-accent" style={{width:`${r.mean??0}%`}}/></div>
      <p className="mt-1 text-muted">{r.samples} / {r.calls} 次有效 · 时长覆盖 {num(r.work?r.measuredWork/r.work*100:0)}%</p>
    </li>)}</ul>}
  </section>
}

function SummaryTables({tables}:{tables:ProfileSummaryTable[]}){
  const [kind,setKind]=useState<ProfileSummaryTable['kind']>('operators'),[query,setQuery]=useState(''),[page,setPage]=useState(0)
  const table=tables.find(t=>t.kind===kind)
  const rows=useMemo(()=>[...(table?.rows??[])].filter(r=>`${r.name} ${r.category} ${r.device}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.total??b.hostSelf??b.values?.Stage??0)-(a.total??a.hostSelf??a.values?.Stage??0)),[table,query])
  const count=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,count-1)
  return <section className={panel} aria-label="独立汇总证据">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-medium text-ink">Host 与独立汇总证据</h2><select aria-label="汇总证据类型" className={input} value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(0)}}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v} · {tables.find(t=>t.kind===k)?.rows.length??0} 行</option>)}</select></div>
    <p className="mt-2 text-xs leading-6 text-muted">以下是整份采样的独立视图，不随上方设备、时间或任务筛选变化，也不与设备任务时长累加。Host Self 不含子调用，Host Total 包含子调用；重叠调用不能相加为端到端时延。</p>
    {kind==='steps'&&<p className="mt-2 text-xs leading-6 text-muted">保留官方字段口径，原始 µs 按数值大小显示为 µs / ms。空 Step 仅表示采样汇总，不伪造逐步统计。Free 不是纯设备空闲；Communication=0 不排除融合算子内部通信。</p>}
    <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary">搜索名称 / 类别 / 设备<input aria-label="汇总证据搜索" className={`${input} flex-1`} value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label>
    {!table?<p className="mt-4 text-sm text-muted">未导入此表；可以选择同一采样的完整输出目录以补齐。</p>:<>
      <p className="mt-3 text-xs text-muted">{rows.length} 行匹配 · 原表保留 {table.rows.length} 行 · 拒绝 {table.rejected} 行</p>
      <div className="mt-3 overflow-x-auto" role="region" aria-label={`${labels[kind]}数据表`} tabIndex={0}><table className="w-full text-left text-xs"><thead><tr>{(kind==='framework'?['名称','Host Self','Host Total','Device Self','Device Total']:kind==='steps'?['Step / 设备','字段','时间']:['名称 / 设备 / 类别','次数','累计','均值','最小 / 最大']).map(s=><th key={s} className="whitespace-nowrap p-2 font-normal text-muted">{s}</th>)}</tr></thead><tbody>{rows.slice(current*20,current*20+20).map((r,i)=><tr key={i} className="border-t border-line">
        <td className="min-w-48 max-w-80 break-words p-2"><span className="text-ink">{r.name}</span><span className="mt-1 block text-muted">{[r.device&&`设备 ${r.device}`,r.category].filter(Boolean).join(' · ')}</span></td>
        {kind==='framework'?([r.hostSelf,r.hostTotal,r.deviceSelf,r.deviceTotal].map((v,i)=><td key={i} className="whitespace-nowrap p-2 font-mono">{us(v)}</td>)):kind==='steps'?<><td className="whitespace-nowrap p-2">{Object.keys(r.values??{}).map(k=><div key={k} className="py-1">{k}</div>)}</td><td className="whitespace-nowrap p-2 font-mono">{Object.entries(r.values??{}).map(([k,v])=><div key={k} className="py-1">{us(v)}</div>)}</td></>:<><td className="p-2">{r.count??'未知'}</td><td className="whitespace-nowrap p-2 font-mono">{us(r.total)}</td><td className="whitespace-nowrap p-2 font-mono">{us(r.mean)}</td><td className="whitespace-nowrap p-2 font-mono">{us(r.min)} / {us(r.max)}</td></>}
      </tr>)}</tbody></table></div>
      <div className="mt-3 flex items-center justify-center gap-3 text-xs"><button className={button} disabled={current===0} onClick={()=>setPage(current-1)}>汇总上一页</button><span>{current+1} / {count}</span><button className={button} disabled={current+1>=count} onClick={()=>setPage(current+1)}>汇总下一页</button></div>
    </>}
  </section>
}

export default function ProfileEvidence({analysis:a,onHotspot}:{analysis:ProfileAnalysis;onHotspot:(key:string)=>void}){
  const h=a.hardware,e=h.evidence
  const [showAll,setShowAll]=useState(false),[fileQuery,setFileQuery]=useState('')
  const files=(e?.files??[]).filter(f=>`${f.name} ${f.note}`.toLowerCase().includes(fileQuery.toLowerCase()))
  return <div className="mt-4 space-y-4" aria-label="数据与诊断总览">
    <section className={panel} aria-label="任务完整性">
      <h2 className="text-base font-medium text-ink">导入对账与任务构成</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['所选硬件记录',h.records],['执行任务',h.execution],['等待事件',h.waits],['控制事件',h.controls]].map(([label,v])=><div key={label} className="rounded-lg bg-raised p-3"><p className="text-xs text-muted">{label}</p><output className="mt-1 block font-mono text-lg text-ink">{num(Number(v))}</output></div>)}</div>
      <p className="mt-3 text-xs leading-6 text-secondary">硬件记录 = 执行 + 等待 + 控制。热点工作量与执行覆盖只统计执行任务；等待和图执行包络不重复算作计算任务。</p>
      {e?<p className="mt-2 text-xs leading-6 text-muted" data-testid="profile-import-reconciliation">整份导入保留 {num(e.hardwareRecords)} 条唯一设备记录；{num(e.joinedKernels)} / {num(e.kernelRecords)} 条 Kernel 明细已关联至设备时间线；保留 {num(e.annotations)} 条 Host 标记。下方文件表与 Host 汇总保持整份采样口径。</p>:<p className="mt-2 text-xs leading-6 text-muted">当前为单文件或示例。导入同一目录的 Kernel + Trace 可以关联 Shape、流水线指标和等待记录；单文件不会推测缺失内容。</p>}
      <details className="mt-3"><summary className="cursor-pointer text-xs text-accent">按硬件任务类型核对</summary><div className="mt-2 overflow-x-auto" role="region" aria-label="硬件任务类型表" tabIndex={0}><table className="w-full text-left text-xs"><thead><tr>{['类型','用途','记录数','累计时长（非墙钟）'].map(s=><th key={s} className="p-2 font-normal text-muted">{s}</th>)}</tr></thead><tbody>{h.taskTypes.map(r=><tr key={`${r.name}/${r.role}`} className="border-t border-line"><td className="break-words p-2">{r.name}</td><td className="p-2">{{execution:'执行',wait:'等待',control:'控制'}[r.role]}</td><td className="p-2">{num(r.count)}</td><td className="whitespace-nowrap p-2">{us(r.work)}</td></tr>)}</tbody></table></div></details>
      {e&&<details className="mt-3"><summary className="cursor-pointer text-xs text-accent">导入文件清单 · {e.files.length} 个文件</summary><input aria-label="导入文件搜索" placeholder="搜索文件或处理说明" className={`${input} mt-3 w-full`} value={fileQuery} onChange={ev=>setFileQuery(ev.target.value)}/><div className="mt-3 max-h-80 overflow-auto" role="region" aria-label="导入文件处理结果" tabIndex={0}><table className="w-full text-left text-xs"><thead><tr>{['文件','状态','保留 / 拒绝','处理说明'].map(s=><th key={s} className="p-2 font-normal text-muted">{s}</th>)}</tr></thead><tbody>{files.slice(0,200).map((f,i)=><tr key={i} className="border-t border-line"><td className="max-w-48 break-all p-2">{f.name}</td><td className="whitespace-nowrap p-2">{{read:'已读取',duplicate:'去重',unsupported:'未读取'}[f.status]}</td><td className="whitespace-nowrap p-2">{f.retained??'—'} / {f.rejected??'—'}</td><td className="min-w-48 p-2 leading-5">{f.note}</td></tr>)}</tbody></table></div>{files.length>200&&<p className="mt-2 text-xs text-muted">当前显示前 200 个匹配文件，请搜索缩小范围。</p>}</details>}
    </section>
    <section className={panel} aria-label="优化候选证据">
      <h2 className="text-base font-medium text-ink">优先排查项 · {h.candidates.length}</h2><p className="mt-2 text-xs leading-6 text-muted">规则命中的测量信号，不是已证实的根因。按涉及的任务累计时长或等待未覆盖时长排序，两者不是可直接相加的性能损失。</p>
      {!h.candidates.length?<p className="mt-3 text-sm text-muted">未触发当前诊断规则；请查看主要热点与数据缺项，不代表性能已最优。</p>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{h.candidates.slice(0,showAll?30:6).map(c=><article key={c.key} className="min-w-0 rounded-lg border border-line p-4"><h3 className="break-words text-sm font-medium text-ink">{c.title}</h3><p className="mt-2 text-xs leading-6 text-secondary">{c.evidence}</p><p className="mt-2 text-xs leading-6 text-muted">下一步：{c.next}</p>{c.groupKey&&<button className={`${button} mt-3 text-accent`} onClick={()=>onHotspot(c.groupKey!)}>查看热点与计数器</button>}</article>)}</div>}
      {h.candidates.length>6&&<button className={`${button} mt-3`} onClick={()=>setShowAll(!showAll)}>{showAll?'收起其余候选':'展开全部候选'}</button>}
      <div className="mt-4 border-t border-line pt-3"><h3 className="text-sm text-ink">主要执行热点</h3><div className="mt-2 flex flex-wrap gap-2">{a.groups.slice(0,5).map(g=><button key={g.key} className={button} onClick={()=>onHotspot(g.key)}>{g.type} · {num(g.share*100)}%</button>)}</div></div>
    </section>
    <section className={panel} aria-label="同步等待分析"><h2 className="text-base font-medium text-ink">同步等待</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{[['累计等待时长',h.waitWork],['等待区间并集',h.waitCoverage],['未被执行覆盖的等待',h.waitOutsideExecution]].map(([label,v])=><div key={label} className="rounded-lg bg-raised p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-mono text-lg text-ink">{us(v as number|null)}</p></div>)}</div><p className="mt-3 text-xs leading-6 text-muted">累计等待可以跨 Stream 重叠；并集才去除了重叠。未被执行覆盖仅相对于当前筛选，不能等同通信瓶颈、关键路径或可消除时延。没有完整时间戳时显示未知。</p></section>
    <details className={panel}><summary className="cursor-pointer text-sm text-accent">Host 与汇总证据 · {h.markers.length} 组阶段标记 · {e?.tables.length??0} 张汇总表</summary><div className="mt-4 space-y-4">
    <section className={panel} aria-label="原始阶段标记"><h2 className="text-base font-medium text-ink">Host 阶段标记</h2><p className="mt-2 text-xs leading-6 text-muted">保留原始名称（包括 TARGET_VERIFY），不按首步推断 Prefill / Decode。这是整份采样的 Host 区间统计，不是设备 forward 时延；只有确认来源和时钟关系后，才能在阶段视图中关联设备任务。</p>{!h.markers.length?<p className="mt-3 text-sm text-muted">未发现已识别命名的阶段标记；可以在阶段视图手动映射其他 Host 名称。</p>:<div className="mt-3 max-h-72 overflow-auto" role="region" aria-label="Host 阶段标记表" tabIndex={0}><table className="w-full text-left text-xs"><thead><tr>{['标记 / 来源','次数','P50','P95','区间并集'].map(s=><th key={s} className="whitespace-nowrap p-2 font-normal text-muted">{s}</th>)}</tr></thead><tbody>{h.markers.map(m=><tr key={`${m.name}/${m.source}`} className="border-t border-line"><td className="min-w-48 break-all p-2">{m.name}<span className="mt-1 block text-muted">{m.source}</span></td><td className="p-2">{m.count}</td>{[m.p50,m.p95,m.coverage].map((v,i)=><td key={i} className="whitespace-nowrap p-2">{us(v)}</td>)}</tr>)}</tbody></table></div>}</section>
    {!!h.summaries.reconciliation.length&&<section className={panel} aria-label="算子汇总对账"><h2 className="text-base font-medium text-ink">算子汇总与设备明细对账</h2><p className="mt-2 text-xs leading-6 text-muted">整份采样按设备 + 算子类型对账，跨核类型合计；{h.summaries.reconciliation.filter(r=>r.status==='matched').length} / {h.summaries.reconciliation.length} 组次数和累计时长一致。时间容差取 1 µs 与汇总值的 0.1% 中较大者。不一致需核对导出范围、类型命名和缺失记录。</p><details className="mt-3"><summary className="cursor-pointer text-xs text-accent">查看各组对账结果</summary><div className="mt-3 max-h-80 overflow-auto" role="region" aria-label="算子汇总对账表" tabIndex={0}><table className="w-full text-left text-xs"><thead><tr>{['算子 / 设备','状态','次数：汇总 / 明细','时长：汇总 / 明细'].map(s=><th key={s} className="whitespace-nowrap p-2 font-normal text-muted">{s}</th>)}</tr></thead><tbody>{h.summaries.reconciliation.map(r=><tr key={`${r.device}/${r.name}`} className="border-t border-line"><td className="min-w-40 break-all p-2">{r.name} / {r.device||'未标注'}</td><td className="whitespace-nowrap p-2">{{matched:'一致',missing:'无同名明细',different:'有差异'}[r.status]}</td><td className="whitespace-nowrap p-2">{r.calls} / {r.detailCalls??'未知'}</td><td className="whitespace-nowrap p-2">{us(r.work)} / {us(r.detailWork)}</td></tr>)}</tbody></table></div></details></section>}
    {!!h.summaries.hostSignals.length&&<section className={panel} aria-label="Host 排查线索"><h2 className="text-base font-medium text-ink">Host 排查线索</h2><p className="mt-2 text-xs leading-6 text-muted">基于整份采样的 Host 汇总，不受设备筛选影响；按各自口径排名，不与设备工作量相加。只保留名称和数值，不保留调用栈。</p><div className="mt-3 grid gap-3 lg:grid-cols-2">{h.summaries.hostSignals.map((s,i)=><article key={i} className="rounded-lg border border-line p-3"><p className="text-xs text-muted">{s.basis}</p><h3 className="mt-1 break-all text-sm text-ink">{s.name}</h3><p className="mt-2 text-xs text-secondary">{num(s.calls)} 次 · {us(s.work)} · 同口径累计占比 {num(s.share*100)}%</p><p className="mt-2 text-xs leading-6 text-muted">{s.next}</p></article>)}</div></section>}
    <SummaryTables tables={e?.tables??[]}/>
    </div></details>
  </div>
}
