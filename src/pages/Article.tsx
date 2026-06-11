import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react'
import { getArticleBySlug, articles } from '@/data/articles'
import { categories } from '@/data/categories'
import TableOfContents from '@/components/TableOfContents'
import MarkdownRenderer from '@/components/MarkdownRenderer'

function getCategorySlug(categoryId: string): string {
  const cat = categories.find((c) => c.id === categoryId)
  return cat?.slug ?? ''
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const article = getArticleBySlug(slug ?? '')

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
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
            <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {article.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.readTime}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#00d4ff]/10 px-3 py-1 text-xs text-[#00d4ff]">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <MarkdownRenderer content={article.content} />

          <nav className="mt-12 flex items-center justify-between border-t border-white/10 pt-6">
            {prevArticle ? (
              <Link
                to={`/article/${prevArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {prevArticle.title}
              </Link>
            ) : <div />}
            {nextArticle ? (
              <Link
                to={`/article/${nextArticle.slug}`}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00d4ff] transition-colors"
              >
                {nextArticle.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : <div />}
          </nav>
        </main>

        <TableOfContents content={article.content} />
      </div>
    </div>
  )
}
