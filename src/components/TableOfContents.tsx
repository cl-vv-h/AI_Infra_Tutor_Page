import { useMemo } from 'react'

interface TableOfContentsProps {
  content: string
}

interface TocItem {
  id: string
  text: string
  level: number
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const items = useMemo<TocItem[]>(() => {
    const headings: TocItem[] = []
    const lines = content.split('\n')
    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/)
      const h3Match = line.match(/^### (.+)$/)
      if (h2Match) {
        const text = h2Match[1]
        headings.push({ id: text.replace(/\s+/g, '-'), text, level: 2 })
      } else if (h3Match) {
        const text = h3Match[1]
        headings.push({ id: text.replace(/\s+/g, '-'), text, level: 3 })
      }
    }
    return headings
  }, [content])

  if (items.length === 0) return null

  const handleClick = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="w-56 shrink-0">
      <div className="sticky top-8 rounded-xl border border-white/5 bg-[#1a1f35] p-4">
        <h4 className="mb-3 text-sm font-semibold text-white">目录</h4>
        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={`block w-full text-left text-sm transition-colors hover:text-[#00d4ff] ${
                item.level === 2 ? 'text-gray-300' : 'pl-3 text-gray-500'
              }`}
            >
              {item.text}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}
