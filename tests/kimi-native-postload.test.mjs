import assert from 'node:assert/strict'
import test from 'node:test'
import { kimiNativePostload } from '../src/lib/kimi-native-postload.ts'
import { getModelArchitecture } from '../src/data/models.ts'
import { parseExplorer, explorerParams, explorerHref, selectExplorerLayer } from '../src/lib/model-explorer.ts'

test('all post-load native parameter inventories replace biases and add three local-expert parameters', () => {
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) for (const dp of [1, 2, 4, 8]) {
    const d = kimiNativePostload(tp, ep, dp, tp * dp - 1)
    const E = 896 / ep, I = 3072 / (tp / ep)
    assert.equal(d.expertBuffers.length, 9)
    assert.equal(d.processedExpertBytes, 92 * E * (3 * I * 3584 * (1 / 2 + 1 / 32) + (2 * I + 3584) * 4 + 12))
    assert.equal(d.parameterDeltaBytes, d.initial.addedBiasBytes + 92 * E * 12)
    for (const buffer of d.expertBuffers.slice(0, 4)) {
      const old = d.initial.expertBuffers.find(t => t.name === buffer.name)
      assert.deepEqual(buffer.shape, old.shape)
      assert.equal(buffer.bytes, old.bytes)
      assert.equal(buffer.dtype, buffer.name.endsWith('_scale') ? 'F8_E4M3FN view' : 'U8')
    }
    for (const buffer of d.expertBuffers.slice(4, 6)) assert.equal(buffer.dtype, 'F32')
    for (const buffer of d.expertBuffers.slice(6)) assert.deepEqual(buffer.shape, [E])
    assert.equal(d.trackedBytes, d.parameterBytes + d.persistentBytes)
    assert.equal(d.groupBytes, d.trackedBytes * tp)
    assert.equal(d.fleetBytes, d.trackedBytes * tp * dp)
  }
})

test('persistent tensors independently account for MLA copies, AttnRes, shared indices and TP8-only buffers', () => {
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) {
    const d = kimiNativePostload(tp, ep)
    const I = 3072 / (tp / ep)
    const mla = 24 * 96 / tp * 128 * 512 * 2 * 2
    const attnres = (93 * 2 + 1) * 7168 * (2 + 4)
    const caches = 3 * (2 * I + 3584) * 8
    const pad = tp === 8 ? 69 * 4 * 7168 * 2 : 0
    const fused = tp === 8 ? 69 * (3 * 4 * 1536 * 4 + 4608 * 4 + 128 * 4) : 0
    assert.equal(d.persistentBytes, mla + attnres + caches + pad + fused)
    assert.equal(d.permutationCaches.length, 6)
    assert.ok(d.permutationCaches.every(c => c.copies === 1 && c.dtype === 'I64'))
    assert.equal(d.permutationCaches.reduce((sum, c) => sum + c.totalBytes, 0), caches)
    assert.equal(d.persistent.filter(t => /fused decode/.test(t.name)).length, tp === 8 ? 3 : 0)
    assert.equal(d.persistent.filter(t => /padding/.test(t.name)).length, tp === 8 ? 1 : 0)
    assert.equal(d.persistent.filter(t => /A_log|merged front/.test(t.name)).length, 0, 'aliases do not add storage')
  }
  const d = kimiNativePostload(8, 8)
  assert.equal(d.parameterBytes, 206352354544)
  assert.equal(d.persistentBytes, 94124544)
  assert.equal(d.trackedBytes, 206446479088)
})

test('native stage shares safely without changing independent mixed formats or leaking to other models', () => {
  const model = getModelArchitecture('kimi-k3')
  const { state, notices } = parseExplorer(new URLSearchParams('native=processed&precision=mixed&experts=w4afp8&w4stage=processed&tp=8&ep=8&rank=7&view=weights'), model)
  assert.deepEqual(notices, [])
  assert.equal(state.nativeStage, 'processed')
  assert.equal(state.mixed.w4Stage, 'processed')
  assert.equal(parseExplorer(explorerParams(state), model).state.nativeStage, 'processed')
  assert.equal(selectExplorerLayer(model, state, 92).nativeStage, 'processed')
  assert.ok(!explorerParams({ ...state, nativeStage: undefined }).has('native'))
  assert.ok(explorerParams({ ...state, nativeStage: undefined }).has('w4stage'))
  assert.ok(!explorerHref('glm-5-2', state).includes('native='))
  for (const value of ['invalid', 'final', 'NaN']) {
    const result = parseExplorer(new URLSearchParams(`native=${value}`), model)
    assert.equal(result.state.nativeStage, undefined)
    assert.ok(result.notices.some(n => n.includes('原生加载阶段')))
  }
  assert.equal(parseExplorer(new URLSearchParams('native=processed'), getModelArchitecture('glm-5-2')).state.nativeStage, undefined)
})
