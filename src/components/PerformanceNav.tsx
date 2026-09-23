import { NavLink } from 'react-router-dom'
export default function PerformanceNav(){
  return <nav aria-label="性能工具" className="mb-6 flex flex-wrap gap-2 text-sm">{[['/operators','Profiling 分析'],['/operators/estimate','单算子理论校核']].map(([to,label])=><NavLink key={to} to={to} end className={({isActive})=>`rounded-full border px-4 py-2 ${isActive?'border-cyan-200/30 bg-cyan-200/10 text-cyan-100':'border-white/10 text-slate-400 hover:text-white'}`}>{label}</NavLink>)}</nav>
}
