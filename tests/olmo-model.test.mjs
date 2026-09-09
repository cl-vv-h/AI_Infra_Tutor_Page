import assert from 'node:assert/strict'
import test from 'node:test'
import { olmoArchitectures } from '../src/data/olmo-models.ts'
import { getModelArchitecture, modelArchitectures } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, cacheKvHeads, decoderGroups, decoderNodes, formatShape, localKvHeads } from '../src/lib/model-lab.ts'
import { decoderWeightBudget, weightElements } from '../src/lib/model-weights.ts'
import { compareEstimate, comparisonSeries } from '../src/lib/model-comparison.ts'
import { explorerHref, findModules, moduleIndex, parseExplorer } from '../src/lib/model-explorer.ts'
import { emptyCatalog, filterCatalog } from '../src/lib/model-catalog.ts'

const olmo = olmoArchitectures[0]
const scenario = { phase: 'decode', batch: 4, sequence: 4096, tp: 4, cacheBytes: 2 }
const node = (id) => olmo.nodes.find((entry) => entry.id === id)

test('OLMo 2 checkpoint dimensions, context and versioned reference are explicit', () => {
  assert.equal(getModelArchitecture(olmo.id), olmo)
  assert.deepEqual(olmo.dimensions, { hiddenSize: 4096, vocabSize: 100352, layers: 32, attentionHeads: 32, kvHeads: 32, headDim: 128, intermediateSize: 11008 })
  assert.equal(olmo.execution.maxContext, 4096)
  assert.equal(olmo.execution.normLayout, 'post-branch-qk')
  assert.equal(olmo.execution.cache.layout, 'replicated')
  assert.match(olmo.configUrl, /allenai\/OLMo-2-1124-7B/)
  assert.match(olmo.implementationUrl, /v4.57.1/)
})

test('every layer has QK Norm after projection and branch Norm before each residual, with no pre-Norm', () => {
  for (let layer = 0; layer < 32; layer++) {
    assert.equal(attentionKind(olmo, layer), 'mha')
    assert.deepEqual(decoderGroups(olmo, layer).map((group) => group.map((item) => item.id)), [
      ['attention-projection', 'qk-norm', 'mha', 'attention-post-norm', 'attention-add'],
      ['ffn', 'ffn-post-norm', 'ffn-add'],
    ])
    assert.ok(!decoderNodes(olmo, layer).some((item) => ['attention-norm', 'ffn-norm'].includes(item.id)))
  }
  assert.match(node('attention-post-norm').description, /最后与.*残差输入相加/)
  assert.match(node('ffn').description, /没有额外 FFN 输入 Norm/)
})

test('Q/K Norm weights cover flattened width and remain replicated while QKV projection weights shard', () => {
  for (const tp of olmo.supportedTp) {
    assert.equal(weightElements(node('qk-norm').weights[0], olmo, tp), 2 * 4096)
    assert.equal(weightElements(node('attention-projection').weights[0], olmo, tp), 3 * 4096 ** 2 / tp)
    assert.equal(localKvHeads(olmo, tp), 32 / tp)
    assert.equal(cacheKvHeads(olmo, tp), 32)
    assert.equal(formatShape(node('attention-projection').tensors[0].shape, olmo, { ...scenario, tp }), `[4, ${32 / tp} × 128]`)
    assert.equal(formatShape(node('attention-projection').tensors[1].shape, olmo, { ...scenario, tp }), '[4, 4096]')
    assert.equal(formatShape(node('qk-norm').tensors[0].shape, olmo, { ...scenario, tp }), '[4, 1]')
  }
  assert.match(node('qk-norm').description, /V 不归一化/)
  assert.equal(formatShape(node('qk-norm').outputShape, olmo, { ...scenario, phase: 'prefill' }), 'Q / K each [16384, 32, 128]')
})

test('gathered attention cache does not shrink with TP; group storage counts complete copies', () => {
  const llama = getModelArchitecture('llama-3-1-8b')
  for (const tp of olmo.supportedTp) for (const sequence of [1024, 4096]) {
    const input = { ...scenario, tp, sequence }
    const estimate = cacheEstimate(olmo, input)
    const expected = 4 * sequence * 32 * 2 * 32 * 128 * 2
    assert.equal(estimate.perRankBytes, expected)
    assert.equal(estimate.allRankBytes, expected * tp)
    assert.equal(estimate.valuesPerTokenPerLayer, 8192)
    assert.equal(estimate.perRankBytes / cacheEstimate(llama, input).perRankBytes, 4 * tp)
    assert.equal(cacheEstimate(olmo, { ...input, cacheBytes: 1 }).perRankBytes, expected / 2)
    assert.equal(formatShape(node('kv-cache').outputShape, olmo, input), `[4, ${sequence}, 2, 32, 128]`)
  }
  assert.equal(cacheEstimate(olmo, scenario).perRankBytes, 8 * 1024 ** 3)
  assert.equal(cacheEstimate(olmo, scenario).allRankBytes, 32 * 1024 ** 3)
  assert.equal(compareEstimate(olmo, { ...scenario, sequence: 4097 }).estimate, null)
  assert.equal(comparisonSeries(olmo, { ...scenario, sequence: 32768 }).at(-1).sequence, 4096)
})

test('decoder weight budget counts exactly four Norm vectors and seven projection matrices', () => {
  const matrixCount = 4 * 4096 ** 2 + 3 * 4096 * 11008
  for (const tp of olmo.supportedTp) {
    const budget = decoderWeightBudget(olmo, 31, tp, 16)
    assert.equal(budget.global, matrixCount + 4 * 4096)
    assert.equal(budget.local, matrixCount / tp + 4 * 4096)
    assert.equal(budget.allLayersGlobal, 32 * (matrixCount + 4 * 4096))
    assert.equal(budget.bytes, 2 * (matrixCount / tp + 4 * 4096))
    assert.equal(budget.rows.flatMap((row) => row.weights).filter((weight) => /norm/.test(weight.name)).reduce((sum, weight) => sum + weight.copies, 0), 4)
    assert.ok(!budget.rows.some((row) => row.node.id === 'embedding' || row.node.id === 'lm-head'))
  }
  assert.equal(formatShape(node('lm-head').weights[1].shape, olmo, scenario), '[25088, 4096]')
})

test('catalog and module search expose full-width QK Norm; every module deep link restores state', () => {
  assert.deepEqual(filterCatalog(modelArchitectures, { ...emptyCatalog, query: 'OLMo q_norm' }).map((model) => model.id), [olmo.id])
  const index = moduleIndex(olmo)
  assert.equal(findModules(index, 'q_norm')[0].node.id, 'qk-norm')
  assert.equal(findModules(index, 'post_feedforward_layernorm')[0].node.id, 'ffn-post-norm')
  for (const target of index) {
    const state = { layer: 31, nodeId: target.node.id, scenario, weightBits: 8 }
    const parsed = parseExplorer(new URL(explorerHref(olmo.id, state), 'https://example.org').searchParams, olmo)
    assert.deepEqual(parsed.state, state)
    assert.deepEqual(parsed.notices, [])
  }
  const invalid = parseExplorer(new URLSearchParams('node=attention-norm&s=8192'), olmo)
  assert.equal(invalid.state.nodeId, 'mha')
  assert.equal(invalid.state.scenario.sequence, 4096)
  assert.equal(invalid.notices.length, 2)
})
