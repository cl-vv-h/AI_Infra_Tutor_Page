import test from 'node:test'
import assert from 'node:assert/strict'
import { importProfile } from '../src/lib/profile-import.ts'
import { analyzeProfile, anonymousProfileReport, emptyProfileFilter } from '../src/lib/profile-analysis.ts'
import { importProfileBundle, planProfileImport, parseProfileSummary } from '../src/lib/profile-bundle.ts'
import { profileClockBase, profileTimestamp } from '../src/lib/profile-clock.ts'
import { profileBundleFixture } from './profile-bundle-fixture.mjs'
import { profileTimeline, timelineBins } from '../src/lib/profile-timeline.ts'

test('CANN decimal epochs retain nanosecond-scale tasks and aligned Host markers', () => {
  const text=JSON.stringify([
    {ph:'M',name:'process_name',pid:1,args:{name:'Ascend Hardware'}},
    {ph:'X',pid:1,tid:2,name:'DAVID_EVENT_RECORD',ts:'1750000000000000.010',dur:.007,args:{'Task Type':'DAVID_EVENT_RECORD','Task Id':1,'Physic Stream Id':4}},
    {ph:'X',pid:1,tid:2,name:'MatMul',ts:'1750000000000000.040',dur:2,args:{'Task Type':'AI_CORE','Task Id':2,'Physic Stream Id':4}},
    {ph:'X',pid:2,tid:1,name:'forward_decode',ts:'1750000000000000.005',dur:3},
  ])
  const d=importProfile(text)
  assert.equal(d.skipped,0);assert.equal(d.events.length,2)
  assert.equal(d.events[0].start,.010);assert.equal(d.events[0].duration,.007)
  assert.equal(d.events[0].role,'control');assert.equal(d.events[0].stream,'4')
  assert.equal(d.annotations[0].start,.005)
  assert.equal(d.clockBaseUs,1750000000000000)
})

test('epoch second boundaries do not round the common origin into the future',()=>{
  for(const [value,scale,expected] of [['1750000000999999.999',1,999999.999],['1750000000999999999.9',.001,999999.9999]]){
    const base=profileClockBase([value],scale)
    assert.equal(base,1750000000000000)
    assert.ok(Math.abs(profileTimestamp(value,scale,base)-expected)<1e-7)
  }
})

test('companion files reconcile repeated IDs, DMA aliases and wait/control roles without double counting',()=>{
  const d=importProfileBundle(profileBundleFixture()),a=analyzeProfile(d),h=a.hardware
  assert.equal(d.events.length,34);assert.equal(d.evidence.joinedKernels,30)
  assert.equal(d.skipped,0);assert.equal(h.execution,31);assert.equal(h.waits,2);assert.equal(h.controls,1)
  assert.equal(a.total,245);assert.equal(h.waitWork,14);assert.equal(h.waitCoverage,14);assert.equal(h.waitOutsideExecution,10)
  assert.equal(d.evidence.files.find(f=>f.kind==='tasks').status,'duplicate')
  assert.deepEqual(d.evidence.tables.map(t=>[t.kind,t.rows.length]),[['operators',1],['api',1],['framework',1],['steps',1]])
  assert.ok(!JSON.stringify(d).includes('PRIVATE_STACK_CANARY'))
  assert.equal(h.markers[0].name,'step[TARGET_VERIFY bs=2]')
  assert.equal(a.diagnostics.phaseBasis,'none')
  assert.equal(h.pipelines.find(p=>p.metric==='cube').mean,5)
  assert.equal(h.pipelines.find(p=>p.metric==='cubeUtilization').mean,50)
  assert.ok(h.candidates.some(c=>c.key.startsWith('mte:')))
  assert.ok(h.candidates.some(c=>c.key.startsWith('short:')))
  assert.equal(h.summaries.reconciliation[0].status,'matched')
  assert.equal(h.summaries.reconciliation[0].detailCalls,30)
  assert.equal(h.summaries.hostSignals.find(s=>s.name==='FrameworkSynthetic').work,4,'Host Self, not inclusive Host Total')
  const filtered=analyzeProfile(d,{...emptyProfileFilter(),stream:'3'})
  assert.equal(filtered.count,0);assert.equal(filtered.hardware.records,3)
  assert.equal(filtered.hardware.waitOutsideExecution,14)
  assert.equal(filtered.hardware.evidence.hardwareRecords,34,'import totals are explicitly full-capture evidence')
  assert.equal(filtered.hardware.summaries.reconciliation[0].status,'matched','summary comparison retains whole-capture scope')
  const exported=JSON.stringify(anonymousProfileReport(a))
  for(const text of ['MatMulSynthetic','FrameworkSynthetic','TARGET_VERIFY','kernel_details','1750000','PRIVATE_STACK'])assert.ok(!exported.includes(text))
})

test('bundle planning skips raw bytes and intermediate outputs but rejects mixed captures and oversize reads',()=>{
  const final=profileBundleFixture().map(f=>({...f,path:`capture/ASCEND_PROFILER_OUTPUT/${f.name}`}))
  const files=[...final,{name:'private.db',path:'capture/ASCEND_PROFILER_OUTPUT/private.db',size:2**32},{name:'kernel_details.csv',path:'capture/intermediate/kernel_details.csv',size:100},{name:'metadata.json',path:'capture/metadata.json',size:100}]
  const plan=planProfileImport(files)
  assert.equal(plan.at(-3).status,'unsupported');assert.equal(plan.at(-2).status,'duplicate');assert.equal(plan.at(-1).status,'unsupported')
  assert.equal(importProfileBundle(files).events.length,34,'unsupported data never needs text')
  assert.throws(()=>planProfileImport([...final,{...final[0],path:'other/ASCEND_PROFILER_OUTPUT/kernel_details.csv'}]),/多个同类/)
  assert.throws(()=>planProfileImport(final.map((f,i)=>i===0?{...f,size:51*1024**2}:f)),/50 MiB/)
  assert.throws(()=>planProfileImport([{name:'op_statistic.csv',size:5}]),/逐任务/)
  assert.throws(()=>planProfileImport(final.map((f,i)=>i===0?{...f,path:'other/ASCEND_PROFILER_OUTPUT/kernel_details.csv'}:f)),/不同输出目录/)
})

test('incompatible captures and ambiguous repeated task matches fail closed',()=>{
  const files=profileBundleFixture()
  const mismatch=files.map(f=>f.name==='kernel_details.csv'?{...f,text:f.text.replace('1750000000000010','1750000000009999')}:f)
  assert.throws(()=>importProfileBundle(mismatch),/无法逐任务唯一对账/)
  const ambiguous=files.map(f=>{if(f.name!=='trace_view.json')return f;const events=JSON.parse(f.text);events.push(events[1]);return {...f,text:JSON.stringify(events)}})
  assert.throws(()=>importProfileBundle(ambiguous),/无法逐任务唯一对账/)
})

test('summary schema and invalid rows are explicit; missing clocks yield unknown wait coverage',()=>{
  const table=parseProfileSummary('Device_id,OP Type,Count,Total Time(us)\n0,A,2,3\n0,B,1,-5','operators')
  assert.equal(table.rows.length,1);assert.equal(table.rejected,1)
  assert.throws(()=>parseProfileSummary('OP Type,Avg Time(us)\nA,4','operators'),/累计时间/)
  const d=importProfile('Name,Type,Duration(us)\nwait,NOTIFY_WAIT,12\ncompute,AI_CORE,5')
  const h=analyzeProfile(d).hardware
  assert.equal(h.waitOutsideExecution,null);assert.equal(h.waitCoverage,null)
})

test('full timeline includes late tasks and union coverage rather than summed work',()=>{
  const base={name:'x',type:'x',shape:'',dtype:'',format:'',device:'0',stream:'0',step:'',kind:'compute',duration:32,start:100}
  const timeline=profileTimeline([base,{...base,start:116},{...base,start:100,role:'wait',duration:64},{...base,start:163,duration:1,stream:'last'}],100)
  assert.equal(timeline.start,0);assert.equal(timeline.end,64)
  assert.equal(timelineBins(timeline,timeline.lanes[0]).reduce((s,b)=>s+b.execution,0),48)
  assert.equal(timelineBins(timeline,timeline.lanes[0]).reduce((s,b)=>s+b.wait,0),64)
  assert.equal(timelineBins(timeline,timeline.lanes[1])[63].execution,1)
  assert.equal(profileTimeline([{...base,start:undefined}],0).missing,1)
  const many=profileTimeline(Array.from({length:5000},(_,i)=>({...base,stream:String(i)})),100)
  assert.equal(many.lanes.length,5000)
  assert.ok(JSON.stringify(many).length<600000,'sparse stream storage must not allocate 64 bins per stream')
})

test('recognized CANN schema auto-decodes fractional pipes but keeps Cube utilization independent', () => {
  const text='Device_id,Task ID,Stream ID,Name,Type,Accelerator Core,Start Time(us),Duration(us),aic_total_cycles,aic_mac_ratio,aic_mte2_ratio,aic_mte3_ratio,aic_fixpipe_ratio,cube_utilization(%)\n0,1,2,matmul,MatMul,AI_CORE,1750000000000000.027,10,1000,0.35,0.72,0.1,0.09,82'
  const d=importProfile(text),a=analyzeProfile(d)
  assert.equal(d.events[0].start,.027)
  assert.equal(a.diagnostics.utilization[0].mean,35)
  assert.equal(d.events[0].counters.cubeUtilization.value,82)
  assert.equal(d.events[0].counters.cubeUtilization.percent,true)
  assert.equal(d.events[0].counters.aicMte3.fraction,true)
  assert.equal(d.events[0].counters.fixpipe.value,.09)
  assert.equal(analyzeProfile(importProfile('Name,Duration(us),aic_mac_ratio\nMatMul,10,.35')).diagnostics.utilization[0].mean,null)
})
