import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const modulePath = process.env.MODEL_QA_PLAYWRIGHT || 'playwright'
const { chromium } = require(modulePath), { expect } = require(`${modulePath}/test`)
const base = process.env.MODEL_QA_BASE || 'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const articles = JSON.parse(await readFile(new URL('../src/data/curriculum-index.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ headless: true, ...(process.env.MODEL_QA_CHANNEL ? { channel: process.env.MODEL_QA_CHANNEL } : {}) })
const failures = []
try {
  for (const language of ['zh', 'en']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 960 }, reducedMotion: 'reduce' })
    await context.addInitScript(language => localStorage.setItem('site-language', language), language)
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    const page = await context.newPage()
    let index = 0
    for (const article of articles) {
      // Changing the outer query forces document navigation, avoiding a stale
      // prior article during a lazy hash-route transition.
      await page.goto(`${base}?reader-qa=${index}#/article/${article.slug}`, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-article-body]')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(language === 'zh' ? article.title : article.titleEn)
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      if (width > 391) {
        const overflow = await page.locator('[data-article-body] *').evaluateAll(elements => elements.filter(element => {
          const r = element.getBoundingClientRect()
          return r.width > 390 && !element.closest('pre, [role="region"], .mermaid-diagram')
        }).slice(0, 5).map(element => ({ tag: element.tagName, text: element.textContent.slice(0, 80) })))
        failures.push({ language, slug: article.slug, width, overflow })
      }
      if (!article.availableLanguages.includes(language)) await expect(page.getByText(language === 'zh' ? '暂无中文译文，显示原文' : 'English unavailable; showing the available version')).toBeVisible()
      index++
      if (index % 25 === 0) console.log(`Curriculum ${language}: ${index}/${articles.length} checked`)
    }
    await context.close()
  }
  console.log(JSON.stringify(failures, null, 2))
  assert.deepEqual(failures, [], 'article reading layout overflow')
  console.log(`Curriculum browser passed: ${articles.length * 2} bilingual reader routes, lazy bodies, title/fallback and mobile layout.`)
} finally { await browser.close() }
