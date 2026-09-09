export type NewsCategory = 'ai' | 'technology' | 'finance' | 'world'
export type NewsSourceType = 'research' | 'engineering' | 'release' | 'institution' | 'analysis' | 'news'

export interface NewsItem {
  id: string
  category: NewsCategory
  title: string
  summary: string
  url: string
  source: string
  sourceCountry: string
  sourceType?: NewsSourceType
  publishedAt: string
  fetchedAt: string
  score: number
}

export interface DailyNewsData {
  generatedAt: string | null
  status: 'ready' | 'empty' | 'seed'
  sourceCount: number
  failedSourceCount: number
  items: NewsItem[]
}

export interface WeeklyReportData {
  generatedAt: string | null
  periodStart: string | null
  periodEnd: string | null
  model: string | null
  itemCount: number
  content: string
  sources: Array<{ title: string; url: string; source: string }>
}
