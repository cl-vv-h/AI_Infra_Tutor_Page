import { useMemo } from 'react'
import type { ModelArchitecture } from '@/types/model'
import { kimiWeightAudit, kimiCheckpoint as checkpoint, decimalTB } from '@/lib/kimi-weight-audit'
import { formatBytes } from '@/lib/model-lab'
import KimiNativeLayout from './KimiNativeLayout'
import type { KimiNativeStage } from '@/lib/kimi-native-postload'

export default function KimiWeightAudit({ model, tp = 1, ep = 1, replicas = 1, rank = 0, stage, onStage }: { model: ModelArchitecture; tp?: number; ep?: number; replicas?: number; rank?: number; stage?: KimiNativeStage; onStage?: (stage: KimiNativeStage) => void }) {
  const audit = useMemo(() => kimiWeightAudit(model), [model])
  const bytes = (value: number) => `${value.toLocaleString('en-US')} B`
  const roles: Record<string, string> = { attention: 'Attention', 'decoder-norm-residual': 'Decoder Norm / AttnRes', embedding: 'Embedding', 'lm-head': 'LM Head', 'other-mlp': 'Dense MLP', other: '输出 Norm / AttnRes', projector: '视觉投影', 'routed-experts': 'Routed 专家（packed + scales）', router: 'Router', 'shared-experts': 'Shared 专家', vision: '视觉塔', 'latent-projections': 'Latent 投影 / Norm' }
  const bridge = [
    ['图示 Decoder · 统一 4-bit 假设', audit.uniform4Bytes],
    ['+ Routed MXFP4 · UINT8 / group-32 scales', audit.scaleBytes],
    ['+ 图示非 routed 元素恢复 BF16', audit.bf16RestorationBytes],
    ['+ 原生 FP32 张量相对 BF16 的差额', audit.fp32RestorationBytes],
    ['+ A_log 的 checkpoint 128 元素与运行时 96 heads 差额（BF16 基线）', audit.checkpointOnlyElementsBytes],
    ['= 原生 Decoder 张量载荷', checkpoint.decoderBytes],
    ['+ Embedding / LM Head / 视觉及输出 Norm', audit.outsideDecoderBytes],
    ['= 全部原生张量载荷（索引 total_size）', checkpoint.payloadBytes],
    ['+ 96 个 safetensors 文件头及长度前缀', checkpoint.headerBytes],
    ['= 96 个权重文件总字节', checkpoint.fileBytes],
  ] as const
  return <section aria-label="Kimi 权重口径核对" id="weight-checkpoint-section" tabIndex={-1} className="mt-4 scroll-mt-24 rounded-2xl border border-amber-200/25 bg-amber-200/5 p-4 text-sm leading-6 focus-visible:outline-amber-200 sm:p-5">
    <h3 className="text-base font-semibold text-amber-100">Kimi 原生权重 · 1.56 TB</h3>
    <p className="mt-2 text-white/80">完整权重文件：{decimalTB(checkpoint.fileBytes)} · {bytes(checkpoint.fileBytes)}。这是 96 个文件的固定体积，不是当前 rank 显存；不会随 TP 或混合精度变化。</p>
    <details className="mt-3 text-white/70" aria-label="Kimi 文件差额与审计说明"><summary className="cursor-pointer">展开文件、Decoder 与单位差额的完整对账</summary>
    <p className="mt-2 text-white/75">官方仓库文件体积、图示 Decoder 小计、当前 rank 的权重和部署显存是四个不同数字。以下固定 TP=1 对齐单位与统计口径，不跟随上方 TP 改写官方文件体积。</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{[
      ['图示 Decoder · 全部假定 4-bit', decimalTB(audit.uniform4Bytes), formatBytes(audit.uniform4Bytes)],
      ['原生 Decoder · 文件头已核对', decimalTB(checkpoint.decoderBytes), formatBytes(checkpoint.decoderBytes)],
      ['完整权重文件 · 96 / 96 已对账', decimalTB(checkpoint.fileBytes), '官方约 1.56 TB · ' + formatBytes(checkpoint.fileBytes)],
    ].map(([label, value, secondary]) => <div className="min-w-0 rounded-xl bg-black/15 p-3" key={label}><p className="text-xs text-white/60">{label}</p><p className="mt-2 font-mono text-lg text-white">{value}</p><p className="text-xs text-white/55">{secondary}</p></div>)}</div>
    <p className="mt-3 text-xs text-white/65">已核对 {checkpoint.tensorCount.toLocaleString('en-US')} 个张量的 dtype、shape、offset 与索引归属。完整文件为 {bytes(checkpoint.fileBytes)}；不是单卡部署显存，也不随自定义精度或 TP 滑块变化。</p>
    <details className="mt-3 text-white/65"><summary className="cursor-pointer">展开逐项差额：从 4-bit 假设到完整文件</summary>
      <dl className="mt-3 space-y-2">{bridge.map(([label, value]) => <div className="rounded-lg bg-black/15 p-2 sm:flex sm:justify-between sm:gap-4" key={label}><dt className="text-xs">{label}</dt><dd className="shrink-0 font-mono text-xs text-white/85">{bytes(value)}</dd></div>)}</dl>
      <p className="mt-3">中间控制变量对照（MXFP4 专家 + 其余 BF16）为 {bytes(audit.referenceScenarioBytes)}。真实非专家张量并不全是 BF16：KDA 卷积、A_log、dt_bias、o_norm 与路由 correction bias 存为 FP32；Router 的 gate.weight 则存为 BF16。页面的自定义混合方案固定 Router FP32，不等同于原生 checkpoint。</p>
      <p className="mt-2">A_log 文件中为 [128]；固定版本的 SGLang loader 只取前 96 个，再按 Attention TP 划分。图示统计运行时逻辑元素，文件审计统计原生存储元素，两者不能混用。当前统一 4-bit TP1 是 1.263 TiB（1.389 TB），尚未复现反馈中的 1.14 TB。</p>
    </details>
    <details className="mt-3 text-white/65"><summary className="cursor-pointer">查看原生模块与 dtype 明细</summary>
      <dl className="mt-3 space-y-2">{checkpoint.groups.map(group => <div className="rounded-lg bg-black/15 p-2 sm:flex sm:justify-between sm:gap-4" key={`${group.role}:${group.dtype}`}><dt className="text-xs">{roles[group.role] ?? group.role} · {group.dtype}<span className="ml-2 text-white/45">{group.tensorCount.toLocaleString('en-US')} 张量</span></dt><dd className="shrink-0 font-mono text-xs text-white/85">{bytes(group.bytes)}</dd></div>)}</dl>
      <p className="mt-2 text-xs">U8 是 MXFP4 的存储容器，不代表逻辑权重为 8-bit。w1 / w3 的 weight_packed 为 [3072, 1792]，weight_scale 为 [3072, 112]；w2 对应 [3584, 1536] 与 [3584, 96]。每个专家包含三对张量，共 92 × 896 个专家；不按 Top-16 激活数量缩减驻留权重。</p>
    </details>
    <details className="mt-3 text-white/65"><summary className="cursor-pointer">审计方法、来源与验证边界</summary>
      <p className="mt-2">从 Moonshot 官方 ModelScope 仓库读取固定文件版本的索引与全部文件头。索引 SHA-256 与 Hugging Face 官方 LFS 指针一致；逐张量检查 shape × dtype 字节宽度、连续 offsets、文件归属及末尾边界，载荷总计与索引 total_size 精确相等。只读取约 {(checkpoint.metadataBytesRead / 1e6).toFixed(1)} MB 元数据，没有下载或哈希校验约 1.56 TB 的权重载荷；分片 SHA-256 是发布方声明，不能称作本机已验证。</p>
      <p className="mt-2">文件总计只含 96 个 safetensors，不包含单独的索引 JSON、tokenizer 或代码。索引文件大小为 {bytes(checkpoint.index.size)}。审计日期：{checkpoint.auditedAt.slice(0, 10)}；仓库中保存了脱敏后的逐文件版本、头部校验和与 shape 模板，可离线复核。TP/EP 的加载布局、类型转换、复制与额外缓冲区仍需另外统计，不能把文件大小直接除 TP 当作单卡显存。</p>
      <div className="mt-2 flex flex-wrap gap-4"><a className="text-cyan-100 hover:underline" href={checkpoint.source} target="_blank" rel="noreferrer">官方 ModelScope 权重目录 ↗</a><a className="text-cyan-100 hover:underline" href={checkpoint.hfIndexSource} target="_blank" rel="noreferrer">官方 HF 索引 SHA-256 ↗</a><a className="text-cyan-100 hover:underline" href={model.implementationUrl} target="_blank" rel="noreferrer">固定 SGLang loader ↗</a></div>
    </details>
    </details>
    <KimiNativeLayout tp={tp} ep={ep} replicas={replicas} rank={rank} stage={stage} onStage={onStage} />
  </section>
}
