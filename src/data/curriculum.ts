import type { ArticleMetadata } from '@/types'
import index from './curriculum-index.json'

export const curriculumArticles = index as ArticleMetadata[]

const articleSlugBySourcePath = new Map(
  curriculumArticles.map((article) => [article.sourcePath, article.slug]),
)

function resolveRelativePath(sourcePath: string, linkedPath: string): string {
  const segments = sourcePath.split('/').slice(0, -1)
  let decoded = linkedPath
  try { decoded = decodeURIComponent(linkedPath) } catch { /* Preserve malformed source links. */ }
  for (const segment of decoded.split('/')) {
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
