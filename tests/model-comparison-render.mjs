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
  const { explorerHref, explorerNodes, moduleIndex, nearestModuleLayer } = await server.ssrLoadModule('/src/lib/model-explorer.ts')
  const { formatShape } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  const { formatBytes } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  const { decoderWeightBudget } = await server.ssrLoadModule('/src/lib/model-weights.ts')
  const renderExplorer = (path) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, null, h(Route, { path: '/models/:modelId', element: h(Models) })))).replace(/<!--.*?-->/g, '')
  for (const [id, layer, experts, intermediate, width] of [['glm-5-2', 3, 256, 2048, 6144], ['glm-5-3-flash', 3, 288, 2048, 4096], ['kimi-k3', 92, 896, 3072, 3584], ['deepseek-v4-flash', 0, 256, 2048, 4096]]) {
    for (const ep of [2, 4, 8]) for (const view of ['diagram', 'weights', 'cache']) {
      const node = id === 'deepseek-v4-flash' && layer < 3 ? 'hash-moe' : 'moe'
      const html = renderExplorer(`/models/${id}?layer=${layer}&node=${node}&tp=8&ep=${ep}&replicas=2&rank=15&view=${view}`)
      const expected = `[${experts / ep}, 2 × ${intermediate / (8 / ep)}, ${width}]`
      // Desktop Inspector, modal Inspector, rank panel and ledger all render the same local tensor.
      assert.ok(html.split(expected).length - 1 >= 4, `${id}/${ep}/${view}: missing shared EP shape`)
      assert.ok(html.includes(`MoE-TP = ${8 / ep}`))
      assert.ok(html.includes(`EP = ${ep}，MoE-TP = ${8 / ep}`))
      assert.ok(html.includes(`TP 8 · EP ${ep} · PP 1 · Attention DP 1 · 独立 DP 2`))
      if (id === 'kimi-k3') {
        assert.ok(html.includes(`单专家激活 [T_e, ${3072 * ep / 8}]`))
        assert.ok(html.includes('本卡 shared 激活 [4, 768]'))
      }
      assert.ok(!html.includes('本面板之外的结构图、权重账本和缓存仍是 EP=1'))
      assert.doesNotMatch(html, /NaN|undefined|Infinity/)
    }
  }
  console.log('EP state render verified: 36 model/EP/workspace routes with shared Inspector, rank and ledger shapes.')
  const glm = renderExplorer('/models/glm-5-2?layer=3&node=moe&b=4&s=4096&tp=4')
  for (const layer of [0, 11, 12, 13, 84, 91, 92]) {
    const kind = layer % 4 === 3 || layer === 92 ? 'mla' : 'kda'
    const html = renderExplorer(`/models/kimi-k3?layer=${layer}&node=attn-res-read&b=1&s=4096&tp=4&phase=prefill`)
    assert.match(html, /aria-label="Attention Residual 跨层通路"/)
    assert.match(html, /aria-label="Attention Residual 深度实验"/)
    const ids = [...html.matchAll(/id="model-node-([^"]+)"/g)].map(m => m[1])
    assert.deepEqual(ids, ['embedding', 'vision', 'attn-res-read', 'attn-res-write', 'attention-norm', kind, kind === 'kda' ? 'recurrent-state' : 'kv-cache', 'attn-res-add', 'ffn-res-read', 'ffn-norm', layer === 0 ? 'dense-ffn' : 'moe', 'ffn-res-add', 'lm-head'])
    for (const text of ['215.14 MiB', '448 MiB', '512+64=576', '当前 forward', 'FP32', 'BF16']) assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, /class="model-residual-wire"|id="model-node-hc-|NaN|undefined/)
    assert.match(html, new RegExp(`FFN 再从 ${Math.floor(layer / 12) + 2} 个候选聚合`))
  }
  const kimiComparison = render('?models=kimi-k3,glm-5-3-flash&s=4096&b=1&tp=4')
  for (const text of ['215.14 MiB', '81.97 MiB', '64 未旋转共享 K', '每 12 层写入', 'KDA + Gated MLA']) assert.ok(kimiComparison.includes(text), text)
  for (const value of ['DSA + Multi-Head Latent Attention', '312 MiB', '1.68 GiB', 'Index K', '模块知识卡', 'Top-8']) assert.ok(glm.includes(value), value)
  assert.match(glm, /<option value="moe" selected="">Sparse MoE<\/option>/)
  assert.match(glm, /id="module-knowledge-content"/)
  assert.match(renderExplorer('/models/glm-5-2?layer=3&node=lm-head'), /当前层之后还有 74 个 Decoder 层/)
  const million = renderExplorer('/models/glm-5-2?view=cache&s=1048576&b=1')
  assert.match(million, /107.25 GiB/)
  assert.doesNotMatch(million, /参数无效|NaN|undefined/)
  const glmComparison = render('?models=glm-5-2,deepseek-v3&s=1048576')
  assert.match(glmComparison, /DSA Index K/)
  assert.equal((glmComparison.match(/当前条件不计算/g) ?? []).length, 1)
  assert.match(glmComparison, /S 超过当前配置上限 163,840/)
  for (const [layer, kind] of [[0, 'window-mqa'], [2, 'csa'], [3, 'hca'], [42, 'csa']]) {
    const html = renderExplorer(`/models/deepseek-v4-flash?layer=${layer}&node=${kind}&b=1&s=4096&tp=8`)
    assert.match(html, /role="group" aria-label="mHC 四路残差通路"/)
    assert.match(html, /aria-label="mHC Attention 子层"/)
    assert.match(html, /aria-label="mHC MoE 子层"/)
    assert.doesNotMatch(html, /class="model-residual-wire"|id="model-node-(?:attention-add|ffn-add|parallel-add)"/)
    const ids = [...html.matchAll(/id="model-node-([^"]+)"/g)].map(m => m[1])
    assert.deepEqual(ids, ['embedding', 'hc-attn-pre', 'attention-norm', kind, `${kind}-cache`, 'hc-attn-post', 'hc-ffn-pre', 'ffn-norm', layer < 3 ? 'hash-moe' : 'moe', 'hc-ffn-post', 'lm-head'])
    assert.match(html, /43.89 MiB/)
    assert.match(html, /Compressor 状态 · 固定 FP32/)
    assert.match(html, /主干不是四份 KV/)
    const expected = kind === 'csa' ? ['1,024', '512'] : kind === 'hca' ? ['32', '32'] : ['0', '0']
    assert.match(html, new RegExp(`本层完整压缩历史</h3><p[^>]*>${expected[0]} 条`))
    assert.match(html, new RegExp(`当前 Decode 读取压缩条数</h3><p[^>]*>${expected[1]} 条`))
    const prefill = renderExplorer(`/models/deepseek-v4-flash?layer=${layer}&view=cache&phase=prefill&b=1&s=4096&tp=8`)
    assert.match(prefill, new RegExp(`Prefill 最后 query 读取压缩条数</h3><p[^>]*>${expected[1]} 条`))
    assert.doesNotMatch(prefill, /当前 Decode 读取压缩条数/)
    assert.match(prefill, /不是整次 Prefill 的读取总量/)
    const ffnBranch = html.split('aria-label="mHC MoE 子层"')[1].split('</section>')[0]
    assert.doesNotMatch(ffnBranch, /id="model-node-.*?-cache"/)
  }
  const compressedComparison = render('?models=deepseek-v4-flash,glm-5-2&s=4096&b=1')
  for (const text of ['43.89 MiB', '压缩 KV 历史', 'Compressor 状态 · FP32', '4 路 · mHC Pre / Post', 'K=V 共享表示']) assert.ok(compressedComparison.includes(text), text)
  for (const layer of [0, 2, 3, 44]) {
    const kind = layer % 4 === 3 ? 'mla' : 'kda'
    const html = renderExplorer(`/models/glm-5-3-flash?layer=${layer}&b=1&s=4096&tp=4`)
    const ids = [...html.matchAll(/id="model-node-([^"]+)"/g)].map(m => m[1])
    assert.deepEqual(ids, ['embedding', 'vision', 'hc-expand', 'hc-attn-pre', 'attention-norm', kind, kind === 'kda' ? 'recurrent-state' : 'kv-cache', 'hc-attn-post', 'hc-ffn-pre', 'ffn-norm', layer < 3 ? 'dense-ffn' : 'moe', 'hc-ffn-post', 'lm-head'])
    assert.ok(html.includes(`aria-label="mHC ${layer < 3 ? 'Dense FFN' : 'MoE'} 子层"`))
    for (const text of ['81.97 MiB', '11 层池化 Index K', '34 层 KDA 矩阵', '34 层 KDA 卷积', '2,048 个有效读取位置', 'Mean HC Head + Norm + LM Head']) assert.ok(html.includes(text), text)
    assert.doesNotMatch(html, /id="model-node-(?:attention-add|ffn-add)"|NaN|undefined/)
  }
  const glm53Tail = renderExplorer('/models/glm-5-3-flash?view=cache&phase=prefill&s=4095&layer=3&b=1&tp=4')
  for (const text of ['Prefill 最后 query', '2,051 个有效读取位置', '最多选 512 池', '再加 3 个尾部 token']) assert.ok(glm53Tail.includes(text), text)
  const glm53Compared = render('?models=glm-5-3-flash,glm-5-2&s=4096&b=1&tp=4')
  for (const text of ['81.97 MiB', 'KDA + NoPE DSA', '池化 DSA Index K', 'Index key / score 尾部 · BF16', '512 latent · NoPE']) assert.ok(glm53Compared.includes(text), text)
  let workspaceRoutes = 0
  for (const model of modelArchitectures) {
    for (const active of ['diagram', 'cache', 'weights']) {
      const html = renderExplorer(`/models/${model.id}?view=${active}&b=3&s=2048&tp=2&bytes=1&wbits=4&budget=0.5`)
      const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(([tag]) => tag)
      const panels = [...html.matchAll(/<div role="tabpanel"[^>]*>/g)].map(([tag]) => tag)
      assert.equal(tabs.length, 3)
      assert.equal(panels.length, 3)
      for (const view of ['diagram', 'cache', 'weights']) {
        const tab = tabs.find((tag) => tag.includes(`id="workspace-tab-${view}"`))
        const panel = panels.find((tag) => tag.includes(`id="workspace-panel-${view}"`))
        assert.ok(tab.includes(`aria-controls="workspace-panel-${view}"`))
        assert.ok(tab.includes(`aria-selected="${active === view}"`))
        assert.ok(tab.includes(`tabindex="${active === view ? 0 : -1}"`))
        assert.ok(panel.includes(`aria-labelledby="workspace-tab-${view}"`))
        assert.equal(panel.includes('hidden=""'), active !== view)
      }
      assert.ok(html.indexOf('aria-label="交互模型结构图"') < html.indexOf('id="workspace-panel-cache"'))
      assert.match(html, /B 3 · S 2,048 · 缓存 8-bit/)
      assert.match(html, /Layer 0 · 模块占用/)
      assert.match(html, /4-bit · 不含量化 scale/)
      assert.match(html, /value="0.5"/)
      assert.match(html, /<section aria-label="Decoder 权重账本"/)
      assert.match(html, /展开完整层分布/)
      assert.doesNotMatch(html, /参数无效|NaN|undefined/)
      workspaceRoutes++
    }
  }
  const legacyWorkspace = renderExplorer('/models/llama-3-1-8b?wbits=4&budget=0.5')
  assert.match(legacyWorkspace, /role="tab" id="workspace-tab-diagram"[^>]*aria-selected="true"/)
  assert.match(renderExplorer('/models/llama-3-1-8b?view=invalid'), /未知工作区，已返回结构图。/)
  console.log(`Workspace static render verified: ${workspaceRoutes} model/view routes, one visible panel, linked tabs, shared conditions and legacy graph default.`)
  for (const model of modelArchitectures) {
    for (const bits of [4, 16, 32]) {
      const layer = model.dimensions.layers - 1
      const html = renderExplorer(`/models/${model.id}?layer=${layer}&tp=4&wbits=${bits}`)
      const budget = decoderWeightBudget(model, layer, 4, bits)
      assert.ok(html.includes(`Layer ${layer} · 模块占用`))
      assert.ok(html.includes(`${formatBytes(budget.bytes)} / 卡`))
      assert.ok(html.includes(formatBytes(budget.allLayersBytes)))
      assert.ok(html.includes('非整卡显存'))
      assert.ok(html.includes('统计边界与公式'))
      assert.equal((html.match(/data-weight-module=/g) ?? []).length, budget.rows.length)
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
      const resolved = explorerNodes(model, layer).find(node => node.id === target.node.id)
      assert.ok(resolved)
      assert.ok(html.includes(formatShape(resolved.outputShape, model, scenario)), `${model.id} Layer ${layer} ${target.node.id}`)
      assert.equal([...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].filter((match) => match[1] === target.node.title).length, 2)
      assert.doesNotMatch(html, /参数无效|NaN|undefined/)
      restoredModules++
    }
  }
  const unknownModel = renderExplorer('/models/not-a-real-model?b=999')
  const pythia = renderExplorer('/models/pythia-1-4b?layer=23&node=parallel-add&tp=4&b=4&s=2048')
  for (const text of ['并行残差：同源分叉与三路汇合', '分支 A：x → LN₁ → Attention', '分支 M：x → LN₂ → MLP', 'x 另行保留', 'Parallel Residual Add', '[4, 2048] + [4, 2048] + [4, 2048]', '384 MiB', 'Fused QKV · Partial RoPE', 'Final LayerNorm + Untied LM Head']) assert.ok(pythia.includes(text), text)
  const branchA = pythia.slice(pythia.indexOf('data-parallel-branch="attention"'), pythia.indexOf('data-parallel-branch="mlp"'))
  const branchM = pythia.slice(pythia.indexOf('data-parallel-branch="mlp"'), pythia.indexOf('id="model-node-parallel-add"'))
  for (const id of ['attention-norm', 'mha', 'kv-cache']) assert.ok(branchA.includes(`id="model-node-${id}"`))
  for (const id of ['ffn-norm', 'ffn']) assert.ok(branchM.includes(`id="model-node-${id}"`))
  assert.doesNotMatch(branchA, /id="model-node-ffn/)
  assert.doesNotMatch(branchM, /id="model-node-(?:mha|kv-cache|attention-norm)/)
  assert.match(pythia, /id="model-node-parallel-add"[^>]*aria-pressed="true"/)
  assert.doesNotMatch(pythia, /id="model-node-(?:attention-add|ffn-add)"|class="model-residual-wire"|NaN|undefined|参数无效/)
  assert.equal((pythia.match(/id="model-node-kv-cache"/g) ?? []).length, 1)
  const pythiaCompared = render('?models=pythia-1-4b,starcoder2-3b&s=2048&tp=4')
  for (const text of ['残差数据依赖', '并行：Attention 与 MLP 同读 x', '顺序：先合并 Attention 残差', 'S=2,048', '384 MiB', '120 MiB']) assert.ok(pythiaCompared.includes(text), text)
  assert.doesNotMatch(pythiaCompared, /当前条件不计算/)
  assert.match(render('?models=pythia-1-4b,starcoder2-3b&s=4096'), /S 超过当前配置上限 2,048/)
  const starcoder = renderExplorer('/models/starcoder2-3b?layer=29&node=ffn-norm&tp=4&b=4&s=8192')
  for (const text of ['Post-Attention LayerNorm', 'post_attention_layernorm.bias', 'GELU MLP · Two Linear Layers', 'c_fc.bias', '240 MiB', '[4, 4096, 2, 1, 128]', '16,384', 'Final LayerNorm + Tied LM Head']) assert.ok(starcoder.includes(text), text)
  assert.match(starcoder, /id="model-node-ffn-norm"[^>]*aria-pressed="true"/)
  assert.doesNotMatch(starcoder, /Post-Attention RMSNorm|参数无效/)
  const starcoderComparison = render('?models=starcoder2-3b,mistral-7b-v0-1&tp=4&b=4&s=8192')
  for (const text of ['2 × LayerNorm · Pre · 每个含 scale + bias', '2 × RMSNorm · Pre', 'FFN 运算', 'GELU MLP · Two Linear Layers', 'Dense SwiGLU', '发生整 head 复制']) assert.ok(starcoderComparison.includes(text), text)
  assert.match(renderExplorer('/models/starcoder2-3b?s=32768'), /s 参数无效/)
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
