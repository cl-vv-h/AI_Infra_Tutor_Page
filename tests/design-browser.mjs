import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Production-build QA; isolated contexts never use the user's browser data.
const require = createRequire(import.meta.url)
const modulePath = process.env.MODEL_QA_PLAYWRIGHT || 'playwright'
const { chromium } = require(modulePath), { expect } = require(`${modulePath}/test`)
const base = process.env.MODEL_QA_BASE || 'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const screenshots = process.env.MODEL_QA_SCREENSHOTS
if (screenshots) await mkdir(screenshots, { recursive: true })
const articles = JSON.parse(await readFile(new URL('../src/data/curriculum-index.json', import.meta.url), 'utf8'))
const article = articles.find(item => item.slug === 'ai-infra-basic--model-architecture--02-gqa-attention-shapes')
const browser = await chromium.launch({ headless: true, ...(process.env.MODEL_QA_CHANNEL ? { channel: process.env.MODEL_QA_CHANNEL } : {}) })
let checks = 0
try {
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    const fits = async label => {
      const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
      assert.ok(size.content <= size.viewport + 1, `${width}px ${label}: ${size.content}px content`)
      await expect(page.locator('main')).toHaveCount(1)
      await expect(page.locator('main h1:visible')).toHaveCount(1)
      checks++
    }
    const shot = async name => {
      if (screenshots) await page.screenshot({ path: join(screenshots, `design-${name}-${width}.png`), animations: 'disabled' })
    }
    const visit = async path => {
      await page.goto(`${base}#${path}`, { waitUntil: 'networkidle' })
      // Hash-only navigation can retain the prior route during a lazy React
      // transition. A fresh document makes route screenshots authoritative.
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator('main h1:visible')).toHaveCount(1)
      if (!path.includes('#')) await page.evaluate(() => scrollTo(0, 0))
    }
    for (const [path, name] of [
      ['/', 'home'], ['/learn', 'learn'], ['/category/inference-basics', 'category'],
      ['/category/sglang', 'sglang'], ['/category/sglang?sub=sglang-source-reading', 'sglang-track'],
      ['/knowledge-graph', 'graph'], ['/about', 'about'], ['/not-a-page', '404'],
      ['/article/missing', 'article-404'], ['/category/missing', 'category-404'],
      ['/models', 'catalog'], ['/models/knowledge', 'knowledge'], ['/models/knowledge/parallelism', 'knowledge-topic'],
      ['/models/compare', 'compare'], ['/models/glm-5-2?view=weights&tp=8&ep=4&pp=4&adp=4&precision=mixed', 'weights'],
      ['/models/glm-5-2?view=cache', 'cache'], ['/models/glm-5-2', 'diagram'],
      ['/models/glm-5-2/dpa', 'dpa'], ['/models/qwen3-8b/dpa', 'dpa-dense'],
      ['/models/deepseek-v4-1-flash', 'v41'], ['/operators', 'profiling'], ['/operators/estimate', 'estimate'],
      ['/news', 'news'], ['/news?view=library', 'longreads'], ['/news?view=releases', 'releases'],
      ['/news?view=archive', 'archive'], ['/news?view=saved', 'saved'],
    ]) {
      await visit(path)
      await fits(name)
      await shot(name)
    }

    // Main navigation, keyboard entry, expanded state, and focus return.
    await visit('/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '跳转到主要内容' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()
    if (width < 1024) {
      await page.getByRole('button', { name: '打开菜单', exact: true }).click()
      await expect(page.getByRole('button', { name: '关闭菜单', exact: true })).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: '打开菜单', exact: true })).toBeFocused()
      await page.getByRole('button', { name: '打开菜单', exact: true }).click()
      await page.locator('#mobile-navigation').getByRole('link', { name: 'AI Infra', exact: true }).click()
      await expect(page.locator('#mobile-navigation')).toHaveCount(0)
    } else await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: 'AI Infra', exact: true }).click()
    await expect(page).toHaveURL(/#\/learn$/)
    await expect(page.getByRole('heading', { level: 1, name: 'AI Infra，从概念到源码。', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)

    const categoryHrefs = await page.locator('main a[href*="#/category/"]').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href').slice(1)))])
    assert.ok(new Set(categoryHrefs.map(path => path.split('?')[0])).size >= 15, 'all topic categories must be traversed')
    for (const path of categoryHrefs) { await visit(path); await fits(path) }
    await visit('/knowledge-graph')
    await page.getByLabel('选择架构模块', { exact: true }).selectOption({ index: 1 })
    await expect(page.getByRole('region', { name: '架构模块详情', exact: true })).toBeVisible()
    await fits('graph selection')
    await shot('graph-selected')
    await page.getByRole('button', { name: '关闭架构模块详情', exact: true }).click()
    await expect(page.getByRole('region', { name: '架构模块详情', exact: true })).toHaveCount(0)
    const graphNode = page.getByRole('button', { name: /^查看模块 / }).first()
    await graphNode.focus()
    await page.keyboard.press('Enter')
    await expect(graphNode).toHaveAttribute('aria-pressed', 'true')
    await visit('/learn')

    // Search, pagination, empty state and refresh persistence.
    const search = page.getByLabel('搜索课程、概念或源码路径', { exact: true })
    await search.fill('Attention')
    await expect(page.getByRole('region', { name: '搜索课程' }).locator('li')).toHaveCount(12)
    await page.getByRole('button', { name: /继续显示/ }).click()
    await expect(page.getByRole('region', { name: '搜索课程' }).locator('li')).toHaveCount(24)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(search).toHaveValue('Attention')
    await search.fill('no-results-qa-fixture')
    await expect(page.getByText('没有匹配的课程，试试更短的关键词。')).toBeVisible()
    await page.getByRole('button', { name: '清除搜索', exact: true }).click()
    await expect(search).toHaveValue('')
    await fits('search states')

    // Reader preserves lazy content, language, source, anchors, TOC and code.
    await visit(`/article/${article.slug}`)
    await expect(page.locator('[data-article-body]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title)
    await expect(page.locator('[data-article-body]').getByRole('heading', { name: article.title, exact: true })).toHaveCount(0)
    const copyBox = await page.locator('[data-article-body]').getByRole('button', { name: '复制', exact: true }).first().boundingBox()
    assert.ok(copyBox.height >= 44, 'code copy must have a touch-sized target')
    await fits('article')
    await shot('article')
    const toc = page.locator('aside details')
    if (width < 1024) {
      await expect(toc).not.toHaveAttribute('open', '')
      await toc.locator('summary').click()
    } else await expect(toc).toHaveAttribute('open', '')
    await page.getByRole('navigation', { name: '本篇目录', exact: true }).getByRole('button').nth(1).click()
    assert.ok(await page.evaluate(() => /^H[2-4]$/.test(document.activeElement.tagName)))
    const anchor = await page.evaluate(() => document.activeElement.id)
    await visit(`/article/${article.slug}#${encodeURIComponent(anchor)}`)
    await expect.poll(() => page.evaluate(id => document.getElementById(id)?.getBoundingClientRect().top, anchor)).toBeLessThan(190)
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.titleEn)
    await expect(page.locator('[data-article-body]')).toBeVisible()
    await fits('English article')
    await page.getByRole('button', { name: '切换到中文', exact: true }).click()

    // Query-only changes never reset scroll (including first POP -> PUSH edit).
    await visit('/models/glm-5-2?view=weights&tp=8&ep=4&pp=4&adp=4')
    const control = page.getByLabel('独立 DP 副本', { exact: true })
    await control.scrollIntoViewIfNeeded()
    const before = await page.evaluate(() => scrollY)
    await control.selectOption('2')
    await expect(control).toHaveValue('2')
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) < 3, 'query update jumped the viewport')
    const updatedUrl = page.url()
    // Parameter edits replace the current history entry; workspace tabs push.
    // Going back from Cache must restore the edited Weights entry, not undo it.
    await page.getByRole('tab', { name: '缓存容量', exact: true }).click()
    await expect(page.getByRole('region', { name: '缓存核心计算', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(updatedUrl)
    await expect(control).toHaveValue('2')
    await page.goForward()
    await expect(page.getByRole('region', { name: '缓存核心计算', exact: true })).toBeVisible()

    // Bookmark persistence and import preview/merge; no original source opened.
    await visit('/news?view=library')
    await page.locator('summary').filter({ hasText: '信源与主题筛选' }).click()
    await page.getByLabel('具体信源', { exact: true }).selectOption({ index: 1 })
    await expect(page.getByLabel('具体信源', { exact: true })).not.toHaveValue('')
    const source = await page.getByLabel('具体信源', { exact: true }).inputValue()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('具体信源', { exact: true })).toHaveValue(source)
    await expect(page.getByLabel('具体信源', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '清除筛选', exact: true }).first().click()
    await expect(page.getByLabel('具体信源', { exact: true })).toHaveValue('')
    const first = page.locator('main article').first()
    const savedTitle = await first.locator('h3').innerText()
    await first.getByRole('button', { name: /^收藏：/ }).click()
    await page.getByRole('navigation', { name: '阅读视图' }).getByRole('button', { name: /^阅读清单/ }).click()
    await expect(page.locator('main article h3')).toHaveText([savedTitle])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('main article h3')).toHaveText([savedTitle])
    await expect(page.getByRole('button', { name: '复制筛选链接' })).toHaveCount(0)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出阅读清单' }).click()])
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
    assert.equal(exported.items.length, 1)
    await page.getByRole('button', { name: /^取消收藏：/ }).click()
    await page.locator('summary').filter({ hasText: '导入阅读清单' }).click()
    const upload = page.getByLabel('选择阅读清单 JSON 文件', { exact: true })
    await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('not-json') })
    await expect(page.getByRole('alert')).toBeVisible()
    await upload.setInputFiles({ name: 'reading-list.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) })
    await expect(page.getByText('待新增 1 条 · 重复 0 条 · 已有 0 条保留')).toBeVisible()
    await expect(page.locator('main article')).toHaveCount(0)
    await page.getByRole('button', { name: '确认合并 1 条', exact: true }).click()
    await expect(page.locator('main article h3')).toHaveText([savedTitle])
    await fits('reading-list import')
    await shot('saved-import')
    await visit('/news?view=library&q=no-results-qa-fixture')
    await expect(page.getByRole('heading', { name: '没有匹配的文章' })).toBeVisible()
    await page.getByRole('button', { name: '清除筛选', exact: true }).first().click()
    await expect(page.locator('main article').first()).toBeVisible()
    await page.getByRole('button', { name: '每周报告', exact: true }).click()
    await expect.poll(() => page.locator('#weekly').evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(200)
    await fits('weekly report')
    await shot('weekly')
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`Design browser passed at ${width}px: route families, navigation, search, reader, language, query scroll, news bookmarks/import/export.`)
  }
  console.log(`Design checks: ${checks}`)
} finally { await browser.close() }
