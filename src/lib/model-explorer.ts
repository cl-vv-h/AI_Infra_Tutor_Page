import type { ArchitectureNode, ModelArchitecture, TensorParallelSize } from '../types/model.ts'
import type { InferenceScenario } from './model-lab.ts'
import { attentionKind, decoderNodes, layerCacheNode } from './model-lab.ts'
import type { WeightBits } from './model-weights.ts'
import { defaultCacheBudgetGiB, parseCacheBudget } from './cache-capacity.ts'

export interface ExplorerState {
  layer: number
  nodeId: string
  scenario: InferenceScenario
  weightBits?: WeightBits
  cacheBudgetGiB?: number
}

export function explorerNodes(model: ModelArchitecture, layer: number) {
  return [
    model.nodes.find((node) => node.id === 'embedding')!,
    ...decoderNodes(model, layer), layerCacheNode(model, layer),
    model.nodes.find((node) => node.id === 'lm-head')!,
    ...model.nodes.filter((node) => node.id === 'vision'),
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
  const state: ExplorerState = { layer, nodeId, scenario: { phase, batch, sequence, tp, cacheBytes }, ...(weightBits !== 16 ? { weightBits } : {}), ...(cacheBudgetGiB !== defaultCacheBudgetGiB ? { cacheBudgetGiB } : {}) }
  return { state, notices, nodes }
}

export function explorerParams(state: ExplorerState) {
  const { phase, batch, sequence, tp, cacheBytes } = state.scenario
  return new URLSearchParams({ layer: String(state.layer), node: state.nodeId, phase, b: String(batch), s: String(sequence), tp: String(tp), bytes: String(cacheBytes), ...(state.weightBits && state.weightBits !== 16 ? { wbits: String(state.weightBits) } : {}), ...(state.cacheBudgetGiB !== undefined && state.cacheBudgetGiB !== defaultCacheBudgetGiB ? { budget: String(state.cacheBudgetGiB) } : {}) })
}

export function explorerHref(modelId: string, state: ExplorerState) {
  return `/models/${modelId}?${explorerParams(state)}`
}

/** Preserve a selected module only if it really exists in the destination layer. */
export function selectExplorerLayer(model: ModelArchitecture, state: ExplorerState, layer: number): ExplorerState {
  const nodeId = explorerNodes(model, layer).some((node) => node.id === state.nodeId) ? state.nodeId : attentionKind(model, layer)
  return { ...state, layer, nodeId }
}

export interface ModuleTarget { node: ArchitectureNode; layers: number[]; global: boolean }
export function moduleIndex(model: ModelArchitecture): ModuleTarget[] {
  const index = new Map<string, ModuleTarget>()
  for (let layer = 0; layer < model.dimensions.layers; layer++) {
    for (const node of explorerNodes(model, layer)) {
      const found = index.get(node.id)
      if (found) found.layers.push(layer)
      else index.set(node.id, { node, layers: [layer], global: ['embedding', 'lm-head', 'vision'].includes(node.id) })
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
