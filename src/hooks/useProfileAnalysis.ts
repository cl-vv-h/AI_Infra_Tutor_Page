import { useEffect, useRef, useState } from 'react'
import { emptyProfileFilter, type ProfileAnalysis, type ProfileFilter } from '@/lib/profile-analysis'
import { type TimeUnit } from '@/lib/profile-import'
import { defaultDiagnosticConfig, type DiagnosticConfig } from '@/lib/profile-diagnostics'
export function useProfileAnalysis() {
  const worker=useRef<Worker|null>(null),serial=useRef(0)
  const [analysis,setAnalysis]=useState<ProfileAnalysis|null>(null)
  const [filter,setFilter]=useState(emptyProfileFilter)
  const [config,setConfig]=useState(defaultDiagnosticConfig)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
  const [progress,setProgress]=useState('')
  useEffect(()=>()=>worker.current?.terminate(),[])
  const clear=()=>{serial.current++;worker.current?.terminate();worker.current=null;setLoaded(false);setAnalysis(null);setError('');setBusy(false);setProgress('');setFilter(emptyProfileFilter());setConfig(defaultDiagnosticConfig())}
  const begin=()=>{
    clear();setBusy(true)
    const id=++serial.current
    const w=new Worker(new URL('../workers/profile-worker.ts',import.meta.url),{type:'module'})
    worker.current=w
    w.onmessage=({data})=>{
      if(data.id!==serial.current)return
      if(data.progress){setProgress(data.progress);return}
      setBusy(false)
      setProgress('')
      if(data.error){setError(data.error);return}
      setError('');setAnalysis(data.analysis);setLoaded(true);setFilter(data.analysis.selectedFilter);setConfig(data.analysis.diagnostics.config)
    }
    w.onerror=()=>{if(worker.current===w){setBusy(false);setError('本地解析线程失败，请清空后重试或缩小文件。');setAnalysis(null)}}
    return {w,id}
  }
  const loadText=(text:string,unit:TimeUnit='auto')=>{const {w,id}=begin();w.postMessage({id,type:'load',text,unit})}
  const loadFiles=(files:File[],unit:TimeUnit)=>{
    const {w,id}=begin()
    w.postMessage({id,type:'files',files,unit})
  }
  const loadFile=(file:File,unit:TimeUnit)=>loadFiles([file],unit)
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
  return {analysis,filter,config,busy,error,loaded,progress,loadText,loadFile,loadFiles,updateFilter,updateConfig,clear}
}
