import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Check, Copy, GitCompareArrows, Info } from 'lucide-react'
import { modelArchitectures } from '@/data/models'
import { attentionKind, cacheEstimate, formatBytes, localKvHeads } from '@/lib/model-lab'
import { explorerHref } from '@/lib/model-explorer'
import type { ModelArchitecture, TensorParallelSize } from '@/types/model'
import { compareEstimate, comparisonColors, comparisonParams, contextProbes, defaultComparisonScenario, memoryValue, parseComparison } from '@/lib/model-comparison'
import type { ComparisonState } from '@/lib/model-comparison'
import ModelComparisonChart from '@/components/ModelComparisonChart'

const controlClass = 'min-w-0 rounded-xl border border-white/15 bg-[#0c131c] px-3 py-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200'
const integer = (value: number) => value.toLocaleString('en-US')
const presets = [
  { label: '并行 / 顺序残差', ids: ['pythia-1-4b', 'starcoder2-3b'], sequence: 2048 },
  { label: 'GELU / SwiGLU：FFN 与 Norm', ids: ['starcoder2-3b', 'mistral-7b-v0-1'] },
  { label: 'MHA / GQA：KV 头数', ids: ['phi-3-5-mini-instruct', 'llama-3-1-8b'] },
  { label: 'GQA / MLA / Hybrid', ids: ['llama-3-1-8b', 'glm-4-7-flash', 'qwen3-5-9b'] },
  { label: 'Qwen Dense 演进', ids: ['qwen3-8b', 'qwen3-5-9b'] },
  { label: '稀疏专家架构', ids: ['deepseek-v3', 'qwen3-30b-a3b', 'qwen3-5-35b-a3b'] },
  { label: 'Mistral 滑窗 / Mixtral MoE', ids: ['mistral-7b-v0-1', 'mixtral-8x7b-v0-1'] },
  { label: '完整 / 交替 / 全滑窗', ids: ['llama-3-1-8b', 'gemma-2-9b', 'mistral-7b-v0-1'] },
]

function cacheLabel(model: ModelArchitecture) {
  if (model.execution.cache.kind === 'mixed') return `Full + Sliding GQA · W ${integer(model.execution.cache.window)}`
  if (model.execution.cache.kind === 'swa') return `Sliding GQA · W ${integer(model.execution.cache.window)}`
  return model.execution.cache.kind === 'mla' ? 'MLA · 压缩 latent' : model.execution.cache.kind === 'hybrid' ? 'Gated DeltaNet + Full Attention' : model.dimensions.attentionHeads === model.dimensions.kvHeads ? 'MHA · 每个 Q head 独立 KV' : 'GQA'
}

function cacheNote(model: ModelArchitecture, tp: TensorParallelSize) {
  const cache = model.execution.cache
  if (cache.kind === 'gqa' && cache.layout === 'replicated') return `汇集式 Attention TP：权重分片，但每卡缓存完整 ${model.dimensions.kvHeads} 个 KV heads，KV 不除以 TP。按 Transformers v4.57.1 参考路径，不代表所有引擎。`
  if (cache.kind === 'mla') return `采用 latent-cache 路径：${cache.latentWidth} 维压缩 KV + ${cache.ropeWidth} 维 RoPE 在每个 TP rank 复制。`
  if (cache.kind === 'mixed') return '按实际层分布分别计算完整 KV 和滑窗 KV。局部窗口填满后，完整注意力层继续增加缓存；总曲线不会变平。'
  if (cache.kind === 'swa') return `每卡保留 ${localKvHeads(model, tp)} 个 KV heads 的完整逻辑窗口 min(S, ${integer(cache.window)})。${tp > model.dimensions.kvHeads ? `${model.dimensions.kvHeads} 个 KV heads 少于 TP ${tp}，发生整 head 复制。` : ''}窗口饱和后只替换旧位置，不增加缓存容量。`
  const prefix = tp > model.dimensions.kvHeads ? `${model.dimensions.kvHeads} 个 KV heads 少于 TP ${tp}，每卡仍需 1 个完整 head，会发生复制。` : `完整注意力每卡存 ${localKvHeads(model, tp)} 个 KV heads。`
  return prefix + (cache.kind === 'hybrid' ? ' DeltaNet 使用定长 FP32 循环矩阵和 BF16 卷积窗口。' : '')
}

export default function ModelCompare() {
  const [params, setParams] = useSearchParams()
  const state = parseComparison(params, modelArchitectures)
  const { scenario, scope, notices } = state
  const models = state.modelIds.map((id) => modelArchitectures.find((model) => model.id === id)!)
  const results = models.map((model) => compareEstimate(model, scenario))
  const maxBytes = Math.max(1, ...results.map(({ estimate }) => estimate ? memoryValue(estimate, scope) : 0))
  const [copyState, setCopyState] = useState<{ query: string; status: 'copied' | 'failed' } | null>(null)
  const query = comparisonParams(state).toString()
  const copyStatus = copyState?.query === query ? copyState.status : null
  const factor = scope === 'group' ? scenario.tp : 1
  const sequenceOptions = [...new Set([...contextProbes, 8192, scenario.sequence, ...models.map((model) => model.execution.maxContext)])].sort((a, b) => a - b)

  useEffect(() => {
    const previous = document.title
    document.title = '模型对比台 · AI Infra Space'
    return () => { document.title = previous }
  }, [])

  function update(next: Partial<ComparisonState>) {
    setParams(comparisonParams({ ...state, ...next }), { preventScrollReset: true })
  }

  async function copyComparison() {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = `/models/compare?${query}`
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopyState({ query, status: 'copied' })
    } catch {
      setCopyState({ query, status: 'failed' })
    }
  }

  const rows: Array<{ label: string; values: string[] }> = [
    { label: '参数量 / 激活参数（标称）', values: models.map((model) => `${model.parameters} / ${model.activeParameters}`) },
    { label: 'Attention 结构', values: models.map(cacheLabel) },
    { label: 'Decoder 层数', values: models.map((model) => String(model.dimensions.layers)) },
    { label: 'Dense / MoE 层数', values: models.map((model) => `${model.execution.denseLayers} / ${model.dimensions.layers - model.execution.denseLayers}`) },
    { label: 'Hidden width', values: models.map((model) => integer(model.dimensions.hiddenSize)) },
    { label: '标准 Attention Q heads', values: models.map((model) => String(model.dimensions.attentionHeads)) },
    { label: '注意力 KV 表示', values: models.map((model) => model.execution.cache.kind === 'mla' ? `${model.execution.cache.latentWidth} latent + ${model.execution.cache.ropeWidth} RoPE` : `${model.dimensions.kvHeads} KV heads × ${model.dimensions.headDim} head dim × K/V`) },
    { label: 'KV / 循环状态层数', values: models.map((model) => { const { kvLayers, recurrentLayers } = cacheEstimate(model, defaultComparisonScenario); return `${kvLayers} / ${recurrentLayers}` }) },
    { label: '完整 / 滑窗 KV 层数', values: models.map((model) => { const { fullKvLayers, slidingLayers } = cacheEstimate(model, defaultComparisonScenario); return `${fullKvLayers} / ${slidingLayers}` }) },
    { label: 'KV 保留长度', values: models.map((model) => model.execution.cache.kind === 'mixed' ? `完整层 S / 滑窗层 min(S, ${integer(model.execution.cache.window)})` : model.execution.cache.kind === 'swa' ? `min(S, ${integer(model.execution.cache.window)})` : model.execution.cache.kind === 'hybrid' ? 'S（仅完整注意力层）' : 'S') },
    { label: '子层边界归一化', values: models.map((model) => model.execution.normKind === 'layernorm' ? '2 × LayerNorm · Pre · 每个含 scale + bias' : model.execution.normLayout === 'pre-post' ? '4 × RMSNorm · Pre + Post' : model.execution.normLayout === 'post-branch-qk' ? '2 × RMSNorm · 子层输出、残差相加前；另有 Q/K Norm' : '2 × RMSNorm · Pre') },
    { label: '残差数据依赖', values: models.map((model) => model.execution.residualLayout === 'parallel' ? '并行：Attention 与 MLP 同读 x，最后合并 x + A + M' : '顺序：先合并 Attention 残差，再进入 FFN / MoE') },
    { label: 'FFN 运算', values: models.map((model) => model.nodes.filter((node) => ['ffn', 'dense-ffn', 'moe'].includes(node.id)).map((node) => node.title).join(' / ')) },
    { label: '当前配置上下文上限', values: models.map((model) => `${integer(model.execution.maxContext)} tokens`) },
    { label: '图解已覆盖的 TP', values: models.map((model) => model.supportedTp.join(' / ')) },
  ]

  return <div className="model-lab-shell min-h-screen pb-20">
    <div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div><Link to="/models" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-100"><ArrowLeft className="h-4 w-4" />返回结构实验室</Link><h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold text-white"><GitCompareArrows className="h-7 w-7 text-cyan-200" />模型对比台</h1><p className="mt-3 text-base leading-7 text-slate-400">同一组推理条件，比较架构与缓存。不是性能榜单，也不是部署显存预算。</p></div>
        <div><button type="button" onClick={copyComparison} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">{copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}复制此对比</button><p role="status" className="mt-2 max-w-xs text-sm text-slate-400">{copyStatus === 'copied' ? '已复制模型和推理条件的链接。' : copyStatus === 'failed' ? '未能写入剪贴板，可直接复制地址栏链接。' : '模型与条件均保存在网址中。'}</p></div>
      </header>

      <section aria-label="统一对比条件" className="mt-6 rounded-3xl border border-white/10 bg-[#0b131b] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2"><span className="mr-2 text-sm text-slate-400">对比组合</span>{presets.map((preset) => <button key={preset.label} type="button" onClick={() => update({ modelIds: preset.ids, ...(preset.sequence ? { scenario: { ...scenario, sequence: preset.sequence } } : {}) })} aria-pressed={preset.ids.join(',') === state.modelIds.join(',') && (!preset.sequence || scenario.sequence === preset.sequence)} className="rounded-full border border-white/15 px-3 py-2 text-sm text-cyan-100 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-cyan-200">{preset.label}{preset.sequence ? ` · S=${integer(preset.sequence)}` : ''}</button>)}</div>
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((slot) => <label key={slot} className="flex min-w-0 flex-col gap-2 text-sm text-slate-300"><span style={{ color: comparisonColors[slot] }}>模型 {slot + 1}{slot === 2 && ' · 可选'}</span><select className={controlClass} value={state.modelIds[slot] ?? ''} onChange={(event) => { const ids = [...state.modelIds]; if (event.target.value) ids[slot] = event.target.value; else ids.splice(slot, 1); update({ modelIds: ids }) }}>{slot === 2 && <option value="">不加入第三个模型</option>}{modelArchitectures.map((model) => <option key={model.id} value={model.id} disabled={state.modelIds.includes(model.id) && state.modelIds[slot] !== model.id}>{model.name} · {model.parameters}</option>)}</select></label>)}</div>
        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm text-slate-300">并发请求 B<select className={controlClass} value={scenario.batch} onChange={(event) => update({ scenario: { ...scenario, batch: Number(event.target.value) } })}>{[...new Set([1, 2, 4, 8, 16, 32, 64, scenario.batch])].sort((a, b) => a - b).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">每请求序列 S<select className={controlClass} value={scenario.sequence} onChange={(event) => update({ scenario: { ...scenario, sequence: Number(event.target.value) } })}>{sequenceOptions.map((value) => <option key={value} value={value}>{integer(value)} tokens</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">Tensor Parallel<select className={controlClass} value={scenario.tp} onChange={(event) => update({ scenario: { ...scenario, tp: Number(event.target.value) as TensorParallelSize } })}>{[1, 2, 4, 8].map((value) => <option key={value} value={value}>TP {value}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">注意力 KV 精度<select className={controlClass} value={scenario.cacheBytes} onChange={(event) => update({ scenario: { ...scenario, cacheBytes: Number(event.target.value) as 1 | 2 } })}><option value={2}>BF16 / FP16 · 2 B</option><option value={1}>FP8 假设 · 1 B</option></select></label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">容量视图<select className={controlClass} value={scope} onChange={(event) => update({ scope: event.target.value === 'group' ? 'group' : 'rank' })}><option value="rank">每张卡 / TP rank</option><option value="group">全部 TP 卡合计</option></select></label>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">Decode 持久状态口径；S 包含刚写入的新 token。EP = 1、PP = 1，无前缀共享。B、S、TP、KV 精度对所有模型完全相同。</p>
      </section>

      {notices.length > 0 && <div role="status" className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100">{notices.join(' ')}</div>}
      <section aria-label="当前条件下的模型缓存" className={`mt-5 grid gap-4 md:grid-cols-2 ${models.length === 3 ? 'xl:grid-cols-3' : ''}`}>
        {models.map((model, index) => {
          const { estimate, reasons } = results[index]
          const parts = estimate ? [
            { label: model.execution.cache.kind === 'swa' ? '滑动窗口 KV' : '完整注意力 KV', bytes: (model.execution.cache.kind === 'mixed' ? estimate.fullKvBytes : estimate.kvBytes) * factor, color: '#70e1f5' },
            ...(model.execution.cache.kind === 'mixed' ? [{ label: '滑动窗口 KV', bytes: estimate.slidingKvBytes * factor, color: '#ffc98b' }] : []),
            { label: '循环矩阵 · FP32', bytes: estimate.recurrentBytes * factor, color: '#d8ff78' },
            { label: '卷积窗口 · BF16', bytes: estimate.convBytes * factor, color: '#c7a8ff' },
          ] : []
          return <article key={model.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c131c]">
            <div className="h-1" style={{ backgroundColor: comparisonColors[index] }} />
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-white">{model.name}</h2><p className="mt-2 text-sm text-slate-400">{cacheLabel(model)}</p>
              {estimate ? <>
                <p className="mt-5 text-sm text-slate-300">{scope === 'rank' ? '每卡' : `全部 ${scenario.tp} 卡`}持久缓存合计</p>
                <output className="mt-2 block font-mono text-3xl tracking-tight text-white">{formatBytes(memoryValue(estimate, scope))}</output>
                <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/5" aria-hidden="true">{parts.map((part) => <span key={part.label} style={{ width: `${100 * part.bytes / maxBytes}%`, backgroundColor: part.color }} />)}</div>
                <p className="mt-2 text-xs text-slate-500">各模型条形共用同一容量刻度</p>
                <dl className="mt-4 space-y-2">{parts.map((part) => <div className="flex flex-wrap justify-between gap-2 text-sm" key={part.label}><dt style={{ color: part.color }}>{part.label}</dt><dd className="font-mono text-slate-300">{formatBytes(part.bytes)}</dd></div>)}</dl>
                <p className="mt-4 text-sm leading-6 text-slate-400">{scenario.sequence >= model.execution.maxContext ? '已达配置上下文上限，未估算下一 token。' : `单请求再增 1 token 的容量增长：+${formatBytes(estimate.growthBytesPerToken * factor)}${scope === 'rank' ? ' / 卡' : ' / TP 组'}`}</p>
                <p className="mt-4 text-sm leading-6 text-slate-400">{cacheNote(model, scenario.tp)}</p>
              </> : <div className="my-5 rounded-2xl border border-amber-200/20 bg-amber-200/5 p-4"><p className="text-base font-medium text-amber-100">当前条件不计算</p>{reasons.map((reason) => <p key={reason} className="mt-2 text-sm leading-6 text-amber-100/80">{reason}</p>)}</div>}
              <div className="mt-auto flex flex-wrap gap-x-5 gap-y-3 pt-6"><Link to={estimate ? explorerHref(model.id, { scenario, layer: 0, nodeId: attentionKind(model, 0) }) : `/models/${model.id}`} className="inline-flex items-center gap-1 text-sm text-cyan-200 hover:underline">{estimate ? '携带条件查看结构图' : '打开默认结构图'}<ArrowUpRight className="h-4 w-4" /></Link><a href={model.configUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">官方配置<ArrowUpRight className="h-4 w-4" /></a></div>
            </div>
          </article>
        })}
      </section>

      <ModelComparisonChart models={models} scenario={scenario} scope={scope} onSequence={(sequence) => update({ scenario: { ...scenario, sequence } })} />

      <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0b131b]" aria-labelledby="comparison-dimensions-title">
        <div className="border-b border-white/10 p-5 sm:p-6"><h2 id="comparison-dimensions-title" className="text-xl font-semibold text-white">架构差异速查</h2><p className="mt-2 text-sm leading-6 text-slate-400">参数量采用模型标称值；配置上限不等于质量保证，扩展上下文需要单独验证。</p></div>
        <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="模型架构差异表">
          <table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="bg-white/[0.025]"><th scope="col" className="p-5 font-medium text-slate-400">对比项</th>{models.map((model, index) => <th key={model.id} scope="col" className="p-5 font-medium" style={{ color: comparisonColors[index] }}>{model.name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label} className="border-t border-white/[0.08]"><th scope="row" className="max-w-60 p-5 font-normal text-slate-400">{row.label}</th>{row.values.map((value, index) => <td key={models[index].id} className={`max-w-72 p-5 leading-6 ${new Set(row.values).size > 1 ? 'text-white' : 'text-slate-400'}`}>{value}</td>)}</tr>)}</tbody></table>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-labelledby="comparison-assumptions-title">
        <h2 id="comparison-assumptions-title" className="flex items-center gap-2 text-lg font-semibold text-white"><Info className="h-5 w-5 text-cyan-200" />如何理解这些数字</h2>
        <div className="mt-4 grid gap-5 text-sm leading-7 text-slate-400 lg:grid-cols-3">
          <p>这里只计算全部主干层的逻辑有效 token 缓存与循环状态，不含权重、激活、视觉编码器临时张量、分页填充、量化 scale、图捕获、通信缓冲及 MTP / 推测解码副本。缓存少不代表推理更快或效果更好。</p>
          <p>完整 KV 精度选项不会改变 Hybrid 的 FP32 循环矩阵和 BF16 卷积窗口。卷积采用 Transformers 的完整 4 槽窗口口径，部分引擎使用 K−1 槽。FP8 是容量假设，不表示所选模型、引擎与硬件必然支持。</p>
          <div><p>MLA 按压缩 latent 在各 TP rank 复制估算；MHA/GQA 默认按 KV head 分片，TP 大于 KV heads 时计入复制。明确采用汇集式 Attention TP 的模型保留完整 KV 副本，以模型说明为准。对比工具没有为任何单个模型偷偷调整 B、S 或 TP。</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Link to="/category/kv-cache-memory" className="text-cyan-200 hover:underline">学习 KV Cache</Link><Link to="/category/parallel-strategy" className="text-cyan-200 hover:underline">学习并行策略</Link><Link to="/learn?q=Gated%20Delta" className="text-cyan-200 hover:underline">学习 DeltaNet</Link></div></div>
        </div>
        {models.filter((model) => model.execution.contextNote).map((model) => <p key={model.id} className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-400"><span className="text-slate-200">{model.name}：</span>{model.execution.contextNote}</p>)}
      </section>
    </div>
  </div>
}
