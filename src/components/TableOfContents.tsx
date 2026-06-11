import { useMemo, useEffect, useState, useCallback } from 'react'

interface TableOfContentsProps {
  content: string
}

interface TocItem {
  id: string
  text: string
  level: number
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u4e00-\u9fff-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')

  const items = useMemo<TocItem[]>(() => {
    const headings: TocItem[] = []
    const usedIds = new Map<string, number>()
    const lines = content.split('\n')
    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/)
      const h3Match = line.match(/^### (.+)$/)
      const h4Match = line.match(/^#### (.+)$/)
      let text = ''
      let level = 0
      if (h2Match) {
        text = h2Match[1]
        level = 2
      } else if (h3Match) {
        text = h3Match[1]
        level = 3
      } else if (h4Match) {
        text = h4Match[1]
        level = 4
      }
      if (level > 0) {
        let id = generateSlug(text)
        const count = usedIds.get(id) ?? 0
        usedIds.set(id, count + 1)
        if (count > 0) {
          id = `${id}-${count}`
        }
        headings.push({ id, text, level })
      }
    }
    return headings
  }, [content])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    )

    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [items])

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (items.length === 0) return null

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
                activeId === item.id ? 'text-[#00d4ff]' : 'text-gray-300'
              } ${
                item.level === 3 ? 'pl-3 text-gray-500' : ''
              } ${
                item.level === 4 ? 'pl-6 text-gray-500' : ''
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
