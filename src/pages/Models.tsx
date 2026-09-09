import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Box, Braces, Database, GitBranch, Layers3, MousePointer2 } from 'lucide-react'
import { getModelArchitecture, modelArchitectures } from '@/data/models'
import type { ArchitectureNode, InferencePhase, TensorParallelSize } from '@/types/model'

const toneClass: Record<ArchitectureNode['tone'], string> = {
  input: 'model-node--input',
  attention: 'model-node--attention',
  ffn: 'model-node--ffn',
  memory: 'model-node--memory',
  output: 'model-node--output',
}

function fillShape(template: string, model: ReturnType<typeof getModelArchitecture>, tp: TensorParallelSize) {
  const localHeads = Math.max(1, model.dimensions.attentionHeads / tp)
  const localKvHeads = Math.max(1, model.dimensions.kvHeads / tp)
  const vocabShard = Math.ceil(model.dimensions.vocabSize / tp).toLocaleString('en-US')
  const intermediateShard = Math.ceil(model.dimensions.intermediateSize / tp).toLocaleString('en-US')
  return template
    .split('{localHeads}').join(String(localHeads))
    .split('{localKvHeads}').join(String(localKvHeads))
    .split('{vocabShard}').join(vocabShard)
    .split('{intermediateShard}').join(intermediateShard)
    .split('{tp}').join(String(tp))
}

export default function Models() {
  const { modelId } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<InferencePhase>('decode')
  const [tp, setTp] = useState<TensorParallelSize>(4)
  const [selectedId, setSelectedId] = useState('mla')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const model = getModelArchitecture(modelId)
  const effectiveTp = model.supportedTp.includes(tp) ? tp : model.supportedTp[0]
  const effectiveSelectedId = model.nodes.some((node) => node.id === selectedId)
    ? selectedId
    : model.nodes.find((node) => ['mla', 'gqa'].includes(node.id))?.id ?? model.nodes[0].id
  const inspected = useMemo(
    () => model.nodes.find((node) => node.id === (hoveredId ?? effectiveSelectedId)) ?? model.nodes[0],
    [effectiveSelectedId, hoveredId, model],
  )

  const mainFlow = model.nodes.filter((node) => node.id !== 'kv-cache')
  const kvCache = model.nodes.find((node) => node.id === 'kv-cache')

  return (
    <div className="model-lab-shell min-h-screen pb-20">
      <header className="border-b border-white/[0.08] bg-[#070b10]/60">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-cyan-200/55">
              <Braces className="h-4 w-4" /> MODEL ARCHITECTURE LAB
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">把模型结构变成可检查的系统。</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            <MousePointer2 className="h-4 w-4 text-cyan-200" /> 悬浮预览，点击锁定；切换 TP 查看本地权重 Shape
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 lg:px-10">
        <section className="grid gap-3 rounded-3xl border border-white/10 bg-[#0b1119]/90 p-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="flex min-w-0 gap-2 overflow-x-auto" aria-label="选择模型">
            {modelArchitectures.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(`/models/${item.id}`)
                  setSelectedId(item.nodes.find((node) => ['mla', 'gqa'].includes(node.id))?.id ?? item.nodes[0].id)
                  setHoveredId(null)
                  if (!item.supportedTp.includes(tp)) setTp(item.supportedTp[0])
                }}
                className={`min-w-fit rounded-2xl px-4 py-3 text-left transition ${item.id === model.id ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/[0.05] hover:text-white/70'}`}
              >
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="mt-1 block font-mono text-xs tracking-wide opacity-45">{item.family}</span>
              </button>
            ))}
          </div>

          <div className="flex rounded-2xl border border-white/[0.08] bg-black/20 p-1" aria-label="推理阶段">
            {(['prefill', 'decode'] as InferencePhase[]).map((item) => (
              <button key={item} type="button" onClick={() => setPhase(item)} className={`rounded-xl px-4 py-2 text-xs font-medium uppercase tracking-wider transition ${phase === item ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/65'}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-2" aria-label="Tensor Parallel 大小">
            <span className="pl-2 font-mono text-xs text-white/30">TP</span>
            {model.supportedTp.map((size) => (
              <button key={size} type="button" onClick={() => setTp(size)} className={`grid h-9 w-9 place-items-center rounded-xl text-xs transition ${effectiveTp === size ? 'bg-cyan-200 text-[#071014]' : 'text-white/40 hover:bg-white/[0.06] hover:text-white'}`}>
                {size}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-[#0b1119]/80 p-6">
              <div className="font-mono text-xs tracking-[0.16em] text-white/30">MODEL CARD</div>
              <h2 className="mt-5 text-2xl font-semibold text-white">{model.name}</h2>
              <p className="mt-1 text-sm text-white/35">{model.organization} · {model.parameters} / {model.activeParameters} active</p>
              <p className="mt-5 text-base leading-7 text-slate-300/55">{model.description}</p>
              <a href={model.configUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-xs text-cyan-200/65 transition hover:text-cyan-100">
                {model.configLabel} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {model.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-white/25">{metric.label}</div>
                  <div className="mt-2 text-sm font-semibold text-white/75">{metric.value}</div>
                </div>
              ))}
            </div>
          </aside>

          <div className="model-canvas relative overflow-hidden rounded-3xl border border-white/10 bg-[#080d13] p-4 sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-white/35"><GitBranch className="h-4 w-4" /> 数据流 · {phase === 'prefill' ? '批量处理输入 token' : '逐 token 解码'}</div>
              <div className="font-mono text-xs text-cyan-200/45">N = {phase === 'prefill' ? 'T tokens' : 'B requests'} · TP = {effectiveTp}</div>
            </div>

            <div className="mx-auto max-w-2xl">
              {mainFlow.map((node, index) => (
                <div key={node.id} className="relative">
                  {['mla', 'gqa'].includes(node.id) && kvCache && (
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredId(kvCache.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(kvCache.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => setSelectedId(kvCache.id)}
                    className={`model-cache-node absolute right-0 top-1/2 hidden w-40 -translate-y-1/2 translate-x-[calc(100%+1.75rem)] rounded-2xl border p-4 text-left transition lg:block ${effectiveSelectedId === kvCache.id ? 'border-lime-200/60 bg-lime-200/10' : 'border-lime-200/20 bg-[#0b1514] hover:border-lime-200/45'}`}
                    >
                      <Database className="h-4 w-4 text-lime-200" />
                      <span className="mt-3 block text-xs font-semibold text-white">{kvCache.title}</span>
                      <span className="mt-1 block text-xs leading-4 text-white/35">{kvCache.outputShape}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(node.id)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setSelectedId(node.id)}
                    className={`model-node ${toneClass[node.tone]} ${effectiveSelectedId === node.id ? 'is-selected' : ''}`}
                  >
                    <span className="font-mono text-xs tracking-[0.15em] text-white/30">{node.eyebrow}</span>
                    <span className="mt-2 flex items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-white">{node.title}</span>
                        <span className="mt-1 block text-xs text-white/35">{node.subtitle}</span>
                      </span>
                      {node.layerRange && <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-xs text-white/30">{node.layerRange}</span>}
                    </span>
                  </button>
                  {node.id === 'mla' && kvCache && (
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredId(kvCache.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(kvCache.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => setSelectedId(kvCache.id)}
                      className={`mx-auto mt-3 flex w-full max-w-[25rem] items-center gap-3 rounded-xl border p-3 text-left transition lg:hidden ${effectiveSelectedId === kvCache.id ? 'border-lime-200/60 bg-lime-200/10' : 'border-lime-200/20 bg-[#0b1514]'}`}
                    >
                      <Database className="h-4 w-4 text-lime-200" />
                      <span><span className="block text-xs font-semibold text-white">{kvCache.title}</span><span className="mt-0.5 block text-xs text-white/35">{fillShape(kvCache.outputShape, model, effectiveTp)}</span></span>
                    </button>
                  )}
                  {index < mainFlow.length - 1 && <div className="model-flow-line" aria-hidden="true"><span /></div>}
                </div>
              ))}
            </div>
          </div>

          <aside className="xl:sticky xl:top-20 xl:self-start">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c131c]">
              <div className="border-b border-white/[0.08] p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs tracking-[0.16em] text-cyan-200/45">INSPECTOR</span>
                  <Box className="h-4 w-4 text-white/30" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">{inspected.title}</h2>
                <p className="mt-2 text-xs text-white/40">{inspected.subtitle}</p>
                <p className="mt-5 text-base leading-7 text-slate-300/60">{inspected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/[0.08]">
                <div className="bg-[#0c131c] p-4">
                  <div className="font-mono text-xs text-white/25">INPUT</div>
                  <div className="mt-2 break-words font-mono text-xs text-cyan-100/75">{fillShape(inspected.inputShape, model, effectiveTp)}</div>
                </div>
                <div className="bg-[#0c131c] p-4">
                  <div className="font-mono text-xs text-white/25">OUTPUT</div>
                  <div className="mt-2 break-words font-mono text-xs text-lime-100/75">{fillShape(inspected.outputShape, model, effectiveTp)}</div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-white/30"><Layers3 className="h-3.5 w-3.5" /> WEIGHTS</div>
                {inspected.weights.length ? (
                  <div className="mt-4 space-y-3">
                    {inspected.weights.map((weight) => (
                      <div key={weight.name} className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                        <div className="text-xs text-white/55">{weight.name}</div>
                        <div className="mt-1.5 break-words font-mono text-xs text-cyan-100/70">{fillShape(weight.shape, model, effectiveTp)}</div>
                        {weight.note && <div className="mt-1 text-xs text-white/25">{weight.note}</div>}
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-4 text-xs leading-5 text-white/30">这是运行时状态，不包含可训练权重。</p>}

                <div className="mt-6 flex items-center gap-2 font-mono text-xs tracking-wider text-white/30"><BookOpen className="h-3.5 w-3.5" /> KNOWLEDGE INDEX</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {inspected.knowledge.map((link) => (
                    <Link key={link.to + link.label} to={link.to} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45 transition hover:border-cyan-200/35 hover:text-cyan-100">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
