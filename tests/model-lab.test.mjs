import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { categories } from '../src/data/categories.ts'
import { modelArchitectures, getModelArchitecture } from '../src/data/models.ts'
import { attentionKind, cacheEstimate, decoderGroups, decoderNodes, formatShape, layerCacheNode, localKvHeads, tokenCount } from '../src/lib/model-lab.ts'

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

test('Qwen3.5 layer schedules route full attention and DeltaNet to different states', () => {
  const dense = getModelArchitecture('qwen3-5-9b')
  const moe = getModelArchitecture('qwen3-5-35b-a3b')
  assert.deepEqual(Array.from({ length: 32 }, (_, i) => i).filter((i) => attentionKind(dense, i) === 'gqa'), [3, 7, 11, 15, 19, 23, 27, 31])
  assert.deepEqual(Array.from({ length: 40 }, (_, i) => i).filter((i) => attentionKind(moe, i) === 'gqa'), [3, 7, 11, 15, 19, 23, 27, 31, 35, 39])
  assert.equal(decoderNodes(dense, 0)[1].id, 'gdn')
  assert.equal(layerCacheNode(dense, 0).id, 'recurrent-state')
  assert.equal(decoderNodes(dense, 3)[1].id, 'gqa')
  assert.equal(layerCacheNode(dense, 3).id, 'kv-cache')
  assert.equal(decoderNodes(dense, 3)[4].id, 'ffn')
  assert.equal(decoderNodes(moe, 3)[4].id, 'moe')
})

test('hybrid memory uses only eight KV layers plus 24 fixed state layers', () => {
  const model = getModelArchitecture('qwen3-5-9b')
  const estimate = cacheEstimate(model, { ...base, tp: 4 })
  assert.equal(estimate.kvLayers, 8)
  assert.equal(estimate.recurrentLayers, 24)
  assert.equal(estimate.kvBytes, 8 * 1024 ** 2)
  assert.equal(estimate.recurrentBytes, 12 * 1024 ** 2)
  assert.equal(estimate.convBytes, 384 * 1024)
  assert.equal(estimate.perRankBytes, 20.375 * 1024 ** 2)
  const longer = cacheEstimate(model, { ...base, tp: 4, sequence: 4096 })
  assert.equal(longer.recurrentBytes, estimate.recurrentBytes)
  assert.equal(longer.convBytes, estimate.convBytes)
  assert.equal(longer.kvBytes, estimate.kvBytes * 4)
  assert.equal(longer.perRankBytes, 44.375 * 1024 ** 2)
})

test('FP8 changes only hybrid KV, and TP head replication does not replicate recurrent matrices', () => {
  const model = getModelArchitecture('qwen3-5-35b-a3b')
  const four = cacheEstimate(model, { ...base, tp: 4 })
  const eight = cacheEstimate(model, { ...base, tp: 8 })
  const fp8 = cacheEstimate(model, { ...base, tp: 4, cacheBytes: 1 })
  assert.equal(four.perRankBytes, 25.46875 * 1024 ** 2)
  assert.equal(eight.kvBytes, four.kvBytes)
  assert.equal(eight.recurrentBytes * 8, four.recurrentBytes * 4)
  assert.equal(eight.convBytes * 8, four.convBytes * 4)
  assert.equal(fp8.kvBytes, four.kvBytes / 2)
  assert.equal(fp8.recurrentBytes, four.recurrentBytes)
  assert.equal(fp8.convBytes, four.convBytes)
})

test('Qwen3.5 full-attention Q projection includes its output gate', () => {
  const model = getModelArchitecture('qwen3-5-9b')
  const attention = decoderNodes(model, 3)[1]
  const projection = attention.weights.find((weight) => weight.name.startsWith('q_proj'))
  assert.equal(formatShape(projection.shape, model, { ...base, tp: 4 }), '[2 × 4 × 256, 4096]')
  const state = layerCacheNode(model, 0)
  assert.equal(formatShape(state.outputShape, model, { ...base, tp: 4 }), '[1, 8, 128, 128] + [1, 2048, 4]')
})

test('all model layers have a complete residual block and resolvable shapes', () => {
  for (const model of modelArchitectures) {
    for (let layer = 0; layer < model.dimensions.layers; layer++) {
      const nodes = decoderNodes(model, layer)
      const parallel = model.execution.residualLayout === 'parallel'
      assert.equal(nodes.length, parallel ? 5 : model.execution.normLayout ? 8 : 6)
      const groups = decoderGroups(model, layer)
      assert.equal(groups[0].at(-1).id, parallel ? attentionKind(model, layer) : 'attention-add')
      assert.equal(groups[1][0].id, model.execution.normLayout === 'post-branch-qk' ? 'ffn' : 'ffn-norm')
      assert.equal(groups[1].at(-1).id, parallel ? 'ffn' : 'ffn-add')
      if (parallel) {
        assert.equal(nodes.at(-1).id, 'parallel-add')
        assert.equal(nodes.filter((node) => node.id.endsWith('-add')).length, 1)
        assert.equal(groups.flat().length, nodes.length - 1)
      }
      assert.equal(nodes.filter((node) => ['ffn', 'dense-ffn', 'moe'].includes(node.id)).length, 1)
      for (const tp of model.supportedTp) {
        assert.equal(model.dimensions.attentionHeads % tp, 0)
        assert.ok(Number.isInteger(localKvHeads(model, tp)))
        for (const node of [...nodes, ...model.nodes]) {
          for (const shape of [node.inputShape, node.outputShape, ...node.weights.map((w) => w.shape), ...(node.tensors ?? []).map((tensor) => tensor.shape)]) {
            const actual = formatShape(shape, model, { ...base, tp })
            assert.doesNotMatch(actual, /\{|\}|NaN|undefined|\bN\b/, `${model.id} layer ${layer} TP ${tp}: ${actual}`)
          }
        }
      }
    }
  }
})

test('Mistral v0.1 sliding cache saturates exactly at W while preserving full prefill token count', () => {
  const model = getModelArchitecture('mistral-7b-v0-1')
  assert.equal(model.execution.cache.kind, 'swa')
  assert.equal(model.execution.cache.window, 4096)
  for (const tp of model.supportedTp) {
    for (const batch of [1, 4]) {
      for (const cacheBytes of [1, 2]) {
        for (const sequence of [1, 1024, 4095, 4096, 4097, 32768]) {
          const scenario = { ...base, tp, batch, cacheBytes, sequence }
          const estimate = cacheEstimate(model, scenario)
          const width = 32 * 2 * (8 / tp) * 128 * cacheBytes
          assert.equal(estimate.retainedTokens, Math.min(sequence, 4096))
          assert.equal(estimate.kvBytes, batch * Math.min(sequence, 4096) * width)
          assert.equal(estimate.bytesPerToken, width)
          assert.equal(estimate.growthBytesPerToken, sequence < 4096 ? width : 0)
          assert.equal(estimate.recurrentBytes + estimate.convBytes, 0)
          assert.equal(cacheEstimate(model, { ...scenario, phase: 'prefill' }).perRankBytes, estimate.perRankBytes)
          assert.equal(tokenCount({ ...scenario, phase: 'prefill' }), batch * sequence)
          assert.equal(formatShape(layerCacheNode(model, 0).outputShape, model, scenario), `[${batch}, ${Math.min(sequence, 4096)}, 2, ${8 / tp}, 128]`)
        }
      }
    }
  }
  assert.equal(cacheEstimate(model, { ...base, sequence: 32768 }).perRankBytes, 512 * 1024 ** 2)
})

test('Mixtral has full GQA cache, not eight KV copies or the Mistral window', () => {
  const model = getModelArchitecture('mixtral-8x7b-v0-1')
  const mistral = getModelArchitecture('mistral-7b-v0-1')
  for (let layer = 0; layer < 32; layer++) {
    assert.equal(attentionKind(mistral, layer), 'swa')
    assert.equal(decoderNodes(mistral, layer)[4].id, 'ffn')
    assert.equal(attentionKind(model, layer), 'gqa')
    assert.equal(decoderNodes(model, layer)[4].id, 'moe')
  }
  const scenario = { ...base, sequence: 32768, tp: 4 }
  const full = cacheEstimate(model, scenario)
  assert.equal(full.retainedTokens, 32768)
  assert.equal(full.perRankBytes, 1024 * 1024 ** 2)
  assert.equal(full.perRankBytes, cacheEstimate(getModelArchitecture('llama-3-1-8b'), scenario).perRankBytes)
  assert.equal(full.perRankBytes, cacheEstimate(mistral, scenario).perRankBytes * 8)
  const expert = decoderNodes(model, 0)[4]
  assert.equal(formatShape(expert.weights[1].shape, model, { ...scenario, tp: 8 }), '[8, 1792, 4096]')
  assert.equal(expert.tensors[1].shape, '[N, 2]')
})

test('marginal capacity growth equals the exact next-token difference for every cache family', () => {
  for (const model of modelArchitectures) {
    for (const sequence of [1024, 4095, 4096, 4097]) {
      const scenario = { ...base, batch: 4, sequence, tp: 4 }
      const current = cacheEstimate(model, scenario)
      const next = cacheEstimate(model, { ...scenario, sequence: sequence + 1 })
      assert.equal(next.perRankBytes - current.perRankBytes, current.growthBytesPerToken * scenario.batch)
    }
  }
})

test('every model knowledge link resolves to an existing article or category', async () => {
  const articles = JSON.parse(await readFile(new URL('../src/data/curriculum-index.json', import.meta.url), 'utf8'))
  for (const model of modelArchitectures) {
    for (const node of model.nodes) {
      for (const link of node.knowledge) {
        const url = new URL(link.to, 'https://example.org')
        if (url.pathname.startsWith('/article/')) assert.ok(articles.some((article) => url.pathname === `/article/${article.slug}`), `${model.id}: ${link.to}`)
        else if (url.pathname.startsWith('/category/')) assert.ok(categories.some((category) => url.pathname === `/category/${category.slug}`), `${model.id}: ${link.to}`)
        else assert.fail(`Unexpected knowledge target: ${link.to}`)
      }
    }
  }
})

test('Gemma 2 uses 21 local and 21 global layers with pre/post norms inside both residual branches', () => {
  const model = getModelArchitecture('gemma-2-9b')
  assert.equal(model.dimensions.layers, 42)
  assert.equal(model.execution.maxContext, 8192)
  assert.equal(model.execution.normLayout, 'pre-post')
  for (let layer = 0; layer < 42; layer++) {
    const sliding = layer % 2 === 0
    assert.equal(attentionKind(model, layer), sliding ? 'swa' : 'gqa')
    assert.equal(layerCacheNode(model, layer).id, sliding ? 'window-cache' : 'kv-cache')
    assert.deepEqual(decoderGroups(model, layer).map((group) => group.map((node) => node.id)), [
      ['attention-norm', sliding ? 'swa' : 'gqa', 'attention-post-norm', 'attention-add'],
      ['ffn-norm', 'ffn', 'ffn-post-norm', 'ffn-add'],
    ])
    const norms = decoderNodes(model, layer).filter((node) => node.eyebrow === 'RMSNORM')
    assert.equal(norms.length, 4)
    assert.ok(norms.every((node) => node.description.includes('(1 + weight)')))
  }
})

test('Gemma mixed cache splits full/window capacity and halves growth after the local knee', () => {
  const model = getModelArchitecture('gemma-2-9b')
  for (const tp of model.supportedTp) for (const batch of [1, 3, 4]) for (const cacheBytes of [1, 2]) for (const sequence of [1024, 4095, 4096, 4097, 8192]) {
    const scenario = { ...base, tp, batch, cacheBytes, sequence }
    const e = cacheEstimate(model, scenario)
    const width = 2 * (8 / tp) * 256 * cacheBytes
    assert.equal(e.fullKvLayers, 21)
    assert.equal(e.slidingLayers, 21)
    assert.equal(e.kvLayers, 42)
    assert.equal(e.recurrentLayers, 0)
    assert.equal(e.fullKvBytes, batch * sequence * 21 * width)
    assert.equal(e.slidingKvBytes, batch * Math.min(sequence, 4096) * 21 * width)
    assert.equal(e.perRankBytes, e.fullKvBytes + e.slidingKvBytes)
    assert.equal(e.growthBytesPerToken, (sequence >= 4096 ? 21 : 42) * width)
    assert.equal(formatShape(layerCacheNode(model, 0).outputShape, model, scenario), `[${batch}, ${Math.min(sequence, 4096)}, 2, ${8 / tp}, 256]`)
    assert.equal(formatShape(layerCacheNode(model, 1).outputShape, model, scenario), `[${batch}, ${sequence}, 2, ${8 / tp}, 256]`)
  }
  const e = cacheEstimate(model, { ...base, sequence: 8192 })
  assert.equal(e.fullKvBytes, 1344 * 1024 ** 2)
  assert.equal(e.slidingKvBytes, 672 * 1024 ** 2)
  assert.equal(e.perRankBytes, 2016 * 1024 ** 2)
})

test('Gemma head dimensions, GeGLU, tied embedding and softcaps are not inferred from Llama geometry', () => {
  const model = getModelArchitecture('gemma-2-9b')
  assert.equal(model.dimensions.hiddenSize, 3584)
  assert.equal(model.dimensions.attentionHeads * model.dimensions.headDim, 4096)
  assert.equal(model.dimensions.intermediateSize, 14336)
  const attention = model.nodes.find((node) => node.id === 'swa')
  assert.equal(formatShape(attention.weights[0].shape, model, { ...base, tp: 4 }), '[4 × 256, 3584]')
  assert.ok(attention.description.includes('50 × tanh(x / 50)'))
  assert.ok(model.nodes.find((node) => node.id === 'ffn').title.includes('GELU-tanh'))
  assert.ok(model.nodes.find((node) => node.id === 'lm-head').description.includes('30 × tanh(x / 30)'))
  assert.equal(formatShape(model.nodes.find((node) => node.id === 'lm-head').weights[1].shape, model, { ...base, tp: 8 }), '[32000, 3584]')
})
