import { mixedWeightStorage } from '@/lib/mixed-precision'
import type { MixedPrecision } from '@/lib/mixed-precision'
import type { TensorParallelSize } from '@/types/model'
import MixedWeightDetails from './MixedWeightDetails'

const source = 'https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/'

export default function QwenDenseLayout({ tp, policy, dpaRows }: { tp: TensorParallelSize; policy: MixedPrecision; dpaRows?: number }) {
  const intermediate = 12288 / tp
  const n = dpaRows ?? 'N'
  const weights = [
    { name: 'gate_up_proj', shape: `[${2 * intermediate}, 4096]` },
    { name: 'down_proj', shape: `[4096, ${intermediate}]` },
  ].map(weight => ({ ...weight, storage: mixedWeightStorage(weight, 'ffn', policy) }))
  const bytes = weights.reduce((sum, weight) => sum + weight.storage.bytes, 0)
  return <details aria-label="Qwen3 Dense 融合布局" className="mt-4 rounded-xl border border-cyan-200/20 p-4 text-sm leading-6 text-white/70">
    <summary className="cursor-pointer text-cyan-100">SGLang 如何合并 Gate / Up · 本层 MLP 每 rank {bytes.toLocaleString('en-US')} B</summary>
    <p className="mt-3">Qwen3 复用 Qwen2MLP：Gate 和 Up 按输出维做列并行并合并，Down 按输入维做行并行。当前 TP={tp}，中间维 I={intermediate}；Gate/Up 各自占 {intermediate} 行，融合不把参数或 scale 再加一遍。下方是同一 MLP 账本的另一种布局视图，不是额外分配。</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{weights.map(weight => <div key={weight.name} className="min-w-0 rounded-xl bg-white/5 p-3"><p className="break-words font-mono text-cyan-100">{weight.name} {weight.shape}</p><MixedWeightDetails storage={weight.storage} copies={1} /></div>)}</div>
    <p className="mt-3">输入 [{n},4096] → 合并投影 [{n},{2 * intermediate}] → SiLU(Gate)×Up [{n},{intermediate}] → Down 部分和 [{n},4096] → TP 归约后的输出 [{n},4096]。{dpaRows === undefined ? 'N 来自当前 batch/阶段；独立 DP 复制整个 TP 组，不继续缩小这些矩阵。' : '这里的行数是 DPA 汇合缓冲（含 padding），不是当前请求组的有效 token 数；Dense 中间维仍按总 TP 划分。'}</p>
    <p className="mt-3 text-amber-100/80">这是所选存储情景的初始权重布局，不是官方 BF16 checkpoint 的原生 FP8 清单。固定版本的 block FP8 要求预先序列化的 FP8 checkpoint 与 dynamic activation；不能只把原 BF16 模型启动参数改成 FP8 就假定得到此布局。不计后端重排/对齐、量化临时张量、KV、Embedding 或 LM Head，也不代表完整显存。默认 BF16 Norm；确定性训练等特殊 FP32 分支不在本情景中。</p>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[['Qwen3 与两套 Norm', 'models/qwen3.py'], ['MLP 融合与分片', 'models/qwen2.py'], ['FP8 分配与约束', 'layers/quantization/fp8.py']].map(([label, file]) => <a key={file} href={`${source}${file}`} target="_blank" rel="noreferrer" className="text-cyan-100 hover:underline">{label} ↗</a>)}</div>
  </details>
}
