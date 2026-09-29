import type { simulateMoe } from '@/lib/moe-routing'
import { useId } from 'react'

type Token = ReturnType<typeof simulateMoe>['tokens'][number]
const colors = ['#a9a3ff','#8bd5b2','#e9c17b','#8bc7ed','#f29da5','#b8c789','#d2abe8','#abc4cb']
export default function MoeTokenFlow({token,position,reduced}:{token:Token;position:number;reduced:boolean}) {
  const arrow=useId()
  const cubic=(a:number,b:number,c:number,d:number,t:number)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
  const height = Math.max(270,token.assignments.length*72+70), center=height/2
  const dispatchProgress=Math.min(1,Math.max(0,position-1)),combineProgress=Math.min(1,Math.max(0,position-3))
  return <div role="region" aria-label="所选 Token 的路由图，可横向滚动" tabIndex={0} className="overflow-x-auto rounded-xl border border-line bg-field">
    <svg viewBox={`0 0 760 ${height}`} style={{minWidth:700,width:'100%'}} role="img" aria-label={`Token ${token.token}，来自 rank ${token.source}，${token.assignments.length} 个专家分支；当前阶段 ${Math.min(4,Math.floor(position))}`}>
      <defs><marker id={arrow} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#b5b7c2"/></marker></defs>
      <text x="24" y="28" fill="#b5b7c2" fontSize="13">源 Token</text><text x="320" y="28" fill="#b5b7c2" fontSize="13">专家计算（二维玩具函数）</text><text x="606" y="28" fill="#b5b7c2" fontSize="13">恢复源顺序</text>
      <rect x="24" y={center-37} width="135" height="74" rx="10" fill="#1a1b20" stroke="#464953"/>
      <text x="38" y={center-9} fill="#f4f4f5" fontSize="16">T{token.token} · R{token.source}</text><text x="38" y={center+17} fill="#b5b7c2" fontSize="12">x=[{((token.token+1)/10).toFixed(1)}, 1]</text>
      <rect x="604" y={center-37} width="140" height="74" rx="10" fill="#1a1b20" stroke={position>=4?'#8bd5b2':'#464953'}/>
      <text x="618" y={center-9} fill="#f4f4f5" fontSize="16">Σ w · f(x)</text><text x="618" y={center+17} fill="#b5b7c2" fontSize="12">{position>=4?token.output.map(n=>n.toFixed(3)).join(', '):'等待归并'}</text>
      {token.assignments.map((a,i)=>{
        const y=height/2+(i-(token.assignments.length-1)/2)*72,color=colors[a.expert%colors.length]
        return <g key={a.expert}>
          <path d={`M159 ${center} C230 ${center} 250 ${y} 315 ${y}`} markerEnd={`url(#${arrow})`} stroke={a.accepted?color:'#f29da5'} strokeWidth="1.5" strokeDasharray={a.accepted?undefined:'4 5'} fill="none"/>
          {a.accepted&&<path d={`M485 ${y} C535 ${y} 550 ${center} 604 ${center}`} markerEnd={`url(#${arrow})`} stroke={color} strokeWidth="1.5" opacity={position>=3?1:.5} fill="none"/>}
          <rect x="315" y={y-27} width="170" height="54" rx="8" fill={position>=2&&position<3&&a.accepted?'#2a2c33':'#121316'} stroke={color}/>
          <text x="327" y={y-5} fill="#f4f4f5" fontSize="14">E{a.expert} · R{a.rank} {a.accepted?'':'× 丢弃'}</text>
          <text x="327" y={y+15} fill="#b5b7c2" fontSize="12">w={a.weight.toFixed(3)} · {a.source===a.rank?'本地':'跨 rank'}</text>
          {a.accepted&&!reduced&&position>=1&&position<2&&<circle cx={cubic(159,230,250,315,dispatchProgress)} cy={cubic(center,center,y,y,dispatchProgress)} r="5" fill={color}/>}
          {a.accepted&&!reduced&&position>=3&&position<4&&<circle cx={cubic(485,535,550,604,combineProgress)} cy={cubic(y,y,center,center,combineProgress)} r="5" fill={color}/>}
        </g>
      })}
    </svg>
  </div>
}
