/** Kimi-K3 snapshot order: aggregate first, then snapshot/reset at a block boundary. */
export function attentionResidualStage(layer: number, blockSize: number) {
  if (!Number.isInteger(layer) || layer < 0 || !Number.isInteger(blockSize) || blockSize < 1) throw new RangeError('Invalid layer or residual block size')
  const bankBefore = Math.ceil(layer / blockSize)
  const write = layer % blockSize === 0
  const bankAfter = bankBefore + Number(write)
  return { bankBefore, bankAfter, write, attentionCandidates: bankBefore + 1, ffnCandidates: bankAfter + 1 }
}

export function residualSnapshotLabel(index: number, blockSize: number) {
  return index === 0 ? '输入 embedding' : `Layers ${(index - 1) * blockSize}–${index * blockSize - 1} 的子层输出和`
}
