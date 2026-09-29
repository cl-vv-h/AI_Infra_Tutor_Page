// Isolated loopback preview only. Keep this browser profile while rebuilding between phases.
import assert from 'node:assert/strict'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{expect}=require('playwright/test')
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4196/AI_Infra_Tutor_Page/'
assert.equal(new URL(base).hostname,'127.0.0.1')
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})}),page=await browser.newPage()
page.setDefaultTimeout(15000)
const key='ai-infra-hotspot-follows-v1'
try{
  await page.goto(`${base}#/news/events?hotspot=openai-safety`)
  await page.getByRole('button',{name:'关注主题',exact:true}).click()
  await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()
  await page.evaluate(()=>localStorage.setItem('hotspot-unrelated-canary','retained'))
  const original=await page.evaluate(k=>localStorage.getItem(k),key)
  console.log('READY: local follow and unrelated canary seeded')
  const reader=createInterface({input:process.stdin})
  for await(const line of reader){
    const phase=line.trim();if(phase==='done'){reader.close();break}
    assert(['disabled','reverted','restored'].includes(phase))
    await page.goto(`${base}#/news/events`);await page.reload({waitUntil:'networkidle'})
    await expect(page.getByRole('heading',{name:phase==='restored'?'热点在哪里，进展到哪了':'把新闻连成脉络',exact:true})).toBeVisible()
    if(phase==='restored'){await page.goto(`${base}#/news/events?hotspot=openai-safety`);await expect(page.getByRole('button',{name:'取消关注',exact:true})).toBeVisible()}
    await page.goto(`${base}#/news/events?event=boj-policy-2026`);await expect(page.getByTestId('event-title')).toContainText('7 月会议纪要')
    await page.goto(`${base}#/news`);await expect(page.getByRole('heading',{name:'发现技术，读懂进展。'})).toBeVisible()
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),original)
    assert.equal(await page.evaluate(()=>localStorage.getItem('hotspot-unrelated-canary')),'retained')
    console.log(`PASS ${phase}: route, reviewed deep link, news and local follow retained`)
  }
}finally{await browser.close()}
