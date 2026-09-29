import { getModelArchitecture } from '../data/models.ts'
import { cacheEstimate, cacheKvHeads } from './model-lab.ts'
import type { TensorParallelSize } from '../types/model'

export const tokenJourneyVersion='token-journey/1'
export const journeyModels=['qwen3-8b','llama-3-1-8b'] as const
export type JourneyConfig={model:string;batch:number;prompt:number;output:number;chunk:number;tp:number;prefix:number;block:number;eosAt:number;retention:'free'|'prefix'}
export const defaultJourney:JourneyConfig={model:'qwen3-8b',batch:1,prompt:8,output:4,chunk:8,tp:1,prefix:0,block:4,eosAt:0,retention:'free'}
export const journeyKeys=Object.keys(defaultJourney) as (keyof JourneyConfig)[]
export function validateJourney(c:JourneyConfig){
  if(!journeyModels.includes(c.model as typeof journeyModels[number]))throw new Error('此教学路径只覆盖 Qwen3-8B 与 Llama 3.1 8B 的 Dense / GQA 基线。')
  for(const [key,min,max] of [['batch',1,8],['prompt',1,64],['output',1,16],['chunk',1,64],['tp',1,64],['prefix',0,63],['block',1,32],['eosAt',0,16]] as const){
    if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw new Error(`${key} 必须是 ${min}–${max} 的整数。`)
  }
  const m=getModelArchitecture(c.model)!
  if(!m.supportedTp.includes(c.tp as TensorParallelSize))throw new Error('该模型的 32 个 Q heads 不支持此 TP 分片；可选 1、2、4、8、16、32。')
  if(c.prefix>=c.prompt)throw new Error('复用前缀须短于提示；本演示至少重新计算一个提示位置以取得末位置 logits。')
  if(![1,4,8,16,32].includes(c.block))throw new Error('页大小可选 1、4、8、16、32。')
  if(c.prefix%c.block!==0)throw new Error('本教学基线仅复用完整页；前缀长度须能被页大小整除。')
  if(c.eosAt>c.output)throw new Error('EOS 输出序号不能超过最大新 Token 数。')
  if(!['free','prefix'].includes(c.retention))throw new Error('未知的请求结束缓存策略。')
}
export function readJourneyQuery(search:string):JourneyConfig{
  const q=new URLSearchParams(search),c={...defaultJourney}
  for(const k of q.keys())if(!['v',...journeyKeys].includes(k)||q.getAll(k).length!==1)throw new Error('链接包含未知或重复参数。')
  if(q.has('v')&&q.get('v')!=='1')throw new Error('不支持此 Token 旅程参数版本。')
  for(const k of journeyKeys){const v=q.get(k);if(v===null)continue;if(typeof c[k]==='number'){if(!/^\d+$/.test(v))throw new Error(`${k} 不是有效整数。`);Object.assign(c,{[k]:Number(v)})}else Object.assign(c,{[k]:v})}
  validateJourney(c);return c
}
export function writeJourneyQuery(c:JourneyConfig){validateJourney(c);return new URLSearchParams([['v','1'],...journeyKeys.map(k=>[k,String(c[k])])]).toString()}
export type JourneyKind='queued'|'admit'|'prefill'|'sample'|'decode'|'stop'|'cancel'|'release'
export type JourneyEvent={id:number;kind:JourneyKind;title:string;detail:string;kv:number;generated:number;retained:number;past:number;input:number;inputStart:number;newOutput:number;reason:string}
export function buildJourney(c:JourneyConfig,cancelAfter:number|null=null){
  validateJourney(c)
  const events:JourneyEvent[]=[]
  let kv=0,generated=0
  const add=(kind:JourneyKind,title:string,detail:string,more:Partial<JourneyEvent>={})=>events.push({id:events.length,kind,title,detail,kv,generated,retained:0,past:kv,input:0,inputStart:0,newOutput:0,reason:'',...more})
  add('queued','请求排队','尚未准入，本请求没有持有 KV 引用。既有前缀缓存的池内占用不在这个请求视图中。')
  kv=c.prefix
  add('admit','调度准入',c.prefix?`附着 ${c.prefix} 个已计算的提示位置；仅复用 KV，不代表跳过后续新位置的计算。`:'进入同长度教学批次；后续按照因果依赖执行。此处不模拟服务队列策略或等待时长。')
  while(kv<c.prompt){
    const past=kv,input=Math.min(c.chunk,c.prompt-kv);kv+=input
    add('prefill',`Prefill · P${past+1}–P${kv}`,`处理 ${input} 个新提示位置，读取已有 ${past} 个 KV 位置。${kv<c.prompt?'提示尚未处理完，不产生用户可见输出。':'提示处理完成；下一事件从最后位置 logits 采样首个输出。'}`,{past,input,inputStart:past})
  }
  const target=c.eosAt||c.output
  for(let g=1;g<=target;g++){
    if(g>1){const past=kv;kv++;add('decode',`Decode · 消费 G${g-1}`,`将上一轮采样出的 G${g-1} 送入模型。每条请求仅新增一个输入位置，不重算历史 K/V。`,{past,input:1,inputStart:past})}
    generated=g
    add('sample',`采样 · 输出 G${g}${c.eosAt===g?'（EOS）':''}`,`采样结果成为输出 Token，但当前 KV 仍为 ${kv} 个位置。${g<target?'它将在下一次 Decode 中被消费。':'已达停止条件，不再消费这个最后输出。'}`,{newOutput:g})
  }
  add('stop',c.eosAt?'遇到 EOS':'达到生成长度上限','停止新 forward。最后一个输出尚无 KV；输出序号包含 EOS（若启用）。',{reason:c.eosAt?'eos':'length'})
  function release(list:JourneyEvent[],previous:JourneyEvent){
    const retained=c.retention==='prefix'?Math.floor(Math.min(previous.kv,c.prompt)/c.block)*c.block:0
    return [...list,{id:list.length,kind:'release' as const,title:'请求结束 · 释放引用',detail:retained?`本请求引用清零；本轨迹的 ${retained} 个完整提示位置交由缓存管理器保留。其余页可供复用，不表示设备内存归还操作系统。`:'本请求引用清零；本轨迹不新增前缀保留。已有共享前缀、其他请求和底层内存池不在此统计范围。',kv:0,generated:previous.generated,retained,past:0,input:0,inputStart:0,newOutput:0,reason:previous.reason}]
  }
  if(cancelAfter!==null){
    if(!Number.isInteger(cancelAfter)||cancelAfter<0||cancelAfter>=events.length||['stop','cancel','release'].includes(events[cancelAfter].kind))throw new Error('只能在尚未停止的事件边界取消。')
    const previous=events[cancelAfter],cancelled={...previous,id:cancelAfter+1,kind:'cancel' as const,title:'取消请求',detail:'在该事件完成后的安全边界取消；不再执行剩余 forward 或采样。真实服务仍需等待在途设备工作安全结束。',input:0,newOutput:0,reason:'cancel'}
    return release([...events.slice(0,cancelAfter+1),cancelled],cancelled)
  }
  return release(events,events.at(-1)!)
}
export function journeySnapshot(c:JourneyConfig,e:JourneyEvent){
  validateJourney(c)
  const model=getModelArchitecture(c.model)!,d=model.dimensions,tp=c.tp as TensorParallelSize
  const payload=(positions:number)=>cacheEstimate(model,{phase:'decode',batch:c.batch,sequence:positions,tp,cacheBytes:2}).perRankBytes
  const heads=cacheKvHeads(model,tp),pagePositions=Math.ceil(e.kv/c.block)*c.block
  const forward=e.kind==='prefill'||e.kind==='decode',n=c.batch*e.input
  return {model,forward,n,localQHeads:d.attentionHeads/tp,localKvHeads:heads,kvReplication:heads*tp/d.kvHeads,
    payloadBytes:payload(e.kv),pageBytes:payload(pagePositions),paddingPositions:pagePositions-e.kv,retainedBytes:payload(e.retained),
    causalPairs:forward?c.batch*(d.attentionHeads/tp)*(e.input*e.past+e.input*(e.input+1)/2):0,
    shapes:forward?{
      ids:`[${c.batch}, ${e.input}]`,hidden:`[${n}, ${d.hiddenSize}]`,q:`[${c.batch}, ${d.attentionHeads/tp}, ${e.input}, ${d.headDim}]`,
      newKv:`[${c.batch}, ${heads}, ${e.input}, ${d.headDim}]`,cache:`[${c.batch}, ${heads}, ${e.kv}, ${d.headDim}]`,
      scores:`[${c.batch}, ${d.attentionHeads/tp}, ${e.input}, ${e.kv}]`,ffn:`[${n}, ${d.intermediateSize/tp}]`,
      logits:e.kind==='decode'||e.kv===c.prompt?`[${c.batch}, ${d.vocabSize}]`:'本轮不采样',
    }:null,
    decoderReductions:forward&&tp>1?2*d.layers:0,
  }
}
