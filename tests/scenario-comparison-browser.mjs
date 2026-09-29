import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const {features}=await (await fetch(new URL('release.json',base))).json()
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
try{
  for(const width of [360,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${base}#/models/glm-5-2?view=weights&layer=3&tp=8&ep=4&pp=4&stage=2&adp=4&replicas=2&precision=mixed&mlp=fp8&experts=bf16`,{waitUntil:'networkidle'})
    if(!features.scenarioLibrary){await expect(page.getByRole('button',{name:'保存方案',exact:true})).toHaveCount(0);await context.close();continue}
    await page.getByRole('button',{name:'保存方案',exact:true}).click();await page.getByRole('dialog').getByLabel('方案名称').fill('PP 方案')
    await page.getByRole('button',{name:'保存到本机',exact:true}).click();await page.getByRole('link',{name:'打开方案库 →'}).click()
    if(!features.scenarioComparison){await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('article')).toHaveCount(1);await context.close();continue}
    const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出全部',exact:true}).click()
    const data=JSON.parse(await readFile(await (await downloading).path(),'utf8')),item=data.items[0],params=new URLSearchParams(item.params)
    params.delete('pp');params.delete('adp');params.delete('stage')
    const rows=[{...item,id:'baseline',name:'基线方案',params:params.toString()},{...item,id:'same',name:'相同参数'},{...item,id:'extra',name:'第四个方案'}]
    await page.getByLabel('导入方案文件').setInputFiles({name:'scenarios.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,items:rows}))})
    await page.getByRole('button',{name:'确认导入',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(4)
    await page.getByLabel('对比 PP 方案',{exact:true}).click();await expect(page.getByLabel('对比 PP 方案',{exact:true})).toBeChecked()
    await page.getByLabel('对比 相同参数',{exact:true}).click();await expect(page.getByLabel('对比 相同参数',{exact:true})).toBeChecked()
    const comparison=page.getByRole('region',{name:'部署方案对比',exact:true})
    await expect(comparison).toContainText('配置相同，没有参数差异')
    await page.getByLabel('对比 基线方案',{exact:true}).click();await expect(page.getByLabel('对比 基线方案',{exact:true})).toBeChecked();await expect(page.getByLabel('对比 第四个方案',{exact:true})).toBeDisabled()
    await expect(comparison).toContainText('不支持此组合估算');await expect(comparison).toContainText('有差异')
    await expect(comparison.getByRole('row').filter({hasText:'物理卡数'})).toContainText('64')
    await comparison.getByLabel('仅显示参数差异').uncheck();await expect(comparison).toContainText('缓存专用预算')
    await page.reload();await expect(page.getByLabel('对比 PP 方案',{exact:true})).toBeChecked();await expect(comparison).toBeVisible()
    await comparison.scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    if(process.env.MODEL_QA_SCREENSHOTS){await mkdir(process.env.MODEL_QA_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`comparison-${width}.png`)})}
    const box=comparison.getByRole('region',{name:'方案结果横向表格'});await box.focus();await page.keyboard.press('ArrowRight')
    await page.getByRole('button',{name:'清空对比选择'}).click();await expect(comparison).toHaveCount(0)
    await page.goBack();await expect(comparison).toBeVisible()
    assert.deepEqual(errors,[]);await context.close();console.log(`Scenario comparison ${width}px: equal/different, PP/cache scopes, three-way limit, URL/back/refresh and layout passed.`)
  }
  if(!features.scenarioComparison)console.log('Disabled comparison gate verified; no calculation UI exposed.')
}finally{await browser.close()}
