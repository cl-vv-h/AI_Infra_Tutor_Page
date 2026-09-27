import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ProfilingWorkbench from './ProfilingWorkbench'
const OperatorEstimator=lazy(()=>import('./OperatorEstimator'))
const ProfilingGuide=lazy(()=>import('./ProfilingGuide'))

class GuideBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(!this.state.failed)return this.props.children
    return <section role="alert" className="page-container py-12 text-secondary">
      <h1 className="text-2xl text-ink">教程暂时无法加载</h1>
      <p className="my-4">可以先返回工作台，已导入的分析仍保留在内存中。刷新会清空这些本地数据。</p>
      <div className="flex flex-wrap gap-3"><Link to="/operators" className="button-secondary">返回 Profiling 工作台</Link><button className="button-secondary" onClick={()=>window.location.reload()}>刷新并重新加载教程</button></div>
    </section>
  }
}

export default function PerformanceWorkspace(){
  const {pathname}=useLocation()
  const estimate=pathname==='/operators/estimate',guide=pathname==='/operators/guide'
  // Reading the guide or checking an estimate must not discard the local workers.
  return <><div hidden={estimate||guide}><ProfilingWorkbench/></div>
    {estimate&&<Suspense fallback={<p role="status" className="p-8 text-muted">正在打开理论校核…</p>}><OperatorEstimator/></Suspense>}
    {guide&&<GuideBoundary><Suspense fallback={<p role="status" className="p-8 text-muted">正在加载 Profiling 阅读教程…</p>}><ProfilingGuide/></Suspense></GuideBoundary>}
  </>
}
