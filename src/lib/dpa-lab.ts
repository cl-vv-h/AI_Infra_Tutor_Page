import { getModelArchitecture } from '../data/models.ts'
import { decoderNodes } from './model-lab.ts'
import { formatWeight, weightElements } from './model-weights.ts'
import type { WeightBits } from './model-weights.ts'
import type { TensorParallelSize } from '../types/model.ts'
import { matrixPrecisions, expertPrecisions, mixedWeightStorage } from './mixed-precision.ts'
import type { MixedPrecision } from './mixed-precision.ts'
import { readW4Stage } from './w4-lifecycle.ts'

export const dpaRevision = '96d91ef9266d2bebd8e8c09ef1f28b2d521631ff'
export const dpaSource = (file: string) => `https://github.com/sgl-project/sglang/blob/${dpaRevision}/python/sglang/srt/${file}`
export type DpaModelId = 'glm-5-2' | 'qwen3-8b'
export function dpaModel(id: DpaModelId) {
  if (!['glm-5-2', 'qwen3-8b'].includes(id)) throw new Error('DPA model not audited')
  return getModelArchitecture(id)
}
export interface DpaScenario {
  tp: TensorParallelSize; dp: TensorParallelSize; ep: TensorParallelSize; rank: number; layer: number
  requests: number[]; sequence: number; phase: 'prefill' | 'decode'; bits: WeightBits; cacheBytes: 1 | 2
  mixed?: MixedPrecision
}
const sizes = [1, 2, 4, 8] as const
export function dpaSizes(tp: number) { return sizes.filter((n) => tp % n === 0 && n <= tp) }
export function parseDpa(params: URLSearchParams, modelId: DpaModelId = 'glm-5-2') {
  const model = dpaModel(modelId), gqa = modelId === 'qwen3-8b'
  const notices: string[] = []
  const number = (key: string, fallback: number, check: (n: number) => boolean) => {
    const raw = params.get(key), n = Number(raw)
    if (raw === null) return fallback
    if (/^\d+$/.test(raw) && Number.isSafeInteger(n) && check(n)) return n
    notices.push(`${key} 无效，恢复 ${fallback}。`); return fallback
  }
  const tp = number('tp', 8, (n) => sizes.includes(n as TensorParallelSize)) as TensorParallelSize
  const dp = number('dp', Math.min(4, tp), (n) => dpaSizes(tp).includes(n as TensorParallelSize)) as TensorParallelSize
  const ep = number('ep', gqa ? 1 : Math.min(4, tp), (n) => (gqa ? [1] : dpaSizes(tp)).includes(n as TensorParallelSize)) as TensorParallelSize
  const raw = params.get('groups')
  let requests = Array.from({ length: dp }, () => 2)
  if (raw !== null) {
    const fields = raw.split(',')
    if (fields.length === dp && fields.every((s) => /^\d+$/.test(s) && Number(s) <= 64)) requests = fields.map(Number)
    else notices.push('groups 必须为每个 DPA 组提供 0–64 个请求，已恢复为每组 2 个。')
  }
  const phase = params.get('phase') === 'prefill' ? 'prefill' : 'decode'
  if (params.has('phase') && !['prefill', 'decode'].includes(params.get('phase')!)) notices.push('phase 无效，恢复 decode。')
  const state: DpaScenario = { tp, dp, ep, requests, phase,
    layer: number('layer', gqa ? 0 : 3, (n) => n < model.dimensions.layers), rank: number('rank', 0, (n) => n < tp),
    sequence: number('s', 4096, (n) => n >= 1 && n <= model.execution.maxContext),
    bits: number('bits', 16, (n) => [4, 8, 16, 32].includes(n)) as WeightBits,
    cacheBytes: number('bytes', 2, (n) => [1, 2].includes(n)) as 1 | 2,
  }
  if (params.has('precision')) {
    if (params.get('precision') === 'mixed') {
      const read = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
        const raw = params.get(key)
        if (raw === null) return fallback
        if (values.includes(raw as T)) return raw as T
        notices.push(`${key} 精度无效，恢复 ${fallback}。`); return fallback
      }
      state.mixed = { mlp: read('mlp', matrixPrecisions, 'bf16'), shared: read('shared', matrixPrecisions, 'bf16'), experts: read('experts', expertPrecisions, 'bf16'), ...readW4Stage(params, notices) }
      if (gqa) {
        if (state.mixed.shared !== 'bf16' || state.mixed.experts !== 'bf16' || state.mixed.w4Stage) notices.push('Qwen3-8B 没有专家模块，已清除不适用的 Shared/Routed 精度与 W4A8 阶段。')
        state.mixed = { mlp: state.mixed.mlp, shared: 'bf16', experts: 'bf16' }
      }
    } else notices.push('precision 无效，恢复统一位宽理论对照。')
  }
  return { state, notices }
}
export function dpaParams(state: DpaScenario, modelId: DpaModelId = 'glm-5-2') {
  dpaModel(modelId)
  const dp = Math.min(state.dp, state.tp), ep = modelId === 'qwen3-8b' ? 1 : Math.min(state.ep, state.tp)
  const requests = Array.from({ length: dp }, (_, i) => state.requests[i] ?? 2)
  const params = new URLSearchParams({ tp: String(state.tp), dp: String(dp), ep: String(ep), rank: String(Math.min(state.rank, state.tp - 1)),
    groups: requests.join(','), layer: String(state.layer), s: String(state.sequence), phase: state.phase, bits: String(state.bits), bytes: String(state.cacheBytes) })
  if (state.mixed) {
    params.set('precision', 'mixed')
    for (const key of ['mlp', 'shared', 'experts'] as const) params.set(key, state.mixed[key])
    if (state.mixed.w4Stage) params.set('w4stage', state.mixed.w4Stage)
  }
  return params
}

/** Audited eager LayerCommunicator: CP=PP=MoE-DP=1, A2A=none, Dense MLP total TP. */
export function dpaLayout(state: DpaScenario, modelId: DpaModelId = 'glm-5-2') {
  const model = dpaModel(modelId), gqa = modelId === 'qwen3-8b'
  const canonical = parseDpa(dpaParams(state, modelId), modelId)
  if (canonical.notices.length || state.requests.length !== state.dp || !sizes.includes(state.tp) || !dpaSizes(state.tp).includes(state.dp) || !(gqa ? [1] : dpaSizes(state.tp)).includes(state.ep) || !Number.isInteger(state.rank) || state.rank < 0 || state.rank >= state.tp || state.requests.some((n) => !Number.isInteger(n) || n < 0 || n > 64)) throw new Error('Invalid DPA scenario')
  const attentionTp = state.tp / state.dp as TensorParallelSize, moeTp = state.tp / state.ep
  const raw = state.requests.map((b) => b * (state.phase === 'prefill' ? state.sequence : 1))
  // ForwardBatch aligns counts BEFORE choosing the eager padding mode.
  const aligned = state.dp === 1 ? raw : raw.map((n) => Math.ceil(n / attentionTp) * attentionTp)
  const maximum = Math.max(...aligned), sum = aligned.reduce((a, b) => a + b, 0)
  const mode = state.dp === 1 ? 'NONE' : state.phase === 'prefill' ? 'SUM_LEN' : sum * 2 >= maximum * state.dp ? 'MAX_LEN' : 'SUM_LEN'
  const counts = mode === 'MAX_LEN' ? aligned.map(() => maximum) : aligned
  const totalTokens = raw.reduce((a, b) => a + b, 0), bufferRows = counts.reduce((a, b) => a + b, 0)
  const totalRequests = state.requests.reduce((a, b) => a + b, 0)
  const cacheWidth = (tp: number) => gqa ? 2 * (model.dimensions.kvHeads / tp) * model.dimensions.headDim : 704
  const perRequestCache = state.sequence * model.dimensions.layers * cacheWidth(attentionTp) * state.cacheBytes
  const normalPerRequestCache = state.sequence * model.dimensions.layers * cacheWidth(state.tp) * state.cacheBytes
  const groups = counts.map((padded, dpRank) => ({ dpRank, requests: state.requests[dpRank], tokens: raw[dpRank], aligned: aligned[dpRank], padded,
    offset: counts.slice(0, dpRank).reduce((a, b) => a + b, 0),
    peers: Array.from({ length: attentionTp }, (_, i) => dpRank * attentionTp + i),
    cacheBytes: state.requests[dpRank] * perRequestCache,
  }))
  // Half-open row intervals describe ownership, not kernel dispatch or learned routing.
  const bufferSegments = groups.flatMap((group) => [
    { dpRank: group.dpRank, kind: 'tokens' as const, start: group.offset, rows: group.tokens },
    { dpRank: group.dpRank, kind: 'alignment' as const, start: group.offset + group.tokens, rows: group.aligned - group.tokens },
    { dpRank: group.dpRank, kind: 'maximum' as const, start: group.offset + group.aligned, rows: group.padded - group.aligned },
  ].filter((segment) => segment.rows > 0))
  const ranks = Array.from({ length: state.tp }, (_, rank) => {
    const dpRank = Math.floor(rank / attentionTp), epRank = Math.floor(rank / moeTp)
    return { rank, dpRank, attentionRank: rank % attentionTp, epRank, moeTpRank: rank % moeTp,
      headsStart: rank % attentionTp * (model.dimensions.attentionHeads / attentionTp), headsEnd: (rank % attentionTp + 1) * (model.dimensions.attentionHeads / attentionTp) - 1,
      kvHeadsStart: gqa ? rank % attentionTp * (model.dimensions.kvHeads / attentionTp) : null,
      kvHeadsEnd: gqa ? (rank % attentionTp + 1) * (model.dimensions.kvHeads / attentionTp) - 1 : null,
      expertStart: gqa ? null : epRank * model.execution.expertParallel!.experts / state.ep,
      expertEnd: gqa ? null : (epRank + 1) * model.execution.expertParallel!.experts / state.ep - 1,
      epPeers: Array.from({ length: state.ep }, (_, i) => i * moeTp + rank % moeTp),
      moeTpPeers: Array.from({ length: moeTp }, (_, i) => epRank * moeTp + i),
      group: groups[dpRank],
    }
  })
  const countLayer = (layer: number) => decoderNodes(model, layer).flatMap((node) => node.weights.map((weight) => {
    const attention = node.id === (gqa ? 'gqa' : 'mla')
    const tp = attention ? attentionTp : state.tp
    const scenario = { phase: state.phase, batch: 1, sequence: state.sequence, tp, cacheBytes: state.cacheBytes }
    const layout = formatWeight(weight, model, scenario, attention ? 1 : state.ep)
    const elements = weightElements(weight, model, tp, attention ? 1 : state.ep)
    if (elements === null) throw new Error('Unresolved DPA weight')
    const storage = state.mixed ? mixedWeightStorage(layout, node.id, state.mixed) : undefined
    return { ...layout, node: node.title, nodeId: node.id, storage, bytes: storage?.bytes ?? elements * state.bits / 8, attention }
  }))
  const layerBudgets = Array.from({ length: model.dimensions.layers }, (_, layer) => {
    const weights = countLayer(layer)
    return { layer, weights, bytes: weights.reduce((sum, weight) => sum + weight.bytes, 0) }
  })
  const weights = layerBudgets[state.layer].weights
  const allLayersWeightBytes = layerBudgets.reduce((sum, layer) => sum + layer.bytes, 0)
  const localTokens = ranks[state.rank].group.tokens
  const boundary = (id: string, label: string, rows: number) => ({ id, label, shape: [rows, model.dimensions.hiddenSize], bytes: rows * model.dimensions.hiddenSize * 2, dtype: 'BF16' as const })
  // Logical boundary payloads, NOT simultaneously live allocations or kernel dtypes.
  const boundaryTensors = [
    boundary('attention-input', 'Attention 有效输入', localTokens),
    boundary('ffn-input', 'FFN 汇合输入', bufferRows),
    boundary('ffn-output', 'FFN 合并后逻辑输出', bufferRows),
    boundary('group-output', '返回本组有效输出', localTokens),
  ]
  const tensor = (id: string, label: string, shape: number[], copies = 1) => ({ id, label, shape, copies, bytes: shape.reduce((a, b) => a * b, 1) * 2 * copies, dtype: 'BF16' as const })
  const internalTensors = gqa ? [
    tensor('qkv', '融合 QKV 投影（有效 token）', [localTokens, (model.dimensions.attentionHeads + 2 * model.dimensions.kvHeads) * model.dimensions.headDim / attentionTp]),
    tensor('q', 'Q（QKV 的视图）', [localTokens, model.dimensions.attentionHeads / attentionTp, model.dimensions.headDim]),
    tensor('kv', 'K / V 各一份（QKV 的视图）', [localTokens, model.dimensions.kvHeads / attentionTp, model.dimensions.headDim], 2),
    tensor('gate-up', 'Gate / Up 合并投影（含 padding）', [bufferRows, 2 * model.dimensions.intermediateSize / state.tp]),
    tensor('activation', 'SiLU(Gate) × Up（含 padding）', [bufferRows, model.dimensions.intermediateSize / state.tp]),
    tensor('down-partial', 'Down 部分和（总 TP 归约前）', [bufferRows, model.dimensions.hiddenSize]),
  ] : []
  const cacheShape = gqa ? [ranks[state.rank].group.requests, state.sequence, 2, model.dimensions.kvHeads / attentionTp, model.dimensions.headDim] : null
  return { model, gqa, cacheShape, internalTensors, attentionTp, moeTp, mode, groups, bufferSegments, ranks, selected: ranks[state.rank], raw, aligned, counts, totalRequests, totalTokens, bufferRows,
    paddingRows: bufferRows - totalTokens, globalBufferBytes: bufferRows * model.dimensions.hiddenSize * 2,
    sumBufferRows: sum, maxBufferRows: maximum * state.dp,
    weights, layerWeightBytes: weights.reduce((sum, w) => sum + w.bytes, 0),
    layerBudgets: layerBudgets.map(({ layer, bytes }) => ({ layer, bytes })), allLayersWeightBytes, allRanksWeightBytes: allLayersWeightBytes * state.tp, boundaryTensors,
    dpaCacheBytes: totalRequests * perRequestCache * attentionTp,
    normalTpCacheBytes: totalRequests * normalPerRequestCache * state.tp,
    dense: state.layer < model.execution.denseLayers,
  }
}
