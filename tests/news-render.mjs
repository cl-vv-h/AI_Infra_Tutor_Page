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
  const { filterNews, parseNewsParams } = await server.ssrLoadModule('/src/lib/news-reader.ts')
  const { newsTopics, topicsForItem } = await server.ssrLoadModule('/src/lib/news-topics.mjs')
  const { newsStudyGuides } = await server.ssrLoadModule('/src/data/news-study-guides.ts')
  const library = JSON.parse(await readFile(new URL('../src/data/news/library.json', import.meta.url), 'utf8'))
  const render = (query = '') => renderToString(h(MemoryRouter, { initialEntries: [`/news${query}`] }, h(News))).replace(/<!--.*?-->/g, '')
  const home = render()
  assert.ok(home.includes('复制筛选链接') && home.includes('具体信源'))
  assert.ok(home.includes('专题入口'))
  for (const topic of newsTopics) {
    const params = new URLSearchParams({ view: 'library', topic: topic.id })
    const html = render(`?${params}`)
    const state = parseNewsParams(params, [], newsTopics.map((entry) => entry.id)).state
    const expected = filterNews(library.items, state, topicsForItem)
    assert.ok(html.includes(newsStudyGuides[topic.id].title), topic.id)
    assert.equal((html.match(/<article /g) ?? []).length, expected.length, topic.id)
    for (const link of newsStudyGuides[topic.id].links) assert.ok(html.includes(`href="${link.to}"`), link.to)
    assert.doesNotMatch(html, /NaN|undefined/)
  }
  for (const source of new Set(library.items.map((item) => item.source))) {
    const html = render(`?${new URLSearchParams({ view: 'library', source })}`)
    assert.equal((html.match(/<article /g) ?? []).length, library.items.filter((item) => item.source === source).length, source)
  }
  const saved = render('?view=saved')
  assert.ok(saved.includes('阅读清单仅在本机可见'))
  assert.ok(!saved.includes('复制筛选链接'))
  assert.ok(saved.includes('收藏文章，留给稍后的自己。'))
  const unknown = render('?view=library&source=removed-source')
  assert.ok(unknown.includes('removed-source (0)') && unknown.includes('没有匹配的文章'))
  const unsafe = render('?view=library&topic=%3Cscript%3E&q=%3Cscript%3Ealert(1)%3C/script%3E')
  assert.ok(unsafe.includes('topic 筛选无效'))
  assert.ok(!unsafe.includes('<script>'))
  assert.ok(unsafe.includes('&lt;script&gt;'))
  console.log(`News render tests passed: six topics, ${new Set(library.items.map((item) => item.source)).size} source filters, empty/saved/unsafe routes.`)
} finally { await server.close() }
