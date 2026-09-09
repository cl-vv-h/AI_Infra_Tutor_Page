import type { ModelArchitecture } from '../types/model.ts'
import { attentionKind } from './model-lab.ts'
import { comparisonParams, defaultComparisonScenario } from './model-comparison.ts'

export const attentionFilters = [
  { id: 'all', label: '全部注意力' }, { id: 'mha', label: '完整 MHA' },
  { id: 'gqa', label: '完整 GQA' }, { id: 'mla', label: 'MLA' },
  { id: 'swa', label: '全滑窗' }, { id: 'mixed', label: '完整 + 滑窗' },
  { id: 'hybrid', label: 'DeltaNet 混合' },
] as const
export type AttentionFilter = typeof attentionFilters[number]['id']
export interface CatalogState { query: string; attention: AttentionFilter; ffn: 'all' | 'dense' | 'moe'; selected: string[] }
export const emptyCatalog: CatalogState = { query: '', attention: 'all', ffn: 'all', selected: [] }

export function modelAttentionProfile(model: ModelArchitecture): Exclude<AttentionFilter, 'all'> {
  const kind = model.execution.cache.kind
  return kind === 'gqa' && model.dimensions.attentionHeads === model.dimensions.kvHeads ? 'mha' : kind
}
export function hasExperts(model: ModelArchitecture) { return model.execution.denseLayers < model.dimensions.layers }
export function attentionComposition(model: ModelArchitecture) {
  const counts = new Map<ReturnType<typeof attentionKind>, number>()
  for (let layer = 0; layer < model.dimensions.layers; layer++) {
    const kind = attentionKind(model, layer)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts].map(([kind, count]) => ({ kind, count }))
}

export function parseCatalog(params: URLSearchParams, registry: ModelArchitecture[]) {
  const notices: string[] = []
  const rawQuery = params.get('q') ?? ''
  const query = Array.from(rawQuery).filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').slice(0, 200)
  if (query !== rawQuery) notices.push('搜索词已移除控制字符并限制为 200 字符。')
  const rawAttention = params.get('attention') ?? 'all'
  const attention = attentionFilters.some((item) => item.id === rawAttention) ? rawAttention as AttentionFilter : 'all'
  if (attention !== rawAttention) notices.push('未知注意力类型，已显示全部类型。')
  const rawFfn = params.get('ffn') ?? 'all'
  const ffn = ['all', 'dense', 'moe'].includes(rawFfn) ? rawFfn as CatalogState['ffn'] : 'all'
  if (ffn !== rawFfn) notices.push('未知 FFN 类型，已显示全部类型。')
  const rawSelected = params.get('pick') ?? ''
  const requested = rawSelected.slice(0, 2000).split(',').filter(Boolean)
  const known = new Set(registry.map((model) => model.id))
  const selected = [...new Set(requested.filter((id) => known.has(id)))].slice(0, 3)
  if (selected.join(',') !== rawSelected) notices.push('已忽略不存在、重复或超过三项的对比选择。')
  return { state: { query, attention, ffn, selected } satisfies CatalogState, notices }
}

export function catalogParams(state: CatalogState) {
  const params = new URLSearchParams()
  if (state.query) params.set('q', state.query)
  if (state.attention !== 'all') params.set('attention', state.attention)
  if (state.ffn !== 'all') params.set('ffn', state.ffn)
  if (state.selected.length) params.set('pick', state.selected.join(','))
  return params
}

const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
export function filterCatalog(registry: ModelArchitecture[], state: CatalogState) {
  const words = state.query.trim().split(/\s+/).map(normalized).filter(Boolean)
  if (state.query.trim() && !words.length) return []
  return registry.filter((model) => {
    if (state.attention !== 'all' && modelAttentionProfile(model) !== state.attention) return false
    if (state.ffn === 'dense' && hasExperts(model) || state.ffn === 'moe' && !hasExperts(model)) return false
    const text = normalized([model.id, model.name, model.organization, model.family, ...model.nodes.flatMap((node) => [node.title, ...node.weights.map((weight) => weight.name), ...(node.tensors ?? []).map((tensor) => tensor.label)])].join(' '))
    return words.every((word) => text.includes(word))
  })
}

export function toggleCatalogSelection(state: CatalogState, id: string, registry: ModelArchitecture[]): CatalogState {
  if (!registry.some((model) => model.id === id)) return state
  if (state.selected.includes(id)) return { ...state, selected: state.selected.filter((item) => item !== id) }
  return state.selected.length >= 3 ? state : { ...state, selected: [...state.selected, id] }
}

export function catalogComparisonHref(selected: string[], registry: ModelArchitecture[]) {
  if (selected.length < 2 || selected.length > 3 || new Set(selected).size !== selected.length || selected.some((id) => !registry.some((model) => model.id === id))) return null
  // Keep the comparison workbench's public, identical conditions for every model.
  return `/models/compare?${comparisonParams({ modelIds: selected, scenario: defaultComparisonScenario, scope: 'rank' })}`
}
