import test from 'node:test'
import assert from 'node:assert/strict'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { parallelSizes } from '../src/types/model.ts'
import { parseExplorer, explorerParams } from '../src/lib/model-explorer.ts'
import { deploymentWeightBudget } from '../src/lib/weight-deployment.ts'
import { decoderWeightBudget, expertParallelSizes } from '../src/lib/model-weights.ts'
import { expertRankTopology } from '../src/lib/model-ranks.ts'
import { dpaLayout, parseDpa } from '../src/lib/dpa-lab.ts'
import { modulePrecisionOptions } from '../src/lib/weight-precision-policy.ts'
import { compatibleExpertFormats } from '../src/lib/expert-packing.ts'
import { parseV41Scenario, v41RankFlow } from '../src/lib/deepseek-v41-reference.ts'

const glm = getModelArchitecture('glm-5-2')
test('64-degree topology and 64 PP stages roundtrip, retain the final stage and conserve bytes', () => {
  assert.deepEqual(parallelSizes, [1,2,4,8,16,32,64])
  assert.deepEqual(expertParallelSizes(glm,64), parallelSizes)
  const {state,notices} = parseExplorer(new URLSearchParams('tp=64&ep=64&adp=64&pp=64&stage=63&replicas=64&rank=4095&layer=77'),glm)
  assert.deepEqual(notices,[])
  assert.deepEqual(parseExplorer(explorerParams(state),glm).state,state)
  const config={tp:64,ep:64,attentionDp:64,pp:64,stage:63,replicas:64}
  const b=deploymentWeightBudget(glm,77,16,config)
  assert.equal(b.cards,262144)
  assert.equal(b.stages.length,64)
  assert.deepEqual([b.selectedStage.start,b.selectedStage.end],[76,78])
  assert.equal(b.layerIsLocal,true)
  assert.equal(b.fleetBytes,b.stages.reduce((s,p)=>s+p.bytes,0)*64*64)
  assert.ok(Number.isSafeInteger(b.fleetBytes))
  const one=deploymentWeightBudget(glm,77,16,{...config,replicas:1})
  assert.equal(b.selectedStage.bytes,one.selectedStage.bytes)
  assert.equal(b.fleetBytes,one.fleetBytes*64)
})
test('model head/group geometry is preserved; every newly enabled ordinary TP has integral weights', () => {
  assert.equal(getModelArchitecture('kimi-k3').supportedTp.at(-1),32)
  assert.equal(getModelArchitecture('qwen3-8b').supportedTp.at(-1),32)
  assert.equal(getModelArchitecture('starcoder2-3b').supportedTp.at(-1),8)
  assert.equal(getModelArchitecture('deepseek-v4-flash').supportedTp.at(-1),8)
  for(const model of modelArchitectures) for(const tp of model.supportedTp.filter(n=>n>8)) {
    assert.equal(model.dimensions.attentionHeads%tp,0,model.id)
    for(const ep of expertParallelSizes(model,tp)) {
      const b=decoderWeightBudget(model,model.dimensions.layers-1,tp,16,ep)
      assert.ok(b.complete,`${model.id}/${tp}/${ep}`)
      assert.ok(Number.isSafeInteger(b.allLayersBytes))
      for(const rows of b.layers) for(const row of rows) for(const weight of row.weights) assert.ok(Number.isSafeInteger(weight.local)&&weight.local>0)
    }
  }
})
test('EP64 and replica64 keep exact last-rank expert ownership without materializing all PP ranks', () => {
  const ranks=expertRankTopology(glm,64,64,1,64)
  assert.equal(ranks.length,4096)
  const last=ranks.at(-1), E=glm.execution.expertParallel.experts
  assert.equal(last.replica,63)
  assert.equal(last.epRank,63)
  assert.equal(last.moeTpRank,0)
  assert.equal(last.expertStart,E-E/64)
  assert.equal(last.expertEnd,E-1)
})
test('large TP revalidates module defaults and expert packing instead of crashing on narrow partitions', () => {
  const p=parseExplorer(new URLSearchParams('tp=64&ep=1&precision=mixed&mlp=fp8&experts=fp8&packing=fp8-block'),glm)
  assert.equal(p.state.mixed.mlp,'bf16') // Dense intermediate = 12288 / 64 = 192, not 128-aligned.
  assert.equal(p.state.mixed.experts,'bf16')
  assert.equal(p.state.expertFormat,undefined)
  assert.ok(p.notices.length>=3)
  assert.ok(!modulePrecisionOptions(glm,64,1).mlp.includes('fp8'))
  assert.ok(!compatibleExpertFormats(glm,64,1).includes('fp8-block'))
  assert.ok(modulePrecisionOptions(glm,64,64).experts.includes('fp8'))
  assert.doesNotThrow(()=>decoderWeightBudget(glm,3,64,16,1,p.state.mixed))
})
test('GQA above KV head count counts copies and integer head ownership in DPA reference', () => {
  const base={tp:32,dp:1,ep:1,rank:31,layer:0,requests:[4],sequence:1024,phase:'decode',bits:16,cacheBytes:2}
  const normal=dpaLayout(base,'qwen3-8b')
  assert.equal(normal.selected.kvHeadsStart,7)
  assert.equal(normal.selected.kvHeadsEnd,7)
  assert.deepEqual(normal.cacheShape,[4,1024,2,1,128])
  assert.equal(normal.normalTpCacheBytes,4*1024*36*2*32*128*2)
  const divided=dpaLayout({...base,dp:4,requests:[1,1,1,1]},'qwen3-8b')
  assert.equal(divided.dpaCacheBytes,normal.normalTpCacheBytes/4)
  assert.equal(divided.allRanksWeightBytes,decoderWeightBudget(getModelArchitecture('qwen3-8b'),0,32,16,1,undefined,8).allLayersBytes*32)
  for(const n of normal.internalTensors.flatMap(t=>t.shape)) assert.ok(Number.isInteger(n))
  const parsed=parseDpa(new URLSearchParams('tp=64&dp=64&ep=64'),'glm-5-2')
  assert.deepEqual(parsed.notices,[])
  assert.equal(dpaLayout(parsed.state).ranks.length,64)
})
test('out-of-range degrees and PP beyond layer count are rejected, independent V4.1 DP reaches64', () => {
  const p=parseExplorer(new URLSearchParams('tp=128&ep=128&adp=128&pp=65&replicas=128'),glm)
  assert.equal(p.notices.length,5)
  assert.equal(parseExplorer(new URLSearchParams('pp=64'),getModelArchitecture('qwen3-8b')).state.pp,undefined)
  assert.throws(()=>deploymentWeightBudget(glm,0,16,{tp:64,ep:64,attentionDp:64,pp:65,stage:0,replicas:64}))
  const reference=parseV41Scenario(new URLSearchParams('world=8&replicas=64&rank=511'))
  assert.deepEqual(reference.notices,[])
  assert.equal(reference.state.replicas,64)
  assert.doesNotThrow(()=>v41RankFlow(reference.state))
})
