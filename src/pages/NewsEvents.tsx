import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, CheckCheck, Download, Pause, Play, StepBack, StepForward } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import catalogJson from '@/data/news/event-catalog.json'
import snapshotJson from '@/data/news/events.json'
import { categoryNames, kindNames, validateCatalog, validateSnapshot, readEventQuery, eventQuery, sortedMilestones, canonicalEventUrl, filteredReports, freshnessLabel, eventMarkdown } from '@/lib/news-events.mjs'
import type { EventCoverage, EventMilestone, EventReport, EventTrack } from '@/lib/news-events.mjs'
import './news-events.css'

const panel = 'rounded-2xl border border-line bg-surface p-4 sm:p-6'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50'
const input = 'min-h-11 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink'
const utc = (value:string) => `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`

function Sources({ node, reports }: {node:EventMilestone;reports:EventReport[]}) {
  return <div className="mt-5 border-t border-line pt-4">
    <h4 className="text-sm font-medium text-ink">核对来源</h4>
    {node.sources.map((source, index) => {
      const report = reports.find(report => report.url === canonicalEventUrl(source.url))
      return <div key={`${source.url}-${index}`} className="mt-3 text-sm leading-6">
        <a className="break-words text-accent underline decoration-accent/40 underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight className="ml-1 inline h-4 w-4"/></a>
        <p className="mt-1 text-secondary">{source.publisher} · 发布 {source.publishedOn} · 核对 {source.reviewedOn}</p>
        <p className="text-secondary">核对范围：{source.basis === 'document' ? '原始文档' : '发布方摘要'}。{source.scope}</p>
        <p className="text-xs text-muted">{report ? `本站首次收录 ${utc(report.firstCollectedAt)}；最近收录 ${utc(report.lastCollectedAt)}` : '此来源为人工补充引用，未在当前自动关联索引中找到；不虚构采集时间。'}</p>
      </div>
    })}
  </div>
}

function Coverage({ coverage, reviewedOn }: {coverage:EventCoverage;reviewedOn:string}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const reviewedAge = Math.floor((now - Date.parse(`${reviewedOn}T00:00:00Z`)) / 86400000)
  return <details className={`${panel} mt-6`}>
    <summary className="min-h-11 cursor-pointer text-sm font-medium text-ink">采集覆盖与核对边界</summary>
    <div className="mt-3 space-y-3 text-sm leading-6 text-secondary">
      <p>每日新闻：{utc(coverage.dailyCollectedAt)} · {freshnessLabel(coverage.dailyCollectedAt, now)}。</p>
      <p>框架版本：{utc(coverage.releasesCollectedAt)} · {freshnessLabel(coverage.releasesCollectedAt, now)}。</p>
      <p>技术长读：{utc(coverage.libraryCollectedAt)}。重建网站不会刷新这些采集时间。</p>
      <p>关键节点人工核对截至 {reviewedOn}{reviewedAge > 7 ? `（已超过 7 天；后续关键变化尚待复核）` : ''}。新收录报道不会自动成为核对结论。</p>
      <p>{coverage.archiveDates.length ? `扫描 ${coverage.archiveDates[0]} 至 ${coverage.archiveDates.at(-1)} 的 ${coverage.archiveDates.length} 个日归档。` : '没有日归档。'}{coverage.missingArchiveDates.length ? `其间缺少 ${coverage.missingArchiveDates.join('、')}。` : '日期范围内没有缺档，但不代表新闻覆盖完整。'}</p>
      <p>{coverage.failedSources.length ? `最近采集有 ${coverage.failedSources.length} 个来源失败：${coverage.failedSources.join('、')}。` : '最近来源状态未报告失败；这不代表每个主题都有新内容。'}排除 {coverage.invalidItems} 条格式／时间无效的输入记录（同一条跨归档可重复计数）。</p>
      <p>自动关联只扫描本站已采集的每日新闻、归档、技术长读和官方版本记录，不搜索整个互联网。历史关联记录保留；来源标题或发布日期修订时保留首次收录时间。</p>
      <p>同一 URL 跨日去重；不同 URL 不视为独立证实。来源所在国家／地区是发布机构属性，不代表报道立场或当事方国籍。金融内容不是投资建议。</p>
    </div>
  </details>
}

function RelatedReports({ track, reports, source, q, onFilter }: {track:EventTrack;reports:EventReport[];source:string;q:string;onFilter:(source:string,q:string)=>void}) {
  const [limit, setLimit] = useState(6)
  const filtered = filteredReports(reports, { source, q })
  const publishers = [...new Set(reports.map(report => report.publisher))].sort()
  return <section className={`${panel} mt-6`} aria-label="规则关联报道">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-medium text-ink">后续与背景报道</h2><p className="text-sm text-secondary">{filtered.length} 条匹配 · {publishers.length} 个发布来源</p></div>
    <p className="mt-2 text-sm leading-6 text-secondary">按规则自动关联，未逐条核对。标题匹配不代表事实成立，也不保证与关键节点有因果关系。</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-xs text-secondary">搜索关联报道<input className={input} value={q} maxLength={160} placeholder="标题或发布来源" onChange={e => {setLimit(6);onFilter(source,e.target.value)}}/></label>
      <label className="grid min-w-0 gap-2 text-xs text-secondary">发布来源<select className={`${input} w-full`} value={source} onChange={e => {setLimit(6);onFilter(e.target.value,q)}}><option value="">全部来源</option>{source && !publishers.includes(source) && <option value={source}>{source}（当前无记录）</option>}{publishers.map(name => <option key={name}>{name}</option>)}</select></label>
    </div>
    <p className="mt-2 text-xs text-muted">筛选词会写入 URL；不含本机收藏，分享前请检查关键词。</p>
    {!filtered.length && <p role="status" className="py-6 text-sm text-secondary">没有匹配报道。{source || q ? <button className="ml-2 min-h-11 text-accent underline" onClick={() => onFilter('','')}>清除筛选</button> : '这不代表事件没有后续。'}</p>}
    <ol className="mt-4 divide-y divide-line">{filtered.slice(0,limit).map(report => <li key={report.url} className="py-4">
      <p className="text-xs text-muted">发布 {utc(report.publishedAt)} · 规则关联</p>
      <a className="mt-1 block break-words text-sm font-medium leading-6 text-accent hover:underline" href={report.url} target="_blank" rel="noreferrer">{report.title} ↗</a>
      <p className="mt-1 text-xs leading-5 text-secondary">{report.publisher} · 来源所在地：{report.publisherCountry}</p>
      <details className="mt-1 text-xs leading-6 text-secondary"><summary className="min-h-11 cursor-pointer py-2">为何收录／时间记录{report.revisionCount ? ` · 元数据修订 ${report.revisionCount} 次` : ''}</summary>
        <p>{report.ruleIds.map(id => track.rules.find(rule => rule.id === id)?.label || '历史规则').join('；')}</p>
        <p>首次收录 {utc(report.firstCollectedAt)} · 最近收录 {utc(report.lastCollectedAt)}</p>
        <p>最近收录不等于原文更新。修订计数仅记录本站事件索引观察到的标题、来源或发布日期变化，不监测原文正文。</p>
      </details>
    </li>)}</ol>
    {filtered.length > limit && <button className={button} onClick={() => setLimit(n => n + 6)}>再显示 6 条（剩余 {filtered.length - limit} 条）</button>}
  </section>
}

function EventReader({ track, reports, coverage, index, searchKey, source, q, navigate }: {track:EventTrack;reports:EventReport[];coverage:EventCoverage;index:number;searchKey:string;source:string;q:string;navigate:(step:string,source?:string,q?:string)=>void}) {
  const nodes = useMemo(() => sortedMilestones(track), [track])
  const [preview, setPreview] = useState<{key:string;index:number}|null>(null), [playing, setPlaying] = useState(false), [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const cursor = preview?.key === searchKey ? preview.index : index
  const [exportMessage, setExportMessage] = useState('')
  useEffect(() => {setPreview(null);setPlaying(false)}, [searchKey])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => {setReduced(media.matches);setPlaying(false)}
    const hide = () => {if (document.hidden) setPlaying(false)}
    const stop = () => setPlaying(false)
    media.addEventListener('change',change);document.addEventListener('visibilitychange',hide);window.addEventListener('hashchange',stop);window.addEventListener('pagehide',stop)
    return () => {media.removeEventListener('change',change);document.removeEventListener('visibilitychange',hide);window.removeEventListener('hashchange',stop);window.removeEventListener('pagehide',stop)}
  }, [])
  useEffect(() => {
    if (!playing || reduced) return
    const timer = setTimeout(() => { if (cursor >= nodes.length - 1) setPlaying(false); else setPreview({key:searchKey,index:cursor+1}) }, 5000)
    return () => clearTimeout(timer)
  }, [playing,reduced,cursor,nodes.length,searchKey])
  const node = nodes[cursor]
  const choose = (next:number) => {setPlaying(false);setPreview(null);navigate(nodes[next].id,source,q)}
  const download = () => {
    setPlaying(false)
    try {
      const url = URL.createObjectURL(new Blob([eventMarkdown(track,reports,coverage)],{type:'text/markdown;charset=utf-8'}))
      const a = document.createElement('a');a.href=url;a.download=`event-${track.id}-${track.reviewedOn}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
      setExportMessage('已请求下载含来源的 Markdown。导出包含全部关联报道，不受当前筛选影响。')
    } catch { setExportMessage('导出失败，请重试。没有写入本机收藏。') }
  }
  return <>
    <section className="mt-4 border-b border-line pb-4" aria-labelledby="event-track-title">
      <div className="flex items-center justify-between gap-3"><h2 id="event-track-title" className="min-w-0 flex-1 text-lg font-semibold leading-7 text-ink">{track.title}</h2><button className={`${button} shrink-0`} onClick={download} aria-label="导出脉络"><Download size={16}/><span className="hidden sm:inline">导出脉络</span></button></div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs leading-5 text-secondary"><span><CheckCheck size={14} className="mr-1 inline"/>核对至 {track.reviewedOn}</span><span>{nodes.length} 个节点 · {reports.length} 条关联报道</span></div>
      {exportMessage && <p className="mt-3 text-sm text-secondary" role="status">{exportMessage}</p>}
    </section>
    {node ? <section className="mt-6" aria-label="关键节点时间线">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium text-ink">关键节点</h2><p className="text-xs text-secondary">按日期排序；等距节点不表示等长时间间隔</p></div>
      <div className="event-timeline-layout">
        <div className="min-w-0">
          <label className="mb-3 grid gap-2 text-xs text-secondary lg:hidden">跳转关键节点<select className={`${input} w-full`} value={node.id} onChange={e=>choose(nodes.findIndex(item=>item.id===e.target.value))}>{nodes.map((item,i)=><option key={item.id} value={item.id}>{i+1}. {item.date} · {item.title}</option>)}</select></label>
          <ol className="event-date-rail hidden lg:block" aria-label="节点目录">{nodes.map((item,i)=><li key={item.id} className="relative pb-2"><button className={`relative min-h-16 w-full rounded-xl border p-3 text-left ${cursor===i?'border-accent bg-raised text-ink':'border-transparent text-secondary hover:bg-surface'}`} aria-current={cursor===i?'step':undefined} onClick={()=>choose(i)}><span className={`event-date-dot ${i<=cursor?'is-reached':''}`} aria-hidden="true"/><time className="text-xs" dateTime={item.date}>{item.date}</time><span className="mt-1 block text-sm leading-5">{item.title}</span></button></li>)}</ol>
        </div>
        <div className={`${panel} min-w-0`}>
          <div className="flex flex-wrap items-center gap-2" aria-label="时间线控制">
            <button className={button} disabled={cursor===0} onClick={()=>choose(cursor-1)}><StepBack size={16}/><span className="sr-only sm:not-sr-only">上一节点</span></button>
            <button className={button} disabled={reduced || nodes.length<2} onClick={()=>{if(playing){setPlaying(false)}else{if(cursor===nodes.length-1)setPreview({key:searchKey,index:0});setPlaying(true)}}}>{playing?<Pause size={16}/>:<Play size={16}/>}<span>{playing?'暂停':'播放脉络'}</span></button>
            <button className={button} disabled={cursor===nodes.length-1} onClick={()=>choose(cursor+1)}><StepForward size={16}/><span className="sr-only sm:not-sr-only">下一节点</span></button>
            <span className="ml-auto font-mono text-xs text-secondary" data-testid="event-position">{cursor+1} / {nodes.length}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">{reduced?'已遵循减少动态效果偏好；请逐步阅读。':'手动开始，每节点停留 5 秒，末尾停止；切换页面或筛选会暂停。'}</p>
          <div className="my-4 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true"><div key={`${cursor}-${playing}`} className={playing&&!reduced?'event-read-progress h-full bg-accent':'h-full bg-accent'} style={playing&&!reduced?undefined:{width:`${(cursor+1)/nodes.length*100}%`}}/></div>
          <article key={node.id} className="event-node-enter" data-testid="event-node" aria-live={playing?'off':'polite'}>
            <div className="flex flex-wrap items-center gap-2 text-xs"><time className="font-mono text-secondary" dateTime={node.date}>{node.date}</time><span className={`rounded border px-2 py-1 ${node.kind==='fact'?'border-emerald-300/25 text-emerald-200':'border-amber-300/25 text-amber-200'}`}>{kindNames[node.kind]}</span></div>
            <h3 className="mt-3 text-xl font-medium leading-8 text-ink" data-testid="event-title">{node.title}</h3>
            <p className="mt-3 text-base leading-7 text-ink">{node.summary}</p>
            <p className="mt-4 border-l-2 border-accent pl-3 text-sm leading-6 text-secondary"><span className="font-medium text-ink">阅读提示：</span>{node.context}</p>
            <p className="mt-3 text-xs leading-5 text-muted">日期含义：{node.dateMeaning}</p>
            <Sources node={node} reports={reports}/>
          </article>
        </div>
      </div>
    </section>:<p className={`${panel} mt-5 text-secondary`} role="status">尚无人工核对节点，下面只展示规则关联报道。</p>}
    <section className={`${panel} mt-6`}><h2 className="text-base font-medium text-ink">追踪范围与待观察问题</h2><p className="mt-3 text-sm leading-6 text-secondary">{track.summary}{track.endDate && ` 本主题仅关联 ${track.startDate} 至 ${track.endDate} 发布的报道。`}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-secondary">{track.openQuestions.map(question=><li key={question}>{question}</li>)}</ul>{track.learning.length>0&&<div className="mt-4 border-t border-line pt-4"><h3 className="text-sm font-medium text-ink">从新闻回到原理</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{track.learning.map(link=><Link key={link.path} className="inline-flex min-h-11 items-center text-sm text-accent underline" to={link.path}>{link.label} →</Link>)}</div></div>}</section>
    <RelatedReports key={track.id} track={track} reports={reports} source={source} q={q} onFilter={(source,q)=>{setPlaying(false);navigate(nodes[cursor]?.id,source,q)}}/>
    <Coverage coverage={coverage} reviewedOn={track.reviewedOn}/>
    <p className="mt-4 text-xs leading-5 text-muted">播放进度不持久化。手动选择的节点与筛选保留在 URL；刷新恢复链接中的节点。浏览和导出均不修改本机阅读清单，不调用模型或上传个人数据。</p>
  </>
}

export default function NewsEvents() {
  const [params,setParams] = useSearchParams()
  const {tracks} = useMemo(()=>validateCatalog(catalogJson),[])
  const snapshot = useMemo(()=>validateSnapshot(snapshotJson),[])
  if (tracks.some(track=>!snapshot.tracks.some(item=>item.id===track.id))) throw new Error('Event index does not match catalog')
  const selected = readEventQuery(params,tracks)
  return <div className="page-container pb-16 pt-3 text-ink [&_button:focus-visible]:outline-accent [&_.page-heading]:mb-4 [&_.page-heading]:pb-4 [&_.page-heading__description]:mt-2">
    <nav aria-label="新闻导航" className="mb-2 flex flex-wrap gap-3 text-sm"><Link className="inline-flex min-h-11 items-center gap-1 text-secondary hover:text-ink" to="/news"><ArrowLeft size={16}/>新闻阅读</Link><Link className="inline-flex min-h-11 items-center text-secondary hover:text-ink" to="/news/weekly">每周报告</Link><span aria-current="page" className="inline-flex min-h-11 items-center text-accent">事件追踪</span></nav>
    <PageHeader compact eyebrow="NEWS / THROUGH TIME" title="把新闻连成脉络" description="关键进展、各方表态与尚待观察的问题，分开阅读。"/>
    <label className="grid gap-2 text-xs text-secondary">选择追踪主题<select className={`${input} w-full sm:max-w-xl`} value={selected.track?.id||''} onChange={e=>setParams(eventQuery({event:e.target.value}))}>{!selected.track&&<option value="">请选择主题</option>}{tracks.map(track=><option key={track.id} value={track.id}>{categoryNames[track.category]} · {track.title}</option>)}</select></label>
    <p className="mt-3 text-xs leading-5 text-secondary" data-testid="event-freshness">每日采集截至 {utc(snapshot.coverage.dailyCollectedAt)} · {freshnessLabel(snapshot.coverage.dailyCollectedAt)}。关键节点的核对日期另列。</p>
    {selected.error?<section role="alert" className={`${panel} mt-5`}><p>{selected.error}</p><button className={`${button} mt-3`} onClick={()=>setParams(eventQuery({event:selected.track?.id||tracks[0]?.id}))}>返回主题最新核对节点</button></section>:selected.track&&<EventReader key={selected.track.id} track={selected.track} reports={snapshot.tracks.find(track=>track.id===selected.track.id)!.reports} coverage={snapshot.coverage} index={selected.index!} searchKey={params.toString()} source={selected.source!} q={selected.q!} navigate={(step,source,q)=>setParams(eventQuery({event:selected.track!.id,step,source,q}),{replace:source!==selected.source||q!==selected.q})}/>}
  </div>
}
