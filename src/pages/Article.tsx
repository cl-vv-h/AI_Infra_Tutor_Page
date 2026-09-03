import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, FileCode2 } from 'lucide-react'
import { getArticleBySlug, articles } from '@/data/articles'
import { categories } from '@/data/categories'
import { rewriteImagePaths } from '@/data/assets'
import { rewriteCurriculumLinks } from '@/data/curriculum'
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
    document.title = `${language === 'zh' ? article.title : article.titleEn} · AI Infra Space`
    return () => { document.title = 'AI Infra Space · 技术知识与全球信号' }
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

  const prevArticle = article.prevArticleId ? articles.find((a) => a.id === article.prevArticleId) : null
  const nextArticle = article.nextArticleId ? articles.find((a) => a.id === article.nextArticleId) : null
  const categorySlug = getCategorySlug(article.categoryId)
  const title = language === 'zh' ? article.title : article.titleEn
  const content = rewriteCurriculumLinks(
    rewriteImagePaths(language === 'zh' ? article.content : article.contentEn),
    article.sourcePath,
  )

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        to={`/category/${categorySlug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#00d4ff] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        返回分类
      </Link>

      <div className="flex gap-10">
        <main className="min-w-0 flex-1">
          <header className="mb-10">
            <div className="mb-5 flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.16em] text-cyan-200/45">
              <FileCode2 className="h-4 w-4" /> {article.sourcePath}
            </div>
            <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">{title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.readTime}
              </span>
              <span>{language === 'zh' ? '中文版本' : 'English version'}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#00d4ff]/10 px-3 py-1 text-xs text-[#00d4ff]">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <MarkdownRenderer content={content} />

          <nav className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
            {prevArticle ? (
              <Link
                to={`/article/${prevArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {language === 'zh' ? prevArticle.title : prevArticle.titleEn}
              </Link>
            ) : <div />}
            {nextArticle ? (
              <Link
                to={`/article/${nextArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                {language === 'zh' ? nextArticle.title : nextArticle.titleEn}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : <div />}
          </nav>
        </main>

        <TableOfContents content={content} />
      </div>
    </div>
  )
}
