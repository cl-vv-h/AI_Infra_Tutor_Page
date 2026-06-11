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

        {filteredArticles.length > 0 ? (
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
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-white/5 bg-[#1a1f35] py-20">
            <p className="text-gray-500">暂无内容，敬请期待</p>
          </div>
        )}
      </div>
    </div>
  )
}
