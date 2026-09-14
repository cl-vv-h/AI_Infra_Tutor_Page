import assert from 'node:assert/strict'
import test from 'node:test'
import { getModelArchitecture } from '../src/data/models.ts'
import { cacheEstimate, decoderNodes, formatShape } from '../src/lib/model-lab.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'
import { compareEstimate, comparisonParams, parseComparison } from '../src/lib/model-comparison.ts'
import { modelArchitectures } from '../src/data/models.ts'

const model = getModelArchitecture('glm-5-2')
const base = { batch: 4, sequence: 4096, tp: 4, phase: 'decode', cacheBytes: 2 }

test('GLM-5.2 exact configuration and three-dense boundary, not a GLM-4.7 alias', () => {
  assert.equal(model.id, 'glm-5-2')
  assert.deepEqual(model.dimensions, { hiddenSize: 6144, vocabSize: 154880, layers: 78, attentionHeads: 64, kvHeads: 64, headDim: 256, intermediateSize: 12288 })
  assert.equal(model.execution.maxContext, 1048576)
  for (let layer = 0; layer < 78; layer++) assert.equal(decoderNodes(model, layer)[4].id, layer < 3 ? 'dense-ffn' : 'moe')
  assert.equal(model.nodes.find(n => n.id === 'lm-head').description.includes('第 79 个'), true)
})

test('DSA accounts for full-history index K in every rank, independently of Top-k', () => {
  for (const tp of [1, 2, 4, 8]) for (const sequence of [1024, 2048, 4096, 1048576]) for (const cacheBytes of [1, 2]) {
    const scenario = { ...base, tp, sequence, cacheBytes }
    const e = cacheEstimate(model, scenario)
    assert.equal(e.kvBytes, 4 * sequence * 78 * 576 * cacheBytes)
    assert.equal(e.indexBytes, 4 * sequence * 78 * 128 * cacheBytes)
    assert.equal(e.perRankBytes, 4 * sequence * 78 * 704 * cacheBytes)
    assert.equal(e.allRankBytes, e.perRankBytes * tp)
    assert.equal(e.bytesPerToken, 78 * 704 * cacheBytes)
    assert.equal(e.growthBytesPerToken, 78 * 704 * cacheBytes)
    assert.equal(e.perRankBytes, cacheEstimate(model, { ...scenario, phase: 'prefill' }).perRankBytes)
  }
  const e = cacheEstimate(model, base)
  assert.equal(e.kvBytes, 1404 * 1024 ** 2)
  assert.equal(e.indexBytes, 312 * 1024 ** 2)
  assert.equal(e.perRankBytes, 1716 * 1024 ** 2)
  const budget = e.perRankBytes
  const plan = planCacheCapacity(model, base, budget)
  assert.equal(plan.maximumSequence, 4096)
  assert.equal(plan.maximumBatch, 4)
})

test('GLM indexer stays replicated while main projection heads are sharded', () => {
  const attention = model.nodes.find(n => n.id === 'mla')
  for (const tp of model.supportedTp) {
    assert.equal(formatShape(attention.weights.find(w => w.name.startsWith('indexer.wq_b')).shape, model, { ...base, tp }), '[32 × 128, 2048]')
    assert.equal(formatShape(attention.weights.find(w => w.name.startsWith('q_b_proj')).shape, model, { ...base, tp }), `[${64 / tp} × 256, 2048]`)
    const budget = decoderWeightBudget(model, 3, tp, 16)
    const row = budget.rows.find(row => row.node.id === 'mla')
    const replicated = (2048 + 576) * 6144 + 2048 + 512 + 32 * 128 * 2048 + 128 * 6144 + 32 * 6144 + 128 * 2
    const sharded = 64 * 256 * 2048 + 64 * 448 * 512 + 6144 * 64 * 256
    assert.equal(row.local, replicated + sharded / tp)
    assert.equal(row.global, replicated + sharded)
    const experts = budget.rows.find(row => row.node.id === 'moe')
    assert.equal(experts.local, 256 * 6144 + 256 + 257 * 3 * 2048 * 6144 / tp)
    assert.equal(budget.complete, true)
  }
})

test('one-million context comparison round-trips without relaxing other model limits', () => {
  const scenario = { ...base, sequence: 1048576 }
  const params = comparisonParams({ modelIds: ['glm-5-2', 'deepseek-v3'], scenario, scope: 'rank' })
  const restored = parseComparison(params, modelArchitectures)
  assert.deepEqual(restored.notices, [])
  assert.equal(restored.scenario.sequence, 1048576)
  assert.ok(compareEstimate(model, scenario).estimate)
  assert.equal(compareEstimate(getModelArchitecture('deepseek-v3'), scenario).estimate, null)
  assert.equal(compareEstimate(model, { ...scenario, sequence: 1048577 }).estimate, null)
  assert.ok(parseComparison(new URLSearchParams('s=1048577'), modelArchitectures).notices.length)
})
