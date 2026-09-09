import { newsLearningConcepts } from '../data/news-learning.ts'
import type { NewsItem } from '../types/news.ts'

function normalize(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[\p{Dash_Punctuation}_]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Match fixed editorial terms literally; article text is never a pattern or a URL. */
function hasTerm(text: string, rawTerm: string) {
  const term = normalize(rawTerm)
  let at = text.indexOf(term)
  while (at !== -1) {
    const before = text[at - 1] ?? ''
    const after = text[at + term.length] ?? ''
    if ((!/^[a-z0-9]/.test(term) || !/[a-z0-9]/.test(before))
      && (!/[a-z0-9]$/.test(term) || !/[a-z0-9]/.test(after))) return true
    at = text.indexOf(term, at + 1)
  }
  return false
}

const technicalContext = ['model', 'models', 'attention', 'inference', 'serving', 'kernel', 'kernels', 'gpu', 'transformer', 'deepseek', 'qwen', 'llama', 'vllm', 'sglang', '模型', '注意力', '推理', '算子', '专家', '缓存']

export function learningForNews(item: Pick<NewsItem, 'title' | 'summary'>) {
  const fields = [{ field: 'title' as const, text: normalize(item.title) }, { field: 'summary' as const, text: normalize(item.summary) }]
  const context = technicalContext.some((term) => fields.some(({ text }) => hasTerm(text, term)))
  return newsLearningConcepts.flatMap((concept) => {
    const terms = [...concept.terms, ...(context ? concept.contextualTerms ?? [] : [])]
    for (const { field, text } of fields) {
      const term = terms.find((term) => hasTerm(text, term))
      if (term) return [{ concept, term, field }]
    }
    return []
  }).sort((a, b) => Number(a.field === 'summary') - Number(b.field === 'summary'))
}
