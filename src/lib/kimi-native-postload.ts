import { kimiNativeLayout } from './kimi-native-layout.ts'

export type KimiNativeStage = 'initial' | 'processed'
const elements = (shape: number[]) => shape.reduce((a, b) => a * b, 1)
const widths: Record<string, number> = { U8: 1, 'F8_E4M3FN view': 1, BF16: 2, F32: 4, I64: 8 }
function tensor(name: string, shape: number[], dtype: string, copies: number, note: string) {
  const bytes = elements(shape) * widths[dtype]
  return { name, shape, dtype, copies, bytes, totalBytes: bytes * copies, note }
}

/** SGLang 96d91ef + its pinned FlashInfer 0.6.18, SM100/trtllm-gen MXFP4.
 * This inventories named persistent tensors; it is not all GPU allocations.
 */
export function kimiNativePostload(tp: number, ep: number, replicas = 1, rank = 0) {
  const initial = kimiNativeLayout(tp, ep, replicas, rank)
  const { localExperts: e } = initial
  const expertBuffers = initial.expertBuffers.map(buffer => {
    const dtype = buffer.kind === 'zero' ? 'F32' : buffer.name.endsWith('_scale') ? 'F8_E4M3FN view' : 'U8'
    return tensor(buffer.name, buffer.shape, dtype, 92, buffer.kind === 'zero' ? '由 BF16 零 bias 转为 FP32；替换原分配，不把两份相加。' : buffer.name.endsWith('_scale') ? 'UE8M0 scale 字节按 block interleave 重排后，以 float8_e4m3fn view 保存；不是数值转成 E4M3 scale。' : buffer.name === 'w13_weight' ? 'w13 从 [gate; up] 变为 (up_i, gate_i) 配对，再做行置换；容器形状与字节不变。' : 'w2 做行置换；容器形状与字节不变。')
  })
  for (const [name, value] of [['gemm1_alpha', 4], ['gemm1_beta', 1], ['gemm1_clamp_limit', 25]] as const) {
    expertBuffers.push(tensor(name, [e], 'F32', 92, `每个本地专家一个参数，初始值 ${value}；不是每个 token 的激活张量。`))
  }
  const initialExpertBytes = initial.expertBuffers.reduce((sum, b) => sum + b.bytes * b.copies, 0)
  const processedExpertBytes = expertBuffers.reduce((sum, b) => sum + b.totalBytes, 0)
  const parameterBytes = initial.bytes - initialExpertBytes + processedExpertBytes
  const persistent = [
    tensor('MLA w_kc', [96 / tp, 128, 512], 'BF16', 24, 'transpose→contiguous→transpose 创建独立存储；原 kv_b_proj 保留。'),
    tensor('MLA w_vc', [96 / tp, 512, 128], 'BF16', 24, '从 kv_b_proj 的 strided 切片 contiguous 后转置；独立存储。'),
    tensor('AttnRes combined weight · BF16', [7168], 'BF16', 187, '93 层 × 两个 score 投影 + 输出投影；按 dtype 缓存，未与原始 Norm/Proj 共享。'),
    tensor('AttnRes combined weight · F32', [7168], 'F32', 187, '与 BF16 缓存是不同存储；全 TP 复制，不按 head 切分。'),
  ]
  // Shape + tile + scale mode are cache keys. These six entries are distinct.
  // FlashInfer already returns device indices; SGLang .to(same device) aliases them.
  const permutationCaches = initial.expertBuffers.map(buffer => tensor(
    `${buffer.name} row indices`, [buffer.shape[1]], 'I64', 1,
    '每个 rank/设备的一份缓存，92 个 MoE 层和本地专家共享；两个 cache 字典引用同一 Tensor。',
  ))
  persistent.push(...permutationCaches)
  const padRows = (8 - (128 + 96 / tp) % 8) % 8
  if (padRows) persistent.push(tensor('KDA merged f_a / b padding', [padRows, 7168], 'BF16', 69, '原参数改指向 merged buffer 的 views；只增加末尾 padding，不把完整 merged buffer 重复计算。'))
  if (tp === 8) {
    persistent.push(
      tensor('KDA fused decode Q/K/V conv copies', [4, 1536], 'F32', 69 * 3, 'TP8 时满足固定 kernel shape；每个 segment contiguous 保存一份。转置中间量 wt 是临时量，不再累计。'),
      tensor('KDA fused decode zero conv bias', [4608], 'F32', 69, '原卷积无 bias，预备路径创建 FP32 零向量。'),
      tensor('KDA fused decode output norm copy', [128], 'F32', 69, '由原 BF16 o_norm 转为 FP32 并保留；A_log 的 detach/reshape 只是 view，不增加存储。'),
    )
  }
  const persistentBytes = persistent.reduce((sum, t) => sum + t.totalBytes, 0)
  const trackedBytes = parameterBytes + persistentBytes
  return { initial, expertBuffers, persistent, permutationCaches, processedExpertBytes, parameterBytes, parameterDeltaBytes: parameterBytes - initial.bytes,
    persistentBytes, trackedBytes, groupBytes: trackedBytes * tp, fleetBytes: trackedBytes * tp * replicas,
    aliases: ['MoE merged front 与 shared gate/up、Router gate、latent down 共用存储', 'KDA merged f_a/b 与两个原参数共用存储（padding 另计）', 'KDA _bfa_f_b_w 引用已有 f_b 参数', 'KDA fused A_log 引用已有参数', 'FlashInfer 原 cache 与 SGLang device cache 共用六个 indices Tensor'] }
}
