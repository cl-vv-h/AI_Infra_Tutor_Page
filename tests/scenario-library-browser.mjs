import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const {features}=await (await fetch(new URL('release.json',base))).json()
const query='view=weights&layer=3&tp=8&ep=4&pp=4&stage=2&adp=4&replicas=2&rank=9&precision=mixed&mlp=fp8&experts=bf16&b=8&s=16384&budget=12&bytes=1'
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
async function save(page,name='方案 A'){
  await page.goto(`${base}#/models/glm-5-2?${query}`,{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'保存方案',exact:true}).click()
  await page.getByRole('dialog').getByLabel('方案名称').fill(name)
  await page.getByRole('button',{name:'保存到本机',exact:true}).click()
  await page.getByRole('link',{name:'打开方案库 →'}).click()
  await expect(page.getByRole('article',{name:`方案 ${name}`,exact:true})).toBeVisible()
}
async function exported(page){const p=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部',exact:true}).click();const file=await p;return JSON.parse(await readFile(await file.path(),'utf8'))}
async function upload(page,data){await page.getByLabel('导入方案文件').setInputFiles({name:'scenarios.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))})}
try{
  if(!features.scenarioLibrary){
    const page=await browser.newPage();await page.goto(`${base}#/models/scenarios`)
    await expect(page.getByRole('heading',{name:'方案库暂未开放'})).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(0)
    console.log('Disabled library route verified; existing data left untouched.')
  }else{
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[]
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r))
    await save(page)
    await page.reload();await expect(page.getByRole('article')).toHaveCount(1)
    const backup=await exported(page)
    assert.match(backup.items[0].params,/pp=4/);assert.match(backup.items[0].params,/adp=4/)
    await page.getByRole('link',{name:'恢复配置'}).click()
    await expect(page.getByLabel('Pipeline PP',{exact:true})).toHaveValue('4')
    await expect(page.getByLabel('Attention DP',{exact:true})).toHaveValue('4')
    await page.goBack();await expect(page.getByRole('article')).toHaveCount(1)
    await page.getByRole('button',{name:'复制方案',exact:true}).click()
    await page.getByRole('dialog').getByLabel('方案名称').fill('方案 B')
    await page.getByRole('button',{name:'确认保存',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(2)
    const b=page.getByRole('article',{name:'方案 方案 B',exact:true})
    await b.getByRole('button',{name:'重命名',exact:true}).click();await page.getByRole('dialog').getByLabel('方案名称').fill('改名 B')
    await page.getByRole('button',{name:'确认保存',exact:true}).click();await expect(page.getByRole('article',{name:'方案 改名 B',exact:true})).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    if(process.env.MODEL_QA_SCREENSHOTS){await mkdir(process.env.MODEL_QA_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`scenarios-${width}.png`)})}
    await page.getByRole('article',{name:'方案 改名 B',exact:true}).getByRole('button',{name:'删除',exact:true}).click()
    await page.keyboard.press('Escape');await expect(page.getByRole('article')).toHaveCount(2)
    await page.getByRole('article',{name:'方案 改名 B',exact:true}).getByRole('button',{name:'删除',exact:true}).click()
    await page.getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(1)
    await upload(page,backup);await expect(page.getByRole('region',{name:'导入预览'})).toContainText('跳过完全相同的 1 个')
    await page.getByRole('button',{name:'确认导入',exact:true}).click();await expect(page.getByRole('region',{name:'导入预览'})).toHaveCount(0)
    await upload(page,{...backup,items:[{...backup.items[0],name:'恶意覆盖'}]});await expect(page.getByRole('alert')).toContainText('冲突')
    await upload(page,{version:99,items:[]});await expect(page.getByRole('alert')).toContainText('不支持')
    await upload(page,{version:1,items:[{...backup.items[0],id:'retired',modelId:'retired-model',name:'旧模型'}]})
    await page.getByRole('button',{name:'确认导入',exact:true}).click()
    await expect(page.getByRole('article',{name:'方案 旧模型'}).getByRole('link',{name:'恢复配置'})).toHaveCount(0)
    assert.equal((await exported(page)).items.length,2)
    assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method()==='GET'&&new URL(r.url()).origin===new URL(base).origin))
    await context.close();console.log(`Scenario library ${width}px: CRUD, restore, round-trip, import failures, stale model and privacy passed.`)
  }
  const context=await browser.newContext(),page=await context.newPage();await save(page)
  const other=await context.newPage();await other.goto(`${base}#/models/scenarios`);await expect(other.getByRole('article')).toHaveCount(1)
  await other.getByRole('button',{name:'复制方案',exact:true}).click();await other.getByRole('button',{name:'确认保存',exact:true}).click();await expect(other.getByRole('article')).toHaveCount(2)
  await page.getByRole('button',{name:'重命名',exact:true}).click();await page.getByRole('dialog').getByLabel('方案名称').fill('stale overwrite')
  await page.getByRole('button',{name:'确认保存',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('其他标签页')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'刷新方案库'}).click();await expect(page.getByRole('article')).toHaveCount(2)
  const before=await exported(page)
  await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota failure','QuotaExceededError')}})
  await page.getByRole('article').first().getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'确认删除'}).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();await page.keyboard.press('Escape');await page.reload();await expect(page.getByRole('article')).toHaveCount(2)
  assert.deepEqual(await exported(page),before);await context.close()
  const denied=await browser.newContext();await denied.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new Error('Denied')}}))
  const blocked=await denied.newPage();await blocked.goto(`${base}#/models/scenarios`);await expect(blocked.getByRole('alert')).toContainText('IndexedDB')
  await expect(blocked.getByRole('button',{name:'导入 JSON'})).toBeDisabled();await denied.close()
  console.log('Scenario transactions: multi-tab stale writes, failed writes and denied storage passed.')
  }
}finally{await browser.close()}
