import assert from 'node:assert/strict'
import { test } from 'node:test'
import { modelArchitectures } from '../src/data/models.ts'
import { parseExplorer, explorerParams } from '../src/lib/model-explorer.ts'
import { createScenario, inspectScenario, exportScenarios, parseScenarioImport, mergeScenarios, validateLibrary, scenarioName, emptyScenarioLibrary } from '../src/lib/deployment-scenarios.ts'
import { precisionInventory } from '../src/lib/weight-precision-policy.ts'
const model = modelArchitectures.find(m => m.id === 'glm-5-2')
const state = parseExplorer(new URLSearchParams('view=weights&layer=3&tp=8&ep=4&pp=4&stage=2&adp=4&replicas=2&rank=9&precision=mixed&mlp=fp8&experts=bf16&b=8&s=16384&budget=12&bytes=1'), model).state
const fixture = (id='scenario-1') => createScenario(model.id,state,'混合部署','fingerprint-v1',id,'2026-09-29T01:00:00.000Z')
test('snapshot round-trip retains topology, precision, rank, cache and reader state', () => {
  const s = fixture(), restored = inspectScenario(s,'fingerprint-v1')
  assert.deepEqual(restored.state, state)
  assert.deepEqual(parseScenarioImport(exportScenarios([s])), [s])
  assert.equal(restored.changed, false)
})
test('per-layer and global weight overrides survive exact export and restore', () => {
  const item = precisionInventory(model,8,4,2).find(w => w.options.includes('int8'))
  const mixed = {...state.mixed, modelId:model.id, weights:{[item.key]:'int8'}}
  const s = createScenario(model.id,{...state,mixed},'逐权重','v1')
  assert.deepEqual(inspectScenario(parseScenarioImport(exportScenarios([s]))[0],'v1').state.mixed.weights,mixed.weights)
})
test('parallel configuration up to 64 reuses model-owned allowed values', () => {
  for (const tp of model.supportedTp) {
    const next = parseExplorer(new URLSearchParams(`tp=${tp}&pp=64&replicas=64&view=weights`), model).state
    assert.equal(inspectScenario(createScenario(model.id,next,'范围','v1'),'v1').state.scenario.tp,tp)
  }
})
test('fingerprint changes recompute eligibility without overwriting the original snapshot', () => {
  const s=fixture(), before=JSON.stringify(s), result=inspectScenario(s,'fingerprint-v2')
  assert.equal(result.changed,true); assert.ok(result.state); assert.equal(JSON.stringify(s),before)
})
test('unknown models and obsolete/unknown/duplicate/ignored parameters remain exportable but not restorable', () => {
  for (const item of [{...fixture(),modelId:'retired-model'}, {...fixture(),params:fixture().params+'&unknown=1'}, {...fixture(),params:fixture().params+'&tp=1'}, {...fixture(),params:fixture().params.replace('tp=8','tp=3')}, {...fixture(),params:explorerParams({...state,mixed:undefined}).toString()+'&mlp=fp8'}]) {
    assert.equal(inspectScenario(item,'v1').state,null)
    assert.equal(parseScenarioImport(exportScenarios([item]))[0].params,item.params)
  }
})
test('schema, control characters, timestamps and import size fail closed', () => {
  for (const raw of ['invalid',JSON.stringify({version:2,items:[]}),JSON.stringify({version:1,items:[{...fixture(),extra:'bad'}]}),JSON.stringify({version:1,items:[{...fixture(),name:'bad\u0000'}]}),JSON.stringify({version:1,items:[{...fixture(),updatedAt:'yesterday'}]}),' '.repeat(1048577)]) assert.throws(()=>parseScenarioImport(raw))
  for (const name of ['', ' '.repeat(3), 'x'.repeat(81), 'x\u202ey']) assert.throws(()=>scenarioName(name))
})
test('merge deduplicates identical entries, rejects ID collision atomically and enforces 50 items', () => {
  const current=[fixture()]
  assert.equal(mergeScenarios(current,[fixture()]).skipped,1)
  assert.equal(mergeScenarios(current,[fixture('new')]).added,1)
  assert.throws(()=>mergeScenarios(current,[fixture('new'),{...fixture(),name:'冲突'}]))
  assert.deepEqual(current,[fixture()])
  assert.throws(()=>mergeScenarios(Array.from({length:50},(_,i)=>fixture(`s-${i}`)),[fixture('new')]))
  assert.throws(()=>parseScenarioImport(JSON.stringify({version:1,items:[fixture(),fixture()]})))
})
test('library metadata and export allowlisted fields do not carry machine information', () => {
  assert.deepEqual(validateLibrary(emptyScenarioLibrary()),emptyScenarioLibrary())
  assert.throws(()=>validateLibrary({version:99,revision:0,items:[]}))
  assert.throws(()=>validateLibrary({version:1,revision:-1,items:[]}))
  assert.deepEqual(Object.keys(JSON.parse(exportScenarios([fixture()]))),['version','items'])
})
