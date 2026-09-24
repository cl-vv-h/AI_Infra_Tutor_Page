import { analyzeProfile, emptyProfileFilter, type ProfileData, type ProfileFilter } from '../lib/profile-analysis'
import { importProfile, type TimeUnit } from '../lib/profile-import'
import { defaultDiagnosticConfig, type DiagnosticConfig } from '../lib/profile-diagnostics'
let data:ProfileData|undefined
let config=defaultDiagnosticConfig()
self.onmessage=(event:MessageEvent<{id:number;type:'load'|'analyze';text?:string;unit?:TimeUnit;filter?:ProfileFilter;config?:DiagnosticConfig}>)=>{
  const {id,type,text,unit,filter}=event.data
  try {
    if(type==='load'){data=importProfile(text??'',unit??'auto');config=defaultDiagnosticConfig()}
    const nextConfig=event.data.config??config
    if(!data)throw new Error('请先导入采样。')
    const analysis=analyzeProfile(data,filter??emptyProfileFilter(),nextConfig)
    config=nextConfig
    self.postMessage({id,analysis,source:data.source})
  }catch(e){self.postMessage({id,error:(e as Error).message})}
}
