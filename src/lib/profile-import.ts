import type { ProfileData, TaskKind } from './profile-analysis.ts'
import type { Counter, PipeMetric, Phase } from './profile-diagnostics.ts'
export const profileLimits={bytes:50*1024*1024,events:200000,groups:20000}
export type TimeUnit='auto'|'us'|'ms'|'ns'
const clean=(v:unknown)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v).trim()
const missing=(s:string)=>/^(n\/?a|none|null|undefined|-)$/i.test(s)?'':s
const canonical=(v:unknown)=>missing(clean(v)).replace(/\s/g,'').replace(/\],\[/g,';').replace(/[[\]]/g,'')
const list=(v:unknown)=>canonical(v).replace(/["']/g,'').replace(/,/g,';')
const key=(s:string)=>s.toLowerCase().replace(/[\s_-]/g,'').replace(/[µμ]/g,'u')
const phaseOf=(v:unknown):Phase|undefined=>/^(prefill|decode)$/i.test(clean(v))?clean(v).toLowerCase() as Phase:undefined
const counterAliases:Record<PipeMetric,string[]>={cube:['aic_mac_ratio','aic_cube_ratio'],vector:['aiv_vec_ratio'],aicMte2:['aic_mte2_ratio'],aivMte2:['aiv_mte2_ratio'],aicScalar:['aic_scalar_ratio'],aivScalar:['aiv_scalar_ratio']}
function counters(fields:Record<string,unknown>) {
  const out:Partial<Record<PipeMetric,Counter>>={}
  for(const [metric,aliases] of Object.entries(counterAliases))for(const [field,raw] of Object.entries(fields)) {
    const normalized=key(field),explicit=normalized.endsWith('(%)')||normalized.endsWith('%')
    if(!aliases.some(alias=>key(alias)===normalized.replace(/\(%\)$|%$/,'')))continue
    const str=clean(raw),value=finite(str.replace(/%$/,''))
    if(value!==undefined&&!(metric in out))out[metric as PipeMetric]={value,percent:explicit||str.endsWith('%')}
  }
  return out
}
function finite(v:unknown) {
  let s=clean(v)
  if(s.includes(',')){if(!/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))return undefined;s=s.replace(/,/g,'')}
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return undefined
  const n=Number(s);return Number.isFinite(n)?n:undefined
}
function kindOf(type:string,task:string):TaskKind {
  const s=`${type} ${task}`.toLowerCase()
  if(/hccl|allreduce|allgather|alltoall|reducescatter|broadcast|communication|notifywait|notifyrecord/.test(s))return 'communication'
  if(/memcpy|memset|memorycopy/.test(s))return 'copy'
  if(/ai[_ ]?(core|vector|cpu)|aiv|aic|cube|vector|matmul|gemm|norm|softmax|attention|indexer|add|mul|gather/.test(s))return 'compute'
  return 'other'
}
export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false
  text=text.replace(/^\uFEFF/,'')
  for(let i=0;i<text.length;i++) {
    const c=text[i]
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c}
    else if(c==='"'){if(field.trim()||closed)throw new Error('CSV 引号结构无效。');quoted=true;field=''}
    else if(c===','||c==='\n'||c==='\r'){
      row.push(field);field='';closed=false
      if(c!==','){if(row.some(v=>v.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}
    } else {if(closed&&!/\s/.test(c))throw new Error('CSV 引号后存在非法字符。');if(!closed)field+=c}
    if(field.length>16384)throw new Error('CSV 单字段过长；请移除调用栈等非分析列。')
    if(rows.length>profileLimits.events+1)throw new Error('最多支持 200000 行任务，请缩小采样窗口。')
  }
  if(quoted)throw new Error('CSV 引号未闭合，文件可能被截断。')
  row.push(field);if(row.some(v=>v.trim()))rows.push(row)
  return rows
}
function timeScale(header:string,fallback:TimeUnit) {
  const h=key(header)
  const unit=/\((ns|us|ms|s)\)/.exec(h)?.[1]??(/(?:time|duration)(ns|us|ms)$/.exec(h)?.[1])
  if(unit)return {ns:.001,us:1,ms:1000,s:1e6}[unit]
  if(fallback==='auto')throw new Error(`时间列「${header}」没有明确单位；请选择无单位列的时间单位。`)
  return {ns:.001,us:1,ms:1000}[fallback]
}
function checkEvents(data:ProfileData):ProfileData {
  if(!data.events.length)throw new Error('未找到有效设备任务；请导入 kernel_details / op_summary CSV 或包含设备层的 Chrome Trace JSON。')
  if(data.events.length>profileLimits.events)throw new Error('最多支持 200000 个设备任务，请缩小采样窗口。')
  const groups=new Set(data.events.map(e=>JSON.stringify([e.type,e.shape,e.dtype,e.format])))
  if(groups.size>profileLimits.groups)throw new Error('分组超过 20000；请缩小范围或使用有明确 OP Type 的采样。')
  if(data.skipped)data.warnings.push(`已跳过 ${data.skipped} 条无效或非设备记录；不会用 0 填补缺失耗时。`)
  if(data.events.some(e=>(e.start??0)>1e12))data.warnings.push('原始时间戳较大，亚微秒精度可能存在浮点舍入。分析仅在同一设备域内进行。')
  return data
}
function parseKernelCsv(text:string,unit:TimeUnit):ProfileData {
  const [headers,...rows]=parseCsv(text)
  if(!headers||!rows.length)throw new Error('CSV 为空或没有任务记录。')
  const normalized=headers.map(key)
  if(new Set(normalized).size!==normalized.length)throw new Error('CSV 存在重复列名，无法安全确定字段。')
  const col=(...names:string[])=>normalized.findIndex(h=>names.some(n=>h===key(n)))
  const timeCol=(stem:string[])=>normalized.findIndex(h=>stem.some(s=>h===s||new RegExp(`^${s}\\((us|ns|ms|s)\\)$`).test(h)))
  const name=col('Name','OP Name','OpName','Kernel Name'),type=col('Type','OP Type','OpType','Kernel Type')
  const duration=timeCol(['duration','taskduration']),start=timeCol(['starttime','taskstarttime']),count=col('Count','Calls')
  if(duration<0||name<0&&type<0)throw new Error('需要 Name / OP Type 与 Duration(us) / Task Duration(us) 列。不能用 aicore_time、Wait Time、API 时间或 op_statistic 汇总代替逐任务耗时。')
  const durationScale=timeScale(headers[duration],unit),startScale=start<0?1:timeScale(headers[start],unit)
  const device=col('Device ID','Device_id','Device'),stream=col('Stream ID','Stream_id','Stream'),step=col('Step ID','Step Id','Step'),shape=col('Input Shapes'),dtype=col('Input Data Types','Input Data Type','Input Dtypes'),format=col('Input Formats','Input Format'),task=col('Task Type','Accelerator Core')
  const rank=col('Rank ID','Rank'),phase=col('Phase','Inference Phase')
  const data:ProfileData={events:[],source:'csv',skipped:0,warnings:['CSV 应来自设备层逐任务表；不会自动推断硬件型号或采样阶段。']}
  for(const row of rows){
    if(row.length!==headers.length){data.skipped++;continue}
    if(count>=0&&(finite(row[count])??1)!==1)throw new Error('检测到 Count 非 1 的聚合行；请使用逐调用 kernel_details.csv，而非 op_statistic。')
    const d=finite(row[duration]),s=start<0?undefined:finite(row[start])
    const n=missing(clean(row[name])),t=missing(clean(row[type]))||n
    if(d===undefined||d<=0||d*durationScale>1e12||!t||(s!==undefined&&(s<0||s*startScale>Number.MAX_SAFE_INTEGER||s*startScale+d*durationScale<=s*startScale))){data.skipped++;continue}
    data.events.push({name:n||t,type:t,phase:phaseOf(row[phase]),counters:counters(Object.fromEntries(headers.map((h,i)=>[h,row[i]]))),shape:canonical(row[shape]),dtype:list(row[dtype]).toLowerCase(),format:list(row[format]).toUpperCase(),device:(rank>=0?`rank:${missing(clean(row[rank]))||'unknown'}/`:'')+(missing(clean(row[device]))||'未标注设备'),stream:missing(clean(row[stream]))||'未标注 stream',step:missing(clean(row[step])),duration:d*durationScale,start:s===undefined?undefined:s*startScale,kind:kindOf(t,clean(row[task]))})
  }
  return checkEvents(data)
}
function parseTrace(text:string):ProfileData {
  let root:unknown
  try {root=JSON.parse(text)}catch {throw new Error('JSON 无法解析；请检查 trace 是否被截断。')}
  const raw=Array.isArray(root)?root:(root as {traceEvents?:unknown})?.traceEvents
  if(!Array.isArray(raw))throw new Error('需要 Chrome Trace 数组或含 traceEvents 数组的 JSON。')
  if(raw.length>1000000)throw new Error('Trace 总事件超过 1000000，请缩小采样范围。')
  const hardwarePids=new Set<string>()
  for(const e of raw)if(e&&e.ph==='M'&&e.name==='process_name'&&/^(ascend hardware\b|gpu\b|device\s*\d+$)/i.test(clean(e.args?.name)))hardwarePids.add(clean(e.pid))
  const data:ProfileData={events:[],annotations:[],source:'trace',skipped:0,warnings:['Chrome Trace 的 ts / dur 按规范解释为 µs；displayTimeUnit 只影响显示，不改变事件单位。设备层完整 X 事件用于算子统计；Host 标记单独保存，需确认来源与时钟后用于阶段/调度计时。']}
  const annotationNames=new Set<string>()
  let unsupported=0
  for(const e of raw){
    if(!e||typeof e!=='object')continue
    const isDevice=hardwarePids.size?hardwarePids.has(clean(e.pid)):/^(kernel|gpu_kernel|gpu_memcpy|gpu_memset)$/i.test(clean(e.cat))
    if(!isDevice) {
      const s=finite(e.ts),d=finite(e.dur),name=clean(e.name)
      if(e.ph==='X'&&name&&s!==undefined&&d!==undefined&&s>=0&&d>0&&d<=1e12&&s<=Number.MAX_SAFE_INTEGER&&s+d>s) {
        if(name.length>16384)throw new Error('Trace 标记名称过长。')
        const source=`pid:${clean(e.pid)||'unknown'}/tid:${clean(e.tid)||'unknown'}`
        annotationNames.add(JSON.stringify([source,name]))
        if(annotationNames.size>5000||data.annotations!.length>=200000)throw new Error('Host 标记超过 200000 条或 5000 个名称/线程组合，请缩小采样。')
        data.annotations!.push({name,source,start:s,duration:d})
      }
      continue
    }
    if(e.ph!=='X'){if(e.ph==='B'||e.ph==='E')unsupported++;continue}
    const d=finite(e.dur),s=finite(e.ts),args=e.args&&typeof e.args==='object'?e.args:{}
    if(!clean(e.name)||d===undefined||d<=0||d>1e12||s===undefined||s<0||s>Number.MAX_SAFE_INTEGER||s+d<=s){data.skipped++;continue}
    const n=clean(e.name),t=clean(args['OP Type']??args['Op Type']??args['Type'])||n
    const fields=[n,t,clean(args['Input Shapes']),clean(args['Input Dims'])]
    if(fields.some(f=>f.length>16384))throw new Error('Trace 算子字段过长，请移除调用栈等非分析数据。')
    data.events.push({name:n,type:t,phase:phaseOf(args['Phase']),counters:counters(args),shape:canonical(args['Input Shapes']??args['Input Dims']),dtype:list(args['Input Data Types']??args['Input type']??args['Input Types']).toLowerCase(),format:list(args['Input Formats']).toUpperCase(),device:`pid:${clean(e.pid)||'unknown'}`,stream:clean(e.tid)||'未标注 stream',step:clean(args['Step ID']??args['Step Id']),duration:d,start:s,kind:kindOf(t,`${clean(args['Task Type'])} ${clean(e.cat)}`)})
  }
  if(unsupported)data.warnings.push(`设备层有 ${unsupported} 个 B/E 事件未配对，本版只支持完整 X 事件。`)
  return checkEvents(data)
}
export function importProfile(text:string,unit:TimeUnit='auto'):ProfileData {
  if(new TextEncoder().encode(text).byteLength>profileLimits.bytes)throw new Error('单文件上限 50 MiB，请先裁剪采样范围。')
  const trimmed=text.replace(/^\uFEFF/,'').trim()
  return /^[[{]/.test(trimmed)?parseTrace(trimmed):parseKernelCsv(trimmed,unit)
}
