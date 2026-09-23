import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import ProfilingWorkbench from './ProfilingWorkbench'
const OperatorEstimator=lazy(()=>import('./OperatorEstimator'))
export default function PerformanceWorkspace(){
  const estimate=useLocation().pathname==='/operators/estimate'
  // Keep the two local workers alive while drilling down; leaving the module destroys them.
  return <><div hidden={estimate}><ProfilingWorkbench/></div>{estimate&&<Suspense fallback={<p className="p-8 text-slate-400">正在打开理论校核…</p>}><OperatorEstimator/></Suspense>}</>
}
