import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, formatShape } from '../src/lib/model-lab.ts'
import { explorerHref, explorerNodes, explorerParams, explorerViewForKey, explorerViews, findModules, moduleIndex, nearestModuleLayer, parseExplorer, selectExplorerLayer, selectExplorerNode } from '../src/lib/model-explorer.ts'

test('workspace URLs preserve every experiment parameter, with the graph as the legacy default', () => {
  for (const model of modelArchitectures) {
    const base = parseExplorer(new URLSearchParams('layer=1&b=3&s=2048&tp=2&bytes=1&wbits=4&budget=0.5'), model).state
    assert.equal(base.view, undefined)
    for (const { id: view } of explorerViews) {
      const parsed = parseExplorer(explorerParams({ ...base, view }), model)
      assert.deepEqual(parsed.notices, [])
      assert.deepEqual(parsed.state, view === 'diagram' ? base : { ...base, view })
      const changed = selectExplorerLayer(model, parsed.state, 2)
      assert.equal(changed.view, parsed.state.view)
      assert.deepEqual(changed.scenario, base.scenario)
      const inspected = selectExplorerNode(changed, 'lm-head')
      assert.equal(inspected.view, 'diagram')
      assert.equal(inspected.nodeId, 'lm-head')
      assert.equal(inspected.layer, 2)
      assert.deepEqual(inspected.scenario, base.scenario)
      assert.equal(inspected.weightBits, 4)
      assert.equal(inspected.cacheBudgetGiB, 0.5)
      assert.equal(explorerParams(inspected).has('view'), false)
    }
  }
})

test('unknown workspace values cannot become shared URL state', () => {
  const model = modelArchitectures[0]
  for (const value of ['', 'unknown', '<script>', 'CACHE', 'https://example.org']) {
    const parsed = parseExplorer(new URLSearchParams({ view: value }), model)
    assert.equal(parsed.state.view, undefined)
    assert.deepEqual(parsed.notices, ['未知工作区，已返回结构图。'])
    assert.equal(explorerParams({ ...parsed.state, view: value }).has('view'), false)
  }
})

test('workspace arrow keys wrap; Home/End navigate and unrelated keys retain native behavior', () => {
  const views = explorerViews.map((item) => item.id)
  for (const [index, view] of views.entries()) {
    assert.equal(explorerViewForKey(view, 'ArrowRight'), views[(index + 1) % views.length])
    assert.equal(explorerViewForKey(view, 'ArrowLeft'), views[(index + views.length - 1) % views.length])
    assert.equal(explorerViewForKey(view, 'Home'), 'diagram')
    assert.equal(explorerViewForKey(view, 'End'), 'weights')
    for (const key of ['Tab', 'Enter', ' ', 'ArrowUp', 'Escape']) assert.equal(explorerViewForKey(view, key), null)
  }
})

test('all model layers and visible modules round-trip with exact shapes and scenario state', () => {
  for (const model of modelArchitectures) {
    for (let layer = 0; layer < model.dimensions.layers; layer++) {
      const scenario = { phase: layer % 2 ? 'prefill' : 'decode', batch: 3, sequence: model.execution.maxContext, tp: model.supportedTp[layer % model.supportedTp.length], cacheBytes: layer % 2 ? 1 : 2 }
      for (const node of explorerNodes(model, layer)) {
        const state = { layer, nodeId: node.id, scenario }
        const url = new URL(explorerHref(model.id, state), 'https://example.org')
        const parsed = parseExplorer(url.searchParams, model)
        assert.deepEqual(parsed.notices, [], `${model.id}/${layer}/${node.id}`)
        assert.deepEqual(parsed.state, state)
        const restored = parsed.nodes.find((item) => item.id === parsed.state.nodeId)
        assert.equal(formatShape(restored.outputShape, model, parsed.state.scenario), formatShape(node.outputShape, model, scenario))
      }
    }
  }
})

test('explorer validates every numeric boundary, phase and layer-specific node with notices', () => {
  const model = getModelArchitecture('glm-4-7-flash')
  const parsed = parseExplorer(new URLSearchParams('layer=999&node=moe&phase=unknown&b=-1&s=999999&tp=8&bytes=3'), model)
  assert.equal(parsed.notices.length, 7)
  assert.deepEqual(parsed.state, { layer: 0, nodeId: 'mla', scenario: { phase: 'decode', batch: 4, sequence: 4096, tp: 4, cacheBytes: 2 } })
  for (const raw of ['NaN', 'Infinity', '1e4', '0x10', '-1', '1.5', '', '9007199254740992']) {
    for (const key of ['layer', 'b', 's', 'tp', 'bytes']) assert.ok(parseExplorer(new URLSearchParams([[key, raw]]), model).notices.length, `${key}=${raw}`)
  }
  const lower = parseExplorer(new URLSearchParams('layer=0&b=1&s=1024&tp=1&bytes=1'), model)
  assert.deepEqual(lower.notices, [])
})

test('module index contains exactly the actual layers for every target, with no phantom branches', () => {
  for (const model of modelArchitectures) {
    const index = moduleIndex(model)
    assert.equal(new Set(index.map((target) => target.node.id)).size, index.length)
    for (const target of index) {
      const expected = Array.from({ length: model.dimensions.layers }, (_, i) => i).filter((layer) => explorerNodes(model, layer).some((node) => node.id === target.node.id))
      assert.deepEqual(target.layers, expected)
      assert.equal(target.global, ['embedding', 'lm-head', 'vision'].includes(target.node.id))
      for (let layer = 0; layer < model.dimensions.layers; layer++) {
        const nearest = nearestModuleLayer(target, layer)
        assert.ok(target.layers.includes(nearest))
        assert.equal(Math.abs(nearest - layer), Math.min(...target.layers.map((n) => Math.abs(n - layer))))
      }
    }
  }
})

test('module search finds weights and intermediate tensors across hidden MoE and hybrid layers', () => {
  const deepseek = moduleIndex(getModelArchitecture('deepseek-v3'))
  const moe = findModules(deepseek, 'ROUTER gate')[0]
  assert.equal(moe.node.id, 'moe')
  assert.equal(nearestModuleLayer(moe, 0), 3)
  const dense = findModules(deepseek, 'dense')[0]
  assert.equal(nearestModuleLayer(dense, 60), 2)
  const hybrid = moduleIndex(getModelArchitecture('qwen3-5-9b'))
  const full = hybrid.find((target) => target.node.id === 'gqa')
  assert.equal(nearestModuleLayer(full, 0), 3)
  assert.equal(nearestModuleLayer(full, 5), 3) // deterministic lower layer on ties
  assert.ok(findModules(hybrid, 'recurrent').some((target) => target.node.id === 'recurrent-state'))
  assert.deepEqual(findModules(deepseek, '[.*<script>'), [])
  assert.equal(findModules(deepseek, '').length, deepseek.length)
})

test('changing layers preserves only modules that actually exist in the new branch', () => {
  const model = getModelArchitecture('deepseek-v3')
  const base = parseExplorer(new URLSearchParams('layer=3&node=moe'), model).state
  assert.equal(selectExplorerLayer(model, base, 4).nodeId, 'moe')
  assert.equal(selectExplorerLayer(model, base, 0).nodeId, 'mla')
  assert.equal(selectExplorerLayer(model, { ...base, nodeId: 'ffn-norm' }, 0).nodeId, 'ffn-norm')
  const hybrid = getModelArchitecture('qwen3-5-9b')
  const full = parseExplorer(new URLSearchParams('layer=3&node=gqa'), hybrid).state
  assert.equal(selectExplorerLayer(hybrid, full, 4).nodeId, 'gdn')
})

test('share URLs contain only registered model state, not search, preview or unknown fields', () => {
  const model = getModelArchitecture('mistral-7b-v0-1')
  const parsed = parseExplorer(new URLSearchParams('node=%3Cscript%3E&token=secret&q=private&hover=kv-cache'), model)
  assert.equal(parsed.state.nodeId, 'swa')
  const params = explorerParams({ ...parsed.state, q: 'private', hover: 'kv-cache', token: 'secret' })
  assert.deepEqual([...params.keys()], ['layer', 'node', 'phase', 'b', 's', 'tp', 'bytes'])
  assert.ok(!params.toString().includes('private'))
})

test('comparison-to-explorer handoff keeps all valid memory conditions including custom batch', () => {
  for (const model of modelArchitectures) {
    for (const tp of model.supportedTp) {
      for (const cacheBytes of [1, 2]) {
        const scenario = { phase: 'decode', batch: 3, sequence: model.execution.maxContext, tp, cacheBytes }
        const parsed = parseExplorer(explorerParams({ layer: 0, nodeId: attentionKind(model, 0), scenario }), model)
        assert.deepEqual(parsed.state.scenario, scenario)
        assert.deepEqual(cacheEstimate(model, parsed.state.scenario), cacheEstimate(model, scenario))
      }
    }
  }
})
