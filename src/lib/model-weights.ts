import type { ArchitectureNode, ModelArchitecture, ModelWeight, TensorParallelSize } from '../types/model.ts'
import { decoderNodes, formatShape } from './model-lab.ts'
import type { InferenceScenario } from './model-lab.ts'
import { mixedWeightStorage, supportsMixedPrecision, validateMixedPrecision } from './mixed-precision.ts'
import type { MixedPrecision } from './mixed-precision.ts'

export type WeightBits = 4 | 8 | 16 | 32

/** Attention projections use their request group's TP; FFN keeps stage-wide TP. */
export const isAttentionWeightNode = (node: ArchitectureNode) => node.tone === 'attention'

export function expertParallelSizes(model: ModelArchitecture, tp: number): TensorParallelSize[] {
  if (!model.supportedTp.includes(tp as TensorParallelSize)) return []
  const metadata = model.execution.expertParallel
  if (!metadata) return [1]
  return ([1, 2, 4, 8] as const).filter((ep) => tp % ep === 0 && metadata.experts % ep === 0 && (model.execution.expertIntermediateSize ?? 0) % (tp / ep) === 0)
}

/** One source of truth for Inspector, rank lab and Decoder ledger. Shared tensors keep full TP. */
export function formatWeight(weight: ModelWeight, model: ModelArchitecture, scenario: InferenceScenario, ep: TensorParallelSize = 1): ModelWeight {
  if (!expertParallelSizes(model, scenario.tp).includes(ep)) throw new Error('Invalid expert parallel size')
  if (!weight.routedExpert) return { ...weight, shape: formatShape(weight.shape, model, scenario) }
  const count = model.execution.expertParallel?.experts
  if (!count) throw new Error('Routed weight lacks verified expert metadata')
  const moeTp = scenario.tp / ep as TensorParallelSize
  const shape = formatShape(weight.shape, model, { ...scenario, tp: moeTp })
  if (!shape.startsWith(`[${count},`)) throw new Error('Routed expert axis must be axis 0')
  return { ...weight, shape: shape.replace(/^\[\d+,/, `[${count / ep},`),
    name: ep > 1 ? weight.name.replace('TP local', 'EP × MoE-TP local') : weight.name,
    note: ep > 1 ? `专家轴按 EP=${ep} 切分，中间维按 MoE-TP=${moeTp} 切分；不是在原 TP Shape 上再次除 EP。` : weight.note,
  }
}

/** Parse only the catalogue's bracketed integer products; never evaluate code. */
export function shapeElements(shape: string): number | null {
  if (!/^\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\](?:\s*[+/]\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\])*\s*$/.test(shape)) return null
  const values = [...shape.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].split(/[×,]/).map(Number))
  if (values.flat().some((value) => !Number.isSafeInteger(value) || value < 1)) return null
  const count = values.reduce((sum, axes) => sum + axes.reduce((product, axis) => product * axis, 1), 0)
  return Number.isSafeInteger(count) ? count : null
}

export function weightElements(weight: ModelWeight, model: ModelArchitecture, tp: TensorParallelSize, ep: TensorParallelSize = 1) {
  const { shape } = formatWeight(weight, model, { phase: 'decode', batch: 1, sequence: 1024, tp, cacheBytes: 2 }, ep)
  const count = shapeElements(shape)
  const copies = weight.multiplicity ?? 1
  if (count === null || !Number.isSafeInteger(copies) || copies < 1 || !Number.isSafeInteger(count * copies)) return null
  return count * copies
}

/** Only the explicitly illustrated Decoder tensors, not a checkpoint inventory. */
export function decoderWeightBudget(model: ModelArchitecture, layer: number, tp: TensorParallelSize, bits: WeightBits, ep: TensorParallelSize = 1, mixed?: MixedPrecision, attentionTp: TensorParallelSize = tp) {
  if (!Number.isInteger(layer) || layer < 0 || layer >= model.dimensions.layers || !model.supportedTp.includes(tp) || ![4, 8, 16, 32].includes(bits)) throw new Error('Invalid weight budget conditions')
  if (!expertParallelSizes(model, tp).includes(ep) || !model.supportedTp.includes(attentionTp) || attentionTp > tp || tp % attentionTp) throw new Error('Invalid weight parallelism')
  if (mixed) {
    validateMixedPrecision(mixed)
    if (!supportsMixedPrecision(model.id)) throw new Error('Mixed policy not audited for this model')
  }
  const countLayer = (index: number) => decoderNodes(model, index).filter((node) => node.weights.length).map((node) => {
    const localTp = isAttentionWeightNode(node) ? attentionTp : tp
    const localEp = isAttentionWeightNode(node) ? 1 : ep
    const weights = node.weights.map((weight) => {
      const formatted = formatWeight(weight, model, { phase: 'decode', batch: 1, sequence: 1024, tp: localTp, cacheBytes: 2 }, localEp)
      const local = weightElements(weight, model, localTp, localEp)
      const storage = mixed ? mixedWeightStorage(formatted, node.id, mixed, index) : undefined
      return { ...formatted, copies: weight.multiplicity ?? 1, local, global: weightElements(weight, model, 1), storage, bytes: storage?.bytes ?? (local === null ? null : local * bits / 8) }
    })
    const complete = weights.every((weight) => weight.local !== null && weight.global !== null)
    const local = complete ? weights.reduce((sum, weight) => sum + weight.local!, 0) : null
    const global = complete ? weights.reduce((sum, weight) => sum + weight.global!, 0) : null
    return { node, weights, local, global, bytes: local === null ? null : weights.reduce((sum, weight) => sum + weight.bytes!, 0) }
  })
  const layers = Array.from({ length: model.dimensions.layers }, (_, index) => countLayer(index))
  const complete = layers.flat().every((row) => row.local !== null && row.global !== null)
  const rows = layers[layer].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))
  const local = complete ? rows.reduce((sum, row) => sum + row.local!, 0) : null
  const global = complete ? rows.reduce((sum, row) => sum + row.global!, 0) : null
  const allLayersLocal = complete ? layers.flat().reduce((sum, row) => sum + row.local!, 0) : null
  const allLayersGlobal = complete ? layers.flat().reduce((sum, row) => sum + row.global!, 0) : null
  return { rows, layers, complete, local, global, bytes: local === null ? null : rows.reduce((sum, row) => sum + row.bytes!, 0), allLayersLocal, allLayersGlobal, allLayersBytes: allLayersLocal === null ? null : layers.flat().reduce((sum, row) => sum + row.bytes!, 0) }
}
