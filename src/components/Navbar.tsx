import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Github, Languages } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

const navLinks = [
  { label: '首页', to: '/' },
  { label: 'AI Infra', to: '/learn' },
  { label: '模型实验室', to: '/models/knowledge' },
  { label: '性能分析', to: '/operators' },
  { label: '新闻雷达', to: '/news' },
  { label: '关于', to: '/about' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { language, toggleLanguage } = useLanguage()
  const toggle=useRef<HTMLButtonElement>(null)
  useEffect(()=>{setOpen(false)},[location.pathname])
  useEffect(()=>{
    if(!open)return
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus()}}
    document.addEventListener('keydown',escape)
    return ()=>document.removeEventListener('keydown',escape)
  },[open])

  return (
    <nav aria-label="主导航" className="site-nav fixed left-0 right-0 top-0 z-50 h-16 border-b border-line bg-canvas/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-3 text-sm font-semibold tracking-tight text-white">
          <span className="brand-mark" aria-hidden="true"><span/><span/><span/></span>
          INFRA//SPACE
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => {
            const active = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to === '/models/knowledge' ? '/models' : link.to)
            return (
            <Link
              key={link.to}
              to={link.to}
              aria-current={active?'page':undefined}
              className={`nav-item ${active ? 'is-active' : ''}`}
            >
              {link.label}
            </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === 'zh' ? 'Switch to English' : '切换到中文'}
            className="utility-button flex items-center gap-1.5 text-xs"
          >
            <Languages className="h-3.5 w-3.5" /> {language === 'zh' ? 'EN' : '中文'}
          </button>
          <a
            href="https://github.com/cl-vv-h/AI_Infra_Tutor_Page"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            className="utility-button text-muted transition-colors hover:text-white"
          >
            <Github className="h-5 w-5" />
          </a>

          <button
            ref={toggle}
            onClick={() => setOpen(!open)}
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className="utility-button text-secondary lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-navigation" className="border-b border-line bg-surface shadow-xl lg:hidden">
          <div className="flex flex-col gap-2 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                aria-current={(link.to==='/'?location.pathname==='/':location.pathname.startsWith(link.to==='/models/knowledge'?'/models':link.to))?'page':undefined}
                className="nav-item rounded-lg px-3 py-3 text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
