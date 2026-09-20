import type { ModelDirectoryEntry } from '../data/model-directory.ts'
import { isV41Entry } from '../data/model-directory.ts'
import { attentionKind } from './model-lab.ts'
import { comparisonParams, defaultComparisonScenario } from './model-comparison.ts'
import { catalogSorts } from './model-popularity.ts'
import type { CatalogSort } from './model-popularity.ts'

export const attentionFilters = [
  { id: 'all', label: '全部注意力' }, { id: 'mha', label: '完整 MHA' },
  { id: 'gqa', label: '完整 GQA' }, { id: 'mla', label: 'MLA' },
  { id: 'swa', label: '全滑窗' }, { id: 'mixed', label: '完整 + 滑窗' },
  { id: 'hybrid', label: 'DeltaNet 混合' },
  { id: 'compressed', label: 'SWA + 压缩注意力' },
  { id: 'kda-mla', label: 'KDA + MLA 混合' },
] as const
export type AttentionFilter = typeof attentionFilters[number]['id']
export interface CatalogState { query: string; attention: AttentionFilter; ffn: 'all' | 'dense' | 'moe'; selected: string[]; sort?: CatalogSort }
export const emptyCatalog: CatalogState = { query: '', attention: 'all', ffn: 'all', selected: [] }

export function modelAttentionProfile(model: ModelDirectoryEntry): Exclude<AttentionFilter, 'all'> {
  if (isV41Entry(model)) return 'compressed'
  const kind = model.execution.cache.kind
  return kind === 'gqa' && model.dimensions.attentionHeads === model.dimensions.kvHeads ? 'mha' : kind
}
export function hasExperts(model: ModelDirectoryEntry) { return model.execution.denseLayers < model.dimensions.layers }
export function attentionComposition(model: ModelDirectoryEntry) {
  if (isV41Entry(model)) return [{ kind: 'window-mqa' as const, count: 2 }, { kind: 'csa2' as const, count: 38 }]
  const counts = new Map<ReturnType<typeof attentionKind>, number>()
  for (let layer = 0; layer < model.dimensions.layers; layer++) {
    const kind = attentionKind(model, layer)
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts].map(([kind, count]) => ({ kind, count }))
}

export function parseCatalog(params: URLSearchParams, registry: ModelDirectoryEntry[]) {
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
  const sort = params.get('sort')
  const validSort = catalogSorts.includes(sort as CatalogSort)
  if (sort !== null && !validSort) notices.push('未知排序方式，已按近月下载快照排序。')
  return { state: { query, attention, ffn, selected, ...(validSort && sort !== 'downloads' ? { sort: sort as CatalogSort } : {}) } satisfies CatalogState, notices }
}

export function catalogParams(state: CatalogState) {
  const params = new URLSearchParams()
  if (state.query) params.set('q', state.query)
  if (state.attention !== 'all') params.set('attention', state.attention)
  if (state.ffn !== 'all') params.set('ffn', state.ffn)
  if (state.selected.length) params.set('pick', state.selected.join(','))
  if (state.sort && state.sort !== 'downloads' && catalogSorts.includes(state.sort)) params.set('sort', state.sort)
  return params
}

const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
export function filterCatalog<T extends ModelDirectoryEntry>(registry: T[], state: CatalogState) {
  const words = state.query.trim().split(/\s+/).map(normalized).filter(Boolean)
  if (state.query.trim() && !words.length) return []
  return registry.filter((model) => {
    if (state.attention !== 'all' && modelAttentionProfile(model) !== state.attention) return false
    if (state.ffn === 'dense' && hasExperts(model) || state.ffn === 'moe' && !hasExperts(model)) return false
    const terms = isV41Entry(model) ? model.searchTerms : model.nodes.flatMap((node) => [node.title, ...node.weights.map((weight) => weight.name), ...(node.tensors ?? []).map((tensor) => tensor.label)])
    const text = normalized([model.id, model.name, model.organization, model.family, ...terms].join(' '))
    return words.every((word) => text.includes(word))
  })
}

export function toggleCatalogSelection(state: CatalogState, id: string, registry: ModelDirectoryEntry[]): CatalogState {
  if (!registry.some((model) => model.id === id)) return state
  if (state.selected.includes(id)) return { ...state, selected: state.selected.filter((item) => item !== id) }
  return state.selected.length >= 3 ? state : { ...state, selected: [...state.selected, id] }
}

export function catalogComparisonHref(selected: string[], registry: ModelDirectoryEntry[]) {
  if (selected.length < 2 || selected.length > 3 || new Set(selected).size !== selected.length || selected.some((id) => !registry.some((model) => model.id === id))) return null
  return `/models/compare?${comparisonParams({ modelIds: selected, scenario: catalogComparisonScenario(selected, registry), scope: 'rank' })}`
}

/** A new catalogue comparison starts at one shared, supported context for all picks. */
export function catalogComparisonScenario(selected: string[], registry: ModelDirectoryEntry[]) {
  const models = registry.filter((model) => selected.includes(model.id))
  return { ...defaultComparisonScenario, sequence: Math.min(defaultComparisonScenario.sequence, ...models.map((model) => model.execution.maxContext)) }
}
