import type { ModelWeight } from '../types/model.ts'
import { w4InterleavedScaleShape } from './w4-lifecycle.ts'

export const matrixPrecisions = ['bf16', 'fp8', 'fp16', 'fp32', 'fp8_tensor', 'int8', 'int4', 'mxfp4', 'nvfp4'] as const
export const expertPrecisions = [...matrixPrecisions, 'w4afp8'] as const
export type ExpertPrecision = typeof expertPrecisions[number]
export interface MixedPrecision { mlp: typeof matrixPrecisions[number]; shared: typeof matrixPrecisions[number]; experts: ExpertPrecision; w4Stage?: 'processed'; modelId?: string; weights?: Record<string, ExpertPrecision> }
export const defaultMixedPrecision: MixedPrecision = { mlp: 'bf16', shared: 'bf16', experts: 'bf16' }
export const mixedPrecisionLabels = { bf16: 'BF16', fp16: 'FP16', fp32: 'FP32', fp8: 'FP8 E4M3 · block 128×128', fp8_tensor: 'FP8 E4M3 · per-tensor', int8: 'INT8 · 对称 per-channel', int4: 'INT4 · 对称 group 128', mxfp4: 'MXFP4 E2M1 · group 32', nvfp4: 'NVFP4 E2M1 · group 16', w4afp8: 'W4A8 · INT4 / FP8 · group 128' }
export const supportsMixedPrecision = (id: string) => ['glm-5-2', 'glm-5-3-flash', 'kimi-k3', 'deepseek-v4-flash', 'qwen3-8b', 'qwen3-30b-a3b'].includes(id)

/** Qwen's 768-wide experts only satisfy group/block 128 at MoE-TP 1 or 2. */
export function availableMixedExperts(id: string, tp: number, ep: number): readonly ExpertPrecision[] {
  return id === 'qwen3-30b-a3b' && (768 / (tp / ep)) % 128 !== 0 ? expertPrecisions.filter(f => !['fp8', 'int4', 'w4afp8'].includes(f)) : expertPrecisions
}

export function validateMixedPrecision(policy: MixedPrecision) {
  if (!matrixPrecisions.includes(policy.mlp) || !matrixPrecisions.includes(policy.shared) || !expertPrecisions.includes(policy.experts)) throw new Error('Invalid mixed precision policy')
  if (policy.w4Stage !== undefined && policy.w4Stage !== 'processed') throw new Error('Invalid W4AFp8 processing stage')
  if (policy.weights && (Object.keys(policy.weights).length > 256 || Object.values(policy.weights).some(f => !matrixPrecisions.includes(f as typeof matrixPrecisions[number])))) throw new Error('Invalid per-weight policy')
}

/** Called only for the audited catalogue definitions, not a universal name heuristic. */
export function mixedWeightRole(weight: ModelWeight, nodeId: string) {
  if (weight.routedExpert) return 'experts'
  if (/^(gate\.weight|router\.gate|e_score_correction_bias)(?:\s|$)/.test(weight.name)) return 'router'
  if (/^shared_experts?\./.test(weight.name)) return 'shared'
  if (nodeId === 'dense-ffn' || nodeId === 'ffn') return 'mlp'
  return 'other'
}

export function weightAxes(shape: string) {
  if (!/^\[\d+(?:\s*[×,]\s*\d+)*\]$/.test(shape)) throw new Error(`Mixed precision needs one explicit tensor shape: ${shape}`)
  const result = shape.slice(1, -1).split(',').map(axis => axis.split('×').map(Number).reduce((a, b) => a * b, 1))
  if (!result.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid tensor dimensions')
  return result
}
const count = (shape: number[]) => shape.reduce((a, b) => a * b, 1)

/** Explicit storage scenario, NOT the native dtype inventory of the checkpoint.
 * Default Router FP32 and other tensors BF16; explicit overrides take precedence.
 * W4A8 is SGLang W4AFp8MoEMethod
 * create_weights at 96d91ef, group=128, or its audited post-load scale layout.
 * Method-owned runtime metadata is intentionally separate from weight/scale bytes.
 */
function tensorStorage(weight: ModelWeight, nodeId: string, policy: MixedPrecision, selected?: ExpertPrecision) {
  validateMixedPrecision(policy)
  const role = mixedWeightRole(weight, nodeId)
  const format = selected ?? (role === 'router' ? 'fp32' : role === 'other' ? 'bf16' : policy[role])
  const logicalShape = weightAxes(weight.shape)
  const copies = weight.multiplicity ?? 1
  if (!Number.isSafeInteger(copies) || copies < 1) throw new Error('Invalid tensor multiplicity')
  const payloadShape = [...logicalShape]
  let scaleShape: number[] | null = null
  let inputScaleShape: number[] | null = null
  let scaleElementBytes = 0
  let inputScaleElementBytes = 2
  let globalScaleBytes = 0
  let payloadElementBytes = format === 'fp32' ? 4 : format === 'bf16' || format === 'fp16' ? 2 : 1
  if (!['bf16', 'fp16', 'fp32'].includes(format)) {
    if (logicalShape.length !== 2 && !(weight.routedExpert && logicalShape.length === 3)) throw new Error('Quantized matrix must have output and input axes')
    const output = logicalShape.at(-2)!, input = logicalShape.at(-1)!
    const prefix = logicalShape.slice(0, -2)
    const merged = weight.name.includes('gate_up')
    const halves = merged ? 2 : 1
    if (format === 'fp8') {
      if (output % (128 * halves) || input % 128) throw new Error('FP8 scenario requires each gate/up half and input partition aligned to 128')
      scaleShape = [...prefix, output / 128, input / 128]
      scaleElementBytes = 4
    } else if (format === 'fp8_tensor') {
      scaleShape = [...prefix, 1]
      scaleElementBytes = 4
    } else if (format === 'int8') {
      scaleShape = [...prefix, output, 1]
      scaleElementBytes = 4
    } else {
      const group = format === 'nvfp4' ? 16 : format === 'mxfp4' ? 32 : 128
      if (input % group) throw new Error(`Packed expert input partition must align to ${group}`)
      payloadShape[payloadShape.length - 1] /= 2
      scaleShape = [...prefix, output, input / group]
      scaleElementBytes = format === 'mxfp4' || format === 'nvfp4' ? 1 : 4
      if (format === 'nvfp4') globalScaleBytes = count(prefix) * 4 * copies
      if (format === 'w4afp8') inputScaleShape = merged ? [...prefix, 2] : prefix
    }
  }
  // Every payload element is now one container (two INT4/MXFP4 values per byte).
  payloadElementBytes = format === 'mxfp4' || format === 'w4afp8' ? 1 : payloadElementBytes
  const payloadBytes = count(payloadShape) * payloadElementBytes * copies
  const allocatedBytes = payloadBytes + (scaleShape ? count(scaleShape) * scaleElementBytes * copies : 0) + (inputScaleShape ? count(inputScaleShape) * 2 * copies : 0) + globalScaleBytes
  const processed = format === 'w4afp8' && policy.w4Stage === 'processed'
  if (processed) {
    scaleShape = w4InterleavedScaleShape(scaleShape!)
    scaleElementBytes = 2
    inputScaleShape = [1]
    inputScaleElementBytes = 4
  }
  const scaleBytes = (scaleShape ? count(scaleShape) * scaleElementBytes : 0) * copies
  const inputScaleBytes = (inputScaleShape ? count(inputScaleShape) * inputScaleElementBytes : 0) * copies
  const bytes = payloadBytes + scaleBytes + inputScaleBytes + globalScaleBytes
  if (!Number.isSafeInteger(bytes)) throw new Error('Storage exceeds safe integer precision')
  const scaleDtype = scaleShape ? format === 'nvfp4' ? 'FP8 E4M3' : scaleElementBytes === 1 ? 'UINT8 (E8M0)' : scaleElementBytes === 2 ? 'BF16' : 'FP32' : null
  const inputScaleDtype = inputScaleShape ? inputScaleElementBytes === 4 ? 'FP32' : 'BF16' : null
  return { role, format, logicalShape, payloadShape, scaleShape, inputScaleShape, payloadBytes, scaleBytes, inputScaleBytes, globalScaleBytes, bytes, allocatedBytes, processed, scaleDtype, inputScaleDtype }
}

const separateNames: Record<string, string[]> = {
  'k_proj / v_proj': ['k_proj', 'v_proj'], 'q_norm / k_norm': ['q_norm', 'k_norm'],
  'indexer.k_norm weight / bias': ['indexer.k_norm.weight', 'indexer.k_norm.bias'],
  'indexer.k_norm scale / bias': ['indexer.k_norm.weight', 'indexer.k_norm.bias'],
  'f_a_proj / g_a_proj': ['f_a_proj', 'g_a_proj'], 'f_b_proj / g_b_proj': ['f_b_proj', 'g_b_proj'],
  'q / k / v / g_proj': ['q_proj', 'k_proj', 'v_proj', 'g_proj'],
}
/** Logical matrices, not a claim that heterogeneous dtypes fit one fused container. */
export function precisionWeightParts(weight: ModelWeight): ModelWeight[] {
  const name = weight.name.split(' ·')[0]
  if (name.includes('gate_up_proj')) {
    const shape = weightAxes(weight.shape)
    if (shape.at(-2)! % 2) throw new Error('Gate/Up must split evenly')
    shape[shape.length - 2] /= 2
    return ['gate_proj', 'up_proj'].map(part => ({ ...weight, name: name.replace('gate_up_proj', part), shape: `[${shape.join(', ')}]` }))
  }
  const names = separateNames[name]
  if (names) {
    if (names.length !== weight.multiplicity) throw new Error('Unverified tensor multiplicity')
    return names.map(name => ({ ...weight, name, multiplicity: 1 }))
  }
  if ((weight.multiplicity ?? 1) > 1) throw new Error('Missing explicit precision tensor names')
  return [{ ...weight, name }]
}
export const precisionKey = (nodeId: string, name: string, layer: number | 'all' = 'all') => `${layer}/${nodeId}/${name}`
export const hasRoutedOverrides = (policy?: MixedPrecision) => Object.keys(policy?.weights ?? {}).some(key => key.includes('/experts.'))
export function effectiveWeightPrecision(weight: ModelWeight, nodeId: string, policy: MixedPrecision, layer?: number): ExpertPrecision {
  const role = mixedWeightRole(weight, nodeId)
  return (layer === undefined ? undefined : policy.weights?.[precisionKey(nodeId, weight.name, layer)]) ?? policy.weights?.[precisionKey(nodeId, weight.name)] ?? (role === 'router' ? 'fp32' : role === 'other' ? 'bf16' : policy[role])
}
export function mixedWeightStorage(weight: ModelWeight, nodeId: string, policy: MixedPrecision, layer?: number) {
  const parts = precisionWeightParts(weight)
  const formats = parts.map(part => effectiveWeightPrecision(part, nodeId, policy, layer))
  const coarse = effectiveWeightPrecision({ ...weight, name: weight.name.split(' ·')[0] }, nodeId, { ...policy, weights: undefined })
  const split = formats.some(f => f !== coarse) || formats.some(f => ['nvfp4', 'fp8_tensor'].includes(f))
  // Split routed matrices no longer represent the audited fused W4 post-load method.
  const safePolicy = hasRoutedOverrides(policy) ? { ...policy, w4Stage: undefined } : policy
  if (!split) return { ...tensorStorage(weight, nodeId, safePolicy), parts: [] as Array<{ name: string; storage: ReturnType<typeof tensorStorage> }> }
  const rows = parts.map((part, i) => ({ name: part.name, storage: tensorStorage(part, nodeId, safePolicy, formats[i]) }))
  const first = rows[0].storage
  const sum = (field: 'payloadBytes' | 'scaleBytes' | 'inputScaleBytes' | 'globalScaleBytes' | 'bytes' | 'allocatedBytes') => rows.reduce((n, r) => n + r.storage[field], 0)
  return { ...first, format: formats.every(f => f === formats[0]) ? formats[0] : 'mixed' as const, logicalShape: weightAxes(weight.shape), payloadBytes: sum('payloadBytes'), scaleBytes: sum('scaleBytes'), inputScaleBytes: sum('inputScaleBytes'), globalScaleBytes: sum('globalScaleBytes'), bytes: sum('bytes'), allocatedBytes: sum('allocatedBytes'), parts: rows }
}
