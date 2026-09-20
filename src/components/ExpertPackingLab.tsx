import type { ModelArchitecture } from '@/types/model'
import { formatBytes } from '@/lib/model-lab'
import { availableExpertFormats, expertPacking, expertPackingSource, expertFormatLabels } from '@/lib/expert-packing'
import type { ExpertFormat } from '@/lib/expert-packing'

const shape = (values: number[]) => `[${values.join(', ')}]`
const bytes = (value: number) => `${formatBytes(value)} · ${value.toLocaleString('en-US')} B`

export default function ExpertPackingLab({ model, experts, hidden, intermediate, tp, ep, replicas, rank, format, onFormat }: {
  model: ModelArchitecture; experts: number; hidden: number; intermediate: number; tp: number; ep: number
  replicas: number; rank: number; format: ExpertFormat; onFormat: (format: ExpertFormat) => void
}) {
  const formats = availableExpertFormats(model)
  if (!formats.length) return null
  const selected = formats.includes(format) ? format : 'bf16'
  const data = expertPacking(experts, hidden, intermediate, tp, selected)
  return <section aria-label="专家权重加载布局" className="mt-5 rounded-2xl border border-emerald-200/25 bg-emerald-200/[0.03] p-3 sm:p-4">
    <p className="font-mono text-xs tracking-widest text-emerald-200">EXPERT PACKING / LOAD TIME</p>
    <h4 className="mt-2 text-lg font-medium text-white">逻辑 Shape 与存储布局</h4>
    <p className="mt-2 text-sm leading-6 text-white/70">独立对照：把 SGLang 的加载分配规则应用到本层 routed 专家的逻辑 Shape，不代表当前检查点已量化，也不会修改上方统一位宽或下方整层账本。这里只算 routed 专家，不含 Router、shared 专家、latent 投影和其他模块。</p>
    {model.id === 'glm-5-2' && <p className="mt-2 text-sm leading-6 text-amber-100">GLM-5.2 公开配置声明 BF16，没有 quantization_config；这里不是 BF16 → FP8 检查点转换器。</p>}
    <label className="mt-4 block text-sm text-emerald-100">加载布局：{expertFormatLabels[selected]}<input aria-label="专家权重加载格式" className="mt-3 block w-full accent-emerald-200" type="range" min={0} max={formats.length - 1} step={1} value={formats.indexOf(selected)} aria-valuetext={expertFormatLabels[selected]} onChange={(event) => onFormat(formats[Number(event.target.value)])} /></label>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{formats.map((item) => {
      const option = expertPacking(experts, hidden, intermediate, tp, item)
      return <button key={item} type="button" aria-pressed={item === selected} onClick={() => onFormat(item)} className={`min-w-0 rounded-xl border p-2 text-left text-xs leading-5 ${item === selected ? 'border-emerald-200/60 bg-emerald-200/10 text-emerald-100' : 'border-white/15 text-white/65 hover:bg-white/5'}`}>
        <span className="block">{expertFormatLabels[item]}</span><span className="mt-1 block font-mono">{formatBytes(option.totalBytes)} / rank</span>
      </button>
    })}</div>
    <p className="mt-3 text-sm leading-6 text-white/70">Rank {rank}：E_local = {model.execution.expertParallel!.experts} / EP {ep} = {experts}，H = {hidden}，I_local = {model.execution.expertIntermediateSize} / MoE-TP {tp / ep} = {intermediate}。Top-k 只控制激活的专家，不减少常驻权重。</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{data.rows.map((row) => <article key={row.name} className="min-w-0 rounded-xl border border-white/15 p-3 text-sm leading-6">
      <h5 className="font-medium text-emerald-100">{row.name}</h5>
      <dl className="mt-2 space-y-2">
        <div><dt className="text-white/55">逻辑 [expert, out, in]</dt><dd className="break-words font-mono text-white/85">{shape(row.logicalShape)}</dd></div>
        <div><dt className="text-white/55">Payload · {row.payloadDtype}</dt><dd className="break-words font-mono text-emerald-100">{shape(row.payloadShape)}</dd><dd className="break-words text-xs text-white/65">{bytes(row.payloadBytes)}</dd></div>
        <div><dt className="text-white/55">Scale · {row.scaleDtype}</dt><dd className="break-words font-mono text-violet-100">{row.scaleShape ? shape(row.scaleShape) : '无 scale 张量'}</dd><dd className="break-words text-xs text-white/65">{bytes(row.scalesBytes)}</dd></div>
      </dl>
    </article>)}</div>
    <p className="mt-3 text-sm leading-6 text-white/70">{selected === 'bf16' ? '每个逻辑元素占 2 B，payload Shape 与逻辑 Shape 相同。' : selected === 'fp4-load' ? '每个 INT8 容器装两个 FP4，所以最后一轴减半；每行的 32 个逻辑输入元素另配一个 FP32 scale（4 B）。这不是 V4.1 参考实现的 E8M0 scale，也不是最终 kernel 重排后的布局。' : selected === 'mxfp8' ? '每个权重元素占 1 B；每行的 32 个输入元素配一个 UINT8/E8M0 scale（1 B）。' : '每个权重元素占 1 B；每个 128×128 权重块配一个 FP32 scale（4 B）。gate 与 up 各自分块，不能跨两者合并 scale。'}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3" aria-label="专家加载字节合计">{[
      ['Routed 专家 / rank', data.totalBytes], ['Routed 专家 / TP 组', data.totalBytes * tp], ['Routed 专家 / 所有副本', data.totalBytes * tp * replicas],
    ].map(([label, value]) => <div className="min-w-0 rounded-xl bg-white/5 p-3" key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-2 break-words font-mono text-sm text-emerald-100">{bytes(Number(value))}</p></div>)}</div>
    <p className="mt-3 text-sm leading-6 text-white/70">每 rank = payload {formatBytes(data.payloadBytes)} + scales {formatBytes(data.scalesBytes)}。相对 routed 专家 BF16 基线为 {(data.totalBytes / data.baselineBytes * 100).toFixed(2)}%；不是整模型压缩率。独立 DP 复制这些张量，不再切分其 Shape。</p>
    <details className="mt-3 text-xs leading-6 text-white/60"><summary className="cursor-pointer text-amber-100">使用前提与不计入的内存</summary>
      <p className="mt-2">固定 SGLang 96d91ef 的 create_fp8_moe_weight_，gated 专家、非 Aiter、非 HIP INT4、无 bias，FP4 scale dtype 使用默认值。FP8 block / MXFP8 对照要求已序列化的量化检查点与 dynamic activation scheme；不是选择格式就能启动任意模型。BF16 是无 scale 的逻辑基线。</p>
      <p className="mt-2">只计算加载时注册的权重和 scale 张量；不含量化转换峰值、post-load padding/shuffle/requantization、最终 kernel buffer、zero-point、allocator、通信、激活或 KV Cache。激活量化的临时张量另算，选择权重格式不等于设置输入输出 dtype。FP4 分支仅在已核对的 V4 路径开放，V4.1 继续使用其独立参考实现。</p>
    </details>
    <a className="mt-3 inline-block text-xs text-emerald-100 hover:underline" href={expertPackingSource} target="_blank" rel="noreferrer">核对加载时 payload / scale 分配源码 ↗</a>
  </section>
}
