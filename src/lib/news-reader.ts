import type { NewsCategory, NewsItem, NewsSourceType } from '../types/news'

const categories = new Set(['ai', 'technology', 'finance', 'world'])
const types = new Set(['research', 'engineering', 'release', 'institution', 'analysis', 'news'])
export const readingListKey = 'ai-infra-news-reading-list-v2'
export const legacyReadingListKey = 'ai-infra-news-reading-list'

export type NewsView = 'daily' | 'library' | 'releases' | 'archive' | 'saved'
export interface NewsFilters {
  category: 'all' | NewsCategory
  sourceType: 'all' | NewsSourceType
  source?: string
  topic: string
  query: string
  sortBy: 'signal' | 'latest'
  releaseStage?: 'all' | 'stable' | 'prerelease'
}
export interface NewsReaderState extends NewsFilters {
  view: NewsView
  archiveDate: string
}

/** Only known view/filter fields are retained; saved article data never enters URLs. */
export function parseNewsParams(params: URLSearchParams, archiveDates: string[], topicIds: string[]) {
  const notices: string[] = []
  const choice = <T extends string>(key: string, allowed: T[], fallback: T): T => {
    const raw = params.get(key)
    if (raw === null) return fallback
    if (allowed.includes(raw as T)) return raw as T
    notices.push(`${key} 筛选无效，已恢复默认值。`)
    return fallback
  }
  const text = (key: string, limit: number) => {
    const raw = params.get(key) ?? ''
    const safe = raw.replace(/\p{Cc}/gu, '').slice(0, limit)
    if (safe !== raw) notices.push(`${key} 筛选过长或含控制字符，已截断。`)
    return safe
  }
  const view = choice<NewsView>('view', ['daily', 'library', 'releases', 'archive', 'saved'], 'daily')
  const state: NewsReaderState = {
    view,
    category: choice('category', ['all', 'ai', 'technology', 'finance', 'world'], view === 'daily' ? 'ai' : 'all'),
    sourceType: choice('type', ['all', 'research', 'engineering', 'release', 'institution', 'analysis', 'news'], 'all'),
    // Keep absent sources as an explicit empty result, rather than silently broadening a shared search.
    source: text('source', 120), topic: choice('topic', ['all', ...topicIds], 'all'), query: text('q', 200),
    sortBy: choice('sort', ['signal', 'latest'], view === 'daily' ? 'signal' : 'latest'),
    archiveDate: choice('date', archiveDates, archiveDates[0] ?? ''),
    ...(view === 'releases' ? { releaseStage: choice('stage', ['all', 'stable', 'prerelease'], 'all') } : {}),
  }
  return { state, notices }
}

export function newsParams(state: NewsReaderState) {
  const params = new URLSearchParams({ view: state.view, category: state.category, sort: state.sortBy })
  if (state.sourceType !== 'all') params.set('type', state.sourceType)
  if (state.source) params.set('source', state.source)
  if (state.topic !== 'all') params.set('topic', state.topic)
  if (state.query) params.set('q', state.query)
  if (state.view === 'archive' && state.archiveDate) params.set('date', state.archiveDate)
  if (state.view === 'releases' && state.releaseStage && state.releaseStage !== 'all') params.set('stage', state.releaseStage)
  return params
}

export function inferSourceType(item: NewsItem): NewsSourceType {
  if (item.sourceType && types.has(item.sourceType)) return item.sourceType
  if (/DeepMind|NASA|arXiv|Google Research/i.test(item.source)) return 'research'
  if (/Technical Blog|Engineering|Hugging Face|vLLM Blog|ROCm|PyTorch Blog/i.test(item.source)) return 'engineering'
  if (/Releases|Apple/i.test(item.source)) return 'release'
  if (/Bank|Reserve|Federal|UN News/i.test(item.source)) return 'institution'
  return 'news'
}

export function validNewsItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== 'object') return false
  const item = value as NewsItem
  try {
    const url = new URL(item.url)
    return url.protocol === 'https:' && !url.username && !url.password && categories.has(item.category)
      && ['id', 'title', 'summary', 'source', 'sourceCountry'].every((key) => typeof item[key] === 'string')
      && !!item.id && !!item.title && Number.isFinite(item.score)
      && Number.isFinite(Date.parse(item.publishedAt)) && Number.isFinite(Date.parse(item.fetchedAt))
  } catch { return false }
}

export function readSavedItems(raw: string | null): NewsItem[] {
  if (!raw) return []
  const payload = JSON.parse(raw)
  if (payload?.version !== 2 || !Array.isArray(payload.items) || !payload.items.every(validNewsItem)) throw new Error('INVALID_READING_LIST')
  return [...new Map<string, NewsItem>(payload.items.map((item: NewsItem) => [item.id, item])).values()]
}

export function mergeSavedItems(saved: NewsItem[], recovered: NewsItem[]) {
  return [...new Map([...recovered, ...saved].map((item) => [item.id, item])).values()]
}

export function filterNews(items: NewsItem[], filters: NewsFilters, classifyTopics: (item: NewsItem) => string[]) {
  const words = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => filters.category === 'all' || item.category === filters.category)
    .filter((item) => filters.sourceType === 'all' || inferSourceType(item) === filters.sourceType)
    .filter((item) => !filters.source || item.source === filters.source)
    .filter((item) => !filters.releaseStage || filters.releaseStage === 'all' || item.releaseStage === filters.releaseStage)
    .filter((item) => filters.topic === 'all' || classifyTopics(item).includes(filters.topic))
    .filter((item) => words.every((word) => `${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(word)))
    .sort((a, b) => filters.sortBy === 'latest' ? Date.parse(b.publishedAt) - Date.parse(a.publishedAt) : b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}
