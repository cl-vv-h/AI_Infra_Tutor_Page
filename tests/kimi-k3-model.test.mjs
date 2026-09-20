import assert from 'node:assert/strict'
import test from 'node:test'
import { getModelArchitecture } from '../src/data/models.ts'
import { attentionResidualStage, residualSnapshotLabel } from '../src/lib/attention-residual.ts'
import { attentionKind, cacheEstimate, decoderNodes, formatShape } from '../src/lib/model-lab.ts'
import { decoderWeightBudget } from '../src/lib/model-weights.ts'
import { learningStops } from '../src/lib/model-learning.ts'
import { explorerParams, parseExplorer, selectExplorerLayer } from '../src/lib/model-explorer.ts'
import { planCacheCapacity } from '../src/lib/cache-capacity.ts'

const model = getModelArchitecture('kimi-k3')
const base = { phase: 'decode', batch: 1, sequence: 4096, tp: 4, cacheBytes: 2 }

test('Kimi K3 uses all 93 layers including adjacent final MLA layers, not a repeating-only pattern', () => {
  assert.equal(model.id, 'kimi-k3')
  assert.equal(model.dimensions.hiddenSize, 7168)
  assert.equal(model.dimensions.vocabSize, 163840)
  assert.equal(model.execution.denseLayers, 1)
  const mla = Array.from({ length: 93 }, (_, i) => i).filter(i => attentionKind(model, i) === 'mla')
  assert.deepEqual(mla, [...Array.from({ length: 23 }, (_, i) => 4 * (i + 1) - 1), 92])
  for (let i = 0; i < 93; i++) {
    assert.deepEqual(decoderNodes(model, i).map(n => n.id), ['attn-res-read', 'attn-res-write', 'attention-norm', mla.includes(i) ? 'mla' : 'kda', 'attn-res-add', 'ffn-res-read', 'ffn-norm', i === 0 ? 'dense-ffn' : 'moe', 'ffn-res-add'])
  }
})

test('AttnRes reads before writing at boundaries and carries raw prefix, not the weighted input', () => {
  for (let layer = 0; layer < 93; layer++) {
    const writesBefore = Array.from({ length: layer }, (_, i) => i).filter(i => i % 12 === 0).length
    const s = attentionResidualStage(layer, 12)
    assert.equal(s.bankBefore, writesBefore)
    assert.equal(s.bankAfter, writesBefore + Number(layer % 12 === 0))
    assert.equal(s.attentionCandidates, writesBefore + 1)
    assert.equal(s.ffnCandidates, s.bankAfter + 1)
    assert.equal(decoderNodes(model, layer)[0].inputShape, `[N, ${s.attentionCandidates}, 7168]`)
    assert.equal(decoderNodes(model, layer)[5].inputShape, `[N, ${s.ffnCandidates}, 7168]`)
  }
  assert.deepEqual(attentionResidualStage(12, 12), { bankBefore: 1, bankAfter: 2, write: true, attentionCandidates: 2, ffnCandidates: 3 })
  assert.equal(residualSnapshotLabel(0, 12), '输入 embedding')
  assert.equal(residualSnapshotLabel(7, 12), 'Layers 72–83 的子层输出和')
  for (const args of [[-1, 12], [1.5, 12], [0, 0]]) assert.throws(() => attentionResidualStage(...args), RangeError)
  const head = model.nodes.find(n => n.id === 'lm-head')
  assert.equal(head.inputShape, '[N, 9, 7168]')
  assert.equal(head.weights.length, 4)
  assert.match(model.nodes.find(n => n.id === 'ffn-res-add').description, /不替换这份累计状态/)
})

test('NoPE keeps 64 shared K channels and no sparse index; only KDA cache shards with TP', () => {
  for (const tp of [1, 2, 4, 8]) for (const batch of [1, 3, 64]) for (const cacheBytes of [1, 2]) {
    const s = { ...base, tp, batch, cacheBytes }
    const e = cacheEstimate(model, s)
    assert.equal(e.kvBytes, batch * 24 * 4096 * 576 * cacheBytes)
    assert.equal(e.recurrentBytes, batch * 69 * 96 * 128 * 128 * 4 / tp)
    assert.equal(e.convBytes, batch * 69 * 3 * 12288 * 3 * 2 / tp)
    assert.equal(e.perRankBytes, e.kvBytes + e.recurrentBytes + e.convBytes)
    assert.equal(e.indexBytes + e.compressorBytes + e.compressedBytes, 0)
    assert.equal(e.allRankBytes, e.perRankBytes * tp)
    assert.equal(e.perRankBytes, cacheEstimate(model, { ...s, phase: 'prefill' }).perRankBytes)
    assert.equal(e.growthBytesPerToken, 24 * 576 * cacheBytes)
  }
  const budget = cacheEstimate(model, base).perRankBytes
  assert.equal(budget, 225589248)
  assert.equal(planCacheCapacity(model, base, budget).maximumSequence, 4096)
  assert.equal(planCacheCapacity(model, base, budget - 1).maximumSequence, 4095)
  assert.equal(formatShape('[N, {localHeads}, 192]', model, base), '[1, 24, 192]')
})

test('weight arithmetic distinguishes full-rank KDA gate, 192D MLA, replicated latent projections and 896 resident experts', () => {
  for (const tp of [1, 2, 4, 8]) for (const layer of [0, 1, 3, 12, 13, 91, 92]) {
    const b = decoderWeightBudget(model, layer, tp, 16)
    assert.ok(b.complete)
    const a = b.rows.find(r => r.node.id === attentionKind(model, layer))
    const kdaRep = 128 * 7168 + 128
    const kdaShard = 5 * 12288 * 7168 + 3 * 12288 * 4 + 12288 * 128 + 96 * 7168 + 12288 + 96
    const mlaRep = 1536 * 7168 + 1536 + 576 * 7168 + 512
    const mlaShard = 96 * 192 * 1536 + 96 * 256 * 512 + 2 * 96 * 128 * 7168
    assert.equal(a.local, attentionKind(model, layer) === 'kda' ? kdaRep + kdaShard / tp : mlaRep + mlaShard / tp)
    const ffn = b.rows.find(r => ['moe', 'dense-ffn'].includes(r.node.id))
    const moeRep = 896 * 7168 + 896 + 2 * 3584 * 7168 + 3584
    const moeShard = 896 * 3 * 3072 * 3584 + 3 * 6144 * 7168
    assert.equal(ffn.local, layer === 0 ? 3 * 33792 * 7168 / tp : moeRep + moeShard / tp)
    assert.equal(b.local, a.local + ffn.local + 6 * 7168)
  }
})

test('vision temporal pooling and residual navigation retain exact model conditions', () => {
  const vision = model.nodes.find(n => n.id === 'vision')
  assert.equal(vision.outputShape, '[M, 7168]')
  assert.match(vision.description, /时间轴取均值/)
  assert.match(vision.tensors[1].note, /P=4096，M=256/)
  const state = parseExplorer(new URLSearchParams('layer=11&node=attn-res-read&b=3&s=65536&tp=8&bytes=1&phase=prefill'), model).state
  for (const layer of [12, 13, 92]) {
    const next = selectExplorerLayer(model, state, layer)
    assert.equal(next.nodeId, 'attn-res-read')
    assert.deepEqual(parseExplorer(explorerParams(next), model).notices, [])
    assert.deepEqual(next.scenario, state.scenario)
    assert.match(learningStops(model, layer).find(s => s.node.id === 'attn-res-read').focus, /冻结 bank/)
  }
})
