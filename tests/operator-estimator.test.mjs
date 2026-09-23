import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultEstimate, estimateRuntime, workload, hardwareProfiles, compareMeasurement } from '../src/lib/operator-estimator.ts'
const base=defaultEstimate()
const close=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-12,`${a} != ${b}`)

test('950 profiles use Cube-only rather than combined TFLOPS; 910C remains single die',()=>{
  assert.equal(hardwareProfiles[0].bandwidth,1600)
  assert.equal(hardwareProfiles[0].capacity,64)
  assert.equal(hardwareProfiles[0].cube.fp8,undefined)
  assert.match(hardwareProfiles[0].note,/情景假设/)
  assert.deepEqual(hardwareProfiles.slice(1,4).map(p=>[p.cube.bf16,p.vector,p.bandwidth]),[[432,27,1600],[378,23,1400],[486,30,4000]])
})
test('GEMM independent arithmetic and exact µs units',()=>{
  const x={...base,batch:1,m:2,n:3,k:4,cube:1,bandwidth:1,computeEfficiency:1,memoryEfficiency:1,overhead:0}
  const r=estimateRuntime(x)
  assert.equal(r.workload.cubeOps,48)
  assert.equal(r.workload.bytes,2*(8+12+6))
  close(r.parts.cube,48/1e6);close(r.parts.memory,52/1e3)
  close(r.central,0.052)
})
test('batched GEMM shared B changes traffic but not FLOPs',()=>{
  const a=workload({...base,batch:4,m:2,n:3,k:4}),b=workload({...base,batch:4,m:2,n:3,k:4,broadcastB:false})
  assert.equal(a.cubeOps,b.cubeOps)
  assert.equal(b.bytes-a.bytes,3*4*3*2)
})
test('INT8 and MXFP4 include explicit scales and 16-bit outputs',()=>{
  const x={...base,batch:2,m:3,n:4,k:33,precision:'mxfp4'}
  assert.equal(workload(x).bytes,(2*3*33+33*4)*0.5+2*2*3*4+(2*3+4)*2)
  assert.equal(workload({...x,precision:'int8'}).bytes,2*3*33+33*4+2*2*3*4+4*(2*3+4))
})
test('indexer semantics count all candidates, not only top-k',()=>{
  const x={...base,operator:'indexer',batch:2,queries:4,sequence:32,heads:8,dim:128,topk:8}
  const w=workload(x),z=workload({...x,topk:16})
  assert.equal(w.cubeOps,2*2*4*32*8*128)
  assert.equal(w.vectorOps,3*2*4*32*8)
  assert.equal(w.comparisons,2*4*32*3)
  assert.equal(z.cubeOps,w.cubeOps)
  assert.ok(z.comparisons>w.comparisons)
  assert.equal(w.bytes,2*(2*4*8*128+2*32*128+2*4*8)+4*2*4*8)
})
test('right aligned causal valid-pair sum and score materialization',()=>{
  const x={...base,operator:'indexer',batch:2,queries:4,sequence:32,heads:8,dim:128,topk:8,causal:true}
  const a=workload(x),b=workload({...x,materialize:true})
  assert.equal(a.cubeOps,2*2*(29+30+31+32)*8*128)
  assert.equal(b.bytes-a.bytes,2*4*2*4*32)
  assert.equal(b.footprint-a.footprint,4*2*4*32)
})
test('indexer vector and top-k share a resource in overlap scenario',()=>{
  const r=estimateRuntime({...base,operator:'indexer',queries:4,sequence:2048,topk:32})
  close(r.central,Math.max(r.parts.cube,r.parts.vector+r.parts.selection,r.parts.memory)+base.overhead)
})
test('RMSNorm and softmax basic work and traffic counts',()=>{
  const r=workload({...base,operator:'rmsnorm',rows:4,width:128})
  assert.equal(r.bytes,4*4*128+2*128)
  assert.equal(r.vectorOps,4*4*128+2*4)
  const s=workload({...base,operator:'softmax',rows:4,width:128})
  assert.equal(s.bytes,4*4*128);assert.equal(s.vectorOps,5*4*128)
})
test('gather reads selected rows, not full table; repeated indices permitted',()=>{
  const r=workload({...base,operator:'gather',rows:4,width:128,selected:16})
  assert.equal(r.bytes,4*16*128+4*16)
  assert.equal(r.footprint,2*4*128+2*16*128+4*16)
  assert.equal(r.cubeOps,0);assert.equal(r.vectorOps,0)
})
test('all operator/hardware/precision combinations produce ordered finite scenarios',()=>{
  for(const h of hardwareProfiles)for(const op of ['matmul','indexer','rmsnorm','softmax','gather'])for(const p of (op==='matmul'?Object.keys(h.cube):['bf16','fp16'])){
    const r=estimateRuntime({...defaultEstimate(h),operator:op,precision:p,cube:h.cube[p]})
    assert.ok(r.resourceFloor<=r.lower && r.lower<=r.central && r.central<=r.upper)
    assert.ok(Number.isFinite(r.upper));assert.ok(r.upper>0)
  }
})
test('increasing work, traffic or decreasing efficiencies cannot accelerate model',()=>{
  const r=estimateRuntime(base)
  assert.ok(estimateRuntime({...base,m:base.m*2}).central>=r.central)
  assert.ok(estimateRuntime({...base,computeEfficiency:0.1,memoryEfficiency:0.1}).central>=r.central)
  assert.ok(estimateRuntime({...base,trafficFactor:4}).central>=r.central)
})
test('capacity overrun prevents performance verdict',()=>{
  const r=estimateRuntime({...base,capacity:0.001})
  assert.equal(r.fitsMemory,false)
  assert.match(r.warnings.join(),/内存容量/)
  assert.equal(compareMeasurement(r,1e5).status,'capacity')
})
test('comparison classifies below-bound, in-range, faster, and slow without claiming a bug',()=>{
  const r=estimateRuntime(base)
  assert.equal(compareMeasurement(r,r.resourceFloor/2).status,'scope')
  assert.equal(compareMeasurement(r,r.central).status,'within')
  assert.equal(compareMeasurement(r,(r.lower+r.resourceFloor)/2).status,'faster')
  assert.equal(compareMeasurement(r,r.upper*2).status,'investigate')
  assert.match(compareMeasurement(r,r.upper*2).description,/不等同于/)
  close(compareMeasurement(r,100).achievedCubeTops,r.workload.cubeOps/1e8)
  close(compareMeasurement(r,100).logicalBandwidth,r.workload.bytes/1e5)
  assert.throws(()=>compareMeasurement(r,NaN));assert.throws(()=>compareMeasurement(r,0))
  assert.throws(()=>compareMeasurement(r,1e-320))
})
test('invalid shapes, rates, precision and numeric overflow are rejected',()=>{
  for(const patch of [{m:0},{m:-1},{n:1.2},{k:NaN},{m:Infinity},{cube:0},{bandwidth:0},{overhead:-1},{memoryEfficiency:1.1},{vectorEfficiency:0},{trafficFactor:0.5},{precision:'other'},{operator:'toString'},{m:1e7,n:1e7,k:1e7},{computeEfficiency:1e-320}]) assert.throws(()=>estimateRuntime({...base,...patch}),JSON.stringify(patch))
  for(const patch of [{topk:32769},{queries:32769,causal:true},{precision:'fp8'},{selectionRate:0}])assert.throws(()=>estimateRuntime({...base,operator:'indexer',...patch}))
})
