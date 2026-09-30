import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Bookmark, Check, Search, SlidersHorizontal, Sun, Moon, X } from 'lucide-react'
import NewsSphere from '@/components/NewsSphere'
import NewsFreshness from '@/components/NewsFreshness'
import eventsGate from '../../config/news-events.json'
import hotspotsGate from '../../config/news-hotspots.json'
import corpusJson from '@/data/news/hotspots.json'
import dailyJson from '@/data/news/daily.json'
import { categories, changeFollow, FOLLOW_KEY, parseFollows, validateHotspotCorpus, matchTopic } from '@/lib/news-hotspots.mjs'
import type { FollowState, Hotspot } from '@/lib/news-hotspots.mjs'
import { filterRadar, radarCatalog, radarWindow, readRadarQuery, relatedSignals } from '@/lib/news-sphere'
import './news-radar.css'

const corpus = validateHotspotCorpus(corpusJson), catalog = radarCatalog(corpus)
const utc = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 16)} UTC`
const labels = [['', 'ALL', '全部'], ['ai', 'AI', '人工智能'], ['technology', 'TECH', '科技'], ['finance', 'FINANCE', '金融'], ['world', 'WORLD', '国际形势']]
const kind = (row: Hotspot) => row.kind === 'topic' ? '主题聚合' : row.kind === 'cluster' ? '相近标题 · 待核对' : '单篇线索'
const summaries = new Map(dailyJson.items.map(row => [row.url, row.summary]))

function useRadarFollows() {
  const [value, setValue] = useState<FollowState>({version:1,entries:[]}), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    const read = () => {try {setValue(parseFollows(localStorage.getItem(FOLLOW_KEY)));setError('')} catch {setError('无法读取本机关注，原数据未改动；新闻仍可浏览。')}}
    const sync = (event: StorageEvent) => {if (event.key === FOLLOW_KEY || event.key === null) read()}
    read(); window.addEventListener('storage',sync); window.addEventListener('focus',read)
    return () => {window.removeEventListener('storage',sync);window.removeEventListener('focus',read)}
  }, [])
  const change = async (item: Hotspot, action: 'add'|'remove'|'read') => {
    setBusy(true)
    try {setValue(await changeFollow(localStorage,navigator.locks,item.id,item.title,corpus.generatedAt,action));setError('')}
    catch (cause) {setError(`关注操作未完成：${cause instanceof Error ? cause.message : '浏览器拒绝存储'}。`)}
    finally {setBusy(false)}
  }
  return {value,error,busy,change}
}

export default function NewsRadar() {
  const [params, setParams] = useSearchParams(), query = useMemo(() => readRadarQuery(params), [params])
  const pendingParams = useRef(params)
  useEffect(() => {pendingParams.current = params}, [params])
  const [light, setLight] = useState(false), [settings, setSettings] = useState(false), [sphere, setSphere] = useState(true)
  const [highlighted, setHighlighted] = useState(''), [limit, setLimit] = useState(15), [now, setNow] = useState(Date.now)
  const follows = useRadarFollows(), dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null), opener = useRef<HTMLElement|null>(null)
  const items = useMemo(() => radarWindow(catalog, corpus.generatedAt, query.hours), [query.hours])
  const filtered = useMemo(() => filterRadar(items, query, follows.value.entries.map(row => row.id)), [items, query, follows.value])
  const selected = items.find(row => row.id === query.selected) || catalog.find(row => row.id === query.selected)
  const patch = (values: Record<string,string>, replace = false) => {const next = new URLSearchParams(pendingParams.current);next.set('mode','radar');for(const [key,value] of Object.entries(values)){if(value)next.set(key,value);else next.delete(key)}pendingParams.current=next;setLimit(15);setParams(next,{replace,preventScrollReset:true})}
  const select = (id: string) => {if (!query.selected) opener.current = document.activeElement as HTMLElement;patch({selected:id})}
  const close = () => patch({selected:''})
  useEffect(() => {const timer = setInterval(() => setNow(Date.now()),60000);return () => clearInterval(timer)},[])
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (query.selected && !element.open) {element.showModal();closeButton.current?.focus()}
    else if (!query.selected && element.open) {element.close();opener.current?.focus({preventScroll:true})}
  },[query.selected])
  const age = Math.max(0,Math.floor((now-Date.parse(corpus.generatedAt))/3600000)), failed = corpus.sources.filter(row => row.state !== 'ok')
  const topTopics = items.filter(row => row.kind === 'topic').slice(0,8), lead = filtered[0]
  const followed = selected && follows.value.entries.find(row => row.id === selected.id)
  const unread = selected && followed ? corpus.items.filter(row => matchTopic(row)?.id === selected.id && row.firstSeenAt > followed.seenThrough).length : 0
  const skip = () => {const target = document.getElementById('pulse-feed');target?.scrollIntoView({behavior:'instant',block:'start'});target?.focus({preventScroll:true})}
  return <div className={`pulse ${light ? 'pulse-light' : ''}`}>
    <div className="pulse-container">
      <header className="pulse-header">
        <Link to="/news" className="pulse-wordmark" aria-label="PULSE 新闻首页"><span className="pulse-brand-dot"/>PULSE<span className="pulse-brand-sub">NEWS INTELLIGENCE</span></Link>
        <label className="pulse-search"><Search size={17}/><span className="sr-only">搜索新闻、公司、人物或话题</span><input type="search" value={query.q} maxLength={160} placeholder="搜索事件、公司、人物或话题…" onChange={event => patch({q:event.target.value,selected:''},true)}/><span className="pulse-search-hint">探索信号</span></label>
        <div className="pulse-header-actions"><time dateTime={new Date(now).toISOString()}>{new Date(now).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}</time><button onClick={() => setLight(value => !value)} aria-label={light ? '切换深色阅读' : '切换浅色阅读'}>{light ? <Moon size={18}/> : <Sun size={18}/>}</button><button onClick={() => setSettings(value => !value)} aria-expanded={settings} aria-controls="pulse-settings" aria-label="阅读设置"><SlidersHorizontal size={18}/></button></div>
      </header>
      <nav className="pulse-links" aria-label="新闻导航"><span aria-current="page">信息雷达</span>{eventsGate.enabled && <Link to="/news/events" aria-label="事件追踪：热点分布与追踪">{hotspotsGate.enabled ? '热点分布与追踪 ↗' : '已核对事件脉络 ↗'}</Link>}<Link to="/news/weekly">每周报告</Link><Link to="/news?view=daily">每日精选</Link><Link to="/news?view=library">技术长读</Link><Link to="/news?view=releases">框架版本</Link><Link to="/news?view=archive">归档</Link><Link to="/news?view=saved">阅读清单</Link></nav>
      {settings && <section id="pulse-settings" className="pulse-settings"><label><input type="checkbox" checked={sphere} onChange={event => setSphere(event.target.checked)}/> 显示交互球体</label><p>设置仅在本次访问有效。系统“减少动态效果”会禁用自动旋转；所有新闻都可用键盘或下方列表访问。不请求定位，不记录浏览轨迹。</p></section>}
      <div className="pulse-filterbar"><div className="pulse-categories" aria-label="新闻板块">{labels.map(([value,label,zh]) => <button key={value} onClick={() => patch({category:value,topic:'',selected:''})} aria-pressed={query.category===value} title={zh}>{label}</button>)}</div><label className="pulse-window">时间窗口<select value={query.hours} onChange={event => patch({hours:event.target.value,selected:''})}><option value="1">1H</option><option value="6">6H</option><option value="24">24H</option><option value="72">72H</option><option value="168">7D</option></select></label></div>
      {age > 12 && <p className="pulse-notice" role="status">采集快照已 {age} 小时未更新；这是截至采集时间的报道分布，不是实时热搜。</p>}
      {failed.length > 0 && <p className="pulse-notice">{failed.length} 个信源本轮采集失败，覆盖可能不完整。</p>}
      {follows.error && <p className="pulse-notice" role="alert">{follows.error}</p>}
      <section className={`pulse-observatory ${sphere ? '' : 'pulse-observatory-compact'}`} aria-label="全球新闻雷达">
        <div className="pulse-hero-copy"><p className="pulse-eyebrow">GLOBAL SIGNAL / 全球信息雷达</p><h1>世界的脉动<span>在此交汇。</span></h1><p className="pulse-intro">越过信息噪声，发现值得关注的变化。</p><div className="pulse-metrics"><span><strong data-testid="radar-count">{filtered.length}</strong> 新闻信号</span><span><strong>{new Set(filtered.flatMap(row => row.reports.map(r=>r.source))).size}</strong> 发布来源</span></div><p className="pulse-snapshot">采集 {utc(corpus.generatedAt)}<br/>球体为抽象分布，不表示地理位置。</p><button className="pulse-skip" onClick={skip}>直接阅读新闻 <ArrowDown size={15}/></button></div>
        {sphere && <NewsSphere all={catalog} visible={filtered} selected={query.selected} highlighted={highlighted} onSelect={select}/>}
        <div className="pulse-legend" aria-label="球体图例"><span>● 点 = 新闻线索或主题</span><span>大小 / 亮度 = 报道活跃度</span><span>非全网热搜 · 非可信度评分</span></div>
      </section>
      <section className="pulse-topics" aria-label="热门主题"><span className="pulse-eyebrow">HOT TOPICS</span><div>{topTopics.map(row => <button key={row.id} aria-pressed={query.topic===row.id} onClick={() => patch({topic:query.topic===row.id?'':row.id,category:'',q:'',selected:''})}>#{row.title}<span>{row.reports.length}</span></button>)}</div></section>
      <section id="pulse-feed" className="pulse-feed" tabIndex={-1} aria-labelledby="pulse-feed-title">
        <div className="pulse-feed-heading"><div><p className="pulse-eyebrow">THE READING ROOM</p><h2 id="pulse-feed-title">值得留意的信号</h2></div><div className="pulse-sort" aria-label="阅读排序">{[['heat','热点'],['latest','最新'],['mine','我的关注']].map(([value,label]) => <button key={value} aria-pressed={query.sort===value} onClick={() => patch({sort:value==='heat'?'':value})}>{label}</button>)}</div></div>
        <div className="pulse-resultline"><p role="status">{query.q ? `“${query.q}” · ` : ''}{filtered.length} 个匹配 · 近 {query.hours} 小时{query.sort==='mine'?' · 仅使用本机主动关注':''}</p>{(query.q||query.category||query.topic||query.sort==='mine') && <button onClick={() => patch({q:'',category:'',topic:'',sort:'',selected:''})}>清除筛选</button>}</div>
        {!lead ? <div className="pulse-empty"><h3>这个窗口暂时没有匹配信号。</h3><p>{query.sort==='mine'?'在主题详情点击“关注主题”，后续可在这里回看。':'试试扩大时间窗口或清除筛选。没有采集到报道，不代表没有事情发生。'}</p><button onClick={() => patch({hours:'168',q:'',category:'',topic:'',sort:''})}>查看近 7 天全部信号 →</button></div> : <>
          <article className={`pulse-featured ${highlighted===lead.id?'is-highlighted':''}`} onMouseEnter={() => setHighlighted(lead.id)} onMouseLeave={() => setHighlighted('')}>
            <div><p className="pulse-eyebrow">{query.sort==='latest'?'LATEST SIGNAL':'IN FOCUS'} / {categories[lead.category]}</p><button className="pulse-headline" onFocus={() => setHighlighted(lead.id)} onBlur={() => setHighlighted('')} onClick={() => select(lead.id)}>{lead.reports[0]?.title || lead.title}</button><p>{lead.kind==='topic' ? `${lead.title} · ${lead.reports.length} 条已收录报道，展开对照不同来源。` : summaries.get(lead.reports[0]?.url) || '查看来源、发布时间与相关报道；本站未提供此条新闻的正文摘要。'}</p><div className="pulse-meta">{lead.reports[0]?.source} <span>·</span> {utc(lead.latestAt)} <span>·</span> {kind(lead)}</div></div>
            <div className="pulse-data-art" aria-label={`活跃度 ${lead.score}，${lead.publishers} 个发布方`}><span className="pulse-eyebrow">COVERAGE SIGNAL</span><strong>{lead.score}<small>报道活跃度</small></strong><div className="pulse-data-bars" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{height:`${16+Math.sqrt(Math.min(1,lead.score/100))*Math.sin((i+1)/25*Math.PI)*70}%`}}/>)}</div><span>{lead.reports.length} 条报道 / {lead.publishers} 个发布方</span><small>视觉强度编码，不是历史趋势图</small></div>
          </article>
          <ol className="pulse-editorial" aria-label="新闻阅读流">{filtered.slice(0,limit).map((row,index) => <li key={row.id} data-testid="radar-row" data-signal={row.id} className={query.selected===row.id||highlighted===row.id?'is-highlighted':''} onMouseEnter={() => setHighlighted(row.id)} onMouseLeave={() => setHighlighted('')}><span className="pulse-number">{String(index+1).padStart(2,'0')}</span><div><div className="pulse-meta">{categories[row.category]} <span>·</span> {kind(row)} <span>·</span> {utc(row.latestAt)}</div><button className="pulse-row-title" onFocus={() => setHighlighted(row.id)} onBlur={() => setHighlighted('')} onClick={() => select(row.id)}>{row.title}</button>{row.kind==='topic' && <p className="pulse-row-deck">{row.reports[0]?.title}</p>}<div className="pulse-meta">{row.reports[0]?.source} <span>·</span> {row.reports.length} 条报道 / {row.publishers} 个发布方 {follows.value.entries.some(entry=>entry.id===row.id)&&<span className="pulse-followed">已关注</span>}</div></div><button className="pulse-heat" aria-label={`活跃度 ${row.score}，打开 ${row.title}`} onClick={() => select(row.id)}><span>{row.score}</span><small>活跃度</small><ArrowUpRight size={16}/></button></li>)}</ol>
          {filtered.length>limit && <button className="pulse-load-more" onClick={() => setLimit(value=>value+15)}>继续阅读 · 还有 {filtered.length-limit} 个信号 <ArrowDown size={15}/></button>}
        </>}
      </section>
      <section className="pulse-desks" aria-label="板块速览">{labels.slice(1).map(([key,label,zh]) => {const rows = items.filter(row=>row.category===key);return <article key={key}><p className="pulse-eyebrow">{label} / {zh}</p><span className="pulse-desk-count">{rows.length} 个信号</span>{rows.slice(0,3).map(row=><button key={row.id} onClick={()=>select(row.id)}>{row.title}<ArrowUpRight size={13}/></button>)}{!rows.length&&<p>当前时间窗口暂无采集。</p>}<button className="pulse-desk-all" onClick={()=>{patch({category:key,topic:'',q:'',sort:''});skip()}}>浏览板块 →</button></article>})}</section>
      <div className="pulse-freshness"><NewsFreshness/></div>
      <details className="pulse-method"><summary>数据来源、热度口径与隐私</summary><p>沿用 news-hotspots/1：去重标题按 24 小时半衰期衰减，每发布方最多计 3 条，加权总和 × 10。分数不是百分比，无 100 分上限，不包含点击量、社交互动或付费权重。时间窗口均截至采集快照，不是当前时钟；缩短窗口会重新计算分数。</p><p>点表示主题、标题相近的聚合或单篇新闻线索，不承诺每个点都是独立事件。连线仅代表同板块延伸阅读，不代表事实、因果或独立证实。未采集重要性与增长率，不显示虚构涨幅、Breaking 或 Live 标签。摘要缺失时请阅读来源原文。来源所在地不是事件发生地。</p><p>搜索为标题、主题、来源和来源国家的本地字面匹配，不调用语义搜索服务。筛选写入 URL；分享前检查关键词。“我的关注”只使用此浏览器主动保存的主题，不进行行为画像；与旧事件追踪共用原有关注格式，不迁移收藏。最多 50 个关注，安全写入失败会明确提示。</p><p>计划每 4 小时采集，发布可能失败或延迟；重建不更改采集时间。金融报道不构成投资建议。无登录、定位、API Key 或个人数据上传。</p><ul>{corpus.sources.map(source=><li key={source.name}><a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a> · {source.country} · {source.state==='ok'?'本轮可用':'本轮失败'}</li>)}</ul></details>
      <footer className="pulse-footer"><span>PULSE / 看见变化，保留判断。</span><span>{corpus.items.length} 条留存报道 · 采集 {utc(corpus.generatedAt)}</span></footer>
    </div>
    <dialog ref={dialog} className="pulse-detail" aria-labelledby="pulse-detail-title" onCancel={event=>{event.preventDefault();close()}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()}}}>
      <div className="pulse-detail-top"><span className="pulse-eyebrow">SIGNAL / FOCUS MODE</span><button ref={closeButton} onClick={close} aria-label="关闭新闻详情"><X size={20}/></button></div>
      {selected ? <><p className="pulse-meta">{categories[selected.category]} · {kind(selected)}</p><h2 id="pulse-detail-title">{selected.title}</h2><p className="pulse-detail-summary">{summaries.get(selected.reports[0]?.url) || (selected.kind==='topic'?'该主题按公开标题规则关联。下面是已收录报道，需结合原文判断；多来源不等于独立证实。':'当前只有标题及来源元数据，没有可靠正文摘要。请通过原文链接阅读完整报道。')}</p><div className="pulse-detail-stats"><span>{selected.reports.length} 条报道</span><span>{selected.publishers} 个发布方</span><span>活跃度 {selected.score}</span></div><p className="pulse-meta">最近发布 {utc(selected.latestAt)}{!items.some(row=>row.id===selected.id)&&' · 不在当前筛选窗口内，数值为近 7 天口径'}</p>
      {selected.kind==='topic'&&<div className="pulse-follow-actions"><button disabled={follows.busy} aria-pressed={!!followed} onClick={()=>void follows.change(selected,followed?'remove':'add')}><Bookmark size={15}/>{followed?'取消关注':'关注主题'}</button>{followed&&<><span>{unread} 条新收录</span><button disabled={follows.busy||!unread} onClick={()=>void follows.change(selected,'read')}><Check size={15}/>标记已读</button></>}</div>}
      {follows.error&&<p role="alert" className="pulse-notice">{follows.error}</p>}
      <a className="pulse-original" href={selected.reports[0]?.url} target="_blank" rel="noreferrer">阅读最新报道原文 <ArrowUpRight size={17}/></a>
      <h3>来源与报道时间线</h3><ol className="pulse-detail-stories">{selected.reports.slice(0,15).map(row=><li key={row.id}><p className="pulse-meta">{row.source} · {utc(row.publishedAt)}</p><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>发布机构所在地：{row.country}</small></li>)}</ol>{eventsGate.enabled && hotspotsGate.enabled && <Link className="pulse-track-link" to={`/news/events?hotspot=${encodeURIComponent(selected.id)}`}>完整追踪与 30 天来源分布 →</Link>}<h3>同板块延伸阅读</h3><p className="pulse-meta">连线依据：同一新闻板块，不代表同一事件。</p><div className="pulse-related">{relatedSignals(selected,items).map(row=><button key={row.id} onClick={()=>select(row.id)}>{row.title}<ArrowUpRight size={14}/></button>)}</div></> : <><h2 id="pulse-detail-title">当前索引中未找到此新闻</h2><p>可能已超出保留窗口。本机记录不会被删除；关闭详情后继续浏览。</p></>}
    </dialog>
  </div>
}
