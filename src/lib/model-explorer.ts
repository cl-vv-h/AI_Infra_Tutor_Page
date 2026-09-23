import type { ArchitectureNode, ModelArchitecture, TensorParallelSize } from '../types/model.ts'
import type { InferenceScenario } from './model-lab.ts'
import { attentionKind, decoderNodes, layerCacheNode } from './model-lab.ts'
import type { WeightBits } from './model-weights.ts'
import { expertParallelSizes, replicaSizes } from './model-ranks.ts'
import type { ReplicaSize } from './model-ranks.ts'
import { defaultCacheBudgetGiB, parseCacheBudget } from './cache-capacity.ts'
import { availableExpertFormats, expertFormats } from './expert-packing.ts'
import type { ExpertFormat } from './expert-packing.ts'
import { readWeightOverrides, writeWeightOverrides } from './weight-precision-policy.ts'
import { matrixPrecisions, expertPrecisions, supportsMixedPrecision, availableMixedExperts } from './mixed-precision.ts'
import type { MixedPrecision } from './mixed-precision.ts'
import { readW4Stage } from './w4-lifecycle.ts'

export const explorerViews = [
  { id: 'diagram', label: '结构图' },
  { id: 'cache', label: '缓存容量' },
  { id: 'weights', label: '权重清单' },
] as const
export type ExplorerView = typeof explorerViews[number]['id']

export function explorerViewForKey(view: ExplorerView, key: string): ExplorerView | null {
  const index = explorerViews.findIndex((item) => item.id === view)
  const next = key === 'Home' ? 0 : key === 'End' ? explorerViews.length - 1 : key === 'ArrowRight' ? (index + 1) % explorerViews.length : key === 'ArrowLeft' ? (index + explorerViews.length - 1) % explorerViews.length : null
  return next === null ? null : explorerViews[next].id
}

export interface ExplorerState {
  layer: number
  nodeId: string
  scenario: InferenceScenario
  weightBits?: WeightBits
  replicas?: ReplicaSize
  rank?: number
  ep?: ReplicaSize
  cacheBudgetGiB?: number
  view?: ExplorerView
  expertFormat?: ExpertFormat
  mixed?: MixedPrecision
  nativeStage?: 'processed'
}

export function explorerNodes(model: ModelArchitecture, layer: number) {
  return [
    model.nodes.find((node) => node.id === 'embedding')!,
    ...decoderNodes(model, layer), layerCacheNode(model, layer),
    model.nodes.find((node) => node.id === 'lm-head')!,
    ...model.nodes.filter((node) => ['vision', 'hc-expand'].includes(node.id)),
  ]
}

export function parseExplorer(params: URLSearchParams, model: ModelArchitecture) {
  const notices: string[] = []
  const integer = (key: string, fallback: number, valid: (n: number) => boolean, range: string) => {
    const raw = params.get(key)
    if (raw === null) return fallback
    const n = Number(raw)
    if (/^\d+$/.test(raw) && Number.isSafeInteger(n) && valid(n)) return n
    notices.push(`${key} 参数无效（${range}），已恢复为 ${fallback}。`)
    return fallback
  }
  const layer = integer('layer', 0, (n) => n >= 0 && n < model.dimensions.layers, `0–${model.dimensions.layers - 1}`)
  const batch = integer('b', 4, (n) => n >= 1 && n <= 64, '1–64')
  const sequence = integer('s', Math.min(4096, model.execution.maxContext), (n) => n >= 1024 && n <= model.execution.maxContext, `1024–${model.execution.maxContext}`)
  const tp = integer('tp', model.supportedTp.includes(4) ? 4 : model.supportedTp[0], (n) => model.supportedTp.includes(n as TensorParallelSize), model.supportedTp.join('/')) as TensorParallelSize
  const cacheBytes = integer('bytes', 2, (n) => n === 1 || n === 2, '1/2') as 1 | 2
  const weightBits = integer('wbits', 16, (n) => [4, 8, 16, 32].includes(n), '4/8/16/32') as WeightBits
  const replicas = integer('replicas', 1, (n) => replicaSizes.includes(n as ReplicaSize), '1/2/4/8') as ReplicaSize
  const rank = integer('rank', 0, (n) => n >= 0 && n < tp * replicas, `0–${tp * replicas - 1}`)
  const allowedEp = expertParallelSizes(model, tp)
  const ep = integer('ep', 1, (n) => allowedEp.includes(n as ReplicaSize), allowedEp.join('/')) as ReplicaSize
  const requestedBudget = params.get('budget')
  const budget = requestedBudget === null ? defaultCacheBudgetGiB : parseCacheBudget(requestedBudget)
  if (budget === null) notices.push('budget 参数无效（0–1024 GiB，最多三位小数），已恢复为 8 GiB。')
  const cacheBudgetGiB = budget ?? defaultCacheBudgetGiB
  const phase = params.get('phase') === 'prefill' ? 'prefill' : 'decode'
  if (params.has('phase') && !['prefill', 'decode'].includes(params.get('phase')!)) notices.push('未知推理阶段，已恢复为 Decode。')
  const nodes = explorerNodes(model, layer)
  const requested = params.get('node')
  const nodeId = nodes.some((node) => node.id === requested) ? requested! : attentionKind(model, layer)
  if (requested !== null && requested !== nodeId) notices.push(`该模块不在 Layer ${layer} 中，已选择本层注意力。可用模块检索跳转到适用层。`)
  const requestedView = params.get('view')
  const view = explorerViews.find((item) => item.id === requestedView)?.id ?? 'diagram'
  if (requestedView !== null && !explorerViews.some((item) => item.id === requestedView)) notices.push('未知工作区，已返回结构图。')
  const state: ExplorerState = { layer, nodeId, scenario: { phase, batch, sequence, tp, cacheBytes }, ...(ep !== 1 ? { ep } : {}), ...(replicas !== 1 ? { replicas } : {}), ...(rank !== 0 ? { rank } : {}), ...(weightBits !== 16 ? { weightBits } : {}), ...(cacheBudgetGiB !== defaultCacheBudgetGiB ? { cacheBudgetGiB } : {}), ...(view !== 'diagram' ? { view } : {}) }
  const requestedPacking = params.get('packing')
  if (params.has('native')) {
    if (model.id === 'kimi-k3' && params.get('native') === 'processed') state.nativeStage = 'processed'
    else if (params.get('native') !== 'initial' || model.id !== 'kimi-k3') notices.push('原生加载阶段不在本模型的核对范围内，已恢复初始参数。')
  }
  if (params.has('precision')) {
    if (params.get('precision') === 'mixed' && supportsMixedPrecision(model.id)) {
      const read = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
        const value = params.get(key)
        if (value === null) return fallback
        if (allowed.includes(value as T)) return value as T
        notices.push(`${key} 精度无效，已恢复为 ${fallback}。`)
        return fallback
      }
      state.mixed = { mlp: read('mlp', matrixPrecisions, 'bf16'), shared: read('shared', matrixPrecisions, 'bf16'), experts: read('experts', expertPrecisions, 'bf16'), ...readW4Stage(params, notices) }
      if (model.id === 'qwen3-8b') {
        if (state.mixed.shared !== 'bf16' || state.mixed.experts !== 'bf16' || state.mixed.w4Stage) notices.push('Qwen3-8B 没有专家模块，已清除不适用的 Shared/Routed 精度与 W4A8 阶段。')
        state.mixed = { mlp: state.mixed.mlp, shared: 'bf16', experts: 'bf16' }
      }
      if (model.id === 'qwen3-30b-a3b') {
        if (state.mixed.mlp !== 'bf16' || state.mixed.shared !== 'bf16') notices.push('Qwen3-30B-A3B 没有 Dense 或 Shared MLP，已清除不适用的精度。')
        state.mixed = { ...state.mixed, mlp: 'bf16', shared: 'bf16' }
        if (!availableMixedExperts(model.id, tp, ep).includes(state.mixed.experts)) {
          notices.push(`当前 MoE-TP=${tp / ep}，专家中间维 ${768 / (tp / ep)} 不满足 FP8 block / INT4 / W4A8 的 128 对齐，已恢复 routed BF16；可增大 EP 后重新选择。`)
          state.mixed = { mlp: 'bf16', shared: 'bf16', experts: 'bf16' }
        }
      }
      state.mixed = readWeightOverrides(params, model, tp, ep, state.mixed, notices)
    } else notices.push('该模型或链接尚不支持此混合精度方案，已恢复统一位宽。')
  }
  if (requestedPacking !== null) {
    if (availableExpertFormats(model).includes(requestedPacking as ExpertFormat)) {
      if (requestedPacking !== 'bf16') state.expertFormat = requestedPacking as ExpertFormat
    } else notices.push('该专家加载格式不在本模型的核对范围内，已恢复为 BF16 基线。')
  }
  return { state, notices, nodes }
}

export function explorerParams(state: ExplorerState) {
  const { phase, batch, sequence, tp, cacheBytes } = state.scenario
  const replicas = replicaSizes.includes(state.replicas as ReplicaSize) ? state.replicas! : 1
  // Shrinking a valid topology clamps the selected teaching rank to its last card.
  const rank = Number.isSafeInteger(state.rank) && state.rank! >= 0 ? Math.min(state.rank!, tp * replicas - 1) : 0
  const ep = replicaSizes.includes(state.ep as ReplicaSize) ? Math.min(state.ep!, tp) : 1
  const result = new URLSearchParams({ layer: String(state.layer), node: state.nodeId, phase, b: String(batch), s: String(sequence), tp: String(tp), bytes: String(cacheBytes), ...(ep !== 1 ? { ep: String(ep) } : {}), ...(replicas !== 1 ? { replicas: String(replicas) } : {}), ...(rank !== 0 ? { rank: String(rank) } : {}), ...(state.weightBits && state.weightBits !== 16 ? { wbits: String(state.weightBits) } : {}), ...(state.cacheBudgetGiB !== undefined && state.cacheBudgetGiB !== defaultCacheBudgetGiB ? { budget: String(state.cacheBudgetGiB) } : {}), ...(state.view === 'cache' || state.view === 'weights' ? { view: state.view } : {}), ...(state.expertFormat && state.expertFormat !== 'bf16' && expertFormats.includes(state.expertFormat) ? { packing: state.expertFormat } : {}) })
  if (state.mixed) {
    result.set('precision', 'mixed')
    for (const key of ['mlp', 'shared', 'experts'] as const) result.set(key, state.mixed[key])
    if (state.mixed.w4Stage) result.set('w4stage', state.mixed.w4Stage)
    writeWeightOverrides(result, state.mixed)
  }
  if (state.nativeStage === 'processed') result.set('native', 'processed')
  return result
}

export function explorerHref(modelId: string, state: ExplorerState) {
  return `/models/${modelId}?${explorerParams(modelId === 'kimi-k3' ? state : { ...state, nativeStage: undefined })}`
}

/** Preserve a selected module only if it really exists in the destination layer. */
export function selectExplorerLayer(model: ModelArchitecture, state: ExplorerState, layer: number): ExplorerState {
  const nodeId = explorerNodes(model, layer).some((node) => node.id === state.nodeId) ? state.nodeId : attentionKind(model, layer)
  return { ...state, layer, nodeId }
}

/** Module inspection always returns to the graph without resetting the experiment. */
export function selectExplorerNode(state: ExplorerState, nodeId: string, layer = state.layer): ExplorerState {
  return { ...state, nodeId, layer, view: 'diagram' }
}

export interface ModuleTarget { node: ArchitectureNode; layers: number[]; global: boolean }
export function moduleIndex(model: ModelArchitecture): ModuleTarget[] {
  const index = new Map<string, ModuleTarget>()
  for (let layer = 0; layer < model.dimensions.layers; layer++) {
    for (const node of explorerNodes(model, layer)) {
      const found = index.get(node.id)
      if (found) found.layers.push(layer)
      else index.set(node.id, { node, layers: [layer], global: ['embedding', 'lm-head', 'vision', 'hc-expand'].includes(node.id) })
    }
  }
  return [...index.values()]
}

export function findModules(index: ModuleTarget[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return index.filter(({ node }) => {
    const text = [node.id, node.title, node.subtitle, ...node.weights.map((weight) => weight.name), ...(node.tensors ?? []).map((tensor) => tensor.label)].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

export function nearestModuleLayer(target: ModuleTarget, current: number) {
  return target.layers.reduce((best, layer) => Math.abs(layer - current) < Math.abs(best - current) ? layer : best, target.layers[0])
}
