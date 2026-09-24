import { useEffect, useRef, useState } from 'react'
import { emptyProfileFilter, type ProfileAnalysis, type ProfileFilter } from '@/lib/profile-analysis'
import { profileLimits, type TimeUnit } from '@/lib/profile-import'
import { defaultDiagnosticConfig, type DiagnosticConfig } from '@/lib/profile-diagnostics'
export function useProfileAnalysis() {
  const worker=useRef<Worker|null>(null),serial=useRef(0)
  const [analysis,setAnalysis]=useState<ProfileAnalysis|null>(null)
  const [filter,setFilter]=useState(emptyProfileFilter)
  const [config,setConfig]=useState(defaultDiagnosticConfig)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
  useEffect(()=>()=>worker.current?.terminate(),[])
  const clear=()=>{serial.current++;worker.current?.terminate();worker.current=null;setLoaded(false);setAnalysis(null);setError('');setBusy(false);setFilter(emptyProfileFilter());setConfig(defaultDiagnosticConfig())}
  const begin=()=>{
    clear();setBusy(true)
    const id=++serial.current
    const w=new Worker(new URL('../workers/profile-worker.ts',import.meta.url),{type:'module'})
    worker.current=w
    w.onmessage=({data})=>{
      if(data.id!==serial.current)return
      setBusy(false)
      if(data.error){setError(data.error);return}
      setError('');setAnalysis(data.analysis);setLoaded(true);setFilter(data.analysis.selectedFilter);setConfig(data.analysis.diagnostics.config)
    }
    w.onerror=()=>{if(worker.current===w){setBusy(false);setError('本地解析线程失败，请清空后重试或缩小文件。');setAnalysis(null)}}
    return {w,id}
  }
  const loadText=(text:string,unit:TimeUnit='auto')=>{const {w,id}=begin();w.postMessage({id,type:'load',text,unit})}
  const loadFile=async(file:File,unit:TimeUnit)=>{
    if(file.size>profileLimits.bytes){clear();setError('单文件上限 50 MiB，请先裁剪采样范围。');return}
    const {w,id}=begin()
    try{const text=await file.text();if(serial.current===id)w.postMessage({id,type:'load',text,unit})}
    catch {if(serial.current===id){setBusy(false);setError('无法读取文件。')}}
  }
  const updateFilter=(next:ProfileFilter)=>{
    setFilter(next);setError('');setAnalysis(null);setBusy(true)
    const nextConfig=next.device!==filter.device?{...config,manual:[],aligned:false}:config
    setConfig(nextConfig)
    worker.current?.postMessage({id:++serial.current,type:'analyze',filter:next,config:nextConfig})
  }
  const updateConfig=(next:DiagnosticConfig)=>{
    setError('');setBusy(true)
    worker.current?.postMessage({id:++serial.current,type:'analyze',filter,config:next})
  }
  return {analysis,filter,config,busy,error,loaded,loadText,loadFile,updateFilter,updateConfig,clear}
}
