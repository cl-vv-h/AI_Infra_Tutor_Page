import type { KdaMlaCache } from '../types/model.ts'

/** Occupied SGLang latent/pool payload; no MTP, allocator, scale or sentinel slots. */
export function kdaMlaCacheParts(cache: KdaMlaCache, sequence: number, batch: number, tp: number, bytes: number) {
  const kvLayers = cache.layerTypes.filter(type => type === 'mla').length
  const recurrentLayers = cache.layerTypes.length - kvLayers
  const kvBytes = batch * kvLayers * sequence * cache.latentWidth * bytes
  const indexBytes = batch * kvLayers * Math.floor(sequence / cache.indexPool) * cache.indexWidth * bytes
  const tailBytes = batch * kvLayers * 2 * cache.tailSlots * cache.indexWidth * cache.tailBytes
  const recurrentBytes = batch * recurrentLayers * cache.heads / tp * cache.headDim ** 2 * cache.stateBytes
  const convBytes = batch * recurrentLayers * 3 * cache.heads / tp * cache.headDim * cache.convSlots * cache.convBytes
  const growthBytesPerToken = kvLayers * cache.latentWidth * bytes + ((sequence + 1) % cache.indexPool === 0 ? kvLayers * cache.indexWidth * bytes : 0)
  return { kvLayers, recurrentLayers, kvBytes, indexBytes, tailBytes, recurrentBytes, convBytes, growthBytesPerToken, total: kvBytes + indexBytes + tailBytes + recurrentBytes + convBytes }
}

/** Semantic valid reads for an unpadded query at position visibleTokens-1.
 * Which pools win is learned; counts do not fabricate scores or selected identities. */
export function pooledIndexReads(visibleTokens: number, poolSize: number, topk: number) {
  const completePools = Math.floor(visibleTokens / poolSize)
  const selectedPools = Math.min(completePools, Math.floor(topk / poolSize))
  const tail = visibleTokens % poolSize
  return { completePools, selectedPools, tail, rawTokens: selectedPools * poolSize + tail }
}
