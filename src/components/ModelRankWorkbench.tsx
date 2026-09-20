import { useMemo } from 'react'
import type { ModelArchitecture, TensorParallelSize } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { decoderNodes, formatBytes } from '@/lib/model-lab'
import { expertParallelSizes, rankModule, replicaSizes } from '@/lib/model-ranks'
import type { ReplicaSize } from '@/lib/model-ranks'
import type { WeightBits } from '@/lib/model-weights'
import ExpertPackingLab from '@/components/ExpertPackingLab'
import type { ExpertFormat } from '@/lib/expert-packing'
import type { MixedPrecision } from '@/lib/mixed-precision'
import MixedWeightDetails from '@/components/MixedWeightDetails'
import W4RuntimeMetadata from '@/components/W4RuntimeMetadata'
import AttentionHeadOwnership from '@/components/AttentionHeadOwnership'

const memory = (value: number | null) => value === null ? '未计算' : formatBytes(value)
const precisions = [4, 8, 16, 32] as const

export default function ModelRankWorkbench({ model, layer, scenario, nodeId, bits, replicas, rank, ep, expertFormat = 'bf16', mixed, onChange }: {
  model: ModelArchitecture; layer: number; scenario: InferenceScenario; nodeId: string; bits: WeightBits; replicas: ReplicaSize; rank: number; ep: ReplicaSize
  expertFormat?: ExpertFormat
  mixed?: MixedPrecision
  onChange: (next: { tp?: TensorParallelSize; replicas?: ReplicaSize; rank?: number; ep?: ReplicaSize; nodeId?: string; bits?: WeightBits; expertFormat?: ExpertFormat }) => void
}) {
  const modules = decoderNodes(model, layer)
  const selected = modules.find((node) => node.id === nodeId) ?? modules[0]
  const data = useMemo(() => rankModule(model, layer, selected.id, scenario, bits, replicas, ep, mixed), [model, layer, selected.id, scenario, bits, replicas, ep, mixed])
  const current = data.ranks[rank] ?? data.ranks[0]
  const allowedEp = expertParallelSizes(model, scenario.tp)
  const expert = data.expertExecution
  return <section aria-label="逐 rank 并行实验" id="weight-rank-section" tabIndex={-1} className="mt-5 scroll-mt-24 rounded-2xl border border-cyan-200/20 bg-[#0b141d] p-4 focus-visible:outline-cyan-200 sm:p-5">
    <p className="font-mono text-xs tracking-widest text-cyan-200">RANK LAB / TP × REPLICAS</p>
    <h3 className="mt-2 text-xl font-semibold text-white">逐 rank 看 Shape 与权重载荷</h3>
    <p className="mt-3 text-sm leading-6 text-white/70">先选择模块，再拖动配置或点选 rank。这里 DP 指独立服务副本，每个副本有自己的 TP 组；不是 --enable-dp-attention。B 始终是每副本请求数，增加 DP 不会减少每卡权重或把本地 B 再除一次。</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="text-sm text-white/75">TP / 副本：{scenario.tp}<input className="mt-3 block w-full accent-cyan-200" aria-label="Rank 实验 TP" type="range" min={0} max={model.supportedTp.length - 1} step={1} value={model.supportedTp.indexOf(scenario.tp)} aria-valuetext={String(scenario.tp)} onChange={(event) => onChange({ tp: model.supportedTp[Number(event.target.value)] })} /></label>
      <label className="text-sm text-white/75">独立 DP 副本：{replicas}<input className="mt-3 block w-full accent-cyan-200" aria-label="独立 DP 副本数" type="range" min={0} max={replicaSizes.length - 1} step={1} value={replicaSizes.indexOf(replicas)} aria-valuetext={String(replicas)} onChange={(event) => onChange({ replicas: replicaSizes[Number(event.target.value)] })} /></label>
      {mixed ? <p className="text-sm leading-6 text-violet-100">当前按模块混合精度<br />{model.id === 'qwen3-8b' ? 'Dense MLP 可选精度' : 'Router FP32'} · 权重与 scale 合计<br /><span className="text-xs text-white/60">请用上方模块精度滑块调整</span></p> : <label className="text-sm text-white/75">统一假定位宽：{bits}-bit<input className="mt-3 block w-full accent-violet-200" aria-label="Rank 实验权重位宽" type="range" min={0} max={precisions.length - 1} step={1} value={precisions.indexOf(bits)} aria-valuetext={`${bits}-bit`} onChange={(event) => onChange({ bits: precisions[Number(event.target.value)] })} /></label>}
    </div>
    {model.execution.expertParallel ? <div className="mt-4 rounded-xl border border-violet-200/20 p-3">
      {/* Recreate when bounds change: native clamping can leave React's range value tracker stale. */}
      <label className="block text-sm text-violet-100">EP：{ep} · 专家内部 MoE-TP：{data.moeTp}<input key={allowedEp.join(',')} aria-label="Rank 实验 EP" className="mt-3 block w-full accent-violet-200" type="range" min={0} max={Math.max(0, allowedEp.length - 1)} disabled={allowedEp.length === 1} step={1} value={allowedEp.indexOf(ep)} aria-valuetext={String(ep)} onChange={(event) => onChange({ ep: allowedEp[Number(event.target.value)] })} /></label>
      <details className="mt-3 text-xs leading-5 text-white/65"><summary className="cursor-pointer">EP 只划分现有 TP 组 · 查看执行条件</summary><p className="mt-2">EP 在现有 TP 组内部划分，不增加卡数。MoE-TP = TP / EP；只改变 routed experts，Attention 仍用完整 TP。此基线使用 moe-a2a-backend=none、MoE DP=1，关闭共享专家融合、EPLB、冗余专家及强制 shared TP1；共享 MLP 仍按完整 TP 分片。</p></details>
    </div> : <p className="mt-3 text-xs text-white/55">{model.execution.denseLayers === model.dimensions.layers ? '本模型为 Dense，没有 routed 专家，EP 不适用。' : '该模型暂未核对 EP 布局，当前 EP 固定为 1。'}</p>}
    <label className="mt-5 block text-sm text-white/75">本层观察模块<select aria-label="Rank 实验模块" className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#101e29] p-3 text-white" value={selected.id} onChange={(event) => onChange({ nodeId: event.target.value })}>{modules.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
    <p className="mt-3 text-sm leading-6 text-white/65">{replicas} 副本 × TP {scenario.tp} = {data.ranks.length} 张卡；{data.totalRequests} 个不同请求。示例各副本等长且同一阶段，不模拟调度器负载均衡。Rank 编号是教学编号，不是实际 launcher 的全局进程编号。</p>
    <div className="mt-4 rounded-xl border border-white/10 p-3" aria-label="独立副本与 TP rank 拓扑">
      <label className="block text-sm text-white/75">先选 DP 副本，再选 TP rank<select aria-label="观察 DP 副本" value={current.replica} onChange={event => onChange({ rank: Number(event.target.value) * scenario.tp + current.tpRank })} className="mt-2 block w-full rounded-xl border border-white/20 bg-[#101e29] p-3 text-white">{Array.from({ length: replicas }, (_, replica) => <option key={replica} value={replica}>DP {replica} · R{replica * scenario.tp}–R{(replica + 1) * scenario.tp - 1} · 请求 {replica * scenario.batch}–{(replica + 1) * scenario.batch - 1}</option>)}</select></label>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">{data.ranks.filter((item) => item.replica === current.replica).map((item) => <button type="button" key={item.rank} aria-label={`观察 Rank ${item.rank}`} aria-pressed={current.rank === item.rank} onClick={() => onChange({ rank: item.rank })} className={`min-h-12 rounded-lg border p-2 text-xs ${current.rank === item.rank ? 'border-cyan-200 bg-cyan-200/15 text-cyan-100' : 'border-white/15 text-white/60 hover:bg-white/5'}`}>R{item.rank}<span className="mt-1 block">TP {item.tpRank}</span></button>)}</div>
      <p className="mt-2 text-xs leading-5 text-white/55">只展开当前副本的 {scenario.tp} 个 ranks；切换副本保留 TP local 坐标，全部 {data.ranks.length} 个 ranks 都可选择。未隐藏其他副本的计算量。</p>
    </div>
    <h4 className="mt-5 font-medium text-white">Rank {current.rank} · DP {current.replica} / TP local {current.tpRank}</h4>
    {data.attentionHeads && <AttentionHeadOwnership ranks={data.attentionHeads} rank={current.rank} />}
    {model.execution.expertParallel && <details className="mt-3 rounded-xl border border-violet-200/20 p-3 text-sm leading-6 text-white/75" aria-label="专家归属与通信组">
      <summary className="cursor-pointer text-violet-100">EP rank {current.epRank} · MoE-TP rank {current.moeTpRank} / {data.moeTp} · 展开专家归属</summary>
      <p>Routed 专家 ID：{current.expertStart}–{current.expertEnd}（共 {model.execution.expertParallel.experts / ep} 个）</p>
      <p className="break-words">同一专家的 MoE-TP 分片组：R{current.moeTpPeers.join(' / R')}</p>
      <p className="break-words">相同 MoE-TP 坐标的 EP 组：R{current.epPeers.join(' / R')}</p>
      <p className="mt-2 text-xs text-white/55">连续专家编号仅适用于无 EPLB/冗余专家的本基线。非 MoE 模块不执行这些专家；它们的权重不会因为调大 EP 而缩小。</p>
    </details>}
    <p className="mt-2 text-sm leading-6 text-white/65">处理请求 {current.requestStart}–{current.requestEnd}，本轮 N={data.localTokens.toLocaleString('en-US')}。同一 TP 组协作处理同一批请求；不同 DP 副本处理不同请求。各 rank 的本地 Shape 相同，不代表 TP 分片数值相同；DP 对应 TP 分片则是副本。</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="模块边界逻辑载荷">{[
      { label: '模块输入', shape: data.input, payload: data.inputPayload },
      { label: '模块输出', shape: data.output, payload: data.outputPayload },
    ].map(({ label, shape, payload }) => <div key={label} aria-label={label} className="min-w-0 rounded-xl border border-white/10 p-3"><p className="text-xs text-white/60">{label}</p><p className="mt-2 break-words font-mono text-sm text-cyan-100">{shape}</p>
      <p className="mt-2 break-words text-xs leading-5 text-white/65">{payload.elements === null ? '复合或动态 Shape：未推断元素量' : `${payload.elements.toLocaleString('en-US')} 个逻辑元素${payload.operands! > 1 ? `（${payload.operands} 个操作数合计）` : ''}`}</p>
      {selected.tone === 'memory' ? <p className="text-xs leading-5 text-white/55">实际格式与字节见缓存工作区，不套用统一激活位宽。</p> : payload.referenceBytes !== null && <p className="break-words text-xs leading-5 text-cyan-100/80">2 B/元素参考：{memory(payload.referenceBytes)} · {payload.referenceBytes.toLocaleString('en-US')} B</p>}
    </div>)}</div>
    <p className="mt-2 text-xs leading-5 text-white/55">这里复用架构图的逻辑模块边界；输出可能已经完成 TP 归约。不是逐 kernel 激活、AllReduce 临时 buffer 或真实 token dispatch 轨迹。</p>
    <details className="mt-2 text-xs leading-5 text-white/60"><summary className="cursor-pointer">逻辑元素与参考载荷</summary><p className="mt-2">边界参考载荷按每元素 2 B（例如 BF16）计算，不声明所有模块实际使用该 dtype。改变权重量化或 KV 位宽不会改变这个参考；真实 kernel 可能另外量化、转型或添加 scale。内部张量仅计每个所列 Shape 的元素，不从名称猜 dtype 或份数。带 + 的输入合计各操作数，不表示新分配的拼接张量；输入、输出与 views 不能相加当作峰值显存。斜杠、箭头、动态符号和附注未消歧时不报精确总量。</p></details>
    <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="当前模块权重小计">{[['本模块 / rank', data.localBytes], ['本模块 / 一个 TP 组', data.groupBytes], ['本模块 / 所有 DP 副本', data.fleetBytes]].map(([label, bytes]) => <div key={String(label)} className="min-w-0 rounded-xl bg-white/5 p-3"><p className="text-xs text-white/60">{label}</p><p className="mt-2 break-words font-mono text-violet-100">{memory(bytes as number | null)}</p><p className="mt-1 break-words text-xs text-white/55">{typeof bytes === 'number' ? `${bytes.toLocaleString('en-US')} B` : '未计算'}</p></div>)}</div>
    <p className="mt-2 text-xs text-amber-100/80">以上只计当前层的当前模块；不是整个 Decoder 或完整模型。</p>
    {expert && <div className="mt-4 rounded-xl border border-cyan-200/20 p-3 text-sm leading-6 text-white/70" aria-label="本地专家激活 Shape">
      <h5 className="font-medium text-cyan-100">从模块边界继续拆到单个本地专家</h5>
      <p className="mt-2">本地专家输入：[T_e, {expert.hiddenSize}] → gate/up：[T_e, 2 × {expert.intermediate}] → 激活：[T_e, {expert.intermediate}] → down：[T_e, {expert.hiddenSize}]</p>
      <details className="mt-2"><summary className="cursor-pointer">T_e 由路由决定，不假设专家均匀分摊 · 查看范围</summary>
      <p className="mt-2">{data.moeTp > 1 ? 'down 结果只是该 MoE-TP 分片的部分和，仍需合并其他分片及选中专家的加权结果。' : '每个专家在单卡保存完整中间维，仍需按路由权重合并选中专家结果。'}</p>
      <p className="mt-2">T_e 是路由到专家 e 的 token 数，范围 0–{data.localTokens.toLocaleString('en-US')}；同一 EP 分组的分配条数 A = Σ T_e，范围 {expert.minLocalAssignments.toLocaleString('en-US')}–{expert.maxLocalAssignments.toLocaleString('en-US')}。所有 EP 分组的 A 合计 N × Top-{expert.topK}，不是再乘 MoE-TP。</p>
      <p className="mt-2 text-xs text-white/55">实际 T_e 取决于输入、Router 或 hash 表，不能由 B/S/EP 推出均匀负载。这里是逻辑逐专家拆解，不是实际 packed/padded kernel buffer；未运行路由，不显示伪造的精确 token 数。Kimi routed 专家使用 latent 宽度，shared 支路仍使用主干宽度。</p>
      </details>
    </div>}
    {!!data.tensors.length && <details className="mt-3 text-sm text-white/70"><summary className="cursor-pointer">展开本模块内部张量</summary><ul className="mt-3 space-y-2">{data.tensors.map((tensor) => <li key={tensor.label} className="min-w-0 border-l border-white/15 pl-3"><span>{tensor.label}</span><p className="break-words font-mono text-cyan-100">{tensor.shape}</p><p className="text-xs leading-5 text-white/65">{tensor.payload.elements === null ? '复合或动态 Shape：未推断元素量' : `所列 Shape：${tensor.payload.elements.toLocaleString('en-US')} 个逻辑元素`}</p>{tensor.note && <p className="text-xs leading-5 text-white/55">{tensor.note}</p>}</li>)}</ul></details>}
    {!data.complete && <p role="status" className="mt-3 text-amber-100">存在未解析权重，合计不展示，避免漏算。</p>}
    <div className="mt-4 space-y-3">{data.weights.map((weight) => <details key={weight.name} className="min-w-0 rounded-xl border border-white/10 p-3 text-sm">
      <summary className="cursor-pointer break-words text-white/80">{weight.name} · {memory(weight.bytes)}</summary>
      <p className="mt-3 break-words text-white/60">TP=1 逻辑 Shape：<span className="font-mono text-white/85">{weight.unshardedShape}</span></p>
      <p className="mt-2 break-words text-white/60">当前 rank Shape：<span className="font-mono text-cyan-100">{weight.shape}</span></p>
      {weight.storage ? <MixedWeightDetails storage={weight.storage} copies={weight.copies} /> : <p className="mt-2 break-words text-white/65">{weight.copies} 份张量，共 {weight.local?.toLocaleString('en-US') ?? '未知'} 元素 × {bits}/8 = {memory(weight.bytes)}</p>}
      {weight.note && <p className="mt-2 text-xs leading-5 text-white/55">{weight.note}</p>}
    </details>)}</div>
    {!data.weights.length && <p className="mt-3 text-sm text-white/65">该模块没有图示权重；零权重载荷不等于零运行时内存。</p>}
    {!mixed && <p className="mt-4 text-sm leading-6 text-amber-100/85">当前范围：EP={ep}、PP=1、独立 DP，无 DPA。本面板、Decoder 权重账本与结构图模块详情共用当前 EP 布局。Attention TP 不变，因此 EP 不改变每卡缓存。上方统一位宽只改变图示权重的理论载荷，逻辑 Shape 不变；不含 scale、zero-point、对齐、通信、激活和缓存。已核对的 routed 模块另提供专家加载对照，单独核算 payload 与 scale；不替换这份理论总账，也不是整模部署支持承诺。</p>}
    {mixed && <p className="mt-3 text-sm leading-6 text-violet-100">当前混合方案已替代统一位宽：上方总量包含所选格式的 payload、weight scale 和静态 input scale；未包含运行时额外内存。EP 与 DP 口径不变。</p>}
    {expert && mixed?.experts === 'w4afp8' && <W4RuntimeMetadata experts={expert.localExperts} cards={scenario.tp * replicas} />}
    {expert && !mixed && <ExpertPackingLab model={model} experts={expert.localExperts} hidden={expert.hiddenSize} intermediate={expert.intermediate} tp={scenario.tp} ep={ep} replicas={replicas} rank={current.rank} format={expertFormat} onFormat={(expertFormat) => onChange({ expertFormat })} />}
    <a className="mt-3 inline-block text-sm text-cyan-100 hover:underline" href="https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/docs/docs/advanced_features/dp_dpa_smg_guide.mdx" target="_blank" rel="noreferrer">核对 SGLang 独立 DP 与 DPA 的区别 ↗</a>
    {model.execution.expertParallel && <a className="mt-3 block text-sm text-cyan-100 hover:underline" href="https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/moe/fused_moe_triton/layer.py" target="_blank" rel="noreferrer">核对 FusedMoE 的专家轴与中间维分片 ↗</a>}
  </section>
}
