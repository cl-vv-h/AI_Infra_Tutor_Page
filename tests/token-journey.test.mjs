import test from 'node:test'
import assert from 'node:assert/strict'
import {buildJourney,defaultJourney as base,journeySnapshot,readJourneyQuery,writeJourneyQuery} from '../src/lib/token-journey.ts'

test('strict versioned URLs round trip all fields and reject invalid boundaries',()=>{
  const c={...base,model:'llama-3-1-8b',batch:8,prompt:64,output:16,chunk:1,tp:32,prefix:32,block:32,eosAt:5,retention:'prefix'}
  assert.deepEqual(readJourneyQuery(writeJourneyQuery(c)),c);assert.deepEqual(readJourneyQuery(''),base)
  for(const q of ['v=2','prompt=0','prompt=65','output=17','chunk=0','batch=9','prefix=8','prefix=2','tp=64','tp=3','eosAt=5','block=3','prompt=1.5','model=missing','retention=unknown','prompt=8&prompt=9','x=1','prompt=NaN','tp=-1'])assert.throws(()=>readJourneyQuery(q),undefined,q)
})
test('first generated token comes from prefill; final sampled token is never consumed',()=>{
  const events=buildJourney(base),forward=events.filter(e=>['prefill','decode'].includes(e.kind)),samples=events.filter(e=>e.kind==='sample')
  assert.equal(forward.length,4);assert.equal(forward[0].kind,'prefill')
  assert.deepEqual(samples.map(e=>[e.kv,e.generated]),[[8,1],[9,2],[10,3],[11,4]])
  assert.equal(events.at(-2).kv,11);assert.equal(events.at(-1).kv,0)
  const one=buildJourney({...base,output:1});assert.equal(one.filter(e=>e.kind==='decode').length,0);assert.equal(one.at(-2).kv,8)
})
test('chunking processes each uncached prompt position exactly once and emits nothing early',()=>{
  const c={...base,prompt:13,prefix:4,chunk:4},events=buildJourney(c),p=events.filter(e=>e.kind==='prefill')
  assert.deepEqual(p.map(e=>[e.past,e.input,e.kv,e.generated]),[[4,4,8,0],[8,4,12,0],[12,1,13,0]])
  assert.equal(p.reduce((n,e)=>n+e.input,0),9)
  assert.equal(events.findIndex(e=>e.kind==='sample'),events.indexOf(p.at(-1))+1)
})
test('EOS counts as an output, stops early and leaves its own KV uncomputed',()=>{
  const events=buildJourney({...base,eosAt:2})
  assert.equal(events.filter(e=>e.kind==='decode').length,1)
  assert.equal(events.at(-2).reason,'eos');assert.equal(events.at(-2).kv,9);assert.equal(events.at(-1).generated,2)
})
test('cancellation at every active boundary conserves prior state and never continues generation',()=>{
  const c={...base,chunk:3,retention:'prefix'},full=buildJourney(c)
  for(const e of full.filter(e=>!['stop','release'].includes(e.kind))){
    const truncated=buildJourney(c,e.id),cancel=truncated.at(-2),end=truncated.at(-1)
    assert.deepEqual(truncated.slice(0,e.id+1),full.slice(0,e.id+1))
    assert.equal(cancel.kind,'cancel');assert.equal(cancel.kv,e.kv);assert.equal(end.generated,e.generated);assert.equal(end.kv,0)
    assert.equal(end.retained,Math.floor(Math.min(e.kv,c.prompt)/c.block)*c.block)
  }
  for(const i of [-1,1.5,full.length,full.length-2])assert.throws(()=>buildJourney(c,i))
})
test('rank cache payload agrees with independent BF16 GQA arithmetic; TP replication is explicit',()=>{
  for(const model of ['qwen3-8b','llama-3-1-8b'])for(const tp of [1,2,4,8,16,32]){
    const c={...base,model,tp,batch:3,prompt:9},e=buildJourney(c).find(e=>e.kind==='sample'),s=journeySnapshot(c,e)
    const layers=model==='qwen3-8b'?36:32,heads=Math.max(1,8/tp),perPos=2*heads*128*layers*2*3
    assert.equal(s.payloadBytes,9*perPos);assert.equal(s.pageBytes,12*perPos);assert.equal(s.paddingPositions,3)
    assert.equal(s.kvReplication,Math.max(1,tp/8));assert.equal(s.forward,false)
  }
})
test('Q/new KV/history shapes, causal pair counts and scoped reductions are exact',()=>{
  const c={...base,prompt:12,prefix:4,chunk:3,batch:2,tp:4},events=buildJourney(c),e=events.find(e=>e.kind==='prefill'),s=journeySnapshot(c,e)
  assert.equal(s.n,6);assert.equal(s.shapes.hidden,'[6, 4096]');assert.equal(s.shapes.q,'[2, 8, 3, 128]')
  assert.equal(s.shapes.newKv,'[2, 2, 3, 128]');assert.equal(s.shapes.cache,'[2, 2, 7, 128]')
  assert.equal(s.causalPairs,2*8*(5+6+7));assert.equal(s.shapes.logits,'本轮不采样');assert.equal(s.decoderReductions,72)
  const dec=journeySnapshot(c,events.find(e=>e.kind==='decode'));assert.equal(dec.n,2);assert.equal(dec.shapes.logits,'[2, 151936]');assert.equal(dec.shapes.cache,'[2, 2, 13, 128]')
  assert.equal(journeySnapshot({...c,tp:1},e).decoderReductions,0)
})
test('release separates request references, full-page retained prefix and pool allocation',()=>{
  const c={...base,prompt:11,retention:'prefix'},events=buildJourney(c),end=events.at(-1),s=journeySnapshot(c,end)
  assert.equal(end.retained,8);assert.equal(end.kv,0);assert.equal(s.payloadBytes,0);assert.equal(s.pageBytes,0)
  assert.equal(s.retainedBytes,8*2*8*128*36*2)
  assert.equal(buildJourney({...c,retention:'free'}).at(-1).retained,0)
})
test('bounded trajectory sweep maintains append-only KV until release, output bounds and chunk accounting',()=>{
  for(const prompt of [1,8,64])for(const output of [1,4,16])for(const chunk of [1,5,64])for(const eosAt of [0,1]){
    const c={...base,prompt,output,chunk,eosAt},events=buildJourney(c),target=eosAt||output
    assert.ok(events.length<=101)
    assert.equal(events.filter(e=>e.kind==='decode').length,target-1)
    assert.equal(events.filter(e=>e.kind==='prefill').reduce((n,e)=>n+e.input,0),prompt)
    for(let i=1;i<events.length-1;i++){assert.ok(events[i].kv>=events[i-1].kv);assert.ok(events[i].generated>=events[i-1].generated)}
    assert.equal(events.at(-2).kv,prompt+target-1);assert.equal(events.at(-1).generated,target)
  }
})
