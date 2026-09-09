import { createArticleLoader } from '@/lib/article-loader'

// Imported only by the reader. Directory, search and model routes use metadata.
const contentModules = import.meta.glob<string>('./content/**/*.{md,py}', {
  query: '?raw',
  import: 'default',
})

export const loadArticleContent = createArticleLoader(contentModules)
