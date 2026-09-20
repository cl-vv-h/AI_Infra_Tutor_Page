import { useEffect, useRef, useState } from 'react'
import ModelSectionNav from '@/components/ModelSectionNav'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, BookOpen, Box, Braces, Check, Copy, Database, GitCompareArrows, Layers3, MousePointer2, X } from 'lucide-react'
import { modelArchitectures } from '@/data/models'
import { attentionKind, decoderGroups, formatShape, layerCacheNode, tokenCount } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'
import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import { CacheWorkbench } from '@/components/CacheWorkbench'
import { ModelLayerMap } from '@/components/ModelLayerMap'
import { comparisonHref } from '@/lib/model-comparison'
import { explorerHref, explorerParams, parseExplorer, selectExplorerLayer, selectExplorerNode } from '@/lib/model-explorer'
import type { ExplorerState } from '@/lib/model-explorer'
import ModelModuleFinder from '@/components/ModelModuleFinder'
import ModelWeightBudget from '@/components/ModelWeightBudget'
import ModelRankWorkbench from '@/components/ModelRankWorkbench'
import CacheCapacityPlanner from '@/components/CacheCapacityPlanner'
import ModelWorkspaceTabs from '@/components/ModelWorkspaceTabs'
import ModelLearningGuide from '@/components/ModelLearningGuide'
import AttentionResidualWorkbench from '@/components/AttentionResidualWorkbench'
import KimiLatentMoeFlow from '@/components/KimiLatentMoeFlow'
import { formatWeight } from '@/lib/model-weights'
import type { TensorParallelSize } from '@/types/model'
import MixedPrecisionControls from '@/components/MixedPrecisionControls'
import KimiWeightAudit from '@/components/KimiWeightAudit'
import { supportsMixedPrecision } from '@/lib/mixed-precision'
import QwenDenseLayout from '@/components/QwenDenseLayout'
import { sortCatalog } from '@/lib/model-popularity'

const modelChoices = sortCatalog(modelArchitectures)

function Inspector({ node, model, scenario, ep = 1, preview = false }: { node: ArchitectureNode; model: ModelArchitecture; scenario: InferenceScenario; ep?: TensorParallelSize; preview?: boolean }) {
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c131c]">
    <div className="border-b border-white/[0.08] p-5">
      <div className="flex items-center justify-between font-mono text-xs tracking-widest text-cyan-200/70">INSPECTOR <Box className="h-4 w-4" /></div>
      <p className="mt-3 text-sm text-white/60">{preview ? '临时预览 · 点击模块可锁定' : '已选模块 · 可复制当前图解链接'}</p>
      <h2 className="mt-4 text-xl font-semibold text-white">{node.title}</h2>
      <p className="mt-2 text-sm text-white/60">{node.subtitle}</p>
      <p className="mt-4 text-base leading-7 text-slate-300">{node.description}</p>
      {node.phaseNotes && <p className="mt-4 rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-3 text-sm leading-6 text-cyan-100"><span className="mr-2 font-mono uppercase">{scenario.phase}</span>{node.phaseNotes[scenario.phase]}</p>}
    </div>
    <div className="grid grid-cols-2 gap-px bg-white/[0.08]">
      {[['INPUT', node.inputShape], ['OUTPUT', node.outputShape]].map(([label, value]) => <div key={label} className="bg-[#0c131c] p-4">
        <div className="font-mono text-xs text-white/50">{label}</div>
        <div className="mt-2 break-words font-mono text-sm text-cyan-100">{formatShape(value, model, scenario)}</div>
      </div>)}
    </div>
    <div className="p-5">
      {node.tensors && <div className="mb-5 space-y-3"><h3 className="text-xs tracking-wider text-white/60">INTERMEDIATE TENSORS</h3>{node.tensors.map((tensor) => <div key={tensor.label} className="border-l border-lime-200/40 pl-3"><p className="text-sm text-white/70">{tensor.label}</p><p className="mt-1 break-words font-mono text-sm text-lime-100">{formatShape(tensor.shape, model, scenario)}</p>{tensor.note && <p className="mt-1 text-xs text-white/55">{tensor.note}</p>}</div>)}</div>}
      <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/60"><Layers3 className="h-4 w-4" /> WEIGHTS</div>
      <p className="mt-2 text-xs leading-5 text-white/50">二维 Linear 按 [OUT, IN]；向量、专家堆叠与卷积按各自逻辑布局。TP local 为每卡分片，其余为完整或复制权重。融合布局为等价示意。</p>
      <div className="mt-4 space-y-3">
        {node.weights.map((weight) => formatWeight(weight, model, scenario, ep)).map((weight) => <div key={weight.name} className="rounded-xl border border-white/10 bg-black/15 p-3">
          <div className="break-words text-sm text-white/75">{weight.name}</div>
          <div className="mt-2 break-words font-mono text-sm text-cyan-100">{weight.shape}</div>
          {weight.multiplicity && <p className="mt-2 text-sm text-violet-100">本行包含 {weight.multiplicity} 份同 Shape 权重。</p>}
          {weight.note && <p className="mt-2 text-xs leading-5 text-white/55">{weight.note}</p>}
        </div>)}
        {!node.weights.length && <p className="text-sm leading-6 text-white/60">{node.weightlessNote ?? '这是运行时缓存，没有可训练权重。Shape 表示逻辑有效 token，不含分页填充。'}</p>}
      </div>
      <div className="mt-6 flex items-center gap-2 font-mono text-xs tracking-wider text-white/60"><BookOpen className="h-4 w-4" /> KNOWLEDGE INDEX</div>
      <div className="mt-3 flex flex-wrap gap-2">{node.knowledge.map((link) => <Link key={link.to + link.label} to={link.to} className="rounded-full border border-white/15 px-3 py-2 text-sm text-white/75 transition hover:border-cyan-200/50 hover:text-cyan-100">{link.label}</Link>)}</div>
    </div>
  </div>
}

export default function Models() {
  const { modelId } = useParams()
  const model = modelId ? modelArchitectures.find((item) => item.id === modelId) : modelArchitectures[0]
  if (!model) return <main className="model-lab-shell min-h-screen px-5 py-12 text-white"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold">未找到这个模型图解</h1><p className="mt-4 text-base text-white/65">链接中的模型尚未收录。请选择一个现有模型，不会用其他模型的 Shape 代替它。</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{modelArchitectures.map((item) => <Link key={item.id} to={`/models/${item.id}`} className="rounded-xl border border-white/15 p-4 text-cyan-100 hover:bg-white/5">{item.name}<ArrowUpRight className="ml-2 inline h-4 w-4" /></Link>)}</div></div></main>
  return <ModelExplorer key={model.id} model={model} />
}

function ModelExplorer({ model }: { model: ModelArchitecture }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { state, notices, nodes: visibleNodes } = parseExplorer(params, model)
  const { layer: effectiveLayer, scenario } = state
  const { phase, tp: effectiveTp } = scenario
  const view = state.view ?? 'diagram'
  const canonical = explorerHref(model.id, state)
  const [hovered, setHovered] = useState<{ id: string; context: string } | null>(null)
  const hoveredId = hovered?.context === canonical ? hovered.id : null
  const setHoveredId = (id: string | null) => setHovered(id ? { id, context: canonical } : null)
  const [pendingLocate, setPendingLocate] = useState<{ id: string; layer: number } | null>(null)
  const [copyState, setCopyState] = useState<{ path: string; status: 'copied' | 'failed'; url: string } | null>(null)
  const copyStatus = copyState?.path === canonical ? copyState.status : null
  const dialog = useRef<HTMLDialogElement>(null)
  const groups = decoderGroups(model, effectiveLayer)
  const embedding = model.nodes.find((node) => node.id === 'embedding')!
  const head = model.nodes.find((node) => node.id === 'lm-head')!
  const cache = layerCacheNode(model, effectiveLayer)
  const vision = model.nodes.find((node) => node.id === 'vision')
  const selected = visibleNodes.find((node) => node.id === state.nodeId)!
  const inspected = visibleNodes.find((node) => node.id === hoveredId) ?? selected
  const isDense = effectiveLayer < model.execution.denseLayers
  const parallelResidual = model.execution.residualLayout === 'parallel'
  const mhcResidual = model.execution.residualLayout === 'mhc'

  useEffect(() => {
    if (!pendingLocate || pendingLocate.id !== state.nodeId || pendingLocate.layer !== effectiveLayer) return
    if (!dialog.current?.open) {
      const target = document.getElementById(`model-node-${pendingLocate.id}`)
      target?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      target?.focus({ preventScroll: true })
    }
    setPendingLocate(null)
  }, [pendingLocate, state.nodeId, effectiveLayer])

  function update(next: Partial<ExplorerState>, replace = false) {
    const nextParams = explorerParams({ ...state, ...next })
    if (nextParams.toString() !== params.toString()) setParams(nextParams, { replace, preventScrollReset: true })
    setHoveredId(null)
  }
  function updateScenario(next: Partial<InferenceScenario>) { update({ scenario: { ...scenario, ...next } }) }
  function changeLayer(layer: number, replace = false) { update(selectExplorerLayer(model, state, layer), replace) }
  function inspect(node: ArchitectureNode, layer = effectiveLayer, locate = false) {
    update(selectExplorerNode(state, node.id, layer))
    if (locate) setPendingLocate({ id: node.id, layer })
    if (window.matchMedia('(max-width: 1279px)').matches && !dialog.current?.open) dialog.current?.showModal()
  }
  async function copyExplorer() {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = canonical
    try { await navigator.clipboard.writeText(url.toString()); setCopyState({ path: canonical, status: 'copied', url: url.toString() }) }
    catch { setCopyState({ path: canonical, status: 'failed', url: url.toString() }) }
  }

  function nodeButton(node: ArchitectureNode) {
    return <button id={`model-node-${node.id}`} type="button" aria-pressed={selected.id === node.id} onClick={() => inspect(node)}
      onMouseEnter={() => setHoveredId(node.id)} onMouseLeave={() => setHoveredId(null)}
      onFocus={() => setHoveredId(node.id)} onBlur={() => setHoveredId(null)}
      className={`model-node model-node--${node.tone} ${selected.id === node.id ? 'is-selected' : ''}`}>
      <span className="font-mono text-xs tracking-widest text-white/50">{node.eyebrow}</span>
      <span className="mt-2 block text-base font-semibold text-white">{node.title}</span>
      <span className="mt-1 block text-sm text-white/60">{node.subtitle}</span>
      <span className="mt-3 block break-words font-mono text-xs text-cyan-100/80">{formatShape(node.outputShape, model, scenario)}</span>
    </button>
  }

  function cacheButton() {
    return <button id={`model-node-${cache.id}`} type="button" aria-pressed={selected.id === cache.id} onClick={() => inspect(cache)} onMouseEnter={() => setHoveredId(cache.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(cache.id)} onBlur={() => setHoveredId(null)} className={`mx-auto mt-3 flex w-full max-w-[25rem] items-center gap-3 rounded-xl border p-3 text-left transition ${selected.id === cache.id ? 'border-lime-200/70 bg-lime-200/10' : 'border-lime-200/25 bg-[#0b1514] hover:border-lime-200/60'}`}>
      <Database className="h-5 w-5 shrink-0 text-lime-200" /><span className="min-w-0"><span className="block text-sm font-semibold text-lime-100">↔ {cache.title}</span><span className="mt-1 block break-words font-mono text-xs text-white/65">{formatShape(cache.outputShape, model, scenario)}</span></span>
    </button>
  }

  const flowLine = <div className="model-flow-line" aria-hidden="true"><span /></div>
  return <div className="model-lab-shell min-h-screen pb-20">
    <header className="border-b border-white/[0.08] bg-[#070b10]/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-5 py-7 sm:px-8 lg:px-10">
        <div><div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-cyan-200/70"><Braces className="h-4 w-4" /> MODEL ARCHITECTURE LAB</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{model.name} · 结构实验室</h1><Link to="/models" className="mt-3 inline-block text-sm text-cyan-100 hover:underline">← 浏览全部模型图解</Link></div>
        <div className="flex flex-wrap items-center gap-4"><p className="flex items-center gap-2 text-sm text-white/60"><MousePointer2 className="h-4 w-4 text-cyan-200" /> 结构 · 张量 · 存储</p><Link to={comparisonHref(model.id, scenario)} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/5 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-200/10"><GitCompareArrows className="h-4 w-4" />对比当前模型</Link></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
      <ModelSectionNav />
      <section className="rounded-3xl border border-white/10 bg-[#0b1119]/90 p-3" aria-label="模型与推理配置">
        <div className="flex flex-wrap items-end gap-3 p-1" aria-label="选择模型">
          <label className="flex w-full min-w-0 flex-col gap-2 text-sm text-white/65 sm:w-80">切换模型
            <select aria-label="切换模型" value={model.id} onChange={(event) => {
              const item = modelChoices.find(item => item.id === event.target.value)
              if (item && item.id !== model.id) navigate(explorerHref(item.id, { ...state, layer: 0, nodeId: attentionKind(item, 0) }))
            }} className="min-w-0 rounded-xl border border-white/15 bg-[#0b131c] px-3 py-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              {modelChoices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <p className="pb-2 text-xs leading-5 text-white/50">按 HF 近月下载快照排序 · <Link to="/models" className="text-cyan-100 hover:underline">查看全部模型与排序依据</Link><br />切换后从第 0 层开始，保留目标模型支持的推理配置。</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <div className="flex rounded-xl bg-black/20 p-1" aria-label="推理阶段">{(['prefill', 'decode'] as const).map((item) => <button key={item} type="button" aria-pressed={phase === item} onClick={() => updateScenario({ phase: item })} className={`rounded-lg px-4 py-2 text-sm uppercase ${phase === item ? 'bg-white/10 text-white' : 'text-white/60'}`}>{item}</button>)}</div>
          <div className="flex items-center gap-1" aria-label="Tensor Parallel 大小"><span className="px-2 font-mono text-sm text-white/60">TP</span>{model.supportedTp.map((size) => <button key={size} type="button" aria-label={`TP ${size}`} aria-pressed={effectiveTp === size} onClick={() => updateScenario({ tp: size })} className={`h-10 w-10 rounded-xl text-sm ${effectiveTp === size ? 'bg-cyan-200 text-[#071014]' : 'text-white/65 hover:bg-white/10'}`}>{size}</button>)}</div>
          <label className="ml-auto flex items-center gap-3 text-sm text-white/70">Layer
            <input aria-label="查看 Decoder 层号" type="range" min={0} max={model.dimensions.layers - 1} value={effectiveLayer} onChange={(e) => changeLayer(Number(e.target.value), true)} className="w-32 accent-cyan-200 sm:w-44" />
            <output className="w-16 font-mono text-white">{effectiveLayer} / {model.dimensions.layers - 1}</output>
          </label>
        </div>
      </section>

      {notices.length > 0 && <p role="status" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100">{notices.join(' ')}</p>}
      <ModelWorkspaceTabs view={view} onSelect={(view) => update({ view })} />
      {model.id === 'glm-5-2' && <Link to="/models/glm-5-2/dpa" className="mt-4 block rounded-xl border border-violet-200/25 bg-violet-200/5 p-4 text-sm leading-6 text-violet-100 hover:border-violet-200/60">打开 GLM-5.2 DP Attention 实验 → 对照 Attention / MoE 两种分组、负载不均、补齐及每 rank 权重（独立实验条件）</Link>}
      {model.id === 'qwen3-8b' && <Link to="/models/qwen3-8b/dpa" className="mt-4 block rounded-xl border border-violet-200/25 bg-violet-200/5 p-4 text-sm leading-6 text-violet-100 hover:border-violet-200/60">打开 Qwen3-8B DP Attention 实验 → GQA 权重与 KV head 分片、Dense 总 TP、负载不均（独立实验条件）</Link>}
      <div aria-label="当前并行配置" className="mt-4 rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-6 text-cyan-100">
        TP {effectiveTp} · EP {state.ep ?? 1} · MoE-TP {effectiveTp / (state.ep ?? 1)} · 独立 DP {state.replicas ?? 1} · 教学 Rank {state.rank ?? 0} · 权重 {state.mixed ? '模块混合精度' : `${state.weightBits ?? 16}-bit`}
        <button type="button" onClick={() => { update({ view: 'weights' }); document.getElementById('workspace-tab-weights')?.focus() }} className="ml-3 min-h-10 underline underline-offset-4">调整并行与权重</button>
        <p className="mt-1 text-xs text-white/60">同一配置贯通三工作区；PP=1、无 DPA，MoE A2A=none。模型对比页另有独立的 EP=1 条件，不沿用当前 EP。</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b1119] p-4">
        <div><p className="text-sm text-white/70">已选 <span className="font-mono text-cyan-100">Layer {effectiveLayer}</span> · {selected.title}</p><button type="button" onClick={() => { update({ view: 'cache' }); document.getElementById('workspace-tab-cache')?.focus() }} className="mt-2 text-left text-sm text-white/65 underline decoration-white/25 underline-offset-4 hover:text-cyan-100">B {scenario.batch} · S {scenario.sequence.toLocaleString('en-US')} · 缓存 {scenario.cacheBytes * 8}-bit · 调整条件</button></div>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => inspect(selected, effectiveLayer, true)} className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-cyan-100 hover:bg-white/5">查看已选模块</button><button type="button" onClick={copyExplorer} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 px-3 py-2.5 text-sm text-cyan-100 hover:bg-white/5">{copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}复制当前图解</button></div>
        <p role="status" className={copyStatus ? 'w-full text-sm text-white/55' : 'sr-only'}>{copyStatus === 'copied' ? '已复制当前模型与实验参数。' : copyStatus === 'failed' ? '无法自动复制，请选择下方链接手动复制。' : ''}</p>
        {copyStatus === 'failed' && <input readOnly aria-label="手动复制图解链接" value={copyState?.url ?? ''} onFocus={(event) => event.target.select()} className="w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" />}
      </div>

      <div role="tabpanel" id="workspace-panel-diagram" aria-labelledby="workspace-tab-diagram" tabIndex={0} hidden={view !== 'diagram'} className="focus-visible:outline-cyan-200">
      <ModelLearningGuide model={model} layer={effectiveLayer} selectedId={selected.id} scenario={scenario} onSelect={(node) => update(selectExplorerNode(state, node.id))} />
      <ModelModuleFinder model={model} layer={effectiveLayer} selectedId={selected.id} onSelect={(node, layer) => inspect(node, layer, true)} />
      <section aria-label="交互模型结构图" className="mt-5 grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <aside className="order-2 space-y-4 xl:order-1">
          <div className="rounded-3xl border border-white/10 bg-[#0b1119]/80 p-5">
            <div className="font-mono text-xs tracking-widest text-white/50">MODEL CARD</div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{model.name}</h2>
            <p className="mt-2 text-sm text-white/60">{model.organization} · {model.parameters}<br />{model.activeParameters} active</p>
            <p className="mt-4 text-base leading-7 text-slate-300">{model.description}</p>
            <a href={model.configUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">{model.configLabel}<ArrowUpRight className="h-4 w-4" /></a>
            {model.implementationUrl && <a href={model.implementationUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">参考实现与权重定义<ArrowUpRight className="h-4 w-4" /></a>}
          </div>
          <div className="grid grid-cols-2 gap-2">{model.metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="font-mono text-xs text-white/50">{metric.label}</div><div className="mt-2 text-sm font-semibold text-white/90">{metric.value}</div></div>)}</div>
          <p className="px-2 text-sm leading-6 text-white/60">图中展开第 {effectiveLayer} 层，其余层折叠。标准自回归主干，不包含 MTP 辅助预测分支。EP = {state.ep ?? 1}，MoE-TP = {effectiveTp / (state.ep ?? 1)}，PP = 1。模块边界为归约后的逻辑 Shape；专家分片见模块详情与权重清单。</p>
          <details className="rounded-2xl border border-white/10 bg-[#0b1119] p-4"><summary className="cursor-pointer text-base text-cyan-100">展开完整层分布</summary><ModelLayerMap model={model} selectedLayer={effectiveLayer} onSelect={(value) => changeLayer(value)} /></details>
        </aside>

        <div className="model-canvas order-1 min-w-0 rounded-3xl border border-white/10 bg-[#080d13] p-4 sm:p-6 xl:order-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60"><span>{phase === 'prefill' ? 'Prefill · 无前缀缓存，处理完整输入' : 'Decode · 每请求新增 1 token'}</span><span className="font-mono text-cyan-200">N = {tokenCount(scenario).toLocaleString('en-US')}</span></div>
          {vision ? <><div className="grid gap-3 sm:grid-cols-2">{nodeButton(embedding)}{nodeButton(vision)}</div><div className="mx-auto mt-3 max-w-[25rem] rounded-xl border border-white/15 p-3 text-center text-sm text-white/70">↓ 视觉输出替换对应占位 embedding ↓<br /><span className="font-mono text-xs text-cyan-100">{formatShape('[N, ' + model.dimensions.hiddenSize + ']', model, scenario)}</span></div></> : nodeButton(embedding)}{flowLine}
          {model.nodes.find(node => node.id === 'hc-expand') && <>{nodeButton(model.nodes.find(node => node.id === 'hc-expand')!)}{flowLine}</>}
          {effectiveLayer > 0 && <><div className="model-folded-layers">前 {effectiveLayer} 层 Decoder</div>{flowLine}</>}
          <div className="rounded-2xl border border-dashed border-cyan-200/25 px-3 py-4 sm:px-6">
            <div className="mb-5 flex flex-wrap justify-between gap-2 font-mono text-xs text-cyan-100/80"><span>DECODER LAYER {effectiveLayer}</span><span className="text-violet-200">{isDense ? 'DENSE FFN' : 'SPARSE MoE'}</span></div>
            {parallelResidual ? <div role="group" aria-label="并行残差：同源分叉与三路汇合">
              <div className="rounded-xl border border-amber-200/30 bg-amber-200/5 p-3 text-center text-sm leading-6 text-amber-100">同一层输入 x · 两路独立读取<br /><span className="font-mono">{formatShape('[N, ' + model.dimensions.hiddenSize + ']', model, scenario)}</span><br />x 另行保留，直接送到最后的加法节点</div>
              <div className="model-parallel-branches mt-4 grid gap-4">
                {groups.map((group, branch) => <div key={branch} data-parallel-branch={branch === 0 ? 'attention' : 'mlp'} className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-black/10 p-3">
                  <h3 className={`mb-4 text-center text-sm font-medium ${branch === 0 ? 'text-cyan-100' : 'text-violet-100'}`}>{branch === 0 ? '分支 A：x → LN₁ → Attention' : '分支 M：x → LN₂ → MLP'}</h3>
                  {group.map((node, index) => <div key={node.id}>{nodeButton(node)}{index < group.length - 1 && flowLine}{['mla', 'gqa', 'mha', 'gdn', 'swa'].includes(node.id) && cacheButton()}</div>)}
                  <p className="mt-auto pt-4 text-center font-mono text-sm text-white/65">{branch === 0 ? 'A → 共同汇合' : 'M → 共同汇合'}</p>
                </div>)}
              </div>
              {flowLine}{nodeButton(visibleNodes.find((node) => node.id === 'parallel-add')!)}
              <p className="mt-4 text-sm leading-6 text-white/60">两支之间没有 Attention → MLP 的数据边。上下或并排排列都表示同源分支；实际是否同时执行取决于运行时，不是吞吐或速度承诺。</p>
            </div> : mhcResidual ? <div role="group" aria-label="mHC 四路残差通路" className="space-y-5">
              <div className="grid grid-cols-4 gap-2" aria-label="四路 residual streams">{[0, 1, 2, 3].map(stream => <div key={stream} className="rounded-xl border border-rose-200/30 bg-rose-200/5 px-2 py-3 text-center font-mono text-xs text-rose-100">Stream {stream}<br />{model.dimensions.hiddenSize}</div>)}</div>
              {groups.map((group, branch) => <section key={branch} aria-label={`mHC ${branch === 0 ? 'Attention' : isDense ? 'Dense FFN' : 'MoE'} 子层`} className="rounded-2xl border border-rose-200/20 p-3">
                <h3 className="mb-3 text-sm font-medium text-rose-100">{branch === 0 ? 'Attention' : isDense ? 'Dense FFN' : 'MoE'}：四路输入 → Pre → 单路计算 → Post → 四路输出</h3>
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                  <div className="min-w-0">{group.map((node, index) => <div key={node.id}>{nodeButton(node)}{node.id === attentionKind(model, effectiveLayer) && cacheButton()}{index < group.length - 1 && flowLine}</div>)}</div>
                  <aside className="self-stretch rounded-xl border border-dashed border-rose-200/35 bg-rose-200/5 p-2 text-center text-xs leading-6 text-rose-100">保留本子层四路 residual<br />↓<br />Pre 产生 post / Hres<br />↓<br />绕过单路子层计算<br />↓<br />送入对应 Post 混合</aside>
                </div>
              </section>)}
              <p className="text-sm leading-6 text-white/65">四路是 residual stream 轴，不是 TP rank，也不是四个 Attention heads。每个子层只计算一次；Attention 的 Post 输出是 FFN 的 Pre 输入。</p>
            </div> : model.execution.residualLayout === 'attn-res' ? <div role="group" aria-label="Attention Residual 跨层通路">
              <AttentionResidualWorkbench model={model} layer={effectiveLayer} scenario={scenario} onLayer={changeLayer} />
              {groups.map((group, branch) => <section key={branch} aria-label={`AttnRes ${branch === 0 ? 'Attention' : 'FFN'} 子层`} className="mt-5 rounded-2xl border border-amber-100/20 p-3">
                <h3 className="mb-4 text-sm text-amber-100">{branch === 0 ? 'Attention' : isDense ? 'Dense FFN' : 'LatentMoE'}：深度聚合 → Norm → 子层计算 → 块内累加</h3>
                {group.filter(node => node.id !== 'attn-res-write').map((node, i, main) => <div key={node.id}>
                  {nodeButton(node)}
                  {node.id === 'attn-res-read' && <aside className="my-4 rounded-xl border border-dashed border-amber-200/35 bg-amber-200/5 p-3"><p className="mb-3 text-xs leading-6 text-amber-100">状态支路：从原始 prefix 写 bank，不把 bank 当成 Norm 的输入。</p>{nodeButton(group.find(n => n.id === 'attn-res-write')!)}<p className="mt-3 text-xs leading-6 text-white/65">主路继续使用上方 READ 的聚合结果 ↓</p></aside>}
                  {node.id === attentionKind(model, effectiveLayer) && cacheButton()}
                  {node.id === 'moe' && model.id === 'kimi-k3' && <KimiLatentMoeFlow scenario={scenario} ep={state.ep ?? 1} />}
                  {i < main.length - 1 && flowLine}
                </div>)}
                <p className="mt-4 text-xs leading-6 text-white/65">原始 prefix 单独保留用于累加；加权后的输入不替换 prefix，已冻结的 bank 不被覆写。</p>
              </section>)}
            </div> : groups.map((group, groupIndex) => <div key={groupIndex} className="model-residual-group">
              <div className="model-residual-wire" aria-hidden="true"><span>+</span></div>
              {group.map((node, index) => <div key={node.id}>
                {nodeButton(node)}
                {['mla', 'gqa', 'mha', 'gdn', 'swa'].includes(node.id) && cacheButton()}
                {(index < group.length - 1 || groupIndex === 0) && flowLine}
              </div>)}
            </div>)}
          </div>
          {flowLine}
          {effectiveLayer < model.dimensions.layers - 1 && <><div className="model-folded-layers">后 {model.dimensions.layers - effectiveLayer - 1} 层 Decoder <ArrowDown className="inline h-3 w-3" /></div>{flowLine}</>}
          {nodeButton(head)}
          <p className="mt-5 text-xs leading-5 text-white/55">N 是本次前向的 token 数；完整注意力保留历史 S，滑动注意力保留 min(S, W)，DeltaNet 保留定长矩阵与短窗口。输出是逻辑 Shape，内核可能采用不同的打包、分页或融合布局。</p>
        </div>

        <aside aria-label="模块详情侧栏" tabIndex={0} className="order-3 hidden xl:sticky xl:top-20 xl:block xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain"><Inspector node={inspected} model={model} scenario={scenario} ep={state.ep ?? 1} preview={inspected.id !== selected.id} /></aside>
      </section>
      </div>
      <div role="tabpanel" id="workspace-panel-cache" aria-labelledby="workspace-tab-cache" tabIndex={0} hidden={view !== 'cache'} className="focus-visible:outline-cyan-200">
        <h2 className="mt-5 text-xl font-semibold text-white">缓存容量与并发预算</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">这里修改的 B、S 与缓存精度会同步到结构图和张量 Shape。仅估算缓存，不代表整卡可部署显存。</p>
        <p className="mt-2 text-sm leading-6 text-cyan-100">当前 TP={effectiveTp}、EP={state.ep ?? 1}、独立副本={state.replicas ?? 1}。本基线只调整 routed 专家分片，Attention TP 与每副本 B 不变，因此 EP 不改变每卡 KV / 循环状态；此处仍是每卡缓存，不是全部副本的总量。</p>
        <CacheWorkbench model={model} layer={effectiveLayer} scenario={scenario} onBatch={(batch) => updateScenario({ batch })} onSequence={(sequence) => updateScenario({ sequence })} onBytes={(cacheBytes) => updateScenario({ cacheBytes })} />
        <CacheCapacityPlanner model={model} scenario={scenario} budgetGiB={state.cacheBudgetGiB} onBudget={(cacheBudgetGiB) => update({ cacheBudgetGiB }, true)} onBatch={(batch) => updateScenario({ batch })} onSequence={(sequence) => updateScenario({ sequence })} />
      </div>
      <div role="tabpanel" id="workspace-panel-weights" aria-labelledby="workspace-tab-weights" tabIndex={0} hidden={view !== 'weights'} className="focus-visible:outline-cyan-200">
        <h2 className="mt-5 text-xl font-semibold text-white">Decoder 权重清单</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">当前模块、全 Decoder 与全副本分别统计。</p>
        <nav aria-label="权重阅读顺序" className="mt-3 flex flex-wrap gap-2">{[
          ['weight-rank-section', '1 · 当前 rank / 当前模块'],
          ['weight-decoder-section', '2 · 整个 Decoder / 所有副本'],
          ...(model.id === 'kimi-k3' ? [['weight-checkpoint-section', '3 · 官方文件 / 原生加载对账']] : []),
        ].map(([id, label]) => <button key={id} type="button" onClick={() => {
          const section = document.getElementById(id)
          section?.scrollIntoView({ block: 'start' })
          section?.focus({ preventScroll: true })
        }} className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-left text-sm text-cyan-100 hover:border-cyan-200/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">{label}</button>)}</nav>
        {model.id === 'kimi-k3' && <KimiWeightAudit model={model} tp={scenario.tp} ep={state.ep ?? 1} replicas={state.replicas ?? 1} rank={state.rank ?? 0} stage={state.nativeStage ?? 'initial'} onStage={stage => update({ nativeStage: stage === 'processed' ? stage : undefined })} />}
        {supportsMixedPrecision(model.id) && <MixedPrecisionControls value={state.mixed} hasDense={model.execution.denseLayers > 0} denseOnly={model.id === 'qwen3-8b'} modelId={model.id} tp={effectiveTp} ep={state.ep ?? 1} onChange={(mixed) => update({ mixed }, true)} />}
        {model.id === 'qwen3-8b' && state.mixed && <QwenDenseLayout tp={effectiveTp} policy={state.mixed} />}
        <ModelRankWorkbench model={model} layer={effectiveLayer} scenario={scenario} nodeId={selected.id} bits={state.weightBits ?? 16} replicas={state.replicas ?? 1} rank={state.rank ?? 0} ep={state.ep ?? 1} expertFormat={state.expertFormat} mixed={state.mixed} onChange={(next) => update({
          ...(next.tp !== undefined ? { scenario: { ...scenario, tp: next.tp } } : {}),
          ...(next.replicas !== undefined ? { replicas: next.replicas } : {}),
          ...(next.rank !== undefined ? { rank: next.rank } : {}),
          ...(next.ep !== undefined ? { ep: next.ep } : {}),
          ...(next.nodeId !== undefined ? { nodeId: next.nodeId } : {}),
          ...(next.bits !== undefined ? { weightBits: next.bits } : {}),
          ...(next.expertFormat !== undefined ? { expertFormat: next.expertFormat } : {}),
        }, true)} />
        <ModelWeightBudget model={model} layer={effectiveLayer} tp={effectiveTp} ep={state.ep ?? 1} replicas={state.replicas ?? 1} bits={state.weightBits ?? 16} mixed={state.mixed} selectedId={selected.id} onBits={(weightBits) => update({ weightBits })} onSelect={(node) => inspect(node, effectiveLayer, true)} />
      </div>
    </main>
    <dialog ref={dialog} aria-label="模块详情" className="model-inspector-dialog" onClose={() => {
      // Native dialog closing restores focus; its deferred close event must not steal a newer focus.
      const active = document.activeElement
      if (!active || active === document.body || dialog.current?.contains(active)) {
        document.getElementById(`model-node-${selected.id}`)?.focus()
      }
    }} onClick={(event) => { if (event.target === dialog.current) dialog.current.close() }}>
      <button autoFocus type="button" aria-label="关闭模块详情" onClick={() => dialog.current?.close()} className="sticky top-0 z-10 mb-2 ml-auto flex items-center gap-2 rounded-full border border-white/20 bg-[#0c131c] px-4 py-2 text-sm text-white"><X className="h-4 w-4" />关闭</button>
      <Inspector node={selected} model={model} scenario={scenario} ep={state.ep ?? 1} />
    </dialog>
  </div>
}
