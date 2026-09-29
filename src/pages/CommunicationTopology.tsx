import { useEffect, useMemo, useState, useTransition } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import ModelSectionNav from '@/components/ModelSectionNav'
import PageHeader from '@/components/PageHeader'
import CommunicationTopologyView from '@/components/CommunicationTopologyView'
import learningFeatures from '../../config/learning-features.json'
import { defaultTopology, groupNames, modeNames, modesForGroup, logicalRank, readTopologyQuery, simulateTopology, topologyKeys, worldSize, writeTopologyQuery, type GroupKind, type TopologyConfig } from '@/lib/communication-topology'

const panel='rounded-xl border border-line bg-surface p-4 sm:p-5'
const input='mt-1 min-h-11 w-full rounded-lg border border-line bg-field px-3 text-sm text-ink'
const strings=(c:TopologyConfig)=>Object.fromEntries(topologyKeys.map(k=>[k,String(c[k])]))
const bytes=(n:number)=>n>=1048576?`${(n/1048576).toFixed(2)} MiB`:`${(n/1024).toFixed(2)} KiB`
const time=(n:number)=>n>=1000?`${(n/1000).toFixed(3)} ms`:`${n.toFixed(2)} µs`
const numericLabels={tp:'总 TP',ep:'EP',adp:'Attention DP',pp:'PP stages',replicas:'独立副本',devices:'每台设备数',rank:'锚定 rank',sizeKiB:'逻辑缓冲区 S（KiB）',localGBs:'机内每 rank 带宽（GB/s）',remoteGBs:'跨机每 rank 带宽（GB/s）',nicGBs:'每台共享出口（GB/s）',localUs:'机内每轮启动（µs）',remoteUs:'跨机每轮启动（µs）'}

function Lab({config:c}:{config:TopologyConfig}) {
  const [,setSearch]=useSearchParams(),[pending,startTransition]=useTransition()
  const [draft,setDraft]=useState(()=>strings(c)),[error,setError]=useState(''),[open,setOpen]=useState(()=>window.matchMedia('(min-width:1280px)').matches)
  const [position,setPosition]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const result=useMemo(()=>simulateTopology(c),[c]),rank=logicalRank(c,c.rank),completed=Math.floor(position)
  const round=result.rounds[position%1?completed:Math.max(0,completed-1)]
  const dirty=topologyKeys.some(k=>draft[k]!==String(c[k]))
  const jump=(p:number)=>{setPlaying(false);setPosition(p)}
  function navigate(next:TopologyConfig){jump(0);setError('');setDraft(strings(next));startTransition(()=>setSearch(writeTopologyQuery(next)))}
  function apply(){try{navigate(readTopologyQuery(new URLSearchParams(draft).toString()))}catch(e){setError((e as Error).message)}}
  function edit(k:string,v:string){setPlaying(false);setDraft(d=>({...d,[k]:v,...(k==='group'?{mode:modesForGroup(v as GroupKind)[0]}:{})}))}
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const stop=()=>setPlaying(false),change=()=>{setReduced(media.matches);stop()}
    const click=(e:MouseEvent)=>{if((e.target as Element)?.closest?.('a')?.getAttribute('href')?.startsWith('#/'))stop()}
    media.addEventListener('change',change);document.addEventListener('visibilitychange',stop);document.addEventListener('click',click,true);window.addEventListener('hashchange',stop);window.addEventListener('popstate',stop)
    return ()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',stop);document.removeEventListener('click',click,true);window.removeEventListener('hashchange',stop);window.removeEventListener('popstate',stop)}
  },[])
  useEffect(()=>{
    if(!playing||reduced)return
    let frame=0,previous=performance.now()
    const tick=(now:number)=>{const dt=Math.min(now-previous,100);previous=now;setPosition(p=>Math.min(result.rounds.length,p+dt/1800*speed));frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame)
  },[playing,reduced,speed,result.rounds.length])
  useEffect(()=>{if(position>=result.rounds.length)setPlaying(false)},[position,result.rounds.length])
  const alternatives=useMemo(()=>{
    const modes=c.mode.includes('allreduce')?(['ring-allreduce','tree-allreduce'] as const):[c.mode]
    return modes.flatMap(mode=>(['packed','striped'] as const).map(placement=>{const config={...c,mode,placement};return {config,result:simulateTopology(config)}}))
  },[c])
  const numberInput=(k:keyof typeof numericLabels)=><label key={k} className="text-xs text-secondary">{numericLabels[k]}<input aria-label={numericLabels[k]} className={input} inputMode={k.endsWith('GBs')||k.endsWith('Us')?'decimal':'numeric'} value={draft[k]} onChange={e=>edit(k,e.target.value)}/></label>
  return <>
    <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="拓扑结果摘要">{[
      ['设备总数',worldSize(c).toLocaleString()],['所选组发送总量',bytes(result.totalBytes)],['其中跨机发送',bytes(result.remoteBytes)],['同步轮次模型估时',time(result.durationUs)],
    ].map(([label,value])=><div className={panel} key={label}><p className="text-xs leading-5 text-secondary">{label}</p><p className="mt-2 break-words font-mono text-xl" data-testid={label}>{value}</p></div>)}</section>
    <p className="mb-4 text-xs leading-5 text-secondary">{Math.ceil(worldSize(c)/c.devices).toLocaleString()} 台主机 · 本组 {result.members.length} ranks / {result.hosts} 台主机 · 只统计所选组的一次操作。发送只计一次，不把接收重复加总；估时不含计算、其他组、框架开销或拥塞。</p>
    <div className="mb-4 flex flex-wrap gap-2" aria-label="拓扑实验预设">{([
      ['TP 留在机内',{...defaultTopology}],['同组跨机交错',{...defaultTopology,placement:'striped'}],['EP 分发',{...defaultTopology,tp:16,ep:8,group:'ep',mode:'pairwise-alltoall'}],['PP 阶段传递',{...defaultTopology,pp:4,group:'pp',mode:'pipeline'}],
    ] as [string,TopologyConfig][]).map(([name,next])=><button className="button-secondary" disabled={pending} key={name} onClick={()=>navigate(next)}>{name}</button>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <details className={panel} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">实验条件 · TP{c.tp} / EP{c.ep} / PP{c.pp}</summary><form aria-label="通信拓扑参数" className="mt-3" onSubmit={e=>{e.preventDefault();apply()}}><fieldset disabled={pending}>
        <div className="grid grid-cols-2 gap-3">{(['tp','ep','adp','pp','replicas','devices'] as const).map(numberInput)}</div>
        <label className="mt-3 block text-xs text-secondary">rank 放置<select aria-label="rank 放置" className={input} value={draft.placement} onChange={e=>edit('placement',e.target.value)}><option value="packed">按全局 rank 连续装机</option><option value="striped">按主机交错装机</option></select></label>
        <div className="mt-3">{numberInput('rank')}</div>
        <label className="mt-3 block text-xs text-secondary">观察逻辑组<select aria-label="观察逻辑组" className={input} value={draft.group} onChange={e=>edit('group',e.target.value)}>{Object.entries(groupNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
        <label className="mt-3 block text-xs text-secondary">通信算法<select aria-label="通信算法" className={input} value={draft.mode} onChange={e=>edit('mode',e.target.value)}>{modesForGroup(draft.group as GroupKind).map(mode=><option key={mode} value={mode}>{modeNames[mode]}</option>)}</select></label>
        <div className="mt-3">{numberInput('sizeKiB')}</div>
        <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm">带宽／延迟假设（非设备规格）</summary><div className="grid gap-3">{(['localGBs','remoteGBs','nicGBs','localUs','remoteUs'] as const).map(numberInput)}</div></details>
        {dirty&&<p className="mt-3 text-xs text-amber-200">输入尚未应用；图与结果仍对应已应用配置。</p>}{error&&<p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
        <button className="button-primary mt-3 w-full" type="submit">应用参数</button><p className="mt-3 text-xs leading-5 text-muted">各并行轴至 64；总卡数 = TP × PP × 独立副本。EP 与 Attention DP 必须整除 TP。只按组展开，支持大规模逻辑世界；不验证具体模型或后端能否部署。</p>
      </fieldset></form></details>
      <section className={`${panel} min-w-0`} aria-label="通信轮次实验"><fieldset disabled={pending} aria-busy={pending} className="min-w-0">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-medium">{modeNames[c.mode]}</h2><span className="text-xs text-secondary">副本 {rank.replica} · 阶段 {rank.stage} · {groupNames[c.group]}</span></div>
        <label className="mt-3 block text-xs text-secondary">跳转轮次<select aria-label="跳转轮次" className={input} value={completed} onChange={e=>jump(Number(e.target.value))}><option value="0">初始状态（尚未通信）</option>{result.rounds.map((r,i)=><option key={i} value={i+1}>完成 {i+1}. {r.label}</option>)}</select></label>
        <div className="my-3 flex flex-wrap gap-2"><button className="button-primary" disabled={reduced||dirty||pending||!result.rounds.length||position>=result.rounds.length} onClick={()=>setPlaying(p=>!p)}>{playing?'暂停':'播放'}</button><button className="button-secondary" disabled={!position} onClick={()=>jump(Math.max(0,Math.ceil(position)-1))}>上一步</button><button className="button-secondary" disabled={position>=result.rounds.length} onClick={()=>jump(Math.min(result.rounds.length,Math.floor(position)+1))}>下一步</button><button className="button-secondary" onClick={()=>jump(0)}>重新开始</button><label className="flex items-center gap-2 text-xs text-secondary">速度<select aria-label="播放速度" className="min-h-11 rounded-lg border border-line bg-field px-2" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label></div>
        <p className="mb-2 text-sm text-accent" data-testid="round-status">已完成 {completed} / {result.rounds.length} 轮{position%1?' · 下一轮传输中':''}</p>
        <p className="mb-3 text-xs leading-5 text-secondary">{round?`${round.phase} · ${round.label} · 该轮模型时间 ${time(round.durationUs)}；${position===0?'当前展示第一轮待发消息':position%1?'数值只更新至上一完成轮':'以下消息已完成'}。`:'单参与者操作，无需通信。'}可暂停观察任意消息，单步查看完成后的数据。</p>
        {reduced&&<p className="mb-3 text-xs text-amber-200">已遵循“减少动态效果”：关闭自动播放，可用单步和轮次选择。</p>}
        <CommunicationTopologyView config={c} result={result} position={position}/>
      </fieldset></section>
    </div>
    <section className={`${panel} mt-5`} aria-label="算法与放置对照"><h2 className="font-medium">算法与放置对照 · 同一逻辑组、同一数据量</h2><p className="my-3 text-xs leading-5 text-secondary">只改变算法或放置，不改变已应用的带宽假设。它不是部署方案库，也不保存配置。模型估时较小不代表实际系统更快。</p><div className="grid gap-3 sm:grid-cols-2">{alternatives.map(({config:x,result:y})=><div className="rounded-lg border border-line p-3" key={`${x.mode}-${x.placement}`}><p className="text-sm">{modeNames[x.mode]} · {x.placement==='packed'?'连续装机':'交错装机'}</p><p className="my-2 text-xs leading-6 text-secondary">{y.rounds.length} 轮 · 跨机 {bytes(y.remoteBytes)} · 模型估时 {time(y.durationUs)}</p><button className="button-secondary" disabled={pending||(x.mode===c.mode&&x.placement===c.placement)} onClick={()=>navigate(x)}>{x.mode===c.mode&&x.placement===c.placement?'当前实验':'应用此对照'}</button></div>)}</div></section>
    <details className={`${panel} mt-5`}><summary className="min-h-11 cursor-pointer py-2 font-medium">逐 rank 发送量与计算假设</summary><div role="region" aria-label="通信量明细" tabIndex={0} className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Rank','发送','接收'].map(s=><th className="whitespace-nowrap px-3 py-2 font-normal text-secondary" key={s}>{s}</th>)}</tr></thead><tbody>{result.members.map((rank,i)=><tr className="border-t border-line" key={rank}><td className="px-3 py-2 font-mono">{rank}</td><td className="whitespace-nowrap px-3">{bytes(result.sent[i])}</td><td className="whitespace-nowrap px-3">{bytes(result.received[i])}</td></tr>)}</tbody></table></div><div className="mt-4 space-y-3 text-sm leading-6 text-secondary">
      <p>S = {bytes(c.sizeKiB*1024)}：All-Reduce / Reduce-Scatter 是每 rank 输入完整缓冲区；All-Gather 是最终拼接缓冲区；All-to-All 是每 rank 含本地块的总发送缓冲区；PP 是一次相邻阶段传递的激活大小。所有分片等大，不模拟变长 All-to-All 或真实 MoE 路由分布。</p>
      <p>Ring All-Reduce = n−1 轮 Reduce-Scatter + n−1 轮 All-Gather，每消息 S/n；单 rank 总发送 2(n−1)S/n。独立 Gather / Scatter 各 n−1 轮。Tree 使用二项树先归约再广播，每消息 S，合计 2⌈log₂n⌉ 轮；这是教学算法，不代表 NCCL / HCCL 的双树、分块、通道或自动选型。</p>
      <p>每轮估时 = max（机内各 rank 服务时间、跨机各 rank 服务时间、每台共享出口服务时间），各项为 α + 该方向字节数 / B；发送与接收为独立全双工预算。GB/s 为十进制，KiB 为 1024 字节。轮次不重叠，最终时间逐轮相加；不包含交换机拥塞、协议开销、归约计算与其他组竞争。</p>
      <p>PP 只串行演示一份激活沿相邻阶段移动，不是流水线吞吐或气泡模型。独立推理副本之间无此处的集合通信；Attention DP 是 TP 内部分组，不与独立副本混同。EP 分发使用等大 All-to-All 示例，真实 dispatch / combine 的不均衡可另看 MoE 沙盘。</p>
      <p>本工具不读设备、不做测量、不运行模型，也不上传或持久化。参数可通过 URL 复现，动画位置不保存。</p>
      <div className="flex flex-wrap gap-3"><a className="text-accent underline" target="_blank" rel="noreferrer" href="https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html">NCCL：集合通信语义 ↗</a><a className="text-accent underline" target="_blank" rel="noreferrer" href="https://github.com/NVIDIA/nccl-tests/blob/master/doc/PERFORMANCE.md">NCCL Tests：字节量与带宽口径 ↗</a>{learningFeatures.multiRankProfiling&&<Link className="text-accent underline" to="/operators/ranks">多 Rank Profiling：验证实测行为</Link>}<a className="text-accent underline" target="_blank" rel="noreferrer" href={`${import.meta.env.BASE_URL}diagrams/communication-topology.html`}>概念图：为什么共享出口会限制跨机通信 ↗</a></div>
    </div></details>
  </>
}

export default function CommunicationTopology(){
  const {search}=useLocation(),[,setSearch]=useSearchParams()
  const parsed=useMemo(()=>{try{return {config:readTopologyQuery(search),error:''}}catch(e){return {config:null,error:(e as Error).message}}},[search])
  useEffect(()=>{const old=document.title;document.title='通信拓扑实验室 · AI Infra Space';return ()=>{document.title=old}},[])
  return <div className="page-container py-6 text-ink [&_button:disabled]:opacity-50 [&_input:disabled]:opacity-50 [&_.page-heading]:mb-3 [&_.page-heading]:pb-4 [&_.page-heading__description]:mt-2"><ModelSectionNav compact/><PageHeader compact eyebrow="COLLECTIVE COMMUNICATION" title="通信拓扑实验室" description="看清谁与谁通信、消息如何移动，以及共享链路的影响。"/><p className="mb-4 text-xs leading-5 text-secondary">本地教学模拟 · 非实测性能 · 不生成部署保证</p>{parsed.config?<Lab key={search} config={parsed.config}/>:<section className={panel} role="alert"><h2>参数无法使用</h2><p className="my-3 text-secondary">{parsed.error}</p><button className="button-primary" onClick={()=>setSearch(writeTopologyQuery(defaultTopology))}>重置为默认参数</button></section>}</div>
}
