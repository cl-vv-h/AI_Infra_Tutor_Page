import test from 'node:test'
import assert from 'node:assert/strict'
import { importProfile } from '../src/lib/profile-import.ts'
import { analyzeProfile, emptyProfileFilter, anonymousProfileReport } from '../src/lib/profile-analysis.ts'
import { defaultDiagnosticConfig, mergeRanges } from '../src/lib/profile-diagnostics.ts'
import { singleProfileDemo } from '../src/lib/profile-demo.ts'
const event=(type,start,duration,extra={})=>({name:type,type,start,duration,shape:'2,4',dtype:'bf16',format:'ND',device:'0',stream:'0',step:'',kind:'compute',...extra})
const data=(events,annotations=[])=>({events,annotations,source:'trace',warnings:[],skipped:0})
const host=(name,start,duration,source='h')=>({name,start,duration,source})
const config=(extra={})=>({...defaultDiagnosticConfig(),hostSource:'h',aligned:true,...extra})
const analyze=(d,c=config(),f=emptyProfileFilter())=>analyzeProfile(d,f,c).diagnostics
const phase=(d,p)=>d.phases.find(r=>r.phase===p)
test('single sample stage durations, scheduling unions, gaps and operator shares reconcile',()=>{
  const d=analyze(data([event('MatMul',0,40),event('RmsNorm',20,40),event('MatMul',120,40),event('RmsNorm',170,20)],
    [host('prefill',0,100),host('decode',120,80),host('scheduler',95,20),host('scheduler',105,10)]))
  assert.equal(phase(d,'prefill').wall,100)
  assert.equal(phase(d,'prefill').busy,60)
  assert.equal(phase(d,'prefill').work,80)
  assert.equal(phase(d,'prefill').groups[0].share,.5)
  assert.equal(phase(d,'decode').wall,80)
  assert.equal(d.scheduling.recorded,20)
  assert.equal(d.scheduling.betweenPhases,15)
  assert.equal(d.scheduling.phaseGap,20)
  assert.equal(d.scheduling.unrecordedGap,5)
  assert.equal(d.gaps.total,80)
  assert.equal(d.iterations.p50,80)
})
test('host domain opt-in, exact marker mapping, unrelated threads and kernel names',()=>{
  const input=data([event('prefill',0,20),event('MatMul',30,10)], [host('custom_forward',0,30),host('scheduler',20,5),host('decode',30,10000,'unrelated')])
  const no=analyze(input,defaultDiagnosticConfig())
  assert.equal(no.phaseBasis,'none');assert.equal(no.scheduling.recorded,null);assert.equal(phase(no,'prefill').wall,null)
  const yes=analyze(input,config({prefillName:'custom_forward'}))
  assert.equal(yes.phaseBasis,'annotations');assert.equal(phase(yes,'prefill').wall,30)
  assert.equal(phase(yes,'decode').wall,null)
  assert.equal(yes.scheduling.recorded,5)
  assert.equal(phase(yes,'unassigned').work,10)
})
test('manual phases override auto, clip crossing calls, preserve all work and reject invalid ranges',()=>{
  const input=data([event('MatMul',100,40),event('RmsNorm',150,50)],[host('decode',100,100)])
  const c=config({manual:[{phase:'prefill',from:0,to:20},{phase:'decode',from:30,to:100}]})
  const d=analyze(input,c)
  assert.equal(d.phaseBasis,'manual');assert.equal(phase(d,'prefill').work,20)
  assert.equal(phase(d,'decode').work,60);assert.equal(phase(d,'unassigned').work,10)
  assert.equal(d.phases.reduce((s,p)=>s+p.work,0),90)
  assert.equal(phase(d,'prefill').clipped,1)
  for(const manual of [[{phase:'prefill',from:0,to:101}],[{phase:'prefill',from:-1,to:10}],[{phase:'decode',from:10,to:1}]])assert.throws(()=>analyze(input,config({manual})),/手动阶段/)
})
test('nested and cross-phase ranges do not double count and ambiguous decode steps are disabled',()=>{
  const d=analyze(data([event('A',0,100)], [host('prefill',0,60),host('prefill',10,20),host('decode',40,60),host('decode',50,10)]))
  assert.equal(phase(d,'prefill').work,40);assert.equal(phase(d,'conflict').work,20);assert.equal(phase(d,'decode').work,40)
  assert.equal(d.iterations.p50,null);assert.equal(d.iterations.count,0)
  assert.match(d.warnings.join(),/重叠/)
  const cross=analyze(data([event('A',0,100)],[host('prefill',0,60),host('decode',40,60)]))
  assert.equal(cross.iterations.count,0)
})
test('Decode per-step distribution and synthetic example have verifiable numeric values',()=>{
  const a=analyzeProfile(importProfile(singleProfileDemo()),emptyProfileFilter(),config({hostSource:'pid:1/tid:0'})),d=a.diagnostics
  assert.equal(a.count,19);assert.equal(phase(d,'prefill').wall,2000)
  assert.equal(phase(d,'decode').wall,3550)
  assert.equal(d.iterations.count,8);assert.equal(d.iterations.p50,400)
  assert.ok(Math.abs(d.iterations.p95-627.5)<1e-9)
  assert.equal(d.scheduling.recorded,800);assert.equal(d.scheduling.betweenPhases,800)
  assert.equal(d.counterCalls,18)
  const matmul=d.utilization.find(r=>r.type==='MatMul')
  assert.equal(matmul.samples,9);assert.equal(matmul.lowCalls,8);assert.equal(matmul.lowWork,1710)
  assert.ok(Math.abs(matmul.mean-(1200*75+1710*18)/2910)<1e-9)
})
test('CSV counters preserve 0, explicit percentages, unknown units, invalid values and missing coverage',()=>{
  const csv='Name,Type,Duration(us),aic_mac_ratio,aiv_vec_ratio(%)\na,MatMul,10,0,\nb,MatMul,30,0.5,\nc,MatMul,20,N/A,\nd,RmsNorm,10,0,20\ne,RmsNorm,10,0,150'
  const input=importProfile(csv),auto=analyze(input)
  assert.equal(auto.utilization.find(r=>r.type==='MatMul').mean,null)
  assert.equal(auto.utilization.find(r=>r.type==='RmsNorm').mean,20)
  const d=analyze(input,config({ratioUnit:'fraction'})),r=d.utilization.find(r=>r.type==='MatMul')
  assert.equal(r.mean,37.5);assert.equal(r.samples,2);assert.equal(r.calls,3)
  assert.equal(r.measuredWork,40);assert.equal(r.totalWork,60);assert.equal(r.lowWork,10)
  assert.equal(d.utilization.find(r=>r.type==='RmsNorm').samples,1)
  assert.match(d.warnings.join(),/超出/)
  assert.equal(analyze(input,config({ratioUnit:'percent'})).utilization.find(r=>r.type==='MatMul').mean,.375)
  assert.throws(()=>analyze(input,config({threshold:NaN})),/阈值/)
  const percent=analyze(importProfile('Name,Duration(us),aic_mac_ratio\nMatMul,1,25%'))
  assert.equal(percent.utilization[0].mean,25)
})
test('CSV Phase/Step uses task envelopes; Rank ID isolates separate clock domains',()=>{
  const input=importProfile('Name,Duration(us),Start Time(us),Phase,Step ID,Device ID,Rank ID\nMatMul,10,100,prefill,0,0,0\nMatMul,10,200,decode,1,0,0\nRmsNorm,10,220,decode,1,0,0\nMatMul,10,300,decode,2,0,0\nMatMul,9999,100,prefill,0,0,1')
  const a=analyzeProfile(input),d=a.diagnostics
  assert.equal(a.count,4);assert.equal(a.devices.length,2);assert.equal(d.phaseBasis,'task-labels')
  assert.equal(phase(d,'decode').wall,40);assert.equal(d.iterations.p50,20)
  assert.equal(d.scheduling.recorded,null)
  const noStep=analyze(importProfile('Name,Duration(us),Phase\nMatMul,10,decode'))
  assert.equal(phase(noStep,'decode').wall,null);assert.equal(phase(noStep,'decode').work,10);assert.equal(noStep.iterations.count,0)
})
test('randomized phase clipping matches independent cell oracle, including gaps and overlaps',()=>{
  let seed=137;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
  for(let n=0;n<80;n++) {
    const events=[event('A',0,1),event('B',59,1),...Array.from({length:20},()=>event('C',Math.floor(rand()*45),1+Math.floor(rand()*15)))]
    const annotations=Array.from({length:12},()=>host(rand()>.5?'prefill':'decode',Math.floor(rand()*45),1+Math.floor(rand()*15)))
    const d=analyze(data(events,annotations)),expected={prefill:0,decode:0,conflict:0,unassigned:0}
    for(let t=0;t<60;t++) {
      const active=annotations.filter(a=>a.start<=t&&a.start+a.duration>t),p=active.some(a=>a.name==='prefill'),v=active.some(a=>a.name==='decode')
      const k=p&&v?'conflict':p?'prefill':v?'decode':'unassigned'
      expected[k]+=events.filter(e=>e.start<=t&&e.start+e.duration>t).length
    }
    for(const p of d.phases)assert.equal(p.work,expected[p.phase])
  }
})
test('diagnostic report is whitelisted, not a serialization of filenames, annotations or configuration',()=>{
  const input=data([event('MatMul /secret/',0,10,{counters:{cube:{value:20,percent:true}}})],[host('secret_phase',0,10,'private/thread')])
  const a=analyzeProfile(input,emptyProfileFilter(),config({hostSource:'private/thread',prefillName:'secret_phase'}))
  const text=JSON.stringify(anonymousProfileReport(a))
  assert.ok(!/secret|private|thread|2,4|hostSource|manual/.test(text))
  assert.equal(JSON.parse(text).singleProfile.phases[0].wallUs,10)
})
test('many decode markers are processed without stack spreading; full counts survive chart limits',()=>{
  const events=Array.from({length:30000},(_,i)=>event('MatMul',i*10+1,8))
  const annotations=Array.from({length:30000},(_,i)=>host('decode',i*10,10))
  const d=analyze(data(events,annotations))
  assert.equal(d.iterations.count,30000);assert.equal(d.iterations.rows.length,200)
  assert.equal(phase(d,'decode').wall,300000);assert.equal(phase(d,'decode').work,240000)
  assert.equal(d.iterations.truncated,true)
  assert.deepEqual(mergeRanges([{start:0,end:10},{start:10,end:20}]),[{start:0,end:20}])
})
