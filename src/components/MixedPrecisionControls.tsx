import { useLayoutEffect, useRef } from 'react'
import { defaultMixedPrecision, availableMixedExperts, matrixPrecisions, mixedPrecisionLabels, hasRoutedOverrides } from '@/lib/mixed-precision'
import type { ExpertPrecision, MixedPrecision } from '@/lib/mixed-precision'
import type { TensorParallelSize } from '@/types/model'
import WeightPrecisionEditor from './WeightPrecisionEditor'
import { getModelArchitecture } from '@/data/models'
import { modulePrecisionOptions } from '@/lib/weight-precision-policy'

export default function MixedPrecisionControls({ value, hasDense = true, denseOnly = false, modelId = '', tp = 1, ep = 1, attentionTp = tp, layer = 0, compact = false, onChange }: { value?: MixedPrecision; hasDense?: boolean; denseOnly?: boolean; modelId?: string; tp?: number; ep?: number; attentionTp?: number; layer?: number; compact?: boolean; onChange: (value: MixedPrecision | undefined) => void }) {
  const routedOnly = modelId === 'qwen3-30b-a3b'
  const expertOptions = availableMixedExperts(modelId, tp, ep)
  const moduleOptions = modelId ? modulePrecisionOptions(getModelArchitecture(modelId), tp as TensorParallelSize, ep as TensorParallelSize) : undefined
  const splitExperts = hasRoutedOverrides(value)
  const latest = useRef(value)
  useLayoutEffect(() => { latest.current = value }, [value])
  function change(fields: Partial<MixedPrecision>) {
    const next = { ...(latest.current ?? defaultMixedPrecision), ...fields }
    latest.current = next
    onChange(next)
  }
  return <section aria-label="按模块选择精度" className="mt-5 rounded-2xl border border-violet-200/25 bg-[#101720] p-4 sm:p-5">
    <h3 className="font-semibold text-white">权重精度方案</h3>
    <div className="mt-3 flex flex-wrap gap-2">{[{ label: '统一位宽 · 理论对照', mixed: false }, { label: '按模块混合精度', mixed: true }].map(item => <button key={item.label} type="button" aria-pressed={!!value === item.mixed} onClick={() => { if (!!value !== item.mixed) onChange(item.mixed ? { ...defaultMixedPrecision } : undefined) }} className={`min-h-11 rounded-xl border px-3 text-sm ${!!value === item.mixed ? 'border-violet-200/50 bg-violet-200/10 text-violet-100' : 'border-white/15 text-white/65'}`}>{item.label}</button>)}</div>
    {value ? <>
      <div className={`mt-4 grid gap-3 ${denseOnly || routedOnly ? '' : compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>{(['mlp', 'shared', 'experts'] as const).filter(key => (!denseOnly || key === 'mlp') && (!routedOnly || key === 'experts')).map(key => {
        const options: readonly ExpertPrecision[] = (key === 'experts' ? expertOptions : matrixPrecisions).filter(format => !moduleOptions || moduleOptions[key].includes(format))
        const label = { mlp: 'Dense MLP', shared: 'Shared MLP', experts: 'Routed MoE' }[key]
        return <label key={key} className="text-sm leading-6 text-white/75">{label}<span className="block text-xs text-violet-100">{key === 'mlp' && !hasDense ? '本模型无 Dense MLP' : mixedPrecisionLabels[value[key]]}</span><select aria-label={`${label} 精度`} disabled={key === 'mlp' && !hasDense} value={value[key]} className="mt-3 block min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-[#101e29] p-2 text-sm text-white disabled:opacity-40" onChange={e => change({ [key]: e.target.value })}>{options.map(format => <option key={format} value={format}>{mixedPrecisionLabels[format]}</option>)}</select></label>
      })}</div>
      {hasDense && !denseOnly && !routedOnly && <button type="button" disabled={moduleOptions && !moduleOptions.mlp.includes('fp8')} onClick={() => onChange({ ...defaultMixedPrecision, mlp: 'fp8' })} className="mt-4 min-h-11 rounded-lg border border-white/20 px-3 text-sm text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">应用预设：Dense FP8 / Experts BF16</button>}
      <p className="mt-2 text-xs leading-5 text-white/50">精度选项按当前分片的矩阵维度与量化对齐要求筛选；调整 TP / EP 后，不兼容的模块默认格式会提示并恢复 BF16。</p>
      {routedOnly && <p className="mt-3 text-xs leading-6 text-white/65">MoE-TP={tp / ep} · I_local={768 / (tp / ep)}。FP8 block、INT4 group 128 与 W4A8 按分片对齐过滤；无 Dense/Shared MLP 或 correction bias。官方配置与 SGLang 普通 Router 是 BF16；FP32 为本页默认自定义假设。</p>}
      {!denseOnly && value.experts === 'w4afp8' && !splitExperts && <label className="mt-4 block text-sm leading-6 text-white/75">W4A8 权重阶段<select aria-label="W4A8 权重阶段" value={value.w4Stage ?? 'allocated'} onChange={e => change({ w4Stage: e.target.value === 'processed' ? 'processed' : undefined })} className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#101e29] p-3 text-white"><option value="allocated">初始分配 · FP32 scale</option><option value="processed">后处理 · BF16 scale</option></select></label>}
      <details className="mt-3 text-xs leading-6 text-white/65"><summary className="cursor-pointer">默认格式与覆盖规则</summary><p>模块默认用于全部适用 Decoder 层；未覆盖的 Attention / Norm 为 BF16，Router / correction bias 为 FP32 自定义假设。逐权重覆盖可分别修改它们。权重格式不改变模块边界激活或 KV 精度；不是原生检查点清单或部署支持声明。</p></details>
      {modelId && <WeightPrecisionEditor modelId={modelId} tp={tp as TensorParallelSize} ep={ep as TensorParallelSize} attentionTp={attentionTp as TensorParallelSize} layer={layer} value={value} onChange={onChange} />}
      {splitExperts && <p className="mt-3 text-xs leading-6 text-amber-100">专家逐权重方案使用拆分逻辑矩阵账本，不套用融合 W4A8 后处理与运行元数据。</p>}
      <details className="mt-4 text-xs leading-6 text-white/65"><summary className="cursor-pointer">格式、scale 与统计边界</summary>
        <ul className="mt-3 list-disc space-y-2 pl-4">
          <li>BF16 / FP16 / FP32：每元素 2 / 2 / 4 B，无量化 scale。</li>
          <li>FP8 E4M3：128×128 block 或每逻辑矩阵一个 FP32 scale；两者单独选择。</li>
          <li>INT8：对称 per-output-channel，FP32 scale；INT4：对称 group 128，FP32 scale。无 zero-point，不等同于 LLM.int8()、AWQ 或 GPTQ。</li>
          <li>MXFP4：E2M1，group 32，UINT8 容器承载 E8M0 scale。NVFP4：E2M1，group 16，FP8 E4M3 block scale，另含每逻辑矩阵 FP32 global scale。</li>
          <li>W4A8：保留 SGLang W4AFp8 专家路径，INT4 权重 / FP8 激活。初始 weight scale 为 FP32、input scale 为 BF16；已核对后处理转换为 BF16 重排 scale 和 FP32 标量 input scale。</li>
        </ul>
        <p className="mt-3">统计 payload、weight scale、global scale 与已有静态 input scale；不含激活动态 scale、转换峰值、kernel workspace、KV 或通信缓冲。NVFP4 / per-tensor FP8 以每个 Gate、Up 和每位专家各自的逻辑矩阵计 scale，不假定后端融合共享。</p>
        <div className="mt-3 flex flex-wrap gap-4"><a className="text-cyan-100 hover:underline" href="https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/" target="_blank" rel="noreferrer">NVIDIA FP4 格式 ↗</a><a className="text-cyan-100 hover:underline" href="https://huggingface.co/docs/transformers/quantization/concept_guide" target="_blank" rel="noreferrer">量化粒度与对称格式 ↗</a><a className="text-cyan-100 hover:underline" href="https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py" target="_blank" rel="noreferrer">W4AFp8 固定实现 ↗</a></div>
      </details>
    </> : <p className="mt-3 text-sm leading-6 text-white/65">统一位宽仅为理论载荷；启用混合方案后可设置模块默认、逐权重与单层覆盖，并计入 scale。</p>}
  </section>
}
