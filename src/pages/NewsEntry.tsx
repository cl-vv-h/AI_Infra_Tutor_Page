import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import gate from '../../config/news-sphere.json'
import { Component } from 'react'
import type { ReactNode } from 'react'

const Radar = lazy(() => import('./NewsRadar'))
const Reader = lazy(() => import('./News'))
class RadarBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <section className="page-container py-16" role="alert"><h1 className="text-2xl text-ink">新闻雷达暂时无法加载</h1><p className="my-4 text-secondary">筛选仍保留在 URL；本机关注与收藏未改动。</p><button className="min-h-11 text-accent" onClick={() => location.reload()}>重新加载雷达</button><Link className="ml-6 text-accent" to="/news?view=daily">打开传统阅读页 →</Link></section> : this.props.children }
}
export default function NewsEntry() {
  const [params] = useSearchParams()
  const radar = gate.enabled && (params.size === 0 || params.get('mode') === 'radar')
  return <Suspense fallback={<div className="page-container py-16" role="status">正在加载新闻…</div>}>{radar ? <RadarBoundary><Radar/></RadarBoundary> : <Reader/>}</Suspense>
}
