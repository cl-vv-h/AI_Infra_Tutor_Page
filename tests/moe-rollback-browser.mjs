// Interactive rehearsal only: use an isolated preview and browser profile.
// Start on the enabled build, then send disabled/reverted/restored/done after
// each corresponding rebuild. Never point this synthetic-data test at production.
import assert from 'node:assert/strict'
import {createInterface} from 'node:readline'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1','Rollback rehearsal must use a local isolated preview')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})}),page=await browser.newPage()
page.setDefaultTimeout(15000)
const marker={version:1,revision:3,items:[{id:'synthetic-preservation'}]}
const check=async()=>{
  const value=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('ai-infra-deployment-scenarios-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close()}}))
  assert.deepEqual(value,marker)
  assert.equal(await page.evaluate(()=>localStorage.getItem('rollback-retention-canary')),'synthetic-value')
}
try{
  await page.goto(`${base}#/models/moe-routing`,{waitUntil:'networkidle'})
  await expect(page.getByTestId('有效专家分配')).toHaveText('48 / 48')
  await page.evaluate(marker=>new Promise((resolve,reject)=>{localStorage.setItem('rollback-retention-canary','synthetic-value');const request=indexedDB.open('ai-infra-deployment-scenarios-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readwrite');tx.objectStore('library').put(marker,'state');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),marker)
  console.log('READY: enabled feature verified; synthetic IndexedDB/localStorage seeded in fresh browser.')
  const reader=createInterface({input:process.stdin})
  for await(const line of reader){
    const phase=line.trim();if(phase==='done'){reader.close();break}
    assert.ok(['disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/models/moe-routing`);await page.reload({waitUntil:'networkidle'})
    if(phase==='restored')await expect(page.getByTestId('有效专家分配')).toHaveText('48 / 48')
    else {await expect(page.getByRole('heading',{name:'MoE 路由沙盘',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible()}
    await check()
    await page.goto(`${base}#/operators/ranks`,{waitUntil:'networkidle'})
    await page.getByRole('button',{name:'体验计算拖尾案例',exact:true}).click()
    await expect(page.getByTestId('rank-entry-spread')).toHaveText('80 µs')
    await page.goto(`${base}#/models/compare`,{waitUntil:'networkidle'})
    await expect(page.getByRole('navigation',{name:'模型知识导航'})).toBeVisible()
    await check();console.log(`PASS ${phase}: feature state, original comparison, multi-rank tool and exact IndexedDB/localStorage preserved.`)
  }
}finally{await browser.close()}
