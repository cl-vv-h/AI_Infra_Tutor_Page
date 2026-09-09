import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures as registry } from '../src/data/models.ts'
import { attentionComposition, attentionFilters, catalogComparisonHref, catalogParams, emptyCatalog, filterCatalog, hasExperts, modelAttentionProfile, parseCatalog, toggleCatalogSelection } from '../src/lib/model-catalog.ts'
import { parseComparison } from '../src/lib/model-comparison.ts'

const state = (overrides = {}) => ({ ...emptyCatalog, selected: [], ...overrides })
const ids = (models) => models.map((model) => model.id)

test('all models have exactly one attention profile and accurate layer composition', () => {
  for (const model of registry) {
    assert.ok(attentionFilters.some((filter) => filter.id === modelAttentionProfile(model)))
    assert.equal(attentionComposition(model).reduce((sum, part) => sum + part.count, 0), model.dimensions.layers)
  }
  assert.deepEqual(ids(filterCatalog(registry, state({ attention: 'mha' }))), ['phi-3-5-mini-instruct', 'olmo-2-1124-7b'])
  assert.deepEqual(ids(filterCatalog(registry, state({ attention: 'mixed' }))), ['gemma-2-9b'])
  assert.deepEqual(attentionComposition(registry.find((model) => model.id === 'qwen3-5-9b')), [{ kind: 'gdn', count: 24 }, { kind: 'gqa', count: 8 }])
  assert.equal(attentionFilters.slice(1).reduce((sum, filter) => sum + filterCatalog(registry, state({ attention: filter.id })).length, 0), registry.length)
})

test('search handles model punctuation, organizations, multiple terms and weight/module names', () => {
  assert.deepEqual(ids(filterCatalog(registry, state({ query: 'phi3.5' }))), ['phi-3-5-mini-instruct'])
  assert.deepEqual(ids(filterCatalog(registry, state({ query: 'MICROSOFT LongRoPE' }))), ['phi-3-5-mini-instruct'])
  assert.deepEqual(ids(filterCatalog(registry, state({ query: 'Qwen3 30B' }))), ['qwen3-30b-a3b'])
  assert.ok(filterCatalog(registry, state({ query: 'qkv_proj' })).some((model) => model.id === 'phi-3-5-mini-instruct'))
  assert.deepEqual(filterCatalog(registry, state({ query: '[.*' })), [])
  assert.deepEqual(filterCatalog(registry, state({ query: 'does-not-exist' })), [])
})

test('FFN and attention filters compose with search without mutating registry', () => {
  const before = JSON.stringify(registry)
  const results = filterCatalog(registry, state({ attention: 'hybrid', ffn: 'moe', query: 'Qwen' }))
  assert.deepEqual(ids(results), ['qwen3-5-35b-a3b'])
  assert.ok(filterCatalog(registry, state({ ffn: 'dense' })).every((model) => !hasExperts(model)))
  assert.ok(filterCatalog(registry, state({ ffn: 'moe' })).every(hasExperts))
  assert.equal(JSON.stringify(registry), before)
})

test('catalog URLs round-trip filters and ordered picks while serializing only public fields', () => {
  const original = state({ query: 'Qwen gate', attention: 'hybrid', ffn: 'moe', selected: ['phi-3-5-mini-instruct', 'qwen3-5-35b-a3b'] })
  const params = catalogParams({ ...original, token: 'do-not-copy', secret: 'do-not-copy' })
  assert.deepEqual(parseCatalog(params, registry), { state: original, notices: [] })
  assert.ok(!params.toString().includes('do-not-copy'))
  assert.equal(catalogParams(emptyCatalog).toString(), '')
})

test('malformed URLs are bounded and invalid, duplicate or excess selections are reported', () => {
  const pick = [registry[0].id, registry[0].id, 'unknown', ...registry.slice(1, 5).map((model) => model.id)].join(',')
  const parsed = parseCatalog(new URLSearchParams({ q: '\u0000' + 'x'.repeat(250), attention: '<script>', ffn: 'invalid', pick }), registry)
  assert.equal(parsed.state.query.length, 200)
  assert.equal(parsed.state.attention, 'all')
  assert.equal(parsed.state.ffn, 'all')
  assert.deepEqual(parsed.state.selected, ids(registry.slice(0, 3)))
  assert.equal(parsed.notices.length, 4)
  assert.deepEqual(parseCatalog(new URLSearchParams({ pick: 'x'.repeat(10000) }), registry).state.selected, [])
})

test('selection is limited to three known ids, is reversible and survives hidden/empty results', () => {
  let current = state()
  for (const model of registry.slice(0, 4)) current = toggleCatalogSelection(current, model.id, registry)
  assert.deepEqual(current.selected, ids(registry.slice(0, 3)))
  assert.equal(toggleCatalogSelection(current, 'unknown', registry), current)
  const hidden = { ...current, query: 'no-matching-checkpoint' }
  assert.deepEqual(filterCatalog(registry, hidden), [])
  assert.deepEqual(hidden.selected, current.selected)
  const removed = toggleCatalogSelection(hidden, registry[1].id, registry)
  assert.deepEqual(removed.selected, [registry[0].id, registry[2].id])
  assert.deepEqual(current.selected, ids(registry.slice(0, 3)))
})

test('comparison handoff preserves the exact chosen models and uses identical explicit conditions', () => {
  const selected = ['gemma-2-9b', 'phi-3-5-mini-instruct', 'llama-3-1-8b']
  const href = catalogComparisonHref(selected, registry)
  const compared = parseComparison(new URL(href, 'https://example.org').searchParams, registry)
  assert.deepEqual(compared.modelIds, selected)
  assert.deepEqual(compared.scenario, { phase: 'decode', batch: 4, sequence: 8192, tp: 4, cacheBytes: 2 })
  assert.deepEqual(compared.notices, [])
  for (const bad of [[], [registry[0].id], ['unknown', registry[0].id], [registry[0].id, registry[0].id], ids(registry.slice(0, 4))]) assert.equal(catalogComparisonHref(bad, registry), null)
})

test('catalogue compares a 4K model with the same supported initial context for every pick', () => {
  const selected = ['olmo-2-1124-7b', 'llama-3-1-8b', 'phi-3-5-mini-instruct']
  const compared = parseComparison(new URL(catalogComparisonHref(selected, registry), 'https://example.org').searchParams, registry)
  assert.equal(compared.scenario.sequence, 4096)
  assert.deepEqual(compared.modelIds, selected)
  assert.deepEqual(compared.notices, [])
  for (const id of selected) assert.ok(compared.scenario.sequence <= registry.find((model) => model.id === id).execution.maxContext)
})
