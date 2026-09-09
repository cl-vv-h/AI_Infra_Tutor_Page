import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchSource, githubReleaseEndpoint, parseGithubReleases } from '../scripts/news-fetch.mjs'
import { importanceScore, prepareItems } from '../scripts/news-core.mjs'
import { newsSources } from '../scripts/news-sources.mjs'

const source = newsSources.find((item) => item.name === 'SGLang Releases')
const now = new Date('2026-09-09T12:00:00Z')
const release = (overrides = {}) => ({ name: 'v1.0', tag_name: 'v1.0', draft: false, prerelease: false, html_url: 'https://github.com/sgl-project/sglang/releases/tag/v1.0', published_at: '2026-09-08T10:00:00Z', created_at: '2020-01-01T00:00:00Z', body: '## Inference\nKV cache improvements by @someone. [Details](https://example.org) <script>unsafe()</script>', author: { login: 'not-retained', email: 'not-retained@example.org' }, assets: [{ name: 'not-retained' }], ...overrides })
const rss = '<feed><entry><title>v1</title><link href="https://github.com/sgl-project/sglang/releases/tag/v1"/><published>2026-09-08</published></entry></feed>'

test('fallback is explicitly opted in and bound to the same official repository', () => {
  assert.equal(newsSources.filter((item) => githubReleaseEndpoint(item)).length, 6)
  assert.equal(githubReleaseEndpoint({ ...source, githubRepository: '../private' }), null)
  assert.equal(githubReleaseEndpoint({ ...source, url: 'https://example.org/feed' }), null)
  assert.equal(githubReleaseEndpoint({ url: source.url }), null)
})

test('healthy feed, including a valid empty feed, never calls the fallback', async () => {
  for (const xml of [rss, '<feed></feed>']) {
    let calls = 0
    const result = await fetchSource(source, async (url) => { calls++; assert.equal(url, source.url); return new Response(xml) })
    assert.equal(calls, 1)
    assert.equal(result.channel, 'feed')
    assert.equal(result.state, 'ok')
    assert.equal(result.feedFailure, undefined)
  }
})

test('network failure retries the feed once then uses one credential-free API request', async () => {
  const calls = []
  const result = await fetchSource(source, async (url, options) => {
    calls.push(url)
    assert.ok(!Object.keys(options.headers).some((name) => /authorization|cookie|token/i.test(name)))
    if (url === source.url) throw new Error('connection reset')
    assert.equal(options.redirect, 'error')
    return Response.json([release()])
  })
  assert.deepEqual(calls, [source.url, source.url, githubReleaseEndpoint(source)])
  assert.equal(result.state, 'ok')
  assert.equal(result.channel, 'github-api')
  assert.deepEqual(result.feedFailure, { state: 'unavailable' })
  assert.equal(result.entries.length, 1)
  assert.doesNotMatch(JSON.stringify(result.entries), /not-retained|someone|<script>|unsafe/)
})

test('HTML masquerading as a feed can recover; non-GitHub sources cannot fall back', async () => {
  let calls = 0
  const mock = async (url) => { calls++; return url === source.url ? new Response('<html>bad feed</html>') : Response.json([release()]) }
  const result = await fetchSource(source, mock)
  assert.equal(calls, 2)
  assert.equal(result.feedFailure.state, 'invalid')
  assert.equal(result.state, 'ok')
  calls = 0
  const other = await fetchSource({ ...source, githubRepository: undefined }, mock)
  assert.equal(calls, 1)
  assert.equal(other.state, 'invalid')
})

test('rate limits and API errors are not retried or misreported as healthy', async () => {
  for (const status of [403, 429, 500]) {
    let calls = 0
    const result = await fetchSource(source, async (url) => { calls++; return new Response('', { status: url === source.url ? 404 : status }) })
    assert.equal(calls, 2)
    assert.equal(result.state, 'unavailable')
    assert.equal(result.httpStatus, status)
    assert.deepEqual(result.feedFailure, { state: 'unavailable', httpStatus: 404 })
    assert.deepEqual(result.entries, [])
  }
})

test('malformed API JSON/schema is invalid, empty array is valid, network failure is unavailable', async () => {
  for (const body of ['not json', '{"message":"error"}', '[{"message":"error"}]']) {
    const result = await fetchSource(source, async (url) => new Response(url === source.url ? '<html>error</html>' : body))
    assert.equal(result.state, 'invalid')
  }
  const empty = await fetchSource(source, async (url) => url === source.url ? new Response('', { status: 404 }) : Response.json([]))
  assert.equal(empty.state, 'ok')
  assert.deepEqual(empty.entries, [])
  const failed = await fetchSource(source, async () => { throw new Error('offline') })
  assert.equal(failed.state, 'unavailable')
})

test('drafts, invalid fields and foreign/credentialed URLs are excluded', () => {
  const data = [release(), release({ draft: true }), release({ draft: undefined }), release({ published_at: 'invalid' }), release({ name: {}, tag_name: null }), release({ html_url: 'https://github.com/other/repo/releases/tag/v1' }), release({ html_url: 'https://user:pass@github.com/sgl-project/sglang/releases/tag/v1' }), release({ html_url: 'https://github.com/sgl-project/sglang/releases/tag/' }), release({ html_url: 'javascript:alert(1)' }), release({ html_url: 'https://github.com/sgl-project/sglang/releases/tag/v1?private=x' })]
  const items = parseGithubReleases(data, source)
  assert.equal(items.length, 1)
  assert.deepEqual(Object.keys(items[0]).sort(), ['prerelease', 'publishedAt', 'summary', 'title', 'url'])
  assert.equal(items[0].publishedAt, release().published_at)
  assert.deepEqual(parseGithubReleases([release({ draft: true })], source), [])
})

test('published_at controls recency; prereleases are visible and score below stable releases', () => {
  const entries = parseGithubReleases([release(), release({ name: '', tag_name: 'v2', prerelease: true, html_url: 'https://github.com/sgl-project/sglang/releases/tag/v2' }), release({ published_at: '2020-01-01', html_url: 'https://github.com/sgl-project/sglang/releases/tag/old' }), release({ published_at: '2030-01-01', html_url: 'https://github.com/sgl-project/sglang/releases/tag/future' })], source)
  assert.match(entries[1].title, /v2（预发布）/)
  assert.equal(importanceScore(entries[0], source, now) - importanceScore(entries[1], source, now), 4)
  assert.equal(prepareItems(entries.map((entry) => ({ ...entry, source })), now, 48).length, 2)
})
