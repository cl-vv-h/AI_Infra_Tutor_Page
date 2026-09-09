import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, FileCode2, RefreshCw } from 'lucide-react'
import { getArticleBySlug, articles } from '@/data/articles'
import { categories } from '@/data/categories'
import { rewriteImagePaths } from '@/data/assets'
import { rewriteCurriculumLinks } from '@/data/curriculum'
import { loadArticleContent } from '@/data/article-content'
import type { LoadedArticle } from '@/lib/article-loader'
import type { ArticleMetadata, Language } from '@/types'
import TableOfContents from '@/components/TableOfContents'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useLanguage } from '@/hooks/useLanguage'

function getCategorySlug(categoryId: string): string {
  const cat = categories.find((c) => c.id === categoryId)
  return cat?.slug ?? ''
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const article = getArticleBySlug(slug ?? '')
  const { language } = useLanguage()

  useEffect(() => {
    if (!article) return
    const previousTitle = document.title
    document.title = `${language === 'zh' ? article.title : article.titleEn} · AI Infra Space`
    return () => { document.title = previousTitle }
  }, [article, language])

  if (!article) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-white">404</h1>
          <p className="mb-6 text-gray-400">未找到该文章</p>
          <Link to="/" className="text-[#00d4ff] hover:underline">返回首页</Link>
        </div>
      </div>
    )
  }

  // A new reader owns each route/language request: old content never flashes
  // under a new title, and late requests cannot replace the current article.
  return <ArticleReader key={`${article.slug}:${language}`} article={article} language={language} />
}

function ArticleReader({ article, language }: { article: ArticleMetadata; language: Language }) {
  const [loaded, setLoaded] = useState<LoadedArticle | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const contentRoot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadArticleContent(article, language).then(
      (result) => { if (!cancelled) setLoaded(result) },
      () => { if (!cancelled) setFailed(true) },
    )
    return () => { cancelled = true }
  }, [article, language, attempt])

  const content = useMemo(() => loaded ? rewriteCurriculumLinks(
    rewriteImagePaths(loaded.content), article.sourcePath,
  ) : '', [loaded, article.sourcePath])

  const prevArticle = article.prevArticleId ? articles.find((a) => a.id === article.prevArticleId) : null
  const nextArticle = article.nextArticleId ? articles.find((a) => a.id === article.nextArticleId) : null
  const categorySlug = getCategorySlug(article.categoryId)
  const title = language === 'zh' ? article.title : article.titleEn

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        to={`/category/${categorySlug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#00d4ff] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        {language === 'zh' ? '返回分类' : 'Back to topic'}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
        <main className="min-w-0 lg:col-start-1 lg:row-start-1">
          <header className="mb-10">
            <div className="mb-5 flex items-start gap-2 break-all font-mono text-xs leading-5 text-cyan-200/60">
              <FileCode2 className="mt-0.5 h-4 w-4 shrink-0" /> {article.sourcePath}
            </div>
            <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">{title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.readTime}
              </span>
              <span>{(loaded?.language ?? language) === 'zh' ? '中文版本' : 'English version'}</span>
              {loaded && loaded.language !== language && (
                <span className="text-amber-200/80">{language === 'zh' ? '暂无中文译文，显示原文' : 'English unavailable; showing the available version'}</span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#00d4ff]/10 px-3 py-1 text-xs text-[#00d4ff]">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {failed ? (
            <div role="alert" className="rounded-2xl border border-amber-200/20 bg-amber-200/5 p-6">
              <p className="text-base text-amber-100">{language === 'zh' ? '正文暂时无法加载，请检查网络后重试。' : 'The article could not load. Check your connection and retry.'}</p>
              <button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1) }} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
                <RefreshCw className="h-4 w-4" /> {language === 'zh' ? '重试加载' : 'Try again'}
              </button>
              <button type="button" onClick={() => window.location.reload()} className="ml-3 mt-4 rounded-full px-4 py-2 text-sm text-cyan-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
                {language === 'zh' ? '刷新页面' : 'Reload page'}
              </button>
            </div>
          ) : loaded ? (
            <div ref={contentRoot} data-article-body><MarkdownRenderer content={content} /></div>
          ) : (
            <div role="status" aria-live="polite" className="min-h-80 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <p className="mb-6 text-sm text-slate-300">{language === 'zh' ? '正在加载本篇正文…' : 'Loading this article…'}</p>
              <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-5/6 rounded bg-white/5" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            </div>
          )}

          <nav aria-label={language === 'zh' ? '相邻课程' : 'Adjacent articles'} className="mt-12 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
            {prevArticle ? (
              <Link
                to={`/article/${prevArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                {language === 'zh' ? prevArticle.title : prevArticle.titleEn}
              </Link>
            ) : <div />}
            {nextArticle ? (
              <Link
                to={`/article/${nextArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                {language === 'zh' ? nextArticle.title : nextArticle.titleEn}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            ) : <div />}
          </nav>
        </main>

        {loaded && <TableOfContents content={content} contentRoot={contentRoot} />}
      </div>
    </div>
  )
}
