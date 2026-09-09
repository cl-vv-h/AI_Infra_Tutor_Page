import type { NewsCategory, NewsItem, NewsSourceType } from '../types/news'

const categories = new Set(['ai', 'technology', 'finance', 'world'])
const types = new Set(['research', 'engineering', 'release', 'institution', 'analysis', 'news'])
export const readingListKey = 'ai-infra-news-reading-list-v2'
export const legacyReadingListKey = 'ai-infra-news-reading-list'

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

export function filterNews(items: NewsItem[], filters: {
  category: 'all' | NewsCategory
  sourceType: 'all' | NewsSourceType
  topic: string
  query: string
  sortBy: 'signal' | 'latest'
}, classifyTopics: (item: NewsItem) => string[]) {
  const words = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter((item) => filters.category === 'all' || item.category === filters.category)
    .filter((item) => filters.sourceType === 'all' || inferSourceType(item) === filters.sourceType)
    .filter((item) => filters.topic === 'all' || classifyTopics(item).includes(filters.topic))
    .filter((item) => words.every((word) => `${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(word)))
    .sort((a, b) => filters.sortBy === 'latest' ? Date.parse(b.publishedAt) - Date.parse(a.publishedAt) : b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}
