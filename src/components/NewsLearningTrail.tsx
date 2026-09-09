import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Network } from 'lucide-react'
import type { NewsItem } from '@/types/news'
import { learningForNews } from '@/lib/news-learning'

export default function NewsLearningTrail({ item }: { item: NewsItem }) {
  const matches = learningForNews(item)
  if (!matches.length) return null
  return <details aria-label={`学习线索：${item.title}`} className="mt-5 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.03]">
    <summary className="cursor-pointer px-3 py-3 text-sm text-cyan-100"><BookOpen className="mr-2 inline h-4 w-4" />学习线索 · {matches.length} 个概念</summary>
    <div className="border-t border-cyan-200/10 px-4 pb-4">
      <p className="mt-3 text-sm leading-6 text-white/60">根据标题与摘要的术语匹配，未读取全文或核查结论；按标题命中优先排列。模型链接仅为教学示例，不代表原文使用该模型。</p>
      <ol className="mt-4 space-y-5">{matches.map(({ concept, term, field }) => <li key={concept.id} className="border-l-2 border-cyan-200/25 pl-3">
        <h4 className="text-base font-semibold leading-6 text-cyan-50">{concept.label}</h4>
        <p className="mt-1 text-sm leading-6 text-white/60">{field === 'title' ? '标题' : '摘要'}匹配词：<span className="font-mono text-lime-100">{term}</span>（忽略大小写及连字符差异）</p>
        <p className="mt-2 text-base leading-7 text-slate-300">阅读时核对：{concept.question}</p>
        <Link to={concept.lesson.to} className="mt-3 block text-sm leading-6 text-cyan-100 hover:underline"><BookOpen className="mr-1.5 inline h-4 w-4" />背景课 · {concept.lesson.label}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>
        {concept.example && <Link to={concept.example.to} className="mt-2 block text-sm leading-6 text-lime-100 hover:underline"><Network className="mr-1.5 inline h-4 w-4" />教学示例 · {concept.example.label}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>}
        {concept.reference && <a href={concept.reference.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm leading-6 text-white/75 hover:text-white hover:underline">官方说明 · {concept.reference.label}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></a>}
      </li>)}</ol>
    </div>
  </details>
}
