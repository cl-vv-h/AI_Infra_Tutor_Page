import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen } from 'lucide-react'
import { newsStudyGuides } from '@/data/news-study-guides'

export default function NewsStudyGuide({ topic, label, count, sources, onLongRead, isLibrary }: { topic: string; label: string; count: number; sources: number; onLongRead: () => void; isLibrary: boolean }) {
  const guide = newsStudyGuides[topic]
  if (!guide) return null
  return <details aria-label={`${label}研读指南`} className="mt-5 rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-200/5 to-[#0b131c] p-5 lg:px-6">
    <summary className="cursor-pointer text-base text-cyan-100"><BookOpen className="mx-2 inline h-4 w-4" />专题研读 · {label}<span className="ml-3 text-sm text-white/60">阅读提示{guide.links.length > 0 ? '与背景课程' : ''} · {count} 篇 / {sources} 个来源</span></summary>
    <div className="mt-5 grid gap-6 border-t border-white/10 pt-5 lg:grid-cols-[1fr_1.5fr]">
    <div><h2 className="text-xl font-semibold text-white">{guide.title}</h2><p className="mt-3 text-sm leading-6 text-white/60">以下是阅读提示，不是对这些文章的核查结论。</p>{!isLibrary && <button type="button" onClick={onLongRead} className="mt-4 text-sm text-cyan-100 hover:underline">查看此主题的技术长读<ArrowUpRight className="ml-1 inline h-4 w-4" /></button>}{guide.originals && <div className="mt-4 border-t border-white/10 pt-4"><p className="mb-2 text-sm text-white/55">原站深读入口 · 不代表已自动收录</p>{guide.originals.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block text-sm leading-7 text-cyan-100 hover:underline">{item.label}<ArrowUpRight className="ml-1 inline h-4 w-4" /></a>)}</div>}</div>
    <div><ol className="space-y-3">{guide.questions.map((question, index) => <li key={question} className="flex gap-3 text-base leading-7 text-slate-200"><span className="font-mono text-cyan-200/60">0{index + 1}</span><span>{question}</span></li>)}</ol>{guide.links.length > 0 && <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">{guide.links.map((link) => <Link key={link.to} to={link.to} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-cyan-100 hover:bg-white/5">{link.label}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>)}</div>}</div>
    </div>
  </details>
}
