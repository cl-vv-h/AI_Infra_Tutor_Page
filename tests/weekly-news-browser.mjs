import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const entries=JSON.parse(await readFile(new URL('../src/data/news/weekly/index.json',import.meta.url),'utf8'))
const latest=entries[0],oldest=entries.at(-1)
const radarEnabled=JSON.parse(await readFile(new URL('../config/news-sphere.json',import.meta.url),'utf8')).enabled
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
try{
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),requests=[],errors=[]
    page.setDefaultTimeout(20000)
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message))
    await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort())
    await page.goto(`${base}#/news`,{waitUntil:'networkidle'})
    await expect(page.getByRole('region',{name:'内容更新状态'})).toBeVisible()
    await page.getByRole('link',{name:'查看周报与历史 →',exact:true}).click()
    const body=page.getByRole('article',{name:'周报正文'})
    await expect(body).toBeVisible()
    await expect(body).toContainText(latest.periodEnd)
    await expect(page.getByLabel('选择周报')).toHaveValue(latest.periodEnd)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    if(process.env.MODEL_QA_SCREENSHOTS){await mkdir(process.env.MODEL_QA_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`weekly-${width}.png`)})}
    await page.getByLabel('选择周报').selectOption(oldest.periodEnd)
    await expect(body).toContainText(oldest.periodEnd)
    await expect(page).toHaveURL(new RegExp(`/news/weekly/${oldest.periodEnd}$`))
    if(!oldest.archiveDates)await expect(body).toContainText('未通过新版完整周与双向引用校验')
    const sources=body.locator('details');await sources.locator('summary').focus();await page.keyboard.press('Enter')
    await expect(sources.locator('li')).toHaveCount(oldest.itemCount)
    const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'下载 Markdown'}).click()
    const download=await downloading
    assert.equal(download.suggestedFilename(),`weekly-${oldest.periodEnd}.md`)
    assert.ok((await readFile(await download.path(),'utf8')).startsWith('# 本周信号'))
    await page.reload({waitUntil:'networkidle'});await expect(body).toContainText(oldest.periodEnd)
    await page.goto(`${base}#/news/weekly/2099-01-01`)
    await expect(page.getByRole('alert')).toContainText('该期周报不存在')
    await expect(body).toHaveCount(0)
    await page.goBack();await expect(body).toBeVisible()
    await page.getByRole('link',{name:'← 返回新闻雷达',exact:true}).click()
    await expect(page.getByRole('heading',{name:radarEnabled?/世界的脉动/:'发现技术，读懂进展。'})).toBeVisible()
    assert.ok(requests.every(r=>r.method==='GET'&&new URL(r.url).origin===new URL(base).origin))
    assert.deepEqual(errors,[])
    await context.close();console.log(`Weekly ${width}px: status, history, citations, download, missing period, back/refresh and privacy passed.`)
  }
  const context=await browser.newContext({viewport:{width:390,height:1000}}),page=await context.newPage()
  let release,hit
  const ready=new Promise(r=>{hit=r}),held=new Promise(r=>{release=r})
  const matcher=`**/${oldest.periodEnd}-*.js`
  await page.route(matcher,async r=>{hit();await held;await r.abort()})
  await page.goto(`${base}#/news/weekly/${oldest.periodEnd}`,{waitUntil:'domcontentloaded'})
  await ready;await expect(page.getByRole('status')).toContainText('正在读取周报')
  release();await expect(page.getByRole('alert')).toContainText('周报正文加载失败')
  await page.unroute(matcher)
  await page.getByRole('button',{name:'刷新页面',exact:true}).click()
  await expect(page.getByRole('article',{name:'周报正文'})).toBeVisible()
  await context.close();console.log('Weekly delayed/failed body and reload recovery passed.')
}finally{await browser.close()}
