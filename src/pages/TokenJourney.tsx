import { useEffect, useMemo, useState, useTransition } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import ModelSectionNav from '@/components/ModelSectionNav'
import PageHeader from '@/components/PageHeader'
import TokenJourneyView from '@/components/TokenJourneyView'
import { buildJourney, defaultJourney, journeyKeys, journeySnapshot, readJourneyQuery, writeJourneyQuery, type JourneyConfig } from '@/lib/token-journey'
import './token-journey.css'

const panel='rounded-xl border border-line bg-surface p-4 sm:p-5'
const input='mt-1 min-h-11 w-full rounded-lg border border-line bg-field px-3 text-sm text-ink'
const strings=(c:JourneyConfig)=>Object.fromEntries(journeyKeys.map(k=>[k,String(c[k])]))
const bytes=(n:number)=>n>=1048576?`${(n/1048576).toFixed(2)} MiB`:`${(n/1024).toFixed(1)} KiB`
const labels={batch:'Batch',prompt:'提示长度 P',output:'最大新 Token 数',chunk:'Prefill 分块长度',prefix:'复用前缀位置数',eosAt:'EOS 输出序号（0 = 关闭）'}

function Journey({config:c}:{config:JourneyConfig}) {
  const [,setSearch]=useSearchParams(),[pending,startTransition]=useTransition()
  const [draft,setDraft]=useState(()=>strings(c)),[error,setError]=useState('')
  const [open,setOpen]=useState(()=>window.matchMedia('(min-width:1280px)').matches)
  const [step,setStep]=useState(0),[cancelAfter,setCancelAfter]=useState<number|null>(null)
  const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const events=useMemo(()=>buildJourney(c,cancelAfter),[c,cancelAfter]),event=events[Math.min(step,events.length-1)],s=journeySnapshot(c,event)
  const dirty=journeyKeys.some(k=>draft[k]!==String(c[k]))
  const jump=(n:number)=>{setPlaying(false);setStep(n)}
  const reset=()=>{setPlaying(false);setCancelAfter(null);setStep(0)}
  function navigate(next:JourneyConfig){reset();setError('');setDraft(strings(next));startTransition(()=>setSearch(writeJourneyQuery(next)))}
  function apply(){try{navigate(readJourneyQuery(new URLSearchParams(draft).toString()))}catch(e){setError((e as Error).message)}}
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const stop=()=>setPlaying(false),change=()=>{setReduced(media.matches);stop()}
    const click=(e:MouseEvent)=>{if((e.target as Element)?.closest?.('a')?.getAttribute('href')?.startsWith('#/'))stop()}
    media.addEventListener('change',change);document.addEventListener('visibilitychange',stop);document.addEventListener('click',click,true);window.addEventListener('hashchange',stop);window.addEventListener('popstate',stop)
    return ()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',stop);document.removeEventListener('click',click,true);window.removeEventListener('hashchange',stop);window.removeEventListener('popstate',stop)}
  },[])
  useEffect(()=>{
    if(!playing||reduced)return
    if(step>=events.length-1){setPlaying(false);return}
    const timer=window.setTimeout(()=>setStep(n=>Math.min(n+1,events.length-1)),2200/speed)
    return ()=>window.clearTimeout(timer)
  },[playing,reduced,speed,step,events.length])
  const edit=(k:string,value:string)=>{setPlaying(false);setDraft(d=>({...d,[k]:value}))}
  const numberInput=(k:keyof typeof labels)=><label key={k} className="text-xs text-secondary">{labels[k]}<input aria-label={labels[k]} className={input} inputMode="numeric" value={draft[k]} onChange={e=>edit(k,e.target.value)}/></label>
  return <>
    <section aria-label="当前事件状态" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['已输出 Token',String(event.generated)],['请求 KV 位置 / 序列',String(event.kv)],['每 rank KV 有效载荷',bytes(s.payloadBytes)],['每 rank 引用页容量',bytes(s.pageBytes)],
    ].map(([label,value])=><div className={panel} key={label}><p className="text-xs leading-5 text-secondary">{label}</p><p className="mt-2 break-words font-mono text-xl" data-testid={label}>{value}</p></div>)}</section>
    <p className="mb-4 text-xs leading-5 text-secondary">该事件完成后的状态 · BF16 K + V · 全部 {s.model.dimensions.layers} 层、Batch {c.batch} · 不含权重、临时工作区和底层缓存池预分配，不是总显存。</p>
    <div className="mb-4 flex flex-wrap gap-2" aria-label="旅程预设">{([
      ['首 Token 基线',{...defaultJourney}],['分块与前缀复用',{...defaultJourney,prompt:12,prefix:4,chunk:3,retention:'prefix'}],['EOS 提前结束',{...defaultJourney,eosAt:2}],
    ] as [string,JourneyConfig][]).map(([label,next])=><button className="button-secondary" key={label} disabled={pending} onClick={()=>navigate(next)}>{label}</button>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <details className={panel} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">实验条件 · P{c.prompt} / G≤{c.output} / TP{c.tp}</summary>
        <form aria-label="旅程参数" className="mt-3" onSubmit={e=>{e.preventDefault();apply()}}><fieldset disabled={pending}>
          <label className="block text-xs text-secondary">模型<select aria-label="模型" className={input} value={draft.model} onChange={e=>edit('model',e.target.value)}><option value="qwen3-8b">Qwen3-8B</option><option value="llama-3-1-8b">Llama 3.1 8B</option></select></label>
          <div className="mt-3 grid grid-cols-2 gap-3">{(['prompt','output','batch','chunk'] as const).map(numberInput)}</div>
          <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm">并行、前缀与停止策略</summary><div className="space-y-3">
            <label className="block text-xs text-secondary">TP<select aria-label="TP" className={input} value={draft.tp} onChange={e=>edit('tp',e.target.value)}>{[1,2,4,8,16,32].map(n=><option key={n}>{n}</option>)}</select></label>
            <label className="block text-xs text-secondary">KV 页大小<select aria-label="KV 页大小" className={input} value={draft.block} onChange={e=>edit('block',e.target.value)}>{[1,4,8,16,32].map(n=><option key={n}>{n}</option>)}</select></label>
            <div className="grid gap-3">{numberInput('prefix')}{numberInput('eosAt')}</div>
            <label className="block text-xs text-secondary">结束策略<select aria-label="结束策略" className={input} value={draft.retention} onChange={e=>edit('retention',e.target.value)}><option value="free">释放引用，不新增保留</option><option value="prefix">保留完整提示页</option></select></label>
          </div></details>
          {dirty&&<p className="mt-3 text-xs text-amber-200">修改尚未应用；结果仍对应已应用参数。</p>}
          {error&&<p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
          <button className="button-primary mt-3 w-full" type="submit">应用参数</button>
          <p className="mt-3 text-xs leading-5 text-muted">教学显示范围：P ≤ 64、G ≤ 16、Batch ≤ 8；不是部署上限。两个模型均有 32 个 Q heads，当前 TP 基线最高为 32。前缀须为完整页，且短于提示。</p>
        </fieldset></form>
      </details>
      <section className={`${panel} min-w-0`} aria-label="请求执行旅程">
        <fieldset disabled={pending} className="min-w-0" aria-busy={pending}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-medium">从请求到输出</h2><span className="text-xs text-secondary">事件 {event.id+1} / {events.length}{cancelAfter!==null?' · 已取消轨迹':''}</span></div>
        <label className="mt-3 block text-xs text-secondary">跳转事件<select aria-label="跳转事件" className={input} value={event.id} onChange={e=>jump(Number(e.target.value))}>{events.map(e=><option value={e.id} key={e.id}>{e.id+1}. {e.title}</option>)}</select></label>
        <div className="my-3 flex flex-wrap gap-2">
          <button className="button-primary" disabled={reduced||dirty||pending||step>=events.length-1} onClick={()=>setPlaying(p=>!p)}>{playing?'暂停':'播放'}</button>
          <button className="button-secondary" disabled={!step} onClick={()=>jump(Math.max(0,step-1))}>上一步</button><button className="button-secondary" disabled={step>=events.length-1} onClick={()=>jump(Math.min(events.length-1,step+1))}>下一步</button>
          <button className="button-secondary" onClick={reset}>重新开始</button>
          <label className="flex items-center gap-2 text-xs text-secondary">速度<select aria-label="播放速度" className="min-h-11 rounded-lg border border-line bg-field px-2" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
        </div>
        <div className="mb-4 h-1 overflow-hidden rounded bg-raised" aria-hidden="true"><div className="journey-progress h-full bg-accent" style={{width:`${100*event.id/(events.length-1)}%`}}/></div>
        <div aria-live={playing?'off':'polite'} className="mb-4"><h3 className="text-base font-medium text-accent" data-testid="event-title">{event.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{event.detail}</p></div>
        {reduced&&<p className="mb-3 text-xs text-amber-200">已遵循“减少动态效果”：关闭自动播放，仍可单步和跳转。</p>}
        <TokenJourneyView key={`${c.model}-${event.id}-${event.kind}`} config={c} event={event}/>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button className="button-secondary" disabled={cancelAfter!==null||['stop','cancel','release'].includes(event.kind)||dirty||pending} onClick={()=>{setPlaying(false);setCancelAfter(event.id);setStep(event.id+1)}}>在此边界取消请求</button><p className="text-xs text-muted">取消只改变本次轨迹；刷新后恢复正常流程。</p></div>
        </fieldset>
      </section>
    </div>
    <details className={`${panel} mt-5`}><summary className="min-h-11 cursor-pointer py-2 font-medium">缓存与并行 · 数值依据</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      {[
        ['每 rank Q / KV heads',`${s.localQHeads} / ${s.localKvHeads}`],['KV heads 跨 TP 复制倍数',`${s.kvReplication}×`],['引用页空余槽位 / 序列',String(s.paddingPositions)],['结束后保留的完整提示位置',String(event.retained)],['每 rank 保留前缀载荷',bytes(s.retainedBytes)],['本轮指定 Decoder 归约次数',String(s.decoderReductions)],
      ].map(([label,value])=><div key={label} className="rounded-lg border border-line p-3"><dt className="text-secondary">{label}</dt><dd className="mt-1 font-mono" data-testid={label}>{value}</dd></div>)}
    </dl><div className="mt-4 space-y-2 text-sm leading-6 text-secondary"><p>有效载荷 = 2（K、V）× Batch × KV 位置 × 每 rank KV heads × head_dim × 层数 × 2 字节（BF16）。引用页容量将每条请求的位置数向上对齐到页大小；不做跨请求共享页去重。</p><p>TP 大于 KV heads 时，基线会复制 KV heads；不能继续用总 KV / TP 估算。归约计数只覆盖常规行并行的 Attention O 和 MLP down 投影：每 forward 为 2 × 层数，TP=1 时为 0，不是后端实际通信 kernel 总数。</p><p>请求结束后可复用页，不代表设备内存池缩小。前缀保留与本请求引用分开计量；其他请求、既有共享缓存和内存管理元数据均不在范围内。</p></div></details>
    <details className={`${panel} mt-5`}><summary className="min-h-11 cursor-pointer py-2 font-medium">教学边界与延伸阅读</summary><div className="mt-3 space-y-3 text-sm leading-6 text-secondary"><p>同长度、同结束时刻的合成 Batch；不是连续批处理调度器。仅演示 Dense GQA 自回归路径，不覆盖 PP、EP、Attention DP、推测解码、完整前缀命中、跨请求前缀页共享或硬件延迟。页保留是一种明确的教学策略，不代表所有推理后端的实现。</p><p>生成 G 个输出通常只需要 G−1 次 Decode：首个来自 Prefill。停止时 KV 位置为 P+G−1，最后采样的 Token 尚未被下一次 forward 消费。EOS 在这里计入输出序号；实际服务可能不向用户展示 EOS 文本。</p><p>动画仅表示事件顺序和新 KV 写入，不是设备时钟。模型未实际运行，Token 是位置标记。参数仅在 URL 中；不使用本地存储、账号或上传接口。</p><div className="flex flex-wrap gap-3"><Link className="text-accent underline" to={`/models/${c.model}?view=cache`}>模型缓存计算器</Link><Link className="text-accent underline" to="/operators/guide">Profiling 阅读教学</Link><a className="text-accent underline" target="_blank" rel="noreferrer" href="https://huggingface.co/docs/transformers/v4.50.0/en/cache_explanation">Transformers：KV Cache 与生成循环 ↗</a></div></div></details>
  </>
}

export default function TokenJourney(){
  const {search}=useLocation(),[,setSearch]=useSearchParams()
  const parsed=useMemo(()=>{try{return {config:readJourneyQuery(search),error:''}}catch(e){return {config:null,error:(e as Error).message}}},[search])
  useEffect(()=>{const old=document.title;document.title='一个 Token 的执行旅程 · AI Infra Space';return ()=>{document.title=old}},[])
  return <div className="page-container py-6 text-ink [&_button:disabled]:opacity-50 [&_input:disabled]:opacity-50 [&_.page-heading]:mb-3 [&_.page-heading]:pb-4 [&_.page-heading__description]:mt-2"><ModelSectionNav compact/><PageHeader compact eyebrow="AUTOREGRESSIVE INFERENCE" title="一个 Token 的执行旅程" description="单步观察 Prefill、Decode 与 KV 生命周期。"/><p className="mb-4 text-xs leading-5 text-secondary">本地教学模拟 · 结果可复算 · 不预测吞吐或延迟</p>{parsed.config?<Journey key={search} config={parsed.config}/>:<section className={panel} role="alert"><h2>参数无法使用</h2><p className="my-3 text-secondary">{parsed.error}</p><button className="button-primary" onClick={()=>setSearch(writeJourneyQuery(defaultJourney))}>重置为默认参数</button></section>}</div>
}
