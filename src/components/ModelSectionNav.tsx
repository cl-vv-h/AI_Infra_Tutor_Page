import { Link, useLocation } from 'react-router-dom'
import { siteFeatures } from '@/lib/site-release'

export default function ModelSectionNav({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation()
  const current = pathname.startsWith('/models/knowledge') ? 'knowledge' : pathname === '/models/compare' ? 'compare' : pathname === '/models/scenarios' ? 'scenarios' : 'models'
  return <nav aria-label="模型知识导航" className={`section-navigation ${compact ? 'mb-3 pb-2' : ''}`}>{[
    ['knowledge', '/models/knowledge', '知识体系'], ['models', '/models', '模型目录'], ['compare', '/models/compare', '对比实验'],
    ...(siteFeatures.scenarioLibrary ? [['scenarios', '/models/scenarios', '部署方案']] : []),
  ].map(([id, to, label]) => <Link key={id} to={to} aria-current={current === id ? 'page' : undefined}>{label}</Link>)}</nav>
}
