import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { newsSources } from './news-sources.mjs'

const outputPath = new URL('../src/data/news/daily.json', import.meta.url)
const archiveRoot = new URL('../src/data/news/archive/', import.meta.url)
const now = new Date()
const today = now.toISOString().slice(0, 10)
const lookbackHours = Number(process.env.NEWS_LOOKBACK_HOURS ?? 48)
const maxPerCategory = Number(process.env.NEWS_MAX_PER_CATEGORY ?? 16)

function decodeEntities(value = '') {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  }
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, key) => named[key] ?? match)
}

function cleanText(value = '') {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readTag(block, names) {
  for (const name of names) {
    const escaped = name.replace(':', '\\:')
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
    if (match?.[1]) return cleanText(match[1])
  }
  return ''
}

function readLink(block) {
  const rssLink = readTag(block, ['link'])
  if (/^https?:\/\//i.test(rssLink)) return rssLink
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
  return decodeEntities(atomLink ?? '').trim()
}

function parseFeed(xml) {
  const blocks = [
    ...(xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? []),
  ]

  return blocks.map((block) => ({
    title: readTag(block, ['title']),
    summary: readTag(block, ['description', 'summary', 'content', 'content:encoded']),
    url: readLink(block),
    publishedAt: readTag(block, ['pubDate', 'published', 'updated', 'dc:date']),
  }))
}

function normalizedUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || ['cmpid', 'ocid', 'at_campaign', 'at_medium'].includes(key)) {
        url.searchParams.delete(key)
      }
    }
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function importanceScore(item, source) {
  const published = Date.parse(item.publishedAt)
  const ageHours = Number.isFinite(published) ? Math.max(0, (now.getTime() - published) / 3_600_000) : lookbackHours
  const recency = Math.max(0, 12 - ageHours / 4)
  const signalWords = /breakthrough|launch|release|regulation|policy|rate|inflation|election|agreement|conflict|security|research|model|chip|semiconductor|market|economy/i
  const signal = signalWords.test(`${item.title} ${item.summary}`) ? 4 : 0
  return Math.round((source.weight + recency + signal) * 10) / 10
}

async function fetchSource(source) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'AI-Infra-Space-News-Radar/1.0 (+https://github.com/cl-vv-h/AI_Infra_Tutor_Page)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const xml = await response.text()
    return parseFeed(xml).map((entry) => ({ ...entry, source }))
  } finally {
    clearTimeout(timeout)
  }
}

const settled = await Promise.allSettled(newsSources.map(fetchSource))
const failures = []
const candidates = []

settled.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    candidates.push(...result.value)
  } else {
    failures.push({ source: newsSources[index].name, error: String(result.reason?.message ?? result.reason) })
  }
})

const cutoff = now.getTime() - lookbackHours * 3_600_000
const seen = new Set()
const items = candidates
  .map((entry) => {
    const url = normalizedUrl(entry.url)
    const publishedTime = Date.parse(entry.publishedAt)
    if (!url || !entry.title || !Number.isFinite(publishedTime) || publishedTime < cutoff || publishedTime > now.getTime() + 3_600_000) {
      return null
    }
    const fingerprint = cleanText(entry.title).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').slice(0, 120)
    if (!fingerprint || seen.has(fingerprint)) return null
    seen.add(fingerprint)

    return {
      id: createHash('sha256').update(`${entry.source.category}:${url}`).digest('hex').slice(0, 16),
      category: entry.source.category,
      title: cleanText(entry.title).slice(0, 240),
      summary: cleanText(entry.summary).slice(0, 520),
      url,
      source: entry.source.name,
      sourceCountry: entry.source.country,
      publishedAt: new Date(publishedTime).toISOString(),
      fetchedAt: now.toISOString(),
      score: importanceScore(entry, entry.source),
    }
  })
  .filter(Boolean)
  .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

const categoryCounts = new Map()
const selectedItems = items.filter((item) => {
  const count = categoryCounts.get(item.category) ?? 0
  if (count >= maxPerCategory) return false
  categoryCounts.set(item.category, count + 1)
  return true
})

const output = {
  generatedAt: now.toISOString(),
  status: selectedItems.length > 0 ? 'ready' : 'empty',
  sourceCount: newsSources.length - failures.length,
  failedSourceCount: failures.length,
  items: selectedItems,
}

await mkdir(archiveRoot, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
await writeFile(new URL(`${today}.json`, archiveRoot), `${JSON.stringify(output, null, 2)}\n`, 'utf8')

console.log(`Collected ${selectedItems.length} items from ${output.sourceCount}/${newsSources.length} sources.`)
if (failures.length) console.warn('Unavailable feeds:', failures.map((failure) => failure.source).join(', '))
