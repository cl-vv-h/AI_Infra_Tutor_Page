import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen } from 'lucide-react'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import TableOfContents from '@/components/TableOfContents'
import content from '@/data/guides/profiling-reading.md?raw'

export default function ProfilingGuide() {
  const contentRoot=useRef<HTMLDivElement>(null)
  return <div className="profiling-guide mx-auto max-w-[1120px] px-5 py-8 [overflow-wrap:anywhere] sm:px-8 sm:py-12">
    <Link to="/operators" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-accent"><ArrowLeft size={16}/>返回 Profiling 工作台</Link>
    <header className="mb-8 max-w-[760px] border-b border-line pb-8">
      <p className="eyebrow flex items-center gap-2"><BookOpen size={15}/>Performance / Reading guide</p>
      <h1 className="mt-4 text-3xl font-semibold leading-snug text-ink sm:text-4xl">如何看懂 Profiling</h1>
      <p className="mt-4 text-base leading-8 text-secondary">从一份 Ascend PyTorch 采样出发，读懂文件、时间线与 MoE 执行。先分清发生了什么，再判断为什么慢。</p>
      <p className="mt-4 text-xs leading-6 text-muted">中文教程 · 建议按目录分段阅读 · 无需上传采样</p>
      <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm leading-7 text-secondary">
        <p><strong className="font-medium text-ink">先记住三句话</strong></p>
        <ul className="mt-2 list-disc space-y-1 pl-5"><li>Notify 是同步信号；等待时间不是数据传输时间。</li><li>Dispatch 分发 token，Combine 按路由回收并聚合专家结果。</li><li>算子时长相加不是端到端延迟，时间重叠也不等于有效加速。</li></ul>
      </div>
    </header>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
      <article aria-label="Profiling 阅读教程" className="min-w-0 max-w-[760px] lg:col-start-1 lg:row-start-1">
        <div ref={contentRoot} className="reading-body" data-guide-body><MarkdownRenderer content={content}/></div>
        <footer className="mt-10 border-t border-line pt-6">
          <Link to="/operators" className="button-primary">回到工作台，按教程练习<ArrowUpRight size={16}/></Link>
          <p className="mt-3 text-xs leading-6 text-muted">在性能板块内往返会保留已导入的内存分析；刷新页面或离开性能板块后需重新导入。</p>
        </footer>
      </article>
      <TableOfContents content={content} contentRoot={contentRoot}/>
    </div>
  </div>
}
