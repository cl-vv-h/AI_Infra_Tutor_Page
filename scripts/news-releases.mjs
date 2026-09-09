import { prepareItems } from './news-core.mjs'
import { githubReleaseEndpoint } from './news-fetch.mjs'

export const releaseLookbackDays = 90
export const releaseLimitPerStage = 8

/** Keep separately bounded full/prerelease histories; new API values supersede old snapshots. */
export function buildReleaseSnapshot(results, previous, now) {
  const cutoff = now.getTime() - releaseLookbackDays * 86400000
  const items = []
  const sources = results.map(({ source, state, entries, httpStatus }) => {
    if (!githubReleaseEndpoint(source)) throw new Error('INVALID_RELEASE_SOURCE')
    const current = entries.flatMap((entry) => typeof entry.prerelease !== 'boolean' ? [] :
      prepareItems([{ ...entry, source }], now, releaseLookbackDays * 24).map((item) => ({ ...item,
        releaseStage: entry.prerelease ? 'prerelease' : 'stable', publishedAtKind: 'github-release' })))
    const prior = (previous.items ?? []).filter((item) => item.source === source.name)
    const seen = new Set()
    const candidates = [...current, ...prior].filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return item.sourceType === 'release' && item.publishedAtKind === 'github-release'
        && ['stable', 'prerelease'].includes(item.releaseStage)
        && item.url.startsWith(`https://github.com/${source.githubRepository}/releases/tag/`)
        && Date.parse(item.publishedAt) >= cutoff && Date.parse(item.publishedAt) <= now.getTime()
    }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    const counts = { stable: 0, prerelease: 0 }
    const selected = candidates.filter((item) => ++counts[item.releaseStage] <= releaseLimitPerStage)
    items.push(...selected)
    return { name: source.name, repository: source.githubRepository,
      url: `https://github.com/${source.githubRepository}/releases`, state,
      ...(httpStatus ? { httpStatus } : {}),
      lastSuccessAt: state === 'ok' ? now.toISOString() : previous.sources?.find((entry) => entry.name === source.name)?.lastSuccessAt ?? null,
      count: selected.length }
  })
  return { generatedAt: now.toISOString(), lookbackDays: releaseLookbackDays, limitPerStage: releaseLimitPerStage,
    sources, items: items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) }
}
