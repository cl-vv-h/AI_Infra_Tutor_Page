import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  Bot,
  BrainCircuit,
  Check,
  Clock3,
  Cpu,
  Landmark,
  ListFilter,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import dailyJson from '@/data/news/daily.json'
import weeklyJson from '@/data/news/weekly/latest.json'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import type { DailyNewsData, NewsCategory, NewsItem, NewsSourceType, WeeklyReportData } from '@/types/news'

const daily = dailyJson as unknown as DailyNewsData
const weekly = weeklyJson as unknown as WeeklyReportData

const categoryMeta: Record<NewsCategory, { label: string; labelEn: string; color: string; icon: typeof BrainCircuit }> = {
  ai: { label: 'AI', labelEn: 'Models & research', color: '#70e1f5', icon: BrainCircuit },
  technology: { label: '科技', labelEn: 'Systems & chips', color: '#c7a8ff', icon: Cpu },
  finance: { label: '金融', labelEn: 'Policy & markets', color: '#d8ff78', icon: Landmark },
  world: { label: '国际形势', labelEn: 'World affairs', color: '#ffb86b', icon: Radio },
}

const sourceTypeMeta: Record<'all' | NewsSourceType, { label: string; short: string }> = {
  all: { label: '全部信号', short: 'ALL' },
  research: { label: '论文 / 研究', short: 'RESEARCH' },
  engineering: { label: '工程实践', short: 'ENGINEERING' },
  release: { label: '版本发布', short: 'RELEASE' },
  institution: { label: '机构原文', short: 'INSTITUTION' },
  analysis: { label: '深度分析', short: 'ANALYSIS' },
  news: { label: '国际报道', short: 'NEWS' },
}

const categoryOrder: NewsCategory[] = ['ai', 'technology', 'finance', 'world']
const sourceTypeOrder: Array<'all' | NewsSourceType> = ['all', 'research', 'engineering', 'release', 'institution', 'analysis', 'news']

function inferSourceType(item: NewsItem): NewsSourceType {
  if (item.sourceType) return item.sourceType
  if (/DeepMind|NASA/i.test(item.source)) return 'research'
  if (/NVIDIA/i.test(item.source)) return 'engineering'
  if (/Apple/i.test(item.source)) return 'release'
  if (/Bank|Reserve|Federal|UN News/i.test(item.source)) return 'institution'
  if (/TechCrunch|Ars Technica/i.test(item.source)) return 'analysis'
  return 'news'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function initialSavedIds() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem('ai-infra-news-reading-list') ?? '[]')
    return new Set<string>(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set<string>()
  }
}

function SaveButton({ item, saved, onToggle }: { item: NewsItem; saved: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      aria-label={saved ? `从阅读清单移除：${item.title}` : `保存到阅读清单：${item.title}`}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${saved ? 'border-lime-200/40 bg-lime-200/10 text-lime-200' : 'border-white/10 bg-[#0a1017]/80 text-white/35 hover:border-white/25 hover:text-white'}`}
    >
      {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  )
}

export default function News() {
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('ai')
  const [sourceType, setSourceType] = useState<'all' | NewsSourceType>('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'signal' | 'latest'>('signal')
  const [savedOnly, setSavedOnly] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(initialSavedIds)

  useEffect(() => {
    window.localStorage.setItem('ai-infra-news-reading-list', JSON.stringify([...savedIds]))
  }, [savedIds])

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return daily.items
      .filter((item) => item.category === activeCategory)
      .filter((item) => sourceType === 'all' || inferSourceType(item) === sourceType)
      .filter((item) => !savedOnly || savedIds.has(item.id))
      .filter((item) => !normalizedQuery || `${item.title} ${item.summary} ${item.source}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => sortBy === 'latest'
        ? Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
        : b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  }, [activeCategory, query, savedIds, savedOnly, sortBy, sourceType])

  const lead = filteredItems[0]
  const secondary = filteredItems.slice(1)
  const activeMeta = categoryMeta[activeCategory]
  const ActiveIcon = activeMeta.icon
  const technicalCount = daily.items.filter((item) => ['research', 'engineering', 'release'].includes(inferSourceType(item))).length

  return (
    <div className="news-shell min-h-screen pb-24">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto grid max-w-[1440px] gap-7 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-lime-200/55">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" /></span>
              GLOBAL SIGNAL DESK
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">技术信号优先，<span className="text-white/30">每条都能回到源头。</span></h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300/60">聚合论文、开源框架发布、工程博客、芯片系统、政策原文与国际报道；先看发生了什么，再判断为什么重要。</p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
            {[
              [String(daily.sourceCount), '可用信源'],
              [String(technicalCount), '技术条目'],
              [String(savedIds.size), '阅读清单'],
            ].map(([value, label]) => (
              <div key={label} className="min-w-24 bg-[#0a1017] px-4 py-4 text-center">
                <div className="font-mono text-base font-semibold text-white">{value}</div>
                <div className="mt-1 text-xs text-white/35">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pt-7 sm:px-8 lg:px-12">
        <section aria-label="新闻浏览控制" className="space-y-3">
          <div className="grid gap-2 rounded-2xl border border-white/[0.08] bg-black/15 p-2 sm:grid-cols-4">
            {categoryOrder.map((category) => {
              const meta = categoryMeta[category]
              const Icon = meta.icon
              const active = activeCategory === category
              const count = daily.items.filter((item) => item.category === category).length
              return (
                <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition ${active ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'}`}>
                  <span className="flex items-center gap-3"><Icon className="h-4 w-4" style={{ color: active ? meta.color : undefined }} /><span><span className="block text-sm font-medium">{meta.label}</span><span className="mt-0.5 block text-xs opacity-45">{meta.labelEn}</span></span></span>
                  <span className="font-mono text-xs opacity-45">{String(count).padStart(2, '0')}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0b1118]/75 p-3 xl:flex-row xl:items-center">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/15 px-4 text-white/40 focus-within:border-cyan-200/35 focus-within:text-cyan-100">
              <Search className="h-4 w-4" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要或信源…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
            </label>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 xl:pb-0" aria-label="信号类型">
              {sourceTypeOrder.map((type) => (
                <button key={type} type="button" onClick={() => setSourceType(type)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs transition ${sourceType === type ? 'border-cyan-200/35 bg-cyan-200/10 text-cyan-100' : 'border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/65'}`}>
                  {sourceTypeMeta[type].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSavedOnly((value) => !value)} className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs transition ${savedOnly ? 'border-lime-200/35 bg-lime-200/10 text-lime-100' : 'border-white/[0.08] text-white/35 hover:text-white/65'}`}><Bookmark className="h-3.5 w-3.5" /> 已保存</button>
              <label className="flex min-h-10 items-center gap-2 rounded-full border border-white/[0.08] px-3 text-xs text-white/35">
                <ListFilter className="h-3.5 w-3.5" />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'signal' | 'latest')} className="bg-transparent text-white/60 outline-none">
                  <option className="bg-[#0b1118]" value="signal">信号强度</option>
                  <option className="bg-[#0b1118]" value="latest">最新发布</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {lead ? (
          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><ActiveIcon className="h-4 w-4" style={{ color: activeMeta.color }} /><span className="font-mono text-xs tracking-[0.14em] text-white/35">{filteredItems.length} SIGNALS / {activeMeta.labelEn.toUpperCase()}</span></div>
              <div className="flex items-center gap-2 text-xs text-white/30"><RefreshCw className="h-3.5 w-3.5" /> {daily.generatedAt ? formatDate(daily.generatedAt) : '等待首次扫描'}</div>
            </div>

            <article className="relative grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d141d] lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-7 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
                  <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono" style={{ color: activeMeta.color }}>{sourceTypeMeta[inferSourceType(lead)].short}</span>
                  <span className="font-medium">{lead.source}</span><span>·</span><span>{lead.sourceCountry}</span><span>·</span><span>{formatDate(lead.publishedAt)}</span>
                </div>
                <h2 className="mt-7 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">{lead.title}</h2>
                {lead.summary && <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300/55">{lead.summary}</p>}
                <a href={lead.url} target="_blank" rel="noreferrer" className="mt-9 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">阅读原文 <ArrowUpRight className="h-4 w-4" /></a>
              </div>
              <div className="news-signal-visual relative min-h-56 border-t border-white/[0.08] p-8 lg:border-l lg:border-t-0">
                <div className="absolute right-6 top-6"><SaveButton item={lead} saved={savedIds.has(lead.id)} onToggle={toggleSaved} /></div>
                <div className="absolute inset-x-8 top-8 flex justify-between pr-14 font-mono text-xs tracking-widest text-white/25"><span>SIGNAL STRENGTH</span><span>{lead.score.toFixed(1)}</span></div>
                <div className="absolute inset-x-8 bottom-9"><div className="mb-3 flex h-16 items-end gap-1">{[26, 42, 31, 58, 48, 72, 61, 87, 78, 100].map((height, index) => <span key={index} className="flex-1 rounded-sm bg-white/10" style={{ height: `${height}%`, backgroundColor: index > 7 ? activeMeta.color : undefined }} />)}</div><div className="h-px bg-white/15" /></div>
              </div>
            </article>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {secondary.map((item) => (
                <article key={item.id} className="group flex min-h-72 flex-col rounded-3xl border border-white/[0.08] bg-[#0a1017]/75 p-6 transition hover:-translate-y-0.5 hover:border-white/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 text-xs text-white/35"><span className="block truncate font-medium" style={{ color: activeMeta.color }}>{item.source}</span><span className="mt-1 block">{sourceTypeMeta[inferSourceType(item)].label} · {formatDate(item.publishedAt)}</span></div>
                    <SaveButton item={item} saved={savedIds.has(item.id)} onToggle={toggleSaved} />
                  </div>
                  <h3 className="mt-7 text-lg font-semibold leading-7 text-white transition group-hover:text-cyan-100">{item.title}</h3>
                  {item.summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300/45">{item.summary}</p>}
                  <div className="mt-auto flex items-end justify-between gap-4 pt-7"><span className="text-xs text-white/25">{item.sourceCountry} · score {item.score.toFixed(1)}</span><a href={item.url} target="_blank" rel="noreferrer" aria-label={`阅读原文：${item.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/30 transition hover:border-cyan-200/35 hover:text-cyan-100"><ArrowUpRight className="h-4 w-4" /></a></div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/10 py-20 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-white/25" /><h2 className="mt-5 text-xl font-semibold text-white">没有匹配的信号</h2><p className="mt-2 text-sm text-white/35">调整分类、信号类型或搜索词。</p>
          </section>
        )}

        <section className="mt-24 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d141d]">
            <header className="flex flex-col gap-5 border-b border-white/[0.08] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
              <div><div className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-violet-200/55"><Sparkles className="h-4 w-4" /> WEEKLY SYNTHESIS</div><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">本周信号报告</h2></div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-white/35"><Bot className="h-3.5 w-3.5" />{weekly.model ?? 'GPT-5.6 LUNA · PENDING'}</div>
            </header>
            <div className="weekly-report p-7 sm:p-9"><MarkdownRenderer content={weekly.content} /></div>
          </article>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-lime-200/15 bg-lime-200/[0.035] p-6"><ShieldCheck className="h-5 w-5 text-lime-200" /><h3 className="mt-7 font-semibold text-white">可追溯，而非黑箱摘要</h3><p className="mt-3 text-sm leading-6 text-white/40">报告只使用公开新闻元数据，事实性判断附原始链接；标题与摘要始终按不可信输入处理。</p></div>
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 text-sm text-white/40"><div className="font-mono text-xs tracking-widest text-white/25">PIPELINE</div><ol className="mt-5 space-y-4"><li className="flex gap-3"><span className="text-cyan-200">01</span><span>研究与工程信号优先</span></li><li className="flex gap-3"><span className="text-violet-200">02</span><span>去重、时效与技术相关性加权</span></li><li className="flex gap-3"><span className="text-lime-200">03</span><span>Codex · Luna 每周归纳并发布</span></li></ol></div>
          </aside>
        </section>
      </main>
    </div>
  )
}
