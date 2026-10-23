// Isolated loopback only: keep one browser context through the rebuilt phases.
import assert from 'node:assert/strict'
import {createInterface} from 'node:readline'
import {chromium,expect} from '@playwright/test'
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
await context.addInitScript(()=>{const clear=CanvasRenderingContext2D.prototype.clearRect,line=CanvasRenderingContext2D.prototype.lineTo;window.__lines=0;CanvasRenderingContext2D.prototype.clearRect=function(...a){window.__lines=0;return clear.apply(this,a)};CanvasRenderingContext2D.prototype.lineTo=function(...a){window.__lines++;return line.apply(this,a)}})
const page=await context.newPage()
try{
  await page.goto(`${base}#/news/events?hotspot=openai-safety`)
  await page.getByRole('button',{name:'关注主题',exact:true}).click()
  await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible({timeout:20000})
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    localStorage.setItem('sphere-semantics-canary','retained')
    const req=indexedDB.open('sphere-semantics-canary',1)
    req.onupgradeneeded=()=>req.result.createObjectStore('records')
    req.onerror=()=>reject(req.error)
    req.onsuccess=()=>{const db=req.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put(42,'old');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}
  }))
  const original=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))
  console.log('READY: real follow and unrelated localStorage/IndexedDB seeded')
  for await(const text of createInterface({input:process.stdin})){
    const phase=text.trim();if(phase==='done')break
    assert(['enabled','disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/news`);await page.reload({waitUntil:'networkidle'})
    await expect(page.getByTestId('radar-row').first()).toBeVisible({timeout:20000})
    const sphere=page.locator('.pulse-canvas')
    if(phase==='disabled')await expect(sphere).toHaveCount(0)
    else{
      await sphere.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.pulse-preview')).toBeVisible()
      await expect.poll(()=>page.evaluate(()=>window.__lines>0)).toBe(phase==='reverted')
      if(phase!=='reverted')await expect(page.getByRole('region',{name:'球体图例'})).toContainText('不绘制关联线')
    }
    await page.goto(`${base}#/news?view=daily`);await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible()
    await page.goto(`${base}#/news/weekly`);await expect(page.getByRole('heading',{level:1})).toBeVisible()
    await page.goto(`${base}#/news/events?hotspot=openai-safety`);await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible({timeout:20000})
    await page.goto(`${base}#/learn/attention`);await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toBeVisible()
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort())),original)
    assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('sphere-semantics-canary',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('records');tx.objectStore('records').get('old').onsuccess=e=>resolve(e.target.result);tx.oncomplete=()=>db.close()}})),42)
    console.log(`PASS ${phase}: line semantics, original routes, real follow and unrelated local data retained`)
  }
}finally{await browser.close()}
