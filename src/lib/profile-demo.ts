// Fully synthetic data; never derived from a user's trace or machine.
export function demoProfile(candidate=false) {
  const rows=[['Name','Type','Device ID','Stream ID','Step ID','Task Start Time(us)','Task Duration(us)','Input Shapes','Input Data Types','Input Formats','Task Type']]
  for(let step=0;step<8;step++) {
    const origin=step*1000
    const add=(name:string,type:string,stream:number,start:number,duration:number,shape:string,task='AI_CORE')=>rows.push([name,type,'0',String(stream),String(step),String(origin+start),String(duration),shape,'BF16;BF16','ND;ND',task])
    add('projection','MatMul',0,0,candidate?120:200,'128,7168;7168,2048')
    add('index_score','LightningIndexer',0,230,candidate?360:(step===0?450:300),'1,1,64,128;1,32768,1,128')
    add('collective','HcclAllReduce',1,280,180,'128,2048','HCCL')
    for(let j=0;j<(candidate?8:16);j++)add('normalization','RmsNorm',0,650+j*8,5,'128,7168')
    add('expert','MatMul',0,800,candidate?110:100,'32,7168;7168,2048')
  }
  return rows.map(r=>r.map(c=>`"${c.replace(/"/g,'""')}"`).join(',')).join('\n')
}

// Synthetic, explicitly labelled ranges and percentages; no captured user information.
export function singleProfileDemo() {
  const traceEvents:unknown[]=[{ph:'M',pid:4,name:'process_name',args:{name:'Ascend Hardware'}},{ph:'M',pid:1,name:'process_name',args:{name:'Synthetic annotations'}}]
  const host=(name:string,ts:number,dur:number)=>traceEvents.push({ph:'X',pid:1,tid:0,name,ts,dur})
  const task=(name:string,ts:number,dur:number,ratio:number,step:number,stream=0)=>traceEvents.push({ph:'X',pid:4,tid:stream,name,ts,dur,args:{'OP Type':name,'Input Shapes':name==='MatMul'?'128,7168;7168,2048':'128,7168','Input Data Types':'BF16;BF16','Input Formats':'ND;ND','Step ID':step,...(name==='MatMul'?{'aic_mac_ratio(%)':ratio}:name==='RmsNorm'?{'aiv_vec_ratio(%)':ratio}:{})}})
  host('prefill',0,2000);task('MatMul',100,1200,75,0);task('RmsNorm',1350,300,15,0);task('HcclAllReduce',1450,350,0,0,1)
  for(let i=0;i<8;i++) {
    const s=2300+i*1000,d=i===5?750:400
    host('scheduler',s-150,100);host('decode',s,d)
    task('MatMul',s+20,i===5?450:180,18,i+1);task('RmsNorm',s+d-100,60,22,i+1)
  }
  return JSON.stringify({traceEvents})
}
