import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4195/AI_Infra_Tutor_Page/'
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const screenshots=process.env.MODEL_QA_SCREENSHOTS
if(screenshots)await mkdir(screenshots,{recursive:true})
const route=`${base}#/learn/attention`
try{
  const enabled=JSON.parse(await readFile(new URL('../config/attention-atlas.json',import.meta.url),'utf8')).enabled
  if(!enabled){
    const page=await browser.newPage();await page.goto(`${base}#/learn`)
    await expect(page.getByRole('heading',{name:'AI Infra，从概念到源码。',exact:true})).toBeVisible()
    await expect(page.getByRole('link',{name:/Attention 演进图谱/})).toHaveCount(0)
    await page.goto(route);await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toHaveCount(0)
    console.log('Attention gate off: teaching retained and new route absent')
  }else{
    for(const width of [360,390,768,1440]){
      const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce',hasTouch:width<500}),errors=[],requests=[]
      page.setDefaultTimeout(15000)
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin||!['GET','HEAD'].includes(r.method()))requests.push(r.url())})
      await page.goto(`${base}#/learn`)
      await page.getByRole('link',{name:/Attention 演进图谱/}).click()
      await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toBeVisible()
      await expect(page.locator('[data-node]')).toHaveCount(12)
      await expect(page.locator('[data-edge="mla-dsa"]')).toHaveAttribute('data-kind','extends')
      const mla=page.locator('[data-node="mla"]')
      await mla.scrollIntoViewIfNeeded();await mla.focus()
      await expect(page.getByRole('region',{name:'MLA 悬浮简介',exact:true})).toBeVisible()
      await page.keyboard.press('Escape');await expect(page.locator('.atlas-preview')).toHaveCount(0)
      await mla.press('Enter');await expect(page).toHaveURL(/node=mla/)
      await page.getByLabel('直接定位技术',{exact:true}).selectOption('kda')
      await expect(page).toHaveURL(/view=recurrent/)
      await expect(page.getByRole('region',{name:'当前技术简介'}).getByRole('heading',{name:'KDA',exact:true})).toBeVisible()
      await expect(page.locator('[data-edge="gdn-kda"]')).toHaveAttribute('data-kind','extends')
      const saved=page.url();await page.reload();assert.equal(page.url(),saved)
      await expect(page.getByLabel('直接定位技术',{exact:true})).toHaveValue('kda')
      await page.goBack();await expect(page.getByLabel('直接定位技术',{exact:true})).toHaveValue('mla')
      await page.getByLabel('浏览分支',{exact:true}).selectOption('all')
      await expect(page.locator('[data-node]')).toHaveCount(32)
      await page.getByLabel('查找技术',{exact:true}).fill('NOT-A-TECHNOLOGY');await page.getByRole('button',{name:'搜索技术',exact:true}).click()
      await expect(page.getByText('没有匹配的技术。',{exact:true})).toBeVisible()
      await page.getByRole('button',{name:'清除搜索',exact:true}).click();await expect(page.locator('[data-node]')).toHaveCount(32)
      await page.getByLabel('查找技术',{exact:true}).fill('gated delta');await page.getByRole('button',{name:'搜索技术',exact:true}).click()
      await expect(page.locator('[data-node]')).toHaveCount(1)
      const gdn=page.locator('[data-node="gdn"]');await gdn.scrollIntoViewIfNeeded()
      if(width<500)await gdn.tap();else await gdn.click()
      await expect(page.getByRole('region',{name:'当前技术简介'}).getByRole('heading',{name:'GDN',exact:true})).toBeVisible()
      await page.getByRole('region',{name:'当前技术简介'}).getByRole('link',{name:'阅读站内教程',exact:true}).click()
      await expect(page).toHaveURL(/article\/ai-infra-basic--gated-delta-network--readme/)
      await expect(page.locator('.reading-body')).toBeVisible();await page.goBack()
      await page.getByLabel('浏览分支',{exact:true}).selectOption('overview')
      await page.getByLabel('查找技术',{exact:true}).fill('');await page.getByRole('button',{name:'搜索技术',exact:true}).click()
      await expect(page.locator('[data-node]')).toHaveCount(32)
      await page.getByLabel('浏览分支',{exact:true}).selectOption('overview')
      await expect(page.locator('[data-node]')).toHaveCount(12)
      await page.evaluate(()=>scrollTo(0,0))
      if(screenshots)await page.screenshot({path:join(screenshots,`attention-${width}.png`),fullPage:true})
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
      assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0})
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[])
      await page.close();console.log(`Attention ${width}px: graph, sources, focus/touch, search, URL/back/refresh and privacy passed`)
    }
    const page=await browser.newPage({viewport:{width:1440,height:950}})
    await page.goto(route);const node=page.locator('[data-node="mla"]');await node.hover()
    const preview=page.getByRole('region',{name:'MLA 悬浮简介',exact:true});await expect(preview).toBeVisible()
    await preview.getByRole('link',{name:'阅读站内教程',exact:true}).hover();await page.waitForTimeout(250)
    await expect(preview).toBeVisible();await preview.getByRole('link',{name:'阅读站内教程',exact:true}).click()
    await expect(page).toHaveURL(/04-multi-head-latent-attention/)
    await page.goto(route)
    for(const [view,count] of [['foundations',4],['kv',3],['sparse',9],['linear',4],['recurrent',8],['systems',4]]){
      await page.getByLabel('浏览分支',{exact:true}).selectOption(view);await expect(page.locator('[data-node]')).toHaveCount(count)
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    }
    for(const query of ['node=unknown','view=bad','node=mla&node=gqa']){await page.goto(`${route}?${query}`);await expect(page.getByRole('alert')).toBeVisible();await page.getByRole('button',{name:'重置链接',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0)}
    await page.close()
    const failed=await browser.newPage();failed.setDefaultTimeout(15000)
    await failed.route('**/assets/AttentionAtlas-*.js',r=>r.abort());await failed.goto(route)
    await expect(failed.getByRole('heading',{name:'Attention 图谱暂时无法加载',exact:true})).toBeVisible()
    await failed.unroute('**/assets/AttentionAtlas-*.js');await failed.getByRole('button',{name:'重新加载图谱',exact:true}).click()
    await expect(failed.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toBeVisible()
    console.log('Attention hover-to-link, invalid state and lazy-chunk recovery passed')
  }
}finally{await browser.close()}
