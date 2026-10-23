import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4195/AI_Infra_Tutor_Page/'
const gate=JSON.parse(await readFile(new URL('../config/news-sphere-semantics.json',import.meta.url),'utf8'))
const screenshots=process.env.MODEL_QA_SCREENSHOTS
if(screenshots)await mkdir(screenshots,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
try{
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'})
    // Inspect actual drawing calls, not a production attribute claiming success.
    await context.addInitScript(()=>{
      const clear=CanvasRenderingContext2D.prototype.clearRect,line=CanvasRenderingContext2D.prototype.lineTo,arc=CanvasRenderingContext2D.prototype.arc
      window.__newsDraw={lines:0,colors:[]}
      CanvasRenderingContext2D.prototype.clearRect=function(...args){window.__newsDraw={lines:0,colors:[]};return clear.apply(this,args)}
      CanvasRenderingContext2D.prototype.lineTo=function(...args){window.__newsDraw.lines++;return line.apply(this,args)}
      CanvasRenderingContext2D.prototype.arc=function(...args){window.__newsDraw.colors.push(this.fillStyle);return arc.apply(this,args)}
    })
    const page=await context.newPage(),errors=[],writes=[]
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||new URL(r.url()).origin!==new URL(base).origin)writes.push(r.url())})
    await page.goto(`${base}#/news`)
    const canvas=page.locator('.pulse-canvas')
    if(!gate.enabled){
      await expect(page.getByTestId('radar-row').first()).toBeVisible();await expect(canvas).toHaveCount(0)
      await page.getByRole('button',{name:'阅读设置',exact:true}).click();await expect(page.getByLabel('显示交互球体')).toBeDisabled()
      await page.goto(`${base}#/news?view=daily`);await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible()
    }else{
      const legend=page.getByRole('region',{name:'球体图例'})
      await expect(legend).toContainText('不绘制关联线')
      for(const label of ['AI','科技','金融','国际'])await expect(legend).toContainText(label)
      await expect(canvas).toHaveAttribute('data-nodes',/^[1-9]/)
      await canvas.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.pulse-preview')).toContainText('同色仅表示同一板块')
      const assertDraw=async()=>{
        const draw=await page.evaluate(()=>window.__newsDraw)
        assert.equal(draw.lines,0,'no cross-signal edges or misleading leader lines')
        assert(draw.colors.length>0)
        const allowed=['196,186,229','166,204,215','180,212,194','221,205,175']
        assert(draw.colors.every(c=>allowed.some(rgb=>c.replaceAll(' ','').startsWith(`rgba(${rgb},`)||c.replaceAll(' ','')===`rgb(${rgb})`)),'all points use the categorical palette')
      }
      await assertDraw();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog')).toContainText('仅按同板块列出，不表示同一事件或内容相关。')
      await assertDraw()
      const suggestions=page.locator('.pulse-related button')
      if(await suggestions.count()){
        const before=page.url();await suggestions.first().click();assert.notEqual(page.url(),before)
        await expect(page.getByRole('dialog')).toBeVisible();await assertDraw()
      }
      await page.keyboard.press('Escape');await page.getByRole('button',{name:'切换浅色阅读'}).click();await expect(legend).toBeVisible();await assertDraw()
      if(screenshots)await page.locator('.pulse-observatory').screenshot({path:`${screenshots}/sphere-${width}-light.png`})
      await page.getByRole('button',{name:'切换深色阅读'}).click()
      if(screenshots)await page.locator('.pulse-observatory').screenshot({path:`${screenshots}/sphere-${width}-dark.png`})
      if(screenshots)await legend.screenshot({path:`${screenshots}/legend-${width}.png`})
      await page.getByRole('button',{name:'AI',exact:true}).click();await expect(page).toHaveURL(/category=ai/)
      await page.reload();await expect(page.getByRole('button',{name:'AI',exact:true})).toHaveAttribute('aria-pressed','true')
      await canvas.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.pulse-preview')).toBeVisible();await assertDraw()
      assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0})
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
    await context.close();console.log(`Sphere semantics ${width}px: ${gate.enabled?'actual canvas has no lines, categorical colors, legend, suggestions and refresh':'disabled fallback retains reading'} passed`)
  }
}finally{await browser.close()}
