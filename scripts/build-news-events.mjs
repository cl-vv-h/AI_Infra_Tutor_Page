import * as fs from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVENT_VERSION, canonicalEventUrl, validTime, validDay, validateCatalog, validateSnapshot, matchEventRules } from '../src/lib/news-events.mjs'

const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const compare = (a, b) => a.localeCompare(b, 'en')
const time = value => new Date(value).toISOString()
const clean = (value, max) => typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u001f\u007f<>]/u.test(value)
const identity = report => JSON.stringify([report.title, report.publisher, report.publisherCountry, report.publishedAt])
function observation(item, generatedAt) {
  const url = canonicalEventUrl(item?.url)
  if (!url || !clean(item.title, 1000) || !clean(item.source, 120) || !clean(item.sourceCountry, 100) || !validTime(item.publishedAt) || !validTime(item.fetchedAt) || Date.parse(item.publishedAt) > Date.parse(item.fetchedAt) + 3600000 || Date.parse(item.fetchedAt) > Date.parse(generatedAt) + 3600000) return null
  return { url, title: item.title, publisher: item.source, publisherCountry: item.sourceCountry, publishedAt: time(item.publishedAt), firstCollectedAt: time(item.fetchedAt), lastCollectedAt: time(item.fetchedAt) }
}
export function buildEventSnapshot(catalog, datasets, previous = null) {
  validateCatalog(catalog)
  if (previous) validateSnapshot(previous)
  const observations = new Map(), byName = new Map(), archiveDates = []; let invalidItems = 0
  for (const { name, data } of datasets) {
    if (byName.has(name)) throw new Error('Duplicate news input')
    byName.set(name, data)
    if (!data || !validTime(data.generatedAt) || !Array.isArray(data.items) || data.items.length > 100000) throw new Error(`Invalid news input: ${name}`)
    if (name.startsWith('archive/')) {
      const day = name.slice(8, -5)
      if (!validDay(day)) throw new Error('Invalid archive filename')
      archiveDates.push(day)
    }
    for (const item of data.items) {
      const report = observation(item, data.generatedAt)
      if (!report) { invalidItems++; continue }
      const old = observations.get(report.url)
      if (!old) observations.set(report.url, report)
      else {
        const selected = report.lastCollectedAt > old.lastCollectedAt || (report.lastCollectedAt === old.lastCollectedAt && compare(identity(report), identity(old)) > 0) ? report : old
        observations.set(report.url, { ...selected, firstCollectedAt: [old.firstCollectedAt, report.firstCollectedAt].sort()[0], lastCollectedAt: [old.lastCollectedAt, report.lastCollectedAt].sort().at(-1) })
      }
    }
  }
  for (const name of ['daily.json', 'library.json', 'releases.json']) if (!byName.has(name)) throw new Error(`Missing news input: ${name}`)
  archiveDates.sort()
  const missingArchiveDates = []
  if (archiveDates.length) {
    const present = new Set(archiveDates), end = Date.parse(archiveDates.at(-1))
    if (end - Date.parse(archiveDates[0]) > 10000 * 86400000) throw new Error('Archive range too large')
    for (let at = Date.parse(archiveDates[0]); at <= end; at += 86400000) { const day = new Date(at).toISOString().slice(0, 10); if (!present.has(day)) missingArchiveDates.push(day) }
  }
  const daily = byName.get('daily.json'), releases = byName.get('releases.json')
  if (!Array.isArray(daily.sourceStates) || !Array.isArray(releases.sources)) throw new Error('Source health metadata is missing')
  const failedSources = [...new Set([...daily.sourceStates, ...releases.sources].filter(source => source.state !== 'ok').map(source => source.name))].sort(compare)
  const coverage = { dailyCollectedAt: time(daily.generatedAt), releasesCollectedAt: time(releases.generatedAt), libraryCollectedAt: time(byName.get('library.json').generatedAt), archiveDates, missingArchiveDates, failedSources, invalidItems }
  const tracks = catalog.tracks.map(track => {
    const oldReports = previous?.tracks.find(old => old.id === track.id)?.reports || []
    const oldMap = new Map(oldReports.map(report => [report.url, report])), all = new Map(oldMap)
    for (const [url, item] of observations) {
      const old = oldMap.get(url)
      // Older rolling windows cannot replace newer retained metadata.
      const useNew = !old || item.lastCollectedAt >= old.lastCollectedAt
      const selected = useNew ? item : old
      all.set(url, { ...selected, firstCollectedAt: old ? [old.firstCollectedAt, item.firstCollectedAt].sort()[0] : item.firstCollectedAt, lastCollectedAt: old ? [old.lastCollectedAt, item.lastCollectedAt].sort().at(-1) : item.lastCollectedAt, revisionCount: (old?.revisionCount || 0) + (old && useNew && identity(old) !== identity(item) ? 1 : 0) })
    }
    const reports = [...all.values()].flatMap(report => {
      const ruleIds = matchEventRules(track, report)
      return ruleIds.length ? [{ ...report, ruleIds, revisionCount: report.revisionCount || 0 }] : []
    }).sort((a, b) => compare(a.publishedAt, b.publishedAt) || compare(a.url, b.url))
    return { id: track.id, reports }
  })
  const body = { version: EVENT_VERSION, coverage, tracks }
  return validateSnapshot({ ...body, fingerprint: fingerprint({ catalog, ...body }) })
}

export async function generateNewsEvents({ root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), check = false, io = fs } = {}) {
  const dir = join(root, 'src/data/news'), output = join(dir, 'events.json')
  const read = async path => {
    const raw = await io.readFile(path, 'utf8')
    if (Buffer.byteLength(raw) > 20 * 1024 * 1024) throw new Error('News input exceeds 20 MiB')
    return JSON.parse(raw)
  }
  const catalog = await read(join(dir, 'event-catalog.json'))
  let previous = null
  try { previous = await read(output) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const archives = (await io.readdir(join(dir, 'archive'))).filter(name => name.endsWith('.json')).sort().map(name => `archive/${name}`)
  const datasets = await Promise.all(['daily.json', 'library.json', 'releases.json', ...archives].map(async name => ({ name, data: await read(join(dir, name)) })))
  const result = buildEventSnapshot(catalog, datasets, previous)
  const serialized = `${JSON.stringify(result, null, 2)}\n`
  if (previous && JSON.stringify(previous) === JSON.stringify(result)) return { changed: false, result }
  if (check) throw new Error('Event index is missing or out of date; run npm run news:events')
  // Same-directory rename is atomic; failures leave the last published index intact.
  const tmp = `${output}.${randomUUID()}.tmp`
  try { await io.writeFile(tmp, serialized, { flag: 'wx', mode: 0o644 }); await io.rename(tmp, output) }
  finally { await io.unlink(tmp).catch(error => { if (error.code !== 'ENOENT') throw error }) }
  return { changed: true, result }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { changed, result } = await generateNewsEvents({ check: process.argv.includes('--check') })
    console.log(`Event index ${changed ? 'updated' : 'unchanged'}: ${result.tracks.length} tracks, ${result.tracks.reduce((n, track) => n + track.reports.length, 0)} related reports; ${result.coverage.invalidItems} invalid observations excluded.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
