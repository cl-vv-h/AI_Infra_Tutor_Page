import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// Optional real-browser regression. Supply an installed Playwright module/channel
// through environment variables; no machine paths or browser profiles are committed.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.MODEL_QA_PLAYWRIGHT || 'playwright')
const { expect } = require(`${process.env.MODEL_QA_PLAYWRIGHT || 'playwright'}/test`)
const base = process.env.MODEL_QA_BASE || 'http://127.0.0.1:4175/AI_Infra_Tutor_Page/'
const browser = await chromium.launch({ headless: true, ...(process.env.MODEL_QA_CHANNEL ? { channel: process.env.MODEL_QA_CHANNEL } : {}) })
let checks = 0
try {
  for (const width of [360, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: 'reduce' })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    async function fits(label) {
      const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
      assert.ok(size.content <= size.viewport + 1, `${width}px ${label}: content width ${size.content}`)
      checks++
    }
    await page.goto(`${base}#/models/deepseek-v4-flash?layer=2&node=csa&b=1&s=4096&tp=4`, { waitUntil: 'networkidle' })
    await page.locator('#model-node-csa').waitFor()
    await fits('diagram')
    await page.getByText('逐步导览 · 先预测，再看 Shape', { exact: true }).click()
    await page.getByRole('button', { name: '查看本步讲解', exact: true }).click()
    await expect(page.locator('#learning-answer')).toBeVisible()
    await page.getByRole('button', { name: '下一步', exact: true }).click()
    await page.locator('#learning-answer').waitFor({ state: 'hidden' })
    await expect(page).toHaveURL(/node=csa-cache/)
    assert.ok(!await page.locator('#learning-answer').isVisible(), 'new learning step hides the previous answer')
    await fits('expanded guide')
    await page.getByText('逐步导览 · 先预测，再看 Shape', { exact: true }).click()
    await page.locator('#model-node-hc-attn-pre').click()
    if (width < 1280) {
      await expect(page.getByRole('dialog', { name: '模块详情' })).toBeVisible()
      await fits('inspector dialog')
      await page.getByRole('button', { name: '关闭模块详情' }).click()
      await expect(page.locator('#model-node-hc-attn-pre')).toBeFocused()
    }
    await page.locator('#workspace-tab-cache').click()
    await page.locator('#workspace-panel-cache').waitFor({ state: 'visible' })
    const cache = page.getByRole('region', { name: '压缩注意力缓存实验' })
    await expect(cache).toContainText('43.89 MiB')
    await fits('cache')
    await page.getByRole('button', { name: 'prefill', exact: true }).click()
    await expect(cache.getByText('Prefill 最后 query 读取压缩条数', { exact: true })).toBeVisible()
    await page.getByLabel('每请求序列 token 数', { exact: true }).selectOption('2047')
    const history = cache.getByRole('heading', { name: '本层完整压缩历史', exact: true }).locator('..')
    await expect(history).toContainText('511 条')
    await page.getByLabel('每请求序列 token 数', { exact: true }).selectOption('2048')
    await expect(history).toContainText('512 条')
    await page.getByLabel('KV 缓存精度', { exact: true }).selectOption('1')
    await expect(page).toHaveURL(/bytes=1/)
    await page.getByRole('button', { name: 'TP 8', exact: true }).click()
    await expect(page.getByRole('button', { name: 'TP 8', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/tp=8/)
    await page.locator('#workspace-tab-cache').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#workspace-panel-weights')).toBeVisible()
    await expect(page).toHaveURL(/view=weights/)
    await fits('weights')
    await page.keyboard.press('Home')
    await expect(page.locator('#workspace-panel-diagram')).toBeVisible()
    await page.getByText('展开完整层分布', { exact: true }).click()
    await page.getByRole('button', { name: 'Layer 3 · SWA + HCA · MoE', exact: true }).click()
    await expect(page.locator('#model-node-hca')).toBeVisible()
    await expect(page.locator('#model-node-csa')).toHaveCount(0)
    await expect(page).toHaveURL(/layer=3/)
    const restored = new URLSearchParams(new URL(page.url()).hash.split('?')[1])
    for (const [key, value] of Object.entries({ phase: 'prefill', tp: '8', b: '1', s: '2048', bytes: '1' })) assert.equal(restored.get(key), value, `${key} survives workspace and layer changes`)
    if (process.env.MODEL_QA_SCREENSHOTS) {
      await page.locator('[aria-label="mHC Attention 子层"]').screenshot({ path: join(process.env.MODEL_QA_SCREENSHOTS, `mhc-${width}.png`) })
      await page.locator('#workspace-tab-cache').click()
      await cache.screenshot({ path: join(process.env.MODEL_QA_SCREENSHOTS, `cache-${width}.png`) })
    }
    assert.deepEqual(errors, [], `${width}px runtime errors`)
    await page.close()
    console.log(`Browser interactions passed at ${width}px: guide, dialog, focus, tabs, cache boundaries, phase and layer switching.`)
  }
  console.log(`${checks} viewport overflow checks passed. Browser: ${browser.version()}. No GPU inference tested.`)
} finally {
  await browser.close()
}
