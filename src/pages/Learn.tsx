import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  GitBranch,
  Network,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { articles, getArticlesByCategory } from '@/data/articles'
import { categories } from '@/data/categories'
import CurriculumSearch from '@/components/CurriculumSearch'
import PageHeader from '@/components/PageHeader'
import attentionAtlas from '../../config/attention-atlas.json'

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
  const topicCategories = categories.filter((category) => foundations.has(category.id))

  const newest = newestSlugs
    .map((slug) => articles.find((article) => article.slug === slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article))

  return (
    <div className="learn-shell min-h-screen pb-24">
      <div className="border-b border-line">
        <div className="page-container py-10 sm:py-12">
          <PageHeader eyebrow="CURRICULUM / 系统课程" title="AI Infra，从概念到源码。" description="内容同步自 SGLang Tutor，按基础、框架、硬件与算子组织。保留中英文版本与源码路径。" actions={<div className="flex flex-wrap gap-5 text-xs text-muted"><span><strong className="mr-1 text-base font-medium text-ink">{articles.length}</strong>篇内容</span><span><strong className="mr-1 text-base font-medium text-ink">{categories.length}</strong>个主题</span><span>ZH / EN 双语</span></div>} />
          <CurriculumSearch />
        </div>
      </div>

      <div className="page-container space-y-14 pt-10">
        {attentionAtlas.enabled && <Link to="/learn/attention" className="surface-card group flex flex-wrap items-center justify-between gap-5 p-6 transition-colors hover:border-accent/40"><div><p className="eyebrow">ATTENTION ATLAS</p><h2 className="mt-2 text-2xl font-semibold text-ink">Attention 演进图谱</h2><p className="mt-2 text-sm leading-6 text-secondary">MHA / GQA / MLA / DSA / GDN / KDA：沿分支与论文，理解机制之间的联系。</p></div><span className="inline-flex items-center gap-2 text-sm text-accent">探索技术路线 <ArrowRight size={16}/></span></Link>}
        <section>
          <div className="mb-7 flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-xs tracking-[0.2em] text-muted">RECOMMENDED ROUTE</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">一条不容易迷路的路线</h2>
            </div>
            <GitBranch className="hidden h-6 w-6 text-muted sm:block" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {learningRoutes.map((route) => {
              const Icon = route.icon
              return (
                <Link
                  key={route.to}
                  to={route.to}
                  className="surface-card group p-6 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-[0.15em] text-muted">{route.label}</span>
                    <Icon className="h-5 w-5" style={{ color: route.color }} />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-ink">{route.title}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-secondary">{route.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs text-muted transition group-hover:text-white">
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
              <p className="font-mono text-xs tracking-[0.2em] text-muted">KNOWLEDGE DOMAINS</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">基础与优化专题</h2>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {topicCategories.map((category, index) => {
              const count = getArticlesByCategory(category.id).length
              return (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="group bg-surface p-5 transition-colors hover:bg-raised"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xs tracking-widest text-muted">
                      DOMAIN {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted">{count} 篇</span>
                  </div>
                  <div className="mt-5 h-0.5 w-6 rounded-full" style={{ backgroundColor: category.color }} />
                  <h3 className="mt-5 text-xl font-semibold text-white">{category.name}</h3>
                  <p className="mt-1 text-xs tracking-wide text-muted">{category.nameEn}</p>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-secondary">{category.description}</p>
                  <ArrowRight className="mt-6 h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              )
            })}
          </div>

          {topicCategories.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-muted">
              没有匹配的主题，换个关键词试试。
            </div>
          )}
        </section>

        <section className="surface-card grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Network className="h-6 w-6 text-accent" />
            <p className="eyebrow mt-5">DEEP DIVE</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">SGLang 系统阅读室</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-secondary">
              五条互相衔接的深读线：源码总览、Scheduler、TP Worker / ModelRunner、Ascend NPU 适配与算子基础设施。
            </p>
            <Link to="/category/sglang" className="button-secondary mt-6">
              打开系统地图 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categories.find((category) => category.id === 'cat-8')?.subcategories.filter((sub) => sub.slug !== 'knowledge-graph').map((sub, index) => (
              <Link
                key={sub.id}
                to={`/category/sglang?sub=${sub.slug}`}
                className="rounded-lg border border-line bg-canvas p-5 transition-colors hover:border-accent/40"
              >
                <span className="font-mono text-xs text-muted">0{index + 1}</span>
                <h3 className="mt-5 text-base font-medium text-white">{sub.name}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{sub.description}</p>
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
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{article.summary}</p>
                  </div>
                  <span className="flex items-center gap-2 font-mono text-xs text-muted">{article.readTime} <ArrowRight className="h-3.5 w-3.5" /></span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
