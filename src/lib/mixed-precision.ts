import type { ModelWeight } from '../types/model.ts'
import { w4InterleavedScaleShape } from './w4-lifecycle.ts'

export const matrixPrecisions = ['bf16', 'fp8'] as const
export const expertPrecisions = ['bf16', 'fp8', 'mxfp4', 'w4afp8'] as const
export type ExpertPrecision = typeof expertPrecisions[number]
export interface MixedPrecision { mlp: 'bf16' | 'fp8'; shared: 'bf16' | 'fp8'; experts: ExpertPrecision; w4Stage?: 'processed' }
export const defaultMixedPrecision: MixedPrecision = { mlp: 'bf16', shared: 'bf16', experts: 'bf16' }
export const mixedPrecisionLabels = { bf16: 'BF16', fp8: 'FP8 block 128×128', mxfp4: 'MXFP4 · scale 1 B / 32', w4afp8: 'W4A8 · INT4 / FP8 · group 128' }
export const supportsMixedPrecision = (id: string) => ['glm-5-2', 'glm-5-3-flash', 'kimi-k3', 'deepseek-v4-flash', 'qwen3-8b', 'qwen3-30b-a3b'].includes(id)

/** Qwen's 768-wide experts only satisfy group/block 128 at MoE-TP 1 or 2. */
export function availableMixedExperts(id: string, tp: number, ep: number): readonly ExpertPrecision[] {
  return id === 'qwen3-30b-a3b' && (768 / (tp / ep)) % 128 !== 0 ? ['bf16', 'mxfp4'] : expertPrecisions
}

export function validateMixedPrecision(policy: MixedPrecision) {
  if (!matrixPrecisions.includes(policy.mlp) || !matrixPrecisions.includes(policy.shared) || !expertPrecisions.includes(policy.experts)) throw new Error('Invalid mixed precision policy')
  if (policy.w4Stage !== undefined && policy.w4Stage !== 'processed') throw new Error('Invalid W4AFp8 processing stage')
}

/** Called only for the audited catalogue definitions, not a universal name heuristic. */
export function mixedWeightRole(weight: ModelWeight, nodeId: string) {
  if (weight.routedExpert) return 'experts'
  if (/^(gate\.weight|router\.gate|e_score_correction_bias)(?:\s|$)/.test(weight.name)) return 'router'
  if (/^shared_experts?\./.test(weight.name)) return 'shared'
  if (nodeId === 'dense-ffn' || nodeId === 'ffn') return 'mlp'
  return 'other'
}

function axes(shape: string) {
  if (!/^\[\d+(?:\s*[×,]\s*\d+)*\]$/.test(shape)) throw new Error(`Mixed precision needs one explicit tensor shape: ${shape}`)
  const result = shape.slice(1, -1).split(',').map(axis => axis.split('×').map(Number).reduce((a, b) => a * b, 1))
  if (!result.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid tensor dimensions')
  return result
}
const count = (shape: number[]) => shape.reduce((a, b) => a * b, 1)

/** Explicit storage scenario, NOT the native dtype inventory of the checkpoint.
 * Router fixed FP32; unselected tensors BF16. W4A8 is SGLang W4AFp8MoEMethod
 * create_weights at 96d91ef, group=128, or its audited post-load scale layout.
 * Method-owned runtime metadata is intentionally separate from weight/scale bytes.
 */
export function mixedWeightStorage(weight: ModelWeight, nodeId: string, policy: MixedPrecision) {
  validateMixedPrecision(policy)
  const role = mixedWeightRole(weight, nodeId)
  const format = role === 'router' ? 'fp32' : role === 'other' ? 'bf16' : policy[role]
  const logicalShape = axes(weight.shape)
  const copies = weight.multiplicity ?? 1
  if (!Number.isSafeInteger(copies) || copies < 1) throw new Error('Invalid tensor multiplicity')
  const payloadShape = [...logicalShape]
  let scaleShape: number[] | null = null
  let inputScaleShape: number[] | null = null
  let scaleElementBytes = 0
  let inputScaleElementBytes = 2
  let payloadElementBytes = format === 'fp32' ? 4 : format === 'bf16' ? 2 : 1
  if (format !== 'bf16' && format !== 'fp32') {
    if (logicalShape.length < 2) throw new Error('Quantized matrix must have output and input axes')
    const output = logicalShape.at(-2)!, input = logicalShape.at(-1)!
    const prefix = logicalShape.slice(0, -2)
    const merged = weight.name.includes('gate_up')
    const halves = merged ? 2 : 1
    if (format === 'fp8') {
      if (output % (128 * halves) || input % 128) throw new Error('FP8 scenario requires each gate/up half and input partition aligned to 128')
      scaleShape = [...prefix, output / 128, input / 128]
      scaleElementBytes = 4
    } else {
      const group = format === 'mxfp4' ? 32 : 128
      if (input % group) throw new Error(`Packed expert input partition must align to ${group}`)
      payloadShape[payloadShape.length - 1] /= 2
      scaleShape = [...prefix, output, input / group]
      scaleElementBytes = format === 'mxfp4' ? 1 : 4
      if (format === 'w4afp8') inputScaleShape = merged ? [...prefix, 2] : prefix
    }
  }
  // Every payload element is now one container (two INT4/MXFP4 values per byte).
  payloadElementBytes = format === 'mxfp4' || format === 'w4afp8' ? 1 : payloadElementBytes
  const payloadBytes = count(payloadShape) * payloadElementBytes * copies
  const allocatedBytes = payloadBytes + (scaleShape ? count(scaleShape) * scaleElementBytes * copies : 0) + (inputScaleShape ? count(inputScaleShape) * 2 * copies : 0)
  const processed = format === 'w4afp8' && policy.w4Stage === 'processed'
  if (processed) {
    scaleShape = w4InterleavedScaleShape(scaleShape!)
    scaleElementBytes = 2
    inputScaleShape = [1]
    inputScaleElementBytes = 4
  }
  const scaleBytes = (scaleShape ? count(scaleShape) * scaleElementBytes : 0) * copies
  const inputScaleBytes = (inputScaleShape ? count(inputScaleShape) * inputScaleElementBytes : 0) * copies
  const bytes = payloadBytes + scaleBytes + inputScaleBytes
  if (!Number.isSafeInteger(bytes)) throw new Error('Storage exceeds safe integer precision')
  const scaleDtype = scaleShape ? scaleElementBytes === 1 ? 'UINT8' : scaleElementBytes === 2 ? 'BF16' : 'FP32' : null
  const inputScaleDtype = inputScaleShape ? inputScaleElementBytes === 4 ? 'FP32' : 'BF16' : null
  return { role, format, logicalShape, payloadShape, scaleShape, inputScaleShape, payloadBytes, scaleBytes, inputScaleBytes, bytes, allocatedBytes, processed, scaleDtype, inputScaleDtype }
}
