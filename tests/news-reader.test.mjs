import assert from 'node:assert/strict'
import test from 'node:test'
import { filterNews, mergeSavedItems, readSavedItems, validNewsItem } from '../src/lib/news-reader.ts'
import { topicsForItem } from '../src/lib/news-topics.mjs'

const item = { id: 'one', title: 'SGLang inference kernels', summary: 'GPU serving with a KV cache', url: 'https://example.org/article', source: 'Engine Blog', sourceCountry: 'International', sourceType: 'engineering', category: 'ai', score: 24, publishedAt: '2026-09-08T00:00:00Z', fetchedAt: '2026-09-09T00:00:00Z' }
const filters = { category: 'all', sourceType: 'all', topic: 'all', query: '', sortBy: 'latest' }

test('saved snapshots remain readable after an article leaves daily data', () => {
  const persisted = JSON.stringify({ version: 2, items: [item] })
  const restored = readSavedItems(persisted)
  assert.equal(restored[0].title, item.title)
  assert.equal(restored[0].url, item.url)
  assert.equal(filterNews(restored, filters, topicsForItem).length, 1)
})

test('storage rejects unsafe links, malformed objects and invalid dates', () => {
  assert.equal(validNewsItem({ ...item, url: 'javascript:alert(1)' }), false)
  assert.equal(validNewsItem({ ...item, url: 'https://name:password@example.org' }), false)
  assert.equal(validNewsItem({ ...item, publishedAt: 'yesterday' }), false)
  assert.throws(() => readSavedItems('{broken'))
  assert.throws(() => readSavedItems(JSON.stringify({ version: 2, items: ['one'] })))
})

test('legacy recovery deduplicates repeated archive copies while preserving current snapshots', () => {
  const merged = mergeSavedItems([item], [{ ...item, title: 'Old title' }, item])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].title, item.title)
})

test('search combines tokens, source type, category and topic without mutating data', () => {
  const other = { ...item, id: 'two', title: 'Central bank statement', summary: '', category: 'finance', sourceType: 'institution' }
  const items = [other, item]
  const result = filterNews(items, { ...filters, query: 'sglang gpu', category: 'ai', sourceType: 'engineering', topic: 'inference' }, topicsForItem)
  assert.deepEqual(result.map((entry) => entry.id), ['one'])
  assert.equal(items[0].id, 'two')
  assert.equal(filterNews(items, { ...filters, query: 'missing' }, topicsForItem).length, 0)
})
