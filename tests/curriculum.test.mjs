import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCurriculumIndex } from '../scripts/curriculum-index.mjs'
import { readCurriculumModules } from '../scripts/generate-curriculum-index.mjs'
import { createArticleLoader } from '../src/lib/article-loader.ts'
import { searchCurriculum } from '../src/lib/curriculum-search.ts'

const modules = await readCurriculumModules()
const index = buildCurriculumIndex(modules)
const fixture = (name, content, language = 'zh') => [`./content/${language}/ai-infra-basic/Model_Architecture/${name}.md`, content]

test('committed catalogue matches every source without storing bodies or local paths', async () => {
  const saved = JSON.parse(await readFile(new URL('../src/data/curriculum-index.json', import.meta.url), 'utf8'))
  assert.deepEqual(saved, index)
  assert.equal(new Set(index.map((article) => article.slug)).size, index.length)
  assert.ok(index.length >= 139)
  for (const article of index) {
    assert.equal('content' in article || 'contentEn' in article, false)
    assert.doesNotMatch(article.sourcePath, /^(?:\/|[A-Z]:)|\.\./)
    for (const language of article.availableLanguages) assert.equal(typeof modules[`./content/${language}/${article.sourcePath}`], 'string')
    for (const [direction, inverse] of [['prevArticleId', 'nextArticleId'], ['nextArticleId', 'prevArticleId']]) {
      if (!article[direction]) continue
      const adjacent = index.find((item) => item.id === article[direction])
      assert.ok(adjacent)
      assert.equal(adjacent.subCategoryId, article.subCategoryId)
      assert.equal(adjacent[inverse], article.id)
    }
  }
})

test('index keeps bilingual fallback and numeric chapter order', () => {
  const result = buildCurriculumIndex(Object.fromEntries([
    fixture('10-demo', '# Ten\n\nEnglish only.', 'en'),
    fixture('02-demo', '# 二'), fixture('02-demo', '# Two', 'en'),
    fixture('01-demo', '# 一'),
    ['./content/zh/README.md', '# Not a course'],
  ]))
  assert.deepEqual(result.map((item) => item.title), ['一', '二', 'Ten'])
  assert.deepEqual(result.map((item) => item.titleEn), ['一', 'Two', 'Ten'])
  assert.deepEqual(result.map((item) => item.availableLanguages), [['zh'], ['zh', 'en'], ['en']])
})

test('each of the 139+ courses loads exactly one body per requested language', async () => {
  const calls = []
  const load = createArticleLoader(Object.fromEntries(Object.entries(modules).map(([path, raw]) => [path, async () => { calls.push(path); return raw } ])))
  for (const article of index) {
    for (const requested of ['zh', 'en']) {
      calls.length = 0
      const result = await load(article, requested)
      const language = article.availableLanguages.includes(requested) ? requested : article.availableLanguages[0]
      const path = `./content/${language}/${article.sourcePath}`
      assert.deepEqual(calls, [path])
      assert.equal(result.language, language)
      const raw = modules[path]
      assert.equal(result.content, article.sourcePath.endsWith('.py')
        ? `# ${language === 'zh' ? article.title : article.titleEn}\n\n\`\`\`python\n${raw}\n\`\`\``
        : raw)
    }
  }
})

test('missing translation falls back, network failure does not silently change language and permits retry', async () => {
  const article = index.find((item) => item.availableLanguages.length === 2 && item.sourcePath.endsWith('.md'))
  let attempts = 0
  const load = createArticleLoader({
    [`./content/en/${article.sourcePath}`]: async () => { attempts++; if (attempts === 1) throw new Error('Offline'); return 'English body' },
    [`./content/zh/${article.sourcePath}`]: async () => { throw new Error('Should not request Chinese') },
  })
  await assert.rejects(load(article, 'en'), /Offline/)
  assert.equal((await load(article, 'en')).content, 'English body')
  assert.equal((await load({ ...article, availableLanguages: ['en'] }, 'zh')).language, 'en')
  await assert.rejects(createArticleLoader({})(article, 'zh'), /unavailable/)
})

test('independent loads do not share mutable article/language state', async () => {
  const article = index[0]
  let finishChinese
  const load = createArticleLoader({
    [`./content/zh/${article.sourcePath}`]: () => new Promise((resolve) => { finishChinese = resolve }),
    [`./content/en/${article.sourcePath}`]: async () => 'English',
  })
  const slow = load({ ...article, availableLanguages: ['zh', 'en'] }, 'zh')
  const fast = await load({ ...article, availableLanguages: ['zh', 'en'] }, 'en')
  assert.equal(fast.language, 'en')
  finishChinese('中文')
  assert.equal((await slow).language, 'zh')
  assert.equal(fast.language, 'en')
})

test('metadata search supports both languages, all tokens, paths and title ranking', () => {
  assert.equal(searchCurriculum(index, '  ').length, 0)
  assert.equal(searchCurriculum(index, 'not-a-real-lesson-xyz').length, 0)
  assert.ok(searchCurriculum(index, 'Qwen3.5').length > 0)
  assert.ok(searchCurriculum(index, '调度').length > 0)
  assert.ok(searchCurriculum(index, 'KV_Cache').length > 0)
  assert.ok(searchCurriculum(index, 'sglang-ascend-npu hybrid').some((item) => item.sourcePath.includes('01_qwen3_5') || item.slug.includes('qwen3-5')))
  const base = index[0]
  const candidates = [
    { ...base, id: 'summary', title: 'Demo', titleEn: 'Demo', summary: 'alpha beta', summaryEn: '', tags: [], sourcePath: 'demo.md' },
    { ...base, id: 'title', title: 'Alpha beta', titleEn: '', summary: '', summaryEn: '', tags: [], sourcePath: 'other.md' },
  ]
  assert.deepEqual(searchCurriculum(candidates, 'ＡＬＰＨＡ beta').map((item) => item.id), ['title', 'summary'])
  assert.equal(searchCurriculum(candidates, 'alpha gamma').length, 0)
})
