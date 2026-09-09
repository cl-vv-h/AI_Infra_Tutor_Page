import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Bookmark, Check, Clock3, Copy, Database, FileText, Globe2, Radio, Search, Sparkles } from 'lucide-react'
import dailyJson from '@/data/news/daily.json'
import libraryJson from '@/data/news/library.json'
import weeklyJson from '@/data/news/weekly/latest.json'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import NewsStudyGuide from '@/components/NewsStudyGuide'
import { newsTopics, topicsForItem } from '@/lib/news-topics.mjs'
import { filterNews, inferSourceType, legacyReadingListKey, mergeSavedItems, newsParams, parseNewsParams, readingListKey, readSavedItems } from '@/lib/news-reader'
import type { NewsReaderState, NewsView as View } from '@/lib/news-reader'
import type { DailyNewsData, NewsCategory, NewsItem, NewsLibraryData, NewsSourceType, WeeklyReportData } from '@/types/news'

const daily = dailyJson as DailyNewsData
const library = libraryJson as NewsLibraryData
const weekly = weeklyJson as WeeklyReportData
const archiveLoaders = import.meta.glob<DailyNewsData>('../data/news/archive/*.json', { import: 'default' })
const archiveDates = Object.keys(archiveLoaders).map((path) => path.split('/').pop()!.replace('.json', '')).sort().reverse()
const emptyItems: NewsItem[] = []
const categoryLabels: Record<'all' | NewsCategory, string> = { all: '全部板块', ai: 'AI', technology: '科技', finance: '金融', world: '国际形势' }
const sourceLabels: Record<'all' | NewsSourceType, string> = { all: '全部来源类型', research: '论文 / 研究', engineering: '工程博客', release: '版本发布', institution: '机构原文', analysis: '分析', news: '新闻报道' }
const viewMeta: Record<View, { title: string; description: string }> = {
  daily: { title: '每日信号', description: `最近 ${daily.lookbackHours ?? 48} 小时的新进展，每个信源最多 3 条，兼顾技术相关性与来源多样性。` },
  library: { title: '技术长读', description: `近 ${library.lookbackDays} 天、与 AI Infra 相关的工程博客与研究文章。按来源类型和关键词筛选，保留原始发布时间。` },
  archive: { title: '历史归档', description: '按采集日期回看当天收录的信号。文章可能发表于前一天，归档日期与发布日期分别标注。' },
  saved: { title: '阅读清单', description: '收藏保存在当前浏览器，包含标题、摘要和原文链接；每日新闻更新后仍可阅读。' },
}
const inputClass = 'rounded-xl border border-white/15 bg-[#0b131c] px-3 py-2.5 text-sm text-white/80 focus:outline-cyan-200'

function formatDate(value: string | null, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '暂无日期'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(new Date(value))
}

function initialReadingList() {
  if (typeof window === 'undefined') return { items: [], legacyIds: [], error: '' }
  try {
    const current = window.localStorage.getItem(readingListKey)
    if (current) {
      const pending = JSON.parse(current).pendingLegacyIds
      return { items: readSavedItems(current), legacyIds: Array.isArray(pending) ? pending.filter((id) => typeof id === 'string') as string[] : [], error: '' }
    }
    const legacy = JSON.parse(window.localStorage.getItem(legacyReadingListKey) ?? '[]')
    return { items: [], legacyIds: Array.isArray(legacy) ? legacy.filter((id) => typeof id === 'string') as string[] : [], error: '' }
  } catch { return { items: [], legacyIds: [], error: '无法读取本机收藏，原数据未改动。你仍可浏览新闻。' } }
}

function NewsCard({ item, saved, disabled, onSave, onTopic, onSource }: { item: NewsItem; saved: boolean; disabled: boolean; onSave: (item: NewsItem) => void; onTopic: (topic: string) => void; onSource: (source: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const summary = item.summary || '此信源未提供摘要，请阅读原文。'
  const topics = topicsForItem(item).slice(0, 3)
  return <article className="group flex flex-col rounded-2xl border border-white/10 bg-[#0b131c]/90 p-5 transition hover:border-cyan-200/30">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><button type="button" aria-label={`只看来源：${item.source}`} onClick={() => onSource(item.source)} className="text-left text-sm font-medium text-cyan-100 hover:underline">{item.source}</button><p className="mt-1 text-xs text-white/55">{sourceLabels[inferSourceType(item)]} · <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time></p></div>
      <button type="button" disabled={disabled} aria-pressed={saved} aria-label={`${saved ? '取消收藏' : '收藏'}：${item.title}`} onClick={() => onSave(item)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition disabled:opacity-40 ${saved ? 'border-lime-200/50 bg-lime-200/10 text-lime-100' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'}`}>{saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</button>
    </div>
    <h3 className="mt-5 text-xl font-semibold leading-7 text-white"><a href={item.url} target="_blank" rel="noreferrer" className="transition hover:text-cyan-100">{item.title}</a></h3>
    <p className={`mt-3 text-base leading-7 text-slate-300 ${expanded ? '' : 'line-clamp-3'}`}>{summary}</p>
    {summary.length > 130 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="mt-2 self-start text-sm text-cyan-200/80 hover:text-cyan-100">{expanded ? '收起摘要' : '展开摘要'}</button>}
    {topics.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{topics.map((id) => <button key={id} type="button" onClick={() => onTopic(id)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65 hover:border-cyan-200/40 hover:text-cyan-100">{newsTopics.find((topic) => topic.id === id)?.label}</button>)}</div>}
    <div className="mt-auto flex items-end justify-between gap-3 pt-5"><span className="text-xs text-white/50">{categoryLabels[item.category]} · {item.sourceCountry}</span><a href={item.url} target="_blank" rel="noreferrer" aria-label={`阅读原文：${item.title}`} className="inline-flex shrink-0 items-center gap-1.5 text-sm text-cyan-100">原文<ArrowUpRight className="h-4 w-4" /></a></div>
  </article>
}

export default function News() {
  const [params, setParams] = useSearchParams()
  const { state, notices } = parseNewsParams(params, archiveDates, newsTopics.map((item) => item.id))
  const { view, category, sourceType, source, topic, query, sortBy, archiveDate } = state
  const [copyState, setCopyState] = useState<{ params: string; status: 'copied' | 'failed'; url: string } | null>(null)
  const canonicalParams = newsParams(state).toString()
  const copyStatus = copyState?.params === canonicalParams ? copyState.status : null
  function update(next: Partial<NewsReaderState>, replace = false) { setParams(newsParams({ ...state, ...next }), { replace, preventScrollReset: true }) }
  const setCategory = (category: NewsReaderState['category']) => update({ category })
  const setSourceType = (sourceType: NewsReaderState['sourceType']) => update({ sourceType })
  const setTopic = (topic: string) => update({ topic })
  const setQuery = (query: string) => update({ query }, true)
  const setSortBy = (sortBy: NewsReaderState['sortBy']) => update({ sortBy })
  const [initial] = useState(initialReadingList)
  const [savedItems, setSavedItems] = useState<NewsItem[]>(initial.items)
  const [storageMessage, setStorageMessage] = useState(initial.error)
  const [migrating, setMigrating] = useState(initial.legacyIds.length > 0)
  const [pendingLegacyIds, setPendingLegacyIds] = useState(initial.legacyIds)
  const [archiveData, setArchiveData] = useState<{ date: string; data: DailyNewsData } | null>(null)
  const [archiveError, setArchiveError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!initial.legacyIds.length) return
    let active = true
    Promise.allSettled(Object.values(archiveLoaders).map((load) => load())).then((results) => {
      if (!active) return
      const catalog = [...daily.items, ...library.items, ...results.flatMap((result) => result.status === 'fulfilled' ? result.value.items : [])]
      const recovered = mergeSavedItems(initial.items, catalog.filter((item) => initial.legacyIds.includes(item.id)))
      setSavedItems(recovered)
      const pending = initial.legacyIds.filter((id) => !recovered.some((item) => item.id === id))
      setPendingLegacyIds(pending)
      try {
        window.localStorage.setItem(readingListKey, JSON.stringify({ version: 2, items: recovered, pendingLegacyIds: pending }))
        setStorageMessage(pending.length ? `阅读清单已有 ${recovered.length} 条；另有 ${pending.length} 条旧收藏暂未找到，下次打开页面会继续恢复。` : '旧收藏已恢复，并保存了文章摘要与链接。')
      } catch { setStorageMessage('浏览器未允许保存收藏；本次恢复的内容仅在当前会话可用。') }
      setMigrating(false)
    })
    return () => { active = false }
  }, [initial])

  useEffect(() => {
    if (view !== 'archive' || !archiveDate) return
    let active = true
    setArchiveError('')
    const loader = archiveLoaders[`../data/news/archive/${archiveDate}.json`]
    if (!loader) { setArchiveError('这个日期没有归档。'); return }
    loader().then((data) => { if (active) setArchiveData({ date: archiveDate, data }) })
      .catch(() => { if (active) setArchiveError('归档加载失败，请重试。') })
    return () => { active = false }
  }, [view, archiveDate, retry])

  const clearFilters = { category: 'all', sourceType: 'all', source: '', topic: 'all', query: '' } as const
  function resetFilters() { update(clearFilters) }
  function switchView(next: View) { update({ ...clearFilters, view: next, sortBy: next === 'daily' ? 'signal' : 'latest' }) }
  function openLongRead() { update({ ...clearFilters, view: 'library', topic, sortBy: 'latest' }) }
  async function copyFilters() {
    if (view === 'saved') return
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = `/news?${canonicalParams}`
    try { await navigator.clipboard.writeText(url.toString()); setCopyState({ params: canonicalParams, status: 'copied', url: url.toString() }) }
    catch { setCopyState({ params: canonicalParams, status: 'failed', url: url.toString() }) }
  }
  function toggleSaved(item: NewsItem) {
    const next = savedItems.some((saved) => saved.id === item.id) ? savedItems.filter((saved) => saved.id !== item.id) : [item, ...savedItems]
    setSavedItems(next)
    try { window.localStorage.setItem(readingListKey, JSON.stringify({ version: 2, items: next, pendingLegacyIds })); setStorageMessage('') }
    catch { setStorageMessage('本机存储不可用或已满；本次收藏变更仅在当前会话保留。') }
  }
  function exportSaved() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, items: savedItems }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ai-infra-reading-list.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const currentArchive = archiveData?.date === archiveDate ? archiveData.data : null
  const items = view === 'daily' ? daily.items : view === 'library' ? library.items : view === 'saved' ? savedItems : currentArchive?.items ?? emptyItems
  const filtered = useMemo(() => filterNews(items, { category, sourceType, source, topic, query, sortBy }, topicsForItem), [items, category, sourceType, source, topic, query, sortBy])
  const sourceCount = new Set(items.map((item) => item.source)).size
  const sourceOptions = [...new Set([...items.map((item) => item.source), ...(source ? [source] : [])])].sort((a, b) => a.localeCompare(b))
  const topicItems = filterNews(items, { ...state, topic: 'all' }, topicsForItem)
  const topicCounts = newsTopics.map((item) => ({ ...item, count: topicItems.filter((news) => topicsForItem(news).includes(item.id)).length }))
  const loading = view === 'archive' && !!archiveDate && !currentArchive && !archiveError

  return <div className="news-shell min-h-screen pb-20">
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-5 px-5 py-8 sm:px-8 lg:px-12">
        <div><p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-lime-200/75"><Radio className="h-4 w-4" /> GLOBAL SIGNAL DESK</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">发现技术，读懂进展。</h1><p className="mt-3 text-base text-slate-300">从推理引擎、芯片与论文，到政策和国际动态。</p></div>
        <div className="text-sm leading-7 text-white/60"><p>{daily.sourceCount} / {daily.sourceCount + daily.failedSourceCount} 个订阅正常 · {library.items.length} 篇技术长读</p><p>最近采集：{formatDate(daily.generatedAt, true)}</p></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1440px] px-5 pt-6 sm:px-8 lg:px-12">
      <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="阅读视图">{(Object.keys(viewMeta) as View[]).map((key) => <button key={key} type="button" aria-pressed={view === key} onClick={() => switchView(key)} className={`rounded-xl px-4 py-3 text-sm font-medium transition ${view === key ? 'bg-cyan-200 text-[#081116]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>{viewMeta[key].title}{key === 'saved' && ` (${savedItems.length})`}</button>)}<button type="button" onClick={() => document.getElementById('weekly')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })} className="ml-auto inline-flex items-center gap-2 px-3 text-sm text-violet-200"><Sparkles className="h-4 w-4" />每周报告</button></nav>

      <section aria-label="新闻筛选" className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm leading-6 text-white/65">{viewMeta[view].description}</p>{view === 'archive' && <label className="flex items-center gap-2 text-sm text-white/70">采集日期<select aria-label="选择归档日期" value={archiveDate} onChange={(event) => update({ archiveDate: event.target.value })} className={inputClass}>{archiveDates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label>}{view === 'saved' && <button type="button" disabled={!savedItems.length || migrating} onClick={exportSaved} className={`${inputClass} disabled:opacity-40`}>导出阅读清单</button>}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="mr-1 text-white/60">专题入口</span>{newsTopics.filter((item) => ['inference', 'kernels', 'models'].includes(item.id)).map((item) => <button key={item.id} type="button" onClick={() => update({ ...clearFilters, view: 'library', topic: item.id, sortBy: 'latest' })} className="rounded-lg border border-cyan-200/15 px-3 py-2 text-cyan-100 hover:bg-cyan-200/5">{item.label}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button>)}</div>
        <div className="flex flex-wrap gap-2">{(Object.keys(categoryLabels) as Array<'all' | NewsCategory>).map((key) => <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)} className={`rounded-full border px-4 py-2 text-sm ${category === key ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-white/60 hover:text-white'}`}>{categoryLabels[key]} <span className="ml-1 font-mono text-xs text-white/50">{key === 'all' ? items.length : items.filter((item) => item.category === key).length}</span></button>)}</div>
        <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-[#0b131c] p-3">
          <label className="flex min-w-48 flex-1 items-center gap-3 rounded-xl border border-white/15 px-3 text-white/60"><Search className="h-4 w-4" /><input aria-label="搜索标题、摘要、来源" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要、来源…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/50" /></label>
          <select aria-label="来源类型" value={sourceType} onChange={(event) => setSourceType(event.target.value as 'all' | NewsSourceType)} className={inputClass}>{Object.entries(sourceLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select aria-label="具体信源" value={source} onChange={(event) => update({ source: event.target.value })} className={`${inputClass} max-w-full`}><option value="">全部信源</option>{sourceOptions.map((name) => <option key={name} value={name}>{name} ({items.filter((item) => item.source === name).length})</option>)}</select>
          <select aria-label="排序方式" value={sortBy} onChange={(event) => setSortBy(event.target.value as 'signal' | 'latest')} className={inputClass}><option value="signal">编辑规则排序</option><option value="latest">发布时间排序</option></select>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="技术主题"><button type="button" aria-pressed={topic === 'all'} onClick={() => setTopic('all')} className={`rounded-full px-3 py-2 text-sm ${topic === 'all' ? 'bg-lime-200/10 text-lime-100' : 'text-white/60'}`}>全部主题</button>{topicCounts.filter((item) => item.count > 0 || item.id === topic).map((item) => <button key={item.id} type="button" aria-pressed={topic === item.id} onClick={() => setTopic(item.id)} className={`rounded-full px-3 py-2 text-sm ${topic === item.id ? 'bg-lime-200/10 text-lime-100' : 'text-white/60 hover:text-lime-100'}`}>{item.label} <span className="font-mono text-xs opacity-60">{item.count}</span></button>)}</div>
      </section>

      {notices.length > 0 && <p role="status" className="mt-4 text-sm text-amber-100">{notices.join(' ')}</p>}
      {!loading && !(view === 'archive' && archiveError) && <NewsStudyGuide topic={topic} label={newsTopics.find((item) => item.id === topic)?.label ?? ''} count={filtered.length} sources={new Set(filtered.map((item) => item.source)).size} onLongRead={openLongRead} isLibrary={view === 'library'} />}

      {(storageMessage || migrating) && <p role="status" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm text-amber-100">{migrating ? '正在从历史归档恢复旧收藏…' : storageMessage}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-white/60"><p aria-live="polite">{filtered.length} 条结果 · 当前视图覆盖 {sourceCount} 个来源</p><div className="flex items-center gap-4"><button type="button" onClick={resetFilters} className="text-cyan-200/80 hover:text-cyan-100">清除筛选</button>{view !== 'saved' && <button type="button" onClick={copyFilters} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-cyan-100 hover:bg-white/5">{copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}复制筛选链接</button>}</div></div>
      <p role="status" className="mt-2 text-sm text-white/55">{view === 'saved' ? '阅读清单仅在本机可见，不通过筛选链接共享。' : copyStatus === 'copied' ? '已复制筛选条件（含关键词）；不包含收藏数据。新闻更新后结果可能变化。' : copyStatus === 'failed' ? '无法自动复制，请选择下方链接手动复制。' : '链接包含当前筛选和关键词，不包含收藏。分享前请确认关键词适合公开。'}</p>
      {view !== 'saved' && copyStatus === 'failed' && <input readOnly aria-label="手动复制筛选链接" value={copyState?.url ?? ''} onFocus={(event) => event.target.select()} className={`${inputClass} mt-3 w-full`} />}

      {loading ? <p role="status" className="py-16 text-center text-white/65">正在读取 {archiveDate} 的归档…</p> : archiveError && view === 'archive' ? <div role="alert" className="py-16 text-center text-white/70"><p>{archiveError}</p><button type="button" className={`${inputClass} mt-4`} onClick={() => setRetry((value) => value + 1)}>重试</button></div> : filtered.length ? <section aria-label={viewMeta[view].title} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <NewsCard key={item.id} item={item} saved={savedItems.some((saved) => saved.id === item.id)} disabled={migrating} onSave={toggleSaved} onTopic={setTopic} onSource={(source) => update({ source })} />)}</section> : <section className="mt-4 rounded-3xl border border-dashed border-white/15 py-16 text-center"><Clock3 className="mx-auto h-6 w-6 text-white/50" /><h2 className="mt-4 text-xl text-white">{view === 'saved' && !savedItems.length ? '收藏文章，留给稍后的自己。' : '没有匹配的文章'}</h2><p className="mt-3 text-sm text-white/60">{view === 'saved' && !savedItems.length ? '在每日信号或技术长读中点击书签即可保存。' : '试试其他日期、板块或关键词。'}</p><button type="button" onClick={() => view === 'saved' && !savedItems.length ? switchView('library') : resetFilters()} className={`${inputClass} mt-5`}>{view === 'saved' && !savedItems.length ? '浏览技术长读' : '清除筛选'}</button></section>}

      <details className="mt-8 rounded-2xl border border-white/10 bg-[#0b131c] p-5">
        <summary className="cursor-pointer text-sm text-white/80"><Globe2 className="mr-2 inline h-4 w-4 text-cyan-200" />信源目录与采集状态 · {daily.failedSourceCount} 个订阅本次未成功</summary>
        <p className="mt-4 text-sm leading-6 text-white/60">状态表示最近一次订阅读取是否成功，不是文章真实性或质量评分。技术长读可能保留此前已收录的文章；仍以原始发布日期为准。主题由关键词匹配得到。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{daily.sourceStates?.map((source) => <div key={source.name} className="rounded-xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><a href={source.url} target="_blank" rel="noreferrer" className="text-sm text-cyan-100 hover:underline">{source.name}<ArrowUpRight className="ml-1 inline h-3 w-3" /></a><span className={`shrink-0 text-xs ${source.state === 'ok' ? 'text-lime-200' : 'text-amber-200'}`}>{source.state === 'ok' ? '正常' : source.state === 'invalid' ? '格式异常' : '暂不可用'}</span></div><p className="mt-2 text-xs text-white/55">{source.country} · {sourceLabels[source.type]}</p><p className="mt-2 text-sm text-white/65">每日 {source.selectedCount} 条 · 长读 {source.libraryCount} 篇</p><p className="mt-2 text-sm text-white/55">订阅内最近发布：{formatDate(source.latestPublishedAt)}</p></div>)}</div>
        <p className="mt-4 text-sm leading-6 text-white/55">编辑规则综合发布时间、信源类别和技术关键词，并限制单个来源占比；新闻聚合没有替你完成事实核查。技术博客中的基准数据也需结合测试条件阅读。</p>
      </details>

      <section id="weekly" className="mt-12 scroll-mt-20 overflow-hidden rounded-3xl border border-white/10 bg-[#0d141d]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-6 sm:p-8"><div><p className="flex items-center gap-2 font-mono text-xs tracking-widest text-violet-200"><FileText className="h-4 w-4" /> WEEKLY SYNTHESIS</p><h2 className="mt-3 text-2xl font-semibold text-white">每周信号报告</h2><p className="mt-2 text-sm text-white/60">{weekly.periodStart ? `覆盖归档：${weekly.periodStart} 至 ${weekly.periodEnd}` : '等待首次周报'} · {weekly.sources.length} 个引用来源</p></div><p className="flex items-center gap-2 text-xs text-white/55"><Database className="h-4 w-4" />{weekly.model ?? 'Luna · 等待生成'}</p></header>
        <div className="weekly-report p-6 sm:p-8"><MarkdownRenderer content={weekly.content} /></div>
      </section>
    </main>
  </div>
}
