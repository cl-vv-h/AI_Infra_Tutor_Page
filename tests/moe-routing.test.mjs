import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultMoeConfig as base,simulateMoe,readMoeQuery,writeMoeQuery,toyExpert} from '../src/lib/moe-routing.ts'

test('query round trip is exact and strict at the boundaries',()=>{
  const c={...base,tokens:128,experts:64,ep:64,topK:8,seed:999999,capacityFactor:.25,combine:'renormalize',pattern:'hotspot',policy:'pad'}
  assert.deepEqual(readMoeQuery(writeMoeQuery(c)),c)
  assert.deepEqual(readMoeQuery(''),base)
  for(const query of ['tokens=0','tokens=129','experts=65','ep=65','ep=3','topK=9','tokens=1.1','seed=-1','tokens=NaN','capacityFactor=0','capacityFactor=4.01','v=2','tokens=','ep=2&ep=4','surprise=1','pattern=__proto__'])assert.throws(()=>readMoeQuery(query),undefined,query)
  assert.throws(()=>simulateMoe({...base,experts:1,ep:1,topK:2}))
})
test('balanced default assigns 48 unique routes and six items to every expert',()=>{
  const r=simulateMoe(base)
  assert.equal(r.routes.length,48);assert.equal(r.dispatch.length,48);assert.equal(r.dropped,0);assert.equal(r.imbalance,1)
  assert.deepEqual(r.experts.map(e=>e.requested),Array(8).fill(6))
  for(const t of r.tokens){assert.equal(new Set(t.assignments.map(a=>a.expert)).size,2);assert.ok(Math.abs(t.retainedWeight-1)<1e-12)}
  assert.equal(r.localAssignments+r.remoteAssignments,48)
  assert.ok(r.remoteTokenRanks<r.remoteAssignments)
})
test('EP changes placement but never router choices or numerical outputs',()=>{
  const r=simulateMoe({...base,pattern:'random'})
  for(const ep of [1,2,4,8]){
    const s=simulateMoe({...base,pattern:'random',ep})
    assert.deepEqual(s.tokens.map(t=>t.output),r.tokens.map(t=>t.output))
    assert.deepEqual(s.routes.map(a=>[a.expert,a.weight]),r.routes.map(a=>[a.expert,a.weight]))
    if(ep===1)assert.equal(s.remoteAssignments,0)
  }
})
test('capacity drops assignments, not the token sequence; padding has no output contribution',()=>{
  const c={...base,pattern:'hotspot',policy:'drop',capacityFactor:1}
  const r=simulateMoe(c),pad=simulateMoe({...c,policy:'pad'})
  assert.equal(r.capacity,6);assert.equal(r.dropped,36);assert.ok(r.emptyTokens>0)
  assert.equal(r.tokens.length,24);assert.equal(r.imbalance,4)
  assert.deepEqual(pad.tokens,r.tokens)
  assert.equal(pad.experts.reduce((n,e)=>n+e.padding,0)+pad.dispatch.length,48)
  for(const e of r.experts)assert.ok(e.accepted<=6)
  for(const t of r.tokens)if(!t.retainedWeight)assert.deepEqual(t.output,[0,0])
})
test('deterministic admission keeps greatest selected-normalized weight with stable ties',()=>{
  const r=simulateMoe({...base,pattern:'hotspot',policy:'drop',capacityFactor:.25})
  for(const e of r.experts){
    const items=r.routes.filter(a=>a.expert===e.expert).sort((a,b)=>b.weight-a.weight||a.token-b.token||a.order-b.order)
    assert.deepEqual(items.filter(a=>a.accepted),items.slice(0,r.capacity))
  }
  assert.deepEqual(simulateMoe({...base,pattern:'random'}),simulateMoe({...base,pattern:'random'}))
  assert.notDeepEqual(simulateMoe({...base,pattern:'random',seed:8}).routes,simulateMoe({...base,pattern:'random'}).routes)
})
test('combine is an independently verified weighted sum and optional renormalization is explicit',()=>{
  for(const combine of ['preserve','renormalize']){
    const r=simulateMoe({...base,pattern:'hotspot',policy:'drop',combine})
    for(const t of r.tokens){
      const w=t.assignments.filter(a=>a.accepted).reduce((n,a)=>n+a.weight,0)
      const expected=[0,0]
      for(const a of t.assignments.filter(a=>a.accepted)){const y=toyExpert(t.token,a.expert),p=a.weight/(combine==='renormalize'&&w?w:1);expected[0]+=y[0]*p;expected[1]+=y[1]*p}
      assert.deepEqual(t.output,expected)
      if(combine==='renormalize'&&w)assert.ok(Math.abs(t.assignments.reduce((n,a)=>n+a.combineWeight,0)-1)<1e-12)
    }
  }
})
test('conservation, pack ordering and ownership across sizes, patterns and policies up to EP64',()=>{
  for(const experts of [1,2,8,64])for(const ep of [1,experts])for(const tokens of [1,7,128])for(const pattern of ['balanced','random','hotspot'])for(const policy of ['dropless','drop','pad']){
    const c={...base,experts,ep,tokens,topK:Math.min(experts,8),pattern,policy},r=simulateMoe(c)
    assert.equal(r.routes.length,tokens*c.topK)
    assert.equal(r.dispatch.length+r.dropped,r.routes.length)
    assert.equal(r.ranks.reduce((n,a)=>n+a.sent,0),r.remoteAssignments)
    assert.equal(r.ranks.reduce((n,a)=>n+a.received,0),r.remoteAssignments)
    assert.ok(r.remoteTokenRanks<=r.remoteAssignments)
    assert.equal(new Set(r.dispatch.map(a=>`${a.token}:${a.expert}`)).size,r.dispatch.length)
    for(let i=1;i<r.dispatch.length;i++)assert.ok(r.dispatch[i].expert>=r.dispatch[i-1].expert)
    for(const a of r.routes){assert.equal(a.rank,Math.floor(a.expert/(experts/ep)));assert.ok(Number.isFinite(a.weight)&&a.weight>0);assert.ok(a.combineWeight>=0)}
  }
})
