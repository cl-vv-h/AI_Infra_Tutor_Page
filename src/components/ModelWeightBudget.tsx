import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Layers3 } from 'lucide-react'
import type { ArchitectureNode, ModelArchitecture, TensorParallelSize } from '@/types/model'
import { decoderWeightBudget } from '@/lib/model-weights'
import type { WeightBits } from '@/lib/model-weights'
import { formatBytes } from '@/lib/model-lab'

const number = (value: number | null) => value === null ? '未计算' : value.toLocaleString('en-US')
const memory = (value: number | null) => value === null ? '未计算' : formatBytes(value)

export default function ModelWeightBudget({ model, layer, tp, bits, selectedId, onBits, onSelect }: {
  model: ModelArchitecture; layer: number; tp: TensorParallelSize; bits: WeightBits; selectedId: string
  onBits: (bits: WeightBits) => void; onSelect: (node: ArchitectureNode) => void
}) {
  const budget = useMemo(() => decoderWeightBudget(model, layer, tp, bits), [model, layer, tp, bits])
  return <details className="mt-4 rounded-2xl border border-white/10 bg-[#0b1119] p-4 sm:p-5">
    <summary className="cursor-pointer text-base font-medium text-white"><Layers3 className="mr-2 inline h-4 w-4 text-violet-200" />Decoder 权重账本 <span className="ml-2 text-sm font-normal text-white/60">Layer {layer} · 每卡 {memory(budget.bytes)} · {bits}-bit 理论载荷</span></summary>
    <p className="mt-4 text-base leading-7 text-white/70">从图中的矩阵 Shape 逐项相乘，查看本层权重分布。点击模块可回到结构图；TP 切分与复制按当前图解约定计算，EP = 1，全部专家权重常驻。</p>
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="权重存储位宽"><span className="mr-2 text-sm text-white/70">统一假定位宽</span>{([16, 8, 4, 32] as const).map((value) => <button key={value} type="button" aria-pressed={bits === value} onClick={() => onBits(value)} className={`rounded-xl border px-4 py-2 text-sm ${bits === value ? 'border-violet-200/50 bg-violet-200/15 text-violet-100' : 'border-white/15 text-white/60 hover:bg-white/5'}`}>{value}-bit</button>)}</div>
    <p className="mt-2 text-sm leading-6 text-white/55">只改变理论存储量，不改变 Shape 或 KV 精度。4/8-bit 不表示该模型、硬件或所有向量都支持对应量化。</p>
    {!budget.complete && <p role="status" className="mt-3 text-amber-100">部分 Shape 尚未提供可计算定义，合计暂不展示。</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {[['本层每卡 · 图示权重', memory(budget.bytes)], ['本层全局 · 不重复计 TP 副本', `${number(budget.global)} 元素`], [`全部 ${model.dimensions.layers} 层每卡 · 图示权重`, memory(budget.allLayersBytes)]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-sm text-white/60">{label}</p><p className="mt-2 break-words font-mono text-lg text-violet-100">{value}</p></div>)}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{budget.rows.map((row) => {
      const share = budget.local && row.local !== null ? row.local / budget.local * 100 : 0
      return <div key={row.node.id} className="rounded-xl border border-white/10 p-4">
        <button type="button" aria-pressed={selectedId === row.node.id} aria-label={`定位权重模块：${row.node.title}`} onClick={() => onSelect(row.node)} className="w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-200">
          <span className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium text-white">{row.node.title}</span><span className="font-mono text-violet-100">{memory(row.bytes)} · {share.toFixed(2)}%</span></span>
          <span aria-hidden="true" className="mt-3 block h-2 overflow-hidden rounded-full bg-white/10"><span className={`block h-full rounded-full ${row.node.tone === 'ffn' ? 'bg-violet-300' : 'bg-cyan-200'}`} style={{ width: `${share}%` }} /></span>
        </button>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-white/60">{number(row.local)} 元素 / 卡 · 展开逐项公式</summary><ul className="mt-3 space-y-3">{row.weights.map((weight) => <li key={weight.name} className="border-l border-white/15 pl-3"><p className="break-words text-white/75">{weight.name}</p><p className="mt-1 break-words font-mono text-violet-100">{weight.shape}{weight.copies > 1 ? ` × ${weight.copies} 份` : ''} → {number(weight.local)}</p></li>)}</ul></details>
      </div>
    })}</div>
    <p className="mt-4 text-sm leading-6 text-white/65">每卡元素数 {number(budget.local)} × {bits} / 8 = {memory(budget.bytes)}。TP 组总副本量为每卡值 × {tp}，不等于全局唯一参数量；Norm、路由器及部分 KV 投影可能复制。MoE 的 Top-k 激活量不等于常驻权重，混合模型的全层总计按实际层型逐层相加。</p>
    <p className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/5 p-3 text-sm leading-6 text-amber-100">这是图示 Decoder 张量的理论载荷，不是完整模型参数量或可部署显存。未计 Embedding、LM Head（包括共享权重）、视觉编码器、MTP、图中未列的 buffer、量化 scale/zero-point、对齐、KV/循环状态、激活及运行时工作区。实际低精度模型通常混合多种数据类型。</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm"><Link to="/category/quantization" className="text-cyan-100 hover:underline">学习量化与存储</Link><a href="https://huggingface.co/docs/transformers/main/en/quantization/concept_guide" target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">量化概念与额外元数据 ↗</a><a href={model.configUrl} target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">核对模型配置 ↗</a></div>
  </details>
}
