import type { EstimateInput } from './operator-estimator.ts'
export interface ProfileSample {type:string;shape:string;dtype:string;format:string;median:number}
let pending:ProfileSample|undefined
export function transferProfileSample(sample:ProfileSample){pending={...sample}}
export function peekProfileSample(){return pending}
export function clearProfileSample(){pending=undefined}
export function profileEstimateCandidate(sample:ProfileSample):Partial<EstimateInput>|null {
  if(!sample||!Number.isFinite(sample.median)||sample.median<=0||typeof sample.shape!=='string'||typeof sample.dtype!=='string'||typeof sample.type!=='string')return null
  const dtypes=sample.dtype?.split(';')??[]
  if(!dtypes.length||dtypes.some(t=>!['bf16','bfloat16','fp16','float16'].includes(t)))return null
  const precision=dtypes[0]==='bf16'||dtypes[0]==='bfloat16'?'bf16':'fp16'
  const shapes=sample.shape.split(';').map(s=>s.split(',').map(Number))
  if(shapes.flat().some(n=>!Number.isSafeInteger(n)||n<=0))return null
  const t=sample.type.toLowerCase()
  if(/^(matmul|matmulv2|gemm)$/.test(t)&&shapes.length===2&&shapes.every(s=>s.length===2)&&shapes[0][1]===shapes[1][0])return {operator:'matmul',precision,batch:1,m:shapes[0][0],k:shapes[0][1],n:shapes[1][1],broadcastB:true}
  if(/^(rmsnorm|softmax|softmaxv2)$/.test(t)&&shapes[0].length>=2) {
    const x=shapes[0],rows=x.slice(0,-1).reduce((a,b)=>a*b,1)
    if(!Number.isSafeInteger(rows))return null
    return {operator:t==='rmsnorm'?'rmsnorm':'softmax',precision,rows,width:x[x.length-1]}
  }
  return null
}
