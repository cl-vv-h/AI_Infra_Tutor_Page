import { Link, useLocation } from 'react-router-dom'

export default function ModelSectionNav({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation()
  const current = pathname.startsWith('/models/knowledge') ? 'knowledge' : pathname === '/models/compare' ? 'compare' : 'models'
  return <nav aria-label="模型知识导航" className={compact ? 'mb-3 flex flex-wrap gap-1' : 'mb-6 flex flex-wrap gap-1 border-b border-white/10 pb-3'}>{[
    ['knowledge', '/models/knowledge', '知识体系'], ['models', '/models', '模型目录'], ['compare', '/models/compare', '对比实验'],
  ].map(([id, to, label]) => <Link key={id} to={to} aria-current={current === id ? 'page' : undefined} className={`${compact ? 'px-3 py-2 text-xs' : 'min-h-11 px-4 py-3 text-sm'} rounded-lg transition-colors ${current === id ? 'bg-white/[0.08] text-cyan-100' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>{label}</Link>)}</nav>
}
