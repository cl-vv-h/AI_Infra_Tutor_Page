import test from 'node:test'
import assert from 'node:assert/strict'
import { getModelArchitecture } from '../src/data/models.ts'
import { cacheEstimate, decoderNodes } from '../src/lib/model-lab.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { expertParallelSizes, rankModule } from '../src/lib/model-ranks.ts'
import { mixedWeightStorage, defaultMixedPrecision, availableMixedExperts } from '../src/lib/mixed-precision.ts'
import { kimiWeightAudit } from '../src/lib/kimi-weight-audit.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'
import { w4InterleavedScaleShape, w4RuntimeMetadata } from '../src/lib/w4-lifecycle.ts'
import { dpaLayout, dpaParams, parseDpa } from '../src/lib/dpa-lab.ts'

const ids = ['glm-5-2', 'glm-5-3-flash', 'kimi-k3', 'deepseek-v4-flash']
const scenario = { phase: 'decode', batch: 3, sequence: 4096, tp: 4, cacheBytes: 2 }
test('Qwen3 MoE independently reconciles 48 layers, resident experts, FP32 scenario router and quantization scales', () => {
  const model = getModelArchitecture('qwen3-30b-a3b')
  for (const tp of [1, 2, 4, 8]) for (const ep of expertParallelSizes(model, tp)) {
    const attention = 33554432 / tp + 1048576 * Math.max(4 / tp, 1)
    const norm = 8704
    const baseline = decoderWeightBudget(model, 0, tp, 16, ep)
    assert.equal(baseline.allLayersBytes, 48 * (attention + norm + 524288 + 1207959552 / tp))
    for (const experts of availableMixedExperts(model.id, tp, ep)) for (const processed of [false, true]) {
      const policy = { ...defaultMixedPrecision, experts, ...(processed ? { w4Stage: 'processed' } : {}) }
      const routed = experts === 'bf16' ? 1207959552 / tp : experts === 'fp8' ? 604127232 / tp : experts === 'mxfp4' ? 320864256 / tp : processed ? 311427072 / tp + 8 : 320864256 / tp + 768 / ep
      const budget = decoderWeightBudget(model, 47, tp, 4, ep, policy)
      assert.equal(budget.bytes, attention + norm + 1048576 + routed)
      assert.equal(budget.allLayersBytes, budget.bytes * 48)
      const rank = rankModule(model, 47, 'moe', { ...scenario, tp }, 4, 8, ep, policy)
      assert.equal(rank.localBytes, routed + 1048576)
      assert.equal(rank.fleetBytes, (routed + 1048576) * tp * 8)
      assert.equal(rank.weights[0].storage.format, 'fp32')
      const [gateUp, down] = rank.weights.slice(1)
      const e = 128 / ep, i = 768 / (tp / ep)
      assert.equal(gateUp.shape, `[${e}, 2 × ${i}, 2048]`)
      assert.equal(down.shape, `[${e}, 2048, ${i}]`)
      assert.equal(gateUp.storage.payloadBytes + down.storage.payloadBytes, 603979776 / tp * (experts === 'bf16' ? 2 : experts === 'fp8' ? 1 : 0.5))
    }
  }
})

test('Qwen3 MoE restricts block/group formats by MoE-TP and clears inapplicable Dense/Shared URL fields', () => {
  const model = getModelArchitecture('qwen3-30b-a3b')
  for (const tp of [1, 2, 4, 8]) for (const ep of expertParallelSizes(model, tp)) for (const experts of ['bf16', 'fp8', 'mxfp4', 'w4afp8']) {
    const supported = !['fp8', 'w4afp8'].includes(experts) || tp / ep <= 2
    assert.equal(availableMixedExperts(model.id, tp, ep).includes(experts), supported)
    const parsed = parseExplorer(new URLSearchParams(`view=weights&tp=${tp}&ep=${ep}&precision=mixed&experts=${experts}&mlp=fp8&shared=fp8&w4stage=processed`), model)
    assert.equal(parsed.state.mixed.experts, supported ? experts : 'bf16')
    assert.equal(parsed.state.mixed.mlp, 'bf16')
    assert.equal(parsed.state.mixed.shared, 'bf16')
    assert.equal(parsed.notices.some(n => n.includes('128 对齐')), !supported)
    assert.equal(parseExplorer(explorerParams(parsed.state), model).state.mixed.experts, parsed.state.mixed.experts)
    if (!supported) assert.throws(() => decoderWeightBudget(model, 0, tp, 16, ep, { ...defaultMixedPrecision, experts }), /align/)
  }
})

test('Qwen3 MoE EP ownership covers all 128 experts while TP8 retains replicated KV heads', () => {
  const model = getModelArchitecture('qwen3-30b-a3b')
  for (const ep of [1, 2, 4, 8]) {
    const result = rankModule(model, 3, 'moe', { ...scenario, tp: 8 }, 16, 2, ep)
    assert.equal(result.expertExecution.intermediate, 768 / (8 / ep))
    assert.equal(result.expertExecution.localExperts, 128 / ep)
    assert.equal(result.expertExecution.hiddenSize, 2048)
    assert.equal(result.input, '[3, 2048]')
    assert.equal(result.output, '[3, 2048]')
    for (const replica of [0, 1]) {
      const owners = result.ranks.filter(r => r.replica === replica && r.moeTpRank === 0)
      assert.deepEqual(owners.flatMap(r => Array.from({ length: 128 / ep }, (_, i) => r.expertStart + i)), Array.from({ length: 128 }, (_, i) => i))
    }
    const attention = rankModule(model, 3, 'gqa', { ...scenario, tp: 8 }, 16, 2, ep)
    assert.equal(attention.weights[1].shape, '[1 × 128, 2048]')
    assert.equal(attention.weights[1].copies, 2)
    assert.equal(attention.input, '[3, 2048]')
  }
  assert.equal(cacheEstimate(model, { ...scenario, tp: 8 }).perRankBytes, 3 * 4096 * 48 * 2 * 128 * 2)
})

test('Qwen3-8B independently reconciles all Decoder tensors, FP8 scales, fused MLP and DP copies', () => {
  const model = getModelArchitecture('qwen3-8b')
  for (const tp of [1, 2, 4, 8]) for (const mlp of ['bf16', 'fp8']) {
    const policy = { ...defaultMixedPrecision, mlp }
    const i = 12288 / tp, h = 4096
    const mlpPayload = 3 * h * i * (mlp === 'bf16' ? 2 : 1)
    const scaleBytes = mlp === 'fp8' ? 3 * (h / 128) * (i / 128) * 4 : 0
    // Two full layer norms + Q/K per-head shared norms; no biases.
    const norms = (2 * h + 2 * 128) * 2
    const attention = (2 * h * h + 2 * 8 * 128 * h) * 2 / tp
    const expectedLayer = norms + attention + mlpPayload + scaleBytes
    const budget = decoderWeightBudget(model, 35, tp, 4, 1, policy)
    assert.equal(budget.bytes, expectedLayer)
    assert.equal(budget.allLayersBytes, 36 * expectedLayer)
    assert.equal(budget.rows.find(row => row.node.id === 'ffn-norm').bytes, h * 2)
    const gateUp = mixedWeightStorage({ name: 'gate_up_proj', shape: `[${2 * i}, ${h}]` }, 'ffn', policy)
    const down = mixedWeightStorage({ name: 'down_proj', shape: `[${h}, ${i}]` }, 'ffn', policy)
    assert.equal(gateUp.bytes + down.bytes, mlpPayload + scaleBytes)
    if (mlp === 'fp8') {
      assert.deepEqual(gateUp.scaleShape, [2 * i / 128, h / 128])
      assert.deepEqual(down.scaleShape, [h / 128, i / 128])
      assert.equal(gateUp.inputScaleBytes + down.inputScaleBytes, 0)
    }
    for (const replicas of [1, 2, 4, 8]) for (const phase of ['decode', 'prefill']) {
      const rank = rankModule(model, 35, 'ffn', { ...scenario, sequence: 128, tp, phase }, 4, replicas, 1, policy)
      const n = phase === 'decode' ? 3 : 384
      assert.equal(rank.localBytes, mlpPayload + scaleBytes)
      assert.equal(rank.fleetBytes, rank.localBytes * tp * replicas)
      assert.equal(rank.input, `[${n}, 4096]`)
      assert.equal(rank.output, rank.input)
      assert.equal(rank.tensors[0].shape, `[${n}, 2 × ${i}]`)
      assert.equal(rank.tensors[1].shape, `[${n}, ${i}]`)
      assert.equal(rank.weights.every(weight => weight.storage.role === 'mlp'), true)
    }
    const irrelevant = { ...policy, shared: 'fp8', experts: 'w4afp8', w4Stage: 'processed' }
    assert.equal(decoderWeightBudget(model, 0, tp, 32, 1, irrelevant).allLayersBytes, budget.allLayersBytes)
  }
  assert.deepEqual(expertParallelSizes(model, 8), [1])
})

test('Qwen3-8B mixed URL keeps Dense policy and removes inapplicable expert options', () => {
  const model = getModelArchitecture('qwen3-8b')
  const parsed = parseExplorer(new URLSearchParams('view=weights&node=ffn&tp=8&precision=mixed&mlp=fp8&shared=fp8&experts=w4afp8&w4stage=processed'), model)
  assert.deepEqual(parsed.state.mixed, { mlp: 'fp8', shared: 'bf16', experts: 'bf16' })
  assert.equal(parsed.notices.length, 1)
  assert.equal(explorerParams(parsed.state).has('w4stage'), false)
  assert.deepEqual(parseExplorer(explorerParams(parsed.state), model).state.mixed, parsed.state.mixed)
})
test('Kimi discrepancy is decomposed into units, UINT8 scales and BF16 non-experts, not fudged to 1.56 TB', () => {
  const audit = kimiWeightAudit(getModelArchitecture('kimi-k3'))
  assert.equal(audit.routedElements, 92 * 896 * 3 * 3584 * 3072)
  assert.equal(audit.elements, 2777135644256)
  assert.equal(audit.uniform4Bytes, 1388567822128)
  assert.equal(audit.scaleBytes, 85085650944)
  assert.equal(audit.bf16RestorationBytes, 81592221072)
  assert.equal(audit.referenceScenarioBytes, 1555245694144)
  assert.notEqual(audit.referenceScenarioBytes, 1.56e12)
  assert.equal(audit.fp32RestorationBytes, 22244864)
  assert.equal(audit.checkpointOnlyElementsBytes, 69 * 32 * 2)
  assert.equal(audit.outsideDecoderBytes, 5592381440)
})

test('W4AFp8 hand arithmetic includes FP32 group-128 weight scales and BF16 static input scales', () => {
  const policy = { mlp: 'fp8', shared: 'fp8', experts: 'w4afp8' }
  const gate = mixedWeightStorage({ name: 'experts.gate_up_proj', shape: '[2, 256, 256]', routedExpert: true }, 'moe', policy)
  assert.deepEqual(gate.payloadShape, [2, 256, 128])
  assert.deepEqual(gate.scaleShape, [2, 256, 2])
  assert.deepEqual(gate.inputScaleShape, [2, 2])
  assert.equal(gate.bytes, 65536 + 4096 + 8)
  const down = mixedWeightStorage({ name: 'experts.down_proj', shape: '[2, 256, 128]', routedExpert: true }, 'moe', policy)
  assert.deepEqual(down.payloadShape, [2, 256, 64])
  assert.equal(down.bytes, 32768 + 2048 + 4)
  const mx = mixedWeightStorage({ name: 'experts.down_proj', shape: '[2, 256, 128]', routedExpert: true }, 'moe', { ...policy, experts: 'mxfp4' })
  assert.deepEqual(mx.scaleShape, [2, 256, 4])
  assert.equal(mx.bytes, 32768 + 2048)
  assert.equal(mx.inputScaleBytes, 0)
  const fp8 = mixedWeightStorage({ name: 'gate_up_proj', shape: '[256, 256]' }, 'dense-ffn', policy)
  assert.equal(fp8.bytes, 65536 + 16)
  assert.equal(mixedWeightStorage({ name: 'gate.weight · replicated', shape: '[2, 256]' }, 'moe', policy).bytes, 2 * 256 * 4)
  assert.equal(mixedWeightStorage({ name: 'e_score_correction_bias', shape: '[2]' }, 'moe', policy).bytes, 8)
  assert.equal(mixedWeightStorage({ name: 'routed_expert_down_proj', shape: '[2, 256]' }, 'moe', policy).bytes, 2 * 256 * 2)
  assert.throws(() => mixedWeightStorage({ name: 'gate_up_proj', shape: '[128, 256]' }, 'dense-ffn', policy), /128/)
})

test('rank and all-layer ledgers share mixed storage across four models, TP, EP, DP and all policies', () => {
  for (const id of ids) {
    const model = getModelArchitecture(id)
    for (const tp of model.supportedTp) for (const ep of expertParallelSizes(model, tp)) {
      for (const experts of ['bf16', 'fp8', 'mxfp4', 'w4afp8']) for (const mlp of ['bf16', 'fp8']) for (const w4Stage of experts === 'w4afp8' ? [undefined, 'processed'] : [undefined]) {
        const policy = { mlp, shared: mlp, experts, ...(w4Stage ? { w4Stage } : {}) }
        const last = model.dimensions.layers - 1
        const budget = decoderWeightBudget(model, last, tp, 4, ep, policy)
        let all = 0
        for (let layer = 0; layer <= last; layer++) for (const node of decoderNodes(model, layer)) {
          const rank = rankModule(model, layer, node.id, { ...scenario, tp }, 4, 2, ep, policy)
          all += rank.localBytes
          assert.equal(rank.fleetBytes, rank.localBytes * tp * 2)
          for (const weight of rank.weights) {
            if (weight.storage.role === 'router') assert.equal(weight.bytes, weight.local * 4)
            if (weight.routedExpert) assert.equal(weight.storage.logicalShape[0], model.execution.expertParallel.experts / ep)
          }
          if (layer === last && node.weights.length) assert.equal(rank.localBytes, budget.rows.find(r => r.node.id === node.id).bytes)
        }
        assert.equal(budget.allLayersBytes, all)
        assert.equal(decoderWeightBudget(model, last, tp, 32, ep, policy).allLayersBytes, all, 'mixed ignores inactive uniform bits')
      }
    }
  }
})

test('W4AFp8 post-load preserves payload, interleaves BF16 scale axes and reduces each input scale to FP32 [1]', () => {
  const policy = { mlp: 'fp8', shared: 'bf16', experts: 'w4afp8', w4Stage: 'processed' }
  const gateWeight = { name: 'experts.gate_up_proj', shape: '[64, 2048, 6144]', routedExpert: true }
  const gate = mixedWeightStorage(gateWeight, 'moe', policy)
  assert.deepEqual(gate.payloadShape, [64, 2048, 3072])
  assert.deepEqual(gate.scaleShape, [64, 12, 8192])
  assert.equal(gate.scaleDtype, 'BF16')
  assert.deepEqual(gate.inputScaleShape, [1])
  assert.equal(gate.inputScaleDtype, 'FP32')
  assert.equal(gate.allocatedBytes, 427819264)
  assert.equal(gate.bytes, 64 * 2048 * 3072 + 64 * 2048 * 48 * 2 + 4)
  assert.equal(gate.bytes, 415236100)
  assert.equal(gate.processed, true)
  const down = mixedWeightStorage({ name: 'experts.down_proj', shape: '[256, 6144, 256]', routedExpert: true }, 'moe', policy)
  assert.deepEqual(down.scaleShape, [256, 2, 6144], 'G=2 takes alignment=1, not four-wide interleave')
  assert.equal(down.bytes, 256 * 6144 * 128 + 256 * 6144 * 2 * 2 + 4)
  for (const groups of [1, 2, 3, 4, 8, 12, 28, 48]) {
    const shape = w4InterleavedScaleShape([2, 256, groups])
    assert.deepEqual(shape, groups % 4 === 0 ? [2, groups / 4, 1024] : [2, groups, 256])
    assert.equal(shape.reduce((n, axis) => n * axis, 1), 2 * 256 * groups)
  }
  const copied = mixedWeightStorage({ ...gateWeight, multiplicity: 2 }, 'moe', policy)
  assert.equal(copied.bytes, gate.bytes * 2)
  assert.equal(copied.inputScaleBytes, 8, 'one scalar per matrix copy, not per expert')
  for (const experts of ['bf16', 'fp8', 'mxfp4']) {
    const inactive = mixedWeightStorage(gateWeight, 'moe', { ...policy, experts })
    const original = mixedWeightStorage(gateWeight, 'moe', { ...policy, experts, w4Stage: undefined })
    assert.deepEqual(inactive, original)
  }
  for (const bad of [[1, 2], [0, 1, 2], [1, 2, 0.5], [1, 2, Infinity]]) assert.throws(() => w4InterleavedScaleShape(bad), /Invalid/)
})

test('W4 runtime metadata counts seven allocations and four aliases exactly once, independently of weights', () => {
  for (const experts of [1, 2, 32, 64, 112, 256, 896]) {
    const metadata = w4RuntimeMetadata(experts)
    assert.equal(metadata.tensors.length, 7)
    assert.equal(metadata.tensors.flatMap(t => t.aliases).length, 4)
    assert.equal(metadata.bytes, 4 * experts * 3 * 8 + (experts + 1) * 4 + 2 * experts * 3 * 4)
    assert.equal(metadata.bytes, 124 * experts + 4)
    assert.equal(new Set(metadata.tensors.flatMap(t => [t.name, ...t.aliases])).size, 11)
  }
  assert.equal(w4RuntimeMetadata(64).bytes, 7940)
  assert.equal(w4RuntimeMetadata(64).tensors.find(t => t.name === 'c_strides1').aliases[0], 's_strides13')
  for (const bad of [0, -1, 0.5, NaN, Infinity, 1000001]) assert.throws(() => w4RuntimeMetadata(bad), /Invalid/)
})

test('processed W4 stage roundtrips through explorer and DPA and changes only expert storage', () => {
  const model = getModelArchitecture('glm-5-2')
  const mixed = { mlp: 'fp8', shared: 'bf16', experts: 'w4afp8', w4Stage: 'processed' }
  const state = { layer: 3, nodeId: 'moe', scenario, ep: 2, mixed }
  assert.deepEqual(parseExplorer(explorerParams(state), model).state.mixed, mixed)
  assert.equal(explorerParams({ ...state, mixed: undefined }).has('w4stage'), false)
  assert.equal(parseExplorer(new URLSearchParams('precision=mixed&w4stage=invalid'), model).notices.length, 1)
  assert.equal(parseExplorer(new URLSearchParams('precision=mixed&w4stage=allocated'), model).state.mixed.w4Stage, undefined)
  const original = { ...parseDpa(new URLSearchParams('tp=8&dp=4&ep=4&groups=3,1,0,2&rank=5')).state, mixed }
  assert.deepEqual(parseDpa(dpaParams(original)).state, original)
  const processed = dpaLayout(original)
  const allocated = dpaLayout({ ...original, mixed: { ...mixed, w4Stage: undefined } })
  assert.deepEqual(processed.boundaryTensors, allocated.boundaryTensors)
  assert.equal(processed.dpaCacheBytes, allocated.dpaCacheBytes)
  let delta = 0
  for (let i = 0; i < allocated.weights.length; i++) {
    const before = allocated.weights[i], after = processed.weights[i]
    assert.equal(after.storage.allocatedBytes, before.bytes)
    if (before.routedExpert) {
      assert.equal(after.storage.payloadBytes, before.storage.payloadBytes)
      assert.equal(after.storage.scaleBytes * 2, before.storage.scaleBytes)
      assert.equal(after.storage.inputScaleBytes, 4)
      delta += before.bytes - after.bytes
    } else assert.equal(after.bytes, before.bytes)
  }
  assert.equal(allocated.layerWeightBytes - processed.layerWeightBytes, delta)
  assert.equal(allocated.allLayersWeightBytes - processed.allLayersWeightBytes, delta * 75)
  assert.equal(allocated.allRanksWeightBytes - processed.allRanksWeightBytes, delta * 75 * 8)
  assert.ok(delta > 0)
  assert.equal(dpaParams({ ...original, mixed: undefined }).has('w4stage'), false)
  assert.equal(parseDpa(new URLSearchParams('precision=mixed&w4stage=invalid')).notices.length, 1)
  assert.throws(() => dpaLayout({ ...original, mixed: { ...mixed, w4Stage: 'invalid' } }), /Invalid/)
})

test('mixed settings roundtrip independently; unsupported models and unknown formats fail closed', () => {
  const model = getModelArchitecture('kimi-k3')
  const mixed = { mlp: 'fp8', shared: 'bf16', experts: 'w4afp8' }
  const state = { layer: 3, nodeId: 'moe', scenario, ep: 2, replicas: 2, rank: 7, weightBits: 4, mixed, view: 'weights' }
  assert.deepEqual(parseExplorer(explorerParams(state), model).state, state)
  assert.deepEqual(selectExplorerLayer(model, state, 0).mixed, mixed)
  assert.equal(explorerParams({ ...state, mixed: undefined }).has('precision'), false)
  const invalid = parseExplorer(new URLSearchParams('precision=mixed&mlp=mxfp4&shared=oops&experts=awq'), model)
  assert.deepEqual(invalid.state.mixed, defaultMixedPrecision)
  assert.equal(invalid.notices.length, 3)
  const llama = getModelArchitecture('llama-3-1-8b')
  assert.equal(parseExplorer(explorerParams(state), llama).state.mixed, undefined)
  assert.throws(() => decoderWeightBudget(llama, 0, 1, 4, 1, mixed), /not audited/)
})
