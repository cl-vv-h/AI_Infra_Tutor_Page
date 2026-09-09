import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Boxes, GitCompareArrows, Search, X } from 'lucide-react'
import { modelArchitectures } from '@/data/models'
import { attentionComposition, attentionFilters, catalogComparisonHref, catalogParams, emptyCatalog, filterCatalog, hasExperts, modelAttentionProfile, parseCatalog, toggleCatalogSelection } from '@/lib/model-catalog'
import type { CatalogState } from '@/lib/model-catalog'

const layerLabels = { mha: 'MHA', gqa: '完整 GQA', mla: 'MLA', gdn: 'DeltaNet', swa: '滑窗 GQA' }
const layerColors = { mha: '#a5d8ff', gqa: '#70e1f5', mla: '#c7a8ff', gdn: '#d8ff78', swa: '#ffc98b' }
const inputClass = 'min-w-0 rounded-xl border border-white/15 bg-[#0b131c] px-4 py-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200'

export default function ModelCatalog() {
  const [params, setParams] = useSearchParams()
  const { state, notices } = parseCatalog(params, modelArchitectures)
  const filtered = filterCatalog(modelArchitectures, state)
  const selected = state.selected.map((id) => modelArchitectures.find((model) => model.id === id)!)
  const compareHref = catalogComparisonHref(state.selected, modelArchitectures)
  const facetBase = filterCatalog(modelArchitectures, { ...state, attention: 'all' })
  const visibleIds = new Set(filtered.map((model) => model.id))
  useEffect(() => {
    const previous = document.title
    document.title = '模型图解目录 · AI Infra Space'
    return () => { document.title = previous }
  }, [])
  function update(next: Partial<CatalogState>, replace = false) {
    setParams(catalogParams({ ...state, ...next }), { replace, preventScrollReset: true })
  }
  function toggle(id: string) { update(toggleCatalogSelection(state, id, modelArchitectures)) }

  return <div className="model-lab-shell min-h-screen px-5 py-8 text-white sm:px-8 lg:px-10">
    <div className="mx-auto max-w-[1440px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="flex items-center gap-2 font-mono text-xs tracking-widest text-cyan-200/75"><Boxes className="h-4 w-4" /> MODEL ARCHITECTURE LAB</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">模型图解目录</h1><p className="mt-3 max-w-3xl text-base leading-7 text-white/65">找到一种架构，沿数据流学习它。打开模块查看权重与 Shape，或选择模型，在相同推理条件下比较缓存。</p></div>
        <p className="text-sm text-white/60">{modelArchitectures.length} 个检查点 · {modelArchitectures.reduce((sum, model) => sum + model.dimensions.layers, 0)} 层可探索</p>
      </header>
      <section aria-label="搜索与筛选模型" className="mt-6 rounded-2xl border border-white/10 bg-[#0b1119]/90 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="flex min-w-0 flex-col gap-2 text-sm text-white/70">模型、机构或模块名称<span className="relative"><Search aria-hidden="true" className="absolute left-4 top-3.5 h-5 w-5 text-white/40" /><input type="search" aria-label="搜索模型" value={state.query} maxLength={200} onChange={(event) => update({ query: event.target.value }, true)} placeholder="如 Qwen、LongRoPE、qkv_proj…" className={`${inputClass} w-full pl-12`} /></span></label>
          <label className="flex flex-col gap-2 text-sm text-white/70">FFN 类型<select aria-label="筛选 FFN 类型" value={state.ffn} onChange={(event) => update({ ffn: event.target.value as CatalogState['ffn'] })} className={inputClass}><option value="all">全部 FFN</option><option value="dense">全部为 Dense 层</option><option value="moe">包含 MoE 层</option></select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="筛选注意力架构">{attentionFilters.map((filter) => {
          const count = filter.id === 'all' ? facetBase.length : facetBase.filter((model) => modelAttentionProfile(model) === filter.id).length
          return <button key={filter.id} type="button" aria-pressed={state.attention === filter.id} onClick={() => update({ attention: filter.id })} className={`rounded-full border px-3 py-2 text-sm transition ${state.attention === filter.id ? 'border-cyan-200/50 bg-cyan-200/10 text-cyan-100' : 'border-white/15 text-white/65 hover:bg-white/5'}`}>{filter.label}<span className="ml-2 font-mono text-white/50">{count}</span></button>
        })}</div>
        <p className="mt-3 text-sm leading-6 text-white/50">数量随搜索词和 FFN 筛选更新。筛选与对比选择保存在地址中；分享前请确认搜索词适合公开。</p>
      </section>
      {notices.length > 0 && <p role="status" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm leading-6 text-amber-100">{notices.join(' ')}</p>}
      <section aria-label="已选模型对比" className="mt-4 rounded-2xl border border-violet-200/20 bg-[#141220] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-medium"><GitCompareArrows className="h-5 w-5 text-violet-200" />待对比 {selected.length} / 3</h2>{compareHref ? <Link to={compareHref} className="inline-flex items-center gap-2 rounded-xl bg-violet-200 px-4 py-2.5 text-sm font-medium text-[#171023]">比较已选模型<ArrowRight className="h-4 w-4" /></Link> : <button disabled type="button" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/40">至少选择 2 个模型</button>}</div>
        <div className="mt-3 flex flex-wrap gap-2">{selected.map((model) => <button key={model.id} type="button" onClick={() => toggle(model.id)} aria-label={`移除对比 ${model.name}`} className="flex items-center gap-2 rounded-lg border border-violet-200/25 px-3 py-2 text-left text-sm text-violet-100">{model.name}{!visibleIds.has(model.id) && <span className="text-white/50">（筛选外）</span>}<X className="h-4 w-4 shrink-0" /></button>)}</div>
        <p aria-live="polite" className="mt-3 text-sm leading-6 text-white/60">{selected.length === 3 ? '已选满 3 个；先移除一项再添加其他模型。' : selected.length ? '可以继续筛选、添加模型；已选项不会因筛选而丢失。' : '在卡片上勾选 2–3 个检查点。对比的是架构和理论缓存，不是性能排名。'} 对比初始条件：B=4、S=8,192、TP=4、KV=2 字节，可在对比台调整。</p>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-white/65">找到 {filtered.length} / {modelArchitectures.length} 个模型</p><button type="button" onClick={() => update({ ...emptyCatalog, selected: state.selected })} className="text-sm text-cyan-100 hover:underline">清除筛选，保留选择</button></div>
      {filtered.length ? <section aria-label="模型目录结果" className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((model) => {
        const picked = state.selected.includes(model.id)
        const composition = attentionComposition(model)
        const expertLayers = model.dimensions.layers - model.execution.denseLayers
        return <article key={model.id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-[#0b1119] ${picked ? 'border-violet-200/60 ring-1 ring-violet-200/20' : 'border-white/10'}`}>
          <div className="h-1" style={{ backgroundColor: model.accent }} aria-hidden="true" />
          <div className="flex flex-1 flex-col p-5">
            <p className="text-sm text-white/50">{model.organization}</p><h2 className="mt-2 text-xl font-semibold"><Link to={`/models/${model.id}`} className="hover:text-cyan-100">{model.name}</Link></h2><p className="mt-2 text-sm text-cyan-100/80">{model.family}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-white/10 py-4">{[['标称参数', model.parameters], ['Decoder 层', String(model.dimensions.layers)], ['上下文上限', model.execution.maxContext.toLocaleString('en-US')]].map(([label, value]) => <div key={label}><dt className="text-xs text-white/50">{label}</dt><dd className="mt-1 break-words font-mono text-sm text-white/90">{value}</dd></div>)}</dl>
            <div className="mt-4"><p className="text-sm text-white/55">注意力层占比</p><div className="mt-2 flex h-2 overflow-hidden rounded-full" aria-hidden="true">{composition.map(({ kind, count }) => <span key={kind} style={{ width: `${100 * count / model.dimensions.layers}%`, backgroundColor: layerColors[kind] }} />)}</div><p className="mt-2 text-sm text-white/65">{composition.map(({ kind, count }) => `${count} ${layerLabels[kind]}`).join(' · ')}</p><p className="mt-2 text-sm text-white/65">{hasExperts(model) ? `${model.execution.denseLayers} Dense / ${expertLayers} MoE 层 · ${model.activeParameters} 标称激活参数` : '全部为 Dense FFN'}</p></div>
            <p className="mt-4 text-base leading-7 text-white/65">{model.description}</p>
            <div className="mt-auto pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/models/${model.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-cyan-100 hover:underline">打开交互图解<ArrowRight className="h-4 w-4" /></Link><a href={model.configUrl} target="_blank" rel="noreferrer" className="text-sm text-white/55 hover:text-white">官方配置<ArrowUpRight className="ml-1 inline h-3 w-3" /></a></div><label className={`mt-4 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${picked ? 'border-violet-200/30 bg-violet-200/5 text-violet-100' : 'border-white/10 text-white/65'} ${!picked && selected.length >= 3 ? 'cursor-not-allowed opacity-50' : ''}`}><input type="checkbox" aria-label={`对比 ${model.name}`} checked={picked} disabled={!picked && selected.length >= 3} onChange={() => toggle(model.id)} className="h-4 w-4 accent-violet-300" />{picked ? '已加入对比' : '加入对比'}</label></div>
          </div>
        </article>
      })}</section> : <div className="mt-4 rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center"><h2 className="text-xl font-medium">没有匹配的模型</h2><p className="mt-3 text-base text-white/60">尝试缩短关键词或放宽架构筛选。已选模型仍保留在上方。</p></div>}
      <p className="mt-6 text-sm leading-6 text-white/50">目录只列出已有图解，不代表全部开源模型。参数量为检查点标称值，上下文取对应配置，不代表实际服务容量；层占比不表示速度或计算占比。新增模型会自动进入目录。</p>
    </div>
  </div>
}
