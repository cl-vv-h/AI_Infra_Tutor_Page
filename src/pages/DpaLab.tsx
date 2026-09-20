import { useState } from 'react'
import ModelSectionNav from '@/components/ModelSectionNav'
import { Link, useSearchParams } from 'react-router-dom'
import { dpaLayout, dpaParams, dpaSizes, dpaSource, parseDpa } from '@/lib/dpa-lab'
import type { DpaModelId, DpaScenario } from '@/lib/dpa-lab'
import { formatBytes } from '@/lib/model-lab'
import DpaBufferMap from '@/components/DpaBufferMap'
import MixedPrecisionControls from '@/components/MixedPrecisionControls'
import MixedWeightDetails from '@/components/MixedWeightDetails'
import W4RuntimeMetadata from '@/components/W4RuntimeMetadata'
import QwenDenseLayout from '@/components/QwenDenseLayout'

const panel = 'mt-5 rounded-2xl border border-white/10 bg-[#0b141e] p-4 sm:p-6'
const select = 'mt-2 block w-full rounded-xl border border-white/20 bg-[#101e29] p-3 text-white'
export default function DpaLab({ modelId = 'glm-5-2' }: { modelId?: DpaModelId }) {
  const [params, setParams] = useSearchParams()
  const { state, notices } = parseDpa(params, modelId)
  const data = dpaLayout(state, modelId), selected = data.selected, group = selected.group
  const { model, gqa } = data, dimensions = model.dimensions
  const [copied, setCopied] = useState('')
  const canonical = dpaParams(state, modelId).toString()
  const copyKey = `${modelId}?${canonical}`
  const processedW4 = state.mixed?.experts === 'w4afp8' && state.mixed.w4Stage === 'processed'
  const update = (next: Partial<DpaScenario>) => setParams(dpaParams({ ...state, ...next }, modelId), { replace: true })
  const changeRequests = (index: number, n: number) => update({ requests: state.requests.map((b, i) => i === index ? n : b) })
  async function copy() {
    const url = new URL(window.location.href); url.search = ''; url.hash = `/models/${modelId}/dpa?${canonical}`
    try { await navigator.clipboard.writeText(url.toString()); setCopied(copyKey) } catch { setCopied('failed') }
  }
  return <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 text-white">
    <ModelSectionNav />
    <Link to={`/models/${modelId}`} className="text-sm text-cyan-100 hover:underline">← {model.name} 结构图</Link>
    <p className="mt-6 font-mono text-xs tracking-widest text-cyan-200">SGLANG / DP ATTENTION LAB</p>
    <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">同一组卡，两种并行划分</h1>
    <p className="mt-4 max-w-4xl text-base leading-7 text-white/70">{model.name}：Attention 按请求分组，FFN 汇合各组 token。拖动 DPA{gqa ? '' : '、EP'} 和每组负载，跟踪每张卡处理的数据、权重 Shape 与缓存，不假设所有组一样忙。{gqa && '本模型是 GQA + Dense，没有专家并行；DPA 不保证减少全卡 KV。'}</p>
    <nav className="mt-3 flex flex-wrap gap-4 text-sm" aria-label="DPA 模型对照"><Link className="text-cyan-100 hover:underline" to="/models/glm-5-2/dpa">GLM-5.2 · MLA / MoE</Link><Link className="text-cyan-100 hover:underline" to="/models/qwen3-8b/dpa">Qwen3-8B · GQA / Dense</Link><span className="text-white/55">切换模型使用该模型默认条件</span></nav>
    <details className="mt-4 rounded-xl border border-amber-200/25 p-4 text-sm leading-6 text-amber-100" aria-label="DPA 实验边界"><summary className="cursor-pointer">独立 DPA 实验条件 · 展开固定基线与限制</summary><p className="mt-3">不改变普通 TP 工作区。固定 SGLang 源码基线：CP=PP=MoE-DP=1、A2A=none、Dense MLP 使用总 TP；无图捕获、量化通信、Gatherv、两批重叠、EPLB、冗余专家、shared 融合或 shared TP1；关闭 Dense fully-DP、LayerNorm SP 与确定性 RL 特殊分支。这里不是 DeepEP All-to-All，也不是硬件部署承诺。</p></details>
    {notices.length > 0 && <p role="status" className="mt-3 text-sm text-amber-100">{notices.join(' ')}</p>}
    <section className={panel} aria-label="DPA 配置">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[
        ['总 TP / 卡数', 'tp', [1, 2, 4, 8]], ['Attention DP', 'dp', dpaSizes(state.tp)], ...(!gqa ? [['Expert EP', 'ep', dpaSizes(state.tp)]] : []),
      ].map(([label, key, choices]) => { const field = key as 'tp' | 'dp' | 'ep', values = choices as number[]; return <label key={field} className="text-sm">{label as string}：{state[field]}<input key={values.join(',')} aria-label={`DPA ${field}`} type="range" min={0} max={values.length - 1} value={values.indexOf(state[field])} aria-valuetext={String(state[field])} onChange={(e) => update({ [field]: values[Number(e.target.value)] })} className="mt-4 w-full accent-cyan-200" /></label> })}
        <label className="text-sm">Layer {state.layer} · {data.dense ? 'Dense' : 'MoE'}<input key={modelId} aria-label="DPA layer" type="range" min={0} max={dimensions.layers - 1} value={state.layer} onChange={(e) => update({ layer: Number(e.target.value) })} className="mt-4 w-full accent-violet-200" /></label>
        <label className="text-sm">阶段<select aria-label="DPA 阶段" className={select} value={state.phase} onChange={(e) => update({ phase: e.target.value as DpaScenario['phase'] })}><option value="decode">Decode / 每请求 1 token</option><option value="prefill">完整 Prefill / 每请求 S tokens</option></select></label>
        <label className="text-sm">每请求历史 S<select aria-label="DPA 序列长度" className={select} value={state.sequence} onChange={(e) => update({ sequence: Number(e.target.value) })}>{[...new Set([1, 128, 1024, 4096, 16384, model.execution.maxContext, state.sequence])].filter(n => n <= model.execution.maxContext).sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}</select></label>
        {!state.mixed && <label className="text-sm">统一权重位宽<select aria-label="DPA 权重位宽" className={select} value={state.bits} onChange={(e) => update({ bits: Number(e.target.value) as DpaScenario['bits'] })}>{[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n}-bit 理论值</option>)}</select></label>}
        <button type="button" onClick={copy} className="min-h-12 self-end rounded-xl border border-white/20 px-4 py-3 text-sm">{copied === copyKey ? '已复制 DPA 链接' : copied === 'failed' ? '复制失败，请重试' : '复制 DPA 实验链接'}</button>
      </div>
      <p className="mt-4 text-sm text-cyan-100">{state.tp} 张卡 · Attention TP={data.attentionTp} · {gqa ? `Dense TP=${state.tp}` : `MoE-TP=${data.moeTp}`}。{gqa ? 'Attention DP 在同一组卡内划分，没有 EP；' : 'DP 和 EP 在同一组卡内划分，不额外相乘；'}DP=1 即退回普通 Attention TP。</p>
    </section>
    <MixedPrecisionControls value={state.mixed} denseOnly={gqa} onChange={mixed => update({ mixed })} />
    <section className={panel} aria-label="DPA 请求分组">
      <h2 className="text-xl font-semibold">每个 Attention 组有自己的请求</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.groups.map((g) => <div key={g.dpRank} className="rounded-xl border border-white/15 p-3"><label className="text-sm">DPA {g.dpRank}：{g.requests} 个请求<input aria-label={`DPA 组 ${g.dpRank} 请求数`} type="range" min={0} max={64} value={g.requests} onChange={(e) => changeRequests(g.dpRank, Number(e.target.value))} className="mt-4 w-full accent-cyan-200" /></label><p className="mt-2 text-xs leading-6 text-white/60">有效 N={g.tokens.toLocaleString('en-US')} · 本卡保留缓存 {formatBytes(g.cacheBytes)}</p><div className="mt-3 flex flex-wrap gap-2">{g.peers.map((rank) => <button key={rank} type="button" aria-label={`DPA 观察 Rank ${rank}`} aria-pressed={state.rank === rank} onClick={() => update({ rank })} className={`min-h-11 rounded-lg border px-3 text-sm ${state.rank === rank ? 'border-cyan-200 bg-cyan-200/15 text-cyan-100' : 'border-white/15 text-white/65'}`}>R{rank}</button>)}</div></div>)}</div>
      <p className="mt-4 text-sm leading-6 text-white/60">合计 {data.totalRequests} 个不同请求、{data.totalTokens.toLocaleString('en-US')} 个有效 token。组内各 Attention TP rank 协作同一批；组间是不同请求。0 表示本示例无请求，也不保留旧前缀缓存；不代表真实空闲服务器会释放全部缓存和权重。</p>
    </section>
    <section className={panel} aria-label="DPA rank 数据流">
      <h2 className="text-xl font-semibold">Rank {state.rank} · DPA {selected.dpRank} / Attention TP rank {selected.attentionRank}</h2>
      <p className="mt-3 text-sm leading-6 text-cyan-100">Attention peers：R{group.peers.join(' / R')} · Q heads {selected.headsStart}–{selected.headsEnd}。{data.dense ? '当前 Dense 层不执行 routed 专家。' : `EP rank ${selected.epRank} / MoE-TP rank ${selected.moeTpRank}；本地专家 ${selected.expertStart}–${selected.expertEnd}。`}</p>
      {!data.dense && <p className="mt-2 text-sm leading-6 text-white/65">同专家分片组：R{selected.moeTpPeers.join(' / R')}；同 MoE-TP 坐标 EP 组：R{selected.epPeers.join(' / R')}。这些组可跨越 Attention DP 边界。</p>}
      <ol className="mt-4 grid list-none gap-3 p-0 lg:grid-cols-4">{[
        ['1 · Attention 有效数据', `[${group.tokens}, ${dimensions.hiddenSize}]`, `有效 Q [${group.tokens}, ${dimensions.attentionHeads / data.attentionTp}, ${dimensions.headDim}]；只查询本组请求的历史。Q/输出 heads 按 Attention TP=${data.attentionTp} 分片，${gqa ? `K/V heads ${selected.kvHeadsStart}–${selected.kvHeadsEnd}，并非整套 KV 复制。` : 'Indexer 仍复制。'}`],
        ['2 · Gather / 汇合', `[${data.bufferRows}, ${dimensions.hiddenSize}]`, data.totalTokens === 0 ? '全部组空闲：没有有效前向数据，不宣称必须发起通信。' : data.mode === 'NONE' ? 'DP=1 关闭 DPA，没有跨请求组 Gather；只需原有 Attention TP 输出归约。' : data.mode === 'MAX_LEN' ? `先按每组 ${group.padded} 行补齐；${data.attentionTp > 1 ? 'Attention TP 内 ReduceScatter，再在总 TP 内 AllGather。' : '在总 TP 内 AllGather。'}` : '各组写入全局零缓冲的不同区间，用总 TP AllReduce 汇合；不是简单拼接多个重复副本。'],
        [`3 · ${data.dense ? 'Dense' : 'MoE'} 本地计算`, `[${data.bufferRows}, ${dimensions.hiddenSize}]`, data.dense ? `Dense 中间维 ${dimensions.intermediateSize / state.tp}，按总 TP 分片。` : `Router 每卡可见整个汇合缓冲；单专家输入 [T_e,${dimensions.hiddenSize}]，中间激活 [T_e,${model.execution.expertIntermediateSize! / data.moeTp}]。T_e 由真实路由决定，不能用总 token 数除专家数。`],
        ['4 · 合并并返回原组', `[${group.tokens}, ${dimensions.hiddenSize}]`, gqa ? `Qwen2MLP 的 Down 在总 TP 内归约；随后 dp_scatter 从本卡完整结果取 offset ${group.offset} 的本组区间，并非再次跨卡 ReduceScatter。DP=1 时不做跨组切片。这里显示去掉 padding 的有效输出。` : data.mode === 'NONE' ? 'DP=1 没有跨请求组 Scatter；完成原有 FFN 分片与专家的结果归约，输出仍属于同一批请求。' : `FFN 的部分和需要先正确归约，再取本组从 offset ${group.offset} 开始的区间，去掉 padding。实现可融合 ReduceScatter / Attention TP AllGather；这里显示有效输出，不假装 padding 是新请求。`],
      ].map(([title, shape, note]) => <li key={title} className="min-w-0 rounded-xl border border-cyan-200/15 p-4"><h3 className="text-sm text-cyan-100">{title}</h3><p className="mt-3 break-words font-mono text-violet-100">{shape}</p><p className="mt-3 text-sm leading-6 text-white/65">{note}</p></li>)}</ol>
      <p className="mt-3 text-xs leading-6 text-white/55">Attention 输入/输出展示有效 token；执行缓冲可能含本组补齐至 {group.padded} 行的无效槽。残差仍归原 Attention 组所有。归一化可在汇合前或后，取决于 Attention TP 与实现分支；此处展示数据归属边界，不把它伪装成逐 kernel 顺序。</p>
      <details className="mt-4 rounded-xl border border-white/15 p-3 text-sm" aria-label="DPA 边界张量载荷"><summary className="cursor-pointer text-cyan-100">展开本 rank 输入输出的 Shape 与字节</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{data.boundaryTensors.map(tensor => <div key={tensor.id} data-tensor-id={tensor.id} className="min-w-0 rounded-lg bg-white/5 p-3"><p className="text-white/70">{tensor.label}</p><p className="mt-2 break-words font-mono text-cyan-100">[{tensor.shape.join(', ')}] · {tensor.dtype}</p><p className="mt-2 text-violet-100">{formatBytes(tensor.bytes)} · {tensor.bytes.toLocaleString('en-US')} B</p></div>)}</div><p className="mt-3 text-xs leading-6 text-white/60">以上是四个数据边界的逻辑载荷，可能别名或分时复用，不能相加当作峰值显存或通信流量。FFN 行数含 padding，不是本组请求数。这里保持 BF16 模块输入输出；{gqa ? 'MLP 权重量化不把这些边界自动减半。' : 'W4A8 的 A8 只描述 kernel 内部量化激活，不会把这些边界自动减半。单专家 T_e 仍由路由决定。'}</p></details>
    </section>
    {gqa && <details aria-label="GQA DPA 内部张量" className={panel}><summary className="cursor-pointer text-cyan-100">继续拆解 QKV 与 Dense 内部 Shape / BF16 逻辑载荷</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.internalTensors.map(tensor => <div key={tensor.id} data-tensor-id={tensor.id} className="min-w-0 rounded-xl bg-white/5 p-3 text-sm"><p className="text-white/70">{tensor.label}</p><p className="mt-2 break-words font-mono text-cyan-100">[{tensor.shape.join(', ')}] × {tensor.copies} 份</p><p className="mt-2 text-violet-100">{tensor.bytes.toLocaleString('en-US')} B</p></div>)}</div><p className="mt-3 text-xs leading-6 text-white/60">Q/K/V 是融合 QKV 的分段视图，不能与融合容器重复相加；这里按 BF16 逻辑载荷对照，后续 Norm/RoPE 可生成新张量。QKV 只列本组有效 token，MLP 使用全局补齐行；FP8 kernel 内部量化激活和临时 scale 不在这里。各阶段分时执行，不将这些数字相加当作峰值显存。</p></details>}
    <section className={panel} aria-label="DPA padding 与缓存">
      <h2 className="text-xl font-semibold">有效 token、通信补齐与缓存是三件事</h2>
      <p className="mt-3 text-sm leading-6 text-white/70">{state.dp === 1 ? 'DP=1 关闭 DPA，无 DPA 补齐' : `先按 Attention TP=${data.attentionTp} 对齐每组数量`}：[{data.aligned.join(', ')}]。本基线选择 {data.mode}：Prefill 且 DP&gt;1 使用 SUM_LEN；DPA Decode 在 2×SUM ≥ DP×MAX 时使用 MAX_LEN。图捕获等其他模式可覆盖此选择。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['有效 token', data.totalTokens.toLocaleString('en-US')], ['FFN buffer 行数', `${data.bufferRows.toLocaleString('en-US')}（padding ${data.paddingRows.toLocaleString('en-US')}）`], [state.dp === 1 ? '单个 BF16 FFN 输入 / rank' : '单个 BF16 汇合 buffer / rank', formatBytes(data.globalBufferBytes)]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/55">{label}</p><p className="mt-2 break-words font-mono text-cyan-100">{value}</p></div>)}</div>
      <p className="mt-3 text-sm leading-6 text-white/65">SUM_LEN 候选 {data.sumBufferRows} 行，MAX_LEN 候选 {data.maxBufferRows} 行。缓冲区包含补齐行，不能把其行数当作实际请求数{!gqa && '或真实 expert assignment；是否屏蔽 padding 的专家路由由后端决定'}。BF16 只计一个张量载荷，不是传输字节、峰值显存或所有 workspace 之和。</p>
      <DpaBufferMap data={data} onSelectGroup={(dpRank) => update({ rank: dpRank * data.attentionTp + selected.attentionRank })} />
      <label className="mt-4 block text-sm">逻辑缓存精度<select aria-label="DPA 缓存精度" className={select} value={state.cacheBytes} onChange={(e) => update({ cacheBytes: Number(e.target.value) as 1 | 2 })}><option value={2}>每元素 2 B</option><option value={1}>每元素 1 B 假设（不含 scale）</option></select></label>
      <p className="mt-3 text-sm leading-7 text-lime-100">同样 {data.totalRequests} 个请求、同样 {state.tp} 张卡：普通 TP 全卡缓存 {formatBytes(data.normalTpCacheBytes)}；DPA 全卡缓存 {formatBytes(data.dpaCacheBytes)}。当前 Rank {state.rank} 为 {formatBytes(group.cacheBytes)}，{gqa ? '已按 Attention TP 划分 K/V heads，不再除一次。' : '组内复制，不再除 Attention TP。'}</p>
      {gqa ? <div aria-label="GQA DPA 缓存归属" className="mt-3 rounded-xl border border-lime-200/20 p-3 text-sm leading-6 text-white/70"><p className="text-lime-100">全卡 KV 不变，不等于每卡 KV 不变</p><p className="mt-2">当前 rank 的单层逻辑 K+V：[{data.cacheShape!.join(', ')}]，依次为本组请求、历史 S、K/V 两份、本地 KV heads、head_dim；乘 {dimensions.layers} 层及每元素 {state.cacheBytes} B，得到 {group.cacheBytes.toLocaleString('en-US')} B。KV heads {selected.kvHeadsStart}–{selected.kvHeadsEnd} 属于本 Attention TP 分片。</p><p className="mt-2">8 个 KV heads 在 Attention TP≤8 时完整分片，没有 KV head 复制。全卡合计 = 全部请求 × S × 36 × 2 × 8 × 128 × 每元素字节，因此不随 DPA 改变；但负载不均时各 rank 的缓存量不同。通信 padding 不写成历史 KV。</p><p className="mt-2 text-xs text-white/55">逻辑口径不含分页、前缀共享/驻留、scale、KV 容量预分配或检索临时空间。上下文配置上限 40,960；原生 32,768 与质量/扩展配置限制沿用模型说明。</p></div> : <p className="mt-2 text-xs leading-6 text-white/55">沿用 GLM-5.2 的 78 层 × 每历史位置 704 元素（MLA 512+64，Ascend Index K 全层预留 128）逻辑口径；未计分页、前缀驻留、scale、检索临时空间和最大上下文预分配。补齐通信行不写成新的历史 KV。</p>}
    </section>
    <section className={panel} aria-label="DPA 本层权重">
      <h2 className="text-xl font-semibold">Layer {state.layer} · 本卡图示权重 {formatBytes(data.layerWeightBytes)}</h2>
      <p className="mt-3 rounded-xl border border-amber-200/20 p-3 text-sm leading-6 text-amber-100">{processedW4 ? 'W4A8 已按后处理布局统计；其他模块按所选存储假设' : state.mixed ? '初始权重分配（含 scale）' : `统一 ${state.bits}-bit 理论载荷（不含 scale）`}，仅含图示 Decoder 权重与 scale；不是完整模型或部署显存。</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="DPA Decoder 权重汇总">{[
        ['当前层 / 本 rank', data.layerWeightBytes], [`${dimensions.layers} 层 / 本 rank`, data.allLayersWeightBytes], [`${dimensions.layers} 层 / 全部 ${state.tp} 张卡`, data.allRanksWeightBytes],
      ].map(([label, bytes], index) => <div key={label} className={`min-w-0 rounded-xl bg-white/5 p-3 ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}><p className="text-xs text-white/60">{label}</p><output className="mt-2 block break-words font-mono text-sm text-cyan-100 sm:text-base">{formatBytes(Number(bytes))}</output><p className="mt-1 break-words text-xs text-white/55">{Number(bytes).toLocaleString('en-US')} B</p></div>)}</div>
      <details className="mt-3 text-xs leading-6 text-white/60"><summary className="cursor-pointer">完整统计范围与加载后差异</summary><p className="mt-2">{gqa ? 'Qwen3 的 FP8 情景核对初始 E4M3 权重与 FP32 block scale，需要预先序列化的 FP8 checkpoint。' : 'W4A8 可选择初始分配或固定版本后处理：payload 不变，weight scale 转 BF16 并重排，gate/up 与 down 各保留一个 FP32 input scale。其他格式仍按所选假设，W4A8 运行元数据另列。'}不因此宣称全部模型已验证最终内存布局。不含 Embedding、LM Head、KV、激活、通信、转换峰值或 allocator；全层合计仍是图示 Decoder 权重与 scale 小计。</p></details>
      <p className="mt-3 text-sm leading-6 text-white/65">Attention 权重按 Attention TP={data.attentionTp}，{gqa ? `Dense MLP 按总 TP=${state.tp}；两套层 RMSNorm 与 Q/K Norm 复制。本模型无 Router、专家与 Indexer。` : `routed 按 EP=${state.ep} / MoE-TP=${data.moeTp}，shared 与 Dense 按总 TP=${state.tp}；Norm、低秩输入投影及 Indexer 复制。`}增加 DPA 可能增大本卡 Attention 权重，不会让所有矩阵一起缩小。</p>
      {gqa && state.mixed && <QwenDenseLayout tp={state.tp} policy={state.mixed} dpaRows={data.bufferRows} />}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.weights.map((w, i) => <details key={`${w.nodeId}-${i}`} className="min-w-0 rounded-xl border border-white/10 p-3 text-sm"><summary className="cursor-pointer break-words text-white/80">{w.name} · {formatBytes(w.bytes)}</summary><p className="mt-3 break-words font-mono text-cyan-100">{w.shape} × {w.multiplicity ?? 1} 份</p>{w.storage && <MixedWeightDetails storage={w.storage} copies={w.multiplicity ?? 1} />}<p className="mt-2 text-xs leading-6 text-white/55">{w.node} · {w.attention ? 'Attention TP 布局' : 'FFN / 复制布局'}{w.note ? `；${w.note}` : ''}</p></details>)}</div>
      {!data.dense && state.mixed?.experts === 'w4afp8' && <W4RuntimeMetadata experts={256 / state.ep} cards={state.tp} />}
      <p className="mt-4 text-xs leading-6 text-amber-100/80">每卡拥有不同分片或副本，但此基线各卡权重大小相同；全卡合计包含 DPA 引入的 Attention 复制，不是去重参数量。空闲组仍保留权重。切换当前层不改变 {dimensions.layers} 层总账；修改模块精度只改变对应层和模块，不改变 BF16 激活与缓存口径。</p>
    </section>
    <footer className="mt-6 text-sm leading-7 text-white/55">可核对的来源：{[['分组', 'distributed/parallel_state.py'], ['宽度', 'runtime_context.py'], ['数据汇合', 'layers/communicator.py'], ['补齐与通信', 'layers/dp_attention.py'], ['补齐顺序', 'model_executor/forward_batch_info.py'], ['模型主干', gqa ? 'models/qwen3.py' : 'models/deepseek_v2.py'], ...(gqa ? [['Dense MLP', 'models/qwen2.py'], ['行并行归约', 'layers/linear.py']] : [])].map(([label, file]) => <a key={file} href={dpaSource(file)} target="_blank" rel="noreferrer" className="ml-3 inline-block text-cyan-100 hover:underline">{label} ↗</a>)}<p className="mt-3">本页仅核对 {model.name} 的上述基线；其他模型、DPA+DeepEP、LM Head 的独立并行策略、混合阶段批次和多机启动仍须分别核验。</p></footer>
  </main>
}
