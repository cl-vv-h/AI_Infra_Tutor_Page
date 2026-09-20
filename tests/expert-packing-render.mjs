import assert from 'node:assert/strict'
import { createServer } from 'vite'
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true } })
try {
  const { default: Workbench } = await server.ssrLoadModule('/src/components/ModelRankWorkbench.tsx')
  const { modelArchitectures } = await server.ssrLoadModule('/src/data/models.ts')
  const { availableExpertFormats } = await server.ssrLoadModule('/src/lib/expert-packing.ts')
  const { expertParallelSizes } = await server.ssrLoadModule('/src/lib/model-ranks.ts')
  const { decoderNodes } = await server.ssrLoadModule('/src/lib/model-lab.ts')
  let cases = 0
  for (const model of modelArchitectures) for (const tp of model.supportedTp) for (const ep of expertParallelSizes(model, tp)) {
    const layer = model.dimensions.layers - 1
    for (const node of decoderNodes(model, layer).filter(n => n.weights.some(w => w.routedExpert))) {
      for (const expertFormat of availableExpertFormats(model).length ? availableExpertFormats(model) : ['bf16']) {
        const props = { model, layer, nodeId: node.id, scenario: { phase: 'decode', batch: 2, sequence: 4096, tp, cacheBytes: 2 }, bits: 4, replicas: 2, rank: 2 * tp - 1, ep, expertFormat, onChange() {} }
        const html = renderToString(h(Workbench, props)).replace(/<!--.*?-->/g, '')
        assert.doesNotMatch(html, /NaN|undefined|Infinity/)
        assert.equal(html.includes('aria-label="专家权重加载布局"'), availableExpertFormats(model).length > 0)
        if (availableExpertFormats(model).length) {
          assert.ok(html.includes('统一假定位宽：4-bit'))
          assert.ok(html.includes('value="' + availableExpertFormats(model).indexOf(expertFormat) + '"'))
          assert.ok(html.includes('不替换这份理论总账'))
          assert.ok(html.includes('post-load padding/shuffle/requantization'))
          assert.ok(html.includes('Routed 专家 / 所有副本'))
          if (model.id === 'glm-5-2') assert.ok(html.includes('没有 quantization_config'))
          if (expertFormat === 'fp4-load') assert.ok(html.includes('FP32 scale（4 B）'))
          if (model.execution.denseLayers) {
            const dense = renderToString(h(Workbench, { ...props, layer: 0, nodeId: 'dense-ffn' }))
            assert.ok(!dense.includes('aria-label="专家权重加载布局"'))
          }
        }
        cases++
      }
    }
  }
  console.log(`Expert packing render passed: ${cases} model/TP/EP/format cases, Dense exclusion and unsupported-model gating.`)
} finally { await server.close() }
