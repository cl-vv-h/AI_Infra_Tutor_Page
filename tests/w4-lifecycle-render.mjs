import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter, Routes, Route } = await server.ssrLoadModule('react-router-dom')
  const { default: Models } = await server.ssrLoadModule('/src/pages/Models.tsx')
  const { default: Dpa } = await server.ssrLoadModule('/src/pages/DpaLab.tsx')
  const { getModelArchitecture } = await server.ssrLoadModule('/src/data/models.ts')
  const { decoderNodes } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  const { formatWeight } = await server.ssrLoadModule('/src/lib/model-weights.ts')
  const { mixedWeightStorage } = await server.ssrLoadModule('/src/lib/mixed-precision.ts')
  const render = path => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, {},
    h(Route, { path: '/models/glm-5-2/dpa', element: h(Dpa) }),
    h(Route, { path: '/models/:modelId', element: h(Models) }),
  ))).replace(/<!--.*?-->/g, '')
  let checks = 0
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) for (const experts of ['bf16', 'fp8', 'mxfp4', 'w4afp8']) for (const stage of ['allocated', 'processed']) {
    const html = render(`/models/qwen3-30b-a3b?view=weights&node=moe&tp=${tp}&ep=${ep}&replicas=2&rank=${tp * 2 - 1}&precision=mixed&experts=${experts}&w4stage=${stage}`)
    const invalid = tp / ep > 2 && ['fp8', 'w4afp8'].includes(experts)
    assert.ok(html.includes('aria-label="Routed MoE 精度"'))
    assert.ok(!html.includes('aria-label="Dense MLP 精度"'))
    assert.ok(!html.includes('aria-label="Shared MLP 精度"'))
    assert.ok(html.includes('官方配置与 SGLang 普通 Router 是 BF16'))
    assert.ok(html.includes('无 Dense/Shared MLP 或 correction bias'))
    assert.ok(html.includes('格式对齐与加载边界'))
    assert.ok(html.includes(`[${128 / ep}, 2 × ${768 / (tp / ep)}, 2048]`))
    assert.equal(html.includes('已恢复 routed BF16'), invalid)
    assert.equal(html.includes('aria-label="W4A8 权重阶段"'), experts === 'w4afp8' && !invalid)
    assert.ok(html.includes('Router FP32'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  for (const tp of [1, 2, 4, 8]) for (const mlp of ['bf16', 'fp8']) {
    const html = render(`/models/qwen3-8b?view=weights&node=ffn&tp=${tp}&replicas=2&precision=mixed&mlp=${mlp}&experts=w4afp8&w4stage=processed`)
    assert.ok(html.includes('aria-label="Dense MLP 精度"'))
    assert.ok(!html.includes('aria-label="Routed MoE 精度"'))
    assert.ok(!html.includes('aria-label="Shared MLP 精度"'))
    assert.ok(!html.includes('aria-label="W4A8 权重阶段"'))
    assert.ok(html.includes('aria-label="Qwen3 Dense 融合布局"'))
    assert.ok(html.includes(`gate_up_proj [${24576 / tp}, 4096]`))
    if (mlp === 'fp8') assert.ok(html.includes(`Weight scale [${192 / tp}, 32] · FP32`))
    assert.ok(html.includes('post_attention_layernorm.weight'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  for (const id of ['glm-5-2', 'glm-5-3-flash', 'kimi-k3', 'deepseek-v4-flash']) for (const tp of [1, 8]) for (const ep of [...new Set([1, tp])]) for (const stage of ['allocated', 'processed']) {
    const html = render(`/models/${id}?view=weights&layer=3&node=moe&tp=${tp}&ep=${ep}&precision=mixed&experts=w4afp8&w4stage=${stage}`)
    const model = getModelArchitecture(id)
    const weight = decoderNodes(model, 3).find(n => n.id === 'moe').weights.find(w => w.routedExpert && w.name.includes('gate_up'))
    const formatted = formatWeight(weight, model, { phase: 'decode', batch: 1, sequence: 4096, tp, cacheBytes: 2 }, ep)
    const storage = mixedWeightStorage(formatted, 'moe', { mlp: 'bf16', shared: 'bf16', experts: 'w4afp8', ...(stage === 'processed' ? { w4Stage: stage } : {}) })
    assert.ok(html.includes(`<option value="${stage}" selected="">`))
    assert.ok(html.includes(`Weight scale [${storage.scaleShape.join(', ')}] · ${storage.scaleDtype}`))
    assert.ok(html.includes(`Input scale [${storage.inputScaleShape.join(', ')}] · ${storage.inputScaleDtype}`))
    assert.ok(html.includes('7 个独立分配，4 个别名不重复计数'))
    assert.ok(html.includes('不是每个 gate/up、down 各算一套'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  for (const dp of [1, 4]) for (const ep of [1, 4, 8]) for (const layer of [0, 3]) {
    const html = render(`/models/glm-5-2/dpa?tp=8&dp=${dp}&ep=${ep}&layer=${layer}&precision=mixed&experts=w4afp8&w4stage=processed`)
    assert.ok(html.includes('W4A8 已按后处理布局统计'))
    assert.equal(html.includes('aria-label="W4A8 独立运行元数据"'), layer === 3)
    if (layer === 3) assert.ok(html.includes('Input scale [1] · FP32 · 4 B'))
    assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    checks++
  }
  const inactive = render('/models/glm-5-2?view=weights&layer=3&node=moe&precision=mixed&experts=fp8&w4stage=processed')
  assert.ok(!inactive.includes('aria-label="W4A8 权重阶段"'))
  assert.ok(!inactive.includes('aria-label="W4A8 独立运行元数据"'))
  console.log(`W4 lifecycle render passed: ${checks} explorer/DPA layouts, exact scale dtypes, metadata aliases and inactive-format gating.`)
} finally { await server.close() }
