import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const modulePath = process.env.MODEL_QA_PLAYWRIGHT || 'playwright'
const { chromium } = require(modulePath), { expect } = require(`${modulePath}/test`)
const base = process.env.MODEL_QA_BASE || 'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const browser = await chromium.launch({ headless: true, ...(process.env.MODEL_QA_CHANNEL ? { channel: process.env.MODEL_QA_CHANNEL } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 960 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
  let release, intercepted
  const ready = new Promise(resolve => { intercepted = resolve })
  const held = new Promise(resolve => { release = resolve })
  const matcher = '**/01-decoder-only-transformer-*.js'
  const failBody = async route => { intercepted(); await held; await route.abort() }
  await page.route(matcher, failBody)
  await page.goto(`${base}#/article/ai-infra-basic--model-architecture--01-decoder-only-transformer`, { waitUntil: 'domcontentloaded' })
  await ready
  await expect(page.getByText('正在加载本篇正文…')).toBeVisible()
  release()
  await expect(page.getByRole('alert')).toContainText('正文暂时无法加载')
  await expect(page.getByRole('button', { name: '重试加载', exact: true })).toBeVisible()
  await page.unroute(matcher, failBody)
  // Reload is an explicit recovery path for cached dynamic-import failures.
  await page.getByRole('button', { name: '刷新页面', exact: true }).click()
  await expect(page.locator('[data-article-body]')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '相邻课程' })).toBeVisible()
  const adjacent = page.getByRole('navigation', { name: '相邻课程' }).getByRole('link').last()
  const destination = await adjacent.getAttribute('href')
  await adjacent.click()
  await expect.poll(() => new URL(page.url()).hash).toBe(destination)
  await expect(page.locator('[data-article-body]')).toBeVisible()

  // A denied clipboard reports a usable fallback, not an unhandled rejection.
  await page.goto(`${base}#/article/ai-infra-basic--attention-kernel--flash-attention-tutorial`)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('[data-article-body]')).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('test denied')) } }) })
  await page.getByRole('button', { name: '复制', exact: true }).first().click()
  await expect(page.getByRole('status').filter({ hasText: '无法访问剪贴板' })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedCode = value } } }) })
  await page.getByRole('button', { name: '复制', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
  assert.ok((await page.evaluate(() => window.__copiedCode)).includes('import'))

  // Archive chunk outage is explicit, offers retry and can recover on reload.
  const archiveMatcher = '**/2026-09-09-*.js'
  await page.route(archiveMatcher, route => route.abort())
  await page.goto(`${base}#/news?view=archive&date=2026-09-09`)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible()
  await page.unroute(archiveMatcher)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByLabel('选择归档日期')).toHaveValue('2026-09-09')
  await expect(page.locator('main article').first()).toBeVisible()
  assert.ok(requests.every(request => request.method === 'GET'), 'reader QA must not upload data')
  await context.close()
  console.log('Reader recovery passed: loading, failed chunk, recovery, adjacent article, clipboard denied/success, archive outage/recovery; no uploads.')
} finally { await browser.close() }
