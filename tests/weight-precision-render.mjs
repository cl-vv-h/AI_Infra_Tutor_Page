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
  const { matrixPrecisions } = await server.ssrLoadModule('/src/lib/mixed-precision.ts')
  const render = (path, id, dpa = false) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(Routes, {}, h(Route, { path: dpa ? '/models/:modelId/dpa' : '/models/:modelId', element: h(dpa ? Dpa : Models, dpa ? { modelId: id } : {}) })))).replace(/<!--.*?-->/g, '')
  let count=0
  for(const id of ['glm-5-2','glm-5-3-flash','kimi-k3','deepseek-v4-flash','qwen3-8b','qwen3-30b-a3b']) for(const format of matrixPrecisions) {
    const html=render(`/models/${id}?view=weights&tp=4&ep=${id==='qwen3-8b'?1:4}&layer=3&precision=mixed&mlp=${id==='qwen3-30b-a3b'?'bf16':format}&shared=${id.startsWith('qwen')?'bf16':format}&experts=${id==='qwen3-8b'?'bf16':format}`,id)
    assert.doesNotMatch(html,/NaN|undefined|Infinity/)
    assert.ok(html.includes('aria-label="逐权重精度"'))
    assert.ok(html.includes('NVFP4 E2M1'))
    assert.ok(html.includes('INT8 · 对称 per-channel'))
    count++
  }
  for(const [id,dpa,node]of [['glm-5-2',false,'mla'],['qwen3-8b',false,'gqa'],['glm-5-2',true,'mla'],['qwen3-8b',true,'gqa']]) {
    const weights=[[`all/${node}/${node==='gqa'?'q_proj':'q_a_proj'}`,'int8'],['3/ffn-norm/post_attention_layernorm.weight','fp32']]
    const p=new URLSearchParams({view:'weights',layer:'3',node,tp:'4',ep:'1',dp:'2',precision:'mixed',pm:id,pw:JSON.stringify(weights)})
    const html=render(`/models/${id}${dpa?'/dpa':''}?${p}`,id,dpa)
    assert.doesNotMatch(html,/NaN|undefined|Infinity/)
    assert.ok(html.includes('逐权重合计'))
    assert.ok(html.includes('INT8 · 对称 per-channel'))
    count++
  }
  console.log(`Per-weight precision render passed: ${count} model/format/DPA routes.`)
} finally { await server.close() }
