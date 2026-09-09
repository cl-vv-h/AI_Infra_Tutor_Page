import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanText, deduplicateItems, normalizedUrl, parseFeed, prepareItems, requireUsableFeeds, selectDiverse, selectLibrary } from '../scripts/news-core.mjs'

const now = new Date('2026-09-09T12:00:00Z')
const source = { name: 'Engine Blog', country: 'International', category: 'ai', type: 'engineering', weight: 10 }
const entry = (values = {}) => ({ title: 'Inference kernel design', summary: 'Production KV cache layout', url: 'https://example.org/a', publishedAt: '2026-09-08T00:00:00Z', source, ...values })

test('total outage and empty responses stop publication; partial outage can continue', () => {
  assert.throws(() => requireUsableFeeds([{ state: 'unavailable', entries: [] }, { state: 'ok', entries: [] }]), /keeping all previously published/)
  assert.doesNotThrow(() => requireUsableFeeds([{ state: 'unavailable', entries: [] }, { state: 'ok', entries: [entry()] }]))
})

test('Atom selects the HTML alternate link, not self or an attachment', () => {
  const xml = `<feed><entry><title>Serving &amp; kernels</title><link rel='self' href='https://example.org/entry.atom'/><link rel='enclosure' href='https://example.org/paper.pdf'/><link href='https://example.org/post' type='text/html' rel='alternate'/><published>2026-09-08T00:00:00Z</published><summary>&lt;p&gt;A &amp; B&lt;/p&gt;</summary></entry></feed>`
  const [item] = parseFeed(xml)
  assert.equal(item.url, 'https://example.org/post')
  assert.equal(item.title, 'Serving & kernels')
  assert.equal(item.summary, 'A & B')
})

test('RSS guid fallback and malformed numeric entities cannot crash a whole feed', () => {
  const [item] = parseFeed('<rss><channel><item><title><![CDATA[Engine &#x110000; update]]></title><guid>https://example.org/release</guid><pubDate>2026-09-08</pubDate></item></channel></rss>')
  assert.equal(item.url, 'https://example.org/release')
  assert.ok(item.title.includes('\uFFFD'))
  assert.equal(cleanText('<script>secret()</script><b>Public</b>'), 'Public')
  assert.throws(() => parseFeed('<html><body>200 OK but not a feed</body></html>'), /INVALID_FEED/)
  assert.deepEqual(parseFeed('<feed></feed>'), [])
})

test('collection rejects invalid dates, future dates, unsafe URLs and cleans tracking', () => {
  const prepared = prepareItems([entry(), entry({ publishedAt: 'invalid' }), entry({ publishedAt: '2030-01-01' }), entry({ url: 'javascript:alert(1)' }), entry({ url: 'https://name:password@example.org/private' })], now, 48)
  assert.equal(prepared.length, 1)
  assert.equal(normalizedUrl('https://example.org/a?utm_source=mail&lang=en#top'), 'https://example.org/a?lang=en')
})

test('same release title in two projects is preserved, repeated URL is removed', () => {
  const a = prepareItems([entry({ title: 'v1.0' }), entry({ title: 'v1.0', url: 'https://example.org/b', source: { ...source, name: 'Other Engine' } })], now, 48)
  assert.equal(a.length, 2)
  assert.equal(deduplicateItems([...a, { ...a[0], url: a[0].url + '/' }]).length, 2)
})

test('daily source cap prevents a fast publisher from monopolizing a category', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i), source: i < 8 ? 'Fast Publisher' : 'Slow Publisher', category: 'ai' }))
  const selected = selectDiverse(items, 16, 3)
  assert.equal(selected.length, 6)
  assert.equal(selected.filter((item) => item.source === 'Fast Publisher').length, 3)
})

test('technical library retains slower engineering posts but excludes stale posts and PR', () => {
  const older = entry({ publishedAt: '2026-08-01T00:00:00Z' })
  assert.equal(prepareItems([older], now, 48).length, 0)
  const items = prepareItems([older, entry({ title: 'Foundation conference: AI training', url: 'https://example.org/pr' }), entry({ publishedAt: '2026-01-01', url: 'https://example.org/old' })], now, 365 * 24)
  assert.equal(selectLibrary(items, now).length, 1)
  assert.equal(selectLibrary(items, now)[0].url, older.url)
})
