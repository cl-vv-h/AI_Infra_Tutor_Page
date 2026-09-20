import type { TensorParallelSize } from '../types/model.ts'
import type { ModelDirectoryEntry } from '../data/model-directory.ts'
import { isV41Entry } from '../data/model-directory.ts'
import { v41Cache, v41Params } from './deepseek-v41-reference.ts'
import { cacheEstimate } from './model-lab.ts'
import type { InferenceScenario } from './model-lab.ts'

export const defaultComparisonIds = ['llama-3-1-8b', 'glm-4-7-flash', 'qwen3-5-9b']
export const comparisonColors = ['#70e1f5', '#c7a8ff', '#d8ff78']
export const contextProbes = [1024, 4096, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
export type MemoryScope = 'rank' | 'group'
export interface ComparisonState {
  modelIds: string[]
  scenario: InferenceScenario
  scope: MemoryScope
  v41Storage?: 'reference' | 'packed'
}
export const defaultComparisonScenario: InferenceScenario = { batch: 4, sequence: 8192, tp: 4, cacheBytes: 2, phase: 'decode' }

export function parseComparison(params: URLSearchParams, registry: ModelDirectoryEntry[]): ComparisonState & { notices: string[] } {
  const notices: string[] = []
  const available = new Set(registry.map((model) => model.id))
  const requested = params.get('models')?.split(',') ?? defaultComparisonIds
  const modelIds = [...new Set(requested.filter((id) => available.has(id)))].slice(0, 3)
  if (params.has('models') && modelIds.join(',') !== requested.join(',')) notices.push('已忽略不存在、重复或超过三个的模型。')
  if (modelIds.length < 2) {
    for (const id of [...defaultComparisonIds, ...available]) {
      if (modelIds.length >= 2) break
      if (available.has(id) && !modelIds.includes(id)) modelIds.push(id)
    }
    notices.push('对比至少需要两个模型，已补充可用模型。')
  }
  const number = (key: string, fallback: number, valid: (value: number) => boolean) => {
    const raw = params.get(key)
    if (raw === null) return fallback
    const value = Number(raw)
    if (/^\d+$/.test(raw) && Number.isSafeInteger(value) && valid(value)) return value
    notices.push(`${key} 参数无效，已恢复默认值 ${fallback}。`)
    return fallback
  }
  const batch = number('b', 4, (value) => value >= 1 && value <= 64)
  const sequence = number('s', 8192, (value) => value >= 1024 && value <= 1048576)
  const tp = number('tp', 4, (value) => [1, 2, 4, 8].includes(value)) as TensorParallelSize
  const cacheBytes = number('bytes', 2, (value) => value === 1 || value === 2) as 1 | 2
  if (params.has('view') && !['rank', 'group'].includes(params.get('view')!)) notices.push('未知容量视图，已使用每卡容量。')
  const storage = params.get('v41storage')
  if (storage !== null && !['reference', 'packed'].includes(storage)) notices.push('未知 V4.1 存储口径，已恢复参考 BF16 buffer。')
  return { modelIds, scenario: { phase: 'decode', batch, sequence, tp, cacheBytes }, scope: params.get('view') === 'group' ? 'group' : 'rank', notices,
    ...(storage !== null ? { v41Storage: storage === 'packed' ? 'packed' as const : 'reference' as const } : {}) }
}

export function comparisonParams(state: ComparisonState) {
  return new URLSearchParams({ models: state.modelIds.join(','), b: String(state.scenario.batch), s: String(state.scenario.sequence), tp: String(state.scenario.tp), bytes: String(state.scenario.cacheBytes), view: state.scope, ...(state.v41Storage ? { v41storage: state.v41Storage } : {}) })
}

export function comparisonHref(modelId: string, scenario = defaultComparisonScenario) {
  return `/models/compare?${comparisonParams({ modelIds: [...new Set([modelId, ...defaultComparisonIds])].slice(0, 3), scenario, scope: 'rank' })}`
}

export function compareEstimate(model: ModelDirectoryEntry, scenario: InferenceScenario, v41Storage: 'reference' | 'packed' = 'reference') {
  const reasons: string[] = []
  if (!model.supportedTp.includes(scenario.tp)) reasons.push(`此图解尚未覆盖 TP ${scenario.tp}；可用 TP：${model.supportedTp.join(' / ')}。`)
  if (scenario.sequence > model.execution.maxContext) reasons.push(`S 超过当前配置上限 ${model.execution.maxContext.toLocaleString('en-US')}，不外推。`)
  if (!Number.isInteger(scenario.batch) || scenario.batch < 1 || scenario.batch > 64 || !Number.isInteger(scenario.sequence) || scenario.sequence < 1024 || scenario.sequence > 1048576 || ![1, 2].includes(scenario.cacheBytes)) reasons.push('推理条件超出对比工具范围。')
  if (!['reference', 'packed'].includes(v41Storage)) reasons.push('未知 V4.1 存储口径。')
  if (reasons.length) return { estimate: null, reasons }
  if (!isV41Entry(model)) return { estimate: cacheEstimate(model, scenario), reasons }
  const cache = v41Cache(scenario.batch, scenario.sequence, v41Storage)
  const compressedBytes = cache.owners.reduce((sum, owner) => sum + owner.mainBytes, 0)
  const indexBytes = cache.owners.reduce((sum, owner) => sum + owner.indexBytes, 0)
  // Single-request marginal growth; never extrapolate beyond the reference context bound.
  const growth = scenario.sequence < model.execution.maxContext ? v41Cache(1, scenario.sequence + 1, v41Storage).total - v41Cache(1, scenario.sequence, v41Storage).total : 0
  return { reasons, estimate: { perRankBytes: cache.total, allRankBytes: cache.total * scenario.tp,
    bytesPerToken: growth, growthBytesPerToken: growth, retainedTokens: scenario.sequence, valuesPerTokenPerLayer: 512,
    kvBytes: compressedBytes + cache.windowBytes, indexBytes, compressedBytes, compressorBytes: cache.compressorBytes,
    recurrentBytes: 0, convBytes: 0, kvLayers: 40, recurrentLayers: 0, fullKvLayers: 0, slidingLayers: 40,
    fullKvBytes: 0, slidingKvBytes: cache.windowBytes, slidingRetainedTokens: Math.min(scenario.sequence, 128) } }
}

export function comparisonSeries(model: ModelDirectoryEntry, scenario: InferenceScenario, v41Storage: 'reference' | 'packed' = 'reference') {
  const window = !isV41Entry(model) && (model.execution.cache.kind === 'swa' || model.execution.cache.kind === 'mixed') ? [model.execution.cache.window] : []
  const lengths = [...new Set([...contextProbes, ...window, model.execution.maxContext, scenario.sequence])].sort((a, b) => a - b)
  return lengths.flatMap((sequence) => {
    const { estimate } = compareEstimate(model, { ...scenario, sequence }, v41Storage)
    return estimate ? [{ sequence, ...estimate }] : []
  })
}

export function v41ComparisonExplorerHref(state: ComparisonState) {
  return `/models/deepseek-v4-1-flash?${v41Params({ layer: 20, batch: state.scenario.batch, sequence: state.scenario.sequence,
    world: state.scenario.tp, replicas: 1, rank: 0, phase: 'decode', storage: state.v41Storage ?? 'reference', weightMode: 'native', flow: 'attention', view: 'cache' })}`
}

export function memoryValue(estimate: ReturnType<typeof cacheEstimate>, scope: MemoryScope) {
  return scope === 'rank' ? estimate.perRankBytes : estimate.allRankBytes
}
