import { Globe, BookOpen } from 'lucide-react'
import { getArticlesBySubCategory } from '@/data/articles'

interface SubCategory {
  id: string
  name: string
  nameEn?: string
  slug: string
  description: string
  descriptionEn?: string
}

interface SidebarProps {
  categoryName: string
  subcategories: SubCategory[]
  activeSubSlug?: string
  onSubClick?: (subSlug: string) => void
  categorySlug?: string
  language?: 'zh' | 'en'
}

export default function Sidebar({
  categoryName,
  subcategories,
  activeSubSlug,
  onSubClick,
  categorySlug,
  language = 'zh',
}: SidebarProps) {
  const isSglang = categorySlug === 'sglang'

  if (isSglang) {
    const knowledgeGraphSub = subcategories.find((s) => s.slug === 'knowledge-graph')
    const topicSubs = subcategories.filter((s) => s.slug !== 'knowledge-graph')

    return (
      <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-white/10 bg-[#0a0f1e] p-4 lg:block">
        <h2 className="mb-4 px-3 text-sm font-semibold text-[#8b5cf6]">
          {categoryName}
        </h2>

        <nav className="space-y-1">
          {knowledgeGraphSub && (
            <button
              onClick={() => onSubClick?.(knowledgeGraphSub.slug)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors text-gray-400 hover:bg-white/5 hover:text-gray-200"
            >
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#8b5cf6]" />
                {knowledgeGraphSub.name}
              </span>
            </button>
          )}

          <div className="my-3 border-t border-white/5" />

          <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-gray-600">
            {language === 'zh' ? '专题学习' : 'Learning tracks'}
          </div>

          {topicSubs.map((sub) => {
            const isActive = sub.slug === activeSubSlug
            const articleCount = getArticlesBySubCategory(sub.id).length
            return (
              <button
                key={sub.id}
                onClick={() => onSubClick?.(sub.slug)}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-[#8b5cf6]/10 font-medium text-[#8b5cf6]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>{language === 'zh' ? sub.name : sub.nameEn}</span>
                  </span>
                  <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-500">
                    {articleCount}
                  </span>
                </span>
                {isActive && sub.description && (
                  <span className="mt-1 block text-xs text-gray-500 pl-6">
                    {language === 'zh' ? sub.description : sub.descriptionEn}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>
    )
  }

  return (
    <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-white/10 bg-[#0a0f1e] p-4 lg:block">
      <h2 className="mb-4 px-3 text-sm font-semibold text-[#00d4ff]">
        {categoryName}
      </h2>

      <nav className="space-y-1">
        {subcategories.map((sub) => {
          const isActive = sub.slug === activeSubSlug
          return (
            <button
              key={sub.id}
              onClick={() => onSubClick?.(sub.slug)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-[#00d4ff]/10 font-medium text-[#00d4ff]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <span className="block">{language === 'zh' ? sub.name : sub.nameEn}</span>
              {isActive && sub.description && (
                <span className="mt-1 block text-xs text-gray-500">
                  {language === 'zh' ? sub.description : sub.descriptionEn}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
