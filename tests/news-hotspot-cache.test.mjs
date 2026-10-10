import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildHotspots,validateHotspotCorpus} from '../src/lib/news-hotspots.mjs'
import {createHotspotWindowReader} from '../src/lib/news-hotspot-cache.mjs'

test('snapshot-scoped reader builds each supported window once, without eager work',()=>{
  const corpus={},calls=[]
  const read=createHotspotWindowReader(corpus,(input,hours)=>{assert.equal(input,corpus);calls.push(hours);return [{id:`window-${hours}`} ]})
  assert.deepEqual(calls,[])
  const first=read();assert.equal(read(72),first)
  for(const hours of [24,168,720])assert.equal(read(hours),read(hours))
  assert.deepEqual(calls,[72,24,168,720])
  for(const hours of [0,1,Infinity,NaN,'72'])assert.throws(()=>read(hours),RangeError)
  assert.equal(calls.length,4)
})
test('replaced snapshots do not inherit cache entries and failed builds remain retryable',()=>{
  const build=(corpus,hours)=>[{id:corpus.id,hours}]
  assert.notDeepEqual(createHotspotWindowReader({id:'old'},build)(),createHotspotWindowReader({id:'new'},build)())
  let attempts=0
  const read=createHotspotWindowReader({},()=>{if(++attempts===1)throw new Error('failure');return []})
  assert.throws(()=>read(),/failure/);assert.deepEqual(read(),[]);read();assert.equal(attempts,2)
})
test('build-time disabled reader uses the original builder on every read',()=>{
  let calls=0
  const read=createHotspotWindowReader({},()=>{calls++;return []},false)
  assert.deepEqual(read(),read());assert.equal(calls,2)
})
test('cached current and retained windows exactly match unchanged scoring and clustering',()=>{
  const corpus=validateHotspotCorpus(JSON.parse(readFileSync(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8')))
  const before=JSON.stringify(corpus),read=createHotspotWindowReader(corpus)
  for(const hours of [24,72,168,720])assert.deepEqual(read(hours),buildHotspots(corpus,hours))
  assert.equal(JSON.stringify(corpus),before)
})
