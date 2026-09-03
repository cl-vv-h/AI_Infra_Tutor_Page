import type { Article } from '@/types'

const contentModules = import.meta.glob('./content/**/*.{md,py}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

interface ContentRoute {
  categoryId: string
  subCategoryId: string
  tags: string[]
}

type CurriculumArticle = Article & { sourcePath: string }

const aiInfraRoutes: Record<string, ContentRoute> = {
  Attention_Kernel: { categoryId: 'cat-4', subCategoryId: 'sub-4-6', tags: ['Attention', 'Kernel'] },
  Benchmark_Profiling: { categoryId: 'cat-14', subCategoryId: 'sub-14-1', tags: ['Benchmark', 'Profiling'] },
  Execution_Graph: { categoryId: 'cat-9', subCategoryId: 'sub-9-1', tags: ['Graph', 'Runtime'] },
  Gated_Delta_Network: { categoryId: 'cat-15', subCategoryId: 'sub-15-1', tags: ['GDN', 'Linear Attention'] },
  Inference_Basics: { categoryId: 'cat-10', subCategoryId: 'sub-10-1', tags: ['Inference', 'Basics'] },
  KV_Cache_Memory: { categoryId: 'cat-11', subCategoryId: 'sub-11-1', tags: ['KV Cache', 'Memory'] },
  KV_Transfer: { categoryId: 'cat-12', subCategoryId: 'sub-12-1', tags: ['KV Transfer', 'Disaggregation'] },
  LoRA: { categoryId: 'cat-2', subCategoryId: 'sub-2-7', tags: ['LoRA', 'PEFT'] },
  Mamba_State_Space: { categoryId: 'cat-7', subCategoryId: 'sub-7-1', tags: ['Mamba', 'SSM'] },
  Model_Architecture: { categoryId: 'cat-5', subCategoryId: 'sub-5-1', tags: ['Architecture', 'LLM'] },
  Parallel_Strategy: { categoryId: 'cat-1', subCategoryId: 'sub-1-7', tags: ['Parallelism', 'Distributed'] },
  Quantization: { categoryId: 'cat-13', subCategoryId: 'sub-13-1', tags: ['Quantization', 'Kernel'] },
  Schedule_Optimization: { categoryId: 'cat-3', subCategoryId: 'sub-3-6', tags: ['Scheduling', 'Prefill'] },
  Speculative_Decoding: { categoryId: 'cat-6', subCategoryId: 'sub-6-1', tags: ['Speculative Decoding', 'Serving'] },
}

function routeFor(relativePath: string): ContentRoute | null {
  if (relativePath.startsWith('ai-infra-basic/')) {
    const topic = relativePath.split('/')[1]
    return aiInfraRoutes[topic] ?? null
  }

  if (relativePath.startsWith('sglang-source-reading/')) {
    return { categoryId: 'cat-8', subCategoryId: 'sub-8-1', tags: ['SGLang', 'Source Reading'] }
  }
  if (relativePath.startsWith('scheduler-architecture/')) {
    return { categoryId: 'cat-8', subCategoryId: 'sub-8-2', tags: ['SGLang', 'Scheduler'] }
  }
  if (relativePath.startsWith('tp-worker-model-runner/')) {
    return { categoryId: 'cat-8', subCategoryId: 'sub-8-3', tags: ['SGLang', 'ModelRunner'] }
  }
  if (relativePath.startsWith('sglang-ascend-npu/')) {
    return { categoryId: 'cat-8', subCategoryId: 'sub-8-4', tags: ['SGLang', 'Ascend NPU'] }
  }
  if (relativePath.startsWith('ascend-kernel-infra/')) {
    return { categoryId: 'cat-8', subCategoryId: 'sub-8-5', tags: ['Ascend NPU', 'Kernel'] }
  }
  return null
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function humanizeFilename(relativePath: string): string {
  const filename = relativePath.split('/').pop()!.replace(/\.(md|py)$/i, '')
  if (filename.toLowerCase() === 'readme') {
    const parent = relativePath.split('/').slice(-2, -1)[0]
    return `${parent.replace(/[-_]/g, ' ')} Overview`
  }
  return filename
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function extractTitle(content: string, relativePath: string): string {
  if (relativePath.endsWith('.md')) {
    const heading = content.match(/^#\s+(.+)$/m)?.[1]
    if (heading) return cleanInlineMarkdown(heading)
  }

  const docstringTitle = content.match(/^[\s#]*(?:"""|''')?\s*([^\n]{8,100})/m)?.[1]
  return cleanInlineMarkdown(docstringTitle ?? humanizeFilename(relativePath))
}

function extractSummary(content: string, fallbackTitle: string): string {
  const withoutCode = content.replace(/```[\s\S]*?```/g, ' ')
  const candidates = withoutCode
    .split(/\n\s*\n/)
    .map(cleanInlineMarkdown)
    .filter((value) => value.length >= 34)
    .filter((value) => !value.startsWith('简体中文') && !value.startsWith('English'))
    .filter((value) => !/^[-: ]+$/.test(value))

  const summary = candidates[0] ?? `围绕 ${fallbackTitle} 的结构化教程与源码导读。`
  return summary.length > 150 ? `${summary.slice(0, 147)}…` : summary
}

function slugifyPath(relativePath: string): string {
  return relativePath
    .replace(/\.(md|py)$/i, '')
    .split('/')
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('--')
}

function readTime(content: string): string {
  const codeChars = (content.match(/```[\s\S]*?```/g) ?? []).join('').length
  const proseChars = Math.max(0, content.length - codeChars)
  const minutes = Math.max(4, Math.ceil(proseChars / 520 + codeChars / 900))
  return `${minutes} min`
}

function wrapPython(content: string, title: string): string {
  return `# ${title}\n\n\`\`\`python\n${content}\n\`\`\``
}

const localizedContent = new Map<string, Partial<Record<'zh' | 'en', string>>>()

for (const [modulePath, content] of Object.entries(contentModules)) {
  const match = modulePath.match(/^\.\/content\/(zh|en)\/(.+)$/)
  if (!match) continue
  const [, language, relativePath] = match
  const entry = localizedContent.get(relativePath) ?? {}
  entry[language as 'zh' | 'en'] = content
  localizedContent.set(relativePath, entry)
}

const draftArticles = [...localizedContent.entries()]
  .map(([relativePath, content]) => {
    const route = routeFor(relativePath)
    if (!route) return null

    const zhRaw = content.zh ?? content.en ?? ''
    const enRaw = content.en ?? content.zh ?? ''
    const title = extractTitle(zhRaw, relativePath)
    const titleEn = extractTitle(enRaw, relativePath)
    const isPython = relativePath.endsWith('.py')
    const slug = slugifyPath(relativePath)

    return {
      id: `curriculum-${slug}`,
      ...route,
      title,
      titleEn,
      slug,
      summary: extractSummary(zhRaw, title),
      summaryEn: extractSummary(enRaw, titleEn),
      content: isPython ? wrapPython(zhRaw, title) : zhRaw,
      contentEn: isPython ? wrapPython(enRaw, titleEn) : enRaw,
      tags: route.tags,
      readTime: readTime(zhRaw),
      date: '持续更新',
      prevArticleId: null,
      nextArticleId: null,
      sourcePath: relativePath,
    } satisfies CurriculumArticle
  })
  .filter((article): article is CurriculumArticle => Boolean(article))
  .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'en', { numeric: true }))

const bySubcategory = new Map<string, Article[]>()
for (const article of draftArticles) {
  const group = bySubcategory.get(article.subCategoryId) ?? []
  group.push(article)
  bySubcategory.set(article.subCategoryId, group)
}

for (const group of bySubcategory.values()) {
  group.forEach((article, index) => {
    article.prevArticleId = group[index - 1]?.id ?? null
    article.nextArticleId = group[index + 1]?.id ?? null
  })
}

export const curriculumArticles = draftArticles

const articleSlugBySourcePath = new Map(
  curriculumArticles.map((article) => [article.sourcePath, article.slug]),
)

function resolveRelativePath(sourcePath: string, linkedPath: string): string {
  const segments = sourcePath.split('/').slice(0, -1)
  for (const segment of decodeURIComponent(linkedPath).split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return segments.join('/')
}

export function rewriteCurriculumLinks(markdown: string, sourcePath?: string): string {
  if (!sourcePath) return markdown

  const resolveHref = (href: string) => {
    const trimmed = href.trim()
    if (/^(?:https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed
    const [linkedPath, anchor] = trimmed.split('#', 2)
    const candidates = /\.(?:md|py)$/i.test(linkedPath)
      ? [linkedPath]
      : [`${linkedPath.replace(/\/$/, '')}/README.md`]
    const slug = candidates
      .map((candidate) => articleSlugBySourcePath.get(resolveRelativePath(sourcePath, candidate)))
      .find(Boolean)
    return slug ? `#/article/${slug}${anchor ? `#${anchor}` : ''}` : trimmed
  }

  return markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => `[${label}](${resolveHref(href)})`)
    .replace(/<a([^>]+)href="([^"]+)"/g, (_match, prefix, href) => `<a${prefix}href="${resolveHref(href)}"`)
}
