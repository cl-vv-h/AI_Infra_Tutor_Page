import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures as registry } from '../src/data/models.ts'
import { attentionComposition, attentionFilters, catalogComparisonHref, catalogParams, emptyCatalog, filterCatalog, hasExperts, modelAttentionProfile, parseCatalog, toggleCatalogSelection } from '../src/lib/model-catalog.ts'
import { parseComparison } from '../src/lib/model-comparison.ts'
import { modelDirectory } from '../src/data/model-directory.ts'
import { modelPopularity } from '../src/data/model-popularity.ts'
import { popularityFor, popularityIsStale, sortCatalog } from '../src/lib/model-popularity.ts'

const state = (overrides = {}) => ({ ...emptyCatalog, selected: [], ...overrides })
const ids = (models) => models.map((model) => model.id)

test('public popularity snapshot covers the exact checkpoints and sorts without changing registries', () => {
  assert.equal(Object.keys(modelPopularity).length, 19)
  for (const model of modelDirectory) {
    const measurement = popularityFor(model.id)
    assert.ok(measurement, model.id)
    if (model.configUrl.startsWith('https://huggingface.co/')) assert.ok(model.configUrl.startsWith(`https://huggingface.co/${measurement.repo}/`), model.id)
    else assert.equal(measurement.repo, { 'llama-3-1-8b': 'meta-llama/Llama-3.1-8B', 'gemma-2-9b': 'google/gemma-2-9b' }[model.id])
  }
  assert.equal(modelPopularity['deepseek-v3'].repo, 'deepseek-ai/DeepSeek-V3-Base')
  assert.equal(modelPopularity['llama-3-1-8b'].repo, 'meta-llama/Llama-3.1-8B')
  const before = ids(modelDirectory)
  const sorted = sortCatalog(modelDirectory)
  assert.deepEqual(ids(sorted).slice(0, 3), ['qwen3-8b', 'qwen3-5-9b', 'kimi-k3'])
  for (let i = 1; i < sorted.length; i++) assert.ok(popularityFor(sorted[i - 1].id).downloads >= popularityFor(sorted[i].id).downloads)
  assert.deepEqual(ids(sortCatalog(modelDirectory, 'catalog')), before)
  assert.deepEqual(ids(modelDirectory), before)
  assert.notEqual(sorted, modelDirectory)
})

test('popularity sorting is numeric, deterministic and distinguishes missing from measured zero', () => {
  const models = [{ id: 'missing', name: 'A' }, { id: 'zero', name: 'Z' }, { id: 'nine', name: 'Model 9' }, { id: 'ten', name: 'Model 10' }, { id: 'tie', name: 'Model 2' }]
  const snapshot = Object.fromEntries([['zero', 0], ['nine', 9], ['ten', 10], ['tie', 10]].map(([id, downloads]) => [id, { repo: 'public/model', downloads }]))
  assert.deepEqual(ids(sortCatalog(models, 'downloads', snapshot)), ['tie', 'ten', 'nine', 'zero', 'missing'])
  assert.deepEqual(ids(sortCatalog(models, 'name')), ['missing', 'tie', 'nine', 'ten', 'zero'])
  assert.equal(popularityFor('missing', snapshot), null)
  assert.equal(popularityFor('toString', snapshot), null)
  for (const downloads of [-1, NaN, Infinity, 0.5, '10', Number.MAX_SAFE_INTEGER + 1]) assert.equal(popularityFor('bad', { bad: { downloads, repo: 'public/model' } }), null)
  for (const repo of ['https://example.org/model', 'public/model?secret=value', '../model', 'public/model/extra']) {
    assert.equal(popularityFor('bad', { bad: { downloads: 10, repo } }), null)
  }
})

test('catalog sort URLs preserve filters and selection, with safe defaults for older links', () => {
  for (const sort of ['name', 'catalog']) {
    const original = state({ sort, query: 'Qwen', attention: 'hybrid', ffn: 'moe', selected: ['kimi-k3', 'qwen3-8b'] })
    const encoded = catalogParams({ ...original, account: 'never-copy' })
    assert.deepEqual(parseCatalog(encoded, modelDirectory), { state: original, notices: [] })
    assert.ok(!encoded.toString().includes('never-copy'))
  }
  assert.equal(catalogParams(state({ sort: 'downloads' })).toString(), '')
  for (const raw of ['', 'unknown', '<script>', 'toString']) {
    const parsed = parseCatalog(new URLSearchParams({ sort: raw }), modelDirectory)
    assert.equal(parsed.state.sort, undefined)
    assert.equal(parsed.notices.length, 1)
  }
  assert.deepEqual(parseCatalog(new URLSearchParams(), modelDirectory), { state: emptyCatalog, notices: [] })
})

test('snapshot freshness uses a fixed observation date, not a rolling or fabricated live date', () => {
  assert.equal(popularityIsStale(new Date('2026-10-15T23:59:59+08:00')), false)
  assert.equal(popularityIsStale(new Date('2026-10-16T00:00:00+08:00')), true)
  assert.equal(popularityIsStale(new Date('invalid')), true)
})

test('all models have exactly one attention profile and accurate layer composition', () => {
  for (const model of registry) {
    assert.ok(attentionFilters.some((filter) => filter.id === modelAttentionProfile(model)))
    assert.equal(attentionComposition(model).reduce((sum, part) => sum + part.count, 0), model.dimensions.layers)
  }
  assert.deepEqual(ids(filterCatalog(registry, state({ attention: 'mha' }))), ['phi-3-5-mini-instruct', 'olmo-2-1124-7b', 'pythia-1-4b'])
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
