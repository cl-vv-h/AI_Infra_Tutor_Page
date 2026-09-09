import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

// Static markup and route-state smoke tests; no browser or visual QA.
process.env.NODE_ENV = 'production'
const { createElement: h } = await import('react')
const { renderToString } = await import('react-dom/server')
const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true }, ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module', 'module-sync', 'import'] } } })
try {
  const { MemoryRouter } = await server.ssrLoadModule('react-router-dom')
  const { default: News } = await server.ssrLoadModule('/src/pages/News.tsx')
  const { default: NewsSourceStatus } = await server.ssrLoadModule('/src/components/NewsSourceStatus.tsx')
  const { default: NewsLearningTrail } = await server.ssrLoadModule('/src/components/NewsLearningTrail.tsx')
  const { learningForNews } = await server.ssrLoadModule('/src/lib/news-learning.ts')
  const { newsLearningConcepts } = await server.ssrLoadModule('/src/data/news-learning.ts')
  const { filterNews, parseNewsParams } = await server.ssrLoadModule('/src/lib/news-reader.ts')
  const { newsTopics, topicsForItem } = await server.ssrLoadModule('/src/lib/news-topics.mjs')
  const { newsStudyGuides } = await server.ssrLoadModule('/src/data/news-study-guides.ts')
  const library = JSON.parse(await readFile(new URL('../src/data/news/library.json', import.meta.url), 'utf8'))
  const releases = JSON.parse(await readFile(new URL('../src/data/news/releases.json', import.meta.url), 'utf8'))
  const render = (query = '') => renderToString(h(MemoryRouter, { initialEntries: [`/news${query}`] }, h(News))).replace(/<!--.*?-->/g, '')
  const home = render()
  assert.ok(home.includes('复制筛选链接') && home.includes('具体信源'))
  assert.ok(home.includes('专题入口'))
  const trail = (item) => renderToString(h(MemoryRouter, {}, h(NewsLearningTrail, { item }))).replace(/<!--.*?-->/g, '')
  assert.equal(trail({ title: 'A central bank announcement', summary: '' }), '')
  const learning = trail({ title: 'FP8 and KV-cache', summary: 'DeepSeek MoE inference' })
  for (const text of ['学习线索 · 3 个概念', '标题匹配词', '摘要匹配词', '未读取全文或核查结论', '教学示例', '背景课', '官方说明']) assert.ok(learning.includes(text), text)
  assert.doesNotMatch(learning, /<details[^>]* open/)
  assert.match(learning, /href="\/models\/deepseek-v3\?layer=3&amp;node=moe"/)
  assert.match(trail({ title: '<script>alert(1)</script> FP8', summary: '' }), /&lt;script&gt;/)
  assert.doesNotMatch(trail({ title: '<script>alert(1)</script> FP8', summary: '' }), /<script>/)
  for (const concept of newsLearningConcepts) {
    const html = trail({ title: concept.terms[0], summary: '' })
    assert.ok(html.includes(`href="${concept.lesson.to}"`), concept.id)
    if (concept.example) assert.ok(html.includes(`href="${concept.example.to.replaceAll('&', '&amp;')}"`), concept.id)
    assert.match(html, /不代表原文使用该模型/)
  }
  const status = (source) => renderToString(h(NewsSourceStatus, { source })).replace(/<!--.*?-->/g, '')
  assert.match(status({ state: 'ok' }), /订阅正常/)
  const recovered = status({ state: 'ok', channel: 'github-api', feedFailure: { state: 'unavailable', httpStatus: 404 } })
  assert.match(recovered, /备用通道可用/)
  assert.match(recovered, /HTTP 404/)
  assert.doesNotMatch(recovered, /订阅正常/)
  const limited = status({ state: 'unavailable', channel: 'github-api', httpStatus: 429, feedFailure: { state: 'invalid' } })
  assert.match(limited, /暂不可用 · HTTP 429/)
  assert.match(limited, /Atom 格式异常/)
  assert.doesNotMatch(limited, /备用通道可用|订阅正常/)
  for (const topic of newsTopics) {
    const params = new URLSearchParams({ view: 'library', topic: topic.id })
    const html = render(`?${params}`)
    const state = parseNewsParams(params, [], newsTopics.map((entry) => entry.id)).state
    const expected = filterNews(library.items, state, topicsForItem)
    assert.ok(html.includes(newsStudyGuides[topic.id].title), topic.id)
    assert.equal((html.match(/<article /g) ?? []).length, expected.length, topic.id)
    assert.equal((html.match(/aria-label="学习线索：/g) ?? []).length, expected.filter((item) => learningForNews(item).length).length, topic.id)
    for (const link of newsStudyGuides[topic.id].links) assert.ok(html.includes(`href="${link.to}"`), link.to)
    assert.doesNotMatch(html, /NaN|undefined/)
  }
  for (const source of new Set(library.items.map((item) => item.source))) {
    const html = render(`?${new URLSearchParams({ view: 'library', source })}`)
    assert.equal((html.match(/<article /g) ?? []).length, library.items.filter((item) => item.source === source).length, source)
  }
  const saved = render('?view=saved')
  for (const source of ['', ...releases.sources.map((entry) => entry.name)]) {
    for (const stage of ['all', 'stable', 'prerelease']) {
      const html = render(`?${new URLSearchParams({ view: 'releases', source, stage })}`)
      const expected = releases.items.filter((item) => (!source || item.source === source) && (stage === 'all' || item.releaseStage === stage))
      assert.equal((html.match(/<article /g) ?? []).length, expected.length, `${source}:${stage}`)
      assert.match(html, /框架发布追踪/)
      assert.match(html, /不是完整版本历史/)
      assert.equal((html.match(/官方全部版本<svg/g) ?? []).length, releases.sources.length)
      if (expected.length) assert.match(html, /官方发布时间/)
      // Release prose can legitimately discuss "NaN outputs"; only reject broken UI values.
      assert.doesNotMatch(html, />NaN<|>undefined<|Invalid Date/)
      for (const item of expected) assert.ok(html.includes(`href="${item.url.replaceAll('&', '&amp;')}"`), item.url)
    }
  }
  const { default: NewsReleaseDesk } = await server.ssrLoadModule('/src/components/NewsReleaseDesk.tsx')
  const failedDesk = renderToString(h(NewsReleaseDesk, { data: { ...releases, sources: [{ name: 'Test', repository: 'org/repo', url: 'https://github.com/org/repo/releases', state: 'unavailable', httpStatus: 429, lastSuccessAt: null, count: 0 }], items: [] }, stage: 'all', onSource() {}, onStage() {} })).replace(/<!--.*?-->/g, '')
  assert.match(failedDesk, /本次读取失败 · HTTP 429/)
  assert.match(failedDesk, /尚未成功/)
  assert.doesNotMatch(failedDesk, /官方接口可用/)
  assert.ok(saved.includes('阅读清单仅在本机可见'))
  assert.ok(!saved.includes('复制筛选链接'))
  assert.ok(saved.includes('收藏文章，留给稍后的自己。'))
  const unknown = render('?view=library&source=removed-source')
  assert.ok(unknown.includes('removed-source (0)') && unknown.includes('没有匹配的文章'))
  const unsafe = render('?view=library&topic=%3Cscript%3E&q=%3Cscript%3Ealert(1)%3C/script%3E')
  assert.ok(unsafe.includes('topic 筛选无效'))
  assert.ok(!unsafe.includes('<script>'))
  assert.ok(unsafe.includes('&lt;script&gt;'))
  console.log(`News render tests passed: six topics, ${new Set(library.items.map((item) => item.source)).size} source filters, 21 release source/stage routes, eight learning concepts, outage/empty/saved/unsafe routes.`)
} finally { await server.close() }
