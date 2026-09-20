import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { default: Compare } = await server.ssrLoadModule('/src/pages/ModelCompare.tsx')
  const { default: Catalog } = await server.ssrLoadModule('/src/pages/ModelCatalog.tsx')
  const { default: Explorer } = await server.ssrLoadModule('/src/pages/DeepseekV41.tsx')
  const { modelArchitectures } = await server.ssrLoadModule('/src/data/models.ts')
  const render = (Page, path) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Page))).replace(/<!--.*?-->/g, '')
  const catalog = render(Catalog, '/models?q=Engram&attention=compressed&ffn=moe&pick=deepseek-v4-1-flash,deepseek-v4-flash')
  assert.equal((catalog.match(/<article /g) ?? []).length, 1)
  assert.ok(catalog.includes('对比 DeepSeek-V4.1-Flash'))
  assert.ok(catalog.includes('38 SWA+CSA2（含复用）'))
  assert.ok(catalog.includes('models=deepseek-v4-1-flash%2Cdeepseek-v4-flash'))
  assert.ok(!catalog.includes('接入中的独立实验'))
  let cases = 0
  for (const model of modelArchitectures) for (const storage of ['reference', 'packed']) for (const bytes of [1, 2]) for (const view of ['rank', 'group']) {
    const sequence = Math.min(4096, model.execution.maxContext)
    const html = render(Compare, `/models/compare?models=deepseek-v4-1-flash,${model.id}&b=1&s=${sequence}&tp=4&bytes=${bytes}&view=${view}&v41storage=${storage}`)
    assert.equal((html.match(/<article /g) ?? []).length, 2)
    assert.ok(html.includes(model.name) && html.includes('DeepSeek-V4.1-Flash'))
    assert.ok(html.includes('不能称为相同 KV 精度'))
    assert.ok(html.includes('四个 owner 的主 KV'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity|当前条件不计算/)
    const link = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&')).find((href) => href.startsWith('/models/deepseek-v4-1-flash?'))
    const params = new URL(link, 'https://example.org').searchParams
    for (const [key, value] of Object.entries({ b: '1', s: String(sequence), world: '4', replicas: '1', storage, view: 'cache' })) assert.equal(params.get(key), value)
    const chart = html.match(/<svg[^>]*role="img"[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? ''
    const circles = [...chart.matchAll(/<circle[^>]*cx="([^"]+)"/g)].map((m) => Number(m[1]))
    assert.ok(circles.length > 0 && circles.every((x) => x >= 90 && x <= 810), 'all supported lengths fit the log axis, including 1M')
    assert.ok(circles.includes(810), 'V4.1 1M endpoint is inside the plot')
    if (sequence === 4096 && view === 'rank') assert.ok(html.includes(storage === 'packed' ? '6.08 MiB' : '17.52 MiB'))
    cases++
  }
  const experiment = render(Explorer, '/models/deepseek-v4-1-flash?b=3&s=16385&world=8&storage=packed')
  assert.ok(experiment.includes('v41storage=packed'))
  assert.ok(experiment.includes('tp=8'))
  assert.ok(experiment.includes('b=3'))
  assert.ok(render(Explorer, '/models/deepseek-v4-1-flash?s=1').includes('不自动改写当前长度'))
  console.log(`Unified directory render verified: V4.1 search/picks, ${cases} mixed comparisons, explorer handoffs and 1M chart bounds.`)
} finally { await server.close() }
