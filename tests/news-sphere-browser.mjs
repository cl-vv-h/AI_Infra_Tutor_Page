import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import {buildHotspots} from '../src/lib/news-hotspots.mjs'
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4195/AI_Infra_Tutor_Page/', route=`${base}#/news`
const gate=JSON.parse(await readFile(new URL('../config/news-sphere.json',import.meta.url),'utf8'))
const corpus=JSON.parse(await readFile(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8'))
const firstWeekly=buildHotspots(corpus,168)[0]
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const overflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow')
const key='ai-infra-hotspot-follows-v1'
try {
  if(!gate.enabled){const page=await browser.newPage();await page.goto(route);await expect(page.getByRole('heading',{name:'世界的脉动',exact:false})).toHaveCount(0);await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible();console.log('Sphere gate off: original reader preserved')}
  else {
    for(const width of [360,390,768,1440]){
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],writes=[]
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||new URL(r.url()).origin!==new URL(base).origin)writes.push(r.url())})
      await page.goto(route);await expect(page.getByRole('heading',{name:/世界的脉动/})).toBeVisible()
      const sphere=page.getByRole('group',{name:/新闻信息球体/})
      await expect(sphere).toHaveAttribute('data-nodes',/^[1-9]\d*$/);await overflow(page)
      await expect(page.getByRole('button',{name:'播放球体动画'})).toBeDisabled()
      const yaw=await sphere.getAttribute('data-yaw');await page.getByRole('button',{name:'单步旋转球体'}).click();await expect(sphere).not.toHaveAttribute('data-yaw',yaw)
      await sphere.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.pulse-preview')).toBeVisible();await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible();await expect(page).toHaveURL(/selected=/)
      await expect(page.getByRole('link',{name:'阅读最新报道原文'})).toHaveAttribute('href',/^https:\/\//)
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(sphere).toBeFocused()
      await page.getByRole('button',{name:'AI',exact:true}).click();await expect(page).toHaveURL(/category=ai/);await page.reload();await expect(page.getByRole('button',{name:'AI',exact:true})).toHaveAttribute('aria-pressed','true')
      const aiCount=await page.getByTestId('radar-count').textContent();assert(+aiCount>0)
      await page.getByRole('button',{name:'FINANCE',exact:true}).click();await page.goBack();await expect(page.getByRole('button',{name:'AI',exact:true})).toHaveAttribute('aria-pressed','true')
      await page.getByLabel('搜索新闻、公司、人物或话题').fill('no-such-signal-zzxx');await expect(page.getByTestId('radar-count')).toHaveText('0');await expect(page.getByText('这个窗口暂时没有匹配信号。')).toBeVisible();await expect(sphere).toHaveAttribute('data-nodes','0')
      await page.getByRole('button',{name:'清除筛选',exact:true}).click();await page.getByLabel('时间窗口').selectOption('168');await expect(page).toHaveURL(/hours=168/)
      await page.getByRole('button',{name:'最新',exact:true}).click();await expect(page).toHaveURL(/sort=latest/)
      await page.getByRole('button',{name:'热点',exact:true}).click();await expect(page.getByTestId('radar-row').first().locator('.pulse-row-title')).toHaveText(firstWeekly.title);await page.getByTestId('radar-row').first().locator('.pulse-row-title').focus();await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'关注主题',exact:true}).click();await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
      await page.getByRole('button',{name:'关闭新闻详情'}).click();await page.getByRole('button',{name:'我的关注',exact:true}).click();await expect(page.getByTestId('radar-row')).toHaveCount(1)
      await page.getByTestId('radar-row').locator('.pulse-row-title').click();await page.getByRole('button',{name:'取消关注',exact:true}).click();await page.getByRole('button',{name:'关闭新闻详情'}).click();await expect(page.getByTestId('radar-row')).toHaveCount(0)
      await page.getByRole('button',{name:'清除筛选',exact:true}).click();await page.getByRole('button',{name:'切换浅色阅读'}).click();await expect(page.locator('.pulse')).toHaveClass(/pulse-light/);await page.getByRole('button',{name:'切换深色阅读'}).click()
      await page.getByRole('button',{name:'阅读设置'}).click();await page.getByLabel('显示交互球体').uncheck();await expect(sphere).toHaveCount(0);await page.getByLabel('显示交互球体').check();await expect(sphere).toBeVisible()
      await page.getByRole('button',{name:'直接阅读新闻'}).click();await expect(page.locator('#pulse-feed')).toBeFocused();await overflow(page)
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await context.close();console.log(`PULSE ${width}px: geometry, keyboard, URL/back/refresh, filters, local follow, theme, skip and privacy passed`)
    }
    // Automatic rotation, mouse picking, drag and inertia; no production-only testing hooks.
    const context=await browser.newContext({viewport:{width:1440,height:1000}})
    await context.addInitScript(()=>{const clear=CanvasRenderingContext2D.prototype.clearRect,arc=CanvasRenderingContext2D.prototype.arc;window.__arcs=[];CanvasRenderingContext2D.prototype.clearRect=function(...args){window.__arcs=[];return clear.apply(this,args)};CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){window.__arcs.push({x,y,r});return arc.call(this,x,y,r,...rest)}})
    const page=await context.newPage();await page.goto(route);const sphere=page.locator('.pulse-canvas');await expect(sphere).toHaveAttribute('data-nodes',/^[1-9]/)
    let yaw=await sphere.getAttribute('data-yaw');await expect(sphere).not.toHaveAttribute('data-yaw',yaw)
    await page.getByRole('button',{name:'暂停球体动画'}).click();await page.waitForTimeout(100);yaw=await sphere.getAttribute('data-yaw');await page.waitForTimeout(150);assert.equal(await sphere.getAttribute('data-yaw'),yaw)
    const rect=await sphere.boundingBox(),dot=await page.evaluate(()=>window.__arcs.filter(p=>p.r>3).sort((a,b)=>b.r-a.r)[0]);assert(dot)
    await page.mouse.move(rect.x+dot.x,rect.y+dot.y);await expect(page.locator('.pulse-preview')).toBeVisible();await page.mouse.click(rect.x+dot.x,rect.y+dot.y);await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape')
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+70,rect.y+rect.height/2+20,{steps:6});await page.mouse.up();await expect(sphere).not.toHaveAttribute('data-yaw',yaw)
    await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'播放球体动画'})).toBeDisabled();await context.close();console.log('PULSE motion: auto/pause/single-step, actual canvas hover/pick, drag and reduced-motion passed')
    const touchContext=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
    await touchContext.addInitScript(()=>{const clear=CanvasRenderingContext2D.prototype.clearRect,arc=CanvasRenderingContext2D.prototype.arc;window.__arcs=[];CanvasRenderingContext2D.prototype.clearRect=function(...args){window.__arcs=[];return clear.apply(this,args)};CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){window.__arcs.push({x,y,r});return arc.call(this,x,y,r,...rest)}})
    const touch=await touchContext.newPage();await touch.goto(route);const surface=touch.locator('.pulse-canvas');await expect(surface).toHaveAttribute('data-nodes',/^[1-9]/);await surface.scrollIntoViewIfNeeded()
    const touchRect=await surface.boundingBox(),point=await touch.evaluate(()=>window.__arcs.filter(p=>p.r>3).sort((a,b)=>b.r-a.r)[0]);assert(point)
    await touch.touchscreen.tap(touchRect.x+point.x,touchRect.y+point.y);await expect(touch.locator('.pulse-preview')).toBeVisible();await expect(touch.getByRole('dialog')).not.toBeVisible();await touch.touchscreen.tap(touchRect.x+point.x,touchRect.y+point.y);await expect(touch.getByRole('dialog')).toBeVisible();await touchContext.close();console.log('PULSE touch: first tap previews, second tap opens details')
    const shared=await browser.newContext(),tabA=await shared.newPage(),tabB=await shared.newPage()
    const subject=buildHotspots(corpus,72).find(row=>row.kind==='topic');assert(subject)
    for(const tab of [tabA,tabB])await tab.goto(`${route}?mode=radar&selected=${subject.id}`)
    await tabA.getByRole('button',{name:'关注主题',exact:true}).click();await expect(tabB.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
    await tabB.getByRole('button',{name:'取消关注',exact:true}).click();await expect(tabA.getByRole('button',{name:'关注主题',exact:true})).toBeVisible();await shared.close();console.log('PULSE cross-tab subscriptions reconcile without overwriting other records')
    for(const mode of ['canvas','storage','corrupt','chunk']){
      const context=await browser.newContext(),page=await context.newPage()
      if(mode==='canvas')await context.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null})
      if(mode==='storage')await context.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Denied','QuotaExceededError')}})
      if(mode==='corrupt')await context.addInitScript(key=>localStorage.setItem(key,'not-a-supported-format'),key)
      if(mode==='chunk')await page.route('**/assets/NewsRadar-*.js',r=>r.abort())
      await page.goto(route)
      if(mode==='canvas'){await expect(page.getByText(/此浏览器无法绘制球体/)).toBeVisible();await expect(page.getByTestId('radar-row').first()).toBeVisible()}
      if(mode==='storage'){await page.getByTestId('radar-row').first().locator('.pulse-row-title').click();await page.getByRole('button',{name:'关注主题',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('操作未完成');assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null)}
      if(mode==='corrupt'){await expect(page.getByRole('alert')).toContainText('原数据未改动');await page.getByTestId('radar-row').first().locator('.pulse-row-title').click();await page.getByRole('button',{name:'关注主题',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('操作未完成');assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'not-a-supported-format')}
      if(mode==='chunk'){await expect(page.getByRole('heading',{name:'新闻雷达暂时无法加载'})).toBeVisible();await page.getByRole('link',{name:'打开传统阅读页'}).click();await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible();await page.unroute('**/assets/NewsRadar-*.js');await page.goto(route);await page.reload();await expect(page.getByRole('heading',{name:/世界的脉动/})).toBeVisible()}
      await context.close();console.log(`PULSE ${mode} failure recovery passed`)
    }
    const missingPage=await browser.newPage();await missingPage.goto(`${route}?mode=radar&selected=missing`);await expect(missingPage.getByRole('heading',{name:'当前索引中未找到此新闻'})).toBeVisible();await missingPage.keyboard.press('Escape');await expect(missingPage.getByRole('dialog')).not.toBeVisible()
  }
} finally {await browser.close()}
