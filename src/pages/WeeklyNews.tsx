import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import TableOfContents from '@/components/TableOfContents'
import NewsFreshness from '@/components/NewsFreshness'
import latest from '@/data/news/weekly/latest.json'
import index from '@/data/news/weekly/index.json'
import type { WeeklyReportData } from '@/types/news'

const loaders=import.meta.glob<WeeklyReportData>('../data/news/weekly/reports/*.json',{import:'default'})
export default function WeeklyNews(){
  const {period}=useParams(),navigate=useNavigate(),selected=period??latest.periodEnd
  const known=index.some(r=>r.periodEnd===selected)
  const [loaded,setLoaded]=useState<{id:string;report:WeeklyReportData}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const contentRoot=useRef<HTMLDivElement>(null)
  const report:WeeklyReportData|null=loaded?.id===selected?loaded.report:null
  useEffect(()=>{
    let cancelled=false;setError('')
    if(!known)return
    const load=loaders[`../data/news/weekly/reports/${selected}.json`]
    if(!load){setError('该期正文未包含在当前版本，请刷新后重试。');return}
    load().then(r=>{if(!cancelled)setLoaded({id:selected,report:r})}).catch(()=>{if(!cancelled)setError('周报正文加载失败，旧页面缓存或网络故障都可能导致此问题。')})
    return()=>{cancelled=true}
  },[selected,known,attempt])
  function download(){if(!report)return;const blob=new Blob([report.content],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`weekly-${report.periodEnd}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <div className="mx-auto max-w-[1120px] px-5 py-8 [overflow-wrap:anywhere] sm:px-8">
    <Link to="/news" className="mb-5 inline-flex min-h-11 items-center text-sm text-muted hover:text-accent">← 返回新闻雷达</Link>
    <header className="mb-8 border-b border-line pb-6"><p className="eyebrow">News / Weekly archive</p><h1 className="mt-4 text-3xl text-ink">每周信号报告</h1><p className="mt-4 text-sm leading-7 text-secondary">按完整自然周回看 AI、科技、金融与国际形势。事实附来源，综合判断单独标明；不是投资建议。</p></header>
    <NewsFreshness/>
    <div className="mb-6 flex flex-wrap items-end gap-4"><label className="min-w-0 text-sm text-secondary">选择周报<select aria-label="选择周报" value={known?selected:''} onChange={e=>navigate(`/news/weekly/${e.target.value}`)} className="mt-2 block max-w-full rounded-lg border border-line bg-field px-3 py-2">{!known&&<option value="">该期不存在</option>}{index.map(r=><option key={r.periodEnd} value={r.periodEnd}>{r.periodStart} 至 {r.periodEnd}{!('archiveDates' in r)?' · 早期报告':''}</option>)}</select></label>{report&&<button className="button-secondary" onClick={download}>下载 Markdown</button>}<Link to="/news/weekly" className="button-secondary">最新一期</Link></div>
    {!known?<p role="alert" className="surface-card p-6 text-secondary">该期周报不存在。请选择已有期次；不会将另一份报告冒充此日期。</p>:error?<div role="alert" className="surface-card p-6 text-secondary"><p>{error}</p><button className="button-secondary mt-4" onClick={()=>setAttempt(v=>v+1)}>重试</button><button className="button-secondary ml-3 mt-4" onClick={()=>window.location.reload()}>刷新页面</button></div>:!report?<p role="status" className="py-12 text-muted">正在读取周报…</p>:<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <article aria-label="周报正文" className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="mb-6 rounded-xl border border-line bg-surface p-4 text-sm leading-7 text-secondary"><p>覆盖：{report.periodStart} 至 {report.periodEnd} · {report.itemCount} 个引用来源</p><p>生成：{new Date(report.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间） · {report.model}</p>{report.archiveDates?<p>实际归档覆盖 {report.archiveDates.length}/7 天{report.archiveDates.length<7?' · 证据不完整，详见正文说明':''}。归档日与新闻原始发布日期不同。</p>:<p className="text-amber-200">早期单日报告，保留原文；未通过新版完整周与双向引用校验，不代表本周进展。</p>}</div>
        <div ref={contentRoot} className="weekly-report reading-body"><MarkdownRenderer content={report.content}/></div>
        <details className="mt-8 rounded-xl border border-line bg-surface p-4"><summary className="min-h-11 cursor-pointer text-sm text-ink">引用来源 · {report.sources.length}</summary><ul className="mt-3 space-y-4 text-sm leading-6">{report.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.title}</a><p className="text-muted">{s.source}</p></li>)}</ul></details>
      </article><TableOfContents content={report.content} contentRoot={contentRoot}/>
    </div>}
    <p className="mt-8 text-xs leading-6 text-muted">计划每周一北京时间 09:30 发布上一完整周；每日检查缺期并补发，最新缺期优先。总结使用 Codex gpt-5.6-luna，不调用独立模型 API。本地任务依赖设备及应用在线；校验失败时保留上一有效报告，不修改日期伪装更新。</p>
  </div>
}
