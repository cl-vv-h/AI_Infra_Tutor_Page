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
