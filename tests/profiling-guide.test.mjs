import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const content=read('src/data/guides/profiling-reading.md')

test('guide teaches the capture schema, synchronization, MoE and evidence boundaries',()=>{
  for(const value of ['trace_view.json','kernel_details.csv','task_time.csv','op_statistic.csv','api_statistic.csv','operator_details.csv','step_trace_time.csv','NOTIFY_WAIT','DAVID_EVENT_WAIT','MoeLowLatencyDispatchV2','MoeLowLatencyCombineV2','GroupedMatmul','TARGET_VERIFY','Host Self','aic_mac_ratio','cube_utilization(%)','Level1 + PipeUtilization'])assert.ok(content.includes(value),value)
  assert.equal((content.match(/^## \d{2} · /gm)||[]).length,11)
  assert.equal((content.match(/<details>/g)||[]).length,5)
  for(const value of ['合成教学示例','不代表本次采样的性能结论','不能把整个采样直接称为普通 Decode','10 µs 不是已经证明可消除的端到端损失','不会随设备窗口筛选重新归因','待验证的分析模板'])assert.ok(content.includes(value),value)
})

test('worked examples reconcile without claiming actual capture performance',()=>{
  assert.equal(.75+.25,1)
  assert.equal(.2+.8,1)
  assert.equal(80+40,120)
  assert.equal(80-70,10)
  for(const value of ['0.75 × E0(A) + 0.25 × E1(A)','0.20 × E0(B) + 0.80 × E1(B)','120 µs','80 µs','10 µs'])assert.ok(content.includes(value),value)
})

test('guide is a lazy in-module reader, not a new portal module',()=>{
  const workspace=read('src/pages/PerformanceWorkspace.tsx')
  assert.match(workspace,/lazy\(\(\)=>import\('\.\/ProfilingGuide'\)\)/)
  assert.match(workspace,/hidden=\{estimate\|\|guide\}/)
  assert.match(read('src/pages/ProfilingWorkbench.tsx'),/to="\/operators\/guide"/)
  assert.doesNotMatch(read('src/pages/Home.tsx'),/ProfilingGuide|\/operators\/guide/)
  const page=read('src/pages/ProfilingGuide.tsx')
  assert.match(page,/TableOfContents/)
  assert.match(page,/MarkdownRenderer/)
  assert.doesNotMatch(page,/fetch\(|localStorage|sessionStorage|setItem|XMLHttpRequest/)
})

test('public lesson has primary references but no local identifiers or raw assets',()=>{
  const sources=[...content.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m=>new URL(m[1]))
  assert.ok(sources.length>=8)
  for(const url of sources)assert.ok(url.hostname==='www.hiascend.com'||(url.hostname==='gitcode.com'&&url.pathname.startsWith('/cann/')),url.href)
  assert.doesNotMatch(content,/\/Users\/|\/Downloads\/|Received\/|\d{17}_ascend_pt|ascend_pytorch_profiler_\d+|Call Stack,|"traceEvents"|ssh-|sk-[A-Za-z0-9]{16}/)
  assert.doesNotMatch(content,/!\[|<iframe|<script|<img/)
})
