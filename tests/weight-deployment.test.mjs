import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getModelArchitecture, modelArchitectures } from '../src/data/models.ts'
import { decoderWeightBudget, expertParallelSizes } from '../src/lib/model-weights.ts'
import { deploymentWeightBudget, attentionDpSizes, pipelineStages } from '../src/lib/weight-deployment.ts'
import { dpaLayout } from '../src/lib/dpa-lab.ts'
import { parseExplorer, explorerParams } from '../src/lib/model-explorer.ts'

const config = { tp: 4, ep: 1, attentionDp: 1, pp: 1, stage: 0, replicas: 1 }
test('PP uses contiguous stages, with remainder on the final stages', () => {
  assert.deepEqual(pipelineStages(78, 4).map(s => s.count), [19, 19, 20, 20])
  assert.deepEqual(pipelineStages(93, 4).map(s => s.count), [23, 23, 23, 24])
  assert.deepEqual(pipelineStages(3, 3).map(s => [s.start,s.end]), [[0,1],[1,2],[2,3]])
  for (const pp of [0, -1, 79, 1.5, NaN]) assert.throws(() => pipelineStages(78, pp))
})
test('PP=1 / ADP=1 reproduces the existing ledger across the catalogue', () => {
  for(const model of modelArchitectures) for(const tp of model.supportedTp) {
    const old = decoderWeightBudget(model, 0, tp, 16)
    const next = deploymentWeightBudget(model, 0, 16, {...config,tp})
    assert.equal(next.selectedStage.bytes,old.allLayersBytes,model.id)
    assert.equal(next.fleetBytes,old.allLayersBytes === null ? null : old.allLayersBytes * tp)
  }
})
test('combined EP, DPA, PP and replicas reconcile against independent DPA reference', () => {
  for(const id of ['glm-5-2','qwen3-8b']) {
    const model = getModelArchitecture(id)
    for(const tp of model.supportedTp) for(const attentionDp of attentionDpSizes(model,tp)) for(const ep of expertParallelSizes(model,tp)) {
      const mixed = {mlp:'fp8',shared:'bf16',experts:'int8'}
      if(id==='qwen3-8b') mixed.experts='bf16'
      const dpa = dpaLayout({tp,ep,dp:attentionDp,rank:0,layer:3,requests:Array(attentionDp).fill(2),sequence:4096,phase:'decode',bits:16,cacheBytes:2,mixed},id)
      const next = deploymentWeightBudget(model,3,16,{tp,ep,attentionDp,pp:4,stage:2,replicas:2},mixed)
      assert.equal(next.allLayersBytes,dpa.allLayersWeightBytes)
      assert.equal(next.fleetBytes,dpa.allRanksWeightBytes*2)
      assert.equal(next.cards,tp*4*2)
      for(const part of next.stages) assert.equal(part.bytes,dpa.layerBudgets.slice(part.start,part.end).reduce((sum,l)=>sum+l.bytes,0))
    }
  }
})
test('all model attention TP schemes and PP stage sums stay finite and conserve storage', () => {
  for(const model of modelArchitectures) for(const attentionDp of attentionDpSizes(model,4)) {
    if(!model.supportedTp.includes(4)) continue
    const next = deploymentWeightBudget(model,0,16,{...config,attentionDp,pp:3})
    if(!next.complete) continue
    assert.ok(Number.isFinite(next.fleetBytes),model.id)
    assert.equal(next.stages.reduce((sum,p)=>sum+p.bytes,0),next.allLayersBytes,model.id)
  }
})
test('EP does not divide expert bytes twice; ADP increases attention storage, not FFN', () => {
  const model=getModelArchitecture('glm-5-2')
  const base=deploymentWeightBudget(model,3,16,config)
  const ep=deploymentWeightBudget(model,3,16,{...config,ep:4})
  assert.equal(base.fleetBytes,ep.fleetBytes)
  const dp=deploymentWeightBudget(model,3,16,{...config,attentionDp:4})
  assert.ok(dp.fleetBytes>base.fleetBytes)
  assert.equal(base.rows.find(r=>r.node.id==='moe').bytes,dp.rows.find(r=>r.node.id==='moe').bytes)
  assert.ok(dp.rows.find(r=>r.node.id==='mla').bytes>base.rows.find(r=>r.node.id==='mla').bytes)
})
test('layer precision changes only the owning PP stage, including scale bytes', () => {
  const model=getModelArchitecture('qwen3-8b'), settings={...config,attentionDp:2,pp:4,replicas:2}
  const policy={mlp:'bf16',shared:'bf16',experts:'bf16'}
  const before=deploymentWeightBudget(model,3,16,settings,policy)
  const after=deploymentWeightBudget(model,3,16,settings,{...policy,weights:{'3/ffn/gate_proj':'int8'}})
  // [I / TP, H], INT8 payload + one FP32 scale per output row, vs BF16.
  const rows=model.dimensions.intermediateSize/settings.tp
  const delta=rows*model.dimensions.hiddenSize - rows*4
  assert.equal(before.stages[0].bytes-after.stages[0].bytes,delta)
  assert.equal(before.fleetBytes-after.fleetBytes,delta*settings.tp*settings.replicas)
  assert.deepEqual(before.stages.slice(1),after.stages.slice(1))
  assert.equal(after.layerIsLocal,true)
  assert.equal(deploymentWeightBudget(model,3,16,{...settings,stage:3},policy).layerIsLocal,false)
})
test('PP is not an average of heterogeneous layers; replicas do not affect local bytes', () => {
  const model=getModelArchitecture('glm-5-2')
  const a=deploymentWeightBudget(model,0,16,{...config,pp:4})
  const b=deploymentWeightBudget(model,0,16,{...config,pp:4,replicas:8})
  assert.notEqual(a.selectedStage.bytes,a.allLayersBytes/4)
  assert.equal(a.selectedStage.bytes,b.selectedStage.bytes)
  assert.equal(b.fleetBytes,a.fleetBytes*8)
  assert.equal(a.maxRankBytes,Math.max(...a.stages.map(s=>s.bytes)))
})
test('parallel URL fields persist and malformed configurations fail closed', () => {
  const model=getModelArchitecture('glm-5-2')
  const {state,notices}=parseExplorer(new URLSearchParams('tp=8&ep=4&pp=3&stage=2&adp=4&replicas=2'),model)
  assert.deepEqual(notices,[])
  assert.deepEqual(parseExplorer(explorerParams(state),model).state,state)
  const smaller=explorerParams({...state,pp:1,scenario:{...state.scenario,tp:2}})
  assert.equal(smaller.get('stage'),'0')
  assert.equal(smaller.get('adp'),'2')
  const bad=parseExplorer(new URLSearchParams('pp=999&stage=-1&adp=3'),model)
  assert.equal(bad.notices.length,3)
  assert.equal(bad.state.pp,undefined)
  assert.equal(bad.state.attentionDp,undefined)
  assert.throws(()=>deploymentWeightBudget(model,0,16,{...config,attentionDp:3}))
  assert.throws(()=>deploymentWeightBudget(model,0,16,{...config,stage:1}))
})
