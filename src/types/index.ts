export interface Category {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  subcategories: SubCategory[]
}

export interface SubCategory {
  id: string
  categoryId: string
  name: string
  slug: string
  description: string
}

export interface Article {
  id: string
  categoryId: string
  subCategoryId: string
  title: string
  slug: string
  summary: string
  content: string
  tags: string[]
  readTime: string
  date: string
  prevArticleId: string | null
  nextArticleId: string | null
}

export interface LearningPath {
  id: string
  title: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  color: string
  topics: string[]
}
