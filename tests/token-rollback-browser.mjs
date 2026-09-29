// Interactive isolated rehearsal. Send disabled/reverted/restored/done after rebuilds.
import assert from 'node:assert/strict'
import {createInterface} from 'node:readline'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1','Use only an isolated local preview')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})}),page=await browser.newPage()
page.setDefaultTimeout(15000)
const marker={version:1,revision:3,items:[{id:'synthetic-preservation'}]}
async function check(){
  const value=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('ai-infra-deployment-scenarios-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('library'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close()}}))
  assert.deepEqual(value,marker)
  assert.equal(await page.evaluate(()=>localStorage.getItem('rollback-retention-canary')),'synthetic-value')
}
try{
  await page.goto(`${base}#/models/token-journey`,{waitUntil:'networkidle'})
  await expect(page.getByTestId('event-title')).toHaveText('请求排队')
  await page.evaluate(marker=>new Promise((resolve,reject)=>{localStorage.setItem('rollback-retention-canary','synthetic-value');const r=indexedDB.open('ai-infra-deployment-scenarios-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('library');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('library','readwrite');tx.objectStore('library').put(marker,'state');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),marker)
  console.log('READY: enabled journey verified; fresh-profile unrelated storage canaries seeded.')
  const reader=createInterface({input:process.stdin})
  for await(const line of reader){
    const phase=line.trim();if(phase==='done'){reader.close();break}
    assert.ok(['disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/models/token-journey`);await page.reload({waitUntil:'networkidle'})
    if(phase==='restored')await expect(page.getByTestId('event-title')).toHaveText('请求排队')
    else {await expect(page.getByRole('heading',{name:'一个 Token 的执行旅程',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible()}
    await check()
    await page.goto(`${base}#/models/moe-routing`,{waitUntil:'networkidle'})
    await expect(page.getByTestId('有效专家分配')).toHaveText('48 / 48')
    await page.goto(`${base}#/operators/ranks`,{waitUntil:'networkidle'})
    await page.getByRole('button',{name:'体验计算拖尾案例',exact:true}).click();await expect(page.getByTestId('rank-entry-spread')).toHaveText('80 µs')
    await page.goto(`${base}#/models/compare`,{waitUntil:'networkidle'})
    await expect(page.getByRole('navigation',{name:'模型知识导航'})).toBeVisible()
    await check();console.log(`PASS ${phase}: journey, MoE, multi-rank, comparison and unchanged storage verified.`)
  }
}finally{await browser.close()}
