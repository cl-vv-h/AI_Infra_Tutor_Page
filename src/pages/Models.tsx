import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, BookOpen, Box, Braces, Database, Layers3, MousePointer2, X } from 'lucide-react'
import { getModelArchitecture, modelArchitectures } from '@/data/models'
import { decoderNodes, formatShape, tokenCount } from '@/lib/model-lab'
import type { InferenceScenario } from '@/lib/model-lab'
import type { ArchitectureNode, InferencePhase, ModelArchitecture, TensorParallelSize } from '@/types/model'
import { CacheWorkbench } from '@/components/CacheWorkbench'

function Inspector({ node, model, scenario }: { node: ArchitectureNode; model: ModelArchitecture; scenario: InferenceScenario }) {
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c131c]">
    <div className="border-b border-white/[0.08] p-5">
      <div className="flex items-center justify-between font-mono text-xs tracking-widest text-cyan-200/70">INSPECTOR <Box className="h-4 w-4" /></div>
      <h2 className="mt-4 text-xl font-semibold text-white">{node.title}</h2>
      <p className="mt-2 text-sm text-white/60">{node.subtitle}</p>
      <p className="mt-4 text-base leading-7 text-slate-300">{node.description}</p>
    </div>
    <div className="grid grid-cols-2 gap-px bg-white/[0.08]">
      {[['INPUT', node.inputShape], ['OUTPUT', node.outputShape]].map(([label, value]) => <div key={label} className="bg-[#0c131c] p-4">
        <div className="font-mono text-xs text-white/50">{label}</div>
        <div className="mt-2 break-words font-mono text-sm text-cyan-100">{formatShape(value, model, scenario)}</div>
      </div>)}
    </div>
    <div className="p-5">
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
  const navigate = useNavigate()
  const [phase, setPhase] = useState<InferencePhase>('decode')
  const [tp, setTp] = useState<TensorParallelSize>(4)
  const [layer, setLayer] = useState(0)
  const [batch, setBatch] = useState(4)
  const [sequence, setSequence] = useState(4096)
  const [cacheBytes, setCacheBytes] = useState<1 | 2>(2)
  const [selectedId, setSelectedId] = useState('mla')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const model = getModelArchitecture(modelId)
  const effectiveTp = model.supportedTp.includes(tp) ? tp : model.supportedTp[0]
  const effectiveLayer = Math.min(layer, model.dimensions.layers - 1)
  const scenario: InferenceScenario = { phase, tp: effectiveTp, batch, sequence: Math.min(sequence, model.execution.maxContext), cacheBytes }
  const block = decoderNodes(model, effectiveLayer)
  const embedding = model.nodes.find((node) => node.id === 'embedding')!
  const head = model.nodes.find((node) => node.id === 'lm-head')!
  const cache = model.nodes.find((node) => node.id === 'kv-cache')!
  const visibleNodes = [embedding, ...block, cache, head]
  const selected = visibleNodes.find((node) => node.id === selectedId) ?? block[1]
  const inspected = visibleNodes.find((node) => node.id === hoveredId) ?? selected
  const isDense = effectiveLayer < model.execution.denseLayers

  function inspect(node: ArchitectureNode) {
    setSelectedId(node.id)
    setHoveredId(null)
    if (window.matchMedia('(max-width: 1279px)').matches) dialog.current?.showModal()
  }

  function nodeButton(node: ArchitectureNode) {
    return <button type="button" aria-pressed={selected.id === node.id} onClick={() => inspect(node)}
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
        <p className="flex items-center gap-2 text-sm text-white/60"><MousePointer2 className="h-4 w-4 text-cyan-200" /> 悬浮预览 · 点击查看 · 逐层探索</p>
      </div>
    </header>

    <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
      <section className="rounded-3xl border border-white/10 bg-[#0b1119]/90 p-3" aria-label="模型与推理配置">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="选择模型">
          {modelArchitectures.map((item) => <button key={item.id} type="button" aria-pressed={item.id === model.id}
            onClick={() => { navigate(`/models/${item.id}`); setLayer(0); setHoveredId(null); setSelectedId(item.execution.cache.kind); }}
            className={`min-w-fit rounded-2xl px-4 py-3 text-left transition ${item.id === model.id ? 'bg-white/10 text-white ring-1 ring-cyan-200/30' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'}`}>
            <span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block font-mono text-xs text-white/50">{item.family}</span>
          </button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <div className="flex rounded-xl bg-black/20 p-1" aria-label="推理阶段">{(['prefill', 'decode'] as const).map((item) => <button key={item} type="button" aria-pressed={phase === item} onClick={() => setPhase(item)} className={`rounded-lg px-4 py-2 text-sm uppercase ${phase === item ? 'bg-white/10 text-white' : 'text-white/60'}`}>{item}</button>)}</div>
          <div className="flex items-center gap-1" aria-label="Tensor Parallel 大小"><span className="px-2 font-mono text-sm text-white/60">TP</span>{model.supportedTp.map((size) => <button key={size} type="button" aria-label={`TP ${size}`} aria-pressed={effectiveTp === size} onClick={() => setTp(size)} className={`h-10 w-10 rounded-xl text-sm ${effectiveTp === size ? 'bg-cyan-200 text-[#071014]' : 'text-white/65 hover:bg-white/10'}`}>{size}</button>)}</div>
          <label className="ml-auto flex items-center gap-3 text-sm text-white/70">Layer
            <input aria-label="查看 Decoder 层号" type="range" min={0} max={model.dimensions.layers - 1} value={effectiveLayer} onChange={(e) => { setLayer(Number(e.target.value)); setHoveredId(null) }} className="w-32 accent-cyan-200 sm:w-44" />
            <output className="w-16 font-mono text-white">{effectiveLayer} / {model.dimensions.layers - 1}</output>
          </label>
        </div>
      </section>

      <CacheWorkbench model={model} scenario={scenario} onBatch={setBatch} onSequence={setSequence} onBytes={setCacheBytes} />

      <section className="mt-5 grid items-start gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#0b1119]/80 p-5">
            <div className="font-mono text-xs tracking-widest text-white/50">MODEL CARD</div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{model.name}</h2>
            <p className="mt-2 text-sm text-white/60">{model.organization} · {model.parameters}<br />{model.activeParameters} active</p>
            <p className="mt-4 text-base leading-7 text-slate-300">{model.description}</p>
            <a href={model.configUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100">{model.configLabel}<ArrowUpRight className="h-4 w-4" /></a>
          </div>
          <div className="grid grid-cols-2 gap-2">{model.metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="font-mono text-xs text-white/50">{metric.label}</div><div className="mt-2 text-sm font-semibold text-white/90">{metric.value}</div></div>)}</div>
          <p className="px-2 text-sm leading-6 text-white/60">图中展开第 {effectiveLayer} 层，其余层折叠。标准自回归主干，不包含 MTP 辅助预测分支。EP = 1，PP = 1。</p>
        </aside>

        <div className="model-canvas rounded-3xl border border-white/10 bg-[#080d13] p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60"><span>{phase === 'prefill' ? 'Prefill · 无前缀缓存，处理完整输入' : 'Decode · 每请求新增 1 token'}</span><span className="font-mono text-cyan-200">N = {tokenCount(scenario).toLocaleString('en-US')}</span></div>
          {nodeButton(embedding)}{flowLine}
          {effectiveLayer > 0 && <><div className="model-folded-layers">前 {effectiveLayer} 层 Decoder</div>{flowLine}</>}
          <div className="rounded-2xl border border-dashed border-cyan-200/25 px-3 py-4 sm:px-6">
            <div className="mb-5 flex flex-wrap justify-between gap-2 font-mono text-xs text-cyan-100/80"><span>DECODER LAYER {effectiveLayer}</span><span className="text-violet-200">{isDense ? 'DENSE FFN' : 'SPARSE MoE'}</span></div>
            {[block.slice(0, 3), block.slice(3)].map((group, groupIndex) => <div key={groupIndex} className="model-residual-group">
              <div className="model-residual-wire" aria-hidden="true"><span>+</span></div>
              {group.map((node, index) => <div key={node.id}>
                {nodeButton(node)}
                {['mla', 'gqa'].includes(node.id) && <button type="button" aria-pressed={selected.id === cache.id} onClick={() => inspect(cache)} onMouseEnter={() => setHoveredId(cache.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(cache.id)} onBlur={() => setHoveredId(null)} className={`mx-auto mt-3 flex w-full max-w-[25rem] items-center gap-3 rounded-xl border p-3 text-left transition ${selected.id === cache.id ? 'border-lime-200/70 bg-lime-200/10' : 'border-lime-200/25 bg-[#0b1514] hover:border-lime-200/60'}`}>
                  <Database className="h-5 w-5 shrink-0 text-lime-200" /><span className="min-w-0"><span className="block text-sm font-semibold text-lime-100">↔ {cache.title}</span><span className="mt-1 block break-words font-mono text-xs text-white/65">{formatShape(cache.outputShape, model, scenario)}</span></span>
                </button>}
                {(index < group.length - 1 || groupIndex === 0) && flowLine}
              </div>)}
            </div>)}
          </div>
          {flowLine}
          {effectiveLayer < model.dimensions.layers - 1 && <><div className="model-folded-layers">后 {model.dimensions.layers - effectiveLayer - 1} 层 Decoder <ArrowDown className="inline h-3 w-3" /></div>{flowLine}</>}
          {nodeButton(head)}
          <p className="mt-5 text-xs leading-5 text-white/55">N 是本次前向的 token 数；Decode 的 KV Cache 仍包含完整历史 S。输出是逻辑 Shape，内核可能采用不同的打包、分页或融合布局。</p>
        </div>

        <aside className="hidden xl:sticky xl:top-20 xl:block"><Inspector node={inspected} model={model} scenario={scenario} /></aside>
      </section>
    </main>
    <dialog ref={dialog} aria-label="模块详情" className="model-inspector-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current.close() }}>
      <button autoFocus type="button" aria-label="关闭模块详情" onClick={() => dialog.current?.close()} className="sticky top-0 z-10 mb-2 ml-auto flex items-center gap-2 rounded-full border border-white/20 bg-[#0c131c] px-4 py-2 text-sm text-white"><X className="h-4 w-4" />关闭</button>
      <Inspector node={selected} model={model} scenario={scenario} />
    </dialog>
  </div>
}
