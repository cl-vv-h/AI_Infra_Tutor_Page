import assert from 'node:assert/strict'
import test from 'node:test'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { cacheEstimate, decoderNodes, formatShape, localKvHeads, tokenCount } from '../src/lib/model-lab.ts'

const base = { batch: 1, sequence: 1024, tp: 1, phase: 'decode', cacheBytes: 2 }

test('Llama KV cache agrees with the 128 MiB reference case and linear scaling', () => {
  const llama = getModelArchitecture('llama-3-1-8b')
  assert.equal(cacheEstimate(llama, base).perRankBytes, 128 * 1024 ** 2)
  assert.equal(cacheEstimate(llama, { ...base, tp: 4 }).perRankBytes, 32 * 1024 ** 2)
  assert.equal(cacheEstimate(llama, { ...base, batch: 4, sequence: 2048, cacheBytes: 1 }).perRankBytes, 512 * 1024 ** 2)
})

test('Qwen MoE TP 8 replicates its four KV heads, rather than halving heads', () => {
  const qwen = getModelArchitecture('qwen3-30b-a3b')
  const tp4 = cacheEstimate(qwen, { ...base, tp: 4 })
  const tp8 = cacheEstimate(qwen, { ...base, tp: 8 })
  assert.equal(localKvHeads(qwen, 8), 1)
  assert.equal(tp8.perRankBytes, 24 * 1024 ** 2)
  assert.equal(tp4.perRankBytes, tp8.perRankBytes)
  assert.equal(tp8.allRankBytes, tp4.allRankBytes * 2)
  assert.equal(formatShape('[{localHeads} × 128, 2,048]', qwen, { ...base, tp: 8 }), '[4 × 128, 2048]')
})

test('MLA latent cache is replicated across TP ranks', () => {
  const model = getModelArchitecture('deepseek-v3')
  assert.equal(cacheEstimate(model, base).perRankBytes, 68.625 * 1024 ** 2)
  assert.equal(cacheEstimate(model, { ...base, tp: 8 }).perRankBytes, cacheEstimate(model, base).perRankBytes)
})

test('prefill and decode change forward token count, not stored history', () => {
  const model = getModelArchitecture('qwen3-8b')
  const decode = { ...base, batch: 4 }
  const prefill = { ...decode, phase: 'prefill' }
  assert.equal(tokenCount(prefill), 4096)
  assert.equal(tokenCount(decode), 4)
  assert.equal(formatShape('[N, 4,096]', model, prefill), '[4096, 4096]')
  assert.equal(formatShape('[N, 4,096]', model, decode), '[4, 4096]')
  assert.equal(cacheEstimate(model, prefill).perRankBytes, cacheEstimate(model, decode).perRankBytes)
})

test('GLM and DeepSeek switch FFN exactly at their dense-layer boundary', () => {
  for (const [id, boundary] of [['glm-4-7-flash', 1], ['deepseek-v3', 3]]) {
    const model = getModelArchitecture(id)
    assert.equal(decoderNodes(model, boundary - 1)[4].id, 'dense-ffn')
    assert.equal(decoderNodes(model, boundary)[4].id, 'moe')
  }
})

test('all model layers have a complete residual block and resolvable shapes', () => {
  for (const model of modelArchitectures) {
    for (let layer = 0; layer < model.dimensions.layers; layer++) {
      const nodes = decoderNodes(model, layer)
      assert.equal(nodes.length, 6)
      assert.equal(nodes[2].id, 'attention-add')
      assert.equal(nodes[3].id, 'ffn-norm')
      assert.equal(nodes[5].id, 'ffn-add')
      assert.equal(nodes.filter((node) => ['ffn', 'dense-ffn', 'moe'].includes(node.id)).length, 1)
      for (const tp of model.supportedTp) {
        assert.equal(model.dimensions.attentionHeads % tp, 0)
        assert.ok(Number.isInteger(localKvHeads(model, tp)))
        for (const node of [...nodes, ...model.nodes]) {
          for (const shape of [node.inputShape, node.outputShape, ...node.weights.map((w) => w.shape)]) {
            const actual = formatShape(shape, model, { ...base, tp })
            assert.doesNotMatch(actual, /\{|\}|NaN|undefined|\bN\b/, `${model.id} layer ${layer} TP ${tp}: ${actual}`)
          }
        }
      }
    }
  }
})
