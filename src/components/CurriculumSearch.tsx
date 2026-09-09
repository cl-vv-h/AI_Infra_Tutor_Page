import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import { articles } from '@/data/articles'
import { categories } from '@/data/categories'
import { searchCurriculum } from '@/lib/curriculum-search'
import { useLanguage } from '@/hooks/useLanguage'

const pageSize = 12

export default function CurriculumSearch() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const { language } = useLanguage()
  const [expanded, setExpanded] = useState({ query: '', count: pageSize })
  const count = expanded.query === query ? expanded.count : pageSize
  const results = useMemo(() => searchCurriculum(articles, query), [query])
  const searching = Boolean(query.trim())
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  return (
    <section aria-label={language === 'zh' ? '搜索课程' : 'Course search'} className="mt-8">
      <label htmlFor="curriculum-search" className="mb-3 block text-sm text-slate-300">
        {language === 'zh' ? '搜索课程、概念或源码路径' : 'Search courses, concepts or source paths'}
      </label>
      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-cyan-200/20 bg-[#101923] px-4 focus-within:border-cyan-200/60 focus-within:ring-2 focus-within:ring-cyan-200/10">
        <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-200/70" />
        <input id="curriculum-search" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="KV Cache · Qwen3.5 · scheduler · torch_npu" aria-describedby="curriculum-search-help" className="min-w-0 flex-1 bg-transparent py-4 text-base text-white outline-none placeholder:text-slate-500" />
        {query && <button type="button" aria-label={language === 'zh' ? '清除搜索' : 'Clear search'} onClick={() => setQuery('')} className="rounded-full p-2 text-slate-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-cyan-200"><X className="h-4 w-4" /></button>}
      </div>
      <p id="curriculum-search-help" className="mt-2 text-xs leading-5 text-slate-400">{language === 'zh' ? '覆盖中英文标题、摘要、标签和源码路径；多个关键词用空格分隔。' : 'Matches bilingual titles, summaries, tags and source paths. Separate keywords with spaces.'}</p>
      {searching && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1017]">
          <p role="status" aria-live="polite" className="border-b border-white/10 px-5 py-3 text-sm text-slate-300">{language === 'zh' ? `找到 ${results.length} 篇课程` : `${results.length} courses found`}</p>
          {!results.length ? (
            <div className="p-6">
              <p className="text-base text-slate-300">{language === 'zh' ? '没有匹配的课程，试试更短的关键词。' : 'No courses match. Try a shorter keyword.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">{['Attention', 'KV Cache', 'Scheduler'].map((term) => <button type="button" key={term} onClick={() => setQuery(term)} className="rounded-full border border-white/15 px-3 py-2 text-sm text-cyan-200 hover:bg-white/5">{term}</button>)}</div>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {results.slice(0, count).map((article) => {
                const category = categories.find((item) => item.id === article.categoryId)
                return <li key={article.id}>
                  <Link to={`/article/${article.slug}`} className="group block px-5 py-5 transition-colors hover:bg-cyan-200/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-cyan-200">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><span className="text-cyan-200/80">{language === 'zh' ? category?.name : category?.nameEn}</span><span>{article.readTime}</span></div>
                    <h2 className="mt-2 flex items-start justify-between gap-4 text-lg font-medium text-white group-hover:text-cyan-100">{language === 'zh' ? article.title : article.titleEn}<ArrowRight className="mt-1 h-4 w-4 shrink-0 text-cyan-200/60" /></h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{language === 'zh' ? article.summary : article.summaryEn}</p>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-500">{article.sourcePath}</p>
                  </Link>
                </li>
              })}
            </ul>
          )}
          {count < results.length && <button type="button" onClick={() => setExpanded({ query, count: count + pageSize })} className="w-full border-t border-white/10 px-5 py-4 text-sm text-cyan-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-cyan-200">{language === 'zh' ? `继续显示（${Math.min(count, results.length)} / ${results.length}）` : `Show more (${count} / ${results.length})`}</button>}
        </div>
      )}
    </section>
  )
}
