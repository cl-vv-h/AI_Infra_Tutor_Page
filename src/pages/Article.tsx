import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react'
import { getArticleBySlug, articles } from '@/data/articles'
import { categories } from '@/data/categories'
import TableOfContents from '@/components/TableOfContents'

function renderContent(content: string) {
  const blocks = content.split('\n\n')
  return blocks.map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4)
      const id = text.replace(/\s+/g, '-')
      return (
        <h3 key={i} id={id} className="mb-3 mt-8 text-xl font-semibold text-white">
          {renderInline(text)}
        </h3>
      )
    }

    if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3)
      const id = text.replace(/\s+/g, '-')
      return (
        <h2 key={i} id={id} className="mb-4 mt-10 border-b border-white/10 pb-3 text-2xl font-bold text-white">
          {renderInline(text)}
        </h2>
      )
    }

    if (trimmed.startsWith('|')) {
      return renderTable(trimmed, i)
    }

    const lines = trimmed.split('\n')
    const listItems = lines.filter((l) => /^- /.test(l.trim()))
    const numberedItems = lines.filter((l) => /^\d+\.\s/.test(l.trim()))

    if (listItems.length > 0 && listItems.length === lines.length) {
      return (
        <ul key={i} className="mb-4 list-disc space-y-1 pl-6 text-gray-300">
          {listItems.map((item, j) => (
            <li key={j}>{renderInline(item.trim().slice(2))}</li>
          ))}
        </ul>
      )
    }

    if (numberedItems.length > 0 && numberedItems.length === lines.length) {
      return (
        <ol key={i} className="mb-4 list-decimal space-y-1 pl-6 text-gray-300">
          {numberedItems.map((item, j) => (
            <li key={j}>{renderInline(item.trim().replace(/^\d+\.\s/, ''))}</li>
          ))}
        </ol>
      )
    }

    return (
      <p key={i} className="mb-4 leading-relaxed text-gray-300">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>
    )
  })
}

function renderTable(tableStr: string, key: number) {
  const rows = tableStr.split('\n').filter((r) => r.trim())
  if (rows.length < 2) return null
  const headers = rows[0].split('|').filter((c) => c.trim()).map((c) => c.trim())
  const dataRows = rows.slice(2).map((r) =>
    r.split('|').filter((c) => c.trim()).map((c) => c.trim())
  )

  return (
    <div key={key} className="mb-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 text-left font-semibold text-white">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, i) => (
            <tr key={i} className="border-b border-white/5">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-gray-300">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderInline(text: string) {
  const parts: (string | JSX.Element)[] = []
  let remaining = text
  let key = 0

  while (remaining) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`(.+?)`/)

    let firstMatch: { index: number; length: number; render: () => JSX.Element } | null = null

    if (boldMatch && boldMatch.index !== undefined) {
      const candidate = { index: boldMatch.index, length: boldMatch[0].length, render: () => <strong key={key++} className="font-semibold text-white">{boldMatch[1]}</strong> }
      if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate
    }

    if (codeMatch && codeMatch.index !== undefined) {
      const candidate = { index: codeMatch.index, length: codeMatch[0].length, render: () => <code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-[#00d4ff]">{codeMatch[1]}</code> }
      if (!firstMatch || candidate.index < firstMatch.index) firstMatch = candidate
    }

    if (!firstMatch) {
      parts.push(remaining)
      break
    }

    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }
    parts.push(firstMatch.render())
    remaining = remaining.slice(firstMatch.index + firstMatch.length)
  }

  return parts
}

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

          <div>{renderContent(article.content)}</div>

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
