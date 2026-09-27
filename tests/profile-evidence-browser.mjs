import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { profileBundleFixture } from './profile-bundle-fixture.mjs'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4187/AI_Infra_Tutor_Page/'
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const fixture=profileBundleFixture().map(f=>({name:f.name,mimeType:f.name.endsWith('.json')?'application/json':'text/csv',buffer:Buffer.from(f.text)}))
const sourceDirectory=process.env.PROFILE_QA_DIRECTORY
let realDirectory=sourceDirectory,realCounts
if(realDirectory){
  if((await readdir(realDirectory)).includes('ASCEND_PROFILER_OUTPUT'))realDirectory=join(realDirectory,'ASCEND_PROFILER_OUTPUT')
  // Independent trace accounting: no application parser, task-name heuristic or
  // app-derived expected constants. Keep capture-specific values out of the repo.
  const raw=JSON.parse(await readFile(join(realDirectory,'trace_view.json'),'utf8')),events=raw.traceEvents??raw
  const pids=new Set(events.filter(e=>e.ph==='M'&&e.name==='process_name'&&e.args?.name==='Ascend Hardware').map(e=>e.pid))
  const hardware=events.filter(e=>e.ph==='X'&&pids.has(e.pid)&&Number(e.dur)>0)
  const waits=hardware.filter(e=>/WAIT/.test(e.args?.['Task Type']??''))
  const controls=hardware.filter(e=>/EVENT_RECORD|EVENT_RESET|NOTIFY_RECORD|MODEL_EXECUTE/.test(e.args?.['Task Type']??''))
  const kernels=hardware.filter(e=>/^(AI_CORE|AI_VECTOR_CORE|MIX_AIC|MIX_AIV)$/.test(e.args?.['Task Type']??''))
  realCounts={records:hardware.length,waits:waits.length,controls:controls.length,kernels:kernels.length,execution:hardware.length-waits.length-controls.length}
}
try{
  for(const width of [360,390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],requests=[]
    page.setDefaultTimeout(30000)
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
    await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort())
    await page.goto(`${base}#/operators`,{waitUntil:'networkidle'})
    await expect(page.getByRole('heading',{name:'Profiling 分析工作台',exact:true})).toBeVisible()
    const upload=page.getByLabel('导入基线 A',{exact:true}),overview=page.getByLabel('数据与诊断总览',{exact:true})
    await upload.setInputFiles(fixture)
    const accounting=page.getByLabel('任务完整性',{exact:true})
    await expect(accounting.locator('output')).toHaveText(['34','31','2','1'])
    await expect(page.getByTestId('profile-import-reconciliation')).toContainText('30 / 30')
    await expect(page.getByLabel('优化候选证据',{exact:true})).toContainText('搬运活跃偏高')
    await page.locator('summary').filter({hasText:'Host 与汇总证据'}).click()
    await expect(page.getByLabel('原始阶段标记',{exact:true})).toContainText('TARGET_VERIFY')
    await page.getByLabel('汇总证据类型',{exact:true}).selectOption('framework')
    await expect(page.getByLabel('框架算子数据表',{exact:true})).toContainText('FrameworkSynthetic')
    assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_STACK_CANARY'))
    await page.getByLabel('汇总证据搜索',{exact:true}).fill('nonexistent')
    await expect(page.getByLabel('框架算子数据表',{exact:true}).locator('tbody tr')).toHaveCount(0)
    await page.getByLabel('汇总证据搜索',{exact:true}).fill('')
    await page.getByLabel('汇总证据类型',{exact:true}).selectOption('steps')
    await expect(page.getByLabel('Step 汇总数据表',{exact:true})).toContainText('未标注 Step')
    await page.getByRole('button',{name:'查看热点与计数器',exact:true}).first().click()
    await expect(page.getByLabel('热点流水线指标',{exact:true})).toContainText('80%')
    await expect(page.getByLabel('热点流水线指标',{exact:true})).toContainText('时长覆盖 100%')
    await expect(page.getByLabel('完整采样时间线',{exact:true})).toContainText('34 条')
    await page.getByLabel('时间线聚焦区间',{exact:true}).selectOption('63')
    await page.getByRole('button',{name:'分析所选时间区间',exact:true}).click()
    await expect(page.getByLabel('采样摘要',{exact:true})).toContainText('0 次调用')
    await page.getByRole('button',{name:'恢复完整时间范围',exact:true}).click()
    await expect(page.getByLabel('采样摘要',{exact:true})).toContainText('31 次调用')
    await page.getByRole('tab',{name:'数据与诊断总览',exact:true}).click()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`synthetic overflow ${width}`)
    // Replacement/clear must terminate the async worker; no stale completion.
    await upload.setInputFiles(fixture)
    await page.getByRole('button',{name:'清空基线 A',exact:true}).click()
    await expect(overview).toHaveCount(0)
    await upload.setInputFiles({name:'profile.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Duration(us)\nReplacement,3')})
    await expect(accounting.locator('output')).toHaveText(['1','1','0','0'])
    if(realDirectory){
      await page.getByLabel('导入基线 A目录',{exact:true}).setInputFiles(width===1440?sourceDirectory:realDirectory)
      const n=v=>v.toLocaleString('en-US')
      try{await expect(accounting.locator('output')).toHaveText([realCounts.records,realCounts.execution,realCounts.waits,realCounts.controls].map(n),{timeout:30000})}
      catch(error){console.error('Import state:',await page.getByRole('alert').allTextContents(),await page.getByRole('status').allTextContents());throw error}
      await expect(page.getByTestId('profile-import-reconciliation')).toContainText(`${n(realCounts.kernels)} / ${n(realCounts.kernels)}`)
      await expect(page.getByLabel('优化候选证据',{exact:true})).toContainText('查看热点与计数器')
      await page.locator('summary').filter({hasText:'Host 与汇总证据'}).click()
      for(const kind of ['operators','api','framework','steps']){
        await page.getByLabel('汇总证据类型',{exact:true}).selectOption(kind)
        await expect(page.getByLabel('独立汇总证据',{exact:true}).locator('tbody tr').first()).toBeVisible()
      }
      await page.getByRole('button',{name:'查看热点与计数器',exact:true}).first().click()
      await expect(page.getByLabel('热点流水线指标',{exact:true})).toContainText('次有效')
      await page.getByRole('tab',{name:'数据与诊断总览',exact:true}).click()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`real overflow ${width}`)
    }
    if(process.env.MODEL_QA_SCREENSHOTS){
      await page.evaluate(()=>scrollTo(0,0))
      await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`evidence-${width}.png`),fullPage:true})
    }
    const downloadPromise=page.waitForEvent('download')
    await page.getByRole('button',{name:'导出匿名统计',exact:true}).click()
    const download=await downloadPromise,exportText=await readFile(await download.path(),'utf8')
    for(const s of ['PRIVATE_STACK','TARGET_VERIFY','kernel_details','FrameworkSynthetic'])assert.ok(!exportText.includes(s))
    const stores=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},history:history.state}))
    for(const s of ['PRIVATE_STACK','TARGET_VERIFY','kernel_details','FrameworkSynthetic'])assert.ok(!stores.includes(s))
    assert.ok(requests.every(r=>r.method==='GET'&&!/PRIVATE_STACK|kernel_details|trace_view|ascend_pt/.test(r.url)))
    assert.deepEqual(errors,[])
    await page.close()
    console.log(`Evidence UI ${width}px passed: bundle join, accounting, candidates, metrics, summaries, replacement/cancel, privacy${realDirectory?', real local directory verified':''}.`)
  }
}finally{await browser.close()}
