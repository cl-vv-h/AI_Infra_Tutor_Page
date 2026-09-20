import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter, Routes, Route } = await server.ssrLoadModule('react-router-dom')
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  const { getModelArchitecture } = await server.ssrLoadModule('/src/data/models.ts')
  const { decoderWeightBudget } = await server.ssrLoadModule('/src/lib/model-weights.ts')
  let checks = 0
  for (const id of ['llama-3-1-8b', 'kimi-k3', 'qwen3-8b', 'qwen3-30b-a3b']) for (const tp of [1, 2, 4, 8]) for (const replicas of [1, 2, 4, 8]) for (const rank of [0, tp * replicas - 1]) {
    const model = getModelArchitecture(id)
    const path = `/models/${id}?view=weights&layer=3&tp=${tp}&replicas=${replicas}&rank=${rank}`
    const html = renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, {}, h(Route, { path: '/models/:modelId', element: h(Models) })))).replace(/<!--.*?-->/g, '')
    const replica = Math.floor(rank / tp)
    const rankButtons = [...html.matchAll(/<button[^>]*aria-label="观察 Rank (\d+)"[^>]*>/g)]
    assert.equal(rankButtons.length, tp, 'only one replica is expanded, even at 64 ranks')
    assert.deepEqual(rankButtons.map(match => Number(match[1])), Array.from({ length: tp }, (_, local) => replica * tp + local))
    assert.ok(rankButtons.find(match => Number(match[1]) === rank)[0].includes('aria-pressed="true"'))
    const picker = html.match(/<select aria-label="观察 DP 副本"[^>]*>(.*?)<\/select>/s)[1]
    assert.equal((picker.match(/<option /g) ?? []).length, replicas)
    assert.ok(picker.includes(`<option value="${replica}" selected="">`))
    assert.ok(html.includes(`全部 ${tp * replicas} 个 ranks 都可选择`))
    assert.ok(html.includes('aria-label="权重阅读顺序"'))
    assert.ok(html.includes('aria-label="模块边界逻辑载荷"'))
    assert.ok(html.includes('逻辑元素与参考载荷'))
    assert.ok(html.includes('不从名称猜 dtype 或份数'))
    assert.equal(html.includes('aria-label="Attention head 归属"'), id !== 'kimi-k3')
    if (id !== 'kimi-k3') {
      const ownership = html.match(/<details aria-label="Attention head 归属"[^>]*>/)[0]
      assert.ok(!ownership.includes('open='))
      assert.equal((html.match(/aria-label="Attention Rank /g) ?? []).length, tp)
    }
    for (const section of ['rank', 'decoder', ...(id === 'kimi-k3' ? ['checkpoint'] : [])]) assert.match(html, new RegExp(`id="weight-${section}-section" tabindex="-1"`))
    assert.equal(html.includes('3 · 官方文件 / 原生加载对账'), id === 'kimi-k3')
    const budget = decoderWeightBudget(model, 3, tp, 16)
    for (const bytes of [budget.bytes, budget.allLayersBytes, budget.allLayersBytes * tp * replicas]) assert.ok(html.includes(`${bytes.toLocaleString('en-US')} B`))
    assert.ok(html.includes('不是整个 Decoder 或完整模型'))
    assert.ok(html.includes('这是去重逻辑参数元素数，不是单卡字节'))
    if (id === 'kimi-k3') {
      const disclosure = html.match(/<details[^>]*aria-label="Kimi 文件差额与审计说明"[^>]*>/)[0]
      assert.ok(!disclosure.includes('open='))
      assert.ok(html.includes('完整权重文件：1.561 TB'))
      assert.ok(html.includes('aria-label="Kimi 原生加载基线"'))
    }
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  console.log(`Weight reading render verified: ${checks} model/TP/replica/rank cases; compact reachable ranks, scope bytes, focus targets and default disclosures.`)
} finally { await server.close() }
