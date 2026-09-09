import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderNodes, formatShape } from '../src/lib/model-lab.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { emptyCatalog, filterCatalog, modelAttentionProfile } from '../src/lib/model-catalog.ts'
import { explorerHref, moduleIndex, parseExplorer } from '../src/lib/model-explorer.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'

const model = modelArchitectures.find((m) => m.id === 'starcoder2-3b')
const scenario = { phase: 'decode', batch: 4, sequence: 8192, tp: 4, cacheBytes: 2 }
const h = 3072, i = 12288, d = 128

test('StarCoder2 uses the 3B checkpoint geometry and supported 16K context', () => {
  assert.ok(model)
  assert.deepEqual(model.dimensions, { hiddenSize: h, vocabSize: 49152, layers: 30, attentionHeads: 24, kvHeads: 2, headDim: d, intermediateSize: i })
  assert.equal(model.execution.maxContext, 16384)
  assert.equal(model.execution.normKind, 'layernorm')
  assert.deepEqual(model.execution.cache, { kind: 'swa', window: 4096 })
  assert.match(model.implementationUrl, /v4\.57\.1.*starcoder2/)
  assert.equal(modelAttentionProfile(model), 'swa')
})

test('all 30 layers have two explicit LayerNorms with scale and bias, not an injected RMSNorm', () => {
  for (let layer = 0; layer < 30; layer++) {
    assert.equal(attentionKind(model, layer), 'swa')
    const nodes = decoderNodes(model, layer)
    assert.deepEqual(nodes.map((n) => n.id), ['attention-norm', 'swa', 'attention-add', 'ffn-norm', 'ffn', 'ffn-add'])
    for (const id of ['attention-norm', 'ffn-norm']) {
      const norm = nodes.find((n) => n.id === id)
      assert.match(norm.title, /LayerNorm/)
      assert.doesNotMatch(norm.title, /RMSNorm/)
      assert.equal(norm.weights.length, 2)
      assert.ok(norm.weights.some((w) => w.name.includes('.bias')))
      assert.ok(norm.weights.every((w) => w.shape === '[3,072]'))
    }
  }
})

test('biased GELU MLP has two matrices with no gate/up tensor or third matrix', () => {
  const ffn = model.nodes.find((n) => n.id === 'ffn')
  assert.match(ffn.title, /GELU MLP/)
  assert.deepEqual(ffn.weights.map((w) => w.name.split(' ·')[0]), ['c_fc.weight', 'c_fc.bias', 'c_proj.weight', 'c_proj.bias'])
  for (const tp of model.supportedTp) {
    const row = decoderWeightBudget(model, 0, tp, 16).rows.find((row) => row.node.id === 'ffn')
    assert.equal(row.global, 2 * h * i + i + h)
    assert.equal(row.local, 2 * h * i / tp + i / tp + h)
    assert.equal(formatShape(ffn.tensors[1].shape, model, { ...scenario, tp }), `[4, ${i / tp}]`)
  }
})

test('weight ledger includes all six linear biases and four Norm vectors with KV replication', () => {
  const global = 2 * h * h + 2 * h * 2 * d + 2 * h * i + (2 * h + 2 * 2 * d) + (i + h) + 4 * h
  for (const tp of model.supportedTp) {
    const kv = Math.max(1, 2 / tp) * d
    const local = 2 * h * h / tp + 2 * h * kv + 2 * h * i / tp + (h / tp + 2 * kv + h) + (i / tp + h) + 4 * h
    const result = decoderWeightBudget(model, 29, tp, 16)
    assert.equal(result.global, global)
    assert.equal(result.local, local)
    assert.equal(result.allLayersLocal, local * 30)
    assert.equal(result.allLayersGlobal, global * 30)
    assert.equal(result.bytes, local * 2)
    assert.ok(!result.rows.some((r) => ['embedding', 'lm-head'].includes(r.node.id)))
  }
  const output = model.nodes.find((n) => n.id === 'lm-head')
  assert.match(output.title, /Tied/)
  assert.ok(output.weights.some((w) => w.name === 'norm.bias'))
  assert.ok(!output.weights.some((w) => w.name.includes('lm_head.bias')))
})

test('sliding cache saturates at W, includes current position and stops shrinking after TP=2', () => {
  const rankBytes = 4 * 4096 * 2 * 1 * 128 * 30 * 2
  assert.equal(rankBytes, 240 * 1024 ** 2)
  for (const tp of [2, 4, 8]) {
    const full = cacheEstimate(model, { ...scenario, tp })
    assert.equal(full.perRankBytes, rankBytes)
    assert.equal(full.allRankBytes, rankBytes * tp)
    assert.equal(full.growthBytesPerToken, 0)
  }
  assert.equal(cacheEstimate(model, { ...scenario, tp: 1 }).perRankBytes, rankBytes * 2)
  assert.equal(cacheEstimate(model, { ...scenario, sequence: 2048 }).perRankBytes, rankBytes / 2)
  assert.equal(cacheEstimate(model, { ...scenario, cacheBytes: 1 }).perRankBytes, rankBytes / 2)
  const cache = model.nodes.find((n) => n.id === 'kv-cache')
  assert.equal(formatShape(cache.outputShape, model, scenario), '[4, 4096, 2, 1, 128]')
  assert.equal(planCacheCapacity(model, scenario, rankBytes).maximumSequence, 16384)
  assert.equal(planCacheCapacity(model, scenario, rankBytes - 1).maximumSequence, 4095)
})

test('catalog and every module deep link expose biased layers without changing selected state', () => {
  for (const query of ['StarCoder2', 'c_fc.bias', 'LayerNorm', 'GELU MLP']) assert.ok(filterCatalog(modelArchitectures, { ...emptyCatalog, query }).includes(model), query)
  for (const target of moduleIndex(model)) {
    const state = { layer: 29, nodeId: target.node.id, scenario, weightBits: 8, cacheBudgetGiB: 0.5 }
    const url = new URL(explorerHref(model.id, state), 'https://example.org')
    const parsed = parseExplorer(url.searchParams, model)
    assert.deepEqual(parsed.notices, [], target.node.id)
    assert.deepEqual(parsed.state, state)
  }
})
