import type { ArticleMetadata, Language } from '../types/index.ts'

export interface LoadedArticle {
  content: string
  language: Language
}

/** Injected import map keeps body loading testable without fetching other courses. */
export function createArticleLoader(modules: Record<string, () => Promise<string>>) {
  return async (article: ArticleMetadata, requested: Language): Promise<LoadedArticle> => {
    const language = article.availableLanguages.includes(requested)
      ? requested
      : article.availableLanguages[0]
    const load = modules[`./content/${language}/${article.sourcePath}`]
    if (!load) throw new Error('Article source is unavailable')
    const raw = await load()
    const title = language === 'zh' ? article.title : article.titleEn
    // No failure cache: a failed request can be retried. Successful imports are
    // cached by the module runtime, including revisits and language switches.
    return {
      language,
      content: article.sourcePath.endsWith('.py')
        ? `# ${title}\n\n\`\`\`python\n${raw}\n\`\`\``
        : raw,
    }
  }
}
