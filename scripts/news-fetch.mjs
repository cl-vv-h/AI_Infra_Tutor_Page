import { cleanText, parseFeed } from './news-core.mjs'

const userAgent = 'AI-Infra-Space-News-Radar/1.0 (+https://github.com/cl-vv-h/AI_Infra_Tutor_Page)'

// An explicit repository opt-in must match the existing official Atom URL.
export function githubReleaseEndpoint(source) {
  const repo = source.githubRepository
  if (typeof repo !== 'string' || !/^[\w-]+\/[\w.-]+$/.test(repo)) return null
  if (source.url !== `https://github.com/${repo}/releases.atom`) return null
  return `https://api.github.com/repos/${repo}/releases?per_page=30`
}

export function parseGithubReleases(data, source) {
  if (!githubReleaseEndpoint(source) || !Array.isArray(data)) throw new Error('INVALID_RELEASES')
  const entries = data.flatMap((release) => {
    if (!release || typeof release !== 'object' || release.draft !== false || typeof release.prerelease !== 'boolean') return []
    const name = typeof release.name === 'string' && release.name.trim() ? release.name : release.tag_name
    if (typeof name !== 'string' || !cleanText(name) || typeof release.published_at !== 'string' || !Number.isFinite(Date.parse(release.published_at))) return []
    let url
    try { url = new URL(release.html_url) } catch { return [] }
    const prefix = `/${source.githubRepository}/releases/tag/`
    if (url.origin !== 'https://github.com' || url.username || url.password || !url.pathname.startsWith(prefix) || url.pathname.length <= prefix.length || url.search || url.hash) return []
    // Retain only public article fields, never author profiles, assets or API metadata.
    const body = typeof release.body === 'string' ? release.body : ''
    const summary = cleanText(body.replace(/```[\s\S]*?```/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(?:^|\s)@[\w-]+/g, ' ').replace(/^[#*>-]+\s*/gm, '').replace(/[*`]/g, ''))
    return [{ title: `${source.githubRepository.split('/')[1]} · ${cleanText(name)}${release.prerelease ? '（预发布）' : ''}`, summary, url: url.href, publishedAt: release.published_at, prerelease: release.prerelease }]
  })
  // Do not report a schema error page masquerading as an array as a healthy source.
  if (data.length && !entries.length && !data.every((release) => release?.draft === true)) throw new Error('INVALID_RELEASES')
  return entries
}

async function fetchFeed(source, fetchImpl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl(source.url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        if (attempt === 0 && response.status >= 500) continue
        return { state: 'unavailable', entries: [], httpStatus: response.status }
      }
      try { return { state: 'ok', entries: parseFeed(await response.text()) } } catch (error) {
        if (error.message === 'INVALID_FEED') return { state: 'invalid', entries: [] }
        throw error
      }
    } catch {
      if (attempt === 1) return { state: 'unavailable', entries: [] }
    }
  }
}

export async function fetchSource(source, fetchImpl = fetch) {
  const feed = await fetchFeed(source, fetchImpl)
  const endpoint = githubReleaseEndpoint(source)
  if (feed.state === 'ok' || !endpoint) return { source, channel: 'feed', ...feed }
  const base = { source, channel: 'github-api', feedFailure: { state: feed.state, ...(feed.httpStatus ? { httpStatus: feed.httpStatus } : {}) } }
  return { ...base, ...await fetchGithubReleases(source, fetchImpl) }
}

export async function fetchGithubReleases(source, fetchImpl = fetch) {
  const endpoint = githubReleaseEndpoint(source)
  if (!endpoint) throw new Error('INVALID_RELEASE_SOURCE')
  // Exactly one unauthenticated fallback request; do not retry rate limits or read tokens.
  try {
    const response = await fetchImpl(endpoint, {
      headers: { 'User-Agent': userAgent, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return { state: 'unavailable', entries: [], httpStatus: response.status }
    try { return { state: 'ok', entries: parseGithubReleases(await response.json(), source) } } catch {
      return { state: 'invalid', entries: [] }
    }
  } catch { return { state: 'unavailable', entries: [] } }
}
