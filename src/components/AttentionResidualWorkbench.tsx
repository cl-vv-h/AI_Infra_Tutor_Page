import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatBytes, tokenCount } from '@/lib/model-lab'
import { attentionResidualStage, residualSnapshotLabel } from '@/lib/attention-residual'

export default function AttentionResidualWorkbench({ model, layer, scenario, onLayer }: { model: ModelArchitecture; layer: number; scenario: InferenceScenario; onLayer: (n: number) => void }) {
  const block = model.execution.residualBlockSize!
  const s = attentionResidualStage(layer, block)
  const slots = Math.ceil(model.dimensions.layers / block)
  return <section aria-label="Attention Residual 深度实验" className="mb-5 rounded-2xl border border-amber-200/30 bg-amber-200/5 p-4 text-sm leading-6 text-white/70">
    <h3 className="text-base font-semibold text-amber-100">Attention Residual · 跨层残差聚合</h3>
    <p className="mt-3"><strong className="text-white">跨层残差快照缓冲区（bank）</strong>保存同一 token 的输入表示及已完成残差块的输出累加值，供后续层加权聚合。这里的 bank 是实现中的张量容器，不是硬件存储体，也不是 KV Cache。</p>
    <p className="mt-2">块内累加状态（prefix）保存当前残差块已执行子层的输出之和；这里的 prefix 不指提示词前缀或前缀缓存。</p>
    <p className="mt-3">Layer {layer}：Attention 聚合前已有 <strong className="text-white">{s.bankBefore} 个快照</strong>；{layer === 0 ? '尚无已写入快照，直接使用输入表示。' : `与当前块内累加状态一起构成 ${s.attentionCandidates} 个候选。`} 聚合系数由候选表示和本子层的可学习打分向量计算；本图不展示实际运行时的系数。</p>
    <ol className="mt-4 grid gap-3 lg:grid-cols-3">
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">01 · 聚合</span><p className="mt-2">{layer === 0 ? '直接使用输入表示，经归一化后送入 Attention。' : '对已保存快照与当前块内累加状态加权聚合，经归一化后送入 Attention。'}</p></li>
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">02 · {s.write ? '保存 / 重置' : '保留'}</span><p className="mt-2">{s.write ? `块边界：将「${residualSnapshotLabel(s.bankBefore, block)}」写入快照槽位 ${s.bankBefore}，重置块内累加状态。` : '非块边界：不新增快照，保留当前块内累加状态。'}</p></li>
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">03 · 累加</span><p className="mt-2">{s.write ? '以 Attention 输出初始化新块的累加状态。' : '将 Attention 输出加入块内累加状态。'} FFN 再从 {s.ffnCandidates} 个候选聚合；FFN 输出加入同一累加状态。</p></li>
    </ol>
    <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-amber-100">本层 FFN 可读快照</summary><ul className="mt-3 space-y-2">{Array.from({ length: s.bankAfter }, (_, i) => <li key={i} className="rounded-lg bg-black/15 p-2"><span className="font-mono text-amber-100">快照槽位 {i}</span> · {residualSnapshotLabel(i, block)}</li>)}<li className="rounded-lg border border-cyan-100/25 p-2 text-cyan-100">块内累加状态 · 当前块内已执行子层的输出和</li></ul></details>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="AttnRes 边界跳转">{[0, 11, 12, 13, 84, 92].filter(n => n < model.dimensions.layers).map(n => <button key={n} type="button" onClick={() => onLayer(n)} aria-pressed={layer === n} className="rounded-lg border border-amber-100/25 px-3 py-2 text-amber-100 hover:bg-amber-100/10 aria-pressed:bg-amber-100/15">观察 Layer {n}</button>)}</div>
    <div aria-label="残差快照缓冲区容量" className="mt-4 rounded-xl border border-amber-100/20 p-3">
      <p className="text-amber-100">每卡快照缓冲区 · BF16：<span className="font-mono">[{tokenCount(scenario).toLocaleString('en-US')}, {slots}, {model.dimensions.hiddenSize}] = {formatBytes(tokenCount(scenario) * slots * model.dimensions.hiddenSize * 2)}</span></p>
      <p className="mt-2">维度为 [本次处理的 token 数 N, 预留快照槽位数, 隐藏维度 H]。预留 {slots} 个槽位不表示当前层已经写入 {slots} 个快照。</p>
      <details className="mt-2"><summary className="cursor-pointer text-amber-100">生命周期与统计边界</summary>
        <p className="mt-2">快照仅在当前前向计算（forward）内有效；下一次 Decode 不复用上一 token 的快照。与之不同，KV Cache 跨解码步保留历史 token 的键值表示，供后续 token 使用。</p>
        <p className="mt-2">本页采用 PP=1、Attention DP=1、无序列并行的基准：各 TP rank（并行进程）保留完整 H 维表示。EP 改变路由专家的分片与分配，不缩减该缓冲区。完整 Prefill 的 N=B×S，单步 Decode 的 N=B；分块 Prefill 应以实际调度的 token 数为准。</p>
        <p className="mt-2">容量按 N×{slots}×H×2 字节计算，仅包含预留快照张量，不含块内累加状态、聚合打分及其他临时工作区；不计入 KV Cache 并发预算。以上为 BF16 容量假设，实际张量精度随隐藏状态精度确定。</p>
        <a href="https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/attn_residual.py" target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-100 hover:underline">SGLang AttnResidual 实现依据 ↗</a>
      </details>
    </div>
  </section>
}
