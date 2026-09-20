import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { default: Page } = await server.ssrLoadModule('/src/pages/DpaLab.tsx')
  const render = (q) => renderToString(h(MemoryRouter, { initialEntries: [`/models/glm-5-2/dpa?${q}`] }, h(Page))).replace(/<!--.*?-->/g, '')
  const renderQwen = (q) => renderToString(h(MemoryRouter, { initialEntries: [`/models/qwen3-8b/dpa?${q}`] }, h(Page, { modelId: 'qwen3-8b' }))).replace(/<!--.*?-->/g, '')
  let qwenChecks = 0
  for (const tp of [1, 2, 4, 8]) for (const dp of [1, 2, 4, 8].filter(d => d <= tp)) for (const mlp of ['bf16', 'fp8']) for (const layer of [0, 35]) {
    const html = renderQwen(`tp=${tp}&dp=${dp}&groups=${Array(dp).fill(2).join(',')}&rank=${tp - 1}&layer=${layer}&precision=mixed&mlp=${mlp}`)
    assert.ok(html.includes(`Attention TP=${tp / dp}`))
    assert.ok(html.includes(`Dense TP=${tp}`))
    assert.ok(html.includes('36 层 / 本 rank'))
    assert.ok(html.includes('每行宽度 4096'))
    assert.ok(html.includes('GQA DPA 内部张量'))
    assert.ok(html.includes('GQA DPA 缓存归属'))
    assert.ok(html.includes('全卡 KV 不变，不等于每卡 KV 不变'))
    assert.ok(html.includes('并非再次跨卡 ReduceScatter'))
    assert.ok(html.includes('这里的行数是 DPA 汇合缓冲'))
    assert.ok(html.includes('href="/models/qwen3-8b"'))
    assert.ok(html.includes('max="35"'))
    assert.ok(!html.includes('aria-label="DPA ep"'))
    assert.ok(!html.includes('aria-label="Shared MLP 精度"'))
    assert.ok(!html.includes('aria-label="Routed MoE 精度"'))
    assert.ok(!html.includes('aria-label="W4A8 权重阶段"'))
    assert.ok(!html.includes('78 层') && !html.includes('Indexer 仍复制') && !html.includes('1048576'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    qwenChecks++
  }
  assert.ok(renderQwen('tp=8&dp=4&groups=3,1,0,2&rank=5').includes('[0, 4096]'))
  assert.ok(renderQwen('groups=0,0,0,0').includes('全部组空闲'))
  assert.ok(renderQwen('tp=8&dp=4&groups=9,0,0,0').includes('本基线选择 SUM_LEN'))
  console.log(`Qwen GQA/Dense DPA render verified: ${qwenChecks} topology/precision/layer routes, scoped cache and total-TP MLP.`)
  let checks = 0
  for (const tp of [1, 2, 4, 8]) for (const dp of [1, 2, 4, 8].filter((d) => d <= tp)) for (const layer of [0, 3, 77]) {
    const html = render(`tp=${tp}&dp=${dp}&layer=${layer}&rank=${tp - 1}`)
    assert.ok(html.includes(`Attention TP=${tp / dp}`))
    assert.ok(html.includes('DPA 本层权重'))
    assert.ok(html.includes('独立 DPA 实验条件'))
    assert.ok(html.includes('DPA 缓冲区分段图'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  assert.ok(render('groups=0,0,0,0').includes('全部组空闲'))
  assert.ok(render('tp=8&dp=4&groups=3,1,0,2&rank=5').includes('padding 10'))
  assert.ok(render('tp=8&dp=4&groups=9,0,0,0').includes('本基线选择 SUM_LEN'))
  const uneven = render('tp=8&dp=4&groups=3,1,0,2&rank=5')
  assert.ok(uneven.includes('有效 1 · 对齐补齐 1 · MAX 补齐 2'))
  assert.ok(uneven.includes('有效返回 [12, 14)'))
  assert.ok(uneven.includes('无有效返回；这一组仅含补齐槽。'))
  assert.ok(render('groups=0,0,0,0').includes('空缓冲：所有组都没有有效 token'))
  let mixedChecks = 0
  for (const dp of [1, 4]) for (const ep of [1, 4, 8]) for (const layer of [0, 3]) for (const experts of ['bf16', 'fp8', 'mxfp4', 'w4afp8']) {
    const html = render(`tp=8&dp=${dp}&ep=${ep}&layer=${layer}&precision=mixed&mlp=fp8&shared=bf16&experts=${experts}&bits=4`)
    assert.ok(html.includes('78 层 / 本 rank'))
    assert.ok(html.includes('78 层 / 全部 8 张卡'))
    assert.ok(html.includes('Payload Shape'))
    assert.ok(html.includes('初始权重分配'))
    assert.ok(html.includes('DPA 边界张量载荷'))
    assert.ok(html.includes('不能相加当作峰值显存或通信流量'))
    assert.ok(!html.includes('aria-label="DPA 权重位宽"'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    if (layer === 3) assert.ok(html.includes('FP32 · router'))
    if (layer === 3 && experts === 'w4afp8') assert.ok(html.includes('Input scale'))
    mixedChecks++
  }
  const bad = render('precision=mixed&mlp=bad&shared=bad&experts=bad')
  assert.ok(bad.includes('experts 精度无效'))
  assert.ok(render('precision=bad').includes('aria-label="DPA 权重位宽"'))
  console.log(`DPA mixed render verified: ${mixedChecks} topology/layer/format routes, scoped totals and boundary bytes.`)
  console.log(`DPA render verified: ${checks} TP/DP/layer routes and idle/uneven boundaries.`)
} finally { await server.close() }
