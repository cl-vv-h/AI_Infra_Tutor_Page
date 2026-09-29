import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelArchitectures } from '../src/data/models.ts'
import { parseExplorer } from '../src/lib/model-explorer.ts'
import { createScenario } from '../src/lib/deployment-scenarios.ts'
import { estimateScenario, scenarioDifferenceRows } from '../src/lib/scenario-comparison.ts'
import { deploymentWeightBudget } from '../src/lib/weight-deployment.ts'
import { planCacheCapacity, gibibyte } from '../src/lib/cache-capacity.ts'
const model=modelArchitectures.find(m=>m.id==='glm-5-2')
function fixture(query='tp=8&ep=4&pp=4&stage=2&adp=4&replicas=2&layer=3&view=weights&precision=mixed&mlp=fp8&experts=bf16'){
  const state=parseExplorer(new URLSearchParams(query),model).state
  return createScenario(model.id,state,'方案','v1')
}
test('scenario estimates match the existing weight workbench without multiplying EP/ADP into cards',()=>{
  const s=fixture(), e=estimateScenario(s,'v1'),state=e.state
  const expected=deploymentWeightBudget(model,state.layer,state.weightBits??16,{tp:8,ep:4,pp:4,stage:2,attentionDp:4,replicas:2},state.mixed)
  assert.deepEqual(e.weights,expected);assert.equal(e.weights.cards,64)
  assert.equal(e.cache,null);assert.match(e.cacheReason,/不支持此组合/)
})
test('validated baseline cache reproduces the cache planner and remains separate from weights',()=>{
  const e=estimateScenario(fixture('tp=8&ep=4&budget=12'),'v1')
  assert.deepEqual(e.cache,planCacheCapacity(model,e.state.scenario,12*gibibyte))
  assert.equal('totalMemory' in e,false)
})
test('PP-only and ADP-only cache cases fail closed',()=>{
  for(const query of ['tp=8&pp=2','tp=8&adp=2']) assert.equal(estimateScenario(fixture(query),'v1').cache,null)
})
test('equal configurations have no differences; changed parameters and per-weight policies remain inspectable',()=>{
  const a=estimateScenario(fixture(),'v1'),b=estimateScenario({...a.snapshot,id:'b',name:'different title'},'v1')
  assert.ok(scenarioDifferenceRows([a,b]).every(r=>!r.different))
  const c=estimateScenario(fixture('tp=4&pp=1&budget=12'),'v1')
  assert.ok(scenarioDifferenceRows([a,c]).find(r=>r.label.includes('TP /')).different)
  assert.ok(scenarioDifferenceRows([a,c]).find(r=>r.label.includes('权重精度')).different)
})
test('unknown model never substitutes a valid model or produces estimated results',()=>{
  const e=estimateScenario({...fixture(),modelId:'retired-model'},'v2')
  assert.equal(e.weights,null);assert.equal(e.cache,null);assert.equal(e.changed,true)
})
