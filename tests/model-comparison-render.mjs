import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Static render smoke tests, not a browser interaction or visual QA suite.
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({
  configLoader: 'runner',
  server: { middlewareMode: true },
  ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } },
})

try {
  const { MemoryRouter, Routes, Route } = await server.ssrLoadModule('react-router-dom')
  const { default: Compare } = await server.ssrLoadModule('/src/pages/ModelCompare.tsx')
  const { modelArchitectures } = await server.ssrLoadModule('/src/data/models.ts')
  const render = (query = '') => renderToString(h(MemoryRouter, { initialEntries: [`/models/compare${query}`] }, h(Compare)))
  const home = render()
  assert.match(home, /模型对比台/)
  for (const value of ['1 GiB', '1.65 GiB', '305.5 MiB', '架构差异速查', '查看各长度的精确容量']) assert.ok(home.includes(value), value)
  assert.doesNotMatch(home, /NaN|undefined|Infinity/)
  assert.equal((home.match(/<article /g) ?? []).length, 3)
  assert.equal((home.match(/<svg[^>]*role="img"/g) ?? []).length, 1)

  const outOfRange = render('?models=qwen3-8b,glm-4-7-flash&q=ignored&tp=8&s=65536')
  assert.equal((outOfRange.match(/当前条件不计算/g) ?? []).length, 2)
  assert.match(outOfRange, /S 超过当前配置上限 40,960/)
  assert.match(outOfRange, /此图解尚未覆盖 TP 8/)

  for (let i = 0; i < modelArchitectures.length; i++) {
    for (let j = i + 1; j < modelArchitectures.length; j++) {
      const a = modelArchitectures[i]
      const b = modelArchitectures[j]
      const sequence = Math.min(32768, a.execution.maxContext, b.execution.maxContext)
      const html = render(`?models=${a.id},${b.id}&view=group&tp=4&bytes=1&b=8&s=${sequence}`)
      assert.equal((html.match(/<article /g) ?? []).length, 2)
      assert.ok(html.includes(a.name) && html.includes(b.name))
      assert.ok(html.includes(a.configUrl.replaceAll('&', '&amp;')))
      assert.ok(html.includes(b.configUrl.replaceAll('&', '&amp;')))
      assert.ok(html.includes(`/models/${a.id}`) && html.includes(`/models/${b.id}`))
      for (const model of [a, b]) {
        const link = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&')).find((href) => href.startsWith(`/models/${model.id}?`))
        assert.ok(link, 'comparison must carry its conditions into the explorer')
        const params = new URL(link, 'https://example.org').searchParams
        for (const [key, value] of Object.entries({ tp: '4', bytes: '1', b: '8', s: String(sequence), layer: '0', phase: 'decode' })) assert.equal(params.get(key), value)
      }
      assert.doesNotMatch(html, /当前条件不计算|NaN|undefined|Infinity/)
    }
  }
  const malformed = render('?models=%3Cscript%3E&b=Infinity&tp=3&view=bad')
  assert.match(malformed, /参数无效/)
  assert.doesNotMatch(malformed, /<script>/)
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  const { explorerHref, moduleIndex, nearestModuleLayer } = await server.ssrLoadModule('/src/lib/model-explorer.ts')
  const { formatShape } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  const { formatBytes } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  const { decoderWeightBudget } = await server.ssrLoadModule('/src/lib/model-weights.ts')
  const renderExplorer = (path) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, null, h(Route, { path: '/models/:modelId', element: h(Models) })))).replace(/<!--.*?-->/g, '')
  for (const model of modelArchitectures) {
    for (const bits of [4, 16, 32]) {
      const layer = model.dimensions.layers - 1
      const html = renderExplorer(`/models/${model.id}?layer=${layer}&tp=4&wbits=${bits}`)
      const budget = decoderWeightBudget(model, layer, 4, bits)
      assert.ok(html.includes(`Layer ${layer} · 每卡 ${formatBytes(budget.bytes)} · ${bits}-bit 理论载荷`))
      assert.ok(html.includes(`全部 ${model.dimensions.layers} 层每卡 · 图示权重`))
      assert.ok(html.includes(formatBytes(budget.allLayersBytes)))
      assert.ok(html.includes('不是完整模型参数量或可部署显存'))
      assert.ok(html.includes('href="/category/quantization"'))
      assert.equal((html.match(/aria-label="定位权重模块：/g) ?? []).length, budget.rows.length)
      assert.doesNotMatch(html, /未计算|尚未提供可计算|NaN|undefined/)
    }
  }
  assert.match(renderExplorer('/models/gemma-2-9b?wbits=3'), /wbits 参数无效/)
  for (const id of ['mistral-7b-v0-1', 'mixtral-8x7b-v0-1']) {
    const route = h(Route, { path: '/models/:modelId', element: h(Models) })
    const html = renderToString(h(MemoryRouter, { initialEntries: [`/models/${id}`] }, h(Routes, null, route)))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    assert.equal((html.match(/aria-label="Layer \d+ ·/g) ?? []).length, 32)
    assert.match(html, /32,000/)
    assert.ok(html.includes(id === 'mistral-7b-v0-1' ? '滚动窗口 · W' : 'Mixtral Top-2 MoE'))
  }
  let restoredModules = 0
  for (const model of modelArchitectures) {
    const scenario = { phase: 'prefill', batch: 3, sequence: Math.min(16384, model.execution.maxContext), tp: 2, cacheBytes: 1 }
    for (const target of moduleIndex(model)) {
      const layer = nearestModuleLayer(target, model.dimensions.layers - 1)
      const html = renderExplorer(explorerHref(model.id, { layer, nodeId: target.node.id, scenario }))
      assert.match(html, new RegExp(`id="model-node-${target.node.id}"[^>]*aria-pressed="true"`))
      assert.match(html, /<option value="3" selected="">3<\/option>/)
      assert.match(html, /复制当前图解/)
      assert.match(html, /模块与权重检索/)
      assert.ok(html.includes(formatShape(target.node.outputShape, model, scenario)))
      assert.equal([...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].filter((match) => match[1] === target.node.title).length, 2)
      assert.doesNotMatch(html, /参数无效|NaN|undefined/)
      restoredModules++
    }
  }
  const unknownModel = renderExplorer('/models/not-a-real-model?b=999')
  const capacity = renderExplorer('/models/llama-3-1-8b?b=4&s=4096&tp=4&budget=0.5')
  for (const text of ['缓存预算反算', 'value="0.5"', '需要 512 MiB / 卡', '预算内剩余 0 B', '应用 B=4', '不能将各自最大 B 和最大 S 同时组合']) assert.ok(capacity.includes(text), text)
  assert.match(capacity, /<details open=""/)
  const zeroCapacity = renderExplorer('/models/llama-3-1-8b?budget=0')
  for (const text of ['超出预算 512 MiB', '无可用 S', 'disabled=""', '应用 B=0']) assert.ok(zeroCapacity.includes(text), text)
  assert.doesNotMatch(zeroCapacity, /NaN|Infinity/)
  const largeCapacity = renderExplorer('/models/llama-3-1-8b?budget=16')
  assert.match(largeCapacity, /应用 B=64/)
  assert.match(largeCapacity, /图解控件上限为 64/)
  assert.match(largeCapacity, /131,072/)
  assert.match(renderExplorer('/models/llama-3-1-8b?budget=-1'), /budget 参数无效/)
  const olmo = renderExplorer('/models/olmo-2-1124-7b?layer=31&node=qk-norm&tp=4&b=4&s=4096')
  for (const text of ['Q/K Norm · 跨全部 heads', '8 GiB', '32 GiB', '[4096]', '[4, 4096, 2, 32, 128]', '汇集式 Attention TP']) assert.ok(olmo.includes(text), text)
  const olmoIds = [...olmo.matchAll(/id="model-node-([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(olmoIds, ['embedding', 'attention-projection', 'qk-norm', 'mha', 'kv-cache', 'attention-post-norm', 'attention-add', 'ffn', 'ffn-post-norm', 'ffn-add', 'lm-head'])
  assert.doesNotMatch(olmo, /id="model-node-(?:attention-norm|ffn-norm)"/)
  const olmoCompared = render('?models=olmo-2-1124-7b,llama-3-1-8b&tp=4&b=4&s=4096')
  assert.match(olmoCompared, /8 GiB/)
  assert.match(olmoCompared, /512 MiB/)
  assert.match(olmoCompared, /KV 不除以 TP/)
  assert.match(olmoCompared, /子层输出、残差相加前；另有 Q\/K Norm/)
  assert.match(render('?models=olmo-2-1124-7b,llama-3-1-8b&s=8192'), /S 超过当前配置上限 4,096/)
  const phi = renderExplorer('/models/phi-3-5-mini-instruct?layer=31&node=mha&tp=4&b=4&s=4096')
  assert.equal((phi.match(/aria-label="Layer \d+ · Full \/ MHA/g) ?? []).length, 32)
  assert.ok(phi.includes('id="model-node-mha"') && phi.includes('id="model-node-kv-cache"'))
  for (const text of ['MHA · Fused QKV + LongRoPE', '1.5 GiB', '[4, 8, 96]', 'short_factor', 'SwiGLU · Fused Gate/Up', '不外推到 256K']) assert.ok(phi.includes(text), text)
  assert.ok(!phi.includes('滚动窗口 · W'))
  const mhaComparison = render('?models=phi-3-5-mini-instruct,llama-3-1-8b&tp=4&b=4&s=8192')
  for (const text of ['MHA / GQA：KV 头数', 'MHA · 每个 Q head 独立 KV', '3 GiB', '1 GiB']) assert.ok(mhaComparison.includes(text), text)
  const phiLimit = renderExplorer('/models/phi-3-5-mini-instruct?s=131072&node=kv-cache')
  assert.ok(phiLimit.includes('[4, 131072, 2, 8, 96]'))
  assert.ok(phiLimit.includes('已达配置上下文上限'))
  assert.match(unknownModel, /未找到这个模型图解/)
  assert.doesNotMatch(unknownModel, /每卡逻辑 KV Cache|INSPECTOR/)
  const wrongLayer = renderExplorer('/models/deepseek-v3?layer=0&node=moe&tp=3&s=999999')
  assert.match(wrongLayer, /该模块不在 Layer 0 中/)
  assert.match(wrongLayer, /id="model-node-mla"[^>]*aria-pressed="true"/)
  assert.match(wrongLayer, /tp 参数无效/)
  const gemmaLocal = renderExplorer('/models/gemma-2-9b?layer=0&node=window-cache&s=8192')
  const gemmaGlobal = renderExplorer('/models/gemma-2-9b?layer=1&node=kv-cache&s=8192')
  assert.ok(gemmaLocal.includes('[4, 4096, 2, 2, 256]'))
  assert.ok(gemmaGlobal.includes('[4, 8192, 2, 2, 256]'))
  assert.ok(gemmaLocal.includes('21 层完整 KV') && gemmaLocal.includes('21 层滑窗 KV'))
  assert.ok(gemmaLocal.includes('滚动窗口 · W'))
  assert.ok(!gemmaGlobal.includes('滚动窗口 · W'))
  for (const html of [gemmaLocal, gemmaGlobal]) {
    const ids = [...html.matchAll(/id="model-node-([^"]+)"/g)].map((match) => match[1])
    assert.ok(ids.indexOf('attention-post-norm') < ids.indexOf('attention-add'))
    assert.ok(ids.indexOf('ffn-post-norm') < ids.indexOf('ffn-add'))
  }
  const sliding = render('?models=mistral-7b-v0-1,mixtral-8x7b-v0-1&s=16384&tp=4')
  assert.match(sliding, /滑动窗口 KV/)
  assert.match(sliding, /容量增长：\+0 B/)
  assert.match(sliding, /min\(S, 4,096\)/)
  const atLimit = render('?models=mistral-7b-v0-1,mixtral-8x7b-v0-1&s=32768&tp=4')
  assert.equal((atLimit.match(/已达配置上下文上限/g) ?? []).length, 2)
  console.log(`Model render smoke tests passed: ${modelArchitectures.length * (modelArchitectures.length - 1) / 2} model pairs, ${restoredModules} module links, all model explorers, custom batches, unknown routes and limits.`)
} finally {
  await server.close()
}
