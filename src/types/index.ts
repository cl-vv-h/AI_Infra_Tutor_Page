export type Language = 'zh' | 'en'

export interface Category {
  id: string
  name: string
  nameEn: string
  slug: string
  description: string
  descriptionEn: string
  icon: string
  color: string
  subcategories: SubCategory[]
}

export interface SubCategory {
  id: string
  categoryId: string
  name: string
  nameEn: string
  slug: string
  description: string
  descriptionEn: string
}

export interface Article {
  id: string
  categoryId: string
  subCategoryId: string
  title: string
  titleEn: string
  slug: string
  summary: string
  summaryEn: string
  content: string
  contentEn: string
  tags: string[]
  readTime: string
  date: string
  prevArticleId: string | null
  nextArticleId: string | null
  sourcePath?: string
}

export interface LearningPath {
  id: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  level: 'beginner' | 'intermediate' | 'advanced'
  color: string
  topics: string[]
  topicsEn: string[]
}
