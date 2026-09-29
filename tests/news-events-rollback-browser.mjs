// Run against an isolated preview only; rebuild between stdin phase commands.
import assert from 'node:assert/strict'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})}),page=await browser.newPage()
page.setDefaultTimeout(15000)
const marker={version:1,revision:3,items:[{id:'synthetic-preservation'}]}
async function check(){
  const value=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('ai-infra-deployment-scenarios-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library'),get=tx.objectStore('library').get('state');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close()}}))
  assert.deepEqual(value,marker)
  assert.equal(await page.evaluate(()=>localStorage.getItem('rollback-retention-canary')),'synthetic-value')
}
try{
  await page.goto(`${base}#/news/events`,{waitUntil:'networkidle'})
  await expect(page.getByRole('heading',{name:'把新闻连成脉络'})).toBeVisible()
  await page.evaluate(marker=>new Promise((resolve,reject)=>{localStorage.setItem('rollback-retention-canary','synthetic-value');const request=indexedDB.open('ai-infra-deployment-scenarios-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('library','readwrite');tx.objectStore('library').put(marker,'state');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}),marker)
  console.log('READY: enabled event tracking verified; unrelated storage seeded in fresh profile.')
  const reader=createInterface({input:process.stdin})
  for await(const line of reader){
    const phase=line.trim();if(phase==='done'){reader.close();break}
    assert(['disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/news/events`);await page.reload({waitUntil:'networkidle'})
    if(phase==='restored')await expect(page.getByRole('heading',{name:'把新闻连成脉络'})).toBeVisible()
    else{await expect(page.getByRole('heading',{name:'把新闻连成脉络'})).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible()}
    await page.goto(`${base}#/news`,{waitUntil:'networkidle'})
    await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible()
    await expect(page.getByRole('link',{name:/事件追踪：/})).toHaveCount(phase==='restored'?1:0)
    await page.goto(`${base}#/news/weekly`,{waitUntil:'networkidle'});await expect(page.getByRole('heading',{level:1})).toBeVisible()
    await page.goto(`${base}#/models/communication`,{waitUntil:'networkidle'});await expect(page.getByTestId('所选组发送总量')).toHaveText('14.00 MiB')
    await page.goto(`${base}#/models/token-journey`,{waitUntil:'networkidle'});await expect(page.getByTestId('event-title')).toHaveText('请求排队')
    await page.goto(`${base}#/models/moe-routing`,{waitUntil:'networkidle'});await expect(page.getByTestId('有效专家分配')).toHaveText('48 / 48')
    await check();console.log(`PASS ${phase}: event gate, news, weekly, communication, Token, MoE and storage retained.`)
  }
}finally{await browser.close()}
