import test from 'node:test'
import assert from 'node:assert/strict'
import { parseV41Scenario, v41Cache, v41Layer, v41Params, v41Query, v41RankFlow, v41Weights, v41WeightStorage } from '../src/lib/deepseek-v41-reference.ts'

test('V4.1 has distinct KV/Index K owners, Top-k sources and causal regions', () => {
  const layers = Array.from({ length: 40 }, (_, i) => v41Layer(i))
  assert.deepEqual(layers.filter((l) => l.ownsKv).map((l) => l.layer), [2, 8, 14, 20])
  assert.deepEqual(layers.filter((l) => l.mode === 'reindex').map((l) => l.layer), [24, 28, 32, 36])
  assert.equal(layers.filter((l) => l.mode === 'reuse').length, 30)
  assert.equal(layers.filter((l) => l.region === 'encoder').length, 20)
  for (const [layer, owner, indexer] of [[7, 2, 2], [13, 8, 8], [19, 14, 14], [23, 20, 20], [27, 20, 24], [39, 20, 36]]) {
    assert.equal(layers[layer].kvSource, owner)
    assert.equal(layers[layer].indexKeySource, owner)
    assert.equal(layers[layer].topKSource, indexer)
  }
  assert.equal(layers[0].kvSource, null)
  assert.equal(layers[0].attentionPreFrom, '初始 one-hot [1,0,0,0]')
  assert.equal(layers[20].attentionPreFrom, 'Layer 19 FFN 产生的 pre')
  assert.equal(layers[20].ffnPreFrom, 'Layer 20 Attention 产生的 pre')
  assert.deepEqual(layers.filter((l) => l.engram).map((l) => l.layer), [1, 14])
})

test('packed global KV is exactly 890 B/token for even S, without counting 40 copies', () => {
  for (const b of [1, 3, 64]) for (const s of [2, 128, 4096, 1048576]) {
    const data = v41Cache(b, s, 'packed')
    assert.equal(data.globalBytes, b * s * 890)
    assert.equal(data.windowBytes, b * 40 * Math.min(s, 128) * 528)
    assert.equal(data.compressorBytes, b * 3 * 2 * 2 * 512 * 4)
    assert.equal(data.total, data.globalBytes + data.windowBytes + data.compressorBytes)
  }
  const before = v41Cache(1, 4095, 'packed'), after = v41Cache(1, 4096, 'packed')
  assert.equal(after.globalBytes - before.globalBytes, 4 * (288 + 68))
  assert.equal(v41Cache(1, 4097, 'packed').globalBytes - after.globalBytes, 288 + 68)
  assert.equal(after.total, 6373376)
})

test('reference fake quant BF16 buffers differ from packed payload and maximum preallocation', () => {
  const data = v41Cache(1, 4096, 'reference')
  assert.equal(data.globalBytes, (3 * 2048 + 4096) * (512 + 128) * 2)
  assert.equal(data.windowBytes, 40 * 128 * 512 * 2)
  assert.equal(data.total, 18374656)
  assert.equal(data.referenceAllocatedAtContext, (3 * 524288 + 1048576) * 640 * 2 + 40 * 128 * 512 * 2 + 24576)
  assert.ok(data.referenceAllocatedAtContext > data.total)
  assert.equal(v41Cache(1, 1, 'packed').owners[0].records, 0)
  assert.equal(v41Cache(1, 1, 'packed').owners[3].records, 1)
})

test('C2 visibility and hierarchical candidate boundaries remain causal', () => {
  assert.equal(v41Query(2, 0).records, 0)
  assert.equal(v41Query(2, 1).records, 1)
  assert.equal(v41Query(2, 2).records, 1)
  assert.equal(v41Query(0, 4095).selectedPositions, 0)
  const full = v41Query(20, 16383), tail = v41Query(24, 16384)
  assert.equal(full.visibleBlocks, 2048)
  assert.equal(tail.visibleBlocks, 2049)
  assert.equal(tail.keptBlocks, 2048)
  assert.equal(tail.pinnedBlock, 2048)
  assert.equal(tail.candidatePositionUpper, 16384)
  assert.equal(tail.selectedPositions, 512)
})

test('reference quantized parameters count explicit scale layouts and FP4 byte packing', () => {
  const weight = (shape, dtype, copies = 1) => ({ name: 'fixture', shape, dtype, copies, placement: 'replicated' })
  const fp4 = v41WeightStorage(weight([2304, 5120], 'fp4-block32', 2))
  assert.deepEqual(fp4.payloadShape, [2304, 2560])
  assert.deepEqual(fp4.scaleShape, [2304, 160])
  assert.equal(fp4.scaleBytes, 2 * 2304 * 160)
  assert.equal(fp4.dataBytes, 2 * 2304 * 2560)
  const fp8 = v41WeightStorage(weight([24, 5120], 'fp8-block32'))
  assert.deepEqual(fp8.scaleShape, [1, 160])
  assert.equal(fp8.bytes, 24 * 5120 + 160)
  const row = v41WeightStorage(weight([48002086, 256], 'fp8-row32'))
  assert.equal(row.bytes, 48002086 * (256 + 8))
  assert.equal(v41WeightStorage(weight([3], 'fp32')).bytes, 12)
  for (const bits of [4, 8, 16, 32]) assert.equal(v41WeightStorage(weight([2304, 5120], 'fp4-block32'), bits).bytes, 2304 * 5120 * bits / 8)
})

test('all 40 layers use real owner weights, whole routed experts and replicated shared FFNs', () => {
  for (let layer = 0; layer < 40; layer++) for (const world of [1, 2, 4, 8]) {
    const data = v41Weights(layer, world), state = v41Layer(layer)
    for (const w of data) assert.ok(Number.isSafeInteger(v41WeightStorage(w).bytes))
    assert.equal(data.some((w) => w.name === 'compressor.wkv'), state.ownsKv)
    assert.equal(data.some((w) => w.name === 'indexer.wq_b'), state.ownsIndex)
    assert.equal(data.some((w) => w.name === 'indexer.wk'), state.ownsKv)
    const routed = data.filter((w) => w.placement === 'expert-shard')
    assert.equal(routed.reduce((s, w) => s + v41WeightStorage(w).elements, 0), 384 / world * 3 * 5120 * 2304)
    const shared = data.filter((w) => w.name.startsWith('shared'))
    assert.equal(shared.reduce((s, w) => s + v41WeightStorage(w).elements, 0), 3 * 5120 * 2304)
    assert.deepEqual(data.find((w) => w.name === 'attn.sink').shape, [64 / world])
  }
  assert.deepEqual(v41Weights(14, 8).find((w) => w.name === 'engram.embed').shape, [48002086, 256])
  assert.equal(v41Weights(20, 1).find((w) => w.name === 'compressor.wkv').dtype, 'bf16')
  assert.equal(v41Weights(2, 1).find((w) => w.name === 'compressor.wkv').dtype, 'fp32')
})

test('scenario links validate boundaries, preserve allowed fields and clamp teaching rank', () => {
  const parsed = parseV41Scenario(new URLSearchParams('layer=24&b=3&s=16385&world=8&replicas=4&rank=31&phase=prefill&storage=packed&weights=4&view=weights&lesson=5&token=private'))
  assert.deepEqual(parsed.notices, [])
  assert.deepEqual(parseV41Scenario(v41Params(parsed.state)).state, parsed.state)
  assert.ok(!v41Params(parsed.state).toString().includes('private'))
  const reduced = parseV41Scenario(v41Params({ ...parsed.state, world: 1, replicas: 1 }))
  assert.equal(reduced.state.rank, 0)
  assert.deepEqual(reduced.notices, [])
  assert.equal(parsed.state.view, 'weights')
  assert.equal(parsed.state.lesson, 5)
  assert.equal(parseV41Scenario(new URLSearchParams()).state.view, 'diagram')
  assert.equal(parseV41Scenario(new URLSearchParams()).state.lesson, undefined)
  assert.equal(parseV41Scenario(new URLSearchParams('view=invalid&lesson=8')).notices.length, 2)
  const bad = parseV41Scenario(new URLSearchParams('layer=40&b=0&s=0&world=3&rank=64&phase=x&storage=fp4&weights=awq'))
  assert.equal(bad.notices.length, 8)
  for (const n of [-1, 40, NaN, 1.5]) assert.throws(() => v41Layer(n), /Invalid/)
  assert.throws(() => v41Cache(1, 0, 'packed'), /Invalid/)
  assert.throws(() => v41Query(2, -1), /Invalid/)
  assert.throws(() => v41Weights(1, 3), /Invalid/)
  assert.throws(() => v41WeightStorage({ shape: [1, 31], dtype: 'fp4-block32', copies: 1 }), /32-aligned/)
})

test('rank flows cover TP head slices, complete EP experts and replica-local reductions', () => {
  for (const world of [1, 2, 4, 8]) for (const replicas of [1, 2, 4, 8]) for (let rank = 0; rank < world * replicas; rank++) {
    const state = parseV41Scenario(new URLSearchParams(`layer=14&b=3&s=5&world=${world}&replicas=${replicas}&rank=${rank}&phase=prefill&flow=moe`)).state
    const result = v41RankFlow(state)
    assert.equal(result.tokens, 15)
    assert.deepEqual(result.peers, Array.from({ length: world }, (_, i) => Math.floor(rank / world) * world + i))
    assert.equal(result.headEnd - result.headStart + 1, 64 / world)
    assert.equal(result.expertEnd - result.expertStart + 1, 384 / world)
    assert.deepEqual(result.attention.find((s) => s.id === 'q-heads').output, [15, 64 / world, 512])
    assert.deepEqual(result.attention.find((s) => s.id === 'output-a').input, [15, 8 / world, 4096])
    assert.deepEqual(result.attention.find((s) => s.id === 'output-b').input, [15, 8192 / world])
    assert.deepEqual(result.attention.find((s) => s.id === 'attention-reduce').output, [15, 5120])
    assert.deepEqual(result.moe.find((s) => s.id === 'expert-up').output, ['T_e', 2304])
    assert.equal(result.assignmentMax, 90)
    assert.equal(result.assignmentMin, world === 1 ? 90 : 0)
    for (const stage of [...result.attention, ...result.moe, ...result.engram]) for (const name of stage.weightNames) {
      assert.ok(v41Weights(14, world).some((w) => w.name === name), `missing linked weight: ${name}`)
    }
    const decode = v41RankFlow({ ...state, phase: 'decode' })
    assert.equal(decode.tokens, 3)
    assert.deepEqual(decode.attention[0].input, [3, 5120])
    assert.deepEqual(parseV41Scenario(v41Params(state)).state, state)
  }
})

test('Engram row partitions cover only real IDs, while padded rows remain allocated', () => {
  for (const layer of [1, 14]) for (const world of [1, 2, 4, 8]) {
    let covered = 0, allocated = 0
    for (let rank = 0; rank < world; rank++) {
      const state = parseV41Scenario(new URLSearchParams(`layer=${layer}&world=${world}&rank=${rank}`)).state
      const rows = v41RankFlow(state).engramRows
      assert.equal(rows.start, covered)
      assert.equal(rows.end, rows.start + rows.valid - 1)
      assert.equal(rows.padding, rows.allocated - rows.valid)
      covered += rows.valid; allocated += rows.allocated
    }
    assert.equal(covered, layer === 1 ? 384006168 : 384016682)
    assert.equal(allocated, Math.ceil(covered / world) * world)
  }
  const state = parseV41Scenario(new URLSearchParams('layer=14&world=8&rank=7')).state
  assert.equal(v41RankFlow(state).engramRows.padding, 6)
  assert.equal(v41RankFlow({ ...state, layer: 2 }).engramRows, null)
  assert.deepEqual(v41RankFlow({ ...state, layer: 2 }).engram, [])
  for (const patch of [{ world: 3 }, { replicas: 0 }, { rank: 64 }, { batch: 0 }, { sequence: NaN }, { phase: 'draft' }]) assert.throws(() => v41RankFlow({ ...state, ...patch }), /Invalid/)
  assert.equal(parseV41Scenario(new URLSearchParams('flow=unknown')).state.flow, 'attention')
})
