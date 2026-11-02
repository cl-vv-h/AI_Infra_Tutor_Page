import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const enabled=JSON.parse(await readFile(new URL('../config/curriculum-guide.json',import.meta.url))).enabled
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4193/AI_Infra_Tutor_Page/'
const browser=await chromium.launch({...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:process.env.CI?{}:{channel:'chrome'})})
try{
  if(!enabled){const page=await browser.newPage();await page.goto(base+'#/learn');await expect(page.locator('h1')).toHaveText('AI Infra，从概念到源码。');console.log('Learning guide disabled: legacy entrance passed.')}
  else {
  const context=await browser.newContext({reducedMotion:'reduce'})
  await context.addInitScript(()=>localStorage.setItem('curriculum-qa-sentinel','preserve'))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:1000})
    for(const route of ['/learn','/learn/domains/runtime','/learn/topics/cache','/learn/topics/attention-dp','/learn/paths/ascend-kernels']){
      await page.goto(base+'#'+route);await expect(page.locator('h1')).toBeVisible()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route}: overflow ${width}`)
    }
  }
  await page.goto(base+'#/learn');await page.getByRole('link',{name:'KV Cache 学习专题 →',exact:true}).click()
  await expect(page.locator('h1')).toHaveText('KV Pool、分页、Prefix Cache 与 HiCache')
  await page.reload();await expect(page.locator('h1')).toHaveText('KV Pool、分页、Prefix Cache 与 HiCache')
  await page.getByRole('link',{name:'KV Cache Memory',exact:true}).click()
  await expect(page.locator('[data-article-body]')).toBeVisible()
  await expect(page.getByRole('region',{name:'主题学习导航'})).toBeVisible()
  await page.goBack();await expect(page.locator('h1')).toHaveText('KV Pool、分页、Prefix Cache 与 HiCache')
  await page.goto(base+'#/learn/topics/attention-dp')
  const demo=page.getByRole('link',{name:'DP Attention 布局与去重实验',exact:true});await expect(demo).toBeVisible()
  await demo.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-article-body]')).toBeVisible()
  await page.goto(base+'#/learn/topics/no-such-topic');await expect(page.locator('h1')).toHaveText('未找到课程入口')
  assert.equal(await page.evaluate(()=>localStorage.getItem('curriculum-qa-sentinel')),'preserve')
  await page.goto(base+'#/learn');await page.screenshot({path:'/tmp/learning-guide-desktop.png',fullPage:true})
  // A failed lazy guide chunk exposes reload and an old-category escape route.
  const failed=await context.newPage();await failed.route('**/LearningGuide-*.js',r=>r.abort())
  await failed.goto(base+'#/learn');await expect(failed.getByRole('alert')).toContainText('课程目录暂时无法加载')
  await failed.unroute('**/LearningGuide-*.js');await failed.getByRole('button',{name:'重新加载课程'}).click()
  await expect(failed.getByRole('heading',{name:'按目标学习',exact:true})).toBeVisible()
  assert.deepEqual(errors,[])
  console.log('Guide browser passed: 4 widths, routes, reader, keyboard, back/reload, missing route, lazy failure recovery and storage preservation.')
  }
}finally{await browser.close()}
