import assert from 'node:assert/strict'
import test from 'node:test'
import { getModelArchitecture } from '../src/data/models.ts'
import { defaultMixedPrecision, matrixPrecisions, mixedWeightStorage, precisionKey, precisionWeightParts } from '../src/lib/mixed-precision.ts'
import { precisionInventory } from '../src/lib/weight-precision-policy.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { rankModule } from '../src/lib/model-ranks.ts'
import { explorerParams, parseExplorer } from '../src/lib/model-explorer.ts'
import { dpaParams, dpaLayout, parseDpa } from '../src/lib/dpa-lab.ts'

const base = { ...defaultMixedPrecision }
const scenario = { tp: 4, phase: 'decode', batch: 2, sequence: 4096, cacheBytes: 2 }
const policy = (modelId, weights) => ({ ...base, modelId, weights })
const shape = { name: 'experts.down_proj', shape: '[4, 256, 128]', routedExpert: true }
test('all storage formats reconcile independently: payload, block/channel/global/input scales', () => {
  const n = 4 * 256 * 128
  const expected = {
    bf16: [n*2,0,0,0], fp16: [n*2,0,0,0], fp32: [n*4,0,0,0],
    fp8: [n,4*2*1*4,0,0], fp8_tensor: [n,4*4,0,0],
    int8: [n,4*256*4,0,0], int4: [n/2,4*256*1*4,0,0],
    mxfp4: [n/2,4*256*4,0,0], nvfp4: [n/2,4*256*8,4*4,0],
    w4afp8: [n/2,4*256*1*4,0,4*2],
  }
  for (const [experts, [payload, scale, global, input]] of Object.entries(expected)) {
    const storage = mixedWeightStorage(shape, 'moe', { ...base, experts })
    assert.equal(storage.payloadBytes,payload,experts)
    assert.equal(storage.scaleBytes,scale,experts)
    assert.equal(storage.globalScaleBytes,global,experts)
    assert.equal(storage.inputScaleBytes,input,experts)
    assert.equal(storage.bytes,payload+scale+global+input,experts)
  }
})

test('fused Gate/Up and repeated K/V split without losing or duplicating parameters', () => {
  const fused = { ...shape, name: 'experts.gate_up_proj · EP × MoE-TP local', shape: '[4, 512, 128]' }
  const weights = { [precisionKey('moe','experts.gate_proj')]: 'int8', [precisionKey('moe','experts.up_proj')]: 'bf16' }
  const mixed = mixedWeightStorage(fused,'moe',policy('glm-5-2',weights),3)
  assert.equal(mixed.parts.length,2)
  assert.equal(mixed.bytes,4*256*128 + 4*256*4 + 4*256*128*2)
  assert.deepEqual(mixed.parts.map(p=>p.storage.format),['int8','bf16'])
  const nv = mixedWeightStorage(fused,'moe',{ ...base,experts:'nvfp4' })
  assert.equal(nv.globalScaleBytes,4*2*4,'one global scale per expert per logical Gate/Up')
  const tensorFp8 = mixedWeightStorage(fused,'moe',{ ...base,experts:'fp8_tensor' })
  assert.equal(tensorFp8.scaleBytes,4*2*4)
  const pair={name:'k_proj / v_proj · each TP local',shape:'[128, 4096]',multiplicity:2}
  const split=mixedWeightStorage(pair,'gqa',policy('qwen3-8b',{[precisionKey('gqa','k_proj')]:'int8'}),0)
  assert.equal(split.bytes,128*4096+128*4+128*4096*2)
  assert.deepEqual(precisionWeightParts(pair).map(p=>p.multiplicity),[1,1])
})

test('layer override takes precedence and only changes one layer in Decoder and rank ledgers', () => {
  const m=getModelArchitecture('qwen3-8b'), key=precisionKey('ffn','gate_proj')
  const global=policy(m.id,{[key]:'fp8',[precisionKey('ffn','up_proj')]:'int8'})
  const current={...global,weights:{...global.weights,[precisionKey('ffn','gate_proj',3)]:'fp32'}}
  const a=decoderWeightBudget(m,3,4,16,1,global), b=decoderWeightBudget(m,3,4,16,1,current)
  const elements=4096*(12288/4), delta=elements*3-(4096/128)*(12288/4/128)*4
  assert.equal(b.bytes-a.bytes,delta)
  assert.equal(b.allLayersBytes-a.allLayersBytes,delta)
  const rank=rankModule(m,3,'ffn',scenario,16,2,1,current)
  assert.equal(rank.localBytes,b.rows.find(r=>r.node.id==='ffn').bytes)
  assert.equal(rank.fleetBytes,rank.localBytes*4*2)
  assert.equal(rank.weights[0].storage.format,'fp32')
  assert.equal(rankModule(m,2,'ffn',scenario,16,2,1,current).weights[0].storage.format,'fp8')
})

test('all audited models expose real projection and norm targets; vectors only allow floating formats', () => {
  for(const id of ['glm-5-2','glm-5-3-flash','kimi-k3','deepseek-v4-flash','qwen3-8b','qwen3-30b-a3b']) {
    const inventory=precisionInventory(getModelArchitecture(id),8,1)
    assert.ok(inventory.length)
    assert.equal(new Set(inventory.map(r=>`${r.layer}/${r.key}`)).size,inventory.length)
    for(const r of inventory) {
      assert.ok(r.options.includes('bf16')&&r.options.includes('fp16')&&r.options.includes('fp32'))
      if(!r.weight.shape.includes(',')) assert.deepEqual(r.options,['bf16','fp16','fp32'])
    }
  }
})

test('bounded URLs preserve only model-owned valid overrides and report invalid alignment', () => {
  const m=getModelArchitecture('qwen3-30b-a3b')
  const weights={ [precisionKey('moe','experts.down_proj')]:'int4', [precisionKey('gqa','q_proj')]:'int8' }
  const state=parseExplorer(new URLSearchParams('tp=8&ep=8&view=weights'),m).state
  state.mixed=policy(m.id,weights)
  const parsed=parseExplorer(explorerParams(state),m)
  assert.deepEqual(parsed.notices,[])
  assert.deepEqual(parsed.state.mixed,state.mixed)
  const shrunk=explorerParams({...state,ep:1})
  const result=parseExplorer(shrunk,m)
  assert.equal(result.state.mixed.weights[precisionKey('moe','experts.down_proj')],undefined)
  assert.equal(result.state.mixed.weights[precisionKey('gqa','q_proj')],'int8')
  assert.equal(result.notices.length,1)
  assert.equal(parseExplorer(explorerParams(state),getModelArchitecture('qwen3-8b')).state.mixed.weights,undefined)
  for(const raw of ['{}','[[]]','["x"]',JSON.stringify([['__proto__','int8']]),JSON.stringify(Array(257).fill(['all/gqa/q_proj','int8'])),'x'.repeat(24001)]) {
    const p=explorerParams(state);p.set('pw',raw)
    assert.ok(parseExplorer(p,m).notices.length)
    assert.equal(parseExplorer(p,m).state.mixed.weights,undefined)
  }
})

test('DPA uses attention TP for per-weight scales and preserves layer overrides on reload', () => {
  const id='qwen3-8b',m=getModelArchitecture(id)
  const state=parseDpa(new URLSearchParams('tp=8&dp=4&layer=3'),id).state
  state.mixed=policy(id,{[precisionKey('gqa','k_proj')]:'int8',[precisionKey('ffn','down_proj',3)]:'nvfp4'})
  const parsed=parseDpa(dpaParams(state,id),id)
  assert.deepEqual(parsed.notices,[]);assert.deepEqual(parsed.state.mixed,state.mixed)
  const data=dpaLayout(state,id)
  const kv=data.weights.find(w=>w.name.startsWith('k_proj /'))
  assert.equal(kv.storage.bytes,512*4096+512*4+512*4096*2)
  const one={...state,dp:1,requests:[2]}
  const ordinary=decoderWeightBudget(m,3,8,16,1,state.mixed)
  assert.equal(dpaLayout(one,id).allLayersWeightBytes,ordinary.allLayersBytes)
})

test('routed overrides disable fused W4 processing while other overrides preserve it', () => {
  const m=getModelArchitecture('glm-5-2'),state=parseExplorer(new URLSearchParams('layer=3&tp=4&precision=mixed&experts=w4afp8&w4stage=processed'),m).state
  state.mixed={...state.mixed,modelId:m.id,weights:{[precisionKey('moe','experts.up_proj')]:'bf16'}}
  const parsed=parseExplorer(explorerParams(state),m)
  assert.equal(parsed.state.mixed.w4Stage,undefined)
  assert.ok(parsed.notices.some(n=>n.includes('后处理')))
  const rank=rankModule(m,3,'moe',scenario,16,1,1,parsed.state.mixed)
  assert.equal(rank.weights.find(w=>w.routedExpert).storage.processed,false)
  state.mixed.weights={[precisionKey('moe','gate.weight')]:'bf16'}
  assert.equal(parseExplorer(explorerParams(state),m).state.mixed.w4Stage,'processed')
})

test('new module formats reconcile whole-layer sums across supported models', () => {
  for(const id of ['glm-5-2','glm-5-3-flash','kimi-k3','deepseek-v4-flash','qwen3-8b','qwen3-30b-a3b']) for(const format of matrixPrecisions) {
    const m=getModelArchitecture(id),mixed={mlp:format,shared:format,experts:format}
    const ep=m.execution.expertParallel ? 4 : 1
    const b=decoderWeightBudget(m,3,4,16,ep,mixed)
    assert.ok(Number.isSafeInteger(b.allLayersBytes)&&b.allLayersBytes>0)
    for(const row of b.rows) assert.equal(rankModule(m,3,row.node.id,scenario,16,2,ep,mixed).localBytes,row.bytes)
  }
})
