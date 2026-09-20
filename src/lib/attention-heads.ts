import type { ModelArchitecture } from '../types/model.ts'

export const attentionHeadSource = 'https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/linear.py#L1369'

/** Audited ordinary QKVParallelLinear, no DPA, CP, gathered QKV or special KV TP. */
export function attentionHeadRanks(model: ModelArchitecture, tp: number, replicas: number) {
  if (!['llama-3-1-8b', 'qwen3-8b', 'qwen3-30b-a3b'].includes(model.id)) return null
  const { attentionHeads: q, kvHeads: kv, headDim } = model.dimensions
  if (![1, 2, 4, 8].includes(tp) || ![1, 2, 4, 8].includes(replicas)
    || ![q, kv, headDim].every(n => Number.isSafeInteger(n) && n > 0)
    || !Number.isSafeInteger(q * headDim) || !Number.isSafeInteger(kv * headDim)
    || q % tp || q % kv || (tp <= kv ? kv % tp : tp % kv)) throw new Error('Invalid attention head topology')
  const localQ = q / tp, localKv = Math.max(1, kv / tp)
  const kvCopies = Math.max(1, tp / kv)
  return Array.from({ length: tp * replicas }, (_, rank) => {
    const replica = Math.floor(rank / tp), tpRank = rank % tp
    const qStart = tpRank * localQ, kvStart = Math.floor(tpRank / kvCopies) * localKv
    return { rank, replica, tpRank, qStart, qEnd: qStart + localQ, kvStart, kvEnd: kvStart + localKv,
      qRows: [qStart * headDim, (qStart + localQ) * headDim],
      kvRows: [kvStart * headDim, (kvStart + localKv) * headDim],
      kvCopies, kvPeers: Array.from({ length: kvCopies }, (_, i) => replica * tp + Math.floor(tpRank / kvCopies) * kvCopies + i),
    }
  })
}
