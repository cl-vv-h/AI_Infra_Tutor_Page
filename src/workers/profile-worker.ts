import { analyzeProfile, emptyProfileFilter, type ProfileData, type ProfileFilter } from '../lib/profile-analysis'
import { importProfile, type TimeUnit } from '../lib/profile-import'
import { defaultDiagnosticConfig, type DiagnosticConfig } from '../lib/profile-diagnostics'
import { importProfileBundle, planProfileImport, profileFileKind, type ProfileBundleFile } from '../lib/profile-bundle'
import { profileLimits } from '../lib/profile-import'
let data:ProfileData|undefined
let config=defaultDiagnosticConfig()
let current=0
self.onmessage=async(event:MessageEvent<{id:number;type:'load'|'files'|'analyze';text?:string;files?:File[];unit?:TimeUnit;filter?:ProfileFilter;config?:DiagnosticConfig}>)=>{
  const {id,type,text,unit,filter}=event.data
  current=id
  try {
    if(type==='load'){data=importProfile(text??'',unit??'auto');config=defaultDiagnosticConfig()}
    if(type==='files'){
      const files=event.data.files??[]
      config=defaultDiagnosticConfig();data=undefined
      if(files.length===1&&profileFileKind(files[0].name)==='unsupported'&&!files[0].webkitRelativePath){
        if(files[0].size>profileLimits.bytes)throw new Error('单文件上限 50 MiB，请先裁剪采样范围。')
        const content=await files[0].text()
        if(id!==current)return
        data=importProfile(content,unit??'auto')
      }else{
        const bundle:ProfileBundleFile[]=files.map(f=>({name:f.name,path:f.webkitRelativePath||undefined,size:f.size}))
        const plan=planProfileImport(bundle),total=plan.filter(f=>f.status==='read').length
        let done=0
        for(let i=0;i<files.length;i++){
          if(plan[i].status!=='read')continue
          self.postMessage({id,progress:`本地读取 ${++done} / ${total}：${plan[i].name}`})
          bundle[i].text=await files[i].text()
          if(id!==current)return
        }
        self.postMessage({id,progress:'正在校验逐任务身份、关联指标并生成诊断…'})
        data=importProfileBundle(bundle,unit??'auto')
      }
    }
    const nextConfig=event.data.config??config
    if(!data)throw new Error('请先导入采样。')
    const analysis=analyzeProfile(data,filter??emptyProfileFilter(),nextConfig)
    config=nextConfig
    self.postMessage({id,analysis,source:data.source})
  }catch(e){self.postMessage({id,error:(e as Error).message})}
}
