import { analyzeProfile, emptyProfileFilter, type ProfileData, type ProfileFilter } from '../lib/profile-analysis'
import { importProfile, type TimeUnit } from '../lib/profile-import'
let data:ProfileData|undefined
self.onmessage=(event:MessageEvent<{id:number;type:'load'|'analyze';text?:string;unit?:TimeUnit;filter?:ProfileFilter}>)=>{
  const {id,type,text,unit,filter}=event.data
  try {
    if(type==='load')data=importProfile(text??'',unit??'auto')
    if(!data)throw new Error('请先导入采样。')
    const analysis=analyzeProfile(data,filter??emptyProfileFilter())
    self.postMessage({id,analysis,source:data.source})
  }catch(e){self.postMessage({id,error:(e as Error).message})}
}
