import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, BookOpen, Box, Braces, Check, Copy, Database, GitCompareArrows, Layers3, MousePointer2, X } from 'lucide-react'
import { modelArchitectures } from '@/data/models'
import { attentionKind, decoderNodes, formatShape, layerCacheNode, tokenCount } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'
import type { ArchitectureNode, ModelArchitecture } from '@/types/model'
import { CacheWorkbench } from '@/components/CacheWorkbench'
import { ModelLayerMap } from '@/components/ModelLayerMap'
import { comparisonHref } from '@/lib/model-comparison'
import { explorerHref, explorerParams, parseExplorer, selectExplorerLayer } from '@/lib/model-explorer'
import type { ExplorerState } from '@/lib/model-explorer'
import ModelModuleFinder from '@/components/ModelModuleFinder'

function Inspector({ node, model, scenario, preview = false }: { node: ArchitectureNode; model: ModelArchitecture; scenario: InferenceScenario; preview?: boolean }) {
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
      <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/60"><Layers3 className="h-4 w-4" /> WEIGHTS · [OUT, IN]</div>
      <p className="mt-2 text-xs leading-5 text-white/50">TP local 为每卡分片，其余为完整矩阵或复制权重。融合布局为等价示意。</p>
      <div className="mt-4 space-y-3">
        {node.weights.map((weight) => <div key={weight.name} className="rounded-xl border border-white/10 bg-black/15 p-3">
          <div className="break-words text-sm text-white/75">{weight.name}</div>
          <div className="mt-2 break-words font-mono text-sm text-cyan-100">{formatShape(weight.shape, model, scenario)}</div>
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
  const canonical = explorerHref(model.id, state)
  const [hovered, setHovered] = useState<{ id: string; context: string } | null>(null)
  const hoveredId = hovered?.context === canonical ? hovered.id : null
  const setHoveredId = (id: string | null) => setHovered(id ? { id, context: canonical } : null)
  const [pendingLocate, setPendingLocate] = useState<{ id: string; layer: number } | null>(null)
  const [copyState, setCopyState] = useState<{ path: string; status: 'copied' | 'failed'; url: string } | null>(null)
  const copyStatus = copyState?.path === canonical ? copyState.status : null
  const dialog = useRef<HTMLDialogElement>(null)
  const block = decoderNodes(model, effectiveLayer)
  const embedding = model.nodes.find((node) => node.id === 'embedding')!
  const head = model.nodes.find((node) => node.id === 'lm-head')!
  const cache = layerCacheNode(model, effectiveLayer)
  const vision = model.nodes.find((node) => node.id === 'vision')
  const selected = visibleNodes.find((node) => node.id === state.nodeId)!
  const inspected = visibleNodes.find((node) => node.id === hoveredId) ?? selected
  const isDense = effectiveLayer < model.execution.denseLayers

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
    update({ nodeId: node.id, layer })
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

  const flowLine = <div className="model-flow-line" aria-hidden="true"><span /></div>
  return <div className="model-lab-shell min-h-screen pb-20">
    <header className="border-b border-white/[0.08] bg-[#070b10]/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4 px-5 py-7 sm:px-8 lg:px-10">
        <div><div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-cyan-200/70"><Braces className="h-4 w-4" /> MODEL ARCHITECTURE LAB</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">从一个 token，看清一层模型。</h1></div>
        <div className="flex flex-wrap items-center gap-4"><p className="flex items-center gap-2 text-sm text-white/60"><MousePointer2 className="h-4 w-4 text-cyan-200" /> 悬浮预览 · 点击查看 · 逐层探索</p><Link to={comparisonHref(model.id, scenario)} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/5 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-200/10"><GitCompareArrows className="h-4 w-4" />对比当前模型</Link></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
      <section className="rounded-3xl border border-white/10 bg-[#0b1119]/90 p-3" aria-label="模型与推理配置">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="选择模型">
          {modelArchitectures.map((item) => <button key={item.id} type="button" aria-pressed={item.id === model.id}
            onClick={() => { if (item.id !== model.id) navigate(explorerHref(item.id, { ...state, layer: 0, nodeId: attentionKind(item, 0) })); }}
            className={`min-w-fit rounded-2xl px-4 py-3 text-left transition ${item.id === model.id ? 'bg-white/10 text-white ring-1 ring-cyan-200/30' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'}`}>
            <span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block font-mono text-xs text-white/50">{item.family}</span>
          </button>)}
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
      <ModelLayerMap model={model} selectedLayer={effectiveLayer} onSelect={(value) => changeLayer(value)} />
      <CacheWorkbench model={model} scenario={scenario} onBatch={(batch) => updateScenario({ batch })} onSequence={(sequence) => updateScenario({ sequence })} onBytes={(cacheBytes) => updateScenario({ cacheBytes })} />
      <ModelModuleFinder model={model} layer={effectiveLayer} selectedId={selected.id} onSelect={(node, layer) => inspect(node, layer, true)} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b1119] p-4">
        <p className="text-sm text-white/70">已选 <span className="font-mono text-cyan-100">Layer {effectiveLayer}</span> · {selected.title}</p>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => inspect(selected, effectiveLayer, true)} className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-cyan-100 hover:bg-white/5">查看已选模块</button><button type="button" onClick={copyExplorer} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 px-3 py-2.5 text-sm text-cyan-100 hover:bg-white/5">{copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}复制当前图解</button></div>
        <p role="status" className="w-full text-sm text-white/55">{copyStatus === 'copied' ? '已复制模型、层、已选模块和推理条件；不包含临时悬浮预览。' : copyStatus === 'failed' ? '无法自动复制，请选择下方链接手动复制。' : '链接保留层号、已选模块、阶段、B、S、TP 和缓存精度。窄屏可点击“查看已选模块”打开详情。'}</p>
        {copyStatus === 'failed' && <input readOnly aria-label="手动复制图解链接" value={copyState?.url ?? ''} onFocus={(event) => event.target.select()} className="w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" />}
      </div>

      <section className="mt-5 grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#0b1119]/80 p-5">
            <div className="font-mono text-xs tracking-widest text-white/50">MODEL CARD</div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{model.name}</h2>
            <p className="mt-2 text-sm text-white/60">{model.organization} · {model.parameters}<br />{model.activeParameters} active</p>
            <p className="mt-4 text-base leading-7 text-slate-300">{model.description}</p>
            <a href={model.configUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">{model.configLabel}<ArrowUpRight className="h-4 w-4" /></a>
            {model.implementationUrl && <a href={model.implementationUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">参考实现与权重定义<ArrowUpRight className="h-4 w-4" /></a>}
          </div>
          <div className="grid grid-cols-2 gap-2">{model.metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="font-mono text-xs text-white/50">{metric.label}</div><div className="mt-2 text-sm font-semibold text-white/90">{metric.value}</div></div>)}</div>
          <p className="px-2 text-sm leading-6 text-white/60">图中展开第 {effectiveLayer} 层，其余层折叠。标准自回归主干，不包含 MTP 辅助预测分支。EP = 1，PP = 1。</p>
        </aside>

        <div className="model-canvas rounded-3xl border border-white/10 bg-[#080d13] p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60"><span>{phase === 'prefill' ? 'Prefill · 无前缀缓存，处理完整输入' : 'Decode · 每请求新增 1 token'}</span><span className="font-mono text-cyan-200">N = {tokenCount(scenario).toLocaleString('en-US')}</span></div>
          {vision ? <><div className="grid gap-3 sm:grid-cols-2">{nodeButton(embedding)}{nodeButton(vision)}</div><div className="mx-auto mt-3 max-w-[25rem] rounded-xl border border-white/15 p-3 text-center text-sm text-white/70">↓ 视觉输出替换对应占位 embedding ↓<br /><span className="font-mono text-xs text-cyan-100">{formatShape('[N, ' + model.dimensions.hiddenSize + ']', model, scenario)}</span></div></> : nodeButton(embedding)}{flowLine}
          {effectiveLayer > 0 && <><div className="model-folded-layers">前 {effectiveLayer} 层 Decoder</div>{flowLine}</>}
          <div className="rounded-2xl border border-dashed border-cyan-200/25 px-3 py-4 sm:px-6">
            <div className="mb-5 flex flex-wrap justify-between gap-2 font-mono text-xs text-cyan-100/80"><span>DECODER LAYER {effectiveLayer}</span><span className="text-violet-200">{isDense ? 'DENSE FFN' : 'SPARSE MoE'}</span></div>
            {[block.slice(0, 3), block.slice(3)].map((group, groupIndex) => <div key={groupIndex} className="model-residual-group">
              <div className="model-residual-wire" aria-hidden="true"><span>+</span></div>
              {group.map((node, index) => <div key={node.id}>
                {nodeButton(node)}
                {['mla', 'gqa', 'gdn', 'swa'].includes(node.id) && <button id={`model-node-${cache.id}`} type="button" aria-pressed={selected.id === cache.id} onClick={() => inspect(cache)} onMouseEnter={() => setHoveredId(cache.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(cache.id)} onBlur={() => setHoveredId(null)} className={`mx-auto mt-3 flex w-full max-w-[25rem] items-center gap-3 rounded-xl border p-3 text-left transition ${selected.id === cache.id ? 'border-lime-200/70 bg-lime-200/10' : 'border-lime-200/25 bg-[#0b1514] hover:border-lime-200/60'}`}>
                  <Database className="h-5 w-5 shrink-0 text-lime-200" /><span className="min-w-0"><span className="block text-sm font-semibold text-lime-100">↔ {cache.title}</span><span className="mt-1 block break-words font-mono text-xs text-white/65">{formatShape(cache.outputShape, model, scenario)}</span></span>
                </button>}
                {(index < group.length - 1 || groupIndex === 0) && flowLine}
              </div>)}
            </div>)}
          </div>
          {flowLine}
          {effectiveLayer < model.dimensions.layers - 1 && <><div className="model-folded-layers">后 {model.dimensions.layers - effectiveLayer - 1} 层 Decoder <ArrowDown className="inline h-3 w-3" /></div>{flowLine}</>}
          {nodeButton(head)}
          <p className="mt-5 text-xs leading-5 text-white/55">N 是本次前向的 token 数；完整注意力保留历史 S，滑动注意力保留 min(S, W)，DeltaNet 保留定长矩阵与短窗口。输出是逻辑 Shape，内核可能采用不同的打包、分页或融合布局。</p>
        </div>

        <aside className="hidden xl:sticky xl:top-20 xl:block"><Inspector node={inspected} model={model} scenario={scenario} preview={inspected.id !== selected.id} /></aside>
      </section>
    </main>
    <dialog ref={dialog} aria-label="模块详情" className="model-inspector-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current.close() }}>
      <button autoFocus type="button" aria-label="关闭模块详情" onClick={() => dialog.current?.close()} className="sticky top-0 z-10 mb-2 ml-auto flex items-center gap-2 rounded-full border border-white/20 bg-[#0c131c] px-4 py-2 text-sm text-white"><X className="h-4 w-4" />关闭</button>
      <Inspector node={selected} model={model} scenario={scenario} />
    </dialog>
  </div>
}
