import type { ModelArchitecture, TensorParallelSize } from '../types/model.ts'
import { decoderWeightBudget } from './model-weights.ts'
import type { WeightBits } from './model-weights.ts'
import type { MixedPrecision } from './mixed-precision.ts'

export function attentionDpSizes(model: ModelArchitecture, tp: TensorParallelSize): TensorParallelSize[] {
  return ([1, 2, 4, 8] as const).filter(dp => tp % dp === 0 && model.supportedTp.includes(tp / dp as TensorParallelSize))
}

/** Same balanced contiguous split as SGLang get_pp_indices: extra layers at the end. */
export function pipelineStages(layers: number, pp: number) {
  if (!Number.isInteger(layers) || !Number.isInteger(pp) || layers < 1 || pp < 1 || pp > layers) throw new Error('Invalid pipeline stages')
  const base = Math.floor(layers / pp), extra = layers % pp
  let start = 0
  return Array.from({ length: pp }, (_, stage) => {
    const count = base + Number(stage >= pp - extra)
    const result = { stage, start, end: start + count, count }
    start += count
    return result
  })
}

export interface WeightDeployment {
  tp: TensorParallelSize
  ep: TensorParallelSize
  attentionDp: TensorParallelSize
  pp: number
  stage: number
  replicas: TensorParallelSize
}

/** Logical illustrated Decoder storage, NOT full checkpoint or deployment feasibility. */
export function deploymentWeightBudget(model: ModelArchitecture, layer: number, bits: WeightBits, config: WeightDeployment, mixed?: MixedPrecision) {
  const { tp, ep, attentionDp, pp, stage, replicas } = config
  if (!attentionDpSizes(model, tp).includes(attentionDp) || ![1, 2, 4, 8].includes(replicas) || !Number.isInteger(stage) || stage < 0 || stage >= pp) throw new Error('Invalid deployment configuration')
  const attentionTp = tp / attentionDp as TensorParallelSize
  const budget = decoderWeightBudget(model, layer, tp, bits, ep, mixed, attentionTp)
  const stages = pipelineStages(model.dimensions.layers, pp).map(part => {
    const rows = budget.layers.slice(part.start, part.end).flat()
    const complete = rows.every(row => row.bytes !== null)
    return { ...part, bytes: complete ? rows.reduce((sum, row) => sum + row.bytes!, 0) : null }
  })
  const allStagesKnown = stages.every(part => part.bytes !== null)
  const oneReplicaBytes = allStagesKnown ? stages.reduce((sum, part) => sum + part.bytes! * tp, 0) : null
  return { ...budget, stages, selectedStage: stages[stage], attentionTp, moeTp: tp / ep,
    cards: tp * pp * replicas, oneReplicaBytes,
    fleetBytes: oneReplicaBytes === null ? null : oneReplicaBytes * replicas,
    maxRankBytes: allStagesKnown ? Math.max(...stages.map(part => part.bytes!)) : null,
    layerIsLocal: layer >= stages[stage].start && layer < stages[stage].end,
  }
}
