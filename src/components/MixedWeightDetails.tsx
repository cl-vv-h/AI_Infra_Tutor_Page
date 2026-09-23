import type { mixedWeightStorage } from '@/lib/mixed-precision'
import { mixedPrecisionLabels } from '@/lib/mixed-precision'

export default function MixedWeightDetails({ storage, copies = 1 }: { storage: ReturnType<typeof mixedWeightStorage>; copies?: number }) {
  const bytes = (n: number) => `${n.toLocaleString('en-US')} B`
  if (storage.parts.length) return <div className="mt-3 text-xs leading-6 text-violet-100"><p>逐权重合计 {bytes(storage.bytes)} · 不重复计入原融合容器</p><div className="mt-2 space-y-3">{storage.parts.map(part => <details key={part.name} className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer break-words">{part.name} · {mixedPrecisionLabels[part.storage.format]} · {bytes(part.storage.bytes)}</summary><MixedWeightDetails storage={{ ...part.storage, parts: [] }} copies={copies} /></details>)}</div></div>
  return <div className="mt-3 space-y-2 break-words text-xs leading-6 text-violet-100">
    <p>{storage.format.toUpperCase()} · {storage.role} · {copies} 份张量</p>
    <p>Payload Shape [{storage.payloadShape.join(', ')}] · {bytes(storage.payloadBytes)}</p>
    <p>Weight scale {storage.scaleShape ? `[${storage.scaleShape.join(', ')}] · ${storage.scaleDtype}` : '无'} · {bytes(storage.scaleBytes)}</p>
    <p>Input scale {storage.inputScaleShape ? `[${storage.inputScaleShape.join(', ')}] · ${storage.inputScaleDtype}` : '无'} · {bytes(storage.inputScaleBytes)}</p>
    {!!storage.globalScaleBytes && <p>Global weight scale · FP32 / 逻辑矩阵 · {bytes(storage.globalScaleBytes)}</p>}
    {storage.processed && <p className="text-cyan-100">W4A8 后处理：payload 不变；初始权重与 scale {bytes(storage.allocatedBytes)} → 当前 {bytes(storage.bytes)}。</p>}
    <p>上述字节已包含 {copies} 份；权重与 scale 合计 {bytes(storage.bytes)}，不含运行元数据。</p>
  </div>
}
