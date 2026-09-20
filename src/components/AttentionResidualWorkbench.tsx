import type { ModelArchitecture } from '@/types/model'
import type { InferenceScenario } from '@/lib/model-lab'
import { formatBytes, tokenCount } from '@/lib/model-lab'
import { attentionResidualStage, residualSnapshotLabel } from '@/lib/attention-residual'

export default function AttentionResidualWorkbench({ model, layer, scenario, onLayer }: { model: ModelArchitecture; layer: number; scenario: InferenceScenario; onLayer: (n: number) => void }) {
  const block = model.execution.residualBlockSize!
  const s = attentionResidualStage(layer, block)
  const slots = Math.ceil(model.dimensions.layers / block)
  return <section aria-label="Attention Residual 深度实验" className="mb-5 rounded-2xl border border-amber-200/30 bg-amber-200/5 p-4 text-sm leading-6 text-white/70">
    <h3 className="text-base font-semibold text-amber-100">同一个 token，跨不同深度读取</h3>
    <p className="mt-3">Layer {layer}：Attention 读取前有 <strong className="text-white">{s.bankBefore} 个快照</strong>；{layer === 0 ? '没有旧快照，直接使用输入。' : `加上当前 prefix，共 ${s.attentionCandidates} 个候选。`} 权重由当前 token 和本子层打分向量决定，不伪造模型学到的分数。</p>
    <ol className="mt-4 grid gap-3 lg:grid-cols-3">
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">01 · READ</span><p className="mt-2">先聚合旧 bank + 原始 prefix，得到 Attention 输入。</p></li>
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">02 · {s.write ? 'WRITE / RESET' : 'KEEP'}</span><p className="mt-2">{s.write ? `边界层：保存「${residualSnapshotLabel(s.bankBefore, block)}」为 Bank ${s.bankBefore}，清空 prefix。` : '非边界层：bank 不变，prefix 继续累加。'}</p></li>
      <li className="rounded-xl border border-amber-100/20 p-3"><span className="font-mono text-amber-100">03 · ACCUMULATE</span><p className="mt-2">{s.write ? '以 Attention 输出开始新 prefix。' : 'prefix 加上 Attention 输出。'} FFN 再从 {s.ffnCandidates} 个候选聚合；FFN 输出加回 prefix。</p></li>
    </ol>
    <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-amber-100">本层 FFN 可读取哪些快照？</summary><ul className="mt-3 space-y-2">{Array.from({ length: s.bankAfter }, (_, i) => <li key={i} className="rounded-lg bg-black/15 p-2"><span className="font-mono text-amber-100">Bank {i}</span> · {residualSnapshotLabel(i, block)}</li>)}<li className="rounded-lg border border-cyan-100/25 p-2 text-cyan-100">可变 prefix · 当前块内已执行子层的输出和</li></ul></details>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="AttnRes 边界跳转">{[0, 11, 12, 13, 84, 92].filter(n => n < model.dimensions.layers).map(n => <button key={n} type="button" onClick={() => onLayer(n)} aria-pressed={layer === n} className="rounded-lg border border-amber-100/25 px-3 py-2 text-amber-100 hover:bg-amber-100/10 aria-pressed:bg-amber-100/15">观察 Layer {n}</button>)}</div>
    <p className="mt-4">深度 bank 与 KV Cache 不同：当前 forward 预留最多 {slots} 个快照，BF16、无 DPA 的普通 Attention TP 下每 rank 的 bank 张量为 <span className="font-mono text-amber-100">[{tokenCount(scenario).toLocaleString('en-US')}, {slots}, {model.dimensions.hiddenSize}] ≈ {formatBytes(tokenCount(scenario) * slots * model.dimensions.hiddenSize * 2)}</span>。EP 只重排 routed 专家，本基线不改变完整主干宽度的 bank。Prefill 的 N=B×S，Decode 的 N=B；每次 forward 重建，不持久保存历史 token 的 bank。这里只算 bank 张量，不含 prefix、打分和其他临时工作区，也未加进 KV 并发预算。</p>
  </section>
}
