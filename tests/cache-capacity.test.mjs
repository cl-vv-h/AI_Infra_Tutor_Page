import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { cacheEstimate } from '../src/lib/model-lab.ts'
import { gibibyte, parseCacheBudget, planCacheCapacity } from '../src/lib/cache-capacity.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'

const scenario = { phase: 'decode', batch: 4, sequence: 4096, tp: 4, cacheBytes: 2 }
const llama = getModelArchitecture('llama-3-1-8b')

test('budget accepts bounded decimals, rejects malformed or excessively precise input', () => {
  for (const [raw, value] of [['0', 0], ['8', 8], ['0.125', 0.125], ['1024.000', 1024], ['00.5', 0.5]]) assert.equal(parseCacheBudget(raw), value)
  for (const raw of ['', ' ', '-1', '1e3', 'Infinity', 'NaN', '0x10', '1.', '0.0001', '1024.001', '10000', '8GiB', '<script>']) assert.equal(parseCacheBudget(raw), null, raw)
})

test('Llama exact fit and one-byte shortfall are conservative integer boundaries', () => {
  const budget = gibibyte / 2
  const exact = planCacheCapacity(llama, scenario, budget)
  assert.equal(exact.perRequestBytes, gibibyte / 8)
  assert.equal(exact.maximumBatch, 4)
  assert.equal(exact.maximumSequence, 4096)
  assert.equal(exact.fits, true)
  assert.equal(exact.remainingBytes, 0)
  const short = planCacheCapacity(llama, scenario, budget - 1)
  assert.equal(short.maximumBatch, 3)
  assert.equal(short.maximumSequence, 4095)
  assert.equal(short.fits, false)
  assert.equal(short.deficitBytes, 1)
})

test('zero and too-small budgets do not offer invalid B=0 or out-of-tool sub-1K lengths', () => {
  const empty = planCacheCapacity(llama, scenario, 0)
  assert.equal(empty.maximumBatch, 0)
  assert.equal(empty.applicableBatch, 0)
  assert.equal(empty.maximumSequence, null)
  assert.equal(empty.contextLimited, false)
  const minimum = cacheEstimate(llama, { ...scenario, sequence: 1024 }).perRankBytes
  assert.equal(planCacheCapacity(llama, scenario, minimum).maximumSequence, 1024)
  assert.equal(planCacheCapacity(llama, scenario, minimum - 1).maximumSequence, null)
})

test('capacity is not capped at the UI limit, but application is bounded to B=64', () => {
  const value = planCacheCapacity(llama, scenario, 16 * gibibyte)
  assert.equal(value.maximumBatch, 128)
  assert.equal(value.applicableBatch, 64)
  assert.equal(value.maximumSequence, 131072)
  assert.equal(value.contextLimited, true)
})

test('sliding saturation reaches context bound instead of treating the window as max context', () => {
  const mistral = getModelArchitecture('mistral-7b-v0-1')
  const saturation = cacheEstimate(mistral, scenario).perRankBytes
  assert.equal(planCacheCapacity(mistral, scenario, saturation).maximumSequence, 32768)
  assert.equal(planCacheCapacity(mistral, scenario, saturation - 1).maximumSequence, 4095)
  const gemma = getModelArchitecture('gemma-2-9b')
  const mid = cacheEstimate(gemma, { ...scenario, sequence: 6000 }).perRankBytes
  assert.equal(planCacheCapacity(gemma, scenario, mid).maximumSequence, 6000)
  assert.equal(planCacheCapacity(gemma, scenario, mid - 1).maximumSequence, 5999)
})

test('hybrid fixed state is included; FP8 does not blindly double capacity', () => {
  const hybrid = getModelArchitecture('qwen3-5-9b')
  const input = { ...scenario, sequence: 1024 }
  const one = cacheEstimate(hybrid, { ...input, batch: 1 })
  const budget = one.perRankBytes * 4
  const bf16 = planCacheCapacity(hybrid, input, budget)
  const fp8 = planCacheCapacity(hybrid, { ...input, cacheBytes: 1 }, budget)
  assert.equal(bf16.maximumBatch, 4)
  assert.ok(fp8.maximumBatch < 8)
  assert.ok(one.recurrentBytes + one.convBytes > 0)
  assert.equal(fp8.perRequestBytes, one.kvBytes / 2 + one.recurrentBytes + one.convBytes)
})

test('per-card budget follows gathered MHA and latent MLA replication, not group division', () => {
  for (const id of ['olmo-2-1124-7b', 'glm-4-7-flash']) {
    const model = getModelArchitecture(id)
    const one = planCacheCapacity(model, { ...scenario, tp: 1 }, 8 * gibibyte)
    const four = planCacheCapacity(model, scenario, 8 * gibibyte)
    assert.equal(one.maximumBatch, four.maximumBatch)
    assert.equal(one.maximumSequence, four.maximumSequence)
  }
  assert.equal(planCacheCapacity(getModelArchitecture('olmo-2-1124-7b'), scenario, 8 * gibibyte).maximumBatch, 4)
})

test('all model/TP/precision boundaries fit and the next request or token does not', () => {
  for (const model of modelArchitectures) for (const tp of model.supportedTp) for (const cacheBytes of [1, 2]) {
    for (const budget of [0, 1000000, gibibyte / 8, gibibyte, 17 * gibibyte]) {
      const input = { ...scenario, tp, cacheBytes, sequence: Math.min(4096, model.execution.maxContext) }
      const plan = planCacheCapacity(model, input, budget)
      assert.ok(plan.maximumBatch * plan.perRequestBytes <= budget)
      assert.ok((plan.maximumBatch + 1) * plan.perRequestBytes > budget)
      if (plan.maximumSequence === null) assert.ok(cacheEstimate(model, { ...input, sequence: 1024 }).perRankBytes > budget)
      else {
        assert.ok(cacheEstimate(model, { ...input, sequence: plan.maximumSequence }).perRankBytes <= budget)
        if (!plan.contextLimited) assert.ok(cacheEstimate(model, { ...input, sequence: plan.maximumSequence + 1 }).perRankBytes > budget)
      }
      assert.deepEqual(planCacheCapacity(model, { ...input, phase: 'prefill' }, budget), plan)
    }
  }
})

test('invalid scenarios and unsafe budgets are rejected instead of clamped', () => {
  for (const budget of [-1, 0.5, Infinity, NaN, 1024 * gibibyte + 1]) assert.throws(() => planCacheCapacity(llama, scenario, budget))
  for (const override of [{ sequence: 999 }, { sequence: 999999 }, { batch: 0 }, { batch: 65 }, { tp: 3 }, { cacheBytes: 3 }]) assert.throws(() => planCacheCapacity(llama, { ...scenario, ...override }, gibibyte))
})

test('budget and applied conditions share safely and layer changes preserve the budget', () => {
  const state = { scenario, layer: 3, nodeId: 'gqa', cacheBudgetGiB: 0.125, weightBits: 4 }
  const restored = parseExplorer(explorerParams({ ...state, token: 'private' }), llama)
  assert.deepEqual(restored.state, state)
  assert.deepEqual(restored.notices, [])
  assert.equal(explorerParams(state).get('budget'), '0.125')
  assert.ok(!explorerParams({ ...state, token: 'private' }).has('token'))
  assert.equal(selectExplorerLayer(llama, state, 10).cacheBudgetGiB, 0.125)
  const zero = parseExplorer(new URLSearchParams('budget=0'), llama)
  assert.equal(zero.state.cacheBudgetGiB, 0)
  assert.equal(explorerParams(zero.state).get('budget'), '0')
  for (const raw of ['-1', 'NaN', '1025', '0.0001', '<script>']) {
    const invalid = parseExplorer(new URLSearchParams({ budget: raw }), llama)
    assert.match(invalid.notices[0], /budget/)
    assert.equal(invalid.state.cacheBudgetGiB, undefined)
  }
})
