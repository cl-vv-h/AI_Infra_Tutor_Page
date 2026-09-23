/** Verified against the official minimal implementation, not a SGLang backend. */
import { isParallelSize } from '../types/model.ts'
export const v41Reference = {
  revision: '517ef625df97ec57aadc91b67506a57c20fdc5bb', layers: 40, encoderLayers: 20,
  hidden: 5120, heads: 64, headDim: 512, qRank: 1280, outputGroups: 8, outputRank: 1024,
  vocab: 129280, maxContext: 1048576, window: 128, experts: 384, topK: 6, intermediate: 2304,
  kvSources: [2, 8, 14, 20] as readonly number[],
  indexSources: [2, 8, 14, 20, 24, 28, 32, 36] as readonly number[],
  engram: [{ layer: 1, rows: 384006168 }, { layer: 14, rows: 384016682 }],
  candidateSource: 20, candidateBlocks: 2048, candidateBlockSize: 8, indexTopK: 512,
  indexHeads: 32, indexWidth: 128,
} as const
export const v41Source = (file: string) => `https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/${v41Reference.revision}/${file}`
const integer = (n: number, min: number, max: number) => Number.isSafeInteger(n) && n >= min && n <= max

export interface V41Scenario { layer: number; batch: number; sequence: number; world: number; replicas: number; rank: number; phase: 'prefill' | 'decode'; storage: 'packed' | 'reference'; weightMode: 'native' | '4' | '8' | '16' | '32'; flow: 'attention' | 'moe' | 'engram'; view?: 'diagram' | 'cache' | 'weights'; lesson?: number }
export function parseV41Scenario(params: URLSearchParams) {
  const notices: string[] = []
  const number = (key: string, fallback: number, valid: (n: number) => boolean) => {
    const raw = params.get(key)
    if (raw === null) return fallback
    const n = Number(raw)
    if (/^\d+$/.test(raw) && Number.isSafeInteger(n) && valid(n)) return n
    notices.push(`${key} 无效，已恢复 ${fallback}。`)
    return fallback
  }
  const oneOf = <T extends string>(key: string, fallback: T, choices: readonly T[]) => {
    const raw = params.get(key)
    if (raw === null) return fallback
    if (choices.includes(raw as T)) return raw as T
    notices.push(`${key} 无效，已恢复 ${fallback}。`)
    return fallback
  }
  const world = number('world', 4, (n) => [1, 2, 4, 8].includes(n))
  const replicas = number('replicas', 1, isParallelSize)
  const state: V41Scenario = {
    layer: number('layer', 20, (n) => integer(n, 0, 39)), batch: number('b', 1, (n) => integer(n, 1, 64)),
    sequence: number('s', 4096, (n) => integer(n, 1, v41Reference.maxContext)), world, replicas,
    rank: number('rank', 0, (n) => integer(n, 0, world * replicas - 1)),
    phase: oneOf('phase', 'decode', ['prefill', 'decode']), storage: oneOf('storage', 'reference', ['reference', 'packed']),
    weightMode: oneOf('weights', 'native', ['native', '4', '8', '16', '32']),
    flow: oneOf('flow', 'attention', ['attention', 'moe', 'engram']),
    view: oneOf('view', 'diagram', ['diagram', 'cache', 'weights']),
    ...(params.has('lesson') ? { lesson: number('lesson', 0, (n) => integer(n, 0, 7)) } : {}),
  }
  return { state, notices }
}
export function v41Params(state: V41Scenario) {
  return new URLSearchParams({ layer: String(state.layer), b: String(state.batch), s: String(state.sequence),
    world: String(state.world), replicas: String(state.replicas), rank: String(Math.min(state.rank, state.world * state.replicas - 1)),
    phase: state.phase, storage: state.storage, weights: state.weightMode, flow: state.flow,
    ...(state.view && state.view !== 'diagram' ? { view: state.view } : {}),
    ...(state.lesson !== undefined ? { lesson: String(state.lesson) } : {}) })
}

export function v41Layer(layer: number) {
  if (!integer(layer, 0, 39)) throw new Error('Invalid V4.1 layer')
  const ratio = layer < 2 ? 0 : layer < 20 ? 2 : 1
  const nearest = (sources: readonly number[]) => sources.filter((source) => source <= layer).at(-1) ?? null
  const ownsKv = v41Reference.kvSources.includes(layer)
  const ownsIndex = v41Reference.indexSources.includes(layer)
  return { layer, region: layer < 20 ? 'encoder' : 'decoder', ratio,
    mode: ratio === 0 ? 'window' : ownsKv ? 'full' : ownsIndex ? 'reindex' : 'reuse',
    kvSource: nearest(v41Reference.kvSources), indexKeySource: nearest(v41Reference.kvSources),
    topKSource: nearest(v41Reference.indexSources), candidateSource: layer >= 20 ? 20 : null,
    ownsKv, ownsIndex, engram: v41Reference.engram.find((item) => item.layer === layer) ?? null,
    attentionPreFrom: layer === 0 ? '初始 one-hot [1,0,0,0]' : `Layer ${layer - 1} FFN 产生的 pre`,
    ffnPreFrom: `Layer ${layer} Attention 产生的 pre`,
  }
}

/** Occupied records; packed design includes scales, reference uses fake-quant BF16 values. */
export function v41Cache(batch: number, sequence: number, storage: 'packed' | 'reference') {
  if (!integer(batch, 1, 64) || !integer(sequence, 1, v41Reference.maxContext) || !['packed', 'reference'].includes(storage)) throw new Error('Invalid V4.1 cache scenario')
  const formats = storage === 'packed'
    ? { main: 512 / 2 + 512 / 16, index: 128 / 2 + 128 / 32, window: 512 + 512 / 32 }
    : { main: 512 * 2, index: 128 * 2, window: 512 * 2 }
  const owners = v41Reference.kvSources.map((layer) => {
    const ratio = v41Layer(layer).ratio
    const records = Math.floor(sequence / ratio)
    return { layer, ratio, records, mainBytes: batch * records * formats.main, indexBytes: batch * records * formats.index }
  })
  const globalBytes = owners.reduce((sum, owner) => sum + owner.mainBytes + owner.indexBytes, 0)
  const windowBytes = batch * 40 * Math.min(sequence, 128) * formats.window
  // Three C2 owners; value/score each keep [B,2,512] FP32. C1 has neither state.
  const compressorBytes = batch * 3 * 2 * 2 * 512 * 4
  return { owners, formats, globalBytes, windowBytes, compressorBytes,
    total: globalBytes + windowBytes + compressorBytes,
    // Reference allocates max_seq_len buffers, not just occupied records.
    referenceAllocatedAtContext: storage === 'reference' ? batch * (v41Reference.maxContext * 2.5 * 640 * 2 + 40 * 128 * 512 * 2 + 3 * 2 * 2 * 512 * 4) : null,
  }
}

/** Query is a zero-based raw token position. Never assume learned candidate rankings. */
export function v41Query(layer: number, query: number) {
  if (!integer(query, 0, v41Reference.maxContext - 1)) throw new Error('Invalid V4.1 query')
  const state = v41Layer(layer)
  const records = state.ratio ? Math.floor((query + 1) / state.ratio) : 0
  const blocks = Math.ceil(records / 8)
  return { ...state, records, selectedPositions: Math.min(512, records),
    visibleBlocks: state.candidateSource === null ? 0 : blocks,
    keptBlocks: state.candidateSource === null ? 0 : Math.min(2048, blocks),
    candidatePositionUpper: state.candidateSource === null ? records : Math.min(records, 2048 * 8),
    pinnedBlock: state.candidateSource === null || records === 0 ? null : Math.floor((records - 1) / 8),
  }
}

export type V41Dtype = 'bf16' | 'fp32' | 'fp8-block32' | 'fp4-block32' | 'fp8-row32'
export interface V41Weight { name: string; shape: number[]; dtype: V41Dtype; copies: number; placement: 'replicated' | 'head-shard' | 'expert-shard' | 'row-shard' }

/** Serialized/runtime parameter payload, excluding allocator and kernel-specific repacking. */
export function v41WeightStorage(weight: V41Weight, uniformBits?: 4 | 8 | 16 | 32) {
  if (!['bf16', 'fp32', 'fp8-block32', 'fp4-block32', 'fp8-row32'].includes(weight.dtype) || !weight.shape.length || !weight.shape.every((n) => integer(n, 1, Number.MAX_SAFE_INTEGER)) || !integer(weight.copies, 1, 1000) || (uniformBits !== undefined && ![4, 8, 16, 32].includes(uniformBits))) throw new Error('Invalid weight layout')
  const elements = weight.shape.reduce((product, n) => product * n, weight.copies)
  if (!Number.isSafeInteger(elements)) throw new Error('Unsafe weight size')
  if (uniformBits !== undefined) return { elements, payloadShape: weight.shape, scaleShape: [] as number[], dataBytes: elements * uniformBits / 8, scaleBytes: 0, bytes: elements * uniformBits / 8 }
  const [out, input] = weight.shape
  const quant = weight.dtype.startsWith('fp8-') || weight.dtype.startsWith('fp4-')
  if (quant && (weight.shape.length !== 2 || input % 32 !== 0)) throw new Error('Quantized reference matrices require 32-aligned input')
  const scaleShape = weight.dtype === 'fp8-block32' ? [Math.ceil(out / 32), input / 32]
    : weight.dtype === 'fp4-block32' || weight.dtype === 'fp8-row32' ? [out, input / 32] : []
  const payloadShape = weight.dtype === 'fp4-block32' ? [out, input / 2] : weight.shape
  const dataBytes = elements * (weight.dtype === 'fp32' ? 4 : weight.dtype === 'bf16' ? 2 : weight.dtype === 'fp4-block32' ? 0.5 : 1)
  const scaleBytes = scaleShape.length ? weight.copies * scaleShape[0] * scaleShape[1] : 0
  return { elements, payloadShape, scaleShape, dataBytes, scaleBytes, bytes: dataBytes + scaleBytes }
}

export function v41Weights(layer: number, world: number): V41Weight[] {
  if (![1, 2, 4, 8].includes(world)) throw new Error('Invalid reference world size')
  const state = v41Layer(layer), H = 5120, I = 2304
  const weight = (name: string, shape: number[], dtype: V41Dtype, placement: V41Weight['placement'] = 'replicated', copies = 1): V41Weight => ({ name, shape, dtype, placement, copies })
  const result = [
    weight('attn.wq_a', [1280, H], 'fp8-block32'), weight('attn.q_norm', [1280], 'bf16'),
    weight('attn.wq_b', [64 / world * 512, 1280], 'fp8-block32', 'head-shard'),
    weight('attn.wkv', [512, H], 'fp8-block32'), weight('attn.kv_norm', [512], 'bf16'),
    weight('attn.wo_a', [8 / world * 1024, 4096], 'bf16', 'head-shard'),
    weight('attn.wo_b', [H, 8 / world * 1024], 'fp8-block32', 'head-shard'),
    weight('attn.sink', [64 / world], 'fp32', 'head-shard'),
    weight('attn_norm / ffn_norm', [H], 'bf16', 'replicated', 2),
    weight('hc_attn_fn / hc_ffn_fn', [24, 4 * H], 'fp32', 'replicated', 2),
    weight('hc_attn_base / hc_ffn_base', [24], 'fp32', 'replicated', 2),
    weight('hc_attn_scale / hc_ffn_scale', [3], 'fp32', 'replicated', 2),
    weight('ffn.gate.weight', [384, H], 'bf16'), weight('ffn.gate.bias / bias_vl', [384], 'fp32', 'replicated', 2),
    weight('routed w1 / w3 · 每个本地专家', [I, H], 'fp4-block32', 'expert-shard', 2 * 384 / world),
    weight('routed w2 · 每个本地专家', [H, I], 'fp4-block32', 'expert-shard', 384 / world),
    weight('shared w1 / w3', [I, H], 'fp8-block32', 'replicated', 2),
    weight('shared w2', [H, I], 'fp8-block32'),
  ]
  if (state.ownsKv) {
    result.push(weight('compressor.wkv', [512, H], state.ratio === 2 ? 'fp32' : 'bf16'), weight('compressor.norm', [512], 'bf16'))
    if (state.ratio === 2) result.push(weight('compressor.wgate', [512, H], 'fp32'))
  }
  if (state.ownsIndex) {
    result.push(weight('indexer.wq_b', [32 / world * 128, 1280], 'fp8-block32', 'head-shard'), weight('indexer.weights_proj', [32 / world, H], 'bf16', 'head-shard'))
    if (state.ownsKv) result.push(weight('indexer.wk', [128, 512], 'bf16'), weight('indexer.k_norm', [128], 'bf16'))
  }
  if (state.engram) result.push(
    weight('engram.embed', [Math.ceil(state.engram.rows / world), 256], 'fp8-row32', 'row-shard'),
    weight('engram.wkv', [5 * H, 24 * 256], 'fp8-block32'),
    weight('engram.q_weight / k_weight', [4, H], 'bf16', 'replicated', 2),
  )
  return result
}

type V41Axes = (number | 'T_e')[]
export interface V41Stage { id: string; title: string; input: V41Axes; output: V41Axes; note: string; weightNames: string[] }

/** Flatten B and the current query length only. S still means total request history. */
export function v41RankFlow(state: V41Scenario) {
  const { world, replicas, rank, batch, sequence, phase } = state
  if (![1, 2, 4, 8].includes(world) || !isParallelSize(replicas) || !integer(rank, 0, world * replicas - 1) || !integer(batch, 1, 64) || !integer(sequence, 1, v41Reference.maxContext) || !['prefill', 'decode'].includes(phase)) throw new Error('Invalid V4.1 rank scenario')
  const layer = v41Layer(state.layer)
  const localRank = rank % world, replica = Math.floor(rank / world)
  const tokens = batch * (phase === 'prefill' ? sequence : 1)
  const heads = 64 / world, groups = 8 / world, experts = 384 / world
  const stage = (id: string, title: string, input: V41Axes, output: V41Axes, note: string, weightNames: string[] = []): V41Stage => ({ id, title, input, output, note, weightNames })
  const reduce = world > 1 ? '同副本内 AllReduce 求和；Shape 不变，但部分和变为完整结果。' : 'world=1，无跨卡归约；本地结果已完整。'
  const attention = [
    stage('q-latent', 'Q 低秩投影 + Norm', [tokens, 5120], [tokens, 1280], '单路 Attention 输入在本副本内复制；Q latent 不按 world 分片。', ['attn.wq_a', 'attn.q_norm']),
    stage('q-heads', 'Q heads 分片', [tokens, 1280], [tokens, heads, 512], '各卡得到不同的完整 head；不是同一 head 的部分和。', ['attn.wq_b']),
    stage('window-kv', '并行支路：本层窗口 KV', [tokens, 5120], [tokens, 512], '读取与 Q 相同的单路输入，经 Norm / RoPE 写窗口。所有 heads 共用一个向量，K/V 不乘二。', ['attn.wkv', 'attn.kv_norm']),
    stage('sparse-attn', '本地 sparse Attention', [tokens, heads, 512], [tokens, heads, 512], `另读取本层窗口${layer.kvSource === null ? '，无全局 KV' : `与 Layer ${layer.kvSource} 的共享全局 KV`}；输出做逆 RoPE。`, ['attn.sink']),
    stage('output-a', '分组输出投影 wo_a', [tokens, groups, 4096], [tokens, groups, 1024], '将每组 8 heads × 512 重排为 4096；各组单独乘自己的 BF16 矩阵，不是所有组做一个 Dense。', ['attn.wo_a']),
    stage('output-b', 'wo_b 本地矩阵乘', [tokens, groups * 1024], [tokens, 5120], world > 1 ? '输入维分片，输出尚为 partial sum，不能提前当作完整 Attention 输出。' : '本卡持有全部输入维，输出完整。', ['attn.wo_b']),
    stage('attention-reduce', 'Attention 输出归约', [tokens, 5120], [tokens, 5120], `${reduce}多卡时参考实现用 FP32 归约，再转回输入 dtype。`),
  ]
  const moe = [
    stage('router', 'Router logits', [tokens, 5120], [tokens, 384], '每卡读取同一批完整输入；Top-6 IDs / weights 各为 [N,6]，然后只执行本卡持有的专家。', ['ffn.gate.weight', 'ffn.gate.bias / bias_vl']),
    stage('expert-up', '单个本地专家：gate / up', ['T_e', 5120], ['T_e', 2304], '两个独立投影，各输出此 Shape；T_e 是命中该专家的 token 数，不假设均匀路由。', ['routed w1 / w3 · 每个本地专家']),
    stage('expert-down', '单个本地专家：down', ['T_e', 2304], ['T_e', 5120], 'gate/up 的 FP32 激活处理及路由加权后，转换为输入 dtype 再做 down。专家内部不做 TP。', ['routed w2 · 每个本地专家']),
    stage('expert-reduce', '本地 scatter-add → routed 归约', [tokens, 5120], [tokens, 5120], `各专家输出按 token 位置累积到 FP32 [N,5120]；${reduce}这是输出求和，不是 token All-to-All。`),
    stage('shared', '并行支路：完整 shared 专家', [tokens, 5120], [tokens, 5120], '中间激活 [N,2304]；每卡完整执行，之后加到已经归约的 routed 输出，不再次归约 shared。', ['shared w1 / w3', 'shared w2']),
  ]
  const rows = layer.engram ? Math.ceil(layer.engram.rows / world) : 0
  const start = localRank * rows
  const validRows = layer.engram ? Math.max(0, Math.min(rows, layer.engram.rows - start)) : 0
  const engram = layer.engram ? [
    stage('hash-lookup', '本地哈希行查表', [tokens, 24], [tokens, 24, 256], '输入是全局 hash IDs；非本卡行置零。本地行反量化为 BF16，表本身仍保留 FP8 + scale。', ['engram.embed']),
    stage('hash-reduce', '合并各卡命中的行', [tokens, 24, 256], [tokens, 24, 256], reduce),
    stage('engram-project', '共享投影：4 路 key + 1 路 value', [tokens, 6144], [tokens, 25600], '将 24×256 拼接；此投影每卡复制，输出拆为 [N,4,5120] key 与 [N,5120] value。', ['engram.wkv']),
    stage('engram-gate', '门控写入四路残差', [tokens, 4, 5120], [tokens, 4, 5120], '另读取投影 key/value；每路归一化打分并门控，图像位置屏蔽写入。', ['engram.q_weight / k_weight']),
  ] : []
  return { tokens, localRank, replica, peers: Array.from({ length: world }, (_, i) => replica * world + i),
    headStart: localRank * heads, headEnd: (localRank + 1) * heads - 1,
    expertStart: localRank * experts, expertEnd: (localRank + 1) * experts - 1,
    assignmentMin: tokens * Math.max(0, 6 - (384 - experts)), assignmentMax: tokens * Math.min(6, experts),
    engramRows: layer.engram ? { start, end: start + validRows - 1, allocated: rows, valid: validRows, padding: rows - validRows } : null,
    attention, moe, engram,
  }
}
