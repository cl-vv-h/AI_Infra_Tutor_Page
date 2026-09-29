// Manual rollback rehearsal: keep one isolated browser context on the same origin
// while the operator rebuilds the isolated checkout between stdin phase commands.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE
if(!base||!/^http:\/\/127\.0\.0\.1:/.test(base))throw new Error('Rehearsal requires an explicitly selected local preview')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const context=await browser.newContext(),page=await context.newPage()
async function raw(){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('ai-infra-deployment-scenarios-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('library');const q=tx.objectStore('library').get('state');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close()}}))}
try{
  await page.goto(`${base}#/models/glm-5-2?view=weights&layer=3&tp=8&ep=4&pp=4&adp=4&replicas=2`)
  await page.getByRole('button',{name:'保存方案',exact:true}).click();await page.getByRole('dialog').getByLabel('方案名称').fill('回退保留测试')
  await page.getByRole('button',{name:'保存到本机',exact:true}).click();await page.getByRole('link',{name:'打开方案库 →'}).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  const original=await raw();console.log('READY: synthetic scenario saved; waiting for comparison-off/library-off/reverted/restored/done.')
  for await(const phase of createInterface({input:process.stdin})){
    if(phase==='done')break
    await page.goto(`${base}#/models/scenarios`);await page.reload({waitUntil:'networkidle'})
    if(phase==='comparison-off'){await expect(page.getByRole('article')).toHaveCount(1);await expect(page.getByRole('checkbox')).toHaveCount(0)}
    else if(phase==='library-off')await expect(page.getByRole('heading',{name:'方案库暂未开放'})).toBeVisible()
    else if(phase==='reverted'){await expect(page.getByRole('heading',{name:'未找到这个模型图解'})).toBeVisible();await page.goto(`${base}#/models/glm-5-2`);await expect(page.getByRole('button',{name:'保存方案',exact:true})).toHaveCount(0)}
    else if(phase==='restored'){await expect(page.getByRole('article')).toHaveCount(1);await expect(page.getByLabel('对比 回退保留测试',{exact:true})).toBeVisible();await page.getByRole('link',{name:'恢复配置'}).click();await expect(page.getByLabel('Pipeline PP',{exact:true})).toHaveValue('4')}
    else throw new Error('Unknown rehearsal phase')
    assert.deepEqual(await raw(),original);console.log(`PASS ${phase}: original IndexedDB bytes/record/revision preserved.`)
  }
}finally{await browser.close()}
