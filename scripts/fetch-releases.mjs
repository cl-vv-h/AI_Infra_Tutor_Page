import { readFile, writeFile, rename } from 'node:fs/promises'
import { newsSources } from './news-sources.mjs'
import { fetchGithubReleases, githubReleaseEndpoint } from './news-fetch.mjs'
import { buildReleaseSnapshot } from './news-releases.mjs'

const target = new URL('../src/data/news/releases.json', import.meta.url)
let previous = { items: [], sources: [] }
try { previous = JSON.parse(await readFile(target, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const results = []
// Sequential, public requests only; no pagination, retries or credentials.
for (const source of newsSources.filter(githubReleaseEndpoint)) {
  results.push({ source, ...await fetchGithubReleases(source) })
}
const snapshot = buildReleaseSnapshot(results, previous, new Date())
// Keep cached records and their original fetch times even on a complete outage.
const temp = new URL(`${target.href}.tmp`)
await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
await rename(temp, target)
console.log(`Release desk: ${snapshot.items.length} versions; ${results.filter((entry) => entry.state === 'ok').length}/${results.length} official APIs available.`)
for (const source of snapshot.sources.filter((entry) => entry.state !== 'ok')) console.warn(`${source.name}: ${source.state}; keeping previously collected records within the lookback window.`)
