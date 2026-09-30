import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { radarCatalog, radarWindow, filterRadar, readRadarQuery, spherePosition, rotatePoint, pointRadius, relatedSignals } from '../src/lib/news-sphere.ts'
import { buildHotspots, heatScore } from '../src/lib/news-hotspots.mjs'
const corpus=JSON.parse(await readFile(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8'))
const catalog=radarCatalog(corpus)
test('radar preserves real identities, reports and heat definition',()=>{
  for(const h of [24,72,168]) assert.deepEqual(radarWindow(catalog,corpus.generatedAt,h).map(r=>[r.id,r.score,r.reports.map(x=>x.id)]),buildHotspots(corpus,h).map(r=>[r.id,r.score,r.reports.map(x=>x.id)]))
  assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length)
})
test('short windows exclude future and old records, recompute scores, never fabricate rows',()=>{
  for(const h of [1,6]) for(const row of radarWindow(catalog,corpus.generatedAt,h)) {
    assert.equal(row.score,heatScore(row.reports,corpus.generatedAt).score)
    assert(row.reports.every(r=>Date.parse(r.publishedAt)<=Date.parse(corpus.generatedAt)&&Date.parse(r.publishedAt)>Date.parse(corpus.generatedAt)-h*3600000))
  }
  assert.throws(()=>radarWindow(catalog,corpus.generatedAt,0))
  assert.deepEqual(radarWindow([],corpus.generatedAt,24),[])
})
test('canonical query handles invalid ranges, truncation, category and sort',()=>{
  const q=readRadarQuery(new URLSearchParams('hours=999&category=bad&sort=bad&q='+ 'x'.repeat(300)))
  assert.equal(q.hours,72);assert.equal(q.category,'');assert.equal(q.sort,'heat');assert.equal(q.q.length,160)
  assert.deepEqual(readRadarQuery(new URLSearchParams(new URLSearchParams({hours:'6',category:'ai',sort:'mine',topic:'t',selected:'s',q:'NVIDIA'}).toString())),{hours:6,category:'ai',sort:'mine',topic:'t',selected:'s',q:'NVIDIA'})
})
test('search covers topic, publisher and country; followed means explicit local subscription',()=>{
  const base=readRadarQuery(new URLSearchParams()), first=catalog[0]
  assert(filterRadar(catalog,{...base,q:first.reports[0].country},[]).some(r=>r.id===first.id))
  assert(filterRadar(catalog,{...base,q:first.reports[0].source.toUpperCase()},[]).some(r=>r.id===first.id))
  assert.deepEqual(filterRadar(catalog,{...base,sort:'mine'},[]),[])
  assert.deepEqual(filterRadar(catalog,{...base,sort:'mine'},[first.id]).map(x=>x.id),[first.id])
  assert(filterRadar(catalog,{...base,category:'finance'},[]).every(x=>x.category==='finance'))
  assert.equal(filterRadar(catalog,{...base,topic:first.id},[]).length,1)
  const latest=filterRadar(catalog,{...base,sort:'latest'},[]);assert.deepEqual(latest.map(x=>x.latestAt),latest.map(x=>x.latestAt).sort().reverse())
})
test('deterministic sphere geometry, bounded nonlinear sizes and explicitly same-category relations',()=>{
  for(let i=0;i<1200;i++){
    const p=spherePosition(i,1200,String(i)),r=Math.hypot(p.x,p.y,p.z)
    assert(r>.9&&r<1.1);assert.deepEqual(p,spherePosition(i,1200,String(i)))
    const rotated=rotatePoint(p,3.3,.8);assert(Math.abs(Math.hypot(rotated.x,rotated.y,rotated.z)-r)<1e-10)
  }
  assert(pointRadius(100)>pointRadius(1));assert(pointRadius(1e20)<=5.8);assert(pointRadius(-1)>0)
  for(const row of catalog){const related=relatedSignals(row,catalog);assert(related.length<=6);assert(related.every(x=>x.category===row.category&&x.id!==row.id))}
})
