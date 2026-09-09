import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'

// Static markup and route-state verification, not browser interaction or visual QA.
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { default: Catalog } = await server.ssrLoadModule('/src/pages/ModelCatalog.tsx')
  const { modelArchitectures: registry } = await server.ssrLoadModule('/src/data/models.ts')
  const { attentionFilters, filterCatalog, parseCatalog } = await server.ssrLoadModule('/src/lib/model-catalog.ts')
  const render = (params = new URLSearchParams()) => renderToString(h(MemoryRouter, { initialEntries: [`/models?${params}`] }, h(Catalog))).replace(/<!--.*?-->/g, '')
  const home = render()
  assert.match(home, /模型图解目录/)
  assert.equal((home.match(/<article /g) ?? []).length, registry.length)
  assert.equal((home.match(/type="checkbox"/g) ?? []).length, registry.length)
  for (const model of registry) assert.ok(home.includes(`href="/models/${model.id}"`), model.id)
  assert.ok(home.includes(`${registry.reduce((sum, model) => sum + model.dimensions.layers, 0)} 层可探索`))
  for (const filter of attentionFilters) for (const ffn of ['all', 'dense', 'moe']) {
    const params = new URLSearchParams({ attention: filter.id, ffn })
    const html = render(params)
    const expected = filterCatalog(registry, parseCatalog(params, registry).state)
    assert.equal((html.match(/<article /g) ?? []).length, expected.length, `${filter.id}/${ffn}`)
    assert.doesNotMatch(html, /NaN|undefined/)
  }
  const hidden = render(new URLSearchParams({ q: 'not-found', pick: 'phi-3-5-mini-instruct,llama-3-1-8b' }))
  const olmo = render(new URLSearchParams({ pick: 'olmo-2-1124-7b,llama-3-1-8b' }))
  assert.match(olmo, /S=4,096/)
  assert.match(olmo, /s=4096/)
  assert.match(hidden, /没有匹配的模型/)
  assert.match(hidden, /（筛选外）/)
  assert.ok(hidden.includes('比较已选模型'))
  assert.ok(hidden.includes('models=phi-3-5-mini-instruct%2Cllama-3-1-8b'))
  assert.match(hidden, /aria-label="移除对比 Phi-3.5 Mini Instruct"/)
  const full = render(new URLSearchParams({ pick: registry.slice(0, 3).map((model) => model.id).join(',') }))
  const checkboxes = full.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? []
  assert.equal(checkboxes.filter((tag) => tag.includes('checked')).length, 3)
  assert.equal(checkboxes.filter((tag) => tag.includes('disabled')).length, registry.length - 3)
  assert.match(full, /已选满 3 个/)
  const malformed = render(new URLSearchParams({ q: '<script>alert(1)</script>', attention: 'invalid', pick: 'unknown' }))
  assert.doesNotMatch(malformed, /<script>/)
  assert.match(malformed, /&lt;script&gt;/)
  assert.match(malformed, /未知注意力类型/)
  assert.match(malformed, /不存在、重复或超过三项/)
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.ok(app.includes('<Route path="/models" element={<ModelCatalog />} />'))
  assert.ok(app.includes('<Route path="/models/:modelId" element={<Models />} />'))
  assert.ok(app.includes('<Route path="/models/compare" element={<ModelCompare />} />'))
  console.log(`Catalog static render verified: ${registry.length} cards, 21 attention/FFN combinations, selection limits, hidden picks and preserved routes.`)
} finally { await server.close() }
