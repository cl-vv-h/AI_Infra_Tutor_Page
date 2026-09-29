import { analyzeRanks, defaultRankConfig, rankInfo, rankLimits, splitRankTraces, type RankConfig, type RankTrace } from '../lib/multi-rank-profile'
import { planRankImport, parseRankGroup } from '../lib/multi-rank-import'
import type { ProfileBundleFile } from '../lib/profile-bundle'
import type { ProfileData } from '../lib/profile-analysis'
import type { TimeUnit } from '../lib/profile-import'
import { multiRankDemo } from '../lib/multi-rank-demo'
let traces:RankTrace[]=[]
let current=0
self.onmessage=async(event:MessageEvent<{id:number;type:'files'|'demo'|'analyze';files?:File[];unit?:TimeUnit;demo?:'straggler'|'clock';config?:RankConfig}>)=>{
  const {id,type}=event.data;current=id
  try {
    let config=event.data.config,ignored=0
    if(type==='demo'){const demo=multiRankDemo(event.data.demo);traces=demo.traces;config=demo.config}
    if(type==='files'){
      const files=event.data.files??[],bundle:ProfileBundleFile[]=files.map(f=>({name:f.name,path:f.webkitRelativePath||undefined,size:f.size}))
      const plan=planRankImport(bundle),datasets:ProfileData[]=[];ignored=plan.ignored
      let count=0
      for(let g=0;g<plan.groups.length;g++){
        const group=plan.groups[g]
        self.postMessage({id,progress:`本地读取采样 ${g+1} / ${plan.groups.length}…`})
        for(const i of group.read){bundle[i].text=await files[i].text();if(id!==current)return}
        const data=parseRankGroup(bundle,group,event.data.unit??'auto')
        count+=data.events.length
        if(count>rankLimits.events)throw new Error('本次设备任务超过 100 万条，请缩短采样窗口。')
        datasets.push(data)
        for(const i of group.read)delete bundle[i].text
      }
      traces=splitRankTraces(datasets);config=defaultRankConfig(traces)
    }
    if(!traces.length||!config)throw new Error('请先导入至少一份设备采样。')
    const result=analyzeRanks(traces,config)
    if(id===current)self.postMessage({id,result,config,...(type!=='analyze'?{info:rankInfo(traces),ignored}:{})})
  } catch(error){if(id===current)self.postMessage({id,error:error instanceof Error?error.message:'本地分析失败。'})}
}
