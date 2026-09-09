import assert from 'node:assert/strict'
import test from 'node:test'
import { filterNews, mergeSavedItems, newsParams, parseNewsParams, readSavedItems, validNewsItem } from '../src/lib/news-reader.ts'
import { newsTopics, topicsForItem } from '../src/lib/news-topics.mjs'
import { newsStudyGuides } from '../src/data/news-study-guides.ts'
import { categories } from '../src/data/categories.ts'

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

const dates = ['2026-09-09', '2026-09-08']
const parse = (query) => parseNewsParams(new URLSearchParams(query), dates, newsTopics.map((topic) => topic.id))

test('news links restore all public filters, source names, unicode keywords and archive dates', () => {
  for (const view of ['daily', 'library', 'archive']) {
    const state = { view, category: 'technology', sourceType: 'engineering', source: 'AMD ROCm Blog', topic: 'kernels', query: '编译 & torch.compile', sortBy: 'latest', archiveDate: dates[1] }
    const params = newsParams(state)
    const restored = parse(params)
    assert.deepEqual(restored.notices, [])
    assert.deepEqual(restored.state, { ...state, archiveDate: view === 'archive' ? dates[1] : dates[0] })
    assert.equal(params.has('date'), view === 'archive')
  }
  assert.equal(parse('').state.category, 'ai')
  assert.equal(parse('view=library').state.category, 'all')
  assert.equal(parse('view=library').state.sortBy, 'latest')
})

test('invalid news link fields are bounded with notices and unknown fields are never serialized', () => {
  const parsed = parse('view=unknown&category=bad&type=evil&topic=constructor&sort=random&date=2099-12-31&q=%00hello&source=' + 'x'.repeat(200) + '&token=secret&items=private')
  assert.ok(parsed.notices.length >= 8)
  assert.equal(parsed.state.view, 'daily')
  assert.equal(parsed.state.topic, 'all')
  assert.equal(parsed.state.archiveDate, dates[0])
  assert.equal(parsed.state.query, 'hello')
  assert.equal(parsed.state.source.length, 120)
  assert.equal(parse('q=' + '文'.repeat(201)).state.query.length, 200)
  const params = newsParams({ ...parsed.state, items: [item], token: 'secret' })
  assert.equal(params.has('items'), false)
  assert.equal(params.has('token'), false)
  assert.equal(parseNewsParams(new URLSearchParams(), [], []).state.archiveDate, '')
})

test('specific source is exact and missing sources stay empty instead of broadening a shared search', () => {
  const items = [item, { ...item, id: 'two', source: 'Engine Blog 2' }]
  assert.deepEqual(filterNews(items, { ...filters, source: 'Engine Blog' }, topicsForItem).map((entry) => entry.id), ['one'])
  const { state } = parse('view=library&source=Previously+available+blog')
  assert.equal(state.source, 'Previously available blog')
  assert.equal(filterNews(items, state, topicsForItem).length, 0)
})

test('all technical topics have reading guides and their learning links resolve', () => {
  assert.deepEqual(Object.keys(newsStudyGuides).sort(), newsTopics.map((topic) => topic.id).sort())
  for (const guide of Object.values(newsStudyGuides)) {
    assert.equal(guide.questions.length, 3)
    for (const link of guide.links) assert.ok(['/models', '/models/compare', ...categories.map((category) => `/category/${category.slug}`)].includes(link.to), link.to)
    for (const link of guide.originals ?? []) assert.equal(new URL(link.url).protocol, 'https:')
  }
})

test('release links preserve stage and all shared filters; leaving the desk clears stage', () => {
  const { state, notices } = parse('view=releases&stage=prerelease&source=SGLang+Releases&q=cache&topic=inference')
  assert.equal(state.view, 'releases')
  assert.equal(state.releaseStage, 'prerelease')
  assert.equal(state.category, 'all')
  assert.equal(state.sortBy, 'latest')
  assert.deepEqual(notices, [])
  assert.deepEqual(parse(newsParams(state)).state, state)
  assert.equal(newsParams({ ...state, view: 'library' }).has('stage'), false)
  assert.equal(parse('view=releases&stage=evil').state.releaseStage, 'all')
  assert.match(parse('view=releases&stage=evil').notices[0], /stage/)
})

test('release stage filters combine with source/search and do not classify unmarked articles as stable', () => {
  const stable = { ...item, id: 'stable', sourceType: 'release', releaseStage: 'stable', publishedAtKind: 'github-release' }
  const preview = { ...stable, id: 'preview', releaseStage: 'prerelease' }
  const items = [item, stable, preview]
  assert.deepEqual(filterNews(items, { ...filters, releaseStage: 'stable', source: item.source, query: 'kernels' }, topicsForItem).map((entry) => entry.id), ['stable'])
  assert.deepEqual(filterNews(items, { ...filters, releaseStage: 'prerelease' }, topicsForItem).map((entry) => entry.id), ['preview'])
  const restored = readSavedItems(JSON.stringify({ version: 2, items: [preview] }))
  assert.equal(restored[0].releaseStage, 'prerelease')
  assert.equal(restored[0].publishedAtKind, 'github-release')
})
