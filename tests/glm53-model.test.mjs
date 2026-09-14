import assert from 'node:assert/strict'
import test from 'node:test'
import { getModelArchitecture } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderNodes, formatShape, layerCacheNode } from '../src/lib/model-lab.ts'
import { kdaMlaCacheParts, pooledIndexReads } from '../src/lib/kda-mla-cache.ts'
import { learningStops } from '../src/lib/model-learning.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'

const model = getModelArchitecture('glm-5-3-flash')
const base = { phase: 'decode', batch: 1, sequence: 4096, tp: 4, cacheBytes: 2 }

test('GLM 5.3 Flash has independent 45-layer configuration, 34 KDA and 11 NoPE DSA, 3 dense layers', () => {
  assert.equal(model.id, 'glm-5-3-flash')
  assert.deepEqual(model.dimensions, { hiddenSize: 4096, vocabSize: 154880, layers: 45, attentionHeads: 64, kvHeads: 64, headDim: 256, intermediateSize: 12288 })
  assert.equal(model.execution.maxContext, 1048576)
  assert.equal(model.execution.denseLayers, 3)
  assert.equal(model.execution.expertIntermediateSize, 2048)
  for (let i = 0; i < 45; i++) {
    const kind = i % 4 === 3 ? 'mla' : 'kda'
    assert.equal(attentionKind(model, i), kind)
    assert.equal(layerCacheNode(model, i).id, kind === 'kda' ? 'recurrent-state' : 'kv-cache')
    assert.deepEqual(decoderNodes(model, i).map(n => n.id), ['hc-attn-pre', 'attention-norm', kind, 'hc-attn-post', 'hc-ffn-pre', 'ffn-norm', i < 3 ? 'dense-ffn' : 'moe', 'hc-ffn-post'])
  }
})

test('visual merge occurs before global mHC expand; final head is mean, not learned V4 head', () => {
  for (const layer of [0, 3, 44]) {
    const stops = learningStops(model, layer)
    assert.deepEqual(stops.slice(0, 4).map(s => s.node.id), ['embedding', 'vision', 'hc-expand', 'hc-attn-pre'])
    assert.equal(stops[0].node.outputShape, '[N, 4096]')
    assert.equal(stops[2].node.inputShape, '[N, 4096]')
    assert.equal(stops[2].node.outputShape, '[N, 4, 4096]')
    assert.equal(stops[2].node.weights.length, 0)
  }
  const head = model.nodes.find(n => n.id === 'lm-head')
  assert.deepEqual(head.weights.map(w => w.name), ['norm.weight', 'lm_head · TP local'])
  assert.match(head.description, /算术平均/)
  const kda = model.nodes.find(n => n.id === 'kda')
  assert.match(kda.description, /每个 key 通道/)
  assert.match(kda.description, /alpha=exp\(g\)/)
  const vision = model.nodes.find(n => n.id === 'vision')
  assert.equal(vision.outputShape, '[P / 4, 4096]')
  assert.match(vision.description, /P=1024→256/)
})

test('pool selection expands into raw token indices, with a causal incomplete tail and no fake Top-2048 pools', () => {
  for (const t of [1, 2, 3, 4, 5, 2047, 2048, 2049, 2051, 2052, 4095, 4096, 4097, 1048576]) {
    const r = pooledIndexReads(t, 4, 2048)
    assert.equal(r.completePools, Math.floor(t / 4))
    assert.equal(r.selectedPools, Math.min(Math.floor(t / 4), 512))
    assert.equal(r.tail, t % 4)
    assert.equal(r.rawTokens, Math.min(2048, t - t % 4) + t % 4)
    assert.ok(r.rawTokens <= t && r.rawTokens <= 2051)
  }
  assert.equal(pooledIndexReads(4095, 4, 2048).rawTokens, 2051)
  assert.equal(pooledIndexReads(4096, 4, 2048).rawTokens, 2048)
})

test('MLA and pooled index replicate while FP32 KDA and BF16 convolution shard independently', () => {
  for (const tp of [1, 2, 4, 8]) for (const batch of [1, 4, 64]) for (const bytes of [1, 2]) {
    const p = kdaMlaCacheParts(model.execution.cache, 4096, batch, tp, bytes)
    assert.equal(p.kvLayers, 11)
    assert.equal(p.recurrentLayers, 34)
    assert.equal(p.kvBytes, batch * 11 * 4096 * 512 * bytes)
    assert.equal(p.indexBytes, batch * 11 * 1024 * 128 * bytes)
    assert.equal(p.tailBytes, batch * 22528)
    assert.equal(p.recurrentBytes, batch * 142606336 / tp)
    assert.equal(p.convBytes, batch * 5013504 / tp)
    const e = cacheEstimate(model, { ...base, batch, tp, cacheBytes: bytes })
    assert.equal(e.perRankBytes, p.kvBytes + p.indexBytes + p.tailBytes + p.recurrentBytes + p.convBytes)
    assert.equal(e.allRankBytes, e.perRankBytes * tp)
    assert.equal(e.perRankBytes, cacheEstimate(model, { ...base, phase: 'prefill', batch, tp, cacheBytes: bytes }).perRankBytes)
  }
  assert.equal(cacheEstimate(model, base).perRankBytes, 85948416)
  assert.equal(formatShape('[{batch}, 3, {kdaQkv}]', model, { ...base, tp: 8 }), '[1, 3, 3072]')
})

test('pool-boundary growth and exact-fit budget include fixed tails and KDA state', () => {
  for (const s of [1024, 2047, 2048, 2049, 4095, 4096, 4097, 1048575]) {
    const a = cacheEstimate(model, { ...base, sequence: s, batch: 3 })
    const b = cacheEstimate(model, { ...base, sequence: s + 1, batch: 3 })
    const growth = 11 * 512 * 2 + ((s + 1) % 4 === 0 ? 11 * 128 * 2 : 0)
    assert.equal(a.growthBytesPerToken, growth)
    assert.equal(b.perRankBytes - a.perRankBytes, 3 * growth)
  }
  const budget = cacheEstimate(model, base).perRankBytes
  assert.equal(planCacheCapacity(model, base, budget).maximumSequence, 4096)
  assert.equal(planCacheCapacity(model, base, budget - 1).maximumSequence, 4095)
  assert.equal(planCacheCapacity(model, base, budget).maximumBatch, 1)
})

test('weight inventory matches independent KDA gates, replicated indexer, dense and all-expert arithmetic', () => {
  for (const tp of [1, 2, 4, 8]) for (const layer of [0, 2, 3, 4, 43, 44]) {
    const budget = decoderWeightBudget(model, layer, tp, 16)
    assert.ok(budget.complete)
    const kind = attentionKind(model, layer)
    const attn = budget.rows.find(r => r.node.id === kind)
    const kdaRep = 2 * 128 * 4096 + 128
    const kdaShard = 3 * 8192 * 4096 + 3 * 8192 * 4 + 2 * 8192 * 128 + 64 * 4096 + 8192 + 64 + 4096 * 8192
    const mlaRep = 1536 * 4096 + 1536 + 512 * 4096 + 512 + 32 * 128 * 1536 + 128 * 4096 + 2 * 128 + 32 * 4096 + 128 * 4096 + 4 * 128
    const mlaShard = 64 * 256 * 1536 + 64 * 512 * 512 + 4096 * 64 * 256
    assert.equal(attn.local, kind === 'kda' ? kdaRep + kdaShard / tp : mlaRep + mlaShard / tp)
    const ffn = budget.rows.find(r => ['dense-ffn', 'moe'].includes(r.node.id))
    assert.equal(ffn.local, layer < 3 ? 3 * 12288 * 4096 / tp : 288 * 4096 + 288 + 289 * 3 * 2048 * 4096 / tp)
    assert.equal(budget.rows.filter(r => r.node.id.startsWith('hc-')).reduce((sum, r) => sum + r.local, 0), 2 * (24 * 16384 + 24 + 3))
    assert.ok(!budget.rows.some(r => r.node.id === 'vision' || r.node.id === 'hc-expand'))
  }
})

test('KDA to DSA switches preserve workload and global multimodal expansion can be shared', () => {
  const s = parseExplorer(new URLSearchParams('layer=2&node=kda&b=3&s=1048576&tp=8&bytes=1&view=cache'), model).state
  const next = selectExplorerLayer(model, s, 3)
  assert.equal(next.nodeId, 'mla')
  assert.deepEqual(next.scenario, s.scenario)
  assert.deepEqual(parseExplorer(explorerParams(next), model).notices, [])
  const global = parseExplorer(new URLSearchParams('layer=44&node=hc-expand'), model)
  assert.deepEqual(global.notices, [])
  assert.equal(global.state.nodeId, 'hc-expand')
})
