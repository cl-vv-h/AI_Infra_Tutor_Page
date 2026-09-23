import { useState } from 'react'
import { Activity, ArrowUpRight, Download, RotateCcw } from 'lucide-react'
import { compareMeasurement, defaultEstimate, estimateRuntime, estimatorVersion, hardwareProfiles, hardwareSources, operatorNames, type EstimateInput, type Operator, type Precision } from '@/lib/operator-estimator'

const fieldClass = 'mt-1.5 w-full min-w-0 rounded-lg border border-white/15 bg-[#0b121b] px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none'
const panelClass = 'min-w-0 rounded-2xl border border-white/10 bg-[#0e1620] p-4 sm:p-5'
const number = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
const time = (n: number) => `${number(n)} µs`
type NumericKey = { [K in keyof EstimateInput]: EstimateInput[K] extends number ? K : never }[keyof EstimateInput]

export default function OperatorEstimator() {
  const [hardwareId,setHardwareId] = useState('910c')
  const [form,setForm] = useState(() => Object.fromEntries(Object.entries(defaultEstimate()).map(([k,v])=>[k,typeof v === 'number' ? String(v) : v])) as Record<keyof EstimateInput,string|boolean>)
  const [measured,setMeasured] = useState('')
  const [unit,setUnit] = useState('us')
  const [downloadStatus,setDownloadStatus] = useState('')
  const hardware = hardwareProfiles.find(h=>h.id===hardwareId)!
  const defaults = defaultEstimate()
  const input = Object.fromEntries(Object.entries(form).map(([k,v])=>[k,typeof defaults[k] === 'number' ? (String(v).trim() ? Number(v) : NaN) : v])) as unknown as EstimateInput
  const patch = (values: Partial<EstimateInput>) => {
    setForm(previous=>({...previous,...Object.fromEntries(Object.entries(values).map(([k,v])=>[k,typeof v === 'number' ? String(v) : v]))}))
    setDownloadStatus('')
  }
  let result: ReturnType<typeof estimateRuntime> | undefined, error = ''
  try { result = estimateRuntime(input) } catch (e) { error = (e as Error).message }
  let comparison: ReturnType<typeof compareMeasurement> | undefined, measurementError = ''
  if (measured.trim() && result) {
    try { comparison = compareMeasurement(result, Number(measured)*(unit==='ms'?1000:1)) } catch(e) { measurementError=(e as Error).message }
  }
  const chooseHardware = (id:string) => {
    const h = hardwareProfiles.find(p=>p.id===id)!
    const precision = h.cube[input.precision] ? input.precision : 'bf16'
    setHardwareId(id)
    patch({precision,cube:h.cube[precision],vector:h.vector,bandwidth:h.bandwidth,capacity:h.capacity})
    setMeasured('')
  }
  const chooseOperator = (operator:Operator) => {
    const precision = operator==='matmul' ? input.precision : 'bf16'
    patch({operator,precision,cube:hardware.cube[precision]})
    setMeasured('')
  }
  const field = (key:NumericKey,label:string,hint?:string,step='1') => (
    <label key={key} className="block min-w-0 text-xs text-slate-300">{label}
      <input type="number" step={step} aria-label={label} value={String(form[key])} onChange={e=>{setForm(p=>({...p,[key]:e.target.value}));setDownloadStatus('')}} className={fieldClass} />
      {hint && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{hint}</span>}
    </label>
  )
  const check = (key:'causal'|'materialize'|'broadcastB',label:string) => (
    <label className="flex items-start gap-2 text-xs leading-5 text-slate-300"><input className="mt-1 accent-cyan-300" type="checkbox" checked={Boolean(form[key])} onChange={e=>patch({[key]:e.target.checked})} />{label}</label>
  )
  const exportResult = () => {
    if (!result) return
    // Deliberate whitelist: no local path, hostname, identifiers, raw profile or measured data.
    const blob = new Blob([JSON.stringify({schema:'operator-estimate',version:estimatorVersion,hardwareId,input,result,notice:'Analytical scenario, not a benchmark. No profiling measurement exported.'},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob), a=document.createElement('a')
    a.href=url; a.download='operator-estimate.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
    setDownloadStatus('已导出参数与估算，不包含实测值。')
  }
  const shapes = input.operator==='matmul' ? <>
    {field('batch','Batch B')}{field('m','M · 输出行数')}{field('n','N · 输出列数')}{field('k','K · 归约维度')}
  </> : input.operator==='indexer' ? <>
    {field('batch','Batch B')}{field('queries','Query 长度 Q')}{field('sequence','Key 候选长度 S')}{field('heads','Indexer heads H')}{field('dim','Head dim D')}{field('topk','Top-K')}
  </> : <>{field('rows','输入行数 R')}{field('width','行宽 D')}{input.operator==='gather' && field('selected','索引数 Rselected')}</>

  return <div className="mx-auto max-w-[1440px] px-4 py-8 text-slate-200 sm:px-8 lg:px-12">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-cyan-300"><Activity size={15}/> OPERATOR / PERFORMANCE</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">算子耗时估算</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">从 shape 到计算量、访存量与耗时情景，辅助核对 profiling。单执行域建模，不是硬件实测或性能保证。</p>
      </div>
      <button className="flex items-center gap-2 text-xs text-slate-400 hover:text-white" onClick={()=>{setHardwareId('910c');patch(defaultEstimate());setMeasured('');setUnit('us')}}><RotateCcw size={14}/>重置全部</button>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <div className="min-w-0 space-y-4">
        <section className={panelClass} aria-label="硬件与算子输入">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-slate-300">硬件配置<select aria-label="硬件配置" className={fieldClass} value={hardwareId} onChange={e=>chooseHardware(e.target.value)}>{hardwareProfiles.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label className="text-xs text-slate-300">算子类型<select aria-label="算子类型" className={fieldClass} value={input.operator} onChange={e=>chooseOperator(e.target.value as Operator)}>{Object.entries(operatorNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200/10 bg-amber-200/[0.04] p-3 text-xs leading-5 text-amber-100/80">
            {hardware.note} {hardware.source && <a className="underline underline-offset-4" href={hardware.source} target="_blank" rel="noreferrer">核查来源 ↗</a>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="min-w-40 text-xs text-slate-300">输入精度<select aria-label="输入精度" className={fieldClass} value={input.precision} onChange={e=>{const precision=e.target.value as Precision;patch({precision,cube:hardware.cube[precision]});setMeasured('')}}>
              {(input.operator==='matmul' ? Object.keys(hardware.cube) : ['bf16','fp16']).map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select></label>
            <span className="text-xs text-slate-500">shape 为本地逻辑维度；不自动除以 TP/EP。</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{shapes}</div>
          <div className="mt-4 space-y-2">
            {input.operator==='matmul' && check('broadcastB','Batch 共享同一份 B 权重')}
            {input.operator==='indexer' && <>{check('causal','右对齐 causal：只计算有效 Query–Key 对')}{check('materialize','将聚合 score [B,Q,S] 写入 HBM，再由 Top-K 读取')}</>}
          </div>
          {input.operator==='indexer' && hardwareId.startsWith('950') && ![8,16,24,32,64].includes(input.heads) && <p role="status" className="mt-3 text-xs text-amber-200">所引用 950 接口仅支持 H = 8 / 16 / 24 / 32 / 64；此处仍可进行算法层估算。</p>}
        </section>
        <details className={panelClass}>
          <summary className="cursor-pointer text-sm font-medium text-white">硬件参数与校准假设 <span className="ml-2 text-xs font-normal text-slate-500">效率 / 带宽 / 固定开销</span></summary>
          <p className="mt-3 text-xs leading-5 text-slate-400">所有值可编辑。效率、Top-K 吞吐与固定开销均为情景假设，未由实机拟合；请使用同设备、同 CANN、同 dtype/shape 的独立基准校准，再分析其他样本。</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {field('bandwidth','HBM 带宽 GB/s','十进制 GB/s，不是互联带宽','any')}
            {field('capacity','可用容量 GB','默认标称容量；需扣除其他驻留数据','any')}
            {input.operator!=='gather' && input.operator!=='rmsnorm' && input.operator!=='softmax' && field('cube',input.precision==='int8'?'Cube 峰值 TOP/s':'Cube 峰值 TFLOP/s','对应当前输入精度','any')}
            {input.operator!=='gather' && input.operator!=='matmul' && field('vector','Vector FP32 TFLOP/s','不能使用 Cube 峰值替代','any')}
            {(input.operator==='matmul'||input.operator==='indexer') && field('computeEfficiency','Cube 有效效率','0 < η ≤ 1；含 tiling / 占用损失','any')}
            {field('memoryEfficiency','HBM 有效效率','0 < η ≤ 1；Gather 通常需要更低值','any')}
            {(input.operator==='indexer'||input.operator==='rmsnorm'||input.operator==='softmax') && field('vectorEfficiency','Vector 有效效率','0 < η ≤ 1；含归约及特殊指令损失','any')}
            {input.operator==='indexer' && field('selectionRate','Top-K 选择吞吐 Gcmp/s','算法成本代理的有效吞吐，非硬件规格','any')}
            {field('overhead','设备固定开销 µs','算子范围内调度/同步开销；非 Host API 时间','any')}
            {field('trafficFactor','流量放大系数','≥ 1；额外重读、padding 与布局转换','any')}
          </div>
        </details>
        <section className={panelClass} aria-label="Profiling 对照">
          <h2 className="text-sm font-medium text-white">与 profiling 实测对照</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">填写预热后的同 shape 设备侧耗时中位数。Indexer 应覆盖打分与 Top-K；不使用 Host API 时间、排队时间或多次调用总和。</p>
          <div className="mt-3 flex items-end gap-3">
            <label className="min-w-0 flex-1 text-xs">实测耗时<input className={fieldClass} type="number" min="0" step="any" value={measured} placeholder="例如 120" onChange={e=>setMeasured(e.target.value)} /></label>
            <label className="text-xs">时间单位<select aria-label="时间单位" className={fieldClass} value={unit} onChange={e=>setUnit(e.target.value)}><option value="us">µs</option><option value="ms">ms</option></select></label>
          </div>
          {measurementError && <p className="mt-3 text-sm text-rose-300" role="alert">{measurementError}</p>}
          {comparison && <div className="mt-4 rounded-xl bg-white/5 p-3" role="status" data-testid="runtime-comparison"><p className="text-lg text-cyan-200">实测 / 情景中心值：{number(comparison.ratio)}×</p><p className="mt-2 text-xs leading-6 text-slate-300">{comparison.description}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">按实测时间反推：矩阵吞吐 {number(comparison.achievedCubeTops)} {input.precision==='int8'?'TOP/s':'TFLOP/s'} · 逻辑带宽 {number(comparison.logicalBandwidth)} GB/s。来自逻辑工作量，不是硬件计数器实测带宽。</p></div>}
          <p className="mt-3 text-[11px] leading-5 text-slate-500">仅在本页内存中处理；不上传、不写入 URL、不持久保存实测值。</p>
        </section>
      </div>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20" aria-label="耗时估算结果" aria-live="polite">
        <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-950/60 to-[#0e1620] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200"><span>分析模型 · 未经实机校准</span><span>{hardware.scope}</span></div>
          {error ? <p role="alert" className="mt-5 text-sm text-rose-200">{error}</p> : result && <>
            <p className="mt-6 text-xs text-slate-400">耗时情景区间 · 非统计置信区间</p>
            <p className="mt-2 break-words text-3xl font-semibold tracking-tight text-white" data-testid="runtime-range">{number(result.lower)}–{time(result.upper)}</p>
            <p className="mt-2 text-xs text-slate-400">中心值 <span data-testid="runtime-central">{time(result.central)}</span> · 当前主导项：{result.bottleneck}</p>
            {!result.fitsMemory && <p role="alert" className="mt-3 rounded-lg bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">所列张量超过可用容量，无法按当前基线一次驻留。请调整 shape 或分块；此时不进行性能异常判定。</p>}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
              <div><p className="text-slate-500">HBM 驻留资源下界</p><p className="mt-1 text-white">{time(result.resourceFloor)}</p></div>
              <div><p className="text-slate-500">逻辑输入输出与中间量</p><p className="mt-1 text-white">{number(result.workload.footprint/2**20)} MiB</p></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">下界未含 Top-K 选择、固定开销及特殊指令延迟；缓存驻留时 HBM 假设不成立。区间上下端分别采用乐观重叠与保守串行情景。</p>
          </>}
        </div>
        {result && <section className={panelClass}>
          <h2 className="text-sm font-medium text-white">成本分解</h2>
          <div className="mt-3 space-y-3 text-xs">{Object.entries({ 'Cube 计算':result.parts.cube,'Vector 基础计算':result.parts.vector,'Top-K 选择代理':result.parts.selection,'HBM 搬运':result.parts.memory,'设备固定开销':input.overhead }).filter(([,v])=>Number(v)>0).map(([label,value])=><div key={label}>
            <div className="flex justify-between gap-3"><span className="text-slate-400">{label}</span><span>{time(Number(value))}</span></div>
            <div className="mt-1.5 h-1 rounded-full bg-white/5"><div className="h-1 rounded-full bg-cyan-300/60" style={{width:`${Math.min(100,100*Number(value)/result.central)}%`}}/></div>
          </div>)}</div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Cube {number(result.workload.cubeOps/1e9)} Gops · Vector {number(result.workload.vectorOps/1e9)} Gops · 估计流量 {number(result.workload.bytes*input.trafficFactor/2**20)} MiB。各项可重叠，不应直接相加解释中心值。</p>
          <button onClick={exportResult} className="mt-4 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs hover:border-cyan-300"><Download size={14}/>导出估算 JSON</button>
          {downloadStatus && <p role="status" className="mt-2 text-xs text-cyan-200">{downloadStatus}</p>}
        </section>}
      </aside>
    </div>
    {result && <details className={`${panelClass} mt-5`}>
      <summary className="cursor-pointer text-sm font-medium text-white">计算口径、限制与排查建议</summary>
      <div className="mt-4 grid gap-6 text-xs leading-6 lg:grid-cols-2">
        <div><h2 className="font-medium text-cyan-200">Shape 与公式</h2><div className="mt-2 space-y-1 break-words font-mono text-slate-300">{result.workload.shapes.map(s=><p key={s}>{s}</p>)}</div>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-slate-400">{result.workload.formulas.map(s=><li key={s}>{s}</li>)}<li>中心值 = max(Tcube, Tvector + Ttopk, Thbm) + Tfixed。各资源耗时 = 工作量 / (峰值 × 有效效率)。</li><li>区间下端：效率提高 25%（不超过 100%）且资源重叠；上端：效率降至 60%，各项串行相加。该区间不是实际耗时的保证上下界。</li></ul>
        </div>
        <div><h2 className="font-medium text-amber-200">适用范围</h2><ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">{result.warnings.map(s=><li key={s}>{s}</li>)}<li>不含跨设备通信、Host 调度、编译、在线量化；不模拟 Cache、tiling、实际 kernel 数与多流竞争。只有 shape 不能唯一确定真实时间。</li><li>先核对设备/die、精度、布局、shape 与采样范围，再看 Cube/Vector/MTE 利用率、访存、同步与争用。利用率只能提供线索，不能单独确定根因。</li></ul></div>
      </div>
    </details>}
    <details className={`${panelClass} mt-4`}>
      <summary className="cursor-pointer text-sm font-medium text-white">来源与 profiling 使用说明</summary>
      <p className="mt-3 text-xs leading-6 text-slate-400">规格核查：2026-09-23。硬件峰值与 kernel 实测分开管理。需要流水线指标时，可使用 torch_npu profiler 的 Level1 + PipeUtilization；字段依 CANN/芯片版本而异，先核查 kernel_details 的 shape、任务耗时及指标是否完整。带宽和 Cache 分析通常需要相应的 Memory/L2Cache 采集组。不要将多 kernel 时间简单求和当成存在重叠时的端到端时延。</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-cyan-200">{Object.entries({'950 架构白皮书 · 表 3-1':hardwareSources.ascend950,'910C 双 die 说明':hardwareSources.ascend910,'Lightning Indexer 接口':hardwareSources.indexer,'CANN Profiling 指标':hardwareSources.profiler}).map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">{label}<ArrowUpRight size={12}/></a>)}</div>
    </details>
    {result && <div className="sticky bottom-3 z-20 mt-5 flex items-center justify-between gap-3 rounded-xl border border-cyan-300/30 bg-[#10212c]/95 p-3 shadow-xl backdrop-blur lg:hidden" aria-label="移动端结果摘要"><span className="text-xs text-slate-400">{result.fitsMemory?'情景区间':'容量超限 · 数学估算'}</span><span className="text-sm font-medium text-cyan-100">{number(result.lower)}–{time(result.upper)}</span></div>}
  </div>
}
