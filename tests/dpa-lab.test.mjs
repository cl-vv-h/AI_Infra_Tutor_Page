import test from 'node:test'
import assert from 'node:assert/strict'
import { dpaLayout, dpaParams, dpaSizes, parseDpa } from '../src/lib/dpa-lab.ts'
import { getModelArchitecture } from '../src/data/models.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'

const read = (query = '') => parseDpa(new URLSearchParams(query)).state
const readQwen = (query = '') => parseDpa(new URLSearchParams(query), 'qwen3-8b').state

test('Qwen DPA uses Attention TP for GQA, total TP for Dense, and replicated norms: independent full Decoder arithmetic', () => {
  const model = getModelArchitecture('qwen3-8b')
  for (const tp of [1, 2, 4, 8]) for (const dp of dpaSizes(tp)) for (const mlp of ['bf16', 'fp8']) {
    const mixed = { mlp, shared: 'bf16', experts: 'bf16' }
    const state = { ...readQwen(`tp=${tp}&dp=${dp}&groups=${Array(dp).fill(2).join(',')}&layer=35`), mixed }
    const data = dpaLayout(state, 'qwen3-8b'), a = tp / dp
    const expected = 16896 + 83886080 / a + (mlp === 'fp8' ? 151031808 : 301989888) / tp
    assert.equal(data.layerWeightBytes, expected)
    assert.equal(data.allLayersWeightBytes, expected * 36)
    assert.equal(data.allRanksWeightBytes, expected * 36 * tp)
    assert.equal(data.layerBudgets.length, 36)
    assert.equal(data.dense, true)
    assert.equal(data.selected.expertStart, null)
    assert.equal(data.weights.find(w => w.name.startsWith('q_proj')).shape, `[${32 / a} × 128, 4096]`)
    assert.equal(data.weights.find(w => w.name.startsWith('gate_proj')).shape, `[${12288 / tp}, 4096]`)
    assert.equal(data.weights.find(w => w.name.startsWith('post_attention_layernorm')).bytes, 8192)
    const normal = dpaLayout({ ...state, dp: 1, requests: [2] }, 'qwen3-8b')
    for (const weight of data.weights) {
      const previous = normal.weights.find(w => w.name === weight.name)
      const shardedAttention = weight.attention && !weight.name.includes('norm')
      assert.equal(weight.bytes, previous.bytes * (shardedAttention ? dp : 1))
    }
    assert.equal(normal.allLayersWeightBytes, decoderWeightBudget(model, 35, tp, 16, 1, mixed).allLayersBytes)
    for (const bits of [4, 8, 16, 32]) {
      const uniform = dpaLayout({ ...state, mixed: undefined, bits }, 'qwen3-8b')
      assert.equal(uniform.layerWeightBytes, (8448 + 41943040 / a + 150994944 / tp) * bits / 8)
      assert.equal(dpaLayout({ ...state, bits }, 'qwen3-8b').layerWeightBytes, expected)
    }
  }
})

test('Qwen DPA GQA cache is head-sharded, not MLA replication; full fleet cache is invariant at fixed request count', () => {
  for (const tp of [1, 2, 4, 8]) for (const dp of dpaSizes(tp)) for (const cacheBytes of [1, 2]) {
    const requests = Array.from({ length: dp }, (_, i) => i === 0 ? 3 : i % 3)
    const state = { ...readQwen(`tp=${tp}&dp=${dp}&groups=${requests.join(',')}&s=128`), cacheBytes }
    const data = dpaLayout(state, 'qwen3-8b'), a = tp / dp
    const total = requests.reduce((sum, n) => sum + n, 0) * 128 * 36 * 2 * 8 * 128 * cacheBytes
    assert.equal(data.dpaCacheBytes, total)
    assert.equal(data.normalTpCacheBytes, total)
    let sumRanks = 0
    for (let rank = 0; rank < tp; rank++) {
      const local = dpaLayout({ ...state, rank }, 'qwen3-8b')
      assert.deepEqual(local.cacheShape, [requests[Math.floor(rank / a)], 128, 2, 8 / a, 128])
      assert.equal(local.selected.group.cacheBytes, local.cacheShape.reduce((x, y) => x * y, 1) * 36 * cacheBytes)
      assert.equal(local.selected.kvHeadsStart, rank % a * 8 / a)
      assert.equal(local.selected.kvHeadsEnd, (rank % a + 1) * 8 / a - 1)
      assert.equal(local.selected.headsStart, rank % a * 32 / a)
      sumRanks += local.selected.group.cacheBytes
    }
    assert.equal(sumRanks, total)
    for (const group of data.groups) {
      const heads = group.peers.flatMap(rank => Array.from({ length: 8 / a }, (_, n) => data.ranks[rank].kvHeadsStart + n))
      assert.deepEqual(heads, [0, 1, 2, 3, 4, 5, 6, 7])
    }
  }
})

test('Qwen DPA uneven/idle groups distinguish effective QKV from padded Dense rows, with exact boundary bytes', () => {
  const state = readQwen('tp=8&dp=4&groups=3,1,0,2&rank=5&s=128')
  const idle = dpaLayout(state, 'qwen3-8b')
  assert.equal(idle.mode, 'MAX_LEN')
  assert.equal(idle.bufferRows, 16)
  assert.equal(idle.globalBufferBytes, 16 * 4096 * 2)
  assert.deepEqual(idle.boundaryTensors.map(t => t.shape), [[0, 4096], [16, 4096], [16, 4096], [0, 4096]])
  assert.deepEqual(idle.internalTensors.map(t => t.shape), [[0, 3072], [0, 16, 128], [0, 4, 128], [16, 3072], [16, 1536], [16, 4096]])
  assert.deepEqual(idle.internalTensors.map(t => t.bytes), [0, 0, 0, 98304, 49152, 131072])
  assert.equal(idle.selected.group.cacheBytes, 0, 'padding does not create cache')
  for (const phase of ['decode', 'prefill']) {
    const data = dpaLayout({ ...state, rank: 0, phase }, 'qwen3-8b')
    const n = phase === 'decode' ? 3 : 384
    assert.equal(data.internalTensors[0].bytes, n * 3072 * 2)
    assert.equal(data.internalTensors[0].bytes, data.internalTensors[1].bytes + data.internalTensors[2].bytes, 'Q and two K/V views partition QKV, not new independent payload')
    assert.equal(data.boundaryTensors[0].bytes, n * 4096 * 2)
    assert.equal(data.mode, phase === 'decode' ? 'MAX_LEN' : 'SUM_LEN')
    assert.equal(data.bufferRows, phase === 'decode' ? 16 : 768)
    assert.equal(data.allLayersWeightBytes, idle.allLayersWeightBytes)
  }
  const sparse = dpaLayout({ ...state, requests: [9, 0, 0, 0] }, 'qwen3-8b')
  assert.equal(sparse.mode, 'SUM_LEN')
  assert.equal(sparse.bufferRows, 10)
  const empty = dpaLayout({ ...state, requests: [0, 0, 0, 0] }, 'qwen3-8b')
  assert.equal(empty.dpaCacheBytes, 0)
  assert.equal(empty.internalTensors.every(t => t.bytes === 0), true)
  assert.equal(empty.allLayersWeightBytes, idle.allLayersWeightBytes)
})

test('Qwen DPA URLs enforce model context/layers and exclude EP or expert precision, without widening GLM defaults', () => {
  const invalid = parseDpa(new URLSearchParams('layer=77&s=1048576&ep=8&precision=mixed&mlp=fp8&experts=w4afp8&w4stage=processed'), 'qwen3-8b')
  assert.equal(invalid.notices.length, 4)
  assert.equal(invalid.state.layer, 0)
  assert.equal(invalid.state.sequence, 4096)
  assert.equal(invalid.state.ep, 1)
  assert.deepEqual(invalid.state.mixed, { mlp: 'fp8', shared: 'bf16', experts: 'bf16' })
  const params = dpaParams(invalid.state, 'qwen3-8b')
  assert.equal(params.has('w4stage'), false)
  assert.deepEqual(parseDpa(params, 'qwen3-8b').state, invalid.state)
  for (const patch of [{ ep: 2 }, { layer: 36 }, { sequence: 40961 }, { mixed: { mlp: 'fp8', shared: 'fp8', experts: 'bf16' } }]) assert.throws(() => dpaLayout({ ...invalid.state, ...patch }, 'qwen3-8b'), /Invalid DPA/)
  assert.throws(() => dpaLayout(readQwen(), 'qwen3-30b-a3b'), /not audited/)
  assert.equal(read().layer, 3)
  assert.equal(read('s=1048576&layer=77').layer, 77)
})

test('DPA mixed storage uses independently sharded axes, both W4A8 scales and fixed FP32 routers', () => {
  const mixed = { mlp: 'fp8', shared: 'fp8', experts: 'w4afp8' }
  const state = { ...read('tp=8&dp=4&ep=4&groups=3,1,0,2&rank=5'), mixed }
  const data = dpaLayout(state)
  const gate = data.weights.find(w => w.routedExpert && w.name.includes('gate_up'))
  assert.deepEqual(gate.storage.payloadShape, [64, 2048, 3072])
  assert.deepEqual(gate.storage.scaleShape, [64, 2048, 48])
  assert.deepEqual(gate.storage.inputScaleShape, [64, 2])
  assert.equal(gate.bytes, 64 * 2048 * 3072 + 64 * 2048 * 48 * 4 + 64 * 2 * 2)
  const down = data.weights.find(w => w.routedExpert && w.name.includes('down'))
  assert.deepEqual(down.storage.payloadShape, [64, 6144, 512])
  assert.equal(down.bytes, 64 * 6144 * 512 + 64 * 6144 * 8 * 4 + 64 * 2)
  const router = data.weights.find(w => w.name.startsWith('gate.weight'))
  assert.equal(router.storage.format, 'fp32')
  assert.equal(router.bytes, 256 * 6144 * 4)
  assert.equal(data.weights.find(w => w.name.startsWith('e_score')).bytes, 256 * 4)
  assert.equal(data.weights.find(w => w.name.startsWith('q_b_proj')).bytes, 32 * 256 * 2048 * 2)
  assert.equal(data.weights.find(w => w.name.startsWith('shared_experts.gate_up')).bytes, 512 * 6144 + 4 * 48 * 4)
  const dense = dpaLayout({ ...state, layer: 0 })
  assert.equal(dense.weights.find(w => w.nodeId === 'dense-ffn' && w.name.includes('gate_up')).bytes, 3072 * 6144 + 24 * 48 * 4)
  assert.equal(data.allLayersWeightBytes, dense.allLayersWeightBytes)
  assert.equal(data.allLayersWeightBytes, dense.layerWeightBytes * 3 + data.layerWeightBytes * 75)
  assert.equal(data.allRanksWeightBytes, data.allLayersWeightBytes * 8)
  assert.equal(dpaLayout({ ...state, bits: 4 }).allLayersWeightBytes, data.allLayersWeightBytes, 'inactive uniform width cannot change mixed storage')
  const ep1 = dpaLayout({ ...state, ep: 1 })
  const routed = d => d.weights.filter(w => w.routedExpert)
  const sum = (d, key) => routed(d).reduce((n, w) => n + w.storage[key], 0)
  assert.equal(sum(ep1, 'payloadBytes'), sum(data, 'payloadBytes'))
  assert.equal(sum(ep1, 'scaleBytes'), sum(data, 'scaleBytes'))
  assert.equal(sum(ep1, 'inputScaleBytes'), sum(data, 'inputScaleBytes') * 4)
  assert.equal(ep1.layerWeightBytes - data.layerWeightBytes, (256 - 64) * 6)
  for (const key of ['mlp', 'shared', 'experts']) for (const layer of [0, 3]) {
    const base = dpaLayout({ ...state, layer })
    const changed = dpaLayout({ ...state, layer, mixed: { ...mixed, [key]: 'bf16' } })
    assert.notEqual(changed.allLayersWeightBytes, base.allLayersWeightBytes)
    assert.deepEqual(changed.boundaryTensors, base.boundaryTensors)
    assert.equal(changed.dpaCacheBytes, base.dpaCacheBytes)
    for (let i = 0; i < base.weights.length; i++) {
      assert.equal(changed.weights[i].shape, base.weights[i].shape)
      if (base.weights[i].storage.role === key) assert.notEqual(changed.weights[i].bytes, base.weights[i].bytes)
      else assert.equal(changed.weights[i].bytes, base.weights[i].bytes, `${key} cannot change ${base.weights[i].storage.role}`)
    }
  }
})

test('mixed DPA=1 agrees with the ordinary Decoder ledger; all topology/format layouts reconcile', () => {
  const model = getModelArchitecture('glm-5-2')
  for (const tp of [1, 2, 4, 8]) for (const dp of dpaSizes(tp)) for (const ep of dpaSizes(tp)) for (const experts of ['bf16', 'fp8', 'mxfp4', 'w4afp8']) {
    for (const [mlp, shared, layer] of [['bf16', 'fp8', 0], ['fp8', 'bf16', 77]]) {
      const state = { ...read(`tp=${tp}&dp=${dp}&ep=${ep}&groups=${Array(dp).fill(1).join(',')}&layer=${layer}`), mixed: { mlp, shared, experts } }
      const data = dpaLayout(state)
      assert.equal(data.layerBudgets.length, 78)
      assert.equal(data.layerBudgets[layer].bytes, data.layerWeightBytes)
      assert.equal(data.layerBudgets.reduce((n, row) => n + row.bytes, 0), data.allLayersWeightBytes)
      assert.equal(data.allRanksWeightBytes, tp * data.allLayersWeightBytes)
      for (const w of data.weights) assert.equal(w.bytes, w.storage.payloadBytes + w.storage.scaleBytes + w.storage.inputScaleBytes)
      if (dp === 1) {
        const ordinary = decoderWeightBudget(model, layer, tp, 16, ep, state.mixed)
        assert.equal(data.layerWeightBytes, ordinary.bytes)
        assert.equal(data.allLayersWeightBytes, ordinary.allLayersBytes)
      }
    }
  }
})

test('DPA boundary bytes follow selected request ownership and padding, not weight precision', () => {
  const state = read('tp=8&dp=4&ep=4&rank=5&groups=3,1,0,2')
  const data = dpaLayout(state)
  assert.deepEqual(data.boundaryTensors.map(t => t.shape), [[0, 6144], [16, 6144], [16, 6144], [0, 6144]])
  assert.deepEqual(data.boundaryTensors.map(t => t.bytes), [0, 16 * 6144 * 2, 16 * 6144 * 2, 0])
  const active = dpaLayout({ ...state, rank: 0 })
  assert.equal(active.boundaryTensors[0].bytes, 3 * 6144 * 2)
  assert.equal(active.allLayersWeightBytes, data.allLayersWeightBytes)
  const mixed = dpaLayout({ ...state, mixed: { mlp: 'fp8', shared: 'fp8', experts: 'w4afp8' } })
  assert.deepEqual(mixed.boundaryTensors, data.boundaryTensors)
  assert.equal(mixed.dpaCacheBytes, data.dpaCacheBytes)
  const idle = dpaLayout({ ...state, requests: [0, 0, 0, 0] })
  assert.ok(idle.boundaryTensors.every(t => t.bytes === 0))
  assert.equal(idle.allLayersWeightBytes, data.allLayersWeightBytes)
})

test('DPA mixed URLs roundtrip only public fields and reject invalid precision', () => {
  const mixed = { mlp: 'fp8', shared: 'bf16', experts: 'w4afp8' }
  const state = { ...read('bits=4&groups=3,1,0,2&rank=5'), mixed }
  const params = dpaParams({ ...state, private: 'never-copy', mixed: { ...mixed, private: 'never-copy' } })
  assert.ok(!params.toString().includes('never-copy'))
  assert.deepEqual(parseDpa(params), { state, notices: [] })
  const narrowed = read(dpaParams({ ...state, tp: 2 }))
  assert.deepEqual(narrowed.mixed, mixed)
  assert.equal(narrowed.rank, 1)
  const off = dpaParams({ ...state, mixed: undefined })
  for (const key of ['precision', 'mlp', 'shared', 'experts']) assert.equal(off.has(key), false)
  assert.equal(read(off).bits, 4)
  const bad = parseDpa(new URLSearchParams('precision=mixed&mlp=bad&shared=bad&experts=bad'))
  assert.equal(bad.notices.length, 3)
  assert.deepEqual(bad.state.mixed, { mlp: 'bf16', shared: 'bf16', experts: 'bf16' })
  assert.equal(parseDpa(new URLSearchParams('precision=bad')).notices.length, 1)
  assert.equal(read('mlp=fp8&experts=w4afp8').mixed, undefined)
  assert.throws(() => dpaLayout({ ...state, mixed: { ...mixed, experts: 'bad' } }), /Invalid/)
})
test('DPA groups reuse the same cards while EP groups can cross attention groups', () => {
  const data = dpaLayout(read('tp=8&dp=4&ep=2&rank=5&groups=3,1,0,2'))
  assert.equal(data.ranks.length, 8)
  assert.equal(data.attentionTp, 2)
  assert.equal(data.moeTp, 4)
  assert.equal(data.selected.dpRank, 2)
  assert.equal(data.selected.attentionRank, 1)
  assert.deepEqual(data.selected.group.peers, [4, 5])
  assert.deepEqual(data.selected.moeTpPeers, [4, 5, 6, 7])
  assert.deepEqual(data.selected.epPeers, [1, 5])
  assert.equal(data.selected.expertStart, 128)
  assert.equal(data.selected.expertEnd, 255)
  assert.equal(data.selected.group.tokens, 0)
  assert.ok(data.layerWeightBytes > 0, 'idle rank retains model weights')
})
test('padding uses aligned counts, selects eager MAX/SUM correctly, and never creates KV history', () => {
  const uneven = read('tp=8&dp=4&ep=4&groups=3,1,0,2&s=4096')
  const data = dpaLayout(uneven)
  assert.deepEqual(data.raw, [3, 1, 0, 2])
  assert.deepEqual(data.aligned, [4, 2, 0, 2])
  assert.equal(data.mode, 'MAX_LEN') // 2*(4+2+0+2) == 4*4
  assert.deepEqual(data.counts, [4, 4, 4, 4])
  assert.equal(data.bufferRows, 16)
  assert.equal(data.paddingRows, 10)
  assert.equal(data.globalBufferBytes, 16 * 6144 * 2)
  assert.deepEqual(data.groups.map((g) => g.offset), [0, 4, 8, 12])
  const skew = dpaLayout(read('tp=8&dp=4&groups=9,0,0,0'))
  assert.equal(skew.mode, 'SUM_LEN')
  assert.deepEqual(skew.counts, [10, 0, 0, 0])
  assert.equal(skew.paddingRows, 1)
  const prefill = dpaLayout({ ...uneven, phase: 'prefill' })
  assert.equal(prefill.mode, 'SUM_LEN')
  assert.equal(prefill.bufferRows, 6 * 4096)
  assert.equal(prefill.paddingRows, 0)
  assert.equal(prefill.dpaCacheBytes, data.dpaCacheBytes)
  assert.equal(data.dpaCacheBytes, 6 * 4096 * 78 * 704 * 2 * 2)
  assert.equal(data.normalTpCacheBytes, data.dpaCacheBytes * 4)
  assert.equal(dpaLayout({ ...uneven, cacheBytes: 1 }).dpaCacheBytes, data.dpaCacheBytes / 2)
  const idle = dpaLayout(read('groups=0,0,0,0'))
  for (const key of ['totalTokens', 'bufferRows', 'paddingRows', 'globalBufferBytes', 'dpaCacheBytes']) assert.equal(idle[key], 0)
  const noDpa = dpaLayout(read('tp=8&dp=1&groups=1'))
  assert.equal(noDpa.mode, 'NONE')
  assert.equal(noDpa.bufferRows, 1)
  assert.equal(noDpa.paddingRows, 0)
})
test('Attention TP changes only attention head weights; EP never divides resident bytes twice', () => {
  const one = dpaLayout(read('tp=8&dp=1&ep=1&groups=8'))
  const four = dpaLayout(read('tp=8&dp=4&ep=4&groups=2,2,2,2'))
  assert.equal(one.weights.find((w) => w.name.startsWith('q_b_proj')).shape, '[8 × 256, 2048]')
  assert.equal(four.weights.find((w) => w.name.startsWith('q_b_proj')).shape, '[32 × 256, 2048]')
  assert.equal(four.weights.find((w) => w.routedExpert).shape, '[64, 2 × 1024, 6144]')
  const nonAttention = (d) => d.weights.filter((w) => !w.attention).reduce((sum, w) => sum + w.bytes, 0)
  assert.equal(nonAttention(one), nonAttention(four))
  assert.ok(four.layerWeightBytes > one.layerWeightBytes)
  const shared = (d) => d.weights.filter((w) => w.name.startsWith('shared')).map((w) => w.shape)
  assert.deepEqual(shared(one), shared(four))
  assert.equal(dpaLayout({ ...read(), bits: 4 }).layerWeightBytes * 4, dpaLayout(read()).layerWeightBytes)
  const dense = dpaLayout(read('layer=0&tp=8&dp=4'))
  assert.ok(dense.dense)
  assert.ok(!dense.weights.some((w) => w.routedExpert))
  assert.equal(dense.weights.find((w) => w.name === 'gate_up_proj · TP local').shape, '[2 × 1536, 6144]')
})
test('buffer segments partition rows exactly and separate alignment from MAX padding', () => {
  const data = dpaLayout(read('tp=8&dp=4&groups=3,1,0,2&rank=5'))
  assert.deepEqual(data.bufferSegments.map(({ dpRank, kind, start, rows }) => [dpRank, kind, start, rows]), [
    [0, 'tokens', 0, 3], [0, 'alignment', 3, 1],
    [1, 'tokens', 4, 1], [1, 'alignment', 5, 1], [1, 'maximum', 6, 2],
    [2, 'maximum', 8, 4], [3, 'tokens', 12, 2], [3, 'maximum', 14, 2],
  ])
  for (const query of ['tp=8&dp=1&groups=1', 'groups=0,0,0,0', 'groups=9,0,0,0', 'groups=3,1,0,2&phase=prefill&s=1048576']) {
    const layout = dpaLayout(read(query))
    let end = 0
    for (const segment of layout.bufferSegments) {
      assert.equal(segment.start, end)
      assert.ok(segment.rows > 0)
      end += segment.rows
    }
    assert.equal(end, layout.bufferRows)
    assert.equal(layout.bufferSegments.filter((s) => s.kind === 'tokens').reduce((sum, s) => sum + s.rows, 0), layout.totalTokens)
    assert.ok(layout.bufferSegments.length <= layout.groups.length * 3, 'DOM data is bounded independently of sequence length')
    if (layout.mode !== 'MAX_LEN') assert.ok(!layout.bufferSegments.some((s) => s.kind === 'maximum'))
  }
})
test('all topologies conserve requests, groups, rows and share only validated experiment fields', () => {
  for (const tp of [1, 2, 4, 8]) for (const dp of dpaSizes(tp)) for (const ep of dpaSizes(tp)) {
    const state = read(`tp=${tp}&dp=${dp}&ep=${ep}&rank=${tp - 1}&groups=${Array.from({ length: dp }, (_, i) => i).join(',')}&s=1&phase=prefill`)
    const data = dpaLayout(state)
    assert.equal(data.groups.flatMap((g) => g.peers).length, tp)
    assert.equal(data.groups.reduce((sum, g) => sum + g.tokens, 0), data.totalTokens)
    assert.equal(data.groups.reduce((sum, g) => sum + g.padded, 0), data.bufferRows)
    assert.equal(data.normalTpCacheBytes, data.dpaCacheBytes * dp)
    assert.deepEqual(read(dpaParams(state).toString()), state)
  }
  const state = read('tp=8&dp=4&ep=8&rank=7&groups=4,3,2,1&private=not-public')
  const reduced = read(dpaParams({ ...state, tp: 2 }).toString())
  assert.deepEqual(reduced.requests, [4, 3])
  assert.equal(reduced.dp, 2); assert.equal(reduced.ep, 2); assert.equal(reduced.rank, 1)
  assert.ok(!dpaParams(state).has('private'))
  assert.ok(parseDpa(new URLSearchParams('groups=1,2&tp=3&dp=3&ep=16&rank=9&s=0&phase=bad&bits=3')).notices.length >= 7)
  for (const patch of [{ tp: 3 }, { dp: 16 }, { ep: 16 }, { rank: 9 }, { requests: [NaN, 1, 2, 3] }, { requests: [-1, 1, 2, 3] }, { layer: 78 }, { sequence: 0 }]) assert.throws(() => dpaLayout({ ...state, ...patch }), /Invalid/)
})
