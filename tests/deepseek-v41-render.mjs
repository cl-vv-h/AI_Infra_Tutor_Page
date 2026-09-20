import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { default: Page } = await server.ssrLoadModule('/src/pages/DeepseekV41.tsx')
  const render = (query) => renderToString(h(MemoryRouter, { initialEntries: [`/models/deepseek-v4-1-flash?${query}`] }, h(Page)))
  for (let layer = 0; layer < 40; layer++) for (const world of [1, 8]) for (const view of ['diagram', 'cache', 'weights']) {
    const html = render(`layer=${layer}&world=${world}&rank=${world - 1}&s=4096&storage=packed&view=${view}`)
    assert.match(html, /DeepSeek-V4.1-Flash/)
    assert.match(html, /Single-Pass mHC/)
    assert.match(html, /6.08 MiB/)
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    assert.equal((html.match(/aria-label="观察 V4.1 Layer /g) ?? []).length, 40)
    assert.ok(html.includes('已接入目录与缓存对比'))
    assert.ok(html.includes('V4.1 逐 rank 张量流'))
    assert.ok(html.includes('wo_b 本地矩阵乘'))
    const panels = [...html.matchAll(/<div role="tabpanel"[^>]*>/g)].map(([tag]) => tag)
    assert.equal(panels.length, 3)
    assert.equal(panels.filter((tag) => !tag.includes('hidden')).length, 1)
    assert.ok(panels.find((tag) => !tag.includes('hidden')).includes(`id="workspace-panel-${view}"`))
    for (const id of ['diagram', 'cache', 'weights']) {
      assert.ok(html.includes(`aria-controls="workspace-panel-${id}"`))
      assert.ok(html.includes(`aria-labelledby="workspace-tab-${id}"`))
    }
  }
  const initial = render('layer=0&phase=prefill')
  assert.ok(initial.includes('初始 one-hot [1,0,0,0]'))
  assert.ok(render('layer=20').includes('Layer 19 FFN 产生的 pre'))
  assert.ok(render('layer=24').includes('重新计算本层 query'))
  assert.ok(render('layer=14').includes('首先注入 Engram'))
  assert.ok(render('storage=reference').includes('17.52 MiB'))
  assert.ok(render('layer=14&world=8&rank=7&flow=engram').includes('padding <!-- -->6<!-- --> 行'))
  assert.ok(render('layer=0&flow=engram').includes('当前层没有 Engram'))
  assert.ok(render('flow=moe').includes('单个本地专家：gate / up'))
  const { v41Lessons } = await server.ssrLoadModule('/src/lib/v41-learning.ts')
  for (const [lesson, step] of v41Lessons.entries()) {
    const html = render(`lesson=${lesson}&view=${step.view}&layer=${step.layer}&flow=${step.flow}`)
    assert.ok(html.includes(`id="${step.target}"`))
    assert.ok(html.includes('aria-label="V4.1 架构专题"'))
    assert.match(html, /id="v41-topic-content"/)
    assert.ok(html.includes(step.title))
  }
  console.log('V4.1 reference static render: 240 layer/world/workspace routes, 8 guided lessons, source modes, lagged mHC and two cache baselines passed.')
} finally { await server.close() }
