import { NavLink } from 'react-router-dom'
export default function PerformanceNav(){
  return <nav aria-label="性能工具" className="section-navigation">{[['/operators','Profiling 分析'],['/operators/estimate','单算子理论校核']].map(([to,label])=><NavLink key={to} to={to} end>{label}</NavLink>)}</nav>
}
