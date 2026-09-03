import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Clock3,
  Cpu,
  Landmark,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import dailyJson from '@/data/news/daily.json'
import weeklyJson from '@/data/news/weekly/latest.json'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import type { DailyNewsData, NewsCategory, WeeklyReportData } from '@/types/news'

const daily = dailyJson as unknown as DailyNewsData
const weekly = weeklyJson as unknown as WeeklyReportData

const categoryMeta: Record<NewsCategory, { label: string; labelEn: string; color: string; icon: typeof BrainCircuit }> = {
  ai: { label: 'AI', labelEn: 'Artificial intelligence', color: '#70e1f5', icon: BrainCircuit },
  technology: { label: '科技', labelEn: 'Technology', color: '#c7a8ff', icon: Cpu },
  finance: { label: '金融', labelEn: 'Finance', color: '#d8ff78', icon: Landmark },
  world: { label: '国际形势', labelEn: 'World affairs', color: '#ffb86b', icon: Radio },
}

const categoryOrder: NewsCategory[] = ['ai', 'technology', 'finance', 'world']

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export default function News() {
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('ai')
  const filteredItems = useMemo(
    () => daily.items.filter((item) => item.category === activeCategory),
    [activeCategory],
  )
  const lead = filteredItems[0]
  const secondary = filteredItems.slice(1)
  const activeMeta = categoryMeta[activeCategory]
  const ActiveIcon = activeMeta.icon

  return (
    <div className="news-shell min-h-screen pb-24">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.22em] text-lime-200/55">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-300 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-300" />
                </span>
                GLOBAL SIGNAL DESK
              </div>
              <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em] text-white sm:text-7xl">新闻不是信息流，<span className="text-white/30">而是变化的坐标。</span></h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300/60">
                聚合来自研究机构、央行、公共机构与国际媒体的公开 RSS；按相关性与时效排序，所有条目直达原始来源。
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs text-white/45">
              <RefreshCw className="h-4 w-4 text-lime-200/70" />
              <div>
                <div className="font-mono text-[0.6rem] tracking-widest text-white/25">LAST SCAN</div>
                <div className="mt-1 text-white/65">{daily.generatedAt ? formatDate(daily.generatedAt) : '等待首次扫描'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pt-10 sm:px-8 lg:px-12">
        <section aria-label="新闻分类">
          <div className="grid gap-2 rounded-2xl border border-white/[0.08] bg-black/15 p-2 sm:grid-cols-4">
            {categoryOrder.map((category) => {
              const meta = categoryMeta[category]
              const Icon = meta.icon
              const active = activeCategory === category
              const count = daily.items.filter((item) => item.category === category).length
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition ${active ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'}`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" style={{ color: active ? meta.color : undefined }} />
                    <span>
                      <span className="block text-sm font-medium">{meta.label}</span>
                      <span className="mt-0.5 block font-mono text-[0.58rem] tracking-wider opacity-45">{meta.labelEn}</span>
                    </span>
                  </span>
                  <span className="font-mono text-[0.65rem] opacity-45">{String(count).padStart(2, '0')}</span>
                </button>
              )
            })}
          </div>
        </section>

        {lead ? (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <ActiveIcon className="h-4 w-4" style={{ color: activeMeta.color }} />
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-white/35">TOP SIGNAL / {activeMeta.labelEn.toUpperCase()}</span>
            </div>

            <a
              href={lead.url}
              target="_blank"
              rel="noreferrer"
              className="group grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d141d] transition hover:border-white/20 lg:grid-cols-[1.2fr_0.8fr]"
            >
              <div className="p-7 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
                  <span className="font-medium" style={{ color: activeMeta.color }}>{lead.source}</span>
                  <span>·</span>
                  <span>{lead.sourceCountry}</span>
                  <span>·</span>
                  <span>{formatDate(lead.publishedAt)}</span>
                </div>
                <h2 className="mt-7 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-white transition group-hover:text-cyan-100 sm:text-5xl">
                  {lead.title}
                </h2>
                {lead.summary && <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-300/55 sm:text-base">{lead.summary}</p>}
                <span className="mt-9 inline-flex items-center gap-2 text-sm text-white/55 transition group-hover:text-white">
                  阅读原文 <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
              <div className="news-signal-visual relative min-h-56 border-t border-white/[0.08] p-8 lg:border-l lg:border-t-0">
                <div className="absolute inset-x-8 top-8 flex justify-between font-mono text-[0.58rem] tracking-widest text-white/25">
                  <span>SIGNAL STRENGTH</span>
                  <span>{lead.score.toFixed(1)}</span>
                </div>
                <div className="absolute inset-x-8 bottom-9">
                  <div className="mb-3 flex h-16 items-end gap-1">
                    {[26, 42, 31, 58, 48, 72, 61, 87, 78, 100].map((height, index) => (
                      <span key={index} className="flex-1 rounded-sm bg-white/10" style={{ height: `${height}%`, backgroundColor: index > 7 ? activeMeta.color : undefined }} />
                    ))}
                  </div>
                  <div className="h-px bg-white/15" />
                </div>
              </div>
            </a>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {secondary.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-72 flex-col rounded-3xl border border-white/[0.08] bg-[#0a1017]/75 p-6 transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-4 text-[0.65rem] text-white/35">
                    <span className="truncate font-medium" style={{ color: activeMeta.color }}>{item.source}</span>
                    <span className="shrink-0">{formatDate(item.publishedAt)}</span>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold leading-7 text-white transition group-hover:text-cyan-100">{item.title}</h3>
                  {item.summary && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300/45">{item.summary}</p>}
                  <div className="mt-auto flex items-end justify-between gap-4 pt-7">
                    <span className="text-[0.65rem] text-white/25">{item.sourceCountry}</span>
                    <ArrowUpRight className="h-4 w-4 text-white/25 transition group-hover:text-white" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/10 py-24 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-white/25" />
            <h2 className="mt-5 text-xl font-semibold text-white">这个板块正在等待新信号</h2>
            <p className="mt-2 text-sm text-white/35">下一次每日扫描会自动补充内容。</p>
          </section>
        )}

        <section className="mt-24 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d141d]">
            <header className="flex flex-col gap-5 border-b border-white/[0.08] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
              <div>
                <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.18em] text-violet-200/55">
                  <Sparkles className="h-4 w-4" /> WEEKLY SYNTHESIS
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">本周信号报告</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[0.6rem] text-white/35">
                <Bot className="h-3.5 w-3.5" />
                {weekly.model ?? 'GPT-5.6 LUNA · PENDING'}
              </div>
            </header>
            <div className="weekly-report p-7 sm:p-9">
              <MarkdownRenderer content={weekly.content} />
            </div>
          </article>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-lime-200/15 bg-lime-200/[0.035] p-6">
              <ShieldCheck className="h-5 w-5 text-lime-200" />
              <h3 className="mt-7 font-semibold text-white">可追溯，而非黑箱摘要</h3>
              <p className="mt-3 text-sm leading-6 text-white/40">
                报告只使用公开新闻元数据，事实性判断附原始链接；标题与摘要始终按不可信输入处理。
              </p>
            </div>
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 text-sm text-white/40">
              <div className="font-mono text-[0.6rem] tracking-widest text-white/25">PIPELINE</div>
              <ol className="mt-5 space-y-4">
                <li className="flex gap-3"><span className="text-cyan-200">01</span><span>每日采集公开 RSS</span></li>
                <li className="flex gap-3"><span className="text-violet-200">02</span><span>去重、时效与信源加权</span></li>
                <li className="flex gap-3"><span className="text-lime-200">03</span><span>Codex · Luna 每周归纳并发布</span></li>
              </ol>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
