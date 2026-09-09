import type { ModelArchitecture, TensorParallelSize } from '../types/model.ts'
import { cacheEstimate } from './model-lab.ts'
import type { InferenceScenario } from './model-lab.ts'

export const defaultComparisonIds = ['llama-3-1-8b', 'glm-4-7-flash', 'qwen3-5-9b']
export const comparisonColors = ['#70e1f5', '#c7a8ff', '#d8ff78']
export const contextProbes = [1024, 4096, 16384, 32768, 65536, 131072, 262144]
export type MemoryScope = 'rank' | 'group'
export interface ComparisonState {
  modelIds: string[]
  scenario: InferenceScenario
  scope: MemoryScope
}
export const defaultComparisonScenario: InferenceScenario = { batch: 4, sequence: 8192, tp: 4, cacheBytes: 2, phase: 'decode' }

export function parseComparison(params: URLSearchParams, registry: ModelArchitecture[]): ComparisonState & { notices: string[] } {
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
  const sequence = number('s', 8192, (value) => value >= 1024 && value <= 262144)
  const tp = number('tp', 4, (value) => [1, 2, 4, 8].includes(value)) as TensorParallelSize
  const cacheBytes = number('bytes', 2, (value) => value === 1 || value === 2) as 1 | 2
  if (params.has('view') && !['rank', 'group'].includes(params.get('view')!)) notices.push('未知容量视图，已使用每卡容量。')
  return { modelIds, scenario: { phase: 'decode', batch, sequence, tp, cacheBytes }, scope: params.get('view') === 'group' ? 'group' : 'rank', notices }
}

export function comparisonParams(state: ComparisonState) {
  return new URLSearchParams({ models: state.modelIds.join(','), b: String(state.scenario.batch), s: String(state.scenario.sequence), tp: String(state.scenario.tp), bytes: String(state.scenario.cacheBytes), view: state.scope })
}

export function comparisonHref(modelId: string, scenario = defaultComparisonScenario) {
  return `/models/compare?${comparisonParams({ modelIds: [...new Set([modelId, ...defaultComparisonIds])].slice(0, 3), scenario, scope: 'rank' })}`
}

export function compareEstimate(model: ModelArchitecture, scenario: InferenceScenario) {
  const reasons: string[] = []
  if (!model.supportedTp.includes(scenario.tp)) reasons.push(`此图解尚未覆盖 TP ${scenario.tp}；可用 TP：${model.supportedTp.join(' / ')}。`)
  if (scenario.sequence > model.execution.maxContext) reasons.push(`S 超过当前配置上限 ${model.execution.maxContext.toLocaleString('en-US')}，不外推。`)
  if (!Number.isInteger(scenario.batch) || scenario.batch < 1 || scenario.batch > 64 || !Number.isInteger(scenario.sequence) || scenario.sequence < 1024 || scenario.sequence > 262144 || ![1, 2].includes(scenario.cacheBytes)) reasons.push('推理条件超出对比工具范围。')
  return reasons.length ? { estimate: null, reasons } : { estimate: cacheEstimate(model, scenario), reasons }
}

export function comparisonSeries(model: ModelArchitecture, scenario: InferenceScenario) {
  const lengths = [...new Set([...contextProbes, model.execution.maxContext, scenario.sequence])].sort((a, b) => a - b)
  return lengths.flatMap((sequence) => {
    const { estimate } = compareEstimate(model, { ...scenario, sequence })
    return estimate ? [{ sequence, ...estimate }] : []
  })
}

export function memoryValue(estimate: ReturnType<typeof cacheEstimate>, scope: MemoryScope) {
  return scope === 'rank' ? estimate.perRankBytes : estimate.allRankBytes
}
