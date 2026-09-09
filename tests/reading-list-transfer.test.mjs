import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { commitReadingImport, maxImportBytes, mergeReadingImport, previewReadingImport } from '../src/lib/reading-list-transfer.ts'
import { readingListKey, readSavedItems } from '../src/lib/news-reader.ts'

const item = { id: 'one', title: 'GPU inference', summary: 'KV cache note', url: 'https://example.org/article', source: 'Example Blog', sourceCountry: 'International', category: 'ai', sourceType: 'engineering', score: 10, publishedAt: '2026-09-09T00:00:00Z', fetchedAt: '2026-09-09T01:00:00Z' }
const wrap = (items) => JSON.stringify({ version: 2, items })
function memory(raw = null) {
  return { raw, writes: 0, getItem(key) { assert.equal(key, readingListKey); return this.raw }, setItem(key, value) { assert.equal(key, readingListKey); this.writes++; this.raw = value } }
}

test('v2 exports round-trip with imported provenance and only allowlisted fields', () => {
  const raw = '{"version":2,"privateNotes":"discard","items":[' + JSON.stringify({ ...item, topics: ['fake'], token: 'discard', profile: { email: 'unused' } }).replace('"id":', '"__proto__":{"polluted":true},"id":') + ']}'
  const parsed = previewReadingImport('\uFEFF' + raw)
  assert.equal(parsed.inputCount, 1)
  assert.equal(parsed.duplicates, 0)
  assert.deepEqual(parsed.items, [{ ...item, origin: 'imported', publishedAt: '2026-09-09T00:00:00.000Z', fetchedAt: '2026-09-09T01:00:00.000Z' }])
  assert.equal(Object.prototype.polluted, undefined)
  assert.ok(!JSON.stringify(parsed).includes('discard'))
  assert.deepEqual(readSavedItems(wrap(parsed.items)), parsed.items)
})

test('all current news snapshots are importable, including release metadata', () => {
  for (const name of ['daily', 'library', 'releases']) {
    const { items } = JSON.parse(readFileSync(new URL(`../src/data/news/${name}.json`, import.meta.url), 'utf8'))
    const result = previewReadingImport(wrap(items))
    assert.equal(result.items.length + result.duplicates, items.length)
    assert.ok(result.items.every((entry) => entry.origin === 'imported'))
    for (const release of result.items.filter((entry) => entry.publishedAtKind === 'github-release')) assert.ok(['stable', 'prerelease'].includes(release.releaseStage))
  }
})

test('invalid envelopes, records and oversize files reject the entire batch', () => {
  for (const raw of ['{', 'null', '[]', '{}', '{"version":1,"items":[]}', wrap([]), '{"version":2,"items":["id-only"]}']) assert.throws(() => previewReadingImport(raw))
  for (const change of [{ title: '' }, { summary: 'x'.repeat(20001) }, { score: null }, { category: 'other' }, { sourceType: 'fake' }, { releaseStage: 'official' }, { publishedAt: 'invalid' }, { publishedAtKind: 'trust-me' }, { title: '\u202efake' }]) assert.throws(() => previewReadingImport(wrap([item, { ...item, ...change }])), /第 2 条/)
  assert.throws(() => previewReadingImport(' '.repeat(maxImportBytes + 1)), /2 MiB/)
  assert.throws(() => previewReadingImport(wrap(Array.from({ length: 501 }, () => item))), /500/)
  assert.throws(() => previewReadingImport('文'.repeat(maxImportBytes / 2)), /2 MiB/)
})

test('unsafe URLs and local-network literals are rejected without making requests', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'http://example.org', '//example.org', 'https://u:p@example.org', 'https://localhost', 'https://foo.localhost.', 'https://host.local', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://example.org:8443', 'https://example.org\\@evil.org', 'https://exam\nple.org']) assert.throws(() => previewReadingImport(wrap([{ ...item, url }])), /不安全链接/, url)
  assert.equal(previewReadingImport(wrap([{ ...item, url: 'https://EXAMPLE.org:443/path' }])).items[0].url, 'https://example.org/path')
})

test('duplicate IDs and canonical URLs never replace existing snapshots', () => {
  const other = { ...item, id: 'two', url: 'https://example.org/two' }
  const incoming = [item, { ...item, id: 'alias', title: 'Changed', url: 'https://EXAMPLE.org:443/article' }, other]
  const preview = previewReadingImport(wrap(incoming))
  assert.equal(preview.duplicates, 1)
  const result = mergeReadingImport([item], preview.items)
  assert.equal(result.duplicates, 1)
  assert.equal(result.additions.length, 1)
  assert.equal(result.items.at(-1), item)
  assert.equal(result.items[0].id, 'two')
  assert.deepEqual(item.title, 'GPU inference')
})

test('colliding aliases reserve both identities and preserve original list order', () => {
  const current = [item]
  const entries = [{ ...item, url: 'https://example.org/new' }, { ...item, id: 'second', url: 'https://example.org/new' }, { ...item, id: 'second', url: 'https://example.org/third' }]
  assert.deepEqual(mergeReadingImport(current, entries).items, current)
  assert.equal(mergeReadingImport(current, entries).duplicates, 3)
})

test('confirmation writes once, retains pending recovery IDs and skips all-duplicate writes', () => {
  const pending = ['pending-one']
  const storage = memory(JSON.stringify({ version: 2, items: [item], pendingLegacyIds: pending }))
  const addition = { ...item, id: 'new', url: 'https://example.org/new' }
  const plan = commitReadingImport([item], [addition], pending, storage)
  assert.equal(storage.writes, 1)
  assert.equal(plan.items[0].origin, 'imported')
  assert.deepEqual(JSON.parse(storage.raw).pendingLegacyIds, pending)
  assert.deepEqual(plan.items.at(-1), item)
  const noChange = commitReadingImport(plan.items, [addition], pending, storage)
  assert.equal(noChange.additions.length, 0)
  assert.equal(storage.writes, 1)
})

test('quota failure, denied read and invalid storage leave the old list untouched', () => {
  const old = wrap([item])
  const current = [item]
  const incoming = [{ ...item, id: 'new', url: 'https://example.org/new' }]
  const storage = memory(old)
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.throws(() => commitReadingImport(current, incoming, [], storage), /原收藏未改动/)
  assert.equal(storage.raw, old)
  assert.deepEqual(current, [item])
  assert.throws(() => commitReadingImport(current, incoming, [], { getItem() { throw new Error('Denied') }, setItem() { assert.fail() } }), /无法读取/)
  const invalid = memory('{broken')
  assert.throws(() => commitReadingImport(current, incoming, [], invalid), /原收藏无法解析/)
  assert.equal(invalid.writes, 0)
})

test('confirmation refuses stale state or altered pending IDs before a write', () => {
  const newer = { ...item, title: 'Updated in another tab' }
  const storage = memory(wrap([newer]))
  assert.throws(() => commitReadingImport([item], [item], [], storage), /不一致/)
  assert.equal(storage.writes, 0)
  storage.raw = JSON.stringify({ version: 2, items: [item], pendingLegacyIds: ['new'] })
  assert.throws(() => commitReadingImport([item], [item], [], storage), /不一致/)
  assert.equal(storage.writes, 0)
})

test('confirmation revalidates incoming data even if called without the preview UI', () => {
  const storage = memory()
  assert.throws(() => commitReadingImport([], [{ ...item, url: 'javascript:bad' }], [], storage))
  assert.equal(storage.writes, 0)
})
