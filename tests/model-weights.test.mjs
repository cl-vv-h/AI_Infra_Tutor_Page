import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures } from '../src/data/models.ts'
import { decoderWeightBudget, shapeElements, weightElements } from '../src/lib/model-weights.ts'
import { decoderNodes } from '../src/lib/model-lab.ts'
import { explorerHref, parseExplorer } from '../src/lib/model-explorer.ts'

const model = (id) => modelArchitectures.find((item) => item.id === id)

test('shape arithmetic accepts only bracketed positive integer products and sums', () => {
  assert.equal(shapeElements('[2 × 1024, 4096] + [4096, 1024]'), 3 * 1024 * 4096)
  assert.equal(shapeElements('[1536] / [512]'), 2048)
  for (const value of ['[N, 128]', '[SwiGLU(2 → 4)]', '[0, 2]', '[-1]', '[1.5]', '[9007199254740992]', '[2] * evil()', '[2] trailing', '']) assert.equal(shapeElements(value), null, value)
})

test('all ten model Decoder definitions are countable at every supported TP', () => {
  for (const m of modelArchitectures) for (const tp of m.supportedTp) {
    const nodes = new Map(Array.from({ length: m.dimensions.layers }, (_, layer) => decoderNodes(m, layer)).flat().map((node) => [node.id, node]))
    for (const node of nodes.values()) for (const weight of node.weights) {
      assert.ok(weightElements(weight, m, tp) > 0, `${m.id}/${node.id}/${weight.name}/TP${tp}`)
      if (/each/.test(weight.name)) assert.equal(weight.multiplicity, 2, weight.name)
    }
    const budget = decoderWeightBudget(m, 0, tp, 16)
    assert.equal(budget.complete, true, m.id)
    assert.equal(budget.bytes, budget.local * 2)
    assert.ok(budget.allLayersLocal * tp >= budget.allLayersGlobal)
  }
})

test('Llama 3.1 8B matches independent attention + SwiGLU + two RMSNorm arithmetic', () => {
  const m = model('llama-3-1-8b')
  const attention = 2 * 4096 ** 2 + 2 * 8 * 128 * 4096
  const ffn = 3 * 4096 * 14336
  const norm = 2 * 4096
  const global = attention + ffn + norm
  const one = decoderWeightBudget(m, 0, 1, 16)
  const four = decoderWeightBudget(m, 0, 4, 16)
  assert.equal(one.global, global)
  assert.equal(one.local, global)
  assert.equal(four.local, (attention + ffn) / 4 + norm)
  assert.equal(four.allLayersLocal, four.local * 32)
  assert.equal(four.local * 4 - four.global, norm * 3)
})

test('Mixtral counts all eight resident experts, not only Top-2 activation', () => {
  const m = model('mixtral-8x7b-v0-1')
  const row = decoderWeightBudget(m, 0, 4, 16).rows.find((row) => row.node.id === 'moe')
  assert.equal(row.local, 8 * 3 * 4096 * 14336 / 4 + 8 * 4096)
  assert.equal(row.global, 8 * 3 * 4096 * 14336 + 8 * 4096)
})

test('Qwen TP8 replicates four KV heads and its norm vectors', () => {
  const m = model('qwen3-30b-a3b')
  const a = decoderWeightBudget(m, 0, 1, 16).rows.find((row) => row.node.id === 'gqa')
  const b = decoderWeightBudget(m, 0, 8, 16).rows.find((row) => row.node.id === 'gqa')
  assert.equal(b.local * 8 - a.global, 2 * 4 * 128 * 2048 + 2 * 128 * 7)
})

test('mixed layer totals use actual branches, Gemma counts four norms and no tied embeddings', () => {
  for (const id of ['glm-4-7-flash', 'deepseek-v3', 'qwen3-5-9b', 'qwen3-5-35b-a3b']) {
    const m = model(id)
    const totals = Array.from({ length: m.dimensions.layers }, (_, layer) => decoderNodes(m, layer).flatMap((node) => node.weights).reduce((sum, weight) => sum + weightElements(weight, m, 4), 0))
    assert.equal(decoderWeightBudget(m, 0, 4, 16).allLayersLocal, totals.reduce((a, b) => a + b, 0))
    assert.ok(new Set(totals).size > 1, id)
  }
  const gemma = model('gemma-2-9b')
  const local = decoderWeightBudget(gemma, 0, 4, 16)
  assert.equal(local.rows.filter((row) => row.node.id.includes('norm')).reduce((sum, row) => sum + row.local, 0), 4 * 3584)
  assert.equal(local.local, decoderWeightBudget(gemma, 1, 4, 16).local)
  assert.ok(!local.rows.some((row) => ['embedding', 'lm-head', 'vision'].includes(row.node.id)))
})

test('bit width affects bytes only, unknown shapes disable totals instead of undercounting', () => {
  const m = model('llama-3-1-8b')
  const original = decoderWeightBudget(m, 0, 4, 16)
  for (const bits of [4, 8, 16, 32]) {
    const result = decoderWeightBudget(m, 0, 4, bits)
    assert.equal(result.local, original.local)
    assert.equal(result.bytes, original.bytes * bits / 16)
  }
  const unknown = structuredClone(m)
  unknown.nodes.find((node) => node.id === 'gqa').weights.push({ name: 'new tensor', shape: '[unknown]' })
  const incomplete = decoderWeightBudget(unknown, 0, 4, 16)
  assert.equal(incomplete.complete, false)
  assert.equal(incomplete.bytes, null)
  assert.equal(incomplete.allLayersBytes, null)
  for (const args of [[-1, 4, 16], [0, 3, 16], [0, 4, 0]]) assert.throws(() => decoderWeightBudget(m, ...args), /Invalid/)
})

test('weight precision round-trips independently from cache precision and validates malformed links', () => {
  const m = model('llama-3-1-8b')
  const parsed = parseExplorer(new URLSearchParams('wbits=4&bytes=2&layer=3&node=ffn'), m)
  assert.equal(parsed.state.weightBits, 4)
  assert.equal(parsed.state.scenario.cacheBytes, 2)
  const restored = parseExplorer(new URL(explorerHref(m.id, parsed.state), 'https://example.org').searchParams, m)
  assert.deepEqual(restored.state, parsed.state)
  for (const value of ['0', '3', '-4', 'Infinity', '<script>']) {
    const invalid = parseExplorer(new URLSearchParams({ wbits: value }), m)
    assert.equal(invalid.state.weightBits, undefined)
    assert.ok(invalid.notices.some((notice) => notice.includes('wbits 参数无效')))
  }
})
