import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Github, Languages } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

const navLinks = [
  { label: '首页', to: '/' },
  { label: 'AI Infra', to: '/learn' },
  { label: '新闻雷达', to: '/news' },
  { label: '关于', to: '/about' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { language, toggleLanguage } = useLanguage()

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-white/[0.08] bg-[#070b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-3 text-sm font-semibold tracking-tight text-white">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/15 bg-white/[0.06] font-mono text-xs text-cyan-200">AI</span>
          INFRA//SPACE
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const active = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to)
            return (
            <Link
              key={link.to}
              to={link.to}
              className={`text-xs tracking-wide transition-colors ${active ? 'text-white' : 'text-white/45 hover:text-white'}`}
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
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 font-mono text-[0.62rem] tracking-wider text-white/45 transition hover:border-white/20 hover:text-white"
          >
            <Languages className="h-3.5 w-3.5" /> {language === 'zh' ? 'EN' : '中文'}
          </button>
          <a
            href="https://github.com/cl-vv-h/AI_Infra_Tutor_Page"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            className="text-white/45 transition-colors hover:text-white"
          >
            <Github className="h-5 w-5" />
          </a>

          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? '关闭菜单' : '打开菜单'}
            className="text-white/70 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-b border-white/10 bg-[#070b10]/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-2 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
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
