import { ArrowUpRight, GitBranch } from 'lucide-react'
import type { NewsReleaseData } from '@/types/news'

export default function NewsReleaseDesk({ data, source, stage, onSource, onStage }: {
  data: NewsReleaseData; source?: string; stage: 'all' | 'stable' | 'prerelease'
  onSource: (source: string) => void; onStage: (stage: 'all' | 'stable' | 'prerelease') => void
}) {
  const date = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(value)) : '尚未成功'
  return <section aria-label="框架版本导航" className="rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-200/5 to-[#0b131c] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-cyan-100"><GitBranch className="h-5 w-5" />框架发布追踪</h2>
      <span className="text-sm text-white/55">最近检查：{date(data.generatedAt)} · 北京时间</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-300">近 {data.lookbackDays} 天已收录的官方发布，每个框架正式版与预发布各保留最多 {data.limitPerStage} 条。每次只读取最近 30 条记录，不是完整版本历史；日期取发布记录，正式版标记不代表已验证适合生产部署。</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.sources.map((entry) => {
        const versions = data.items.filter((item) => item.source === entry.name)
        const latest = versions.find((item) => item.releaseStage === 'stable')
        return <div key={entry.name} className={`min-w-0 rounded-xl border p-4 ${source === entry.name ? 'border-cyan-200/50 bg-cyan-200/10' : 'border-white/10 bg-[#0b131c]/70'}`}>
          <button type="button" aria-pressed={source === entry.name} onClick={() => onSource(source === entry.name ? '' : entry.name)} className="flex w-full items-start justify-between gap-2 text-left text-base font-semibold text-white hover:text-cyan-100"><span>{entry.repository.split('/')[1]}</span><span className="font-mono text-sm text-cyan-200">{versions.length}</span></button>
          <p className="mt-2 text-sm text-white/60">{latest ? `已收录最近正式版：${date(latest.publishedAt)}` : '窗口内尚未收录正式版'}</p>
          {latest && <a href={latest.url} target="_blank" rel="noreferrer" className="mt-1 block break-words text-sm text-lime-100 hover:underline">{latest.title}</a>}
          <p className={`mt-2 text-sm ${entry.state === 'ok' ? 'text-white/55' : 'text-amber-100'}`}>{entry.state === 'ok' ? '官方接口可用' : `本次读取失败${entry.httpStatus ? ` · HTTP ${entry.httpStatus}` : ''}；显示历史收录`} · 最近成功：{date(entry.lastSuccessAt)}</p>
          <a href={entry.url} target="_blank" rel="noreferrer" aria-label={`${entry.name} 官方全部版本`} className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-100 hover:underline">官方全部版本<ArrowUpRight className="h-3.5 w-3.5" /></a>
        </div>
      })}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="版本阶段">
      {(['all', 'stable', 'prerelease'] as const).map((value) => <button key={value} type="button" aria-pressed={stage === value} onClick={() => onStage(value)} className={`rounded-full border px-4 py-2 text-sm ${stage === value ? 'border-cyan-200/40 bg-cyan-200/10 text-cyan-100' : 'border-white/15 text-white/65 hover:text-white'}`}>{value === 'all' ? '全部版本' : value === 'stable' ? '正式版' : '预发布'} <span className="ml-1 font-mono text-xs opacity-70">{data.items.filter((item) => (!source || item.source === source) && (value === 'all' || item.releaseStage === value)).length}</span></button>)}
      <span className="text-sm text-white/50">数量按当前框架统计</span>
    </div>
  </section>
}
