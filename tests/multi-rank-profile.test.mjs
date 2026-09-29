import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRanks, anonymousRankReport, defaultRankConfig, mergeRankIntervals, rankInfo, rankIntersection, rankLimits, splitRankTraces } from '../src/lib/multi-rank-profile.ts'
import { importRankTexts, planRankImport } from '../src/lib/multi-rank-import.ts'
import { multiRankDemo } from '../src/lib/multi-rank-demo.ts'
import { importProfile } from '../src/lib/profile-import.ts'
import { profileBundleFixture } from './profile-bundle-fixture.mjs'
const event=(start,duration,kind='compute',role='execution',extra={})=>({name:'synthetic',type:'MatMul',shape:'',dtype:'',format:'',device:'0',stream:'1',step:'1',start,duration,kind,role,...extra})
const data=events=>({events,source:'csv',warnings:[],skipped:0,clockBaseUs:0})
const file=(name,text,path)=>({name,text,size:Buffer.byteLength(text),...(path?{path}:{})})
const clone=value=>structuredClone(value)

test('known four-rank straggler has exact unions, entry spread and wait intersection, not a critical path',()=>{
  const {traces,config}=multiRankDemo(),r=analyzeRanks(traces,config)
  assert.equal(r.rows.length,4);assert.equal(r.start,0);assert.equal(r.end,240)
  assert.equal(r.rows[0].compute,110);assert.equal(r.rows[3].compute,190)
  assert.equal(r.rows[0].communication,120);assert.equal(r.rows[3].communication,40)
  assert.equal(r.rows[0].wait,80);assert.equal(r.rows[0].waitOutsideExecution,0)
  assert.equal(r.pairing.spread,80);assert.deepEqual(r.pairing.latest,['r3'])
  assert.deepEqual(r.pairing.arrivals.map(r=>r.waitBeforeLast),[80,80,80,0])
  assert.equal(r.pairing.distinguishable,true);assert.equal(r.completionSpread,0)
  for(const row of r.rows){for(const key of ['compute','communication','wait'])assert.ok(Math.abs(row.bins.reduce((n,b)=>n+b[key]*2.5,0)-row[key])<1e-8)}
})

test('unconfirmed clock, workload and pairing independently gate cross-rank interpretation',()=>{
  const {traces,config}=multiRankDemo()
  for(const field of ['clockConfirmed','workloadConfirmed','pairingConfirmed']){
    const c={...config,[field]:false},r=analyzeRanks(traces,c)
    assert.equal(r.pairing.ready,false);assert.equal(r.pairing.spread,null)
    if(field!=='pairingConfirmed')assert.equal(r.completionSpread,null)
    assert.ok(r.pairing.reason)
  }
  const relative=analyzeRanks(traces,{...config,mode:'relative'})
  assert.equal(relative.synchronized,false);assert.equal(relative.completionSpread,null)
  assert.equal(relative.pairing.ready,false)
})

test('manual clock correction removes known skew without changing work; unknown error is not zero',()=>{
  const {traces,config}=multiRankDemo('clock')
  assert.equal(analyzeRanks(traces,config).pairing.ready,false)
  const corrected={...config,mode:'clock',clockConfirmed:true,workloadConfirmed:true,pairingConfirmed:true,ranks:config.ranks.map((r,i)=>({...r,offset:i===3?'-300':'0'}))}
  const r=analyzeRanks(traces,corrected)
  assert.equal(r.pairing.spread,0);assert.equal(r.pairing.distinguishable,false)
  assert.equal(r.completionSpread,0);assert.deepEqual(r.rows.map(r=>r.compute),[110,110,110,110])
  const unknown=analyzeRanks(traces,{...corrected,uncertainty:''})
  assert.equal(unknown.pairing.uncertainty,null);assert.equal(unknown.pairing.distinguishable,false)
  const skewed=analyzeRanks(traces,{...corrected,ranks:config.ranks,uncertainty:'200'})
  assert.equal(skewed.pairing.spread,300);assert.equal(skewed.pairing.distinguishable,false)
})

test('large decimal epoch bases differ across seconds; sub-microsecond offsets remain distinguishable',()=>{
  const make=ts=>importProfile(JSON.stringify([{ph:'X',cat:'kernel',pid:1,name:'hcom_allReduce',ts,dur:.05}]))
  const traces=splitRankTraces([make('1750000000999999.99'),make('1750000001000000.01')]),config=defaultRankConfig(traces)
  Object.assign(config,{mode:'clock',clockConfirmed:true,workloadConfirmed:true,pairingConfirmed:true,uncertainty:'0.001'})
  config.ranks.forEach(r=>{r.eventId='0'})
  const r=analyzeRanks(traces,config)
  assert.ok(Math.abs(r.pairing.spread-.02)<1e-8)
  assert.ok(Math.abs(r.rows[0].communication-.05)<1e-8)
  assert.equal(r.pairing.distinguishable,true)
})

test('independent rank/PID domains never merge, 64 ranks supported and labels validated',()=>{
  const traces=splitRankTraces(Array.from({length:64},()=>data([event(0,10)])))
  assert.equal(traces.length,64);assert.equal(analyzeRanks(traces,defaultRankConfig(traces)).rows.length,64)
  assert.equal(rankInfo(traces)[63].sourceIndex,63)
  assert.throws(()=>splitRankTraces(Array.from({length:65},()=>data([event(0,10)]))),/64/)
  const config=defaultRankConfig(traces);config.ranks[1].label='00'
  assert.throws(()=>analyzeRanks(traces,config),/不能重复/)
  config.ranks[1].label='999999';assert.equal(analyzeRanks(traces,config).rows[1].label,'999999')
  config.ranks[1].label='1000000';assert.throws(()=>analyzeRanks(traces,config),/999999/)
  assert.throws(()=>analyzeRanks(traces,{...config,ranks:[]}),/不一致/)
})

test('window clips crossing records, preserves identities and rejects partial communication pairing',()=>{
  const {traces,config}=multiRankDemo(),r=analyzeRanks(traces,{...config,window:{from:'120',to:'200'}})
  assert.equal(r.rows[0].communication,80);assert.equal(r.rows[0].wait,60)
  assert.equal(r.rows[3].compute,60);assert.equal(r.rows[3].communication,20)
  assert.equal(r.rows[0].selected.id,'2');assert.equal(r.pairing.ready,false);assert.match(r.pairing.reason,/跨出/)
  assert.equal(r.completionSpread,null)
  assert.throws(()=>analyzeRanks(traces,{...config,window:{from:'200',to:'120'}}),/起点/)
  assert.throws(()=>analyzeRanks(traces,{...config,window:{from:'Infinity',to:''}}),/有限/)
})

test('missing timestamps, empty steps, skipped rows, missing participant and no timestamp imports fail honestly',()=>{
  const {traces,config}=multiRankDemo();traces[0].data.events.push(event(undefined,5))
  const r=analyzeRanks(traces,config);assert.equal(r.rows[0].missing,1);assert.equal(r.rows[0].span,null);assert.equal(r.completionSpread,null)
  assert.ok(r.warnings.some(w=>w.includes('缺少起始时间')))
  const c=clone(config);c.ranks[1].step='missing';assert.throws(()=>analyzeRanks(traces,c),/没有该 Step/)
  c.ranks[1].step='';c.ranks[1].eventId='';assert.equal(analyzeRanks(traces,c).pairing.ready,false)
  c.ranks.forEach(r=>{r.included=false});assert.throws(()=>analyzeRanks(traces,c),/至少/)
  const unclocked=splitRankTraces([data([event(undefined,5)])]);assert.throws(()=>analyzeRanks(unclocked,defaultRankConfig(unclocked)),/Start Time/)
  const clean=multiRankDemo();clean.traces[0].data.skipped=1
  assert.equal(analyzeRanks(clean.traces,clean.config).completionSpread,null)
})

test('selection cannot silently pair a different event after step filtering',()=>{
  const traces=splitRankTraces([data([event(0,10,'communication','execution',{step:'1'}),event(20,10,'communication','execution',{step:'2'})])])
  const config=defaultRankConfig(traces);config.ranks[0].eventId='0';config.ranks[0].step='2'
  const row=analyzeRanks(traces,config).rows[0]
  assert.equal(row.selected,undefined);assert.equal(row.candidates[0].id,'1')
})

test('nested/repeated intervals use exact unions; randomized oracle checks bins and wait outside execution',()=>{
  assert.deepEqual(mergeRankIntervals([[1,5],[2,3],[5,7],[9,10],[4,4]]),[[1,7],[9,10]])
  assert.equal(rankIntersection([[1,7],[9,10]],[[3,8]]),4)
  let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
  for(let trial=0;trial<40;trial++){
    const events=Array.from({length:100},()=>event(Math.floor(random()*80),1+Math.floor(random()*10),['compute','communication','other'][Math.floor(random()*3)],random()<.3?'wait':'execution'))
    const traces=splitRankTraces([data(events)]),r=analyzeRanks(traces,defaultRankConfig(traces)),row=r.rows[0]
    let execution=0,wait=0,outside=0
    for(let t=0;t<100;t++){
      const at=events.filter(e=>e.start<=t&&e.start+e.duration>t),exec=at.some(e=>e.role==='execution'),waiting=at.some(e=>e.role==='wait')
      execution+=Number(exec);wait+=Number(waiting);outside+=Number(waiting&&!exec)
    }
    assert.equal(row.execution,execution);assert.equal(row.wait,wait);assert.equal(row.waitOutsideExecution,outside)
    for(const key of ['compute','communication','wait'])assert.ok(Math.abs(row.bins.reduce((n,b)=>n+b[key]*(r.end-r.start)/96,0)-row[key])<1e-7)
  }
})

test('anonymous numeric export omits raw names, ranks, sources, timestamps and corrections',()=>{
  const {traces,config}=multiRankDemo();config.ranks[0].label='123456';traces[0].data.events[2].name='PRIVATE_EVENT_CANARY'
  const output=anonymousRankReport(analyzeRanks(traces,config)),text=JSON.stringify(output)
  for(const secret of ['PRIVATE_EVENT_CANARY','123456','Expert GEMM','sourceIndex','offset','clockBaseUs','eventId','start'])assert.ok(!text.includes(secret))
  assert.equal(output.pairedCommunication.entrySpreadUs,80);assert.equal(output.ranks[0].id,'R1')
})

test('directory import groups companions per capture, reconciles duplicates and skips raw data without reads',()=>{
  const fixture=profileBundleFixture(),files=[...fixture.map(f=>({...f,path:`run/rank_a/ASCEND_PROFILER_OUTPUT/${f.name}`})),...fixture.map(f=>({...f,path:`run/rank_b/ASCEND_PROFILER_OUTPUT/${f.name}`})),
    {name:'private.db',path:'run/rank_a/ASCEND_PROFILER_OUTPUT/private.db',size:2**32},
    {name:'metadata.json',path:'run/rank_a/metadata.json',size:100},
    {name:'kernel_details.csv',path:'run/rank_a/intermediate/kernel_details.csv',size:100}]
  const plan=planRankImport(files);assert.equal(plan.groups.length,2);assert.equal(plan.ignored,3)
  const result=importRankTexts(files)
  assert.equal(result.traces.length,2);assert.equal(result.traces[0].data.events.length,34);assert.equal(result.traces[1].data.events.length,34)
  assert.equal(result.traces[0].sourceIndex,0);assert.equal(result.traces[1].sourceIndex,1)
  assert.ok(!JSON.stringify(result).includes('PRIVATE_STACK_CANARY'))
})

test('flat multi-file imports preserve independent ranks, units and reject wrong formats and budgets',()=>{
  const text='Name,Start Time(us),Duration(us),Device ID,Task Type\nMatMul,10,20,0,AI_CORE'
  assert.equal(importRankTexts([file('a.csv',text),file('b.csv',text)]).traces.length,2)
  assert.throws(()=>importRankTexts([file('bad.csv','Name,Duration(us)\nMatMul,no')]),/可用|有效/)
  assert.throws(()=>importRankTexts([file('bad.json','{')]),/JSON/)
  assert.throws(()=>planRankImport([{name:'kernel_details.csv',size:51*1024**2}]),/50 MiB/)
  assert.throws(()=>planRankImport(Array.from({length:6},(_,i)=>({name:`k${i}.csv`,size:50*1024**2}))),/256 MiB/)
  assert.throws(()=>planRankImport(Array.from({length:65},(_,i)=>({name:`k${i}.csv`,size:1}))),/64/)
  assert.throws(()=>planRankImport([{name:'private.db',size:10}]),/没有可读取/)
  assert.throws(()=>importRankTexts([{...file('a.csv',text),size:1}]),/字节数/)
  const noUnit='Name,Start Time,Duration\nMatMul,2,3'
  assert.throws(()=>importRankTexts([file('a.csv',noUnit)]),/没有明确单位/)
  assert.equal(importRankTexts([file('a.csv',noUnit)],'ms').traces[0].data.events[0].duration,3000)
})

test('large timelines include late events in all-record bins and bound candidate drawing only',()=>{
  const events=Array.from({length:20000},(_,i)=>event(i*10,5,i%2?'communication':'compute'))
  const traces=splitRankTraces([data(events)]),r=analyzeRanks(traces,defaultRankConfig(traces)),row=r.rows[0]
  assert.equal(row.calls,20000);assert.equal(row.compute,50000);assert.equal(row.communication,50000)
  assert.ok(row.bins.at(-1).communication>0);assert.equal(row.candidates.length,rankLimits.candidates)
  assert.equal(row.candidateCount,10000);assert.equal(row.candidateTruncated,true)
})
