import test from 'node:test'
import assert from 'node:assert/strict'
import { importProfile,parseCsv,profileLimits } from '../src/lib/profile-import.ts'
import { analyzeProfile,intervalCoverage,emptyProfileFilter,compareProfiles,anonymousProfileReport,workWhatIf } from '../src/lib/profile-analysis.ts'
import { demoProfile } from '../src/lib/profile-demo.ts'
import { profileEstimateCandidate,transferProfileSample,peekProfileSample,clearProfileSample } from '../src/lib/profile-estimate-bridge.ts'
const csv=(rows,header=['Name','Type','Task Start Time(us)','Task Duration(us)','Input Shapes','Input Data Types','Input Formats','Device ID','Stream ID','Step ID'])=>[header,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
const row=(name,start,dur,stream=0,device=0,shape='2,4;4,3')=>[name,name,start,dur,shape,'BF16;BF16','ND;ND',device,stream,0]
const e=(type,start,duration,kind='compute',extra={})=>({name:type,type,start,duration,shape:'2,4',dtype:'bf16',format:'ND',device:'0',stream:'0',step:'',kind,...extra})
test('CSV handles BOM, quotes, escaped quotes, embedded newlines and CRLF',()=>{
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello,world","line1\nline2"\r\n"say ""hi""",2'),[['a','b'],['hello,world','line1\nline2'],['say "hi"','2']])
  assert.throws(()=>parseCsv('a,b\n"oops,1'),/未闭合/)
  assert.throws(()=>parseCsv('a,b\n"ok"oops,1'),/非法/)
})
test('CANN aliases and time units use task time not aicore time',()=>{
  const d=importProfile(csv([['a','MatMul',1,2,999]],['OP Name','OP Type','Start Time(ms)','Duration(ms)','aicore_time(us)']))
  assert.equal(d.events[0].start,1000);assert.equal(d.events[0].duration,2000)
  assert.throws(()=>importProfile('Name,aicore_time(us)\na,10'),/不能用/)
  assert.throws(()=>importProfile('Name,Duration\na,10'),/没有明确单位/)
  assert.equal(importProfile('Name,Duration\na,10','ms').events[0].duration,10000)
  assert.equal(importProfile('Name,Duration(ns)\na,2000').events[0].duration,2)
})
test('malformed records are counted, aggregate input rejected, bad durations never become zero',()=>{
  const data=importProfile(csv([row('good',0,10),row('bad',0,'N/A'),row('negative',0,-3),row('not-finite',0,'Infinity'),['wrong','columns']]))
  assert.equal(data.events.length,1);assert.equal(data.skipped,4)
  assert.throws(()=>importProfile('Name,Duration(us),Count\na,10,30'),/聚合/)
  assert.throws(()=>importProfile('Name,Duration(us),Duration(us)\na,10,30'),/重复/)
})
test('Chrome Trace identifies hardware process rather than mixing Python/CANN/HCCL API ranges',()=>{
  const raw=[{ph:'M',name:'process_name',pid:4,args:{name:'Ascend Hardware'}},{ph:'M',name:'process_name',pid:5,args:{name:'CANN'}},
    {ph:'X',pid:4,tid:0,name:'MatMul',ts:100,dur:10,args:{'Task Type':'AI_CORE','Input Shapes':[[2,4],[4,3]],'Input Data Types':['BF16','BF16'],'Input Formats':['ND','ND']}},
    {ph:'X',pid:5,tid:0,name:'aclnnMatMul',ts:50,dur:500},{ph:'X',pid:1,name:'python',ts:0,dur:1000},
    {ph:'B',pid:4,name:'unpaired',ts:100}]
  const data=importProfile(JSON.stringify({traceEvents:raw,displayTimeUnit:'ns'}))
  assert.equal(data.events.length,1);assert.equal(data.events[0].duration,10)
  assert.equal(data.events[0].shape,'2,4;4,3');assert.equal(data.events[0].dtype,'bf16;bf16')
  assert.match(data.warnings.join(),/B\/E/)
  const a=analyzeProfile(data),b=analyzeProfile(importProfile(csv([row('MatMul',0,20)])))
  assert.equal(compareProfiles(a,b).matched,1)
})
test('trace fallback accepts only kernel categories, rejects truncated or host-only trace',()=>{
  assert.equal(importProfile(JSON.stringify([{ph:'X',cat:'kernel',name:'x',ts:0,dur:1}])).events.length,1)
  assert.throws(()=>importProfile(JSON.stringify([{ph:'X',cat:'cpu_op',name:'aten::matmul',ts:0,dur:1}])),/设备任务/)
  assert.throws(()=>importProfile('[{"ph":"X"'),/截断/)
})
test('sweep computes unions, gaps, overlap and group-exclusive coverage independently',()=>{
  const data={events:[e('MatMul',0,10),e('HcclAllReduce',5,10,'communication'),e('RmsNorm',20,5)],warnings:[],source:'csv',skipped:0}
  const a=analyzeProfile(data)
  assert.equal(a.total,25);assert.equal(a.span,25);assert.equal(a.busy,20);assert.equal(a.idle,5)
  assert.equal(a.overlap,5);assert.equal(a.computeCommunication,5);assert.equal(a.exposedCommunication,5)
  assert.equal(a.groups.find(g=>g.type==='MatMul').exclusive,5)
  assert.equal(a.groups.find(g=>g.type==='HcclAllReduce').exclusive,5)
})
test('touching, identical and nested intervals use correct union semantics',()=>{
  const x=intervalCoverage([e('A',0,10),e('A',0,10),e('A',2,2),e('B',10,10)])
  assert.equal(x.busy,20);assert.equal(x.overlap,10);assert.equal(x.maxConcurrency,3)
  assert.equal([...x.exclusive.values()].reduce((a,b)=>a+b,0),20)
})
test('sweep matches independent unit-cell oracle for randomized integer intervals',()=>{
  let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
  for(let trial=0;trial<100;trial++){
    const es=Array.from({length:20},(_,i)=>e(i%3?'A':'B',Math.floor(random()*30),1+Math.floor(random()*10),i%3?'compute':'communication'))
    const r=intervalCoverage(es);let busy=0,overlap=0,comm=0,intersection=0
    for(let t=0;t<40;t++){const active=es.filter(x=>x.start<=t&&x.start+x.duration>t);if(active.length)busy++;if(active.length>1)overlap++;if(active.some(x=>x.kind==='communication'))comm++;if(active.some(x=>x.kind==='communication')&&active.some(x=>x.kind==='compute'))intersection++}
    assert.deepEqual([r.busy,r.overlap,r.comm,r.computeComm],[busy,overlap,comm,intersection])
  }
})
test('device domains never share timeline; filters keep full calls only',()=>{
  const data=importProfile(csv([row('A',1000,10,0,0),row('A',2000,10,0,1),row('A',1020,20,1,0)]))
  const a=analyzeProfile(data);assert.equal(a.count,2);assert.equal(a.span,40)
  const b=analyzeProfile(data,{...emptyProfileFilter(),device:'1'});assert.equal(b.count,1);assert.equal(b.span,10)
  const c=analyzeProfile(data,{...emptyProfileFilter(),from:'5',to:'40'});assert.equal(c.count,1);assert.equal(c.total,20)
  assert.throws(()=>analyzeProfile(data,{...emptyProfileFilter(),from:'40',to:'5'}),/时间窗口/)
})
test('missing timestamps yield no fake idle, span or exclusive coverage',()=>{
  const a=analyzeProfile(importProfile('Name,Duration(us)\nA,10\nB,20'))
  assert.equal(a.total,30);assert.equal(a.span,null);assert.equal(a.busy,null);assert.equal(a.groups[0].exclusive,null)
})
test('quantiles and long-tail/high-frequency findings are observational',()=>{
  const a=analyzeProfile({events:Array.from({length:40},(_,i)=>e('Add',i*100,i>=35?100:5)),warnings:[],source:'csv',skipped:0})
  assert.equal(a.groups[0].median,5);assert.equal(a.groups[0].p95,100)
  assert.equal(a.groups[0].findings.length,2)
})
test('A/B separates call volume from per-call regression, detects added/missing/incomplete groups',()=>{
  const data=events=>({events,warnings:[],source:'csv',skipped:0})
  const a=analyzeProfile(data([e('A',0,10),e('A',20,10),e('gone',30,5),e('unknown',40,5,'compute',{shape:''})]))
  const b=analyzeProfile(data([e('A',0,20),e('new',30,5),e('unknown',40,5,'compute',{shape:''})]))
  const d=compareProfiles(a,b),matched=d.rows.find(r=>r.type==='A')
  assert.equal(matched.medianRatio,2);assert.equal(matched.observedDelta,0);assert.equal(matched.normalizedDelta,20)
  assert.equal(d.rows.find(r=>r.type==='gone').status,'消失');assert.equal(d.rows.find(r=>r.type==='new').status,'新增')
  assert.equal(d.rows.find(r=>r.type==='unknown').medianRatio,null)
})
test('work what-if is bounded and exported reports omit all private strings',()=>{
  const a=analyzeProfile(importProfile(csv([row('/private/secret-token',1000,10)])))
  const r=workWhatIf(a,a.groups[0].key,2);assert.equal(r.saved,5);assert.equal(r.workSpeedup,2)
  assert.throws(()=>workWhatIf(a,a.groups[0].key,0))
  const text=JSON.stringify(anonymousProfileReport(a,a))
  for(const needle of ['secret-token','2,4;4,3','bf16','pid','1000','origin','selectedDevice'])assert.ok(!text.includes(needle),needle)
})
test('synthetic demo contains meaningful optimization, regression and count-change signals',()=>{
  const a=analyzeProfile(importProfile(demoProfile())),b=analyzeProfile(importProfile(demoProfile(true)))
  assert.equal(a.count,160);assert.equal(b.count,96)
  assert.equal(a.span,7900);assert.equal(a.groups.length,5)
  const diff=compareProfiles(a,b)
  assert.equal(diff.matched,5)
  assert.ok(diff.rows.some(r=>r.medianRatio>1));assert.ok(diff.rows.some(r=>r.medianRatio<1))
})
test('shape bridge is explicit and rejects ambiguous fused/quantized/transposed shapes',()=>{
  const sample={type:'MatMul',shape:'128,7168;7168,2048',dtype:'bf16;bf16',format:'ND;ND',median:123}
  assert.deepEqual(profileEstimateCandidate(sample),{operator:'matmul',precision:'bf16',batch:1,m:128,k:7168,n:2048,broadcastB:true})
  assert.equal(profileEstimateCandidate({...sample,type:'FusedMatmulAdd'}),null)
  assert.equal(profileEstimateCandidate({...sample,shape:'128,7168;2048,7168'}),null)
  assert.equal(profileEstimateCandidate({...sample,dtype:'int8;int8'}),null)
  transferProfileSample(sample);assert.deepEqual(peekProfileSample(),sample);clearProfileSample();assert.equal(peekProfileSample(),undefined)
})
test('50k tasks retain full statistics while limiting timeline preview',()=>{
  const a=analyzeProfile({events:Array.from({length:50000},(_,i)=>e(`Op${i%10}`,i*2,1)),warnings:[],source:'csv',skipped:0})
  assert.equal(a.count,50000);assert.equal(a.total,50000);assert.equal(a.busy,50000)
  assert.equal(a.groups.length,10);assert.equal(a.timelineTruncated,true)
  assert.equal(a.lanes.flatMap(l=>l.events).length,1200)
})
test('file, event, field and group bounds fail explicitly; impossible timestamp is not a timeline',()=>{
  assert.throws(()=>importProfile(' '.repeat(profileLimits.bytes+1)),/50 MiB/)
  assert.throws(()=>parseCsv('Name,Duration(us)\n'+('A'.repeat(16385))+',1'),/字段过长/)
  assert.throws(()=>importProfile('Name,Duration(us)\n'+'A,1\n'.repeat(200001)),/200000/)
  assert.throws(()=>importProfile('Name,Duration(us)\n'+Array.from({length:20001},(_,i)=>`Group${i},1`).join('\n')),/20000/)
  const d=importProfile(csv([row('good',0,10),row('impossible',1e308,10),row('bad-number',0,'1,2')]))
  assert.equal(d.events.length,1);assert.equal(d.skipped,2)
})
