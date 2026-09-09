import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReleaseSnapshot, releaseLimitPerStage } from '../scripts/news-releases.mjs'
import { fetchGithubReleases, githubReleaseEndpoint } from '../scripts/news-fetch.mjs'
import { newsSources } from '../scripts/news-sources.mjs'

const source = newsSources.find((item) => item.name === 'SGLang Releases')
const other = newsSources.find((item) => item.name === 'vLLM Releases')
const now = new Date('2026-09-09T12:00:00Z')
const entry = (tag, prerelease = false, publishedAt = '2026-09-08T12:00:00Z', repo = source) => ({ title: tag, summary: 'Inference kernels', prerelease, publishedAt, url: `https://github.com/${repo.githubRepository}/releases/tag/${tag}` })
const result = (entries, overrides = {}) => ({ source, state: 'ok', entries, ...overrides })
const build = (entries, previous = {}) => buildReleaseSnapshot([result(entries)], previous, now)

test('release desk keeps 90-day history beyond the daily window with explicit stage and provenance', () => {
  const snapshot = build([entry('v1', false, '2026-08-01'), entry('rc1', true)])
  assert.equal(snapshot.items.length, 2)
  assert.equal(snapshot.items[0].releaseStage, 'prerelease')
  assert.equal(snapshot.items[1].releaseStage, 'stable')
  assert.ok(snapshot.items.every((item) => item.publishedAtKind === 'github-release'))
  assert.equal(snapshot.sources[0].lastSuccessAt, now.toISOString())
})

test('formal status is never inferred from a tag or missing metadata', () => {
  const snapshot = build([entry('v1-rc1', false), entry('v2', true), { ...entry('v3'), prerelease: undefined }])
  assert.equal(snapshot.items.length, 2)
  assert.equal(snapshot.items.find((item) => item.title === 'v1-rc1').releaseStage, 'stable')
  assert.equal(snapshot.items.find((item) => item.title === 'v2').releaseStage, 'prerelease')
})

test('window boundary is inclusive; stale, invalid, and any future publication are excluded', () => {
  const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString()
  const snapshot = build([entry('edge', false, cutoff), entry('old', false, '2020-01-01'), entry('future', false, new Date(now.getTime() + 1000).toISOString()), entry('invalid', false, 'invalid')])
  assert.deepEqual(snapshot.items.map((item) => item.title), ['edge'])
})

test('frequent prereleases cannot evict the separately capped full releases', () => {
  const snapshot = build([...Array.from({ length: 20 }, (_, i) => entry(`rc${i}`, true, new Date(now.getTime() - i * 1000).toISOString())), ...Array.from({ length: 12 }, (_, i) => entry(`v${i}`, false, new Date(now.getTime() - (i + 100) * 1000).toISOString()))])
  for (const stage of ['stable', 'prerelease']) assert.equal(snapshot.items.filter((item) => item.releaseStage === stage).length, releaseLimitPerStage)
  assert.ok(snapshot.items.some((item) => item.title === 'v0'))
  assert.ok(!snapshot.items.some((item) => item.title === 'v11'))
})

test('new API values replace cached same-tag metadata, including promotion to full release', () => {
  const old = build([entry('v1', true)])
  const updated = build([entry('v1', false)], old)
  assert.equal(updated.items.length, 1)
  assert.equal(updated.items[0].releaseStage, 'stable')
  const two = buildReleaseSnapshot([result([entry('v1')]), result([entry('v1', false, '2026-09-08', other)], { source: other })], {}, now)
  assert.equal(two.items.length, 2)
})

test('shorter responses retain valid history; outages retain original fetch and last success times', () => {
  const previous = build([entry('v1')])
  const later = new Date(now.getTime() + 86400000)
  const offline = buildReleaseSnapshot([result([], { state: 'unavailable', httpStatus: 429 })], previous, later)
  assert.deepEqual(offline.items, previous.items)
  assert.equal(offline.sources[0].lastSuccessAt, previous.generatedAt)
  assert.equal(offline.sources[0].state, 'unavailable')
  assert.equal(offline.generatedAt, later.toISOString())
  assert.equal(build([], previous).items.length, 1)
  assert.equal(buildReleaseSnapshot([result([], { state: 'invalid' })], {}, now).sources[0].lastSuccessAt, null)
})

test('foreign repositories, feed-only snapshots and invalid sources never enter release history', () => {
  const previous = build([entry('v1')])
  const bad = { ...previous.items[0], url: 'https://example.org/foreign', publishedAtKind: undefined }
  assert.equal(build([], { items: [bad] }).items.length, 0)
  assert.equal(build([entry('v2', false, '2026-09-08', other)]).items.length, 0)
  assert.throws(() => buildReleaseSnapshot([result([], { source: { ...source, url: 'https://example.org/feed' } })], {}, now), /INVALID_RELEASE_SOURCE/)
})

test('direct release requests only use the explicitly bound public API without credentials or retries', async () => {
  let calls = 0
  const response = await fetchGithubReleases(source, async (url, options) => {
    calls++
    assert.equal(url, githubReleaseEndpoint(source))
    assert.equal(options.redirect, 'error')
    assert.ok(!Object.keys(options.headers).some((name) => /authorization|cookie|token/i.test(name)))
    return new Response('', { status: 429 })
  })
  assert.equal(calls, 1)
  assert.equal(response.state, 'unavailable')
  await assert.rejects(fetchGithubReleases({ ...source, githubRepository: undefined }), /INVALID_RELEASE_SOURCE/)
})
