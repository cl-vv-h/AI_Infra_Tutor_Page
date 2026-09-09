import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { newsSources } from './news-sources.mjs'
import { deduplicateItems, parseFeed, prepareItems, requireUsableFeeds, selectDiverse, selectLibrary } from './news-core.mjs'

const outputRoot = new URL('../src/data/news/', import.meta.url)
const archiveRoot = new URL('archive/', outputRoot)
const now = new Date()
const today = now.toISOString().slice(0, 10)
const lookbackHours = Number(process.env.NEWS_LOOKBACK_HOURS ?? 48)
const maxPerCategory = Number(process.env.NEWS_MAX_PER_CATEGORY ?? 16)
if (!Number.isFinite(lookbackHours) || lookbackHours <= 0 || !Number.isInteger(maxPerCategory) || maxPerCategory < 1) throw new Error('Invalid news collection limits')

async function readSnapshot(url) {
  try { return JSON.parse(await readFile(url, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return { items: [] }
    throw error
  }
}

async function fetchSource(source) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'AI-Infra-Space-News-Radar/1.0 (+https://github.com/cl-vv-h/AI_Infra_Tutor_Page)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        if (attempt === 0 && response.status >= 500) continue
        return { source, state: 'unavailable', entries: [], httpStatus: response.status }
      }
      try { return { source, state: 'ok', entries: parseFeed(await response.text()) } } catch (error) {
        if (error.message === 'INVALID_FEED') return { source, state: 'invalid', entries: [] }
        throw error
      }
    } catch {
      if (attempt === 1) return { source, state: 'unavailable', entries: [] }
    }
  }
}

// Limit concurrent requests; a single transient connection reset gets one retry.
const results = []
for (let i = 0; i < newsSources.length; i += 6) results.push(...await Promise.all(newsSources.slice(i, i + 6).map(fetchSource)))
requireUsableFeeds(results)

const candidates = results.flatMap(({ source, entries }) => entries.map((entry) => ({ ...entry, source })))
const dailyItems = selectDiverse(prepareItems(candidates, now, lookbackHours), maxPerCategory, 3)
const oldLibrary = await readSnapshot(new URL('library.json', outputRoot))
const oldArchive = await readSnapshot(new URL(`${today}.json`, archiveRoot))
const libraryItems = selectLibrary([...prepareItems(candidates, now, 90 * 24), ...oldLibrary.items], now)
const sourceStates = results.map(({ source, state, entries, httpStatus }) => ({
  name: source.name, url: source.url, country: source.country, category: source.category, type: source.type, state,
  ...(httpStatus ? { httpStatus } : {}), entryCount: entries.length,
  latestPublishedAt: entries.map((item) => Date.parse(item.publishedAt)).filter((date) => Number.isFinite(date) && date <= now.getTime() + 3600000).sort((a, b) => b - a).map((date) => new Date(date).toISOString())[0] ?? null,
  selectedCount: dailyItems.filter((item) => item.source === source.name).length,
  libraryCount: libraryItems.filter((item) => item.source === source.name).length,
}))
const output = { generatedAt: now.toISOString(), status: dailyItems.length ? 'ready' : 'empty', lookbackHours,
  sourceCount: results.filter((result) => result.state === 'ok').length,
  failedSourceCount: results.filter((result) => result.state !== 'ok').length,
  sourceStates, items: dailyItems }
const library = { generatedAt: now.toISOString(), lookbackDays: 90, items: libraryItems }
// Preserve already collected same-day stories even if a later feed response is shorter.
const archive = { ...output, items: deduplicateItems([...dailyItems, ...oldArchive.items]) }

async function writeSnapshot(url, data) {
  const temp = new URL(`${url.href}.tmp`)
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(temp, url)
}
await mkdir(archiveRoot, { recursive: true })
await writeSnapshot(new URL(`${today}.json`, archiveRoot), archive)
await writeSnapshot(new URL('library.json', outputRoot), library)
await writeSnapshot(new URL('daily.json', outputRoot), output)
console.log(`Collected ${dailyItems.length} daily signals, ${libraryItems.length} technical reads from ${output.sourceCount}/${newsSources.length} feeds.`)
for (const source of sourceStates.filter((item) => item.state !== 'ok')) console.warn(`${source.name}: ${source.state}${source.httpStatus ? ` (HTTP ${source.httpStatus})` : ''}`)
