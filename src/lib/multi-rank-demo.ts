import type { ProfileData, ProfileEvent } from './profile-analysis.ts'
import { defaultRankConfig, splitRankTraces } from './multi-rank-profile.ts'

export function multiRankDemo(kind:'straggler'|'clock'='straggler') {
  const data:ProfileData[]=Array.from({length:4},(_,rank)=>{
    const skew=kind==='clock'&&rank===3?300:0,late=kind==='straggler'&&rank===3?80:0
    const event=(name:string,start:number,duration:number,taskKind:ProfileEvent['kind'],role:ProfileEvent['role']='execution'):ProfileEvent=>({name,type:name,device:String(rank),stream:taskKind==='communication'?'2':'1',step:'12',shape:'',dtype:'bf16',format:'ND',kind:taskKind,role,start:start+skew,duration})
    return {source:'trace',clockBaseUs:0,skipped:0,warnings:['纯合成教学数据，非真实模型性能。'],events:[
      event('Attention',0,60,'compute'),event('Expert GEMM',65,35+late,'compute'),
      event('hcom_allReduce · round 12',100+late,120-late,'communication'),
      ...(late?[]:[event('Notify Wait',100,kind==='clock'?8:80,'communication','wait')]),
      event('Output projection',225,15,'compute'),
    ]}
  })
  const traces=splitRankTraces(data),config=defaultRankConfig(traces)
  config.mode='clock';config.clockConfirmed=true;config.workloadConfirmed=true;config.pairingConfirmed=true;config.uncertainty='1'
  config.ranks.forEach(r=>{r.eventId='2'})
  if(kind==='clock'){config.mode='relative';config.clockConfirmed=false;config.pairingConfirmed=false}
  return {traces,config}
}
