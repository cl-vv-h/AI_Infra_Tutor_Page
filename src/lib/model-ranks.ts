import type { ModelArchitecture } from '../types/model.ts'
import { parallelSizes, isParallelSize } from '../types/model.ts'
import type { InferenceScenario } from './model-lab.ts'
import { decoderNodes, formatShape, tokenCount } from './model-lab.ts'
import { expertParallelSizes, formatWeight, weightElements } from './model-weights.ts'
import type { WeightBits } from './model-weights.ts'
import { mixedWeightStorage, supportsMixedPrecision, validateMixedPrecision } from './mixed-precision.ts'
import type { MixedPrecision } from './mixed-precision.ts'
import { tensorPayload } from './tensor-payload.ts'
import { attentionHeadRanks } from './attention-heads.ts'

export const replicaSizes = parallelSizes
export type ReplicaSize = typeof replicaSizes[number]

export { expertParallelSizes } from './model-weights.ts'

/** Independent serving replicas, each with its own TP group. Not SGLang DPA. */
export function rankTopology(tp: number, replicas: ReplicaSize, batch: number) {
  if (!isParallelSize(tp) || !replicaSizes.includes(replicas) || !Number.isInteger(batch) || batch < 1 || batch > 64) throw new Error('Invalid rank topology')
  return Array.from({ length: replicas * tp }, (_, rank) => ({
    rank, replica: Math.floor(rank / tp), tpRank: rank % tp,
    requestStart: Math.floor(rank / tp) * batch, requestEnd: (Math.floor(rank / tp) + 1) * batch - 1,
  }))
}

export function expertRankTopology(model: ModelArchitecture, tp: number, replicas: ReplicaSize, batch: number, ep: ReplicaSize) {
  if (!expertParallelSizes(model, tp).includes(ep)) throw new Error('Invalid expert parallel size')
  const moeTp = tp / ep
  const localExperts = model.execution.expertParallel ? model.execution.expertParallel.experts / ep : null
  return rankTopology(tp, replicas, batch).map((rank) => {
    const epRank = Math.floor(rank.tpRank / moeTp)
    const moeTpRank = rank.tpRank % moeTp
    return { ...rank, epRank, moeTpRank, moeTp,
      expertStart: localExperts === null ? null : epRank * localExperts,
      expertEnd: localExperts === null ? null : (epRank + 1) * localExperts - 1,
      moeTpPeers: Array.from({ length: moeTp }, (_, i) => rank.replica * tp + epRank * moeTp + i),
      epPeers: Array.from({ length: ep }, (_, i) => rank.replica * tp + i * moeTp + moeTpRank),
    }
  })
}

/** Catalogue module boundaries, not kernel buffers or a quantized checkpoint layout. */
export function rankModule(model: ModelArchitecture, layer: number, nodeId: string, scenario: InferenceScenario, bits: WeightBits, replicas: ReplicaSize, ep: ReplicaSize = 1, mixed?: MixedPrecision) {
  if (!model.supportedTp.includes(scenario.tp) || ![4, 8, 16, 32].includes(bits) || !Number.isInteger(layer) || layer < 0 || layer >= model.dimensions.layers) throw new Error('Invalid rank module conditions')
  const ranks = expertRankTopology(model, scenario.tp, replicas, scenario.batch, ep)
  const moeTp = scenario.tp / ep
  const nodes = decoderNodes(model, layer)
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) throw new Error('Module is not in this Decoder layer')
  if (mixed) {
    validateMixedPrecision(mixed)
    if (!supportsMixedPrecision(model.id)) throw new Error('Mixed policy not audited for this model')
  }
  const weights = node.weights.map((weight) => {
    const { name, note, shape } = formatWeight(weight, model, scenario, ep)
    const local = weightElements(weight, model, scenario.tp, ep)
    const unique = weightElements(weight, model, 1)
    const storage = mixed ? mixedWeightStorage({ ...weight, name, shape }, nodeId, mixed, layer) : undefined
    return { name, note,
      routedExpert: weight.routedExpert ?? false, copies: weight.multiplicity ?? 1, shape,
      unshardedShape: formatShape(weight.shape, model, { ...scenario, tp: 1 }),
      local, unique, storage, bytes: storage?.bytes ?? (local === null ? null : local * bits / 8) }
  })
  const complete = weights.every((weight) => weight.local !== null && weight.unique !== null)
  const localBytes = complete ? weights.reduce((sum, weight) => sum + weight.bytes!, 0) : null
  const uniqueBytes = complete ? node.weights.reduce((sum, weight, index) => sum + (mixed ? mixedWeightStorage(formatWeight(weight, model, { ...scenario, tp: 1 }, 1), nodeId, mixed, layer).bytes : weights[index].unique! * bits / 8), 0) : null
  const metadata = model.execution.expertParallel
  const hasExperts = weights.some((weight) => weight.routedExpert)
  const input = formatShape(node.inputShape, model, scenario)
  const output = formatShape(node.outputShape, model, scenario)
  return { node, ranks, weights, complete, localBytes, uniqueBytes, ep, moeTp,
    attentionHeads: nodeId === 'gqa' ? attentionHeadRanks(model, scenario.tp, replicas) : null,
    expertExecution: metadata && hasExperts ? { ...metadata, localExperts: metadata.experts / ep,
      intermediate: model.execution.expertIntermediateSize! / moeTp,
      minLocalAssignments: tokenCount(scenario) * Math.max(0, metadata.topK - (metadata.experts - metadata.experts / ep)),
      maxLocalAssignments: tokenCount(scenario) * Math.min(metadata.topK, metadata.experts / ep),
    } : null,
    groupBytes: localBytes === null ? null : localBytes * scenario.tp,
    fleetBytes: localBytes === null ? null : localBytes * ranks.length,
    localTokens: tokenCount(scenario), totalRequests: scenario.batch * replicas,
    input, output, inputPayload: tensorPayload(input), outputPayload: tensorPayload(output),
    tensors: (node.tensors ?? []).map((tensor) => {
      const shape = formatShape(tensor.shape, model, scenario)
      return { ...tensor, shape, payload: tensorPayload(shape) }
    }),
  }
}
