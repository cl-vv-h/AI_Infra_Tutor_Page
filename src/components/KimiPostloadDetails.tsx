import { kimiNativePostload } from '@/lib/kimi-native-postload'

const exact = (bytes: number) => `${bytes.toLocaleString('en-US')} B`
export default function KimiPostloadDetails({ data }: { data: ReturnType<typeof kimiNativePostload> }) {
  return <div className="mt-3 space-y-3 text-xs leading-5" aria-label="Kimi 后处理明细">
    <p>参数小计：{exact(data.parameterBytes)}（相对初始增加 {exact(data.parameterDeltaBytes)}）；另有已核对持久缓存 / padding {exact(data.persistentBytes)}。下面每项按独立存储计数；旧 buffer 被替换后不再相加。</p>
    <details className="rounded-lg bg-black/15 p-3"><summary className="cursor-pointer text-cyan-100">MXFP4 后处理：9 个参数容器 / 层</summary>
      <p className="mt-2">packed weight 与 scale 只重排，字节不变；scale 的 F8_E4M3FN 是存储 view，仍承载 UE8M0 字节。两个 bias 从 BF16 转为 FP32，新增三个逐专家 FP32 参数。当前 SM100 尺寸满足行 128、scale 列 4 的对齐要求，不需额外 scale padding。</p>
      <div className="mt-2 space-y-2">{data.expertBuffers.map(tensor => <details key={tensor.name} className="rounded-lg bg-black/20 p-2"><summary className="cursor-pointer break-words font-mono">{tensor.name} [{tensor.shape.join(', ')}] · {tensor.dtype}</summary><p className="mt-2">{exact(tensor.bytes)} / 层 × {tensor.copies} = {exact(tensor.totalBytes)}</p><p>{tensor.note}</p></details>)}</div>
    </details>
    <details className="rounded-lg bg-black/15 p-3"><summary className="cursor-pointer text-cyan-100">持久派生张量、padding 与重排索引</summary>
      <p className="mt-2">MLA 投影和 AttnRes 派生权重是额外存储。六个重排索引按 shape 缓存在每个设备上，不按 92 层或专家数重复计数。TP8 时另计 KDA 4 行 padding 与固定 fused decode 预备张量。</p>
      <div className="mt-2 space-y-2">{data.persistent.map(tensor => <details key={tensor.name} className="rounded-lg bg-black/20 p-2"><summary className="cursor-pointer break-words">{tensor.name} · {exact(tensor.totalBytes)}</summary><p className="mt-2 break-words font-mono">[{tensor.shape.join(', ')}] · {tensor.dtype} · {tensor.copies} 份</p><p>{tensor.note}</p></details>)}</div>
    </details>
    <details className="rounded-lg bg-black/15 p-3"><summary className="cursor-pointer text-cyan-100">不重复计算的共享存储</summary><ul className="mt-2 list-disc space-y-2 pl-4">{data.aliases.map(alias => <li key={alias}>{alias}</li>)}</ul></details>
    <p className="text-amber-100/85">这是已核对的持久张量小计，不是完整部署显存。未涵盖 dispatcher、后端全局 workspace、KV/激活、CUDA Graph、allocator、加载临时副本或转换峰值；不将未覆盖项当作零。没有运行 GPU 推理。不同硬件或依赖版本需重新核验。</p>
    <a className="inline-block text-cyan-100 hover:underline" href="https://github.com/flashinfer-ai/flashinfer/blob/v0.6.18/flashinfer/fused_moe/core.py" target="_blank" rel="noreferrer">核对 SGLang 固定依赖 FlashInfer 0.6.18 ↗</a>
  </div>
}
