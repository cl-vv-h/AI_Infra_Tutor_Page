import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Search, X } from 'lucide-react'
import { attentionFamilies, attentionTechnologies, attentionRelations, attentionById, attentionOverview, attentionRelationLabels, attentionMatches, readAttentionQuery, ATTENTION_REVIEWED_AT, type AttentionTechnology } from '@/data/attention-atlas'
import './attention-atlas.css'

type Placed = {node:AttentionTechnology; x:number; y:number}
const corePositions:Record<string,[number,number]> = {mha:[0,0],mqa:[1,0],gqa:[2,0],mla:[1,1],dsa:[2,1],nsa:[3,1],linear:[0,2],delta:[1,2],gdn:[2,2],kda:[3,2],flash:[1,3],paged:[2,3]}
const colorOf = (node:AttentionTechnology) => attentionFamilies.find(f=>f.id===node.family)!.color
const linkFor = (node:AttentionTechnology) => node.lesson ? `/article/${node.lesson}` : null
function previewPosition(target:HTMLButtonElement) {
  const rect=target.getBoundingClientRect(),width=Math.min(330,window.innerWidth-24)
  return {left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.bottom+8+270<window.innerHeight?rect.bottom+8:Math.max(76,rect.top-270)}
}
function ReadingLink({node}:{node:AttentionTechnology}) {
  const lesson=linkFor(node)
  return lesson ? <Link className="button-primary" to={lesson}>阅读站内教程 <ArrowUpRight size={14}/></Link> : <a className="button-primary" href={node.paper} target="_blank" rel="noreferrer">阅读原始论文 <ArrowUpRight size={14}/></a>
}

export default function AttentionAtlas() {
  const [params,setParams]=useSearchParams()
  const state=readAttentionQuery(params)
  const selected=attentionById.get(state.node)!
  const [preview,setPreview]=useState<{node:AttentionTechnology;left:number;top:number}|null>(null)
  const timer=useRef<ReturnType<typeof setTimeout>>()
  const lastTrigger=useRef<HTMLButtonElement|null>(null)
  const previewRef=useRef<HTMLDivElement>(null)
  const [search,setSearch]=useState(state.q)
  useEffect(()=>{setSearch(state.q)},[state.q])
  useEffect(()=>{setPreview(null)},[state.q,state.view,state.node])
  useEffect(()=>()=>clearTimeout(timer.current),[])
  const closePreview=()=>{clearTimeout(timer.current);setPreview(null)}
  useEffect(()=>{
    const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape'){clearTimeout(timer.current);setPreview(null)}}
    const scroll=()=>{clearTimeout(timer.current);const target=lastTrigger.current;setPreview(value=>value&&target===document.activeElement&&target?{...value,...previewPosition(target)}:null)}
    window.addEventListener('keydown',dismiss);window.addEventListener('resize',scroll);window.addEventListener('scroll',scroll,true)
    return()=>{window.removeEventListener('keydown',dismiss);window.removeEventListener('resize',scroll);window.removeEventListener('scroll',scroll,true)}
  },[])
  const change=(patch:Record<string,string>)=>{
    closePreview()
    const next=new URLSearchParams({view:state.view,node:state.node,...(state.q?{q:state.q}:{}),...patch})
    if(!next.get('q'))next.delete('q')
    setParams(next)
  }
  const choose=(id:string)=>change({node:id})
  const peek=(node:AttentionTechnology,target:HTMLButtonElement)=>{
    clearTimeout(timer.current);lastTrigger.current=target
    setPreview({node,...previewPosition(target)})
  }
  const leave=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{if(!previewRef.current?.contains(document.activeElement))setPreview(null)},180)}
  const visible=attentionTechnologies.filter(n=>(state.view==='all'||state.view==='overview'&&attentionOverview.includes(n.id)||n.family===state.view)&&attentionMatches(n,state.q))
  const positions:Placed[]=[],labels:{name:string;y:number;color:string}[]=[]
  let height=520
  if(state.view==='overview'&&!state.q){
    visible.forEach(node=>{const [col,row]=corePositions[node.id];positions.push({node,x:32+col*238,y:38+row*118})})
  }else{
    let y=46
    for(const family of attentionFamilies){
      const nodes=visible.filter(n=>n.family===family.id)
      if(!nodes.length)continue
      labels.push({name:family.name,y:y-30,color:family.color})
      nodes.forEach((node,index)=>positions.push({node,x:32+(index%4)*238,y:y+Math.floor(index/4)*112}))
      y+=Math.ceil(nodes.length/4)*112+40
    }
    height=Math.max(240,y)
  }
  const placed=new Map(positions.map(p=>[p.node.id,p]))
  const active=preview?.node.id??selected.id
  // The overview keeps only the pedagogical backbone. Other views reveal
  // cross-family evidence on selection instead of drawing an unreadable mesh.
  const edges=attentionRelations.filter(e=>placed.has(e.from)&&placed.has(e.to)&&(state.view==='overview'?['mha-mqa','mqa-gqa','mha-mla','mla-dsa','linear-delta','delta-gdn','gdn-kda'].includes(`${e.from}-${e.to}`):attentionById.get(e.from)!.family===attentionById.get(e.to)!.family||e.from===active||e.to===active))
  const relations=attentionRelations.filter(e=>e.from===selected.id||e.to===selected.id)
  return <div className="attention-atlas page-container pb-20 pt-8">
    <Link to="/learn" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-ink"><ArrowLeft size={15}/> AI Infra 教学</Link>
    <header className="atlas-header"><div><p className="eyebrow">ATTENTION ATLAS · 2014—2026</p><h1>Attention 演进图谱</h1><p className="text-secondary">从相关性计算，到压缩、稀疏与递归记忆。沿着关系认识技术，不把它们排成一条升级链。</p></div><div className="atlas-count"><strong>{attentionTechnologies.length}</strong><span>代表技术 · {attentionFamilies.length} 条路线</span></div></header>
    {state.invalid&&<div role="alert" className="surface-card mb-4 p-4 text-sm">链接含未知或重复参数，当前展示默认总览。<button className="ml-3 text-accent underline" onClick={()=>setParams({})}>重置链接</button></div>}
    <div className="atlas-controls">
      <label>浏览分支<select aria-label="浏览分支" value={state.view} onChange={e=>change({view:e.target.value})}><option value="overview">主干总览</option><option value="all">全部技术</option>{attentionFamilies.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <form role="search" onSubmit={e=>{e.preventDefault();change({q:search,view:'all'})}}><label htmlFor="atlas-search">查找技术</label><div><input id="atlas-search" placeholder="例如 GQA、Delta、稀疏" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" aria-label="搜索技术"><Search size={17}/></button></div></form>
      <label>直接定位<select aria-label="直接定位技术" value={selected.id} onChange={e=>{const node=attentionById.get(e.target.value)!;change({node:node.id,view:node.family,q:''})}}>{attentionFamilies.map(f=><optgroup key={f.id} label={f.name}>{attentionTechnologies.filter(n=>n.family===f.id).map(n=><option key={n.id} value={n.id}>{n.name} · {n.year}</option>)}</optgroup>)}</select></label>
    </div>
    <section aria-label="当前技术简介" className="atlas-selection" style={{'--atlas-color':colorOf(selected)} as CSSProperties}>
      <div><p className="eyebrow">{attentionFamilies.find(f=>f.id===selected.family)!.name} · {selected.year}</p><h2>{selected.name}</h2><p className="atlas-fullname">{selected.fullName}</p></div>
      <p className="text-sm leading-6 text-secondary">{selected.summary}</p>
      <div className="flex flex-wrap gap-2"><ReadingLink node={selected}/><a className="button-secondary" href={selected.paper} target="_blank" rel="noreferrer">论文来源</a></div>
    </section>
    <div className="atlas-legend"><span><i className="atlas-solid"/>扩展 / 推广</span><span><i className="atlas-dashed"/>相关路线，非继承</span><span><i className="atlas-combines"/>混合采用</span><span><i className="atlas-implements"/>执行优化</span></div>
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-xs text-muted"><p>悬浮或聚焦预览 · 点击固定简介 · 窄屏可横向滚动图谱</p><span aria-live="polite">当前 {positions.length} / {attentionTechnologies.length} 项</span></div>
    {positions.length>0?<div className="atlas-scroll" role="region" aria-label="Attention 演进知识图谱，可横向滚动" tabIndex={0}>
      <div className="atlas-canvas" style={{height}}>
        {labels.map(l=><p key={l.name} className="atlas-lane" style={{top:l.y,color:l.color}}>{l.name}</p>)}
        <svg width="1000" height={height} aria-hidden="true" className="atlas-edges"><defs>{['extends','alternative','combines','implements'].map(kind=><marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={kind==='combines'?'#e8b875':kind==='implements'?'#9bb6eb':'#9a91bb'}/></marker>)}</defs>{edges.map((e,index)=>{
          const from=placed.get(e.from)!,to=placed.get(e.to)!,sameRow=from.y===to.y
          const startX=from.x+172,startY=from.y+32,endX=to.x-5
          const adjacent=sameRow&&endX>startX&&endX-startX<100
          const gutter=Math.min(from.y,to.y)-10-(index%3)*6
          const path=adjacent?`M ${startX} ${startY} H ${endX}`:sameRow?`M ${from.x+86} ${from.y} V ${gutter} H ${to.x+86} V ${to.y-5}`:`M ${startX} ${startY} H ${startX+22+(index%3)*7} V ${to.y-16} H ${to.x+86} V ${to.y-5}`
          return <path key={`${e.from}-${e.to}`} data-edge={`${e.from}-${e.to}`} data-kind={e.kind} d={path} className={`atlas-edge atlas-${e.kind}`} opacity={e.from===active||e.to===active?1:0.55} markerEnd={`url(#arrow-${e.kind})`}/>
        })}</svg>
        {positions.map(({node,x,y})=><button key={node.id} className="atlas-node" data-node={node.id} aria-label={`${node.name}，${node.year}，查看简介`} aria-pressed={selected.id===node.id} style={{left:x,top:y,'--atlas-color':colorOf(node)} as CSSProperties} onMouseEnter={e=>peek(node,e.currentTarget)} onMouseLeave={leave} onFocus={e=>peek(node,e.currentTarget)} onBlur={leave} onClick={()=>choose(node.id)}><span>{node.name}</span><small>{node.year}</small></button>)}
      </div>
    </div>:<div className="surface-card p-10 text-center"><p>没有匹配的技术。</p><button className="button-secondary mt-4" onClick={()=>change({q:'',view:'all'})}>清除搜索</button></div>}
    <p className="mt-3 text-xs leading-5 text-muted">图中位置按路线编排，非等距时间轴。总览只画主干；分支视图保留分支内关系，跨分支关系见下方证据。选择“全部技术”时会补充当前节点的跨分支连线。</p>
    <section className="atlas-evidence" aria-label="关系与证据"><h2>{selected.name} 的关联关系</h2><p className="mb-4 text-sm leading-6 text-secondary">{selected.boundary}</p><div className="grid gap-3 md:grid-cols-2">{relations.map(e=><div key={`${e.from}-${e.to}`} className="surface-card p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><button className="text-accent underline underline-offset-4" onClick={()=>change({node:e.from,view:'all',q:''})}>{attentionById.get(e.from)!.name}</button><span aria-label="指向">→</span><button className="text-accent underline underline-offset-4" onClick={()=>change({node:e.to,view:'all',q:''})}>{attentionById.get(e.to)!.name}</button><span className="text-xs text-muted">{attentionRelationLabels[e.kind]}</span></div><p className="my-2 text-sm leading-6 text-secondary">{e.explanation}</p><a href={e.source} target="_blank" rel="noreferrer" className="text-xs text-accent underline">关系依据 ↗</a></div>)}</div>{relations.length===0&&<p className="text-sm text-muted">暂未收录可核对的直接关系；不按年份自动生成依赖。</p>}</section>
    <details className="surface-card mt-8 p-5"><summary className="cursor-pointer text-sm text-ink">全部技术索引 · {attentionTechnologies.length} 项</summary><div className="mt-5 space-y-5">{attentionFamilies.map(f=><div key={f.id}><h3 className="mb-2 text-sm" style={{color:f.color}}>{f.name} <span className="text-muted">/ {f.question}</span></h3><div className="flex flex-wrap gap-2">{attentionTechnologies.filter(n=>n.family===f.id).map(n=><button key={n.id} className="button-secondary text-xs" onClick={()=>{change({node:n.id,view:n.family,q:''});window.scrollTo({top:0,behavior:'instant'})}}>{n.name}</button>)}</div></div>)}</div></details>
    <footer className="mt-6 space-y-3 text-xs leading-6 text-muted"><p>收录边界：这是以语言模型推理为重点的代表性技术图谱，不是穷尽全部论文的清单。Self / Cross、Causal / Bidirectional、位置编码是可组合维度；视觉与多模态专用分支尚未展开。年份以所引工作首次公开年份为准，SWA 为代表实现年份。资料核对：{ATTENTION_REVIEWED_AT}。</p><a className="text-accent underline" href={`${import.meta.env.BASE_URL}diagrams/attention-core.html`} target="_blank" rel="noreferrer">打开可导出的三条主干路线图 ↗</a><p>静态资料与 URL 状态；不保存或上传你的浏览选择。</p></footer>
    {preview&&<div ref={previewRef} className="atlas-preview" role="region" aria-label={`${preview.node.name} 悬浮简介`} style={{left:preview.left,top:preview.top,'--atlas-color':colorOf(preview.node)} as CSSProperties} onMouseEnter={()=>clearTimeout(timer.current)} onMouseLeave={leave} onFocus={()=>clearTimeout(timer.current)} onBlur={leave}><button className="atlas-close" aria-label="关闭预览" onClick={()=>{lastTrigger.current?.focus();closePreview()}}><X size={16}/></button><p className="eyebrow">{preview.node.year} · {attentionFamilies.find(f=>f.id===preview.node.family)!.name}</p><h2>{preview.node.name}</h2><p className="my-3 text-sm leading-6 text-secondary">{preview.node.summary}</p><ReadingLink node={preview.node}/><button className="ml-3 text-xs text-accent underline" onClick={()=>choose(preview.node.id)}>固定简介</button></div>}
  </div>
}
