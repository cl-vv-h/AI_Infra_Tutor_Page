import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildHotspots, windowReports } from '../src/lib/news-hotspots.mjs'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4195/AI_Infra_Tutor_Page/'
const route=`${base}#/news/events`,key='ai-infra-hotspot-follows-v1'
const corpus=JSON.parse(await readFile(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8'))
const activeTopics=buildHotspots(corpus,72).filter(row=>row.kind==='topic')
const topicA=activeTopics[0],topicB=activeTopics[1]
const region=windowReports(corpus.items,corpus.generatedAt,72)[0]?.country
const screenshots=process.env.MODEL_QA_SCREENSHOTS
if(screenshots)await mkdir(screenshots,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const overflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'viewport overflow')
try{
  const enabled=JSON.parse(await readFile(new URL('../config/news-hotspots.json',import.meta.url),'utf8')).enabled
  if(!enabled){
    const page=await browser.newPage();await page.goto(route)
    await expect(page.getByRole('heading',{name:'把新闻连成脉络',exact:true})).toBeVisible()
    await expect(page.getByRole('heading',{name:'热点在哪里，进展到哪了'})).toHaveCount(0)
    console.log('Hotspots disabled build: reviewed reader remains available')
  }else{
  assert(topicA&&topicB&&region,'need two current tracked subjects and at least one source region')
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],outgoing=[]
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||new URL(r.url()).origin!==new URL(base).origin)outgoing.push(r.url())})
    await page.goto(route)
    await expect(page.getByRole('heading',{name:'热点在哪里，进展到哪了'})).toBeVisible()
    await expect(page.getByLabel('排序方式')).toHaveValue('heat')
    const scores=(await page.getByTestId('hotspot-row').getByLabel(/^活跃度 /).allTextContents()).map(s=>Number(s.replace('活跃度 ','')))
    assert(scores.length>4);assert.deepEqual(scores,[...scores].sort((a,b)=>b-a))
    await overflow(page)
    if(screenshots)await page.screenshot({path:join(screenshots,`hotspots-initial-${width}.png`),fullPage:false})
    if(width<1024)await page.getByRole('button',{name:'查看热点分布'}).click()
    await expect(page.getByRole('heading',{name:'板块分布',exact:true})).toBeVisible()
    await page.getByLabel('筛选来源地区').selectOption(region)
    assert.equal(new URLSearchParams(page.url().split('?')[1]).get('country'),region)
    await page.reload();await expect(page.getByLabel('筛选来源地区')).toHaveValue(region)
    if(width<1024)await page.getByRole('button',{name:'查看热点分布'}).click()
    await page.getByLabel('筛选来源地区').selectOption('')
    await page.getByText('近 7 日板块热力分布',{exact:true}).click()
    await expect(page.getByRole('region',{name:'七日板块热力表'})).toBeVisible();await overflow(page)
    if(screenshots)await page.screenshot({path:join(screenshots,`hotspots-distribution-${width}.png`),fullPage:true})
    await page.getByLabel('统计窗口').selectOption('168');await page.getByLabel('排序方式').selectOption('sources')
    await expect(page).toHaveURL(/hours=168/);await expect(page).toHaveURL(/sort=sources/)
    await page.getByLabel('搜索热点').fill('no-such-hotspot-zzyy');await expect(page.getByText(/没有匹配热点/)).toBeVisible()
    await page.getByRole('button',{name:'清除榜单筛选'}).click()
    await page.getByLabel('搜索热点').fill(topicA.title);await page.getByTestId('hotspot-row').getByRole('button',{name:topicA.title,exact:true}).focus();await page.keyboard.press('Enter')
    await expect(page.getByRole('heading',{name:topicA.title,exact:true})).toBeVisible();assert.equal(new URLSearchParams(page.url().split('?')[1]).get('hotspot'),topicA.id)
    await page.getByRole('button',{name:'关注主题',exact:true}).click();await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
    await page.reload();await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
    await expect(page.getByRole('list',{name:'热点报道时间线'}).getByRole('link').first()).toHaveAttribute('href',/^https:\/\//)
    if(screenshots)await page.screenshot({path:join(screenshots,`hotspots-detail-${width}.png`),fullPage:true})
    await overflow(page)
    await page.getByRole('button',{name:'返回热点榜'}).click();await expect(page.getByLabel('搜索热点')).toHaveValue(topicA.title)
    await page.getByRole('button',{name:/只看关注/}).click();await expect(page.getByTestId('hotspot-row')).toHaveCount(1)
    await page.getByTestId('hotspot-row').getByRole('button').click();await page.goBack();await expect(page.getByTestId('hotspot-row')).toHaveCount(1)
    assert.deepEqual(errors,[]);assert.deepEqual(outgoing,[])
    await context.close();console.log(`Hotspots ${width}px: heat sorting, filters, distribution, keyboard, follow, refresh/back and privacy passed`)
  }
  const context=await browser.newContext(),a=await context.newPage(),b=await context.newPage()
  for(const page of [a,b]){page.setDefaultTimeout(15000);await page.goto(`${route}?hotspot=${topicA.id}`)}
  await a.getByRole('button',{name:'关注主题',exact:true}).click();await expect(b.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
  await b.goto(`${route}?hotspot=${topicB.id}`)
  await b.getByRole('button',{name:'关注主题',exact:true}).click()
  await expect.poll(async()=>JSON.parse(await a.evaluate(k=>localStorage.getItem(k),key)).entries.length).toBe(2)
  await b.evaluate(k=>{const data=JSON.parse(localStorage.getItem(k));data.entries[0].seenThrough='2020-01-01T00:00:00.000Z';localStorage.setItem(k,JSON.stringify(data))},key)
  await expect(a.getByText(/上次已读之后新收录 [1-9]/)).toBeVisible()
  await a.getByRole('button',{name:'标记当前收录为已读'}).click();await expect(a.getByText('上次已读之后新收录 0 条')).toBeVisible()
  await a.getByRole('button',{name:'取消关注',exact:true}).click();await expect.poll(async()=>JSON.parse(await b.evaluate(k=>localStorage.getItem(k),key)).entries.length).toBe(1)
  await a.goto(`${route}?hotspot=removed-topic`);await expect(a.getByText(/当前 30 天索引中未找到/)).toBeVisible()
  await a.clock.install({time:new Date('2030-01-01T00:00:00Z')});await a.reload();await expect(a.getByText(/不是当前实时排名/)).toBeVisible()
  await context.close();console.log('Hotspots cross-tab preservation, unread count, explicit mark-read, unknown IDs and stale snapshot passed')
  for(const mode of ['denied','corrupt']){
    const context=await browser.newContext()
    await context.addInitScript(({mode,key})=>{if(mode==='denied'){Storage.prototype.setItem=function(){throw new DOMException('Storage denied','QuotaExceededError')}}else{localStorage.setItem(key,'corrupt-original')}},{mode,key})
    const page=await context.newPage();await page.goto(`${route}?hotspot=${topicA.id}`)
    await page.getByRole('button',{name:'关注主题',exact:true}).click();await expect(page.getByRole('alert')).toContainText('操作未完成')
    await expect(page.getByRole('button',{name:'关注主题',exact:true})).toBeVisible()
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),mode==='corrupt'?'corrupt-original':null)
    await context.close()
  }
  const failure=await browser.newPage();await failure.route('**/NewsHotspots-*.js',r=>r.abort())
  await failure.goto(route);await expect(failure.getByRole('heading',{name:'事件追踪暂时无法加载'})).toBeVisible()
  await failure.unroute('**/NewsHotspots-*.js');await failure.getByRole('button',{name:'重新加载事件追踪'}).click()
  await expect(failure.getByRole('heading',{name:'热点在哪里，进展到哪了'})).toBeVisible()
  console.log('Hotspots denied/corrupt storage and lazy chunk failure/recovery passed')
  }
}finally{await browser.close()}
