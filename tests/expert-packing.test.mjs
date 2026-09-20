import test from 'node:test'
import assert from 'node:assert/strict'
import { availableExpertFormats, expertPacking } from '../src/lib/expert-packing.ts'
import { getModelArchitecture, modelArchitectures } from '../src/data/models.ts'
import { decoderNodes } from '../src/lib/model-lab.ts'
import { expertParallelSizes, rankModule } from '../src/lib/model-ranks.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'

const scenario = { phase: 'decode', batch: 3, sequence: 4096, tp: 4, cacheBytes: 2 }

test('independent hand calculation: payload shape and scale bytes for all four allocations', () => {
  const expected = {
    bf16: { payload: 393216, scales: 0, shape: null },
    'fp8-block': { payload: 196608, scales: 48, shape: [2, 2, 2] },
    mxfp8: { payload: 196608, scales: 6144, shape: [2, 256, 8] },
    'fp4-load': { payload: 98304, scales: 24576, shape: [2, 256, 8] },
  }
  for (const [format, fixture] of Object.entries(expected)) {
    const data = expertPacking(2, 256, 128, 4, format)
    assert.equal(data.payloadBytes, fixture.payload)
    assert.equal(data.scalesBytes, fixture.scales)
    assert.equal(data.totalBytes, fixture.payload + fixture.scales)
    assert.deepEqual(data.rows[0].logicalShape, [2, 256, 256])
    assert.deepEqual(data.rows[1].logicalShape, [2, 256, 128])
    assert.deepEqual(data.rows[0].scaleShape, fixture.shape)
    assert.deepEqual(data.rows[0].payloadShape, [2, 256, format === 'fp4-load' ? 128 : 256])
    assert.deepEqual(data.rows[1].payloadShape, [2, 256, format === 'fp4-load' ? 64 : 128])
  }
  assert.equal(expertPacking(2, 256, 128, 4, 'fp4-load').rows[0].scaleDtype, 'FP32')
  assert.equal(expertPacking(2, 256, 128, 4, 'mxfp8').rows[0].scaleDtype, 'UINT8 / E8M0')
})

test('block alignment is checked per gate/up half; ceil scales and global TP condition match loader', () => {
  assert.throws(() => expertPacking(1, 128, 64, 1, 'fp8-block'), /分别对齐/)
  assert.throws(() => expertPacking(1, 128, 33, 2, 'mxfp8'), /对齐/)
  const unpartitioned = expertPacking(1, 129, 33, 1, 'mxfp8')
  assert.deepEqual(unpartitioned.rows[0].scaleShape, [1, 66, 5])
  assert.deepEqual(unpartitioned.rows[1].scaleShape, [1, 129, 2])
  assert.equal(expertPacking(1, 129, 128, 1, 'fp8-block').scalesBytes, 24)
  for (const dims of [[1, 129, 128], [1, 128, 33]]) assert.throws(() => expertPacking(...dims, 1, 'fp4-load'), /32/)
  for (const dims of [[0, 128, 128], [1.5, 128, 128], [1, Infinity, 128], [1, 128, -1]]) assert.throws(() => expertPacking(...dims, 1, 'bf16'))
  assert.throws(() => expertPacking(1, 128, 128, 3, 'bf16'))
  assert.throws(() => expertPacking(1, 128, 128, 1, 'awq'))
  assert.throws(() => expertPacking(Number.MAX_SAFE_INTEGER, 128, 128, 1, 'bf16'), /safe integer/)
})

test('every supported model/layer/TP/EP allocation equals routed-only logical weight counts', () => {
  let cases = 0
  for (const model of modelArchitectures.filter((m) => availableExpertFormats(m).length)) {
    for (const tp of model.supportedTp) for (const ep of expertParallelSizes(model, tp)) {
      for (let layer = 0; layer < model.dimensions.layers; layer++) {
        for (const node of decoderNodes(model, layer)) {
          const data = rankModule(model, layer, node.id, { ...scenario, tp }, 16, 2, ep)
          const e = data.expertExecution
          if (!e) { assert.ok(!data.weights.some((w) => w.routedExpert)); continue }
          const logical = data.weights.filter((w) => w.routedExpert).reduce((sum, w) => sum + w.local, 0)
          assert.equal(logical, 3 * e.localExperts * e.hiddenSize * e.intermediate)
          const full = 3 * model.execution.expertParallel.experts * e.hiddenSize * model.execution.expertIntermediateSize
          for (const format of availableExpertFormats(model)) {
            const allocation = expertPacking(e.localExperts, e.hiddenSize, e.intermediate, tp, format)
            assert.equal(allocation.baselineBytes, logical * 2)
            assert.equal(allocation.payloadBytes, logical * (format === 'bf16' ? 2 : format === 'fp4-load' ? 0.5 : 1))
            const unsharded = expertPacking(model.execution.expertParallel.experts, e.hiddenSize, model.execution.expertIntermediateSize, 1, format)
            assert.equal(allocation.totalBytes * tp, unsharded.totalBytes, 'EP trades expert count for MoE-TP width, does not remove weights')
            assert.equal(allocation.baselineBytes * tp, full * 2)
            cases++
          }
          if (model.id === 'kimi-k3') assert.equal(e.hiddenSize, 3584, 'routed experts use latent, not trunk H')
        }
      }
    }
  }
  assert.ok(cases > 7000)
})

test('format whitelist and URL roundtrip preserve the independent experiment without changing other knobs', () => {
  const glm = getModelArchitecture('glm-5-2')
  const v4 = getModelArchitecture('deepseek-v4-flash')
  assert.deepEqual(availableExpertFormats({ id: 'deepseek-v4-1-flash' }), [])
  assert.deepEqual(availableExpertFormats({ id: 'llama-3-1-8b' }), [])
  assert.ok(!availableExpertFormats(glm).includes('fp4-load'))
  const original = { layer: 3, nodeId: 'moe', scenario, weightBits: 4, replicas: 2, ep: 2, rank: 7, cacheBudgetGiB: 5, view: 'weights' }
  for (const format of availableExpertFormats(v4)) {
    const expected = { ...original, ...(format !== 'bf16' ? { expertFormat: format } : {}) }
    const params = explorerParams({ ...original, expertFormat: format })
    assert.deepEqual(parseExplorer(params, v4).state, expected)
    assert.equal(params.has('packing'), format !== 'bf16')
  }
  const dense = selectExplorerLayer(glm, { ...original, expertFormat: 'mxfp8' }, 0)
  assert.equal(parseExplorer(explorerParams(dense), glm).state.expertFormat, 'mxfp8', 'temporary non-MoE module does not erase experiment')
  for (const packing of ['fp4-load', 'awq', '<script>', '']) {
    const parsed = parseExplorer(new URLSearchParams({ packing }), glm)
    assert.equal(parsed.state.expertFormat, undefined)
    assert.equal(parsed.notices.length, 1)
  }
  assert.equal(explorerParams({ ...original, expertFormat: 'malformed' }).has('packing'), false)
})
