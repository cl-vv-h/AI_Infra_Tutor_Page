import assert from 'node:assert/strict'
import test from 'node:test'
import { getModelArchitecture } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderGroups, decoderNodes, formatShape, layerCacheNode } from '../src/lib/model-lab.ts'
import { compressedCacheParts } from '../src/lib/compressed-cache.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'
import { learningStops } from '../src/lib/model-learning.ts'

const model = getModelArchitecture('deepseek-v4-flash')
const base = { phase: 'decode', batch: 1, sequence: 4096, tp: 4, cacheBytes: 2 }

test('original Flash has 43 target layers: 2 SWA, 21 CSA, 20 HCA; no MTP counted as target', () => {
  assert.equal(model.id, 'deepseek-v4-flash')
  assert.equal(model.dimensions.layers, 43)
  assert.equal(model.execution.denseLayers, 0)
  assert.equal(model.execution.maxContext, 1048576)
  assert.deepEqual(compressedCacheParts(model, 4096, 1, 2).counts, { window: 2, csa: 21, hca: 20 })
  for (let layer = 0; layer < 43; layer++) {
    const kind = layer < 2 ? 'window-mqa' : layer % 2 === 0 ? 'csa' : 'hca'
    assert.equal(attentionKind(model, layer), kind)
    assert.equal(layerCacheNode(model, layer).id, kind + '-cache')
    assert.equal(decoderNodes(model, layer)[6].id, layer < 3 ? 'hash-moe' : 'moe')
  }
})

test('mHC groups preserve four-stream residuals, reduce once, then mix once per sublayer', () => {
  for (let layer = 0; layer < 43; layer++) {
    const nodes = decoderNodes(model, layer)
    assert.deepEqual(nodes.map(n => n.id), ['hc-attn-pre', 'attention-norm', attentionKind(model, layer), 'hc-attn-post', 'hc-ffn-pre', 'ffn-norm', layer < 3 ? 'hash-moe' : 'moe', 'hc-ffn-post'])
    const groups = decoderGroups(model, layer)
    assert.deepEqual(groups.map(g => g.length), [4, 4])
    for (const group of groups) {
      assert.equal(group[0].inputShape, '[N, 4, 4096]')
      assert.equal(group[0].outputShape, '[N, 4096]')
      assert.equal(group.at(-1).outputShape, '[N, 4, 4096]')
      assert.equal(group.at(-1).weights.length, 0)
    }
    assert.ok(!nodes.some(n => n.id.endsWith('-add')))
    const stops = learningStops(model, layer)
    assert.equal(stops.filter(s => s.node.tone === 'memory').length, 1)
    assert.match(stops.find(s => s.node.id === 'hc-attn-pre').question, /四路/)
  }
})

test('occupied KV + index records + fixed reference compressor windows agree with independent arithmetic', () => {
  const p = compressedCacheParts(model, 4096, 1, 2)
  assert.equal(p.slidingBytes, 5636096)
  assert.equal(p.compressedBytes, 22675456)
  assert.equal(p.indexBytes, 5505024)
  assert.equal(p.compressorBytes, 12206080)
  assert.equal(p.total, 46022656)
  for (const tp of [1, 2, 4, 8]) for (const batch of [1, 3, 64]) for (const cacheBytes of [1, 2]) {
    const e = cacheEstimate(model, { ...base, tp, batch, cacheBytes })
    assert.equal(e.perRankBytes, batch * (12206080 + 33816576 * cacheBytes / 2))
    assert.equal(e.allRankBytes, e.perRankBytes * tp)
    assert.equal(e.perRankBytes, e.kvBytes + e.indexBytes + e.compressorBytes)
    assert.equal(e.compressorBytes, 12206080 * batch)
    assert.equal(e.recurrentBytes + e.convBytes, 0)
  }
})

test('compression uses completed blocks and exact staircase growth, not ceil or Top-k truncation', () => {
  for (const s of [1, 3, 4, 127, 128, 129, 1023, 1024, 2047, 2048, 2049, 4095, 4096, 1048576]) {
    const p = compressedCacheParts(model, s, 1, 2)
    assert.equal(p.slots4, Math.floor(s / 4))
    assert.equal(p.slots128, Math.floor(s / 128))
    const a = cacheEstimate(model, { ...base, sequence: s })
    const b = cacheEstimate(model, { ...base, sequence: s + 1 })
    const expected = (s < 128 ? 43 * 512 * 2 : 0) + ((s + 1) % 4 === 0 ? 21 * (512 + 128) * 2 : 0) + ((s + 1) % 128 === 0 ? 20 * 512 * 2 : 0)
    assert.equal(b.perRankBytes - a.perRankBytes, expected)
    assert.equal(a.growthBytesPerToken, expected)
  }
  assert.ok(compressedCacheParts(model, 4096, 1, 2).slots4 > model.execution.cache.indexTopk)
  const p = planCacheCapacity(model, base, 46022656)
  assert.equal(p.maximumSequence, 4099)
  assert.equal(p.maximumBatch, 1)
  assert.equal(planCacheCapacity(model, base, 46022655).maximumSequence, 4095)
})

test('weight inventory counts mHC, grouped O, compressor projections and all resident experts', () => {
  const H = 4096, D = 512
  const compressor = (r, d) => 2 * (r === 4 ? 2 : 1) * d * H + r * (r === 4 ? 2 : 1) * d + d
  for (const tp of [1, 2, 4, 8]) for (const layer of [0, 2, 3, 42]) {
    const budget = decoderWeightBudget(model, layer, tp, 16)
    const ratio = model.execution.cache.ratios[layer]
    const attention = budget.rows.find(r => r.node.id === attentionKind(model, layer))
    const baseAttention = H * 1024 + 1024 + H * D + D + 64 + (64 * D * 1024 + 8 * 1024 * 4096 + H * 8 * 1024) / tp
    const indexer = 64 * 128 * 1024 + 64 * H + compressor(4, 128)
    assert.equal(attention.local, baseAttention + (ratio ? compressor(ratio, D) : 0) + (ratio === 4 ? indexer : 0))
    const hc = budget.rows.filter(r => r.node.id.startsWith('hc-')).reduce((sum, r) => sum + r.local, 0)
    assert.equal(hc, 2 * (24 * 4 * H + 24 + 3))
    const moe = budget.rows.find(r => r.node.id.endsWith('moe'))
    assert.equal(moe.local, 256 * H + (layer < 3 ? 0 : 256) + 257 * 3 * H * 2048 / tp)
    assert.ok(budget.complete)
  }
  const hca = model.nodes.find(n => n.id === 'hca')
  assert.ok(!hca.weights.some(w => w.name.startsWith('indexer.')))
  assert.equal(formatShape(hca.weights.find(w => w.name.startsWith('wo_a')).shape, model, { ...base, tp: 8 }), '[1, 1024, 4096]')
  assert.ok(!model.nodes.find(n => n.id === 'hash-moe').weights.some(w => /tid2eid|bias/.test(w.name)))
})

test('share links switch only to modules that exist in destination layer', () => {
  const state = parseExplorer(new URLSearchParams('layer=2&node=csa&b=3&s=1048576&tp=8&bytes=1'), model).state
  const other = selectExplorerLayer(model, state, 3)
  assert.equal(other.nodeId, 'hca')
  assert.deepEqual(other.scenario, state.scenario)
  assert.deepEqual(parseExplorer(explorerParams(other), model).notices, [])
  const cache = selectExplorerLayer(model, { ...state, nodeId: 'csa-cache' }, 0)
  assert.equal(cache.nodeId, 'window-mqa')
})
