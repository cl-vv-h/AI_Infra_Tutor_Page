import type { ArticleMetadata } from '@/types'
import { curriculumArticles } from './curriculum'

export const articles: ArticleMetadata[] = curriculumArticles

export function getArticleBySlug(slug: string): ArticleMetadata | undefined {
  return articles.find((a) => a.slug === slug)
}

export function getArticlesByCategory(categoryId: string): ArticleMetadata[] {
  return articles.filter((a) => a.categoryId === categoryId)
}

export function getArticlesBySubCategory(subCategoryId: string): ArticleMetadata[] {
  return articles.filter((a) => a.subCategoryId === subCategoryId)
}
