import { createHash } from 'node:crypto'
import { HOTSPOT_VERSION, hotspotUrl, validateHotspotCorpus } from '../src/lib/news-hotspots.mjs'

export function collectHotspotCorpus(items, sourceStates, asOf, previous = null) {
  if (previous) validateHotspotCorpus(previous)
  if (!Number.isFinite(Date.parse(asOf)) || (previous && asOf < previous.generatedAt)) throw new Error('Hotspot collection clock regressed')
  const cutoff = Date.parse(asOf) - 30 * 86400000
  const byUrl = new Map((previous?.items || []).filter(row => Date.parse(row.publishedAt) > cutoff).map(row => [row.url, row]))
  for (const item of items) {
    const url = hotspotUrl(item.url)
    if (!url || !Number.isFinite(Date.parse(item.publishedAt)) || Date.parse(item.publishedAt) <= cutoff || Date.parse(item.publishedAt) > Date.parse(asOf) + 3600000) continue
    const old = byUrl.get(url)
    byUrl.set(url, { id: createHash('sha256').update(url).digest('hex').slice(0, 16), title: item.title, url, source: item.source, country: item.sourceCountry, category: item.category,
      publishedAt: item.publishedAt, firstSeenAt: old?.firstSeenAt || asOf, lastSeenAt: asOf })
  }
  return validateHotspotCorpus({ version: HOTSPOT_VERSION, generatedAt: asOf, startedAt: previous?.startedAt || asOf,
    sources: sourceStates.map(row => ({ name: row.name, url: row.url, country: row.country, state: row.state, count: row.entryCount })),
    items: [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url)) })
}
