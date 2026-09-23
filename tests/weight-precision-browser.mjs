import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require=createRequire(import.meta.url)
const modulePath=process.env.MODEL_QA_PLAYWRIGHT || 'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE || 'http://127.0.0.1:4185/AI_Infra_Tutor_Page/'
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
let checks=0
try {
  for(const width of [360,390,768,1440]) {
    const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
    page.setDefaultTimeout(15000)
    const fit=async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++}
    const params=()=>new URLSearchParams(new URL(page.url()).hash.split('?')[1])
    const saved=()=>JSON.parse(params().get('pw')||'[]')
    await page.goto(`${base}#/models/glm-5-2?view=weights&layer=3&node=moe&tp=4&ep=2&precision=mixed`,{waitUntil:'networkidle'})
    const controls=page.getByRole('region',{name:'按模块选择精度',exact:true})
    await controls.getByRole('button',{name:'应用预设：Dense FP8 / Experts BF16',exact:true}).click()
    await expect(controls.getByLabel('Dense MLP 精度',{exact:true})).toHaveValue('fp8')
    await expect(controls.getByLabel('Routed MoE 精度',{exact:true})).toHaveValue('bf16')
    const editor=page.getByLabel('逐权重精度',{exact:true})
    await editor.locator(':scope > summary').click()
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('dense-ffn')
    await editor.getByLabel('gate_proj 权重格式',{exact:true}).selectOption('int8')
    await editor.getByLabel('up_proj 权重格式',{exact:true}).selectOption('nvfp4')
    await editor.getByLabel('down_proj 权重格式',{exact:true}).selectOption('bf16')
    await expect.poll(()=>saved().length).toBe(3)
    await fit()
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('moe')
    await editor.getByLabel('experts.gate_proj 权重格式',{exact:true}).selectOption('mxfp4')
    await editor.getByLabel('experts.up_proj 权重格式',{exact:true}).selectOption('bf16')
    await editor.getByLabel('experts.down_proj 权重格式',{exact:true}).selectOption('int8')
    await editor.getByLabel('gate.weight 权重格式',{exact:true}).selectOption('bf16')
    await editor.getByLabel('精度覆盖范围',{exact:true}).selectOption('layer')
    await editor.getByLabel('experts.down_proj 权重格式',{exact:true}).selectOption('fp32')
    await expect.poll(()=>saved().some(([k,f])=>k==='3/moe/experts.down_proj'&&f==='fp32')).toBe(true)
    await fit()
    if(process.env.MODEL_QA_SCREENSHOTS) {
      await editor.scrollIntoViewIfNeeded()
      await page.screenshot({path:join(process.env.MODEL_QA_SCREENSHOTS,`precision-${width}.png`),animations:'disabled'})
    }
    const url=page.url();await page.reload({waitUntil:'networkidle'})
    await expect(page).toHaveURL(url)
    await editor.locator(':scope > summary').click()
    await editor.getByLabel('精度覆盖范围',{exact:true}).selectOption('layer')
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('moe')
    await expect(editor.getByLabel('experts.down_proj 权重格式',{exact:true})).toHaveValue('fp32')
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('attention-norm')
    await expect(editor.getByLabel('input_layernorm.weight 权重格式',{exact:true}).locator('option')).toHaveCount(4)
    await editor.getByRole('button',{name:'清除全部逐权重覆盖',exact:true}).click()
    await expect(page).not.toHaveURL(/pw=/)
    await fit()
    // Every new coarse format is selectable and shareable without affecting other groups.
    for(const format of ['fp16','fp32','fp8_tensor','int8','int4','mxfp4','nvfp4']) {
      await controls.getByLabel('Dense MLP 精度',{exact:true}).selectOption(format)
      await expect(page).toHaveURL(new RegExp(`mlp=${format}(?:&|$)`))
      await expect(controls.getByLabel('Routed MoE 精度',{exact:true})).toHaveValue('bf16')
      await fit()
    }
    await page.goto(`${base}#/models/qwen3-8b/dpa?tp=8&dp=4&ep=1&layer=3&precision=mixed`,{waitUntil:'networkidle'})
    await editor.locator(':scope > summary').click()
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('gqa')
    await editor.getByLabel('k_proj 权重格式',{exact:true}).selectOption('int8')
    await editor.getByLabel('v_proj 权重格式',{exact:true}).selectOption('nvfp4')
    await expect.poll(()=>saved().length).toBe(2)
    await page.reload({waitUntil:'networkidle'})
    await editor.locator(':scope > summary').click()
    await editor.getByLabel('精度权重模块',{exact:true}).selectOption('gqa')
    await expect(editor.getByLabel('k_proj 权重格式',{exact:true})).toHaveValue('int8')
    await expect(editor.getByLabel('v_proj 权重格式',{exact:true})).toHaveValue('nvfp4')
    await fit()
    assert.deepEqual(errors,[])
    await page.close()
    console.log(`Per-weight browser passed at ${width}px: defaults, separate Gate/Up/Down, Router, layer override, reload, all formats and DPA K/V.`)
  }
  console.log(`${checks} per-weight layout checks passed.`)
} finally {await browser.close()}
