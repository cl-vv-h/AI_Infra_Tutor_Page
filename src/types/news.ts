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
  topics?: string[]
  releaseStage?: 'stable' | 'prerelease'
  publishedAtKind?: 'github-release'
}

export interface NewsReleaseData {
  generatedAt: string | null
  lookbackDays: number
  limitPerStage: number
  items: NewsItem[]
  sources: Array<{ name: string; repository: string; url: string; state: 'ok' | 'unavailable' | 'invalid'; httpStatus?: number; lastSuccessAt: string | null; count: number }>
}

export interface NewsSourceState {
  name: string
  url: string
  country: string
  category: NewsCategory
  type: NewsSourceType
  state: 'ok' | 'unavailable' | 'invalid'
  channel?: 'feed' | 'github-api'
  feedFailure?: { state: 'unavailable' | 'invalid'; httpStatus?: number }
  httpStatus?: number
  entryCount: number
  latestPublishedAt: string | null
  selectedCount: number
  libraryCount: number
}

export interface NewsLibraryData {
  generatedAt: string | null
  lookbackDays: number
  items: NewsItem[]
}

export interface DailyNewsData {
  generatedAt: string | null
  status: 'ready' | 'empty' | 'seed'
  sourceCount: number
  failedSourceCount: number
  lookbackHours?: number
  sourceStates?: NewsSourceState[]
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
