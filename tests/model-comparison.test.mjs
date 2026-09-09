import test from 'node:test'
import assert from 'node:assert/strict'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { cacheEstimate } from '../src/lib/model-lab.ts'
import { compareEstimate, comparisonHref, comparisonParams, comparisonSeries, contextProbes, defaultComparisonIds, defaultComparisonScenario, memoryValue, parseComparison } from '../src/lib/model-comparison.ts'

const parse = (query = '') => parseComparison(new URLSearchParams(query), modelArchitectures)
const model = getModelArchitecture
const MiB = 1024 ** 2

test('default comparison covers GQA, MLA and hybrid with exactly the same workload', () => {
  const state = parse()
  assert.deepEqual(state.modelIds, defaultComparisonIds)
  assert.deepEqual(state.scenario, defaultComparisonScenario)
  assert.deepEqual(state.notices, [])
  assert.equal(compareEstimate(model('llama-3-1-8b'), state.scenario).estimate.perRankBytes, 1024 * MiB)
  assert.equal(compareEstimate(model('glm-4-7-flash'), state.scenario).estimate.perRankBytes, 1692 * MiB)
  const hybrid = compareEstimate(model('qwen3-5-9b'), state.scenario).estimate
  assert.equal(hybrid.kvBytes, 256 * MiB)
  assert.equal(hybrid.recurrentBytes, 48 * MiB)
  assert.equal(hybrid.convBytes, 1.5 * MiB)
  assert.equal(hybrid.perRankBytes, 305.5 * MiB)
})

test('share links round-trip all selected models, ordering, workload and memory scope', () => {
  for (const tp of [1, 2, 4, 8]) {
    for (const scope of ['rank', 'group']) {
      const state = { modelIds: ['qwen3-5-35b-a3b', 'deepseek-v3'], scenario: { batch: 32, sequence: 65536, tp, cacheBytes: 1, phase: 'decode' }, scope }
      const { notices, ...restored } = parseComparison(comparisonParams(state), modelArchitectures)
      assert.deepEqual(restored, state)
      assert.deepEqual(notices, [])
    }
  }
})

test('explorer handoff retains its current workload and puts current model first', () => {
  const scenario = { ...defaultComparisonScenario, batch: 8, tp: 8, sequence: 32768, cacheBytes: 1, phase: 'prefill' }
  const href = comparisonHref('qwen3-30b-a3b', scenario)
  assert.ok(href.startsWith('/models/compare?'))
  const state = parse(href.split('?')[1])
  assert.equal(state.modelIds[0], 'qwen3-30b-a3b')
  assert.equal(state.scenario.phase, 'decode')
  assert.deepEqual({ ...state.scenario, phase: 'prefill' }, scenario)
})

test('malformed links cannot create duplicate/unknown models or unsafe numerical state', () => {
  const values = ['-1', '0', '1.5', 'Infinity', 'NaN', '1e4', '9999999999999999', '<script>', '', ' 4 ']
  for (const value of values) {
    const state = parse(`models=missing,missing&b=${encodeURIComponent(value)}&s=${encodeURIComponent(value)}&tp=${encodeURIComponent(value)}&bytes=${encodeURIComponent(value)}&view=unknown`)
    assert.deepEqual(state.scenario, defaultComparisonScenario)
    assert.equal(state.modelIds.length, 2)
    assert.equal(new Set(state.modelIds).size, 2)
    assert.equal(state.scope, 'rank')
    assert.ok(state.notices.length >= 5)
  }
  const trimmed = parse(`models=${modelArchitectures.map((item) => item.id).join(',')}`)
  assert.equal(trimmed.modelIds.length, 3)
  assert.ok(trimmed.notices.length)
  const duplicate = parse('models=qwen3-8b,qwen3-8b')
  assert.equal(new Set(duplicate.modelIds).size, 2)
  assert.equal(duplicate.modelIds[0], 'qwen3-8b')
})

test('out-of-config contexts and uncovered TP are rejected without clamping conditions', () => {
  const scenario = Object.freeze({ ...defaultComparisonScenario, sequence: 65536, tp: 8 })
  const qwen = compareEstimate(model('qwen3-8b'), scenario)
  assert.equal(qwen.estimate, null)
  assert.match(qwen.reasons.join(''), /40,960/)
  const glm = compareEstimate(model('glm-4-7-flash'), scenario)
  assert.equal(glm.estimate, null)
  assert.match(glm.reasons.join(''), /TP 8/)
  assert.ok(compareEstimate(model('qwen3-5-9b'), scenario).estimate)
  assert.equal(scenario.sequence, 65536)
  assert.equal(scenario.tp, 8)
  for (const bad of [{ batch: 0 }, { batch: 65 }, { batch: 1.1 }, { sequence: 512 }, { sequence: NaN }, { cacheBytes: 4 }, { tp: 3 }]) {
    assert.equal(compareEstimate(model('qwen3-5-9b'), { ...scenario, ...bad }).estimate, null)
  }
})

test('comparison agrees with the existing model explorer for every covered model and TP', () => {
  for (const item of modelArchitectures) {
    for (const tp of item.supportedTp) {
      for (const batch of [1, 4, 64]) {
        for (const cacheBytes of [1, 2]) {
          for (const sequence of [1024, 4096, item.execution.maxContext]) {
            const scenario = { batch, sequence, tp, cacheBytes, phase: 'decode' }
            const result = compareEstimate(item, scenario)
            assert.deepEqual(result.reasons, [])
            assert.deepEqual(result.estimate, cacheEstimate(item, scenario))
            assert.equal(memoryValue(result.estimate, 'group'), memoryValue(result.estimate, 'rank') * tp)
          }
        }
      }
    }
  }
})

test('FP8 changes KV only; TP replication remains visible in group totals', () => {
  const qwen = model('qwen3-5-35b-a3b')
  const a = compareEstimate(qwen, defaultComparisonScenario).estimate
  const b = compareEstimate(qwen, { ...defaultComparisonScenario, tp: 8 }).estimate
  assert.equal(a.kvBytes, b.kvBytes)
  assert.equal(a.recurrentBytes, b.recurrentBytes * 2)
  assert.ok(memoryValue(b, 'group') > memoryValue(a, 'group'))
  const fp8 = compareEstimate(qwen, { ...defaultComparisonScenario, cacheBytes: 1 }).estimate
  assert.equal(fp8.kvBytes, a.kvBytes / 2)
  assert.equal(fp8.recurrentBytes, a.recurrentBytes)
  assert.equal(fp8.convBytes, a.convBytes)
})

test('growth curves use exact shared estimates and stop at each model boundary', () => {
  for (const item of modelArchitectures) {
    const scenario = { ...defaultComparisonScenario, sequence: 262144 }
    const points = comparisonSeries(item, scenario)
    assert.equal(points.at(-1).sequence, item.execution.maxContext)
    assert.ok(points.every((point) => point.sequence >= 1024 && point.sequence <= item.execution.maxContext))
    assert.equal(new Set(points.map((point) => point.sequence)).size, points.length)
    for (const point of points) {
      const { sequence, ...estimate } = point
      assert.deepEqual(estimate, cacheEstimate(item, { ...scenario, sequence }))
    }
    for (const size of contextProbes.filter((size) => size <= item.execution.maxContext)) assert.ok(points.some((point) => point.sequence === size))
  }
  assert.deepEqual(comparisonSeries(model('glm-4-7-flash'), { ...defaultComparisonScenario, tp: 8 }), [])
})
