import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { learningStops, adjacentLearningStop } from '../src/lib/model-learning.ts'
import { attentionKind, decoderNodes, layerCacheNode } from '../src/lib/model-lab.ts'
import { explorerNodes, explorerParams, parseExplorer, selectExplorerNode } from '../src/lib/model-explorer.ts'

test('learning route covers every real module of every layer, no synthetic serial cache step', () => {
  for (const model of modelArchitectures) for (let layer = 0; layer < model.dimensions.layers; layer++) {
    const stops = learningStops(model, layer)
    const ids = stops.map(stop => stop.node.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual([...ids].sort(), explorerNodes(model, layer).map(n => n.id).sort())
    assert.equal(ids[0], 'embedding')
    assert.equal(ids.at(-1), 'lm-head')
    const cacheIndex = ids.indexOf(layerCacheNode(model, layer).id)
    assert.equal(ids[cacheIndex - 1], attentionKind(model, layer))
    assert.match(stops[cacheIndex].context, /状态支路/)
    assert.match(stops.at(-1).context, new RegExp(`还有 ${model.dimensions.layers - layer - 1} 个`))
    for (const node of decoderNodes(model, layer)) assert.ok(ids.includes(node.id))
    if (model.execution.residualLayout === 'parallel') assert.match(stops.find(s => s.node.id === 'ffn').context, /不表示 Attention → MLP/)
    assert.equal(adjacentLearningStop(stops, ids[0], -1), null)
    assert.equal(adjacentLearningStop(stops, ids.at(-1), 1), null)
    for (let i = 0; i < ids.length - 1; i++) {
      assert.equal(adjacentLearningStop(stops, ids[i], 1).node.id, ids[i + 1])
      assert.equal(adjacentLearningStop(stops, ids[i + 1], -1).node.id, ids[i])
    }
  }
})

test('reading navigation shares module selection without losing experiment conditions', () => {
  const model = getModelArchitecture('glm-5-2')
  const state = parseExplorer(new URLSearchParams('layer=3&b=3&s=65536&tp=8&bytes=1&wbits=4&budget=0.5&phase=prefill&view=weights'), model).state
  for (const stop of learningStops(model, 3)) {
    const next = selectExplorerNode(state, stop.node.id)
    const parsed = parseExplorer(explorerParams(next), model)
    assert.deepEqual(parsed.notices, [])
    assert.equal(parsed.state.nodeId, stop.node.id)
    assert.equal(parsed.state.layer, 3)
    assert.deepEqual(parsed.state.scenario, state.scenario)
    assert.equal(parsed.state.weightBits, 4)
    assert.equal(parsed.state.cacheBudgetGiB, 0.5)
  }
})
