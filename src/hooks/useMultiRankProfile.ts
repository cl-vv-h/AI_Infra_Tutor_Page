import { useEffect, useRef, useState } from 'react'
import type { RankComparison, RankConfig, RankInfo } from '@/lib/multi-rank-profile'
import type { TimeUnit } from '@/lib/profile-import'

export function useMultiRankProfile(){
  const worker=useRef<Worker|null>(null),serial=useRef(0)
  const [result,setResult]=useState<RankComparison|null>(null),[config,setConfig]=useState<RankConfig|null>(null),[info,setInfo]=useState<RankInfo[]>([])
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(''),[ignored,setIgnored]=useState(0)
  const [demo,setDemo]=useState<''|'straggler'|'clock'>('')
  useEffect(()=>()=>worker.current?.terminate(),[])
  const clear=()=>{serial.current++;worker.current?.terminate();worker.current=null;setResult(null);setConfig(null);setInfo([]);setBusy(false);setError('');setProgress('');setIgnored(0);setDemo('')}
  const begin=()=>{
    clear();setBusy(true);const id=++serial.current
    try{
      const w=new Worker(new URL('../workers/multi-rank-worker.ts',import.meta.url),{type:'module'});worker.current=w
      w.onmessage=({data})=>{
        if(data.id!==serial.current)return
        if(data.progress){setProgress(data.progress);return}
        setBusy(false);setProgress('')
        if(data.error){setResult(null);setError(data.error);return}
        setError('');setResult(data.result);setConfig(data.config)
        if(data.info){setInfo(data.info);setIgnored(data.ignored)}
      }
      w.onerror=()=>{if(worker.current===w){setBusy(false);setResult(null);setError('本地分析线程失败；请清空后重试。未上传任何数据。')}}
      return {w,id}
    }catch{setBusy(false);setError('无法创建本地分析线程；请检查浏览器权限。');return null}
  }
  const loadFiles=(files:File[],unit:TimeUnit)=>{const job=begin();if(job)job.w.postMessage({id:job.id,type:'files',files,unit})}
  const loadDemo=(kind:'straggler'|'clock')=>{const job=begin();if(job){setDemo(kind);job.w.postMessage({id:job.id,type:'demo',demo:kind})}}
  const analyze=(next:RankConfig)=>{if(!worker.current)return;setConfig(next);setResult(null);setError('');setBusy(true);worker.current.postMessage({id:++serial.current,type:'analyze',config:next})}
  return {result,config,info,busy,error,progress,ignored,demo,clear,loadFiles,loadDemo,analyze}
}
