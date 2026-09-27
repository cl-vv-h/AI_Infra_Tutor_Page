import { ArrowRight, ArrowUpRight, Github } from 'lucide-react'
import { Link } from 'react-router-dom'
import { portalModules, type PortalModule } from '@/data/modules'

const statusLabel: Record<PortalModule['status'], string> = {
  live: '已开放', beta: '实验版', planned: '规划中',
}

function ModuleCard({ module, index }: { module: PortalModule; index: number }) {
  const Icon = module.icon
  const content = <>
    <div className="flex items-center justify-between gap-3 text-xs text-muted">
      <span className="font-mono">{String(index + 1).padStart(2, '0')} / {module.eyebrow.split(' / ')[0]}</span>
      <span className="rounded border border-line px-2 py-1">{statusLabel[module.status]}</span>
    </div>
    <Icon aria-hidden="true" className="mt-7 h-6 w-6 text-accent" />
    <h2 className="mt-4 text-xl font-semibold text-ink">{module.title}</h2>
    <p className="mt-1 text-xs text-muted">{module.titleEn}</p>
    <p className="mt-4 flex-1 text-sm leading-7 text-secondary">{module.description}</p>
    <div className="mt-6 flex items-end justify-between gap-3 border-t border-line pt-4">
      <span className="text-xs leading-6 text-muted">{module.stats.join(' · ')}</span>
      {module.to && <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />}
    </div>
  </>
  const classes='module-card group flex min-w-0 flex-col rounded-xl border border-line bg-surface p-6 text-left transition-colors'
  return module.to
    ? <Link to={module.to} className={classes}>{content}</Link>
    : <div className={classes} aria-label={module.title+'，规划中'}>{content}</div>
}

const startingPoints = [
  { number: '01', title: '理解一次推理请求', description: 'Prefill、Decode 与 KV Cache 的基础概念。', to: '/category/inference-basics', action: '阅读基础课程' },
  { number: '02', title: '拆解模型与显存', description: '观察张量形状，调整并行策略和混合精度。', to: '/models', action: '选择一个模型' },
  { number: '03', title: '分析实际执行性能', description: '在浏览器本地查看热点、阶段耗时与对照结果。', to: '/operators', action: '打开分析工作台' },
]

export default function Home() {
  return <div className="portal-shell">
    <div className="page-container pb-16 pt-12 sm:pb-20 sm:pt-20">
      <header className="grid gap-8 border-b border-line pb-12 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
        <div>
          <p className="eyebrow">AI INFRA SPACE / 开放知识与实践</p>
          <h1 className="mt-5 text-[2.75rem] font-semibold leading-[1.12] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">理解模型。<br /><span className="text-secondary">走进推理系统。</span></h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/learn" className="button-primary">开始学习 <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/models" className="button-secondary">探索模型工具</Link>
          </div>
        </div>
        <div className="max-w-md lg:border-l lg:border-line lg:pl-8">
          <p className="text-base leading-8 text-secondary">把系统课程、源码导读、交互实验与全球新闻连接起来，从理解原理到验证计算。</p>
          <p className="mt-5 text-xs leading-6 text-muted">双语课程 · 可追溯来源 · 本地性能分析</p>
        </div>
      </header>
      <section aria-label="功能模块" className="mt-10">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-secondary">选择你的工作空间</h2>
          <span className="text-xs text-muted">学习 / 阅读 / 实验 / 分析</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {portalModules.map((module, index) => <ModuleCard key={module.id} module={module} index={index} />)}
        </div>
      </section>
      <section aria-labelledby="starting-points" className="mt-16 grid gap-8 border-t border-line pt-10 lg:grid-cols-[0.6fr_1.4fr]">
        <div><p className="eyebrow">START HERE</p><h2 id="starting-points" className="mt-3 text-2xl font-semibold text-ink">从一个问题开始</h2><p className="mt-3 text-sm leading-7 text-muted">不必按顺序阅读，选择当前最需要解决的问题。</p></div>
        <div className="divide-y divide-line">
          {startingPoints.map(item => <Link key={item.to} to={item.to} className="group flex items-start gap-4 py-5 first:pt-0">
            <span className="pt-1 font-mono text-xs text-muted">{item.number}</span>
            <div className="min-w-0 flex-1"><h3 className="font-medium text-ink group-hover:text-accent">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{item.description}</p><span className="mt-3 inline-flex items-center gap-2 text-xs text-accent">{item.action} <ArrowRight className="h-3.5 w-3.5" /></span></div>
          </Link>)}
        </div>
      </section>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted">
        <span>持续维护的开放知识库</span>
        <a href="https://github.com/cl-vv-h/AI_Infra_Tutor_Page" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 hover:text-ink"><Github className="h-4 w-4" />在 GitHub 上共同构建</a>
      </div>
    </div>
  </div>
}
