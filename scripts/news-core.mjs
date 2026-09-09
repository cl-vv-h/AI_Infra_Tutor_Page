import { createHash } from 'node:crypto'
import { topicsForItem } from '../src/lib/news-topics.mjs'

export function decodeEntities(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  const codePoint = (value, radix) => {
    const n = Number.parseInt(value, radix)
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\uFFFD'
  }
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => codePoint(code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => codePoint(code, 16))
    .replace(/&([a-z]+);/gi, (match, key) => named[key] ?? match)
}

export function cleanText(value = '') {
  return decodeEntities(value).replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

function readTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
    if (match?.[1]) return cleanText(match[1])
  }
  return ''
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([, name, , value]) => [name.toLowerCase(), decodeEntities(value)]))
}

export function readLink(block) {
  const rss = readTag(block, ['link'])
  if (/^https?:\/\//i.test(rss)) return rss
  const links = (block.match(/<link\b[^>]*>/gi) ?? []).map(attributes)
  const alternate = links.find((a) => (!a.rel || a.rel === 'alternate') && (!a.type || /html/i.test(a.type)) && /^https?:\/\//i.test(a.href))
  if (alternate) return alternate.href
  const guid = readTag(block, ['guid', 'id'])
  return /^https?:\/\//i.test(guid) ? guid : ''
}

export function parseFeed(xml) {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('INVALID_FEED')
  const blocks = [...(xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? []), ...(xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [])]
  return blocks.map((block) => ({ title: readTag(block, ['title']), summary: readTag(block, ['description', 'summary', 'content', 'content:encoded']), url: readLink(block), publishedAt: readTag(block, ['pubDate', 'published', 'updated', 'dc:date']) }))
}

export function requireUsableFeeds(results) {
  if (!results.some((result) => result.state === 'ok' && result.entries.length)) throw new Error('No usable feeds; keeping all previously published news data')
}

export function normalizedUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    if (url.protocol === 'http:') url.protocol = 'https:'
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_') || ['cmpid', 'ocid', 'at_campaign', 'at_medium'].includes(key)) url.searchParams.delete(key)
    url.hash = ''
    return url.toString()
  } catch { return null }
}

export function importanceScore(item, source, now) {
  const ageHours = Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / 3_600_000)
  const recency = Math.max(0, 12 - ageHours / 4)
  const signal = /breakthrough|launch|release|regulation|policy|rate|inflation|election|agreement|conflict|security|research|model|chip|market|economy/i.test(`${item.title} ${item.summary}`) ? 4 : 0
  const systems = topicsForItem(item).length ? 5 : 0
  const boost = { research: 4, engineering: 4, release: 3, institution: 2, analysis: 1, news: 0 }[source.type] ?? 0
  const prerelease = item.prerelease === true || /(?:^|[.-])(?:rc|alpha|beta|dev|nightly)\d*\b|^trunk\//i.test(item.title) ? 4 : 0
  return Math.round((source.weight + recency + signal + systems + boost - prerelease) * 10) / 10
}

export function prepareItems(candidates, now, lookbackHours) {
  const cutoff = now.getTime() - lookbackHours * 3_600_000
  const items = candidates.flatMap((entry) => {
    const url = normalizedUrl(entry.url)
    const published = Date.parse(entry.publishedAt)
    if (!url || !entry.title || !Number.isFinite(published) || published < cutoff || published > now.getTime() + 3_600_000) return []
    if (entry.source.includeKeywords?.length) {
      const haystack = (entry.source.matchScope === 'title' ? entry.title : `${entry.title} ${entry.summary}`).toLowerCase()
      if (!entry.source.includeKeywords.some((word) => haystack.includes(word.toLowerCase()))) return []
    }
    return [{ id: createHash('sha256').update(`${entry.source.category}:${url}`).digest('hex').slice(0, 16), category: entry.source.category,
      title: cleanText(entry.title).slice(0, 240), summary: cleanText(entry.summary).slice(0, 520), url,
      source: entry.source.name, sourceCountry: entry.source.country, sourceType: entry.source.type,
      publishedAt: new Date(published).toISOString(), fetchedAt: now.toISOString(), score: importanceScore(entry, entry.source, now), topics: topicsForItem(entry) }]
  }).sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  return deduplicateItems(items)
}

export function deduplicateItems(items) {
  const urls = new Set()
  const titles = new Set()
  return items.filter((item) => {
    const url = normalizedUrl(item.url)?.replace(/\/$/, '')
    const title = `${item.source}:${cleanText(item.title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')}`
    if (!url || urls.has(url) || titles.has(title)) return false
    urls.add(url); titles.add(title)
    return true
  })
}

export function selectDiverse(items, maxPerCategory = 16, maxPerSource = 3) {
  const categories = new Map()
  const sources = new Map()
  return items.filter((item) => {
    const count = categories.get(item.category) ?? 0
    const sourceCount = sources.get(item.source) ?? 0
    if (count >= maxPerCategory || sourceCount >= maxPerSource) return false
    categories.set(item.category, count + 1); sources.set(item.source, sourceCount + 1)
    return true
  })
}

export function selectLibrary(items, now, lookbackDays = 90) {
  const candidates = items.filter((item) => ['engineering', 'research'].includes(item.sourceType)
    && ['ai', 'technology'].includes(item.category) && topicsForItem(item).length
    && !/\b(?:conference|joins? the|foundation members?|funding|raises? \$)\b/i.test(item.title)
    && Date.parse(item.publishedAt) >= now.getTime() - lookbackDays * 86400000
    && Date.parse(item.publishedAt) <= now.getTime() + 3600000)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  return selectDiverse(deduplicateItems(candidates), 48, 8)
}
