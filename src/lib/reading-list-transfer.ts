import type { NewsItem, NewsSourceType } from '../types/news.ts'
import { readingListKey, readSavedItems, validNewsItem } from './news-reader.ts'

export const maxImportBytes = 2 * 1024 * 1024
export const maxImportItems = 500
const sourceTypes = new Set(['research', 'engineering', 'release', 'institution', 'analysis', 'news'])
const limits = { id: 200, title: 1000, summary: 20000, source: 200, sourceCountry: 120 } as const

export class ReadingImportError extends Error {}
const fail = (message: string): never => { throw new ReadingImportError(message) }
function hasUnsafeControls(text: string) {
  for (const char of text) {
    const code = char.charCodeAt(0)
    if ((code < 32 && ![9, 10, 13].includes(code)) || code === 127 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return true
  }
  return false
}

function cleanImportedItem(value: unknown, index: number): NewsItem {
  const error = `第 ${index + 1} 条记录不完整、超长或包含不安全链接；整批未导入。`
  if (!validNewsItem(value)) return fail(error)
  const item = value as NewsItem
  for (const [key, limit] of Object.entries(limits)) {
    const text = item[key as keyof typeof limits]
    if (text.length > limit || (key !== 'summary' && !text.trim()) || hasUnsafeControls(text)) return fail(error)
  }
  if (typeof item.url !== 'string' || item.url.length > 4096 || !/^https:\/\//i.test(item.url) || /[\s\\]/.test(item.url)) return fail(error)
  const url = new URL(item.url)
  if (url.port || !url.hostname.includes('.') || /^(?:\d+\.){3}\d+$/.test(url.hostname) || url.hostname.startsWith('[') || /(?:^|\.)(?:localhost|local|internal)\.?$/.test(url.hostname)) return fail(error)
  if (typeof item.publishedAt !== 'string' || typeof item.fetchedAt !== 'string' || item.publishedAt.length > 40 || item.fetchedAt.length > 40) return fail(error)
  if (item.sourceType !== undefined && !sourceTypes.has(item.sourceType)) return fail(error)
  if (item.releaseStage !== undefined && !['stable', 'prerelease'].includes(item.releaseStage)) return fail(error)
  if (item.publishedAtKind !== undefined && item.publishedAtKind !== 'github-release') return fail(error)
  // Construct a fresh allowlisted object. Unknown nested fields and prototype keys never persist.
  return { id: item.id, title: item.title, summary: item.summary, source: item.source, sourceCountry: item.sourceCountry,
    category: item.category, url: url.href, publishedAt: new Date(item.publishedAt).toISOString(), fetchedAt: new Date(item.fetchedAt).toISOString(), score: item.score,
    origin: 'imported', ...(item.sourceType ? { sourceType: item.sourceType as NewsSourceType } : {}),
    ...(item.releaseStage ? { releaseStage: item.releaseStage } : {}), ...(item.publishedAtKind ? { publishedAtKind: item.publishedAtKind } : {}) }
}

export function previewReadingImport(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > maxImportBytes) return fail('文件超过 2 MiB；请分批导入。')
  let value: unknown
  try { value = JSON.parse(raw.replace(/^\uFEFF/, '')) } catch { return fail('无法解析 JSON；请选择本站导出的阅读清单。') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('文件不是本站的 v2 阅读清单。')
  const payload = value as { version?: unknown; items?: unknown }
  if (payload.version !== 2 || !Array.isArray(payload.items)) return fail('文件不是本站的 v2 阅读清单；旧版仅含 ID 的文件不能恢复文章。')
  if (!payload.items.length) return fail('这份阅读清单没有文章。')
  if (payload.items.length > maxImportItems) return fail('单个文件最多 500 条记录；请分批导入。')
  const entries = payload.items.map(cleanImportedItem)
  const plan = mergeReadingImport([], entries)
  return { items: plan.additions, inputCount: entries.length, duplicates: plan.duplicates }
}

/** Keep existing snapshots; either the same id or canonical URL is a duplicate. */
export function mergeReadingImport(current: NewsItem[], incoming: NewsItem[]) {
  const ids = new Set(current.map((item) => item.id))
  const urls = new Set(current.map((item) => new URL(item.url).href))
  const additions: NewsItem[] = []
  for (const item of incoming) {
    const url = new URL(item.url).href
    const duplicate = ids.has(item.id) || urls.has(url)
    // Reserve both identities even on a collision, avoiding transitive duplicates.
    ids.add(item.id); urls.add(url)
    if (!duplicate) additions.push(item)
  }
  return { additions, items: [...additions, ...current], duplicates: incoming.length - additions.length }
}

/** Synchronous read/check/write. No UI state changes unless the storage write succeeds. */
export function commitReadingImport(current: NewsItem[], incoming: NewsItem[], pendingLegacyIds: string[], storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const approved = previewReadingImport(JSON.stringify({ version: 2, items: incoming })).items
  let stored: string | null
  try { stored = storage.getItem(readingListKey) } catch { return fail('无法读取本机存储；未导入，请检查浏览器存储权限。') }
  let actual: NewsItem[], pending: unknown
  try { actual = readSavedItems(stored); pending = stored ? JSON.parse(stored).pendingLegacyIds ?? [] : [] } catch { return fail('本机原收藏无法解析；为保护原数据，本次未导入。') }
  if (JSON.stringify(actual) !== JSON.stringify(current) || JSON.stringify(pending) !== JSON.stringify(pendingLegacyIds)) return fail('本机存储与当前清单不一致，可能由其他标签页修改或上次保存失败。请先导出当前清单，再刷新重试。')
  const plan = mergeReadingImport(current, approved)
  if (!plan.additions.length) return plan
  try { storage.setItem(readingListKey, JSON.stringify({ version: 2, items: plan.items, pendingLegacyIds })) }
  catch { return fail('保存失败，可能是存储空间不足或权限受限；未导入，原收藏未改动。') }
  return plan
}
