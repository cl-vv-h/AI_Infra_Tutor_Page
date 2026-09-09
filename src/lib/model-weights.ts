import type { ModelArchitecture, ModelWeight, TensorParallelSize } from '../types/model.ts'
import { decoderNodes, formatShape } from './model-lab.ts'

export type WeightBits = 4 | 8 | 16 | 32

/** Parse only the catalogue's bracketed integer products; never evaluate code. */
export function shapeElements(shape: string): number | null {
  if (!/^\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\](?:\s*[+/]\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\])*\s*$/.test(shape)) return null
  const values = [...shape.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].split(/[×,]/).map(Number))
  if (values.flat().some((value) => !Number.isSafeInteger(value) || value < 1)) return null
  const count = values.reduce((sum, axes) => sum + axes.reduce((product, axis) => product * axis, 1), 0)
  return Number.isSafeInteger(count) ? count : null
}

export function weightElements(weight: ModelWeight, model: ModelArchitecture, tp: TensorParallelSize) {
  const shape = formatShape(weight.shape, model, { phase: 'decode', batch: 1, sequence: 1024, tp, cacheBytes: 2 })
  const count = shapeElements(shape)
  const copies = weight.multiplicity ?? 1
  if (count === null || !Number.isSafeInteger(copies) || copies < 1 || !Number.isSafeInteger(count * copies)) return null
  return count * copies
}

/** Only the explicitly illustrated Decoder tensors, not a checkpoint inventory. */
export function decoderWeightBudget(model: ModelArchitecture, layer: number, tp: TensorParallelSize, bits: WeightBits) {
  if (!Number.isInteger(layer) || layer < 0 || layer >= model.dimensions.layers || !model.supportedTp.includes(tp) || ![4, 8, 16, 32].includes(bits)) throw new Error('Invalid weight budget conditions')
  const countLayer = (index: number) => decoderNodes(model, index).filter((node) => node.weights.length).map((node) => {
    const weights = node.weights.map((weight) => ({ name: weight.name, shape: formatShape(weight.shape, model, { phase: 'decode', batch: 1, sequence: 1024, tp, cacheBytes: 2 }), copies: weight.multiplicity ?? 1, local: weightElements(weight, model, tp), global: weightElements(weight, model, 1) }))
    const complete = weights.every((weight) => weight.local !== null && weight.global !== null)
    const local = complete ? weights.reduce((sum, weight) => sum + weight.local!, 0) : null
    const global = complete ? weights.reduce((sum, weight) => sum + weight.global!, 0) : null
    return { node, weights, local, global, bytes: local === null ? null : local * bits / 8 }
  })
  const layers = Array.from({ length: model.dimensions.layers }, (_, index) => countLayer(index))
  const complete = layers.flat().every((row) => row.local !== null && row.global !== null)
  const rows = layers[layer].sort((a, b) => (b.local ?? 0) - (a.local ?? 0))
  const local = complete ? rows.reduce((sum, row) => sum + row.local!, 0) : null
  const global = complete ? rows.reduce((sum, row) => sum + row.global!, 0) : null
  const allLayersLocal = complete ? layers.flat().reduce((sum, row) => sum + row.local!, 0) : null
  const allLayersGlobal = complete ? layers.flat().reduce((sum, row) => sum + row.global!, 0) : null
  return { rows, complete, local, global, bytes: local === null ? null : local * bits / 8, allLayersLocal, allLayersGlobal, allLayersBytes: allLayersLocal === null ? null : allLayersLocal * bits / 8 }
}
