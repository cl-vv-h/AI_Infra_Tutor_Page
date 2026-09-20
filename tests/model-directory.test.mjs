import test from 'node:test'
import assert from 'node:assert/strict'
import { modelDirectory, v41DirectoryEntry as v41 } from '../src/data/model-directory.ts'
import { modelArchitectures } from '../src/data/models.ts'
import { attentionComposition, catalogComparisonHref, emptyCatalog, filterCatalog, parseCatalog, toggleCatalogSelection } from '../src/lib/model-catalog.ts'
import { compareEstimate, comparisonParams, comparisonSeries, parseComparison, v41ComparisonExplorerHref } from '../src/lib/model-comparison.ts'
import { parseV41Scenario, v41Cache } from '../src/lib/deepseek-v41-reference.ts'

const scenario = { batch: 1, sequence: 4096, tp: 4, cacheBytes: 2, phase: 'decode' }
test('unified directory discovers V4.1 without pretending it is a generic backend graph', () => {
  assert.equal(modelDirectory.length, modelArchitectures.length + 1)
  assert.equal(new Set(modelDirectory.map((m) => m.id)).size, modelDirectory.length)
  assert.ok(!modelArchitectures.some((m) => m.id === v41.id))
  assert.deepEqual(attentionComposition(v41), [{ kind: 'window-mqa', count: 2 }, { kind: 'csa2', count: 38 }])
  for (const query of ['deepseek v4.1', 'CSA2', 'Engram', 'reindex', 'indexer.wq_b']) {
    assert.ok(filterCatalog(modelDirectory, { ...emptyCatalog, query }).some((m) => m.id === v41.id))
  }
  assert.ok(filterCatalog(modelDirectory, { ...emptyCatalog, attention: 'compressed', ffn: 'moe' }).some((m) => m.id === v41.id))
  assert.ok(!filterCatalog(modelDirectory, { ...emptyCatalog, ffn: 'dense' }).some((m) => m.id === v41.id))
  let state = toggleCatalogSelection(emptyCatalog, v41.id, modelDirectory)
  state = toggleCatalogSelection(state, 'deepseek-v4-flash', modelDirectory)
  assert.deepEqual(parseCatalog(new URLSearchParams({ pick: state.selected.join(',') }), modelDirectory).state.selected, state.selected)
  const href = catalogComparisonHref(state.selected, modelDirectory)
  assert.deepEqual(parseComparison(new URL(href, 'https://example.org').searchParams, modelDirectory).modelIds, state.selected)
})
test('V4.1 comparison counts four owners, replicated buffers and explicit scale-inclusive storage', () => {
  const reference = compareEstimate(v41, scenario).estimate
  const packed = compareEstimate(v41, scenario, 'packed').estimate
  assert.equal(reference.perRankBytes, 18374656)
  assert.equal(packed.perRankBytes, 6373376)
  assert.equal(packed.compressedBytes, 10240 * 288)
  assert.equal(packed.indexBytes, 10240 * 68)
  assert.equal(packed.slidingKvBytes, 40 * 128 * 528)
  assert.equal(packed.compressorBytes, 24576)
  assert.equal(packed.perRankBytes, packed.compressedBytes + packed.indexBytes + packed.slidingKvBytes + packed.compressorBytes)
  assert.equal(packed.allRankBytes, packed.perRankBytes * 4)
  assert.equal(packed.growthBytesPerToken, 356)
  assert.equal(compareEstimate(v41, { ...scenario, sequence: 4097 }, 'packed').estimate.growthBytesPerToken, 1424)
  assert.equal(compareEstimate(v41, { ...scenario, cacheBytes: 1 }).estimate.perRankBytes, reference.perRankBytes)
  assert.equal(compareEstimate(v41, { ...scenario, tp: 8 }, 'packed').estimate.perRankBytes, packed.perRankBytes)
})
test('all V4.1 comparison points match its dedicated cache workspace and retain boundary validation', () => {
  for (const tp of [1, 2, 4, 8]) for (const batch of [1, 3, 64]) for (const storage of ['reference', 'packed']) {
    const input = { ...scenario, tp, batch }
    for (const point of comparisonSeries(v41, input, storage)) {
      const expected = v41Cache(batch, point.sequence, storage)
      assert.equal(point.perRankBytes, expected.total)
      assert.equal(point.allRankBytes, expected.total * tp)
      assert.ok(point.sequence <= 1048576)
    }
  }
  for (const patch of [{ tp: 3 }, { batch: 0 }, { sequence: 512 }, { sequence: 1048577 }, { sequence: NaN }]) assert.equal(compareEstimate(v41, { ...scenario, ...patch }).estimate, null)
  assert.equal(compareEstimate(v41, scenario, 'invalid').estimate, null)
})
test('V4.1 storage and shared conditions round trip from comparison into the correct workspace', () => {
  const state = { modelIds: [v41.id, 'deepseek-v4-flash'], scenario: { ...scenario, tp: 8, batch: 3, sequence: 16385, cacheBytes: 1 }, scope: 'group', v41Storage: 'packed' }
  const { notices, ...restored } = parseComparison(comparisonParams(state), modelDirectory)
  assert.deepEqual(restored, state)
  assert.deepEqual(notices, [])
  const href = v41ComparisonExplorerHref(state)
  const params = new URL(href, 'https://example.org').searchParams
  const experiment = parseV41Scenario(params).state
  assert.equal(experiment.world, 8)
  assert.equal(experiment.batch, 3)
  assert.equal(experiment.sequence, 16385)
  assert.equal(experiment.storage, 'packed')
  assert.equal(experiment.view, 'cache')
  assert.equal(experiment.replicas, 1)
  assert.equal(experiment.phase, 'decode')
  assert.ok(!params.has('bytes') && !params.has('tp'))
  assert.ok(!comparisonParams({ ...state, private: 'do-not-copy' }).toString().includes('do-not-copy'))
  const bad = parseComparison(new URLSearchParams('models=deepseek-v4-1-flash,deepseek-v4-flash&v41storage=invalid'), modelDirectory)
  assert.equal(bad.v41Storage, 'reference')
  assert.ok(bad.notices.some((n) => n.includes('存储口径')))
})
