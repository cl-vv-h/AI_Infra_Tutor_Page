import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter, Routes, Route } = await server.ssrLoadModule('react-router-dom')
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  const { kimiNativeLayout } = await server.ssrLoadModule('/src/lib/kimi-native-layout.ts')
  const { kimiNativePostload } = await server.ssrLoadModule('/src/lib/kimi-native-postload.ts')
  let checks = 0
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) for (const replicas of [1, 2]) for (const precision of ['', '&precision=mixed&mlp=fp8&experts=w4afp8']) for (const stage of ['initial', 'processed']) {
    const rank = tp * replicas - 1
    const path = `/models/kimi-k3?view=weights&layer=3&tp=${tp}&ep=${ep}&replicas=${replicas}&rank=${rank}${precision}&native=${stage}`
    const html = renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, {}, h(Route, { path: '/models/:modelId', element: h(Models) })))).replace(/<!--.*?-->/g, '')
    const data = kimiNativeLayout(tp, ep, replicas, rank)
    assert.ok(html.includes('aria-label="Kimi 原生加载基线"'))
    const post = kimiNativePostload(tp, ep, replicas, rank)
    assert.ok(html.includes(`${(stage === 'processed' ? post.trackedBytes : data.bytes).toLocaleString('en-US')} B`))
    assert.ok(html.includes(`${(stage === 'processed' ? post.fleetBytes : data.fleetBytes).toLocaleString('en-US')} B`))
    assert.ok(html.includes(`本地专家 [${data.expertRange.join(', ')})`))
    assert.ok(html.includes(`w13_weight [${data.expertBuffers[0].shape.join(', ')}]`))
    assert.ok(html.includes(`<option value="${stage}" selected="">`))
    assert.equal(html.includes('aria-label="Kimi 后处理明细"'), stage === 'processed')
    if (stage === 'processed') {
      assert.ok(html.includes('F8_E4M3FN view'))
      assert.ok(html.includes(`gemm1_alpha [${896 / ep}] · F32`))
      assert.ok(html.includes('已核对持久张量 / rank'))
      assert.ok(html.includes('两个 cache 字典引用同一 Tensor'))
    }
    assert.ok(html.includes('后处理前'))
    assert.ok(html.includes('不是最终常驻显存'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  console.log(`Kimi native render passed: ${checks} TP/EP/DP/mixed routes, exact totals and scoped initial layouts.`)
} finally { await server.close() }
