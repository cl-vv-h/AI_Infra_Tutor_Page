import { w4RuntimeMetadata, w4Source } from '@/lib/w4-lifecycle'
import { formatBytes } from '@/lib/model-lab'

export default function W4RuntimeMetadata({ experts, cards }: { experts: number; cards: number }) {
  const data = w4RuntimeMetadata(experts)
  return <details aria-label="W4A8 独立运行元数据" className="mt-4 rounded-xl border border-cyan-200/20 p-3 text-sm leading-6 text-white/70">
    <summary className="cursor-pointer text-cyan-100">本层 W4A8 运行元数据 · 每 rank {data.bytes.toLocaleString('en-US')} B（另列，不混入权重）</summary>
    <p className="mt-3">{experts} 个本地专家：7 个独立分配，4 个别名不重复计数；124 × {experts} + 4 = {data.bytes.toLocaleString('en-US')} B。全部 {cards} 张卡合计 {formatBytes(data.bytes * cards)}。</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.tensors.map(tensor => <div key={tensor.name} className="min-w-0 rounded-lg bg-white/5 p-3"><p className="break-words font-mono text-cyan-100">{tensor.name}</p><p className="mt-1">[{tensor.shape.join(', ')}] · {tensor.dtype} · {tensor.bytes.toLocaleString('en-US')} B</p>{tensor.aliases.length > 0 && <p className="mt-1 break-words text-xs text-white/55">同一存储的别名：{tensor.aliases.join(', ')}</p>}</div>)}</div>
    <p className="mt-3 text-xs text-white/60">这是该层 quantization method 保存的 strides、offsets 与 problem sizes，在初始分配与后处理后均存在。不是每个 gate/up、down 各算一套。这里不加总激活、kernel 临时 workspace、allocator 保留或转换峰值；不是整卡运行显存。</p>
    <a href={w4Source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-100 hover:underline">核对创建与别名 ↗</a>
  </details>
}
