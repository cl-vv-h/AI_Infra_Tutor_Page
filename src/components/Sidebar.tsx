interface SubCategory {
  id: string
  name: string
  slug: string
  description: string
}

interface SidebarProps {
  categoryName: string
  subcategories: SubCategory[]
  activeSubSlug?: string
  onSubClick?: (subSlug: string) => void
}

export default function Sidebar({
  categoryName,
  subcategories,
  activeSubSlug,
  onSubClick,
}: SidebarProps) {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-white/10 bg-[#0a0f1e] p-4">
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
              <span className="block">{sub.name}</span>
              {isActive && sub.description && (
                <span className="mt-1 block text-xs text-gray-500">
                  {sub.description}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
