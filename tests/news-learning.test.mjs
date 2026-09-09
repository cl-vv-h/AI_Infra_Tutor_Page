import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { learningForNews } from '../src/lib/news-learning.ts'
import { newsLearningConcepts } from '../src/data/news-learning.ts'
import { getModelArchitecture } from '../src/data/models.ts'
import { parseExplorer } from '../src/lib/model-explorer.ts'

const find = (title, summary = '') => learningForNews({ title, summary })

test('each editorial term resolves to its concept, with context for ambiguous acronyms', () => {
  assert.equal(new Set(newsLearningConcepts.map((c) => c.id)).size, 8)
  for (const concept of newsLearningConcepts) {
    for (const term of concept.terms) assert.ok(find(term).some((m) => m.concept.id === concept.id), term)
    for (const term of concept.contextualTerms ?? []) {
      assert.ok(!find(term).some((m) => m.concept.id === concept.id), term)
      assert.ok(find(`GPU inference: ${term}`).some((m) => m.concept.id === concept.id), term)
      assert.ok(find(term, '模型结构').some((m) => m.concept.id === concept.id), term)
    }
  }
})

test('matching handles hyphens, Unicode, underscores and bilingual boundaries', () => {
  for (const text of ['kv-cache', 'KV–Cache', 'ＫＶ Cache', 'KV_cache', 'KV\n Cache', '使用KV Cache缓存']) assert.equal(find(text)[0].concept.id, 'kv-cache')
  assert.equal(find('grouped-query attention')[0].concept.id, 'gqa')
  assert.equal(find('采用GQA结构的模型')[0].concept.id, 'gqa')
  assert.equal(find('Tensor-parallel serving')[0].concept.id, 'parallelism')
  assert.equal(find('KV 缓存与量化').length, 2)
})

test('short terms never match inside longer words and unrelated prose stays empty', () => {
  for (const text of ['FP80', 'INT40', 'xFP8', 'GPTQuality', 'small attention', 'GPU models moebius', 'MLA style guide', 'MoE education policy', 'cache miss in a browser', 'A speculative investment', 'A new central bank announcement']) assert.deepEqual(find(text), [], text)
  assert.deepEqual(find(''), [])
})

test('title evidence wins and sorting is stable; aliases never duplicate concepts', () => {
  const matches = find('FP8 inference model with MLA', 'KV cache / KV-cache / prefix caching; quantization MLA')
  assert.deepEqual(matches.map((m) => [m.concept.id, m.field]), [['mla', 'title'], ['quantization', 'title'], ['kv-cache', 'summary']])
  assert.equal(matches.find((m) => m.concept.id === 'quantization').term, 'FP8')
  assert.equal(find('KV cache', 'KV cache')[0].field, 'title')
})

test('metadata and untrusted markup cannot inject terms, destinations or conclusions', () => {
  const input = { title: 'Central bank announcement', summary: '', source: 'KV cache', url: 'https://example.org/FP8', topics: ['models'], learning: [{ to: 'javascript:alert(1)' }] }
  const before = JSON.stringify(input)
  assert.deepEqual(learningForNews(input), [])
  assert.equal(JSON.stringify(input), before)
  const matches = find('<script>alert(1)</script> FP8', 'https://user:secret@example.org')
  assert.equal(matches[0].term, 'FP8')
  assert.ok(matches[0].concept.lesson.to.startsWith('/article/'))
  assert.ok(!JSON.stringify(matches).includes('alert(1)'))
})

test('all background lessons exist and all example deep links select the stated module', () => {
  const articles = JSON.parse(readFileSync(new URL('../src/data/curriculum-index.json', import.meta.url), 'utf8'))
  const slugs = new Set(articles.map((a) => a.slug))
  for (const concept of newsLearningConcepts) {
    assert.ok(slugs.has(concept.lesson.to.replace('/article/', '')), concept.id)
    if (concept.reference) {
      const url = new URL(concept.reference.url)
      assert.equal(url.protocol, 'https:')
      assert.ok(!url.username && !url.password)
    }
    if (!concept.example) continue
    const url = new URL(concept.example.to, 'https://example.org')
    const model = getModelArchitecture(url.pathname.split('/').pop())
    assert.ok(model, concept.id)
    const parsed = parseExplorer(url.searchParams, model)
    assert.deepEqual(parsed.notices, [], concept.id)
    assert.equal(parsed.state.nodeId, url.searchParams.get('node'))
    assert.equal(parsed.state.layer, Number(url.searchParams.get('layer')))
  }
})

test('current daily, library and release data produce bounded, unique, text-evidenced matches', () => {
  let matched = 0
  for (const name of ['daily', 'library', 'releases']) {
    const { items } = JSON.parse(readFileSync(new URL(`../src/data/news/${name}.json`, import.meta.url), 'utf8'))
    for (const item of items) {
      const matches = learningForNews(item)
      if (matches.length) matched++
      assert.ok(matches.length <= newsLearningConcepts.length)
      assert.equal(new Set(matches.map((m) => m.concept.id)).size, matches.length)
      for (const m of matches) assert.ok(item[m.field].length > 0)
    }
  }
  assert.ok(matched > 0, 'live data should expose useful learning routes')
})
