import { Link } from 'react-router-dom'

const categoryLinks = [
  { label: 'AI Infra 教学', to: '/learn' },
  { label: 'SGLang 源码', to: '/category/sglang' },
  { label: '全球新闻雷达', to: '/news' },
]

const resourceLinks = [
  { label: 'GitHub', href: 'https://github.com/cl-vv-h/AI_Infra_Tutor_Page' },
  { label: '贡献指南', to: '/about' },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#070b10]">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 font-mono text-xs tracking-widest text-white">AI INFRA//SPACE</h3>
            <p className="text-sm leading-relaxed text-gray-400">
              面向 AI 基础设施学习者的开放知识空间：系统课程、源码阅读与可追溯的全球技术信号。
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">探索</h3>
            <ul className="space-y-2">
              {categoryLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">资源</h3>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link
                      to={link.to}
                      className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-gray-500">© 2026 AI Infra Space · Built as an open knowledge system</p>
        </div>
      </div>
    </footer>
  )
}
