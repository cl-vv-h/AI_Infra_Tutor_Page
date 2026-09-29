import { importProfile, profileLimits, type TimeUnit } from './profile-import.ts'
import { importProfileBundle, planProfileImport, profileFileKind, type ProfileBundleFile, type ProfileFileDescriptor } from './profile-bundle.ts'
import { rankLimits, splitRankTraces } from './multi-rank-profile.ts'
import type { ProfileData } from './profile-analysis.ts'

export interface RankImportGroup { indices: number[]; read: number[]; single: boolean }
export function planRankImport(files:ProfileFileDescriptor[]):{groups:RankImportGroup[];ignored:number;bytes:number} {
  if(!files.length||files.length>4096)throw new Error('请选择 1–4096 个文件。')
  const directory=files.some(f=>Boolean(f.path))
  const parents=new Map<string,number[]>()
  let ignored=0,bytes=0
  files.forEach((file,i)=>{
    const path=(file.path??file.name).replace(/\\/g,'/')
    if(directory&&profileFileKind(file.name)==='unsupported'){ignored++;return}
    if(!directory&&!/\.(csv|json)$/i.test(file.name)){ignored++;return}
    const parent=directory?path.slice(0,path.lastIndexOf('/')):String(i)
    const list=parents.get(parent)??[];list.push(i);parents.set(parent,list)
  })
  const groups:RankImportGroup[]=[]
  for(const indices of parents.values()){
    if(directory&&!indices.some(i=>['kernel','trace','tasks'].includes(profileFileKind(files[i].name)))){ignored+=indices.length;continue}
    // Intermediate views outside ASCEND_PROFILER_OUTPUT never become extra ranks.
    if(directory&&files.some(f=>/(?:^|\/)ASCEND_PROFILER_OUTPUT\//i.test((f.path??'').replace(/\\/g,'/')))&&!indices.some(i=>/(?:^|\/)ASCEND_PROFILER_OUTPUT\//i.test((files[i].path??'').replace(/\\/g,'/')))){ignored+=indices.length;continue}
    const single=!directory
    const plan=single?null:planProfileImport(indices.map(i=>files[i]))
    const read=indices.filter((_,j)=>!plan||plan[j].status==='read')
    for(const i of read){if(!Number.isFinite(files[i].size)||files[i].size<0||files[i].size>profileLimits.bytes)throw new Error('每个文件须 ≤ 50 MiB。');bytes+=files[i].size}
    ignored+=indices.length-read.length
    groups.push({indices,read,single})
  }
  if(!groups.length)throw new Error('没有可读取的设备数据；请选择 kernel_details.csv / trace_view.json 等导出文件或它们的父目录。')
  if(groups.length>rankLimits.ranks)throw new Error('最多读取 64 份采样；请缩小目录范围。')
  if(bytes>rankLimits.bytes)throw new Error('本次可读取数据超过 256 MiB，请裁剪采样范围。')
  return {groups,ignored,bytes}
}
export function parseRankGroup(files:ProfileBundleFile[],group:RankImportGroup,unit:TimeUnit):ProfileData {
  return group.single?importProfile(files[group.read[0]].text??'',unit):importProfileBundle(group.indices.map(i=>files[i]),unit)
}
export function importRankTexts(files:ProfileBundleFile[],unit:TimeUnit='auto') {
  const plan=planRankImport(files)
  for(const group of plan.groups)for(const i of group.read)if(new TextEncoder().encode(files[i].text??'').byteLength!==files[i].size)throw new Error('输入字节数与文件描述不一致。')
  return {traces:splitRankTraces(plan.groups.map(g=>parseRankGroup(files,g,unit))),ignored:plan.ignored}
}
