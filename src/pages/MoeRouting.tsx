import { useEffect, useMemo, useState, useTransition } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import ModelSectionNav from '@/components/ModelSectionNav'
import MoeTokenFlow from '@/components/MoeTokenFlow'
import { defaultMoeConfig, moeConfigKeys, readMoeQuery, simulateMoe, writeMoeQuery, type MoeRoutingConfig } from '@/lib/moe-routing'

const phases = ['路由选择','Dispatch 分发','Expert 计算','Combine 归并','输出完成']
const explanations = [
  '为每个 Token 选择 K 个不同专家。本沙盘对选中的得分做 Softmax，得到和为 1 的路由权重；容量规则随后决定保留哪些分配。',
  '按目标 rank 分发激活，并重排为专家批次。本地分支也需要布局重排，但不计为跨 rank 分配；同一 Token 可以在目标 rank 内供多个专家使用。',
  '各专家处理自己的有效分配。这里用公开的二维仿射函数替代真实 MLP，只演示数据依赖；填充槽位没有有效 Token，也不贡献输出。',
  '专家结果返回源 rank，按原始 Token 身份还原，乘以归并权重再求和。不是把所有专家结果直接拼接，也不是把 Token 留在专家所在 rank。',
  '恢复为原始 Token 数量与顺序。被全部丢弃的 Token 在本沙盘中输出零向量；不模拟残差、共享专家或后续网络。',
]
const inputClass='min-h-11 w-full rounded-lg border border-line bg-field px-3 text-sm text-ink'
const panel='rounded-xl border border-line bg-surface p-4 sm:p-5'
const labels: Record<string,string>={tokens:'Token 数 N',experts:'专家数 E',topK:'Top-K',ep:'EP ranks',seed:'随机种子',capacityFactor:'容量系数 CF'}
function strings(c:MoeRoutingConfig){return Object.fromEntries(moeConfigKeys.map(k=>[k,String(c[k])] ))}

function Sandbox({config}:{config:MoeRoutingConfig}) {
  const [,setSearch] = useSearchParams()
  const [pending,startTransition]=useTransition()
  const navigate=(c:MoeRoutingConfig)=>startTransition(()=>setSearch(writeMoeQuery(c)))
  const result = useMemo(()=>simulateMoe(config),[config])
  const [draft,setDraft]=useState(()=>strings(config)),[error,setError]=useState('')
  const [controlsOpen,setControlsOpen]=useState(()=>window.matchMedia('(min-width: 1280px)').matches)
  const [selected,setSelected]=useState(0),[expertPage,setExpertPage]=useState(0),[rankPage,setRankPage]=useState(0)
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const phase=Math.min(4,Math.floor(position)),token=result.tokens[selected]
  const dirty=moeConfigKeys.some(k=>draft[k]!==String(config[k]))
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>{setReduced(media.matches);setPlaying(false)}
    const stop=()=>setPlaying(false)
    const click=(event:MouseEvent)=>{const a=(event.target as Element)?.closest?.('a');if(a?.getAttribute('href')?.startsWith('#/'))stop()}
    media.addEventListener('change',change);document.addEventListener('visibilitychange',stop);document.addEventListener('click',click,true);window.addEventListener('hashchange',stop);window.addEventListener('popstate',stop)
    return ()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',stop);document.removeEventListener('click',click,true);window.removeEventListener('hashchange',stop);window.removeEventListener('popstate',stop)}
  },[])
  useEffect(()=>{
    if(!playing||reduced)return
    let frame=0,previous=performance.now()
    const tick=(now:number)=>{const dt=Math.min(now-previous,100);previous=now;setPosition(p=>Math.min(4,p+dt/2000*speed));frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(frame)
  },[playing,reduced,speed])
  useEffect(()=>{if(position>=4)setPlaying(false)},[position])
  const jump=(p:number)=>{setPlaying(false);setPosition(p)}
  function apply(){
    try{const c=readMoeQuery(new URLSearchParams(draft).toString());setError('');setPlaying(false);setPosition(0);navigate(c)}catch(e){setError((e as Error).message)}
  }
  const counts=[['有效专家分配',`${result.dispatch.length} / ${result.routes.length}`],['跨 rank 分配',String(result.remoteAssignments)],['专家负载峰均比',`${result.imbalance.toFixed(2)}×`],['丢弃的专家分配',String(result.dropped)]]
  return <>
    <section aria-label="路由结果摘要" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{counts.map(([label,value])=><div key={label} className={panel}><p className="text-xs text-secondary">{label}</p><p className="mt-2 font-mono text-2xl text-ink" data-testid={label}>{value}</p></div>)}</section>
    <div className="mb-5 flex flex-wrap gap-2" aria-label="教学实验预设">
      {([['均衡基线',{...defaultMoeConfig}],['热点专家',{...defaultMoeConfig,pattern:'hotspot'}],['容量丢弃',{...defaultMoeConfig,pattern:'hotspot',policy:'drop'}]] as [string,MoeRoutingConfig][]).map(([name,c])=><button key={name} disabled={pending} className="button-secondary" onClick={()=>{jump(0);setDraft(strings(c));setError('');setSelected(0);setExpertPage(0);setRankPage(0);navigate(c)}}>{name}</button>)}
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <details className={panel} open={controlsOpen} onToggle={e=>setControlsOpen(e.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">实验条件 · N{config.tokens} / E{config.experts} / K{config.topK} / EP{config.ep}</summary>
      <form className="mt-3" aria-label="路由参数" onSubmit={e=>{e.preventDefault();apply()}}>
        <fieldset disabled={pending}>
        <div className="grid grid-cols-2 gap-3">
          {(['tokens','experts','topK','ep'] as const).map(k=><label key={k} className="text-xs text-secondary">{labels[k]}<input className={`${inputClass} mt-1`} inputMode="numeric" value={draft[k]} onChange={e=>{setPlaying(false);setDraft({...draft,[k]:e.target.value})}}/></label>)}
        </div>
        <label className="mt-3 block text-xs text-secondary">路由得分模式<select className={`${inputClass} mt-1`} value={draft.pattern} onChange={e=>{setPlaying(false);setDraft({...draft,pattern:e.target.value})}}><option value="balanced">循环均衡（合成）</option><option value="random">随机得分（固定种子）</option><option value="hotspot">前 K 个专家热点</option></select></label>
        <details className="mt-4"><summary className="cursor-pointer py-2 text-sm text-secondary">容量与数值规则</summary>
          <label className="mt-2 block text-xs text-secondary">容量策略<select className={`${inputClass} mt-1`} value={draft.policy} onChange={e=>{setPlaying(false);setDraft({...draft,policy:e.target.value})}}><option value="dropless">Dropless：不丢弃、不填充</option><option value="drop">固定容量：溢出丢弃</option><option value="pad">固定容量：丢弃并填充</option></select></label>
          {(['capacityFactor','seed'] as const).map(k=><label key={k} className="mt-3 block text-xs text-secondary">{labels[k]}<input className={`${inputClass} mt-1`} inputMode={k==='seed'?'numeric':'decimal'} value={draft[k]} disabled={k==='capacityFactor'&&draft.policy==='dropless'} onChange={e=>{setPlaying(false);setDraft({...draft,[k]:e.target.value})}}/></label>)}
          <label className="mt-3 block text-xs text-secondary">丢弃后归并权重<select className={`${inputClass} mt-1`} value={draft.combine} onChange={e=>{setPlaying(false);setDraft({...draft,combine:e.target.value})}}><option value="preserve">保留原路由权重</option><option value="renormalize">仅对保留分支重新归一化</option></select></label>
        </details>
        {dirty&&<p className="mt-3 text-xs text-amber-200">参数尚未应用；图表仍显示已应用配置。</p>}
        {error&&<p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
        <button className="button-primary mt-4 w-full" type="submit">应用参数</button>
        <p className="mt-3 text-xs leading-5 text-muted">N ≤ 128，E / EP ≤ 64，K ≤ 8。教学显示范围，不是部署上限。参数保留在 URL；不保存个人数据。</p>
        </fieldset>
      </form>
      </details>
      <section className={`${panel} min-w-0`} aria-label="Token 执行过程">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-medium">跟随一个 Token</h2><label className="flex items-center gap-2 text-sm text-secondary">Token<select aria-label="观察 Token" className={`${inputClass} w-28`} value={selected} onChange={e=>{setSelected(Number(e.target.value));jump(0)}}>{result.tokens.map(t=><option key={t.token} value={t.token}>T{t.token}</option>)}</select></label></div>
        <div className="my-4 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="执行阶段">{phases.map((label,i)=><button key={label} className={`min-h-11 rounded-lg border px-2 py-2 text-xs ${phase===i?'border-accent bg-accent/10 text-accent':'border-line text-secondary'}`} aria-pressed={phase===i} onClick={()=>jump(i)}>{i+1}. {label}</button>)}</div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button className="button-primary" disabled={reduced||dirty} onClick={()=>{if(position>=4)setPosition(0);setPlaying(!playing)}}>{playing?'暂停':'播放'}</button>
          <button className="button-secondary" disabled={position===0} onClick={()=>jump(Math.max(0,Math.ceil(position)-1))}>上一步</button>
          <button className="button-secondary" disabled={position>=4} onClick={()=>jump(Math.min(4,Math.floor(position)+1))}>下一步</button>
          <button className="button-secondary" onClick={()=>jump(0)}>重置动画</button>
          <label className="ml-auto text-xs text-secondary">速度<select aria-label="动画速度" className="ml-2 min-h-11 rounded-lg border border-line bg-field px-2" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
        </div>
        <MoeTokenFlow token={token} position={position} reduced={reduced}/>
        <div aria-live="polite" className="mt-4 min-h-24"><p className="text-sm font-medium text-ink">{phases[phase]}</p><p className="mt-1 text-sm leading-6 text-secondary">{explanations[phase]}</p></div>
        {reduced&&<p className="text-xs text-amber-200">已遵循系统“减少动态效果”设置：使用阶段按钮或上／下一步阅读。</p>}
        <p className="mt-2 text-xs text-muted">动画进度不是硬件时间轴；线条表示逻辑数据依赖，不代表网络拓扑。横向滚动可查看完整分支。</p>
      </section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="font-medium">专家负载</h2><span className="text-xs text-secondary">请求 / 接纳 / 填充</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3">{result.experts.slice(expertPage*16,expertPage*16+16).map(e=><div key={e.expert} className="rounded-lg border border-line p-3"><p className="flex justify-between gap-2 text-xs"><span>E{e.expert} · R{e.rank}</span><span className="font-mono text-secondary">{e.requested} / {e.accepted} / {e.padding}</span></p><div className="mt-2 h-2 rounded bg-raised" aria-hidden="true"><div className="h-full rounded bg-accent" style={{width:`${e.requested/Math.max(1,...result.experts.map(x=>x.requested))*100}%`}}/></div>{e.dropped>0&&<p className="mt-1 text-xs text-rose-200">丢弃 {e.dropped}</p>}</div>)}</div>
        {result.experts.length>16&&<div className="mt-3 flex gap-2"><button className="button-secondary" disabled={!expertPage} onClick={()=>setExpertPage(p=>p-1)}>上一组专家</button><button className="button-secondary" disabled={(expertPage+1)*16>=config.experts} onClick={()=>setExpertPage(p=>p+1)}>下一组专家</button><span className="self-center text-xs">{expertPage+1} / {Math.ceil(config.experts/16)}</span></div>}
        <p className="mt-3 text-xs leading-5 text-secondary">峰均比基于容量处理前的请求量：max(load) / mean(load)，不是耗时比。{result.capacity===null?'当前不设置容量上限。':`每专家容量 C = ceil(N × K / E × CF) = ${result.capacity}。`}</p>
      </section>
      <section className={`${panel} min-w-0`}><h2 className="font-medium">T{selected} 的归并算式</h2><p className="mt-2 text-sm text-secondary">输出 = [{token.output.map(n=>n.toFixed(4)).join(', ')}] · 保留路由权重和 {token.retainedWeight.toFixed(4)}</p>
        <div className="mt-3 overflow-x-auto" role="region" aria-label="所选 Token 分支明细" tabIndex={0}><table className="w-full text-left text-xs"><thead className="text-secondary"><tr>{['专家 / rank','路由 w','归并 w′','f(x)','接纳'].map(s=><th key={s} className="whitespace-nowrap px-2 py-3 font-normal">{s}</th>)}</tr></thead><tbody>{token.assignments.map(a=><tr key={a.expert} className="border-t border-line"><td className="whitespace-nowrap px-2 py-3">E{a.expert} / R{a.rank}</td><td className="px-2 font-mono">{a.weight.toFixed(4)}</td><td className="px-2 font-mono">{a.combineWeight.toFixed(4)}</td><td className="whitespace-nowrap px-2 font-mono">[{a.output.map(v=>v.toFixed(2)).join(', ')}]</td><td className="whitespace-nowrap px-2">{a.accepted?'保留':'丢弃'}</td></tr>)}</tbody></table></div>
        <p className="mt-4 text-xs leading-6 text-secondary">教学函数：x = (Token ID + 1) / 10；fₑ(x) = [x × (e + 1), x + e / 10]。该函数不是模型专家 MLP，也不是模型预测。</p>
        {result.emptyTokens>0&&<p className="mt-3 text-sm text-rose-200">共有 {result.emptyTokens} 个 Token 的所有分支被丢弃；Token 身份仍保留，当前层模拟输出为零。</p>}
      </section>
    </div>
    <details className={`${panel} mt-5`}><summary className="cursor-pointer py-1 font-medium">通信与专家批次 · 查看所有 rank 的统计和重排</summary>
      <p className="my-4 text-sm leading-6 text-secondary">有效跨 rank 专家分配 {result.remoteAssignments}；按 (Token, 目标 rank) 去重后为 {result.remoteTokenRanks} 个逻辑激活副本。本地专家分配 {result.localAssignments}。去重数不是实测发包数或字节数；实际后端可能融合、分层分发、量化、填充。Combine 方向反转，但不据此假定相同网络流量。</p>
      <div className="overflow-x-auto" role="region" aria-label="rank 负载明细" tabIndex={0}><table className="w-full text-left text-sm"><thead className="text-secondary"><tr>{['Rank','请求分配','有效分配','填充槽位','发送分配','接收分配'].map(s=><th key={s} className="whitespace-nowrap px-3 py-2 font-normal">{s}</th>)}</tr></thead><tbody>{result.ranks.slice(rankPage*16,rankPage*16+16).map(r=><tr key={r.rank} className="border-t border-line">{[r.rank,r.requested,r.accepted,r.padding,r.sent,r.received].map((v,i)=><td key={i} className="px-3 py-2 font-mono">{v}</td>)}</tr>)}</tbody></table></div>
      {config.ep>16&&<div className="mt-3 flex gap-3"><button className="button-secondary" disabled={!rankPage} onClick={()=>setRankPage(p=>p-1)}>上一组 rank</button><button className="button-secondary" disabled={(rankPage+1)*16>=config.ep} onClick={()=>setRankPage(p=>p+1)}>下一组 rank</button><span className="self-center text-xs">{rankPage+1} / {Math.ceil(config.ep/16)}</span></div>}
      <p className="mt-4 text-xs text-secondary">当前 Token 在专家批次中的位置（仅有效分配，不含填充；0-based）：</p><p className="mt-2 break-words font-mono text-sm">{result.dispatch.flatMap((a,i)=>a.token===selected?[`slot ${i} → R${a.rank}/E${a.expert}/T${a.token}`]:[]).join('；')||'无有效分配'}</p>
    </details>
    <details className={`${panel} mt-5`}><summary className="cursor-pointer py-1 font-medium">计算定义、限制与延伸阅读</summary><div className="mt-4 space-y-3 text-sm leading-6 text-secondary">
      <p>本工具模拟单个 MoE 层、一个 EP 组；专家连续且均匀放置，每 rank 有 E / EP 个专家。源 rank = floor(Token ID × EP / N)。不模拟 TP、PP、共享专家、冗余专家、动态负载均衡或真实网络时序。</p>
      <p>循环均衡得分按 Token ID 循环选择专家；随机模式使用固定种子的伪随机得分；热点模式给前 K 个专家加分。均衡模式不使用随机种子，不代表训练所得的路由器。</p>
      <p>先取 Top-K，再对选中得分做 Softmax。固定容量时，按每个专家收到的归一化路由权重降序接纳，平局按 Token ID 升序；不重路由。Dropless 不丢弃、不填充；“丢弃并填充”将每专家有效批次补到 C，填充不参与数值归并。实际系统可采用不同规则。</p>
      <p>EP 只改变放置和逻辑通信，不改变同一组得分产生的专家选择与数值结果。每个分支的权重只乘一次；显示的小数经过四舍五入，计算使用完整数值精度。</p>
      <div className="flex flex-wrap gap-3"><a className="text-accent underline" href={`${import.meta.env.BASE_URL}diagrams/moe-routing.html`} target="_blank" rel="noreferrer">可探索的 MoE 流程图 ↗</a><a className="text-accent underline" href="https://docs.nvidia.com/megatron-core/developer-guide/0.15.0/api-guide/moe.html" target="_blank" rel="noreferrer">Megatron Core：EP 与容量策略 ↗</a><a className="text-accent underline" href="https://arxiv.org/abs/1701.06538" target="_blank" rel="noreferrer">稀疏门控 MoE 原始论文 ↗</a><Link className="text-accent underline" to="/operators/guide">如何在 Profiling 中阅读通信</Link></div>
    </div></details>
  </>
}

export default function MoeRouting() {
  const {search}=useLocation(),[,setSearch]=useSearchParams()
  const parsed=useMemo(()=>{try{return {config:readMoeQuery(search),error:''}}catch(e){return {config:null,error:(e as Error).message}}},[search])
  useEffect(()=>{const before=document.title;document.title='MoE 路由沙盘 · AI Infra Space';return ()=>{document.title=before}},[])
  return <div className="page-container py-6 text-ink [&_button:disabled]:opacity-50 [&_input:disabled]:opacity-50 [&_.page-heading]:mb-3 [&_.page-heading]:pb-4 [&_.page-heading__description]:mt-2"><ModelSectionNav compact/><PageHeader eyebrow="INTERACTIVE SYSTEMS" title="MoE 路由沙盘" description="跟随一个 Token，理解分发、专家计算与归并。" compact/>
    <p className="mb-4 text-xs leading-5 text-secondary">本地教学模拟 · 不上传、不持久化 · 不预测吞吐或延迟</p>
    {parsed.config?<Sandbox key={search} config={parsed.config}/>:<section role="alert" className={panel}><h2 className="font-medium">参数无法使用</h2><p className="my-3 text-secondary">{parsed.error}</p><button className="button-primary" onClick={()=>setSearch(writeMoeQuery(defaultMoeConfig))}>重置为默认参数</button></section>}
  </div>
}
