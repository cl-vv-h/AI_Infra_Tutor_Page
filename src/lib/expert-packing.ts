import type { ModelArchitecture } from '../types/model.ts'

export const expertFormats = ['bf16', 'fp8-block', 'mxfp8', 'fp4-load'] as const
export type ExpertFormat = typeof expertFormats[number]
export const expertFormatLabels: Record<ExpertFormat, string> = {
  bf16: 'BF16 基线', 'fp8-block': 'FP8 · 128×128', mxfp8: 'MXFP8 · 1×32', 'fp4-load': 'FP4 加载 · 1×32',
}
export const expertPackingSource = 'https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/fp8.py#L1184'

/** Allocation protocols applied to verified logical shapes, NOT a checkpoint support list. */
export function availableExpertFormats(model: Pick<ModelArchitecture, 'id'>): readonly ExpertFormat[] {
  if (model.id === 'deepseek-v4-flash') return expertFormats
  if (['glm-5-2', 'glm-5-3-flash', 'kimi-k3'].includes(model.id)) return expertFormats.slice(0, 3)
  return []
}

const elements = (shape: number[]) => shape.reduce((a, b) => a * b, 1)

/** Fp8MoEMethod.create_fp8_moe_weight_ allocation before post-load processing.
 * Gated experts, non-Aiter, non-HIP-int4, no bias; default FP4 scale dtype.
 * BF16 is a logical no-scale baseline, not execution through the FP8 method.
 */
export function expertPacking(localExperts: number, hidden: number, intermediate: number, tp: number, format: ExpertFormat) {
  if (![localExperts, hidden, intermediate].every((v) => Number.isSafeInteger(v) && v > 0)
    || ![1, 2, 4, 8].includes(tp) || !expertFormats.includes(format)) throw new Error('Invalid expert packing conditions')
  const blockN = format === 'fp8-block' ? 128 : 1
  const blockK = format === 'fp8-block' ? 128 : 32
  if ((format === 'fp8-block' || format === 'mxfp8')
    && (intermediate % blockN !== 0 || (tp > 1 && intermediate % blockK !== 0))) {
    throw new Error('专家中间维分片不满足 SGLang block 对齐要求；gate 与 up 必须分别对齐。')
  }
  if (format === 'fp4-load' && (hidden % 32 !== 0 || intermediate % 32 !== 0)) {
    throw new Error('FP4 加载对照要求输入维与中间维分片均为 32 的整数倍。')
  }
  const valueBytes = format === 'bf16' ? 2 : 1
  const scaleBytes = format === 'bf16' ? 0 : format === 'mxfp8' ? 1 : 4
  const payloadDtype = format === 'bf16' ? 'BF16' : format === 'fp4-load' ? 'INT8 容器 / 2×FP4' : 'FP8 E4M3'
  const scaleDtype = format === 'bf16' ? '无' : format === 'mxfp8' ? 'UINT8 / E8M0' : 'FP32'
  const logical = [[localExperts, 2 * intermediate, hidden], [localExperts, hidden, intermediate]]
  const rows = logical.map((logicalShape, index) => {
    const payloadShape = [...logicalShape]
    if (format === 'fp4-load') payloadShape[2] /= 2
    // gate/up have distinct scale grids: 2*ceil(I/blockN), NOT ceil(2*I/blockN).
    const scaleShape = format === 'bf16' ? null : index === 0
      ? [localExperts, 2 * Math.ceil(intermediate / blockN), Math.ceil(hidden / blockK)]
      : [localExperts, Math.ceil(hidden / blockN), Math.ceil(intermediate / blockK)]
    const payloadBytes = elements(payloadShape) * valueBytes
    const scalesBytes = scaleShape ? elements(scaleShape) * scaleBytes : 0
    return { name: index === 0 ? 'w13 · gate + up' : 'w2 · down', logicalShape, payloadShape, scaleShape,
      payloadDtype, scaleDtype, payloadBytes, scalesBytes, totalBytes: payloadBytes + scalesBytes }
  })
  const payloadBytes = rows.reduce((sum, row) => sum + row.payloadBytes, 0)
  const scalesBytes = rows.reduce((sum, row) => sum + row.scalesBytes, 0)
  const baselineBytes = 3 * localExperts * hidden * intermediate * 2
  if (![payloadBytes, scalesBytes, baselineBytes, payloadBytes + scalesBytes].every(Number.isSafeInteger)) throw new Error('Expert packing exceeds safe integer range')
  return { format, rows, blockN, blockK, payloadBytes, scalesBytes, totalBytes: payloadBytes + scalesBytes, baselineBytes }
}
