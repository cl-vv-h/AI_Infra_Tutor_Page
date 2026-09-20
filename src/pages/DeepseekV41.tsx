import { useEffect, useState } from 'react'
import ModelSectionNav from '@/components/ModelSectionNav'
import { Link, useSearchParams } from 'react-router-dom'
import { formatBytes } from '@/lib/model-lab'
import { parseV41Scenario, v41Cache, v41Layer, v41Params, v41Query, v41Reference, v41Source, v41Weights, v41WeightStorage } from '@/lib/deepseek-v41-reference'
import type { V41Scenario } from '@/lib/deepseek-v41-reference'
import V41RankFlow from '@/components/V41RankFlow'
import ModelWorkspaceTabs from '@/components/ModelWorkspaceTabs'
import V41LearningGuide from '@/components/V41LearningGuide'
import { comparisonParams } from '@/lib/model-comparison'

const panel = 'mt-5 rounded-2xl border border-white/10 bg-[#0b141e] p-4 sm:p-6'
const control = 'mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#101e29] p-3 text-white'
const modes = { window: 'SWA-only', full: 'Full', reindex: 'Reindex', reuse: 'Reuse' }
const shape = (axes: number[]) => `[${axes.join(', ')}]`

export default function DeepseekV41() {
  const [params, setParams] = useSearchParams()
  const { state, notices } = parseV41Scenario(params)
  const canonical = v41Params(state).toString()
  const [copied, setCopied] = useState('')
  const [pendingTarget, setPendingTarget] = useState<{ id: string; scenario: string } | null>(null)
  const view = state.view ?? 'diagram'
  const update = (next: Partial<V41Scenario>) => setParams(v41Params({ ...state, ...next }), { replace: true, preventScrollReset: true })
  const locate = (next: Partial<V41Scenario>, target: string) => {
    setPendingTarget({ id: target, scenario: v41Params({ ...state, ...next }).toString() })
    update(next)
  }
  useEffect(() => {
    // Router transitions may commit after local state. Focus only once the destination is visible.
    if (!pendingTarget || canonical !== pendingTarget.scenario) return
    const target = document.getElementById(pendingTarget.id)
    target?.scrollIntoView({ block: 'start' })
    target?.focus({ preventScroll: true })
    setPendingTarget(null)
  }, [canonical, pendingTarget])
  const layer = v41Layer(state.layer)
  const cache = v41Cache(state.batch, state.sequence, state.storage)
  const query = v41Query(state.layer, state.sequence - 1)
  const tpRank = state.rank % state.world, replica = Math.floor(state.rank / state.world)
  const N = state.batch * (state.phase === 'prefill' ? state.sequence : 1)
  const uniform = state.weightMode === 'native' ? undefined : Number(state.weightMode) as 4 | 8 | 16 | 32
  const weights = v41Weights(state.layer, state.world).map((weight) => ({ ...weight, storage: v41WeightStorage(weight, uniform) }))
  const totalWeights = weights.reduce((sum, weight) => sum + weight.storage.bytes, 0)
  useEffect(() => { const previous = document.title; document.title = 'DeepSeek-V4.1 · 官方参考实现实验'; return () => { document.title = previous } }, [])
  async function copy() {
    const url = new URL(window.location.href); url.search = ''; url.hash = `/models/deepseek-v4-1-flash?${canonical}`
    try { await navigator.clipboard.writeText(url.toString()); setCopied(canonical) } catch { setCopied('failed') }
  }
  return <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 text-white">
    <ModelSectionNav />
    <Link to="/models" className="text-sm text-cyan-100 hover:underline">← 返回模型目录</Link>
    {state.sequence >= 1024 ? <Link to={`/models/compare?${comparisonParams({ modelIds: ['deepseek-v4-1-flash', 'deepseek-v4-flash'], scenario: { batch: state.batch, sequence: state.sequence, tp: state.world as 1 | 2 | 4 | 8, cacheBytes: 2, phase: 'decode' }, scope: 'rank', v41Storage: state.storage })}`} className="ml-5 inline-block text-sm text-violet-100 hover:underline">携带 B / S / world 对照 V4 缓存（单副本）</Link> : <span className="ml-5 inline-block text-xs text-white/50">跨模型对比要求 S ≥ 1,024；不自动改写当前长度。</span>}
    <p className="mt-7 font-mono text-xs tracking-widest text-violet-200">REFERENCE LAB / CSA2 · SINGLE-PASS mHC</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">DeepSeek-V4.1-Flash</h1>
    <p className="mt-4 max-w-4xl text-base leading-7 text-white/70">40 层因果 Encoder–Decoder：跨层 KV 与索引复用、逐 rank 权重分片和量化存储。</p>
    <div className="mt-4 rounded-xl border border-amber-200/25 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100">已接入目录与缓存对比，但此页采用官方最小实现，不能当成 SGLang 部署验证。参考 forward 顺序运行 40 层；模型卡的 8B Prefill / 16B Decode 是 CED 优化口径，本页没有实现跳过后 20 层的优化或 SWA Bounded Replay。</div>
    <p className="mt-3 text-sm text-white/55">主干标称 552B，Engram 另约 196B；不把主干参数、全检查点与稀疏激活参数混为一谈。数值来源：<a className="text-cyan-100 hover:underline" href="https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash" target="_blank" rel="noreferrer">官方模型卡 ↗</a></p>
    {notices.length > 0 && <p role="status" className="mt-4 text-sm text-amber-100">{notices.join(' ')}</p>}
    <section className={panel} aria-label="V4.1 实验配置">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">观察 Layer {state.layer}<input aria-label="V4.1 层号" type="range" min={0} max={39} value={state.layer} onChange={(e) => update({ layer: Number(e.target.value) })} className="mt-4 w-full accent-violet-200" /></label>
        <label className="text-sm">参考 world = Attention TP = Expert EP：{state.world}<input aria-label="V4.1 world" type="range" min={0} max={3} value={Math.log2(state.world)} onChange={(e) => update({ world: 2 ** Number(e.target.value) })} className="mt-4 w-full accent-cyan-200" /></label>
        <label className="text-sm">独立 DP 副本：{state.replicas}<input aria-label="V4.1 独立副本" type="range" min={0} max={3} value={Math.log2(state.replicas)} onChange={(e) => update({ replicas: 2 ** Number(e.target.value) })} className="mt-4 w-full accent-cyan-200" /></label>
        <label className="text-sm">教学 Rank：{state.rank}<input aria-label="V4.1 rank" type="range" min={0} max={state.world * state.replicas - 1} value={state.rank} onChange={(e) => update({ rank: Number(e.target.value) })} className="mt-4 w-full accent-cyan-200" /></label>
        <label className="text-sm">阶段<select aria-label="V4.1 阶段" className={control} value={state.phase} onChange={(e) => update({ phase: e.target.value as V41Scenario['phase'] })}><option value="prefill">参考 Prefill · 全层执行</option><option value="decode">普通 Decode · 单 token</option></select></label>
        <label className="text-sm">每副本 B<select aria-label="V4.1 请求数" className={control} value={state.batch} onChange={(e) => update({ batch: Number(e.target.value) })}>{[...new Set([1, 2, 4, 8, 16, 32, 64, state.batch])].sort((a, b) => a - b).map((n) => <option key={n}>{n}</option>)}</select></label>
        <label className="text-sm">S / 每请求长度<select aria-label="V4.1 序列长度" className={control} value={state.sequence} onChange={(e) => update({ sequence: Number(e.target.value) })}>{[...new Set([1, 2, 127, 128, 4095, 4096, 16384, 16385, 1048576, state.sequence])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label>
        <div className="flex items-end"><button type="button" onClick={copy} className="min-h-12 w-full rounded-xl border border-white/20 px-4 py-3 text-sm">{copied === canonical ? '已复制实验链接' : copied === 'failed' ? '复制失败，请重试' : '复制实验链接'}</button></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/60">共 {state.world * state.replicas} 张卡、{state.batch * state.replicas} 个不同请求。Rank {state.rank} = 独立副本 {replica} / 本地 rank {tpRank}；参考实现按 heads 做 Attention TP，但 routed 专家完整分配给各 rank，shared 专家每卡完整复制。这里 world 同时决定 Attention TP 与完整专家 EP，不能与 SGLang 的独立 EP / MoE-TP 配置混用。</p>
    </section>
    <ModelWorkspaceTabs view={view} onSelect={(view) => update({ view })} />
    <V41LearningGuide state={state} onChange={update} onLocate={locate} />
    <p aria-label="V4.1 当前共享配置" className="mt-4 text-sm leading-6 text-cyan-100">Layer {state.layer} · Rank {state.rank} · world {state.world} / 独立 DP {state.replicas} · {state.phase} · B={state.batch} / S={state.sequence} · 缓存 {state.storage} · 权重 {state.weightMode}。工作区共享同一组实验条件。</p>
    <div role="tabpanel" id="workspace-panel-diagram" aria-labelledby="workspace-tab-diagram" tabIndex={0} hidden={view !== 'diagram'} className="focus-visible:outline-cyan-200">
    <section className={`${panel} scroll-mt-24`} id="v41-boundaries" tabIndex={-1} aria-label="V4.1 端到端边界与待续">
      <h2 className="text-xl font-semibold">从输入到输出，以及尚未展开的分支</h2>
      <p className="mt-3 text-sm leading-7 text-white/70">文本 ID → 词表 Embedding；图像可先经过 32 层 ViT（H=1024、16 heads、14×14 patch、2D RoPE、双向 Attention），再做 3×3 pixel-unshuffle 与 9216→5120→5120 两层投影，替换 image span embedding → 扩展四路 → 40 层主干（Layer 1/14 注入 Engram）→ Layer 39 ffn_pre 合并 → Norm → LM Head → 采样。</p>
      <p className="mt-3 text-sm leading-7 text-white/65">DSpark 另有 3 个辅助层，读取主干 Layer 37/38/39 的 Attention 输入均值，不是它们的层输出；block size=5，辅助 MoE 128 experts / Top-3。官方最小仓库提供 forward_spec，但未实现完整 speculative loop。本实验尚未提供视觉分辨率、DSpark 验证循环、CED 优化 Prefill、SWA Replay 或 SGLang DPA 的交互，不把这些分支计入当前权重与缓存数字。</p>
    </section>
    <section className={`${panel} scroll-mt-24`} id="v41-sources" tabIndex={-1} aria-label="CSA2 跨层来源">
      <h2 className="text-xl font-semibold">Layer {state.layer} · {layer.region === 'encoder' ? 'Encoder 0–19' : 'Decoder 20–39'} · {modes[layer.mode]}</h2>
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">{Array.from({ length: 40 }, (_, i) => { const entry = v41Layer(i); return <button type="button" key={i} aria-label={`观察 V4.1 Layer ${i}`} aria-pressed={state.layer === i} onClick={() => update({ layer: i })} className={`min-h-14 rounded-lg border px-1 py-2 text-xs ${state.layer === i ? 'border-cyan-200 bg-cyan-200/15' : entry.ownsKv ? 'border-violet-200/40 bg-violet-200/5' : 'border-white/15'}`}>{i}<span className="mt-1 block text-[10px]">{modes[entry.mode]}</span></button> })}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['主 KV', layer.kvSource], ['Index K', layer.indexKeySource], ['Top-k 位置表', layer.topKSource], ['候选池', layer.candidateSource]].map(([label, source]) => <div key={String(label)} className="rounded-xl bg-white/5 p-3"><p className="text-sm text-white/60">{label} 来源</p>{source === null ? <p className="mt-2 text-white/50">不使用</p> : <button type="button" className="mt-2 text-cyan-100 hover:underline" aria-label={`跳转${label}来源 Layer ${source}`} onClick={() => update({ layer: source as number })}>Layer {source} ↗</button>}</div>)}</div>
      <p className="mt-4 text-sm leading-6 text-white/70">{layer.mode === 'full' ? 'Full 写入自己的主 KV 与 Index K，并重新选 Top-k。' : layer.mode === 'reindex' ? 'Reindex 读取既有主 KV / Index K，仅重新计算本层 query 对历史位置的排序。' : layer.mode === 'reuse' ? 'Reuse 连 Top-k 位置表也复用，但仍计算本层 Q、滑窗 KV 和 Attention 输出。' : '前两层只有原始位置滑窗，不生成或读取全局压缩记录。'} 每层独立 SWA 窗口；只有 4 层拥有全局主 KV / Index K 缓存。24/28/32/36 是重新索引层，不是新的 KV owner。</p>
      <p className="mt-3 text-sm leading-6 text-white/65">最后 query 的原始位置 {state.sequence - 1}；已可见全局记录 {query.records.toLocaleString('en-US')}，最多读取 {query.selectedPositions} 个 Top-k 位置。{layer.ratio ? `本层 ratio=${layer.ratio}，C2 必须在两个原始 token 都到齐后才形成记录，C1 每 token 一条。` : ''}</p>
      {layer.candidateSource !== null && <p className="mt-3 rounded-xl border border-cyan-200/15 p-3 text-sm leading-6 text-cyan-100">Layer 20 候选筛选：{query.visibleBlocks.toLocaleString('en-US')} 个可见 8-position 块中最多保留 {query.keptBlocks.toLocaleString('en-US')} 块（不超过 16,384 个位置）；钉住最新块 {query.pinnedBlock}。后续 Reindex 只在候选内做 Top-512。未模拟 learned 分数，不伪造实际命中的块或位置。</p>}
    </section>
    <section className={`${panel} scroll-mt-24`} id="v41-layer-flow" tabIndex={-1} aria-label="V4.1 单层数据流">
      <h2 className="text-xl font-semibold">Single-Pass mHC：pre 来自上一个子层</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">主干 [{N}, 4, 5120]，单路子层 [{N}, 5120]。每个子层只执行一次，四路不是四份 Attention。分支输入的 RMSNorm 与 mHC 打分使用的无参数 RMS 归一化不同。</p>
      {layer.engram && <div className="mt-4 rounded-xl border border-lime-200/25 p-3 text-sm leading-6"><h3 className="text-lime-100">首先注入 Engram · Layer {state.layer}</h3><p className="mt-2 text-white/70">文本 2/3/4-gram × 8 heads → 24 个哈希 ID → [{N},24,256] → 6144 维拼接 → 4×5120 个 key + 5120 维 shared value。按每路归一化点积、signed sqrt 与 sigmoid 得到门控，写入四路主干；图像 span 屏蔽 Engram。表共 {layer.engram.rows.toLocaleString('en-US')} 行；查询稀疏不代表只存 24 行权重。</p></div>}
      <ol className="mt-4 grid list-none gap-3 p-0 lg:grid-cols-2">{[
        ['Attention 输入与系数', `从四路输入计算本层 attn_pre/post/comb；当前 Attention 却使用 ${layer.attentionPreFrom} 合并四路，再做 Norm。新 attn_pre 留给 FFN。`],
        ['Attention 与合回四路', `Q [${N},${64 / state.world},512]；本层 SWA + ${layer.ratio ? `来源 Layer ${layer.kvSource} 的全局 KV` : '无全局分支'}。使用本层 attn_post/comb 合并输出与保留 residual。`],
        ['FFN 输入与系数', `由更新后的四路主干计算 ffn_pre/post/comb；使用 ${layer.ffnPreFrom} 合并四路，再 Norm、Top-6 MoE。ffn_pre 留给下一层。`],
        ['MoE 与合回四路', `本 rank 持有专家 ${tpRank * 384 / state.world}–${(tpRank + 1) * 384 / state.world - 1}，每个专家完整 5120→2304→5120；routed 结果跨 rank 合并后加每卡 shared 专家。用 ffn_post/comb 写回四路，向下一层携带 ffn_pre。`],
      ].map(([title, body], i) => <li key={title} className="rounded-xl border border-white/10 p-4"><h3 className="text-cyan-100">{i + 1}. {title}</h3><p className="mt-2 text-sm leading-6 text-white/70">{body}</p></li>)}</ol>
      <p className="mt-4 text-sm leading-6 text-white/60">第 0 层由 one-hot [1,0,0,0] 初始化 pre；第 39 层后，用其 FFN 产生的 pre 合并四路，Norm 后进入词表。没有另学一个 V4 式动态 hc_head。上图是依赖讲解，不是已测量的通信时序。</p>
    </section>
    <div className="mt-4 flex flex-wrap gap-3 text-sm"><button type="button" onClick={() => locate({ view: 'weights' }, 'v41-rank-flow')} className="min-h-11 rounded-xl border border-cyan-200/25 px-4 text-cyan-100">保留条件查看逐 rank 张量</button><button type="button" onClick={() => locate({ view: 'cache' }, 'v41-cache')} className="min-h-11 rounded-xl border border-cyan-200/25 px-4 text-cyan-100">保留条件查看缓存</button></div>
    </div>
    <div role="tabpanel" id="workspace-panel-cache" aria-labelledby="workspace-tab-cache" tabIndex={0} hidden={view !== 'cache'} className="focus-visible:outline-cyan-200">
    <section className={`${panel} scroll-mt-24`} id="v41-cache" tabIndex={-1} aria-label="V4.1 缓存格式实验">
      <h2 className="text-xl font-semibold">缓存：紧凑格式 ≠ 参考代码的 BF16 buffer</h2>
      <label className="mt-4 block text-sm">存储口径<select aria-label="V4.1 缓存口径" className={control} value={state.storage} onChange={(e) => update({ storage: e.target.value as V41Scenario['storage'] })}><option value="reference">参考实现：量化后反量化写回 BF16</option><option value="packed">紧凑格式设计：打包值 + 量化 scale</option></select></label>
      <p className="mt-3 text-sm leading-6 text-white/70">紧凑格式：主 KV 每条 256 B E2M1 + 32 B E4M3 scale；Index K 每条 64 B E2M1 + 4 B E8M0 scale；SWA 每条 512 B E4M3 + 16 B E8M0 scale。参考 kernel 的 inplace=True 会量化再反量化，写回原 BF16 数值，不能据 FP4 函数名把 buffer 当成半字节。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['全局 KV + Index K', cache.globalBytes], ['40 层 SWA 有效记录', cache.windowBytes], ['3 个 C2 的 FP32 增量状态', cache.compressorBytes]].map(([label, bytes]) => <div key={String(label)} className="rounded-xl bg-white/5 p-3"><p className="text-sm text-white/60">{label}</p><p className="mt-2 font-mono text-xl text-cyan-100">{formatBytes(bytes as number)}</p></div>)}</div>
      <p className="mt-4 font-mono text-xl text-white">每 rank 已占用记录与增量状态：{formatBytes(cache.total)}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">本副本各 rank 都有这些缓存，不除 world；所有副本/卡的总量为 {formatBytes(cache.total * state.world * state.replicas)}。全局紧凑格式对偶数 S 为 890×B×S 字节，不含 SWA 与增量状态；S 为奇数时按 floor(S/2) 计算。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{cache.owners.map((owner) => <div key={owner.layer} className="rounded-xl border border-white/10 p-3 text-sm"><p className="text-violet-100">Owner Layer {owner.layer} · ratio {owner.ratio}</p><p className="mt-2 text-white/65">{owner.records.toLocaleString('en-US')} 条 / 请求；主 KV {formatBytes(owner.mainBytes)} + Index K {formatBytes(owner.indexBytes)}</p><button type="button" onClick={() => locate({ layer: owner.layer, view: 'diagram' }, 'v41-sources')} className="mt-2 min-h-11 text-cyan-100 hover:underline">定位 Owner Layer {owner.layer}</button></div>)}</div>
      <p className="mt-4 text-sm leading-6 text-amber-100/80">这是选定口径的张量载荷，不是整卡显存预算。{cache.referenceAllocatedAtContext !== null ? `参考代码按 max_batch_size/max_seq_len 预分配；若 max_batch_size=B、max_seq_len=1M，仅这些缓存 buffer 与增量状态就为 ${formatBytes(cache.referenceAllocatedAtContext)} / rank。` : '紧凑格式是按已核对的量化分组计算的设计载荷，不表示最小参考代码已经按此物理格式保存缓存。'} 未计候选 bool mask、Top-k 位置表、Prefill 全历史工作区、页尾、通信、图捕获及 DSpark。</p>
    </section>
    </div>
    <div role="tabpanel" id="workspace-panel-weights" aria-labelledby="workspace-tab-weights" tabIndex={0} hidden={view !== 'weights'} className="focus-visible:outline-cyan-200">
    <V41RankFlow state={state} onChange={update} />
    <section className={`${panel} scroll-mt-24`} id="v41-weights" tabIndex={-1} aria-label="V4.1 参考权重布局">
      <h2 className="text-xl font-semibold">Layer {state.layer} · Rank {state.rank} 权重布局</h2>
      <label className="mt-4 block text-sm">权重格式<select aria-label="V4.1 权重格式" className={control} value={state.weightMode} onChange={(e) => update({ weightMode: e.target.value as V41Scenario['weightMode'] })}><option value="native">参考混合格式 · 包含 scale</option>{[4, 8, 16, 32].map((bits) => <option key={bits} value={String(bits)}>统一 {bits}-bit 假设 · 不含 scale</option>)}</select></label>
      <p className="mt-3 font-mono text-xl text-violet-100">本层图示权重：{formatBytes(totalWeights)} / rank</p>
      <p className="mt-2 text-sm leading-6 text-white/60">参考混合格式按源码的参数声明与转换后运行时格式计算：routed FP4 每 32 输入通道一个 E8M0 scale；FP8 Linear 的 scale 为 32×32 block；Engram 按每行 32 通道；wo_a 为 BF16，mHC 为 FP32。Uniform 选项仅对比理论载荷，不改变实际支持。此表不含其他层、Embedding、LM Head、视觉与 DSpark。</p>
      <div className="mt-4 space-y-3">{weights.map((weight) => <details key={weight.name} className="min-w-0 rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer break-words text-white/80">{weight.name} · {formatBytes(weight.storage.bytes)}</summary><div className="mt-3 space-y-2 break-words font-mono text-xs leading-6 text-cyan-100"><p>逻辑 {shape(weight.shape)} × {weight.copies} 份</p><p>{uniform ? `${uniform}-bit 理论载荷` : `${weight.dtype} · payload ${shape(weight.storage.payloadShape)}`}</p>{weight.storage.scaleShape.length > 0 && <p>scale {shape(weight.storage.scaleShape)} × {weight.copies} 份 E8M0 · {formatBytes(weight.storage.scaleBytes)}</p>}<p>placement: {weight.placement}</p></div></details>)}</div>
      <p className="mt-3 text-sm leading-6 text-white/60">MoE 单专家实际输入是 [T_e,5120]，激活 [T_e,2304]，输出 [T_e,5120]；T_e 由真实路由决定，不从 N/{384 / state.world} 伪造均匀值。Top-6 控制激活数量，不改变常驻本地专家权重。</p>
    </section>
    <button type="button" onClick={() => locate({ view: 'diagram' }, 'v41-layer-flow')} className="mt-4 min-h-11 rounded-xl border border-cyan-200/25 px-4 text-sm text-cyan-100">返回当前层结构与残差流</button>
    </div>
    <footer className={panel} aria-label="V4.1 核对来源">
      <div className="mt-4 flex flex-wrap gap-4 text-sm">{[['配置', 'config.json'], ['参考主干', 'inference/model.py'], ['量化 kernel', 'inference/kernel.py'], ['视觉', 'inference/vision.py']].map(([label, path]) => <a key={path} href={v41Source(path)} target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">{label} ↗</a>)}<Link to="/category/model-architecture" className="text-cyan-100 hover:underline">学习模型架构</Link></div>
      <p className="mt-3 break-words font-mono text-xs text-white/45">核对 revision：{v41Reference.revision} · 不是实机推理结果</p>
    </footer>
  </main>
}
