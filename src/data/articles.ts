import type { Article } from '@/types'
import { sglangArticles } from './sglang-articles'
import { aiInfraBasicArticles } from './ai-infra-basic-articles'

export const articles: Article[] = [
  ...sglangArticles,
  ...aiInfraBasicArticles,
]

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug)
}

export function getArticlesByCategory(categoryId: string): Article[] {
  return articles.filter((a) => a.categoryId === categoryId)
}

export function getArticlesBySubCategory(subCategoryId: string): Article[] {
  return articles.filter((a) => a.subCategoryId === subCategoryId)
}
