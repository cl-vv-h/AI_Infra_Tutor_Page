// Isolated loopback only. Send disabled/reverted/restored/done after each rebuild.
import assert from 'node:assert/strict'
import {createInterface} from 'node:readline'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})}),page=await browser.newPage()
page.setDefaultTimeout(20000)
try{
  await page.goto(`${base}#/learn/attention?node=kda&view=recurrent`)
  await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toBeVisible()
  await page.goto(`${base}#/news/events?hotspot=openai-safety`)
  await page.getByRole('button',{name:'关注主题',exact:true}).click()
  await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible({timeout:15000})
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    localStorage.setItem('attention-rollback-canary','synthetic-retained-value')
    const r=indexedDB.open('attention-rollback-canary',1)
    r.onupgradeneeded=()=>r.result.createObjectStore('records')
    r.onerror=()=>reject(r.error)
    r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put({value:42},'existing');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}
  }))
  const original=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))
  console.log('READY: enabled route, real local follow, independent local/IndexedDB canaries seeded')
  const reader=createInterface({input:process.stdin})
  for await(const line of reader){
    const phase=line.trim();if(phase==='done'){reader.close();break}
    assert(['disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/learn/attention?node=kda&view=recurrent`);await page.reload({waitUntil:'networkidle'})
    if(phase==='restored')await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toBeVisible()
    else {await expect(page.getByRole('heading',{name:'Attention 演进图谱',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible()}
    await page.goto(`${base}#/learn`);await expect(page.getByRole('heading',{name:'AI Infra，从概念到源码。',exact:true})).toBeVisible()
    await expect(page.getByRole('link',{name:/Attention 演进图谱/})).toHaveCount(phase==='restored'?1:0)
    await page.goto(`${base}#/article/ai-infra-basic--model-architecture--04-multi-head-latent-attention`);await expect(page.locator('.reading-body')).toBeVisible()
    await page.goto(`${base}#/news/events?hotspot=openai-safety`);await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible({timeout:15000})
    await page.goto(`${base}#/news/weekly`);await expect(page.getByRole('heading',{level:1})).toBeVisible()
    await page.goto(`${base}#/models`);await expect(page.getByRole('navigation',{name:'模型知识导航'})).toBeVisible()
    assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort())),original)
    const canary=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('attention-rollback-canary',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('records'),get=tx.objectStore('records').get('existing');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close()}}))
    assert.deepEqual(canary,{value:42})
    console.log(`PASS ${phase}: teaching, article, models, weekly, real follow and all canaries retained`)
  }
}finally{await browser.close()}
