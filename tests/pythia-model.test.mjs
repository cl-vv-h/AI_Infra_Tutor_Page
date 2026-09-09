import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderGroups, decoderNodes, formatShape } from '../src/lib/model-lab.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { catalogComparisonHref, emptyCatalog, filterCatalog } from '../src/lib/model-catalog.ts'
import { explorerHref, moduleIndex, parseExplorer } from '../src/lib/model-explorer.ts'
import { compareEstimate } from '../src/lib/model-comparison.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'

const model = modelArchitectures.find((item) => item.id === 'pythia-1-4b')
const scenario = { phase: 'decode', batch: 4, sequence: 2048, tp: 4, cacheBytes: 2 }
const h = 2048, i = 8192

test('Pythia checkpoint has 24 parallel-residual MHA layers and a strict 2K context', () => {
  assert.ok(model)
  assert.deepEqual(model.dimensions, { hiddenSize: h, vocabSize: 50304, layers: 24, attentionHeads: 16, kvHeads: 16, headDim: 128, intermediateSize: i })
  assert.equal(model.execution.maxContext, 2048)
  assert.equal(model.execution.residualLayout, 'parallel')
  assert.equal(model.execution.normKind, 'layernorm')
  assert.match(model.implementationUrl, /v4\.57\.1.*gpt_neox/)
  assert.equal(parseExplorer(new URLSearchParams(), model).state.scenario.sequence, 2048)
  assert.equal(compareEstimate(model, { ...scenario, sequence: 2049 }).estimate, null)
  assert.ok(parseExplorer(new URLSearchParams('s=4096'), model).notices.some((text) => text.includes('s 参数无效')))
})

test('every layer forks into two Norm branches and merges once with x, without serial residual nodes', () => {
  for (let layer = 0; layer < 24; layer++) {
    assert.equal(attentionKind(model, layer), 'mha')
    const nodes = decoderNodes(model, layer)
    assert.deepEqual(nodes.map((node) => node.id), ['attention-norm', 'mha', 'ffn-norm', 'ffn', 'parallel-add'])
    assert.deepEqual(decoderGroups(model, layer).map((branch) => branch.map((node) => node.id)), [['attention-norm', 'mha'], ['ffn-norm', 'ffn']])
    const merge = nodes.at(-1)
    assert.equal(formatShape(merge.inputShape, model, scenario), '[4, 2048] + [4, 2048] + [4, 2048]')
    assert.equal(formatShape(merge.outputShape, model, { ...scenario, phase: 'prefill' }), '[8192, 2048]')
    assert.equal(merge.weights.length, 0)
    assert.equal(merge.tensors.length, 3)
    const norms = nodes.filter((node) => node.id.endsWith('-norm'))
    assert.equal(norms.length, 2)
    assert.ok(norms.every((node) => node.weights.length === 2 && node.weights.some((weight) => weight.name.includes('.bias'))))
    assert.notEqual(norms[0].weights[0].name, norms[1].weights[0].name)
    assert.match(norms[1].description, /原始层输入 x，而非 x\+A/)
  }
})

test('head-interleaved QKV and partial RoPE preserve complete 128D K/V', () => {
  const attention = model.nodes.find((node) => node.id === 'mha')
  const cache = model.nodes.find((node) => node.id === 'kv-cache')
  for (const tp of model.supportedTp) {
    const input = { ...scenario, tp }
    assert.equal(formatShape(attention.weights[0].shape, model, input), `[${16 / tp} × 3 × 128, 2048]`)
    assert.equal(formatShape(attention.tensors[0].shape, model, input), `[4, ${16 / tp}, 3 × 128]`)
    assert.equal(formatShape(attention.tensors[1].shape, model, input), `[4, ${16 / tp}, 32]`)
    assert.equal(formatShape(attention.tensors[2].shape, model, input), `[4, ${16 / tp}, 96]`)
    assert.equal(formatShape(attention.tensors[3].shape, model, input), `[4, ${16 / tp}, 128]`)
    assert.equal(formatShape(cache.outputShape, model, input), `[4, 2048, 2, ${16 / tp}, 128]`)
  }
})

test('weight ledger includes four linear biases and two distinct biased Norms; embeddings remain untied', () => {
  const global = 4 * h * h + 2 * h * i + 3 * h + h + i + h + 4 * h
  assert.equal(global, 50358272)
  // The official non-embedding count also includes the final LayerNorm.
  assert.equal(global * 24 + 2 * h, 1208602624)
  for (const tp of model.supportedTp) {
    const local = (4 * h * h + 2 * h * i + 3 * h + i) / tp + 6 * h
    const budget = decoderWeightBudget(model, 23, tp, 16)
    assert.equal(budget.global, global)
    assert.equal(budget.local, local)
    assert.equal(budget.bytes, 2 * local)
    assert.equal(budget.allLayersLocal, 24 * local)
    assert.equal(budget.rows.length, 4)
    const ffn = budget.rows.find((row) => row.node.id === 'ffn')
    assert.equal(ffn.local, (2 * h * i + i) / tp + h)
    assert.equal(ffn.weights.filter((weight) => weight.name.includes('.weight')).length, 2)
  }
  const embedding = model.nodes.find((node) => node.id === 'embedding')
  const output = model.nodes.find((node) => node.id === 'lm-head')
  assert.equal(embedding.weights[0].name, 'gpt_neox.embed_in.weight')
  assert.match(output.weights.at(-1).name, /^embed_out.weight · untied/)
  assert.ok(!output.weights.some((weight) => weight.name === 'embed_out.bias'))
})

test('parallel MLP adds no second KV cache; capacity respects 2K rather than rotary dimension', () => {
  for (const tp of model.supportedTp) for (const cacheBytes of [1, 2]) {
    const input = { ...scenario, tp, cacheBytes }
    const expected = 4 * 2048 * 2 * (16 / tp) * 128 * 24 * cacheBytes
    assert.equal(cacheEstimate(model, input).perRankBytes, expected)
    assert.equal(cacheEstimate(model, input).allRankBytes, expected * tp)
    assert.equal(planCacheCapacity(model, input, expected).maximumBatch, 4)
    assert.equal(planCacheCapacity(model, input, expected).maximumSequence, 2048)
    assert.equal(planCacheCapacity(model, input, expected - 1).maximumSequence, 2047)
  }
  assert.equal(cacheEstimate(model, scenario).perRankBytes, 384 * 1024 ** 2)
})

test('parallel merge and weights are searchable, shareable and compared at valid common context', () => {
  for (const query of ['Pythia', 'Parallel Residual', 'query_key_value', 'dense_h_to_4h']) assert.ok(filterCatalog(modelArchitectures, { ...emptyCatalog, query }).includes(model), query)
  for (const target of moduleIndex(model)) for (const view of ['cache', 'weights']) {
    const state = { layer: 23, nodeId: target.node.id, scenario, weightBits: 8, cacheBudgetGiB: 0.5, view }
    const parsed = parseExplorer(new URL(explorerHref(model.id, state), 'https://example.org').searchParams, model)
    assert.deepEqual(parsed.notices, [])
    assert.deepEqual(parsed.state, state)
  }
  assert.equal(moduleIndex(model).length, 8)
  const url = new URL(catalogComparisonHref(['pythia-1-4b', 'starcoder2-3b'], modelArchitectures), 'https://example.org')
  assert.equal(url.searchParams.get('s'), '2048')
})
