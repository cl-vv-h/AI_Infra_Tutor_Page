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
      const html = render(`?models=${a.id},${b.id}&view=group&tp=4&bytes=1&b=8&s=32768`)
      assert.equal((html.match(/<article /g) ?? []).length, 2)
      assert.ok(html.includes(a.name) && html.includes(b.name))
      assert.ok(html.includes(a.configUrl.replaceAll('&', '&amp;')))
      assert.ok(html.includes(b.configUrl.replaceAll('&', '&amp;')))
      assert.ok(html.includes(`/models/${a.id}`) && html.includes(`/models/${b.id}`))
      assert.doesNotMatch(html, /当前条件不计算|NaN|undefined|Infinity/)
    }
  }
  const malformed = render('?models=%3Cscript%3E&b=Infinity&tp=3&view=bad')
  assert.match(malformed, /参数无效/)
  assert.doesNotMatch(malformed, /<script>/)
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  for (const id of ['mistral-7b-v0-1', 'mixtral-8x7b-v0-1']) {
    const route = h(Route, { path: '/models/:modelId', element: h(Models) })
    const html = renderToString(h(MemoryRouter, { initialEntries: [`/models/${id}`] }, h(Routes, null, route)))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    assert.equal((html.match(/aria-label="Layer \d+ ·/g) ?? []).length, 32)
    assert.match(html, /32,000/)
    assert.ok(html.includes(id === 'mistral-7b-v0-1' ? '滚动窗口 · W' : 'Mixtral Top-2 MoE'))
  }
  const sliding = render('?models=mistral-7b-v0-1,mixtral-8x7b-v0-1&s=16384&tp=4')
  assert.match(sliding, /滑动窗口 KV/)
  assert.match(sliding, /容量增长：\+0 B/)
  assert.match(sliding, /min\(S, 4,096\)/)
  const atLimit = render('?models=mistral-7b-v0-1,mixtral-8x7b-v0-1&s=32768&tp=4')
  assert.equal((atLimit.match(/已达配置上下文上限/g) ?? []).length, 2)
  console.log(`Model render smoke tests passed: default trio, all ${modelArchitectures.length * (modelArchitectures.length - 1) / 2} model pairs, Mistral/Mixtral explorers, shared settings and limits.`)
} finally {
  await server.close()
}
