import { Link, useLocation } from 'react-router-dom'
import moeRouting from '../../config/moe-routing.json'
import tokenJourney from '../../config/token-journey.json'
import communicationTopology from '../../config/communication-topology.json'

export default function ModelSectionNav({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation()
  const current = pathname.startsWith('/models/knowledge') ? 'knowledge' : pathname === '/models/compare' ? 'compare' : pathname === '/models/moe-routing' ? 'moe' : pathname === '/models/token-journey' ? 'token' : pathname === '/models/communication' ? 'communication' : 'models'
  return <nav aria-label="模型知识导航" className={`section-navigation ${compact ? 'mb-3 pb-2' : ''}`}>{[
    ['knowledge', '/models/knowledge', '知识体系'], ['models', '/models', '模型目录'], ['compare', '/models/compare', '对比实验'],
    ...(moeRouting.enabled ? [['moe', '/models/moe-routing', 'MoE 路由沙盘']] : []),
    ...(tokenJourney.enabled ? [['token', '/models/token-journey', 'Token 旅程']] : []),
    ...(communicationTopology.enabled ? [['communication', '/models/communication', '通信拓扑']] : []),
  ].map(([id, to, label]) => <Link key={id} to={to} aria-current={current === id ? 'page' : undefined}>{label}</Link>)}</nav>
}
