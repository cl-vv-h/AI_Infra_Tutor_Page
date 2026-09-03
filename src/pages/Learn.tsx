import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Braces,
  Cpu,
  GitBranch,
  Network,
  Search,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { articles, getArticlesByCategory } from '@/data/articles'
import { categories } from '@/data/categories'

const foundations = new Set([
  'cat-10', 'cat-5', 'cat-11', 'cat-3', 'cat-4', 'cat-6', 'cat-15',
  'cat-7', 'cat-13', 'cat-1', 'cat-2', 'cat-12', 'cat-9', 'cat-14',
])

const learningRoutes = [
  {
    label: '01 · 建立推理心智模型',
    title: '从 Prefill / Decode 开始',
    description: '先理解请求、token、KV Cache、延迟与吞吐，再进入优化。',
    to: '/category/inference-basics',
    icon: BookOpen,
    color: '#70e1f5',
  },
  {
    label: '02 · 穿过真实系统',
    title: '沿一次请求阅读 SGLang',
    description: '从入口、调度器、缓存到 ModelRunner 与分布式通信。',
    to: '/category/sglang?sub=sglang-source-reading',
    icon: Waypoints,
    color: '#c7a8ff',
  },
  {
    label: '03 · 下沉到设备',
    title: 'Ascend NPU 与 Kernel',
    description: '走进 CANN、Triton-Ascend、Ascend C 与 torch_npu。',
    to: '/category/sglang?sub=ascend-kernel-infra',
    icon: Cpu,
    color: '#d8ff78',
  },
]

const newestSlugs = [
  'ai-infra-basic--model-architecture--09-kimi-delta-attention',
  'ai-infra-basic--model-architecture--08-compressed-sparse-attention',
  'ai-infra-basic--model-architecture--07-deepseek-sparse-attention',
  'sglang-ascend-npu--source-code-walkthrough--examples--01-qwen3-5-hybrid-end-to-end',
]

export default function Learn() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const topicCategories = useMemo(() => {
    return categories.filter((category) => {
      if (!foundations.has(category.id)) return false
      if (!normalizedQuery) return true
      return [category.name, category.nameEn, category.description, category.descriptionEn]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [normalizedQuery])

  const newest = newestSlugs
    .map((slug) => articles.find((article) => article.slug === slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article))

  return (
    <div className="learn-shell min-h-screen pb-24">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.22em] text-cyan-200/55">
                <Braces className="h-4 w-4" /> CURRICULUM / 2026
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-7xl">
                AI Infra，
                <span className="text-white/35">从概念到源码。</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300/65">
                内容同步自 SGLang Tutor 本地课程，按“基础 → 框架 → 硬件与算子”重组。每篇文章保留中英文版本与源码路径。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {[
                [String(articles.length), '篇内容'],
                [String(categories.length), '个主题'],
                ['ZH/EN', '双语'],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#0a1017] px-3 py-5 text-center">
                  <div className="font-mono text-lg font-semibold text-white">{value}</div>
                  <div className="mt-1 text-[0.65rem] text-white/35">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-24 px-5 pt-14 sm:px-8 lg:px-12">
        <section>
          <div className="mb-7 flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.2em] text-white/35">RECOMMENDED ROUTE</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">一条不容易迷路的路线</h2>
            </div>
            <GitBranch className="hidden h-6 w-6 text-white/25 sm:block" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {learningRoutes.map((route) => {
              const Icon = route.icon
              return (
                <Link
                  key={route.to}
                  to={route.to}
                  className="group rounded-3xl border border-white/10 bg-[#0e151e]/75 p-6 transition hover:-translate-y-1 hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.62rem] tracking-[0.15em] text-white/35">{route.label}</span>
                    <Icon className="h-5 w-5" style={{ color: route.color }} />
                  </div>
                  <h3 className="mt-12 text-xl font-semibold text-white">{route.title}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-300/60">{route.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs text-white/45 transition group-hover:text-white">
                    进入路线 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.2em] text-white/35">KNOWLEDGE DOMAINS</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">基础与优化专题</h2>
            </div>
            <label className="flex h-11 items-center gap-3 rounded-full border border-white/10 bg-white/[0.035] px-4 text-white/45 focus-within:border-cyan-200/40 focus-within:text-cyan-100">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索主题…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />
            </label>
          </div>

          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {topicCategories.map((category, index) => {
              const count = getArticlesByCategory(category.id).length
              return (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="group min-h-64 bg-[#0a1017] p-6 transition-colors hover:bg-[#101923]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[0.62rem] tracking-widest text-white/30">
                      DOMAIN {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.65rem] text-white/35">{count} 篇</span>
                  </div>
                  <div className="mt-12 h-1 w-10 rounded-full" style={{ backgroundColor: category.color }} />
                  <h3 className="mt-5 text-xl font-semibold text-white">{category.name}</h3>
                  <p className="mt-1 text-xs tracking-wide text-white/30">{category.nameEn}</p>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300/55">{category.description}</p>
                  <ArrowRight className="mt-6 h-4 w-4 text-white/25 transition group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              )
            })}
          </div>

          {topicCategories.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-white/35">
              没有匹配的主题，换个关键词试试。
            </div>
          )}
        </section>

        <section className="grid gap-8 overflow-hidden rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.045] p-7 sm:p-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Network className="h-7 w-7 text-violet-300" />
            <p className="mt-8 font-mono text-[0.65rem] tracking-[0.2em] text-violet-200/50">DEEP DIVE</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">SGLang 系统阅读室</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300/65">
              五条互相衔接的深读线：源码总览、Scheduler、TP Worker / ModelRunner、Ascend NPU 适配与算子基础设施。
            </p>
            <Link to="/category/sglang" className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-300 px-5 py-2.5 text-sm font-semibold text-[#110d19] transition hover:bg-violet-200">
              打开系统地图 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categories.find((category) => category.id === 'cat-8')?.subcategories.filter((sub) => sub.slug !== 'knowledge-graph').map((sub, index) => (
              <Link
                key={sub.id}
                to={`/category/sglang?sub=${sub.slug}`}
                className="rounded-2xl border border-white/[0.08] bg-black/15 p-5 transition hover:border-violet-300/30 hover:bg-violet-200/[0.04]"
              >
                <span className="font-mono text-[0.62rem] text-violet-200/40">0{index + 1}</span>
                <h3 className="mt-5 text-base font-medium text-white">{sub.name}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/40">{sub.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {newest.length > 0 && (
          <section>
            <div className="mb-7 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-lime-200" />
              <h2 className="text-2xl font-semibold text-white">本次同步新增</h2>
            </div>
            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {newest.map((article) => (
                <Link key={article.id} to={`/article/${article.slug}`} className="group grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="font-medium text-white transition group-hover:text-lime-200">{article.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-white/35">{article.summary}</p>
                  </div>
                  <span className="flex items-center gap-2 font-mono text-[0.65rem] text-white/30">{article.readTime} <ArrowRight className="h-3.5 w-3.5" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
