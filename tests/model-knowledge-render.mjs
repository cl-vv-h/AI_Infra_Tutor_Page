import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter, Routes, Route } = await server.ssrLoadModule('react-router-dom')
  const { default: Knowledge } = await server.ssrLoadModule('/src/pages/ModelKnowledge.tsx')
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  const { default: V41 } = await server.ssrLoadModule('/src/pages/DeepseekV41.tsx')
  const { default: Compare } = await server.ssrLoadModule('/src/pages/ModelCompare.tsx')
  const { default: Dpa } = await server.ssrLoadModule('/src/pages/DpaLab.tsx')
  const { modelKnowledge } = await server.ssrLoadModule('/src/data/model-knowledge.ts')
  const { modelArchitectures } = await server.ssrLoadModule('/src/data/models.ts')
  const render = (path, pattern, Component, props = {}) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, {}, h(Route, { path: pattern, element: h(Component, props) })))).replace(/<!--.*?-->/g, '')
  const check = html => {
    assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /？|先预测|揭示本步答案|查看本步讲解|自动判分/)
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    assert.ok(html.includes('aria-label="模型知识导航"'))
  }
  check(render('/models/knowledge', '/models/knowledge', Knowledge))
  for (const topic of modelKnowledge) {
    const html = render(`/models/knowledge/${topic.id}`, '/models/knowledge/:topicId', Knowledge)
    check(html)
    assert.ok(html.includes(`<h1 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">${topic.title}</h1>`))
    for (const concept of topic.concepts) assert.ok(html.includes(concept.title))
    assert.ok(html.includes('aria-current="page"'))
  }
  assert.ok(render('/models/knowledge/missing', '/models/knowledge/:topicId', Knowledge).includes('专题不存在'))
  let count = 0
  for (const model of modelArchitectures) for (const view of ['diagram', 'cache', 'weights']) for (const layer of [0, model.dimensions.layers - 1]) {
    check(render(`/models/${model.id}?view=${view}&layer=${layer}`, '/models/:modelId', Models)); count++
  }
  for (const view of ['diagram', 'cache', 'weights']) for (let lesson = 0; lesson < 8; lesson++) {
    check(render(`/models/deepseek-v4-1-flash?view=${view}&lesson=${lesson}`, '/models/deepseek-v4-1-flash', V41)); count++
  }
  check(render('/models/compare', '/models/compare', Compare))
  for (const modelId of ['glm-5-2', 'qwen3-8b']) check(render(`/models/${modelId}/dpa`, '/models/:modelId/dpa', Dpa, { modelId }))
  console.log(`Knowledge render passed: overview, 9 topics, missing route, ${count} model workspaces, comparison and DPA; no question/answer content.`)
} finally { await server.close() }
