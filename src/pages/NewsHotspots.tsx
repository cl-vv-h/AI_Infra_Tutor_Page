import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Bookmark, Check, Flame } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import corpusJson from '@/data/news/hotspots.json'
import cacheConfig from '../../config/news-hotspot-cache.json'
import { categories, changeFollow, distribution, FOLLOW_KEY, hotspotTopics, matchTopic, parseFollows, publisherFamily, validateHotspotCorpus, windowReports } from '@/lib/news-hotspots.mjs'
import { createHotspotWindowReader } from '@/lib/news-hotspot-cache.mjs'
import type { FollowState, Hotspot, HotspotCategory, HotspotReport } from '@/lib/news-hotspots.mjs'
import './news-hotspots.css'

const corpus = validateHotspotCorpus(corpusJson)
const readWindow = createHotspotWindowReader(corpus, undefined, cacheConfig.enabled)
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-raised disabled:opacity-50'
const input = 'min-h-11 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink'
const panel = 'rounded-xl border border-line bg-surface p-4 sm:p-5'
const utc = (iso:string) => `${iso.slice(5,10)} ${iso.slice(11,16)} UTC`
const regionNames:Record<string,string> = { 'United States':'美国', 'United Kingdom':'英国', Germany:'德国', France:'法国', Qatar:'卡塔尔', Singapore:'新加坡', Japan:'日本', Australia:'澳大利亚', Canada:'加拿大', Argentina:'阿根廷', 'European Union':'欧盟', International:'跨国／国际机构', 'Pan-African':'泛非洲' }

function useFollows() {
  const [value,setValue] = useState<FollowState>({version:1,entries:[]}), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  useEffect(() => {
    const read = () => { try {setValue(parseFollows(localStorage.getItem(FOLLOW_KEY)));setError('')} catch {setError('无法读取本机关注记录，原数据未被覆盖。浏览热点不受影响。')} }
    const sync = (event:StorageEvent) => {if(event.key===FOLLOW_KEY || event.key===null) read()}
    read();window.addEventListener('storage',sync);window.addEventListener('focus',read)
    return () => {window.removeEventListener('storage',sync);window.removeEventListener('focus',read)}
  },[])
  const change = async (id:string,title:string,action:'add'|'remove'|'read') => {
    setBusy(true)
    try {setValue(await changeFollow(localStorage,navigator.locks,id,title,corpus.generatedAt,action));setError('')}
    catch (cause) {setError(`操作未完成：${cause instanceof Error ? cause.message : '浏览器拒绝存储'}。请检查本机存储设置。`)}
    finally {setBusy(false)}
  }
  return {value,error,busy,change}
}

function ReportList({ reports, seenThrough }: {reports:HotspotReport[];seenThrough?:string}) {
  const [limit,setLimit] = useState(10)
  return <><ol className="divide-y divide-line" aria-label="热点报道时间线">{reports.slice(0,limit).map(row=><li key={row.id} className="py-4">
    <p className="text-xs text-muted">{utc(row.publishedAt)} · {row.source}{seenThrough && row.firstSeenAt>seenThrough && <span className="ml-2 text-emerald-200">新收录</span>}</p>
    <a className="mt-1 block break-words text-sm leading-6 text-accent hover:underline" href={row.url} target="_blank" rel="noreferrer">{row.title} <ArrowUpRight size={14} className="inline"/></a>
    <p className="mt-1 text-xs leading-5 text-secondary">来源所在地：{regionNames[row.country] || row.country} · 首次收录 {utc(row.firstSeenAt)}</p>
  </li>)}</ol>{reports.length>limit&&<button className={button} onClick={()=>setLimit(n=>n+10)}>再显示 10 条报道（剩余 {reports.length-limit}）</button>}</>
}

function TopicDetail({ item, follow, busy, change, onBack }: {item:Hotspot;follow?:FollowState['entries'][number];busy:boolean;change:(id:string,title:string,action:'add'|'remove'|'read')=>Promise<void>;onBack:()=>void}) {
  const allReports = useMemo(()=>readWindow(720).find(row=>row.id===item.id)?.reports||[],[item.id])
  const rule = hotspotTopics.find(rule=>rule.id===item.id)
  const trend = distribution(allReports,corpus.generatedAt)
  const dayCounts = trend.days.map(day=>allReports.filter(row=>row.publishedAt.startsWith(day)).length)
  const sources = [...new Set(allReports.map(row=>publisherFamily(row.source)))]
  const newCount = follow ? allReports.filter(row=>row.firstSeenAt>follow.seenThrough).length : 0
  return <section className={`${panel} mt-5`} aria-labelledby="hotspot-detail-title">
    <button className={`${button} mb-4`} onClick={onBack}><ArrowLeft size={16}/>返回热点榜</button>
    <p className="text-xs text-muted">{categories[item.category]} · {item.kind==='topic'?'主题追踪 · 不代表同一事件':allReports.length>1?'标题相近 · 自动聚合待核对':'单篇线索 · 尚未归入追踪主题'}</p>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-3"><h2 id="hotspot-detail-title" tabIndex={-1} className="min-w-0 flex-1 scroll-mt-24 break-words text-xl font-medium leading-8">{item.title}</h2>{item.kind==='topic'&&<button className={`${button} shrink-0`} disabled={busy} aria-pressed={!!follow} onClick={()=>void change(item.id,item.title,follow?'remove':'add')}><Bookmark size={16}/>{follow?'取消关注':'关注主题'}</button>}</div>
    <p className="mt-3 text-sm leading-6 text-secondary">当前窗口活跃度 {item.score} · {item.reports.length} 条报道 · {item.publishers} 个发布方。下方时间线展示滚动 30 天内的全部已收录报道，最新发布在前。</p>
    {follow&&<div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span role="status">上次已读之后新收录 {newCount} 条</span><button className={button} disabled={busy||!newCount} onClick={()=>void change(item.id,item.title,'read')}><Check size={16}/>标记当前收录为已读</button></div>}
    <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr]">
      <div><h3 className="text-sm font-medium">近 7 个 UTC 自然日报道分布</h3><div className="hotspot-spark mt-3" aria-label="每日发布报道数量">{trend.days.map((day,i)=><div key={day} className="text-center"><span className="block text-xs text-secondary">{dayCounts[i]}</span><div className="mx-auto my-2 flex h-16 w-full max-w-8 items-end rounded bg-raised"><div className="w-full rounded bg-accent" style={{height:`${dayCounts[i]/Math.max(1,...dayCounts)*100}%`}}/></div><span className="text-xs text-muted">{day.slice(5)}</span></div>)}</div></div>
      <div><h3 className="text-sm font-medium">报道来源</h3><p className="mt-3 text-sm leading-7 text-secondary">{sources.join(' · ')}</p><p className="mt-2 text-xs leading-5 text-muted">同集团的多个频道合并计分。多个发布方不等于独立证实；转载仍可能来自同一原始消息。</p></div>
    </div>
    <details className="mt-4 border-y border-line py-2 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-secondary">关联依据与阅读边界</summary><p className="pb-3 leading-6 text-secondary">{rule?`标题包含「${rule.any.join(' / ')}」${rule.all.length?`，且包含「${rule.all.join(' / ')}」之一`:''}${rule.sources.length?`；或来自专题来源 ${rule.sources.join('、')}`:''}。每条报道归入首个匹配主题，避免在分布中重复计数。`:allReports.length>1?'未匹配预设主题；标题至少有 3 个有效词重合，且重合数量不少于较长标题有效词数的 60%。与首条种子标题比较，不使用传递式合并；相似不等于同一事件，可能误分。':'未匹配到现有主题规则，仅作为单篇新闻线索展示，不推断事件关系。'} 自动匹配只用标题与发布来源，不读取正文，不生成未经核对的结论。回填旧报道也可能标为“新收录”，不等于刚刚发生。{!rule&&' 自动线索暂不提供长期关注，可使用链接在 30 天窗口内回看；持续关注适用于有稳定规则的主题。'}</p></details>
    <ReportList key={item.id} reports={allReports} seenThrough={follow?.seenThrough}/>
  </section>
}

export default function NewsHotspots() {
  const [params,setParams] = useSearchParams()
  const [limit,setLimit] = useState(15), [now,setNow] = useState(Date.now), [showDistribution,setShowDistribution] = useState(false)
  const follows = useFollows()
  const hotspotId=params.get('hotspot')||'', lastId=useRef<string|null>(null)
  useEffect(()=>{
    if(hotspotId || lastId.current!==null){const heading=document.getElementById(hotspotId?'hotspot-detail-title':'hotspot-ranking-title');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'})}
    lastId.current=hotspotId
  },[hotspotId])
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[])
  const hours = [24,72,168].includes(Number(params.get('hours'))) ? Number(params.get('hours')) : 72
  const category = Object.prototype.hasOwnProperty.call(categories,params.get('category')||'') ? params.get('category') as HotspotCategory : ''
  const country = params.get('country') || '', q = (params.get('q') || '').slice(0,160), mine = params.get('mine')==='1', sort = params.get('sort') || 'heat'
  const topics = useMemo(()=>readWindow(hours),[hours])
  const currentDetail = topics.find(row=>row.id===hotspotId)
  const historicalDetail = hotspotId && !currentDetail ? readWindow(720).find(row=>row.id===hotspotId) : undefined
  const detail = currentDetail || (historicalDetail ? {...historicalDetail,score:0,publishers:0,reports:[]} : undefined)
  const patch = (values:Record<string,string>,replace=false) => {const next=new URLSearchParams(params);for(const [key,value] of Object.entries(values)) {if(value)next.set(key,value);else next.delete(key)} setLimit(15);setParams(next,{replace})}
  const selectedRows = useMemo(()=>windowReports(corpus.items,corpus.generatedAt,hours).filter(row=>(!category||(matchTopic(row)?.category||row.category)===category)&&(!country||row.country===country)),[hours,category,country])
  const stats = useMemo(()=>distribution(selectedRows,corpus.generatedAt),[selectedRows])
  const matrix = useMemo(()=>distribution(windowReports(corpus.items,corpus.generatedAt,168),corpus.generatedAt),[])
  const regionStats = useMemo(()=>distribution(windowReports(corpus.items,corpus.generatedAt,hours),corpus.generatedAt),[hours])
  const filtered = topics.filter(item=>(!category||item.category===category)&&(!country||item.reports.some(row=>row.country===country))&&(!mine||follows.value.entries.some(row=>row.id===item.id))&&(!q||`${item.title} ${item.reports.map(row=>`${row.title} ${row.source}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a,b)=>sort==='latest'?b.latestAt.localeCompare(a.latestAt)||b.score-a.score:sort==='sources'?b.publishers-a.publishers||b.score-a.score:b.score-a.score||b.latestAt.localeCompare(a.latestAt))
  const missingFollows = follows.value.entries.filter(row=>!topics.some(topic=>topic.id===row.id))
  const failed = corpus.sources.filter(row=>row.state!=='ok')
  const ageHours = Math.max(0,Math.floor((now-Date.parse(corpus.generatedAt))/3600000))
  return <div className="page-container pb-16 pt-3 text-ink [&_.page-heading]:mb-4 [&_.page-heading]:pb-4">
    <nav aria-label="新闻导航" className="mb-2 flex flex-wrap gap-4 text-sm"><Link className="inline-flex min-h-11 items-center gap-1 text-secondary hover:text-ink" to="/news"><ArrowLeft size={16}/>新闻阅读</Link><span className="inline-flex min-h-11 items-center text-accent" aria-current="page">热点追踪</span><Link className="inline-flex min-h-11 items-center text-secondary hover:text-ink" to="/news/events?mode=reviewed">已核对事件脉络</Link></nav>
    <PageHeader compact eyebrow="NEWS / HOTSPOT RADAR" title="热点在哪里，进展到哪了" description="按报道活跃度发现热点，查看来源分布，持续关注后续。"/>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs leading-5 text-secondary" data-testid="hotspot-freshness"><span>采集截至 {corpus.generatedAt.slice(0,10)} {utc(corpus.generatedAt).slice(6)}</span><span>{corpus.sources.filter(row=>row.state==='ok').length} / {corpus.sources.length} 个信源可用</span><span>滚动 30 天 · {corpus.items.length} 条报道</span></div>
    {ageHours>12&&<p role="status" className="mt-3 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200">采集快照已 {ageHours} 小时未更新，下面是截至采集时间的历史热度，不是当前实时排名。</p>}
    {failed.length>0&&<p className="mt-2 text-xs text-amber-200">{failed.length} 个信源本轮未成功，排名可能受覆盖缺失影响。详情见采集说明。</p>}
    {follows.error&&<p role="alert" className="mt-3 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-200">{follows.error}</p>}
    {params.has('hotspot')?(detail?<TopicDetail item={detail} follow={follows.value.entries.find(row=>row.id===detail.id)} busy={follows.busy} change={follows.change} onBack={()=>patch({hotspot:''})}/>:<section className={`${panel} mt-5`} role="status"><p>当前 30 天索引中未找到此热点，可能已超出保留窗口。关注记录不会因此删除。</p><button className={`${button} mt-3`} onClick={()=>patch({hotspot:''})}>返回热点榜</button></section>):<>
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2fr]" aria-label="热点筛选">
        <label className="grid gap-2 text-xs text-secondary">统计窗口<select className={input} value={hours} onChange={e=>patch({hours:e.target.value})}><option value="24">近 24 小时</option><option value="72">近 72 小时</option><option value="168">近 7 天</option></select></label>
        <label className="grid gap-2 text-xs text-secondary">排序方式<select className={input} value={['heat','latest','sources'].includes(sort)?sort:'heat'} onChange={e=>patch({sort:e.target.value})}><option value="heat">活跃度优先</option><option value="latest">最新进展优先</option><option value="sources">来源覆盖优先</option></select></label>
        <label className="col-span-2 grid gap-2 text-xs text-secondary sm:col-span-1">搜索热点<input className={input} type="search" value={q} maxLength={160} placeholder="主题、标题或发布来源" onChange={e=>patch({q:e.target.value},true)}/></label>
      </section>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="热点板块">{[['','全部'],...Object.entries(categories)].map(([key,label])=><button key={key} className={`${button} ${category===key?'border-accent bg-raised text-accent':''}`} aria-pressed={category===key} onClick={()=>patch({category:key})}>{label}</button>)}<button className={`${button} sm:ml-auto ${mine?'border-accent text-accent':''}`} aria-pressed={mine} onClick={()=>patch({mine:mine?'':'1'})}><Bookmark size={16}/>只看关注（{follows.value.entries.length}）</button></div>
      <button className={`${button} mt-3 w-full lg:hidden`} aria-expanded={showDistribution} aria-controls="hotspot-distribution" onClick={()=>setShowDistribution(value=>!value)}>{showDistribution?'收起热点分布':'查看热点分布'}</button>
      <div className="hotspot-layout mt-5">
        <section className="min-w-0" aria-labelledby="hotspot-ranking-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="hotspot-ranking-title" tabIndex={-1} className="flex scroll-mt-24 items-center gap-2 text-lg font-medium"><Flame size={18} className="text-amber-200"/>热点榜</h2><span className="text-xs text-secondary">{filtered.length} 个主题／新闻线索</span></div>
          <p className="mt-2 text-xs leading-5 text-muted">热度是本站样本的报道活跃度，不是全网热搜、阅读量或事实可信度。{country&&`来源筛选：${regionNames[country]||country}；分数仍使用该主题全部来源。`}</p>
          {(q||category||country||mine)&&<button className="min-h-11 text-sm text-accent underline" onClick={()=>patch({q:'',category:'',country:'',mine:''})}>清除榜单筛选</button>}
          {!filtered.length&&<p role="status" className={`${panel} mt-4 text-sm text-secondary`}>没有匹配热点。可扩大时间窗口或清除筛选；没有报道不代表没有进展。</p>}
          <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface" aria-label="热点排名">{filtered.slice(0,limit).map((item,index)=>{const follow=follows.value.entries.find(row=>row.id===item.id);const added=follow?corpus.items.filter(row=>matchTopic(row)?.id===item.id&&row.firstSeenAt>follow.seenThrough).length:0;return <li key={item.id} className="hotspot-row p-4" data-testid="hotspot-row">
            <span className={`pt-1 font-mono text-sm ${index<3?'text-amber-200':'text-muted'}`}>{String(index+1).padStart(2,'0')}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><span>{categories[item.category]} · {item.kind==='topic'?'主题聚合':item.kind==='cluster'?'标题相近 · 待核对':'单篇线索'}</span><span>{utc(item.latestAt)}</span></div><button className="min-h-11 w-full break-words py-2 text-left text-base font-medium leading-6 hover:text-accent" onClick={()=>patch({hotspot:item.id})}>{item.title}</button>
              {item.kind==='topic'&&<p className="line-clamp-2 break-words text-sm leading-6 text-secondary">{item.reports[0].source}：{item.reports[0].title}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"><span className="font-mono text-accent" aria-label={`活跃度 ${item.score}`}>活跃度 {item.score}</span><span className="text-secondary">{item.reports.length} 条 · {item.publishers} 个发布方</span>{follow&&<span className="text-emerald-200">已关注{added?` · ${added} 条新收录`:''}</span>}</div>
            </div>
          </li>})}</ol>
          {filtered.length>limit&&<button className={`${button} mt-4 w-full`} onClick={()=>setLimit(n=>n+15)}>再显示 15 条（剩余 {filtered.length-limit}）</button>}
          {mine&&missingFollows.length>0&&<section className={`${panel} mt-4`}><h3 className="text-sm font-medium">当前窗口没有报道的关注</h3>{missingFollows.map(row=><div key={row.id} className="mt-3 flex flex-wrap items-center gap-2 text-sm"><button className="min-h-11 min-w-0 flex-1 break-words text-left text-accent" onClick={()=>patch({hotspot:row.id})}>{row.title}</button><button className={button} disabled={follows.busy} onClick={()=>void follows.change(row.id,row.title,'remove')}>取消关注</button></div>)}</section>}
        </section>
        <aside id="hotspot-distribution" className={`hotspot-distribution min-w-0 space-y-4 ${showDistribution?'is-open':''}`} aria-label="热点分布">
          <section className={panel}><h2 className="text-base font-medium">板块分布</h2><p className="mt-1 text-xs leading-5 text-muted">{selectedRows.length} 条 URL 去重报道；跟随窗口、板块与来源地区，不受搜索／关注筛选影响。</p><div className="mt-3 space-y-1">{Object.entries(stats.counts).map(([key,count])=><button key={key} className="min-h-11 w-full rounded-lg px-1 text-left hover:bg-raised" onClick={()=>patch({category:category===key?'':key})}><span className="flex justify-between text-xs"><span>{categories[key as HotspotCategory]}</span><span>{count} 条</span></span><span className="mt-2 block h-1.5 rounded bg-raised"><span className="block h-full rounded bg-accent" style={{width:`${count/Math.max(1,selectedRows.length)*100}%`}}/></span></button>)}</div></section>
          <section className={panel}><h2 className="text-base font-medium">发布来源地区</h2><p className="mt-1 text-xs leading-5 text-muted">发布机构所在地，不是事件发生地或当地民意热度。计数基于当前时间窗口全部板块。</p><label className="mt-3 grid gap-2 text-xs text-secondary">筛选来源地区<select className={`${input} w-full`} value={country} onChange={e=>patch({country:e.target.value})}><option value="">所有来源地区</option>{country&&!regionStats.countries.some(([name])=>name===country)&&<option value={country}>{country}（暂无报道）</option>}{regionStats.countries.map(([name,count])=><option key={name} value={name}>{regionNames[name]||name} · {count}</option>)}</select></label><ol className="mt-3 space-y-2">{regionStats.countries.slice(0,6).map(([name,count])=><li key={name} className="flex justify-between gap-3 text-xs text-secondary"><span>{regionNames[name]||name}</span><span>{count} 条</span></li>)}</ol></section>
          <details className={panel}><summary className="min-h-11 cursor-pointer text-sm font-medium">近 7 日板块热力分布</summary><p className="mb-3 text-xs leading-5 text-muted">所有来源、所有板块；UTC 自然日，今天未结束。数字为报道数；历史数据可能是首轮回填，不能直接当作升温趋势。</p><div className="overflow-x-auto" role="region" aria-label="七日板块热力表" tabIndex={0}><table className="hotspot-matrix"><thead><tr><th>板块</th>{matrix.days.map(day=><th key={day}>{day.slice(5)}</th>)}</tr></thead><tbody>{Object.entries(matrix.matrix).map(([key,values])=><tr key={key}><th>{categories[key as HotspotCategory]}</th>{values.map((count,i)=><td key={i} style={{background:count?`rgba(169,163,255,${0.08+0.35*count/Math.max(1,...Object.values(matrix.matrix).flat())})`:undefined}}>{count}</td>)}</tr>)}</tbody></table></div></details>
        </aside>
      </div>
    </>}
    <details className={`${panel} mt-6`}><summary className="min-h-11 cursor-pointer text-sm font-medium">热度算法、采集状态与隐私</summary><div className="mt-2 space-y-3 text-sm leading-6 text-secondary">
      <p>算法 news-hotspots/1：以采集时刻为截止点，每条去重标题的权重为 2^(−发布距今小时数 / 24)。每个发布方最多取权重最高的 3 条，求和 × 10，保留 1 位小数。同标题跨来源只计一次；同集团多个频道合并。分数不是百分比，没有 100 分上限。</p>
      <p>统计取每日精选之前的候选报道，不受每日每源 3 条的展示限制。主题按公开字面规则关联，不等于同一事件；未匹配标题仍作为单篇线索进入榜单。不同主题的范围大小、媒体语言与信源数量会影响分数，不能据此比较社会影响大小。</p>
      <p>热点采样开始于 {corpus.startedAt.slice(0,10)} {utc(corpus.startedAt).slice(6)}。首轮读取 feed 中仍保留的历史条目，不代表完整历史。滚动保留 30 天标题与链接，不保存新闻全文。每 4 小时计划采集；GitHub Actions 可能延迟或失败，以页面实际采集时间为准，重建网站不会刷新时间。</p>
      <p>关注最多 50 个主题，仅保存在此浏览器，不同步、不发送系统通知、不上传个人数据。关闭页面后由网站定时采集公共新闻，下次访问时显示“新收录”；浏览详情不会自动标记已读。浏览器清理数据会丢失关注。搜索与筛选写入 URL，分享前请检查关键词。</p>
      <ul className="grid gap-2 sm:grid-cols-2">{corpus.sources.map(source=><li key={source.name}><a className="text-accent hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> · {source.state==='ok'?`可用 · feed ${source.count} 条`:'本轮失败，保留窗口内旧报道'}</li>)}</ul>
    </div></details>
  </div>
}
