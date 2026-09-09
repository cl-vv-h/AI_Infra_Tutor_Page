import type { ArticleMetadata } from '../types/index.ts'

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[_/—–-]+/g, ' ')

/** Metadata-only, all-token search. Titles rank ahead of summaries and paths. */
export function searchCurriculum(articles: ArticleMetadata[], query: string): ArticleMetadata[] {
  const tokens = [...new Set(normalize(query.trim()).split(/\s+/).filter(Boolean))]
  if (!tokens.length) return []
  return articles.map((article, index) => {
    const titles = normalize(`${article.title} ${article.titleEn}`)
    const tags = normalize(article.tags.join(' '))
    const text = normalize(`${titles} ${tags} ${article.summary} ${article.summaryEn} ${article.sourcePath}`)
    const score = tokens.every((token) => text.includes(token))
      ? tokens.reduce((total, token) => total + (titles.includes(token) ? 10 : tags.includes(token) ? 4 : 1), 0)
      : 0
    return { article, index, score }
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ article }) => article)
}
