import { NavLink } from 'react-router-dom'
import features from '../../config/learning-features.json'
export default function PerformanceNav(){
  return <nav aria-label="性能工具" className="section-navigation">{[['/operators','Profiling 分析'],...(features.multiRankProfiling?[['/operators/ranks','多 rank 联合分析']]:[]),['/operators/estimate','单算子理论校核']].map(([to,label])=><NavLink key={to} to={to} end>{label}</NavLink>)}</nav>
}
