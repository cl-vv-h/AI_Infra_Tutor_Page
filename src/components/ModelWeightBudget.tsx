import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Layers3 } from 'lucide-react'
import type { ArchitectureNode, ModelArchitecture, TensorParallelSize } from '@/types/model'
import { decoderWeightBudget } from '@/lib/model-weights'
import type { WeightBits } from '@/lib/model-weights'
import { formatBytes } from '@/lib/model-lab'
import type { MixedPrecision } from '@/lib/mixed-precision'

const number = (value: number | null) => value === null ? '未计算' : value.toLocaleString('en-US')
const memory = (value: number | null) => value === null ? '未计算' : formatBytes(value)

export default function ModelWeightBudget({ model, layer, tp, bits, ep = 1, replicas = 1, mixed, selectedId, onBits, onSelect }: {
  model: ModelArchitecture; layer: number; tp: TensorParallelSize; bits: WeightBits; ep?: TensorParallelSize; replicas?: TensorParallelSize; selectedId: string
  onBits: (bits: WeightBits) => void; onSelect: (node: ArchitectureNode) => void
  mixed?: MixedPrecision
}) {
  const budget = useMemo(() => decoderWeightBudget(model, layer, tp, bits, ep, mixed), [model, layer, tp, bits, ep, mixed])
  return <section aria-label="Decoder 权重账本" id="weight-decoder-section" tabIndex={-1} className="mt-4 scroll-mt-24 rounded-2xl border border-white/10 bg-[#0b1119] p-4 focus-visible:outline-violet-200 sm:p-5">
    <h3 className="text-base font-medium text-white"><Layers3 className="mr-2 inline h-4 w-4 text-violet-200" />Decoder 权重账本 <span className="ml-2 text-sm font-normal text-white/60">Layer {layer} · 每卡 {memory(budget.bytes)} · {mixed ? '自定义混合格式（含 scale）' : `${bits}-bit 理论载荷`}</span></h3>
    <p className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm leading-6 text-amber-100">统计范围：只含图示 Decoder，不是完整 checkpoint，也不是可部署单卡显存。Embedding、LM Head、视觉塔与运行时内存另算。1 TB = 10¹² B；1 TiB = 2⁴⁰ B，不能直接比较标签数字。</p>
    <details className="mt-3 text-sm leading-6 text-white/65"><summary className="cursor-pointer">TP={tp}、EP={ep}、MoE-TP={tp / ep} · 查看账本规则</summary><p className="mt-2">从图中的矩阵 Shape 逐项相乘，查看本层权重分布。点击模块可回到结构图；与逐 rank 面板及模块详情共用权重布局。本卡全部本地专家常驻，不能仅计 Top-k。</p><p className="mt-2">本层全局 · 不重复计 TP 副本：{number(budget.global)} 元素。这是去重逻辑参数元素数，不是单卡字节或运行时分配。</p></details>
    {!mixed && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="权重存储位宽"><span className="mr-2 text-sm text-white/70">统一假定位宽</span>{([16, 8, 4, 32] as const).map((value) => <button key={value} type="button" aria-pressed={bits === value} onClick={() => onBits(value)} className={`rounded-xl border px-4 py-2 text-sm ${bits === value ? 'border-violet-200/50 bg-violet-200/15 text-violet-100' : 'border-white/15 text-white/60 hover:bg-white/5'}`}>{value}-bit</button>)}</div>}
    <p className="mt-2 text-sm leading-6 text-white/55">精度不改变逻辑 Shape 或 KV 格式，不等于该模型/硬件支持对应量化。混合方案按每项实际选择的存储协议相加。</p>
    {mixed?.experts === 'w4afp8' && <p className="mt-2 text-sm leading-6 text-violet-100">W4A8 权重阶段：{mixed.w4Stage === 'processed' ? '后处理 · BF16 重排 weight scale、每矩阵一个 FP32 input scale' : '初始分配 · FP32 weight scale、按专家 BF16 input scale'}。此选择贯通本层、全部 Decoder 和所有副本；其余模块仍按所选存储假设。运行元数据在逐 rank 面板另列。</p>}
    {!budget.complete && <p role="status" className="mt-3 text-amber-100">部分 Shape 尚未提供可计算定义，合计暂不展示。</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Decoder 分范围字节汇总">
      {[['本层每卡 · 图示权重', budget.bytes], [`全部 ${model.dimensions.layers} 层每卡 · 图示权重`, budget.allLayersBytes], [`全部 Decoder / ${replicas} 个副本 × TP ${tp}`, budget.allLayersBytes === null ? null : budget.allLayersBytes * tp * replicas]].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-sm text-white/60">{label}</p><p className="mt-2 break-words font-mono text-lg text-violet-100">{memory(value as number | null)}</p><p className="mt-1 break-words text-xs text-white/55">{typeof value === 'number' ? `${number(value)} B` : '未计算'}</p></div>)}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{budget.rows.map((row) => {
      const share = budget.bytes && row.bytes !== null ? row.bytes / budget.bytes * 100 : 0
      return <div key={row.node.id} className="rounded-xl border border-white/10 p-4">
        <button type="button" aria-pressed={selectedId === row.node.id} aria-label={`定位权重模块：${row.node.title}`} onClick={() => onSelect(row.node)} className="w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-200">
          <span className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium text-white">{row.node.title}</span><span className="font-mono text-violet-100">{memory(row.bytes)} · {share.toFixed(2)}%</span></span>
          <span aria-hidden="true" className="mt-3 block h-2 overflow-hidden rounded-full bg-white/10"><span className={`block h-full rounded-full ${row.node.tone === 'ffn' ? 'bg-violet-300' : 'bg-cyan-200'}`} style={{ width: `${share}%` }} /></span>
        </button>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-white/60">{number(row.local)} 元素 / 卡 · 展开逐项公式</summary><ul className="mt-3 space-y-3">{row.weights.map((weight) => <li key={weight.name} className="border-l border-white/15 pl-3"><p className="break-words text-white/75">{weight.name}</p><p className="mt-1 break-words font-mono text-violet-100">{weight.shape}{weight.copies > 1 ? ` × ${weight.copies} 份` : ''} → {number(weight.local)}</p></li>)}</ul></details>
      </div>
    })}</div>
    <details className="mt-4 text-sm leading-6 text-white/65"><summary className="cursor-pointer">如何从本层累加到所有副本？</summary>
    <p className="mt-2">{mixed ? `每卡按张量逐项累加 payload 与 scale = ${memory(budget.bytes)}` : `每卡元素数 ${number(budget.local)} × ${bits} / 8 = ${memory(budget.bytes)}`}。TP 组总副本量为每卡值 × {tp}，不等于全局唯一参数量；Norm、路由器及部分 KV 投影可能复制。MoE 的 Top-k 激活量不等于常驻权重，混合模型的全层总计按实际层型逐层相加。</p>
    <p className="mt-3 text-sm leading-6 text-cyan-100">全部图示 Decoder 权重 / {replicas} 个独立副本：{memory(budget.allLayersBytes === null ? null : budget.allLayersBytes * tp * replicas)}（每卡 × {tp} × {replicas}）。DP 不改变单卡 Shape；固定 TP 时改变 EP 重排专家轴和中间维，本基线的 routed 每卡总元素数不变。</p>
    </details>
    <p className="mt-3 text-sm leading-6 text-amber-100">{mixed ? '当前混合方案已计所选协议的 scale；' : '统一位宽未计 scale；'}均未计图外权重、buffer、额外对齐、KV/循环状态、激活与运行时工作区。实际原生 checkpoint 还需逐项核对 dtype，不把自定义方案称为原生总量。</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm"><Link to="/category/quantization" className="text-cyan-100 hover:underline">学习量化与存储</Link><a href="https://huggingface.co/docs/transformers/main/en/quantization/concept_guide" target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">量化概念与额外元数据 ↗</a><a href={model.configUrl} target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">核对模型配置 ↗</a></div>
  </section>
}
