import type { ModelArchitecture } from '../types/model.ts'

/** Logical occupied cache payload plus the reference implementation's fixed FP32 compressor buffers.
 * Not the reference's max_seq_len preallocation or a production engine's paged/quantized layout. */
export function compressedCacheParts(model: ModelArchitecture, sequence: number, batch: number, bytes: number) {
  const cache = model.execution.cache
  if (cache.kind !== 'compressed') throw new Error('Expected compressed attention cache')
  const counts = { window: cache.ratios.filter(r => r === 0).length, csa: cache.ratios.filter(r => r === 4).length, hca: cache.ratios.filter(r => r === 128).length }
  const slots4 = Math.floor(sequence / 4)
  const slots128 = Math.floor(sequence / 128)
  const slidingTokens = Math.min(sequence, cache.window)
  const slidingBytes = batch * slidingTokens * cache.ratios.length * cache.kvWidth * bytes
  const compressedBytes = batch * (counts.csa * slots4 + counts.hca * slots128) * cache.kvWidth * bytes
  const indexBytes = batch * counts.csa * slots4 * cache.indexWidth * bytes
  // kv_state and score_state each [B, coff*r, coff*D], coff=2 for overlap C4, else 1.
  const compressorBytes = batch * 2 * cache.stateBytes * (counts.csa * 2 * 4 * 2 * (cache.kvWidth + cache.indexWidth) + counts.hca * 128 * cache.kvWidth)
  return { counts, slots4, slots128, slidingTokens, slidingBytes, compressedBytes, indexBytes, compressorBytes, total: slidingBytes + compressedBytes + indexBytes + compressorBytes }
}
