import assert from 'node:assert/strict'
import test from 'node:test'
import { phiArchitectures } from '../src/data/phi-models.ts'
import { getModelArchitecture } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderNodes, formatShape, layerCacheNode } from '../src/lib/model-lab.ts'
import { decoderWeightBudget, weightElements } from '../src/lib/model-weights.ts'
import { compareEstimate } from '../src/lib/model-comparison.ts'
import { explorerHref, findModules, moduleIndex, parseExplorer } from '../src/lib/model-explorer.ts'

const phi = phiArchitectures[0]
const scenario = { phase: 'decode', batch: 4, sequence: 4096, tp: 4, cacheBytes: 2 }

test('Phi checkpoint geometry and every layer resolve to MHA and Dense, never GQA grouping or MoE', () => {
  assert.deepEqual(phi.dimensions, { hiddenSize: 3072, vocabSize: 32064, layers: 32, attentionHeads: 32, kvHeads: 32, headDim: 96, intermediateSize: 8192 })
  assert.equal(phi.execution.maxContext, 131072)
  assert.ok(phi.configUrl.includes('microsoft/Phi-3.5-mini-instruct'))
  for (let layer = 0; layer < 32; layer++) {
    assert.equal(attentionKind(phi, layer), 'mha')
    assert.deepEqual(decoderNodes(phi, layer).map((node) => node.id), ['attention-norm', 'mha', 'attention-add', 'ffn-norm', 'ffn', 'ffn-add'])
    assert.equal(layerCacheNode(phi, layer).id, 'kv-cache')
  }
})

test('fused QKV is three head shards and SwiGLU retains all three projections', () => {
  const mha = phi.nodes.find((node) => node.id === 'mha')
  const ffn = phi.nodes.find((node) => node.id === 'ffn')
  for (const tp of phi.supportedTp) {
    assert.equal(weightElements(mha.weights[0], phi, tp), 3 * 3072 * 3072 / tp)
    assert.equal(weightElements(mha.weights[1], phi, tp), 3072 * 3072 / tp)
    assert.equal(ffn.weights.reduce((sum, weight) => sum + weightElements(weight, phi, tp), 0), 3 * 3072 * 8192 / tp)
    assert.ok(mha.weights.every((weight) => !weight.name.includes('norm')))
  }
  assert.equal(formatShape(mha.tensors[1].shape, phi, scenario), '[4, 8, 96]')
  assert.equal(formatShape(mha.tensors[1].shape, phi, { ...scenario, phase: 'prefill' }), '[16384, 8, 96]')
  assert.equal(formatShape(phi.nodes.find((node) => node.id === 'lm-head').weights[1].shape, phi, scenario), '[8016, 3072]')
})

test('MHA KV is exactly three times Llama GQA at common conditions and keeps growing beyond 4K', () => {
  const llama = getModelArchitecture('llama-3-1-8b')
  for (const tp of phi.supportedTp) for (const sequence of [4096, 4097, 32768, 131072]) {
    const input = { ...scenario, tp, sequence }
    const value = cacheEstimate(phi, input)
    assert.equal(value.perRankBytes, 4 * sequence * 32 * 2 * (32 / tp) * 96 * 2)
    assert.equal(value.perRankBytes, cacheEstimate(llama, input).perRankBytes * 3)
    assert.equal(value.slidingLayers, 0)
    assert.equal(value.retainedTokens, sequence)
    assert.equal(cacheEstimate(phi, { ...input, cacheBytes: 1 }).perRankBytes, value.perRankBytes / 2)
  }
  assert.equal(cacheEstimate(phi, scenario).perRankBytes, 1.5 * 1024 ** 3)
  assert.equal(compareEstimate(phi, { ...scenario, sequence: 131073 }).estimate, null)
  assert.equal(compareEstimate(phi, { ...scenario, sequence: 262144 }).estimate, null)
})

test('weight ledger matches independent parameter arithmetic and excludes RoPE configuration', () => {
  const layerGlobal = 4 * 3072 ** 2 + 3 * 3072 * 8192 + 2 * 3072
  const budget = decoderWeightBudget(phi, 31, 4, 16)
  assert.equal(budget.global, layerGlobal)
  assert.equal(budget.local, (4 * 3072 ** 2 + 3 * 3072 * 8192) / 4 + 2 * 3072)
  assert.equal(budget.allLayersGlobal, layerGlobal * 32)
  assert.equal(layerGlobal * 32 + 2 * 32064 * 3072 + 3072, 3821079552)
  assert.ok(!budget.rows.flatMap((row) => row.weights).some((weight) => /factor|rope/i.test(weight.name)))
  assert.equal(phi.nodes.find((node) => node.id === 'mha').tensors.find((tensor) => tensor.label.includes('short_factor')).shape, '[48]')
})

test('MHA, fused projections and cache are searchable and all Phi deep links retain conditions', () => {
  const index = moduleIndex(phi)
  assert.equal(findModules(index, 'qkv_proj')[0].node.id, 'mha')
  assert.equal(findModules(index, 'gate_up_proj')[0].node.id, 'ffn')
  assert.equal(findModules(index, 'longrope')[0].node.id, 'mha')
  assert.equal(index.find((target) => target.node.id === 'mha').layers.length, 32)
  for (const target of index) {
    const state = { layer: 31, nodeId: target.node.id, scenario, weightBits: 4 }
    const parsed = parseExplorer(new URL(explorerHref(phi.id, state), 'https://example.org').searchParams, phi)
    assert.deepEqual(parsed.state, state)
    assert.deepEqual(parsed.notices, [])
  }
  const tooLong = parseExplorer(new URLSearchParams('s=262144&node=gqa'), phi)
  assert.equal(tooLong.state.nodeId, 'mha')
  assert.equal(tooLong.notices.length, 2)
})
