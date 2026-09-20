import test from 'node:test'
import assert from 'node:assert/strict'
import { getModelArchitecture, modelArchitectures } from '../src/data/models.ts'
import { decoderNodes } from '../src/lib/model-lab.ts'
import { expertParallelSizes, expertRankTopology, rankModule, rankTopology } from '../src/lib/model-ranks.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'
import { tensorPayload } from '../src/lib/tensor-payload.ts'
import { attentionHeadRanks } from '../src/lib/attention-heads.ts'

const scenario = { phase: 'decode', batch: 2, sequence: 4096, tp: 4, cacheBytes: 2 }
const llama = getModelArchitecture('llama-3-1-8b')

test('audited GQA head ownership partitions Q and repeats each KV head exactly as QKVParallelLinear loads it', () => {
  for (const id of ['llama-3-1-8b', 'qwen3-8b', 'qwen3-30b-a3b']) for (const tp of [1, 2, 4, 8]) for (const replicas of [1, 2, 4, 8]) {
    const model = getModelArchitecture(id)
    const { attentionHeads: q, kvHeads: kv, headDim, hiddenSize } = model.dimensions
    const ranks = attentionHeadRanks(model, tp, replicas)
    assert.equal(ranks.length, tp * replicas)
    const data = rankModule(model, 0, 'gqa', { ...scenario, tp }, 16, replicas)
    assert.deepEqual(data.attentionHeads, ranks)
    for (let replica = 0; replica < replicas; replica++) {
      const group = ranks.filter(r => r.replica === replica)
      const qIds = group.flatMap(r => Array.from({ length: r.qEnd - r.qStart }, (_, i) => r.qStart + i))
      assert.deepEqual(qIds, Array.from({ length: q }, (_, i) => i))
      const kvCounts = Array(kv).fill(0)
      for (const r of group) {
        for (let k = r.kvStart; k < r.kvEnd; k++) kvCounts[k]++
        for (let qi = r.qStart; qi < r.qEnd; qi++) assert.ok(Math.floor(qi / (q / kv)) >= r.kvStart && Math.floor(qi / (q / kv)) < r.kvEnd)
        assert.equal(r.qRows[1] - r.qRows[0], q / tp * headDim)
        assert.equal(r.kvRows[1] - r.kvRows[0], Math.max(1, kv / tp) * headDim)
        assert.equal(data.weights.find(w => w.name.startsWith('q_proj')).local, (r.qRows[1] - r.qRows[0]) * hiddenSize)
        assert.equal(data.weights.filter(w => w.name.startsWith('k_proj') || w.name.startsWith('v_proj')).reduce((sum, w) => sum + w.local, 0), (r.kvRows[1] - r.kvRows[0]) * hiddenSize * 2)
        assert.deepEqual(r.kvPeers, group.filter(other => other.kvStart === r.kvStart && other.kvEnd === r.kvEnd).map(other => other.rank))
        assert.ok(r.kvPeers.every(peer => ranks[peer].replica === replica))
      }
      assert.deepEqual(kvCounts, Array(kv).fill(Math.max(1, tp / kv)))
    }
  }
})

test('Qwen TP8 rank15 owns Q28-31 and KV3, shared only with rank14 in its independent replica', () => {
  const model = getModelArchitecture('qwen3-30b-a3b')
  const ranks = attentionHeadRanks(model, 8, 2)
  assert.deepEqual(ranks[15], { rank: 15, replica: 1, tpRank: 7, qStart: 28, qEnd: 32, kvStart: 3, kvEnd: 4, qRows: [3584, 4096], kvRows: [384, 512], kvCopies: 2, kvPeers: [14, 15] })
  for (const ep of [1, 2, 4, 8]) {
    const data = rankModule(model, 0, 'gqa', { ...scenario, tp: 8 }, 4, 2, ep)
    assert.deepEqual(data.attentionHeads, ranks)
    assert.equal(rankModule(model, 0, 'moe', { ...scenario, tp: 8 }, 4, 2, ep).attentionHeads, null)
  }
})

test('attention head ownership does not infer MLA, gathered KV or hybrid backends from similar dimensions', () => {
  for (const id of ['glm-5-2', 'kimi-k3', 'olmo-2-1124-7b', 'qwen3-5-9b']) assert.equal(attentionHeadRanks(getModelArchitecture(id), 8, 1), null)
  for (const [tp, replicas] of [[3, 1], [8, 3], [0, 1], [8, -1]]) assert.throws(() => attentionHeadRanks(llama, tp, replicas), /Invalid/)
  for (const dimensions of [{ attentionHeads: 31 }, { kvHeads: 3 }, { headDim: 0 }, { headDim: Number.MAX_SAFE_INTEGER }]) assert.throws(() => attentionHeadRanks({ ...llama, dimensions: { ...llama.dimensions, ...dimensions } }, 8, 1), /Invalid/)
})

test('logical tensor operands are bounded; ambiguous alternatives and annotations are not summed', () => {
  assert.deepEqual(tensorPayload('[2, 3 × 128]'), { elements: 768, operands: 1, referenceBytes: 1536 })
  assert.deepEqual(tensorPayload('[2, 4096] + [2, 4096]'), { elements: 16384, operands: 2, referenceBytes: 32768 })
  assert.deepEqual(tensorPayload('[0, 128]'), { elements: 0, operands: 1, referenceBytes: 0 })
  for (const shape of ['[2, 4] / [2, 4]', '[2, 4] → [2, 8]', '[N, 4]', '[T_e, 128]', '[2, 4] bank', '[2, -1]', '[1.5, 2]', '[9007199254740992]', '[4503599627370496]', '[2, 4]; alert(1)']) assert.equal(tensorPayload(shape).elements, null, shape)
})

test('Qwen boundary and fused Dense elements follow workload and TP without confusing weight or cache precision', () => {
  const qwen = getModelArchitecture('qwen3-8b')
  for (const tp of [1, 2, 4, 8]) for (const replicas of [1, 2, 4, 8]) for (const phase of ['prefill', 'decode']) {
    const n = 3 * (phase === 'prefill' ? 1024 : 1)
    const context = { phase, tp, batch: 3, sequence: 1024, cacheBytes: 1 }
    const result = rankModule(qwen, 3, 'ffn', context, 4, replicas)
    assert.equal(result.inputPayload.elements, n * 4096)
    assert.equal(result.outputPayload.referenceBytes, n * 4096 * 2)
    assert.deepEqual(result.tensors.map(t => t.payload.elements), [n * 2 * 12288 / tp, n * 12288 / tp, n * 4096])
    const changed = rankModule(qwen, 3, 'ffn', { ...context, cacheBytes: 2 }, 32, replicas, 1, { mlp: 'fp8', shared: 'bf16', experts: 'bf16' })
    assert.deepEqual(changed.inputPayload, result.inputPayload)
    assert.deepEqual(changed.outputPayload, result.outputPayload)
    assert.deepEqual(changed.tensors, result.tensors)
  }
})

test('Kimi EP changes expert storage, not the main module boundary or independent-replica workload', () => {
  const kimi = getModelArchitecture('kimi-k3')
  for (const ep of [1, 2, 4, 8]) {
    const result = rankModule(kimi, 3, 'moe', { ...scenario, tp: 8 }, 4, 8, ep)
    assert.equal(result.inputPayload.elements, 2 * 7168)
    assert.equal(result.outputPayload.referenceBytes, 2 * 7168 * 2)
    assert.ok(result.tensors.some(t => t.payload.elements === null), 'slash-separated tensors remain ambiguous')
  }
})

test('all catalogue boundaries expose safe logical counts or explicit unknowns without affecting weight sums', () => {
  for (const model of modelArchitectures) for (const tp of model.supportedTp) for (const layer of [0, model.dimensions.layers - 1]) for (const node of decoderNodes(model, layer)) {
    const result = rankModule(model, layer, node.id, { ...scenario, tp }, 16, 2)
    for (const payload of [result.inputPayload, result.outputPayload, ...result.tensors.map(t => t.payload)]) {
      if (payload.elements === null) assert.equal(payload.referenceBytes, null)
      else {
        assert.ok(Number.isSafeInteger(payload.elements) && payload.elements >= 0)
        assert.equal(payload.referenceBytes, payload.elements * 2)
      }
    }
    assert.equal(result.fleetBytes, result.localBytes * tp * 2)
  }
})

test('independent DP groups replicate weights and partition request identities, not local B', () => {
  const ranks = rankTopology(4, 2, 2)
  assert.equal(ranks.length, 8)
  assert.deepEqual(ranks[7], { rank: 7, replica: 1, tpRank: 3, requestStart: 2, requestEnd: 3 })
  for (const replica of [0, 1]) assert.equal(new Set(ranks.filter((r) => r.replica === replica).map((r) => r.requestStart)).size, 1)
  const one = rankModule(llama, 0, 'gqa', scenario, 16, 1)
  const two = rankModule(llama, 0, 'gqa', scenario, 16, 2)
  assert.equal(two.localBytes, one.localBytes)
  assert.equal(two.fleetBytes, one.fleetBytes * 2)
  assert.equal(two.localTokens, 2)
  assert.equal(two.totalRequests, 4)
  assert.equal(two.input, '[2, 4096]')
  assert.equal(two.output, '[2, 4096]')
  const prefill = rankModule(llama, 0, 'gqa', { ...scenario, phase: 'prefill' }, 16, 2)
  assert.equal(prefill.input, '[8192, 4096]')
  assert.equal(prefill.localBytes, two.localBytes)
})

test('TP weights match independent GQA arithmetic; bit width does not change logical shape', () => {
  const data = rankModule(llama, 0, 'gqa', scenario, 16, 2)
  assert.equal(data.localBytes, (2 * 4096 ** 2 + 2 * 8 * 128 * 4096) / 4 * 2)
  assert.equal(data.groupBytes, data.uniqueBytes)
  const q = data.weights.find((w) => w.name.startsWith('q_proj'))
  assert.equal(q.local, 8 * 128 * 4096)
  assert.equal(q.shape, '[8 × 128, 4096]')
  assert.equal(q.unshardedShape, '[32 × 128, 4096]')
  for (const bits of [4, 8, 32]) {
    const changed = rankModule(llama, 0, 'gqa', scenario, bits, 2)
    assert.equal(changed.localBytes, data.localBytes * bits / 16)
    assert.deepEqual(changed.weights.map((w) => w.shape), data.weights.map((w) => w.shape))
  }
  const norm = rankModule(llama, 0, 'attention-norm', scenario, 16, 2)
  assert.equal(norm.localBytes, 4096 * 2)
  assert.equal(norm.groupBytes, norm.uniqueBytes * 4)
})

test('rank modules preserve countable weights across every model and supported TP', () => {
  for (const model of modelArchitectures) for (const tp of model.supportedTp) {
    for (const layer of [0, model.dimensions.layers - 1]) for (const node of decoderNodes(model, layer)) {
      const data = rankModule(model, layer, node.id, { ...scenario, tp }, 16, 8)
      assert.equal(data.complete, true, `${model.id}/${layer}/${node.id}`)
      assert.equal(data.fleetBytes, data.localBytes * tp * 8)
      assert.ok(data.groupBytes >= data.uniqueBytes)
      assert.ok(!/NaN|undefined|\{\w+\}/.test(data.input + data.output))
    }
  }
})

test('unknown weights disable all sums and malformed topology is rejected', () => {
  const model = structuredClone(llama)
  model.nodes.find((n) => n.id === 'gqa').weights.push({ name: 'unknown', shape: '[unknown]' })
  const result = rankModule(model, 0, 'gqa', scenario, 16, 2)
  assert.equal(result.complete, false)
  for (const key of ['localBytes', 'uniqueBytes', 'groupBytes', 'fleetBytes']) assert.equal(result[key], null)
  for (const args of [[3, 2, 2], [4, 3, 2], [4, 2, 0], [4, 2, 1.5], [4, 2, 65]]) assert.throws(() => rankTopology(...args), /Invalid/)
  assert.throws(() => rankModule(llama, 0, 'moe', scenario, 16, 2), /Module/)
  assert.throws(() => rankModule(llama, 99, 'gqa', scenario, 16, 2), /Invalid/)
})

test('rank share state round-trips and shrinking topology clamps to an existing rank', () => {
  const params = new URLSearchParams('tp=8&replicas=8&rank=63&wbits=4&view=weights')
  const original = parseExplorer(params, llama)
  assert.deepEqual(original.notices, [])
  assert.equal(original.state.replicas, 8)
  assert.equal(original.state.rank, 63)
  assert.deepEqual(parseExplorer(explorerParams(original.state), llama).state, original.state)
  assert.equal(selectExplorerLayer(llama, original.state, 1).rank, 63)
  const smaller = parseExplorer(explorerParams({ ...original.state, replicas: 1, scenario: { ...original.state.scenario, tp: 2 } }), llama)
  assert.deepEqual(smaller.notices, [])
  assert.equal(smaller.state.rank, 1)
  assert.equal(smaller.state.replicas, undefined)
  const single = explorerParams({ ...smaller.state, scenario: { ...smaller.state.scenario, tp: 1 } })
  assert.equal(single.has('rank'), false)
  for (const raw of ['-1', '', '1.5', 'Infinity', '1e1', '64']) assert.ok(parseExplorer(new URLSearchParams({ rank: raw }), llama).notices.length)
  assert.ok(parseExplorer(new URLSearchParams('replicas=3'), llama).notices.length)
})

test('SGLang EP and MoE-TP groups follow strided EP and contiguous expert-TP ranks', () => {
  const model = getModelArchitecture('glm-5-2')
  const ranks = expertRankTopology(model, 8, 2, 3, 4)
  assert.equal(ranks.length, 16) // EP does not multiply world size.
  const r = ranks[13]
  assert.equal(r.replica, 1)
  assert.equal(r.epRank, 2)
  assert.equal(r.moeTpRank, 1)
  assert.deepEqual(r.moeTpPeers, [12, 13])
  assert.deepEqual(r.epPeers, [9, 11, 13, 15])
  assert.equal(r.expertStart, 128)
  assert.equal(r.expertEnd, 191)
  assert.deepEqual(expertParallelSizes(model, 8), [1, 2, 4, 8])
  assert.deepEqual(expertParallelSizes(llama, 8), [1])
  assert.throws(() => expertRankTopology(llama, 8, 1, 1, 2), /Invalid/)
  assert.throws(() => expertRankTopology(model, 4, 1, 1, 8), /Invalid/)
})

test('EP reshapes routed expert ownership without double dividing its weight bytes', () => {
  for (const [id, layer, count, width, intermediate, topK] of [
    ['glm-5-2', 3, 256, 6144, 2048, 8],
    ['glm-5-3-flash', 3, 288, 4096, 2048, 8],
    ['kimi-k3', 92, 896, 3584, 3072, 16],
    ['deepseek-v4-flash', 0, 256, 4096, 2048, 6],
  ]) {
    const model = getModelArchitecture(id)
    const conditions = { ...scenario, tp: 8 }
    const baseline = rankModule(model, layer, decoderNodes(model, layer).find((n) => n.weights.some((w) => w.routedExpert)).id, conditions, 16, 2)
    for (const ep of [1, 2, 4, 8]) {
      const result = rankModule(model, layer, baseline.node.id, conditions, 16, 2, ep)
      const routed = result.weights.filter((w) => w.routedExpert)
      assert.equal(routed.length, 2, id)
      assert.equal(routed.reduce((sum, w) => sum + w.local, 0), 3 * count * width * intermediate / 8)
      assert.equal(result.localBytes, baseline.localBytes, `${id}: EP must not divide weight bytes twice`)
      assert.equal(routed[0].shape, `[${count / ep}, 2 × ${intermediate / (8 / ep)}, ${width}]`)
      assert.equal(routed[1].shape, `[${count / ep}, ${width}, ${intermediate / (8 / ep)}]`)
      assert.deepEqual(result.weights.filter((w) => !w.routedExpert), baseline.weights.filter((w) => !w.routedExpert))
      assert.equal(result.expertExecution.topK, topK)
      assert.equal(result.expertExecution.maxLocalAssignments, 2 * Math.min(topK, count / ep))
      assert.equal(result.expertExecution.minLocalAssignments, ep === 1 ? 2 * topK : 0)
      assert.equal(result.groupBytes, result.localBytes * 8)
    }
  }
})

test('EP never changes attention, dense FFN or replicated latent projection shapes', () => {
  const model = getModelArchitecture('kimi-k3')
  for (const node of decoderNodes(model, 0)) {
    const result = rankModule(model, 0, node.id, scenario, 16, 1, 4)
    assert.equal(result.expertExecution, null)
    assert.deepEqual(result.weights, rankModule(model, 0, node.id, scenario, 16, 1).weights)
  }
  const invalid = structuredClone(model)
  invalid.nodes.find((n) => n.id === 'moe').weights.find((w) => w.routedExpert).shape = '[3584, 896]'
  assert.throws(() => rankModule(invalid, 1, 'moe', scenario, 16, 1, 2), /axis 0/)
})

test('EP URL validation rejects unsupported models and clamps EP after TP reduction', () => {
  const model = getModelArchitecture('glm-5-3-flash')
  const original = parseExplorer(new URLSearchParams('layer=3&node=moe&tp=8&ep=8&rank=7&replicas=2&view=weights'), model)
  assert.deepEqual(original.notices, [])
  assert.equal(original.state.ep, 8)
  assert.deepEqual(parseExplorer(explorerParams(original.state), model).state, original.state)
  const smaller = parseExplorer(explorerParams({ ...original.state, scenario: { ...original.state.scenario, tp: 2 } }), model)
  assert.equal(smaller.state.ep, 2)
  assert.equal(smaller.state.rank, 3)
  assert.deepEqual(smaller.notices, [])
  assert.ok(parseExplorer(new URLSearchParams('ep=2'), llama).notices.length)
  for (const ep of ['3', '16', '-1', 'NaN', '1.5']) assert.ok(parseExplorer(new URLSearchParams({ ep }), model).notices.length)
})
