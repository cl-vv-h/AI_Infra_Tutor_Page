import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  GitBranch,
  Puzzle,
  FastForward,
  Terminal,
  Shuffle,
  Zap,
  Minimize2,
  Code2,
  Network,
  Globe,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { getCategoryBySlug } from '@/data/categories'
import { getArticlesByCategory, getArticlesBySubCategory } from '@/data/articles'
import Sidebar from '@/components/Sidebar'
import ArticleCard from '@/components/ArticleCard'

const iconMap: Record<string, LucideIcon> = {
  GitBranch,
  Puzzle,
  FastForward,
  Terminal,
  Shuffle,
  Zap,
  Minimize2,
  Code2,
  Network,
}

const topicNumbers: Record<string, string> = {
  'sub-8-1': '专题一',
  'sub-8-2': '专题二',
  'sub-8-3': '专题三',
}

function SglangOverview({
  category,
  onSubClick,
}: {
  category: NonNullable<ReturnType<typeof getCategoryBySlug>>
  onSubClick: (subSlug: string) => void
}) {
  const knowledgeGraphSub = category.subcategories.find((s) => s.slug === 'knowledge-graph')
  const topicSubs = category.subcategories.filter((s) => s.slug !== 'knowledge-graph')

  return (
    <div className="space-y-8">
      {knowledgeGraphSub && (
        <div className="rounded-xl border border-white/10 bg-[#1a1f35] p-6">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="h-5 w-5 text-[#8b5cf6]" />
            <h3 className="text-lg font-semibold text-white">{knowledgeGraphSub.name}</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">{knowledgeGraphSub.description}</p>
          <button
            onClick={() => onSubClick(knowledgeGraphSub.slug)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
          >
            查看知识图谱
            <span className="text-xs">→</span>
          </button>
        </div>
      )}

      {topicSubs.map((sub) => {
        const articles = getArticlesBySubCategory(sub.id)
        const topicLabel = topicNumbers[sub.id] || ''
        return (
          <div
            key={sub.id}
            className="rounded-xl border border-white/10 bg-[#1a1f35] p-6"
          >
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6]/20 text-xs font-bold text-[#8b5cf6]">
                {topicLabel.replace('专题', '')}
              </div>
              <h3 className="text-lg font-semibold text-white">
                {topicLabel}：{sub.name}
              </h3>
              <span className="ml-auto rounded-full bg-[#8b5cf6]/10 px-2.5 py-0.5 text-xs text-[#8b5cf6]">
                {articles.length} 篇
              </span>
            </div>
            <p className="mb-5 text-sm text-gray-400">{sub.description}</p>

            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />
              {articles.map((article, index) => (
                <Link
                  key={article.id}
                  to={`/article/${article.slug}`}
                  className="group relative mb-4 flex items-start gap-4 last:mb-0"
                >
                  <div className="absolute -left-5 flex h-6 w-6 items-center justify-center rounded-full bg-[#8b5cf6] text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="flex-1 rounded-lg border border-white/5 bg-[#141830] p-4 transition-all group-hover:border-[#8b5cf6]/30 group-hover:bg-[#1e2440]">
                    <h4 className="font-semibold text-white transition-colors group-hover:text-[#8b5cf6]">
                      {article.title}
                    </h4>
                    <p className="mt-1 text-sm text-gray-400">{article.summary}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SglangSubcategoryView({
  sub,
  articles,
}: {
  sub: NonNullable<ReturnType<typeof getCategoryBySlug>>['subcategories'][0]
  articles: ReturnType<typeof getArticlesBySubCategory>
}) {
  const topicLabel = topicNumbers[sub.id] || ''

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {topicLabel && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6]/20 text-xs font-bold text-[#8b5cf6]">
            {topicLabel.replace('专题', '')}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-white">
            {topicLabel ? `${topicLabel}：` : ''}{sub.name}
          </h2>
          <p className="mt-1 text-sm text-gray-400">{sub.description}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#8b5cf6]/10 px-2.5 py-0.5 text-xs text-[#8b5cf6]">
          {articles.length} 篇
        </span>
      </div>

      <div className="relative pl-8">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />
        {articles.map((article, index) => (
          <Link
            key={article.id}
            to={`/article/${article.slug}`}
            className="group relative mb-4 flex items-start gap-4 last:mb-0"
          >
            <div className="absolute -left-5 flex h-6 w-6 items-center justify-center rounded-full bg-[#8b5cf6] text-xs font-bold text-white">
              {index + 1}
            </div>
            <div className="flex-1 rounded-lg border border-white/5 bg-[#1a1f35] p-4 transition-all group-hover:border-[#8b5cf6]/30 group-hover:bg-[#1e2440]">
              <h4 className="font-semibold text-white transition-colors group-hover:text-[#8b5cf6]">
                {article.title}
              </h4>
              <p className="mt-1 text-sm text-gray-400">{article.summary}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {article.readTime}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const category = getCategoryBySlug(slug ?? '')
  const activeSubSlug = searchParams.get('sub') ?? undefined

  if (!category) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-white">404</h1>
          <p className="mb-6 text-gray-400">未找到该分类</p>
          <Link to="/" className="text-[#00d4ff] hover:underline">返回首页</Link>
        </div>
      </div>
    )
  }

  const allArticles = getArticlesByCategory(category.id)
  const activeSub = category.subcategories.find((s) => s.slug === activeSubSlug)
  const filteredArticles = activeSub
    ? getArticlesBySubCategory(activeSub.id)
    : allArticles

  const IconComponent = iconMap[category.icon] || Zap
  const isSglang = category.slug === 'sglang'

  const handleSubClick = (subSlug: string) => {
    if (subSlug === 'knowledge-graph') {
      navigate('/knowledge-graph')
      return
    }
    if (activeSubSlug === subSlug) {
      setSearchParams({})
    } else {
      setSearchParams({ sub: subSlug })
    }
  }

  return (
    <div className="flex">
      <Sidebar
        categoryName={category.name}
        subcategories={category.subcategories}
        activeSubSlug={activeSubSlug}
        onSubClick={handleSubClick}
        categorySlug={category.slug}
      />

      <div className="ml-64 min-h-screen flex-1 p-8">
        <Link to="/" className="mb-6 inline-block text-sm text-gray-500 hover:text-[#00d4ff] transition-colors">
          ← 返回首页
        </Link>

        <div className="mb-10 flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${category.color}15` }}
          >
            <IconComponent className="h-7 w-7" style={{ color: category.color }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{category.name}</h1>
            <p className="mt-1 text-gray-400">{category.description}</p>
          </div>
        </div>

        {isSglang && !activeSubSlug && (
          <SglangOverview
            category={category}
            onSubClick={handleSubClick}
          />
        )}

        {isSglang && activeSubSlug && activeSub && (
          <SglangSubcategoryView sub={activeSub} articles={filteredArticles} />
        )}

        {!isSglang && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                slug={article.slug}
                summary={article.summary}
                tags={article.tags}
                readTime={article.readTime}
                date={article.date}
              />
            ))}
          </div>
        )}

        {!isSglang && filteredArticles.length === 0 && (
          <div className="flex items-center justify-center rounded-xl border border-white/5 bg-[#1a1f35] py-20">
            <p className="text-gray-500">暂无内容，敬请期待</p>
          </div>
        )}
      </div>
    </div>
  )
}
