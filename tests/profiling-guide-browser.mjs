import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { profileBundleFixture } from './profile-bundle-fixture.mjs'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const fixture=profileBundleFixture().map(f=>({name:f.name,mimeType:f.name.endsWith('.json')?'application/json':'text/csv',buffer:Buffer.from(f.text)}))
try{
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),requests=[],errors=[]
    page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
    page.on('pageerror',e=>errors.push(e.message))
    await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort())
    await page.goto(`${base}#/operators`,{waitUntil:'networkidle'})
    const entry=page.getByRole('link',{name:'阅读教程：如何看懂 Profiling'})
    assert.ok(!requests.some(r=>/\/ProfilingGuide-[^/]+\.js/.test(r.url)),'guide must not load before navigation')
    await page.getByLabel('导入基线 A',{exact:true}).setInputFiles(fixture)
    await expect(page.getByLabel('任务完整性',{exact:true}).locator('output')).toHaveText(['34','31','2','1'])
    await entry.click()
    await expect(page.getByRole('heading',{name:'如何看懂 Profiling',exact:true})).toBeVisible()
    const article=page.getByRole('article',{name:'Profiling 阅读教程'}),toc=page.getByRole('navigation',{name:'本篇目录'})
    await expect(page.getByRole('heading',{name:'Profiling 分析工作台',exact:true})).not.toBeVisible()
    assert.ok(!(await article.innerText()).includes('**'),'Markdown emphasis must not leak as raw delimiters')
    if(process.env.MODEL_QA_SCREENSHOTS)await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`guide-top-${width}.png`)})
    if(width<1024){
      await expect(toc).not.toBeVisible()
      const summary=page.locator('aside summary')
      await summary.focus();await page.keyboard.press('Enter')
    }
    await expect(toc).toBeVisible()
    const target=toc.getByRole('button',{name:'04 · Notify、Event：到底在等什么',exact:true})
    await target.focus();await page.keyboard.press('Enter')
    const heading=article.getByRole('heading',{name:'04 · Notify、Event：到底在等什么',exact:true})
    await expect(heading).toBeFocused()
    assert.ok((await heading.boundingBox()).y>=60,'anchor is not hidden behind navbar')
    await expect(target).toHaveAttribute('aria-current','location')
    if(process.env.MODEL_QA_SCREENSHOTS)await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`guide-notify-${width}.png`)})
    // Inspect overflow at every section, not only at the top of a long page.
    for(const h of await article.locator('h2').all()){
      await h.scrollIntoViewIfNeeded()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`page overflow ${width}`)
    }
    const quiz=article.locator('details').first(),question=quiz.locator('summary')
    assert.ok((await question.boundingBox()).height>=44)
    await question.focus();await page.keyboard.press('Enter')
    await expect(quiz).toHaveAttribute('open','')
    await expect(quiz).toContainText('对端尚未到达')
    await page.keyboard.press('Enter');await expect(quiz).not.toHaveAttribute('open','')
    // HashRouter deep section links, back/forward and in-memory analysis retention.
    const anchor=await heading.getAttribute('id')
    await page.goBack()
    await expect(page.getByLabel('任务完整性',{exact:true}).locator('output')).toHaveText(['34','31','2','1'])
    await page.goForward();await expect(article).toBeVisible()
    await page.getByRole('link',{name:'返回 Profiling 工作台',exact:true}).click()
    await expect(page.getByLabel('任务完整性',{exact:true}).locator('output')).toHaveText(['34','31','2','1'])
    await page.goto(`${base}#/operators/guide#${encodeURIComponent(anchor)}`)
    await page.reload({waitUntil:'networkidle'})
    await expect(heading).toBeVisible()
    await expect.poll(async()=>Math.round((await heading.boundingBox()).y)).toBeGreaterThanOrEqual(60)
    assert.ok((await heading.boundingBox()).y<250,'deep link restored after lazy reader and TOC render')
    await page.getByRole('link',{name:'返回 Profiling 工作台',exact:true}).click()
    await expect(page.getByLabel('任务完整性',{exact:true})).toHaveCount(0)
    assert.ok(requests.every(r=>r.method==='GET'&&new URL(r.url).origin===new URL(base).origin),'no uploaded data or third-party requests')
    assert.deepEqual(errors,[])
    await context.close()
    console.log(`Guide ${width}px: reader, keyboard TOC/quiz, layout, deep link, back/refresh and local state passed.`)
  }

  // A failed lazy chunk must leave the workbench and its local workers recoverable.
  const context=await browser.newContext({viewport:{width:390,height:960}}),page=await context.newPage()
  await page.goto(`${base}#/operators`,{waitUntil:'networkidle'})
  await page.getByLabel('导入基线 A',{exact:true}).setInputFiles(fixture)
  await expect(page.getByLabel('任务完整性',{exact:true}).locator('output')).toHaveText(['34','31','2','1'])
  let release,intercepted
  const ready=new Promise(resolve=>{intercepted=resolve}),held=new Promise(resolve=>{release=resolve})
  const matcher='**/ProfilingGuide-*.js'
  await page.route(matcher,async route=>{intercepted();await held;await route.abort()})
  await page.getByRole('link',{name:'阅读教程：如何看懂 Profiling'}).click()
  await ready
  await expect(page.getByRole('status')).toContainText('正在加载 Profiling 阅读教程')
  release()
  await expect(page.getByRole('alert')).toContainText('教程暂时无法加载')
  await page.getByRole('link',{name:'返回 Profiling 工作台',exact:true}).click()
  await expect(page.getByLabel('任务完整性',{exact:true}).locator('output')).toHaveText(['34','31','2','1'])
  await page.getByRole('link',{name:'阅读教程：如何看懂 Profiling'}).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.unroute(matcher)
  await page.getByRole('button',{name:'刷新并重新加载教程',exact:true}).click()
  await expect(page.getByRole('article',{name:'Profiling 阅读教程'})).toBeVisible()
  await context.close()
  console.log('Guide loading/failure/reload recovery passed; failed lesson does not destroy imported analysis.')
}finally{await browser.close()}
