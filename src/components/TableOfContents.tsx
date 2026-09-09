import { useEffect, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'

interface TableOfContentsProps {
  content: string
  contentRoot: RefObject<HTMLDivElement>
}

interface TocItem {
  id: string
  text: string
  level: number
}

export default function TableOfContents({ content, contentRoot }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState('')
  const { language } = useLanguage()
  const { hash } = useLocation()

  useEffect(() => {
    // The rendered headings are the source of truth. This matches rehype-slug
    // for inline code, punctuation and duplicate titles, and excludes code fences.
    const headings = [...(contentRoot.current?.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id], h4[id]') ?? [])]
    setItems(headings.map((heading) => ({
      id: heading.id,
      text: heading.textContent ?? '',
      level: Number(heading.tagName.slice(1)),
    })))
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveId(entry.target.id)
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 })
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [content, contentRoot])

  useEffect(() => {
    if (!hash) return
    let id = hash.slice(1)
    try { id = decodeURIComponent(id) } catch { /* Keep the original fragment. */ }
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [hash, content])

  if (!items.length) return null

  return (
    <aside className="order-first min-w-0 lg:order-none lg:col-start-2 lg:row-start-1">
      <details open className="rounded-2xl border border-white/10 bg-[#101923] p-4 lg:sticky lg:top-24">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          {language === 'zh' ? '本篇目录' : 'On this page'} <span className="ml-2 font-mono text-xs font-normal text-slate-400">{items.length}</span>
        </summary>
        <nav aria-label={language === 'zh' ? '本篇目录' : 'On this page'} className="mt-4 max-h-56 space-y-1 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeId === item.id ? 'location' : undefined}
              onClick={() => {
                const heading = document.getElementById(item.id)
                if (!heading) return
                heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                heading.tabIndex = -1
                heading.focus({ preventScroll: true })
                setActiveId(item.id)
              }}
              className={`block w-full rounded px-2 py-1.5 text-left text-sm leading-6 transition-colors hover:bg-white/5 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 ${activeId === item.id ? 'bg-cyan-200/5 text-cyan-200' : 'text-slate-400'} ${item.level === 3 ? 'pl-4' : item.level === 4 ? 'pl-6' : ''}`}
            >
              {item.text}
            </button>
          ))}
        </nav>
      </details>
    </aside>
  )
}
