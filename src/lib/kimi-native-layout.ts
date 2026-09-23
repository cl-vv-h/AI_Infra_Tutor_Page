import checkpoint from '../data/kimi-checkpoint-audit.json' with { type: 'json' }
import { isParallelSize } from '../types/model.ts'

const count = (shape: number[]) => shape.reduce((a, b) => a * b, 1)
const width = (dtype: string) => ({ BF16: 2, F32: 4, U8: 1 })[dtype]
export const nativeRoles: Record<string, string> = { experts: 'Routed 专家', router: 'Router', latent: 'Latent 投影 / Norm', shared: 'Shared MLP', dense: 'Dense MLP', attention: 'Attention', norms: 'Decoder Norm / AttnRes', embedding: 'Embedding', head: 'LM Head', vision: '视觉塔 / 投影', output: '输出 Norm / AttnRes' }

/** Checkpoint-derived initial parameter allocation for CUDA SM100 FlashInfer MXFP4.
 * PP=1, no DPA, a2a=none, no EPLB/redundant experts; default model dtype BF16.
 * Deliberately before backend post-load transformations, aliases and extra buffers.
 */
export function kimiNativeLayout(tp: number, ep: number, replicas = 1, rank = 0) {
  if (![1, 2, 4, 8].includes(tp) || ![1, 2, 4, 8].includes(ep) || tp % ep || !isParallelSize(replicas) || !Number.isInteger(rank) || rank < 0 || rank >= tp * replicas) throw new Error('Invalid native Kimi topology')
  const moeTp = tp / ep
  const tpRank = rank % tp
  const epRank = Math.floor(tpRank / moeTp)
  const moeTpRank = tpRank % moeTp
  const rows = checkpoint.templates.map(template => {
    const name = template.name
    let shape = [...template.shape]
    let dtype = template.dtype
    let copies = template.count
    let role: string
    let axis: number | null = null
    let parts = tp
    let partRank = tpRank
    let note = '各 TP rank 复制；独立 DP 再复制整个 TP 组。'
    if (name.startsWith('vision_tower.') || name.startsWith('mm_projector.')) role = 'vision'
    else if (name.includes('.experts.')) {
      role = 'experts'
      copies /= ep
      axis = name.includes('.w2.') ? 1 : 0
      parts = moeTp
      partRank = moeTpRank
      note = '每行是单个本地专家张量；份数包含 92 层 × 本地专家数。w1/w3 按 OUT，w2 按 IN（包括 packed 与 scale 轴）切分。加载时 w1/w3 合并为 w13，不重复计数。'
    } else if (name.includes('.block_sparse_moe.gate.')) role = 'router'
    else if (name.includes('.routed_expert_')) role = 'latent'
    else if (name.includes('.shared_experts.')) { role = 'shared'; axis = name.endsWith('.down_proj.weight') ? 1 : 0 }
    else if (name.includes('.mlp.')) { role = 'dense'; axis = name.endsWith('.down_proj.weight') ? 1 : 0 }
    else if (name.includes('.self_attn.')) {
      role = 'attention'
      if (name.endsWith('.A_log')) {
        shape = [1, 1, 96 / tp, 1]
        note = `文件 [128] 仅加载 head ${tpRank * 96 / tp}–${(tpRank + 1) * 96 / tp - 1}，保留 FP32；末尾 32 个不加载。`
      } else if (name.endsWith('.o_norm.weight')) {
        dtype = 'BF16'
        note = 'FusedRMSNormGated 未显式指定 dtype，按模型默认 BF16 分配；文件 F32 在 copy_ 时转换。'
      } else if (/\.(f_a_proj|q_a_proj|kv_a_proj_with_mqa|q_a_layernorm|kv_a_layernorm)\.weight$/.test(name)) {
        // Low-rank input projections and their norms are replicated.
      } else if (name.endsWith('.o_proj.weight')) axis = 1
      else if (/\.(b_proj|f_b_proj|g_proj|k_proj|q_proj|v_proj|q_b_proj|kv_b_proj|[qkv]_conv1d)\.weight$/.test(name) || name.endsWith('.dt_bias')) axis = 0
      else throw new Error(`Unmapped attention tensor: ${name}`)
    } else if (name.includes('.embed_tokens.')) { role = 'embedding'; axis = 0 }
    else if (name.includes('.lm_head.')) { role = 'head'; axis = 0 }
    else if (name.includes('.layers.')) role = 'norms'
    else if (/language_model\.model\.(norm|output_attn_res_norm|output_attn_res_proj)\.weight$/.test(name)) role = 'output'
    else throw new Error(`Unmapped checkpoint tensor: ${name}`)
    let range: [number, number] | null = null
    if (axis !== null) {
      if (shape[axis] % parts) throw new Error('Non-divisible checkpoint axis')
      shape[axis] /= parts
      range = [partRank * shape[axis], (partRank + 1) * shape[axis]]
      if (role !== 'experts') note = `按 axis ${axis} 在 TP 组切分；区间使用左闭右开存储索引。`
    }
    const elementBytes = width(dtype)
    if (!elementBytes || !Number.isInteger(copies)) throw new Error('Invalid native dtype/count')
    const bytes = count(shape) * elementBytes * copies
    return { name, checkpointShape: template.shape, checkpointDtype: template.dtype, shape, dtype, copies, role, axis, range, note, bytes }
  })
  const localExperts = 896 / ep
  const intermediate = 3072 / moeTp
  // For these supported shapes SM100 FlashInfer's 128-alignment adds no padding.
  if (intermediate % 128 || 3584 % 128) throw new Error('Unexpected SM100 padding')
  const expertBuffers = [
    { name: 'w13_weight', shape: [localExperts, 2 * intermediate, 1792], dtype: 'U8', kind: 'checkpoint' },
    { name: 'w13_weight_scale', shape: [localExperts, 2 * intermediate, 112], dtype: 'U8', kind: 'checkpoint' },
    { name: 'w2_weight', shape: [localExperts, 3584, intermediate / 2], dtype: 'U8', kind: 'checkpoint' },
    { name: 'w2_weight_scale', shape: [localExperts, 3584, intermediate / 32], dtype: 'U8', kind: 'checkpoint' },
    { name: 'w13_weight_bias', shape: [localExperts, 2 * intermediate], dtype: 'BF16', kind: 'zero' },
    { name: 'w2_weight_bias', shape: [localExperts, 3584], dtype: 'BF16', kind: 'zero' },
  ].map(buffer => ({ ...buffer, bytes: count(buffer.shape) * width(buffer.dtype)!, copies: 92 }))
  const parametersBytes = rows.reduce((sum, row) => sum + row.bytes, 0)
  const addedBiasBytes = expertBuffers.filter(b => b.kind === 'zero').reduce((sum, b) => sum + b.bytes * b.copies, 0)
  const expertsBytes = rows.filter(row => row.role === 'experts').reduce((sum, row) => sum + row.bytes, 0)
  if (expertsBytes !== expertBuffers.filter(b => b.kind === 'checkpoint').reduce((sum, b) => sum + b.bytes * b.copies, 0)) throw new Error('Fused/native expert allocation mismatch')
  const bytes = parametersBytes + addedBiasBytes
  const groups = Object.entries(nativeRoles).map(([role, label]) => ({ role, label, bytes: rows.filter(r => r.role === role).reduce((sum, r) => sum + r.bytes, 0) }))
  return { tp, ep, replicas, rank, tpRank, epRank, moeTpRank, moeTp, localExperts, intermediate, replica: Math.floor(rank / tp), expertRange: [epRank * localExperts, (epRank + 1) * localExperts] as const,
    rows, groups, expertBuffers, parametersBytes, addedBiasBytes, bytes, groupBytes: bytes * tp, fleetBytes: bytes * tp * replicas }
}
