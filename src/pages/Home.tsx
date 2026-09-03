import { ArrowUpRight, Asterisk, Github, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import { portalModules, type PortalModule } from '@/data/modules'

const statusLabel: Record<PortalModule['status'], string> = {
  live: 'ONLINE',
  beta: 'BETA',
  planned: 'PLANNED',
}

function ModuleCard({ module, index }: { module: PortalModule; index: number }) {
  const Icon = module.icon
  const content = (
    <>
      <div className="module-card__glow" style={{ backgroundColor: module.accent }} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[0.68rem] tracking-[0.22em] text-white/45">
            {module.eyebrow}
          </span>
          <span className="flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.16em] text-white/50">
            <span
              className={`h-1.5 w-1.5 rounded-full ${module.status === 'live' ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: module.accent }}
            />
            {statusLabel[module.status]}
          </span>
        </div>

        <div className="mt-16 flex items-end justify-between gap-5 sm:mt-24">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20"
            style={{ color: module.accent }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <span className="font-display text-6xl font-semibold tracking-[-0.08em] text-white/[0.045]">
            0{index + 1}
          </span>
        </div>

        <div className="mt-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]">
            {module.title}
          </h2>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-white/35">
            {module.titleEn}
          </p>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300/75">
            {module.description}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-8">
          <div className="flex flex-wrap gap-2">
            {module.stats.map((stat) => (
              <span key={stat} className="rounded-full border border-white/10 px-2.5 py-1 text-[0.68rem] text-white/45">
                {stat}
              </span>
            ))}
          </div>
          {module.to ? (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#070b10] transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
              style={{ backgroundColor: module.accent }}
            >
              <ArrowUpRight className="h-4 w-4" />
            </span>
          ) : (
            <span className="shrink-0 font-mono text-[0.65rem] tracking-widest text-white/25">SOON</span>
          )}
        </div>
      </div>
    </>
  )

  const cardClass = 'module-card group relative min-h-[420px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d131b]/80 p-6 text-left transition-all duration-500 hover:-translate-y-1 hover:border-white/20 sm:p-7'

  return module.to ? (
    <Link className={cardClass} to={module.to}>{content}</Link>
  ) : (
    <div className={`${cardClass} opacity-70`} aria-label={`${module.title}，规划中`}>{content}</div>
  )
}

export default function Home() {
  return (
    <div className="portal-shell min-h-[calc(100vh-4rem)] overflow-hidden">
      <section className="relative mx-auto max-w-[1440px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:px-12">
        <div className="portal-orbit portal-orbit--one" />
        <div className="portal-orbit portal-orbit--two" />

        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="mb-6 flex items-center gap-3 font-mono text-[0.68rem] uppercase tracking-[0.25em] text-cyan-200/55">
              <Radio className="h-3.5 w-3.5" />
              Open knowledge system · v2
            </div>
            <h1 className="max-w-5xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl lg:text-[6.4rem]">
              理解复杂系统，
              <span className="portal-gradient-text block">从一张好地图开始。</span>
            </h1>
          </div>
          <div className="max-w-lg border-l border-white/10 pl-6 lg:pb-2">
            <Asterisk className="mb-5 h-5 w-5 text-lime-200" />
            <p className="text-base leading-8 text-slate-300/70">
              一个持续生长的 AI Infra 知识入口：深读技术，追踪世界，也为下一种探索方式保留空间。
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-16 grid gap-5 lg:grid-cols-3">
          {portalModules.map((module, index) => (
            <ModuleCard key={module.id} module={module} index={index} />
          ))}
        </div>

        <div className="relative z-10 mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono tracking-[0.14em]">CURATED · BILINGUAL · SOURCE-LED</span>
          <a
            href="https://github.com/cl-vv-h/AI_Infra_Tutor_Page"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-white"
          >
            <Github className="h-3.5 w-3.5" />
            在 GitHub 上共同构建
          </a>
        </div>
      </section>
    </div>
  )
}
