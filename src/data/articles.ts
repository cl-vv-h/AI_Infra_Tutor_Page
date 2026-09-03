import type { Article } from '@/types'
import { curriculumArticles } from './curriculum'

export const articles: Article[] = curriculumArticles

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug)
}

export function getArticlesByCategory(categoryId: string): Article[] {
  return articles.filter((a) => a.categoryId === categoryId)
}

export function getArticlesBySubCategory(subCategoryId: string): Article[] {
  return articles.filter((a) => a.subCategoryId === subCategoryId)
}
