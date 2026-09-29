import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EVENT_VERSION, validateCatalog, validateSnapshot, canonicalEventUrl, includesTerm, matchEventRules, validDay, validTime, readEventQuery, eventQuery, sortedMilestones, filteredReports, freshnessLabel, eventMarkdown } from '../src/lib/news-events.mjs'
import { buildEventSnapshot, generateNewsEvents } from '../scripts/build-news-events.mjs'

const catalog = JSON.parse(await fs.readFile(new URL('../src/data/news/event-catalog.json',import.meta.url),'utf8'))
const realIndex = JSON.parse(await fs.readFile(new URL('../src/data/news/events.json',import.meta.url),'utf8'))
const single = () => ({version:EVENT_VERSION,tracks:[structuredClone(catalog.tracks[0])]})
const item = (overrides={}) => ({url:'https://github.com/sgl-project/sglang/releases/tag/v0.5.20',title:'SGLang v0.5.20',source:'SGLang Releases',sourceCountry:'International',publishedAt:'2026-09-18T22:41:33.000Z',fetchedAt:'2026-09-20T01:00:00.000Z',...overrides})
function datasets(items=[item()], day='2026-09-20T02:00:00.000Z') {
  const data={generatedAt:day,items,sourceStates:[],sources:[]}
  return ['daily.json','library.json','releases.json'].map(name=>({name,data:structuredClone(data)}))
}
test('catalog and retained index are versioned, four-category real-source data',()=>{
  validateCatalog(catalog);validateSnapshot(realIndex)
  assert.deepEqual(catalog.tracks.map(t=>t.category),['ai','technology','finance','world'])
  assert.equal(catalog.tracks.reduce((n,t)=>n+t.milestones.length,0),13)
  assert(realIndex.tracks.every(t=>t.reports.length>=3))
  assert(catalog.tracks.every(t=>t.milestones.every(n=>n.sources.every(s=>s.url.startsWith('https://')))))
  const world=catalog.tracks.find(t=>t.category==='world')
  assert.equal(world.milestones.filter(n=>n.kind==='statement').length,3)
  assert(world.milestones.slice(1).every(n=>n.sources[0].basis==='publisher-summary'))
})
test('catalog rejects unknown versions, unknown fields, duplicate IDs and unsafe links',()=>{
  for(const mutate of [c=>c.version='v9',c=>c.extra=true,c=>c.tracks.push(c.tracks[0]),c=>c.tracks[0].rules[0].pattern='.*',c=>c.tracks[0].rules[0].hosts=['github.com.evil/'],c=>c.tracks[0].learning[0].path='//evil.test',c=>c.tracks[0].milestones[0].sources[0].url='javascript:alert(1)',c=>c.tracks[0].milestones[0].sources=[],c=>c.tracks[0].milestones[0].sources[0].reviewedOn='2020-01-01']) {
    const c=single();mutate(c);assert.throws(()=>validateCatalog(c))
  }
})
test('strict calendar days and timestamps reject rollover, partial or offset dates',()=>{
  assert(validDay('2024-02-29'));assert(!validDay('2026-02-29'));assert(!validDay('2026-09-31'));assert(!validDay('2026-9-1'))
  assert(validTime('2026-09-20T02:00:00Z'));assert(!validTime('2026-09-20'));assert(!validTime('2026-09-20T24:59:00Z'));assert(!validTime('2026-09-20T24:00:00Z'));assert(!validTime('2026-09-20T03:00:00+01:00'))
})
test('URL canonicalization strips tracking, merges UN feed aliases, preserves content query',()=>{
  assert.equal(canonicalEventUrl('https://news.un.org/feed/view/en/story/2026/09/1168419?utm_source=rss#x'),'https://news.un.org/en/story/2026/09/1168419')
  assert.equal(canonicalEventUrl('https://example.org/a?z=2&b=1&cmpid=x'),'https://example.org/a?b=1&z=2')
  for(const url of ['javascript:alert(1)','http://example.org','https://user:pass@example.org','https://127.0.0.1','https://[::1]','https://example.org:9000','https://example.org\\@evil.test','https://example.org/a b']) assert.equal(canonicalEventUrl(url),null)
})
test('matching uses literal terms, exact hosts, path scope and date bounds',()=>{
  const track=single().tracks[0]
  assert.deepEqual(matchEventRules(track,item()),['official-releases'])
  for(const overrides of [{url:'https://github.com.evil.test/sgl-project/sglang/releases/tag/v0.5.20'},{url:'https://github.com/other/sglang/releases/tag/v0.5.20'},{publishedAt:'2026-07-31T00:00:00Z'}])assert.deepEqual(matchEventRules(track,item(overrides)),[])
  assert(!includesTerm('notSGLangOther','sglang'));assert(includesTerm('SGLang: release','sglang'));assert(!includesTerm('anything','.*'))
  const world=catalog.tracks[3];assert.deepEqual(matchEventRules(world,item({title:'UNGA debate',url:'https://news.un.org/en/story/2026/10/1',publishedAt:'2026-10-16T01:00:00Z'})),[])
})
test('same URL is deduplicated across daily/library/release and archive observations',()=>{
  const data=datasets();data.push({name:'archive/2026-09-19.json',data:{generatedAt:'2026-09-19T05:00:00Z',items:[item({url:item().url+'?utm_medium=feed',fetchedAt:'2026-09-19T03:00:00Z'})]}})
  const result=buildEventSnapshot(single(),data);assert.equal(result.tracks[0].reports.length,1)
  assert.equal(result.tracks[0].reports[0].firstCollectedAt,'2026-09-19T03:00:00.000Z');assert.equal(result.tracks[0].reports[0].lastCollectedAt,'2026-09-20T01:00:00.000Z')
})
test('same title at different URLs remains separate; never inferred as corroboration',()=>{
  const result=buildEventSnapshot(single(),datasets([item(),item({url:item().url+'-other'})]));assert.equal(result.tracks[0].reports.length,2)
})
test('rolling feeds retain historical reports without refreshing their observed timestamps',()=>{
  const original=buildEventSnapshot(single(),datasets())
  const next=buildEventSnapshot(single(),datasets([],'2026-09-25T02:00:00Z'),original)
  assert.deepEqual(next.tracks,original.tracks);assert.equal(next.coverage.dailyCollectedAt,'2026-09-25T02:00:00.000Z')
  assert.deepEqual(buildEventSnapshot(single(),datasets([],'2026-09-25T02:00:00Z'),next),next)
})
test('newer title corrections update metadata once, retain first seen, ignore older windows',()=>{
  const a=buildEventSnapshot(single(),datasets())
  const newer=datasets([item({title:'SGLang v0.5.20 corrected',fetchedAt:'2026-09-25T01:00:00Z'})],'2026-09-25T02:00:00Z')
  const b=buildEventSnapshot(single(),newer,a),r=b.tracks[0].reports[0]
  assert.equal(r.revisionCount,1);assert.equal(r.firstCollectedAt,a.tracks[0].reports[0].firstCollectedAt)
  assert.deepEqual(buildEventSnapshot(single(),newer,b),b)
  assert.equal(buildEventSnapshot(single(),datasets(),b).tracks[0].reports[0].title,r.title)
})
test('rule edits recalculate retained memberships, not silently sticky classifications',()=>{
  const before=buildEventSnapshot(single(),datasets());const changed=single();changed.tracks[0].rules[0].pathPrefix='/other/'
  const after=buildEventSnapshot(changed,datasets([]),before);assert.equal(after.tracks[0].reports.length,0);assert.notEqual(after.fingerprint,before.fingerprint)
})
test('invalid news observations are counted; missing or corrupt datasets fail closed',()=>{
  const result=buildEventSnapshot(single(),datasets([item(),item({fetchedAt:'bad'}),item({url:'javascript:x'}),item({publishedAt:'2030-01-01T00:00:00Z'})]))
  assert.equal(result.coverage.invalidItems,9);assert.equal(result.tracks[0].reports.length,1)
  assert.throws(()=>buildEventSnapshot(single(),datasets().slice(1)),/Missing/)
  const malformed=datasets();malformed[0].data.generatedAt='bad';assert.throws(()=>buildEventSnapshot(single(),malformed),/Invalid/)
  assert.throws(()=>buildEventSnapshot(single(),datasets(),{version:'future'}))
})
test('deterministic fingerprint and archive gaps do not fabricate freshness',()=>{
  const data=datasets();for(const day of ['19','21'])data.push({name:`archive/2026-09-${day}.json`,data:{generatedAt:`2026-09-${day}T02:00:00Z`,items:[]}})
  data[0].data.sourceStates=[{name:'Unavailable source',state:'unavailable'}]
  const result=buildEventSnapshot(single(),data)
  assert.deepEqual(result.coverage.missingArchiveDates,['2026-09-20']);assert.deepEqual(result.coverage.failedSources,['Unavailable source'])
  assert.deepEqual(buildEventSnapshot(single(),[...data].reverse()),result)
  assert.match(freshnessLabel(result.coverage.dailyCollectedAt,Date.parse('2026-09-29T00:00:00Z')),/超过 3 天/)
  assert.match(freshnessLabel(result.coverage.dailyCollectedAt,Date.parse('2026-09-19T00:00:00Z')),/未来/)
})
test('snapshot rejects bad URL, duplicate entries, invalid time ranges and unknown versions',()=>{
  for(const mutate of [s=>s.version='future',s=>s.tracks[0].reports.push(s.tracks[0].reports[0]),s=>s.tracks[0].reports[0].url='javascript:x',s=>s.tracks[0].reports[0].firstCollectedAt='2030-01-01T00:00:00Z',s=>s.coverage.dailyCollectedAt='today',s=>s.tracks[0].reports[0].ruleIds=[]]){const snapshot=buildEventSnapshot(single(),datasets());mutate(snapshot);assert.throws(()=>validateSnapshot(snapshot))}
})
test('URL state restores selection and filters, unknown event/node never silently changes story',()=>{
  const p=eventQuery({event:'sglang-runtime',step:'v0518',source:'SGLang Releases',q:'cache'}),read=readEventQuery(p,catalog.tracks)
  assert.equal(read.index,0);assert.equal(read.source,'SGLang Releases');assert.equal(read.q,'cache')
  assert.equal(readEventQuery(new URLSearchParams(),catalog.tracks).index,2)
  assert(readEventQuery(new URLSearchParams('event=unknown'),catalog.tracks).error)
  assert(readEventQuery(new URLSearchParams('event=sglang-runtime&step=unknown'),catalog.tracks).error)
  assert(readEventQuery(new URLSearchParams(),[]).error)
  assert.equal(readEventQuery(new URLSearchParams('q='+ 'a'.repeat(200)),catalog.tracks).q.length,160)
})
test('filtering, chronology and export retain evidence labels and date distinctions',()=>{
  const track=catalog.tracks[2],reports=realIndex.tracks.find(t=>t.id===track.id).reports
  assert.equal(sortedMilestones(track)[1].sources[0].publishedOn,'2026-09-18');assert.equal(sortedMilestones(track)[1].date,'2026-09-24')
  assert.equal(filteredReports(reports,{source:'unknown'}).length,0)
  assert(filteredReports(reports,{q:'minutes july'}).length>0)
  const doc=eventMarkdown(track,reports,realIndex.coverage)
  assert.match(doc,/不构成投资建议/);assert.match(doc,/未逐条核对/);assert.match(doc,/首次收录/);assert.match(doc,/k260918a.pdf/)
  assert(!doc.includes('/Users/'));assert(!doc.includes('OPENAI_API_KEY'))
})

async function fixture(fn) {
  const root=await fs.mkdtemp(join(tmpdir(),'news-events-test-')),dir=join(root,'src/data/news')
  try {
    await fs.mkdir(join(dir,'archive'),{recursive:true})
    await fs.writeFile(join(dir,'event-catalog.json'),JSON.stringify(single()))
    for(const {name,data} of datasets())await fs.writeFile(join(dir,name),JSON.stringify(data))
    await fn(root,dir)
  }finally{await fs.rm(root,{recursive:true,force:true})}
}
test('publisher check detects drift; generation is deterministic and atomic',()=>fixture(async(root,dir)=>{
  await assert.rejects(generateNewsEvents({root,check:true}),/out of date/)
  assert.equal((await generateNewsEvents({root})).changed,true)
  const before=await fs.readFile(join(dir,'events.json'),'utf8')
  assert.equal((await generateNewsEvents({root,check:true})).changed,false)
  assert.equal((await generateNewsEvents({root})).changed,false)
  assert.equal(await fs.readFile(join(dir,'events.json'),'utf8'),before)
}))
test('publisher preserves last good index on parse, write and rename failures',()=>fixture(async(root,dir)=>{
  await generateNewsEvents({root});const path=join(dir,'events.json'),before=await fs.readFile(path,'utf8')
  const changed=single();changed.tracks[0].title='Changed title';await fs.writeFile(join(dir,'event-catalog.json'),JSON.stringify(changed))
  for(const method of ['writeFile','rename']){
    const io={...fs,[method]:async()=>{throw new Error('injected failure')}}
    await assert.rejects(generateNewsEvents({root,io}),/injected/);assert.equal(await fs.readFile(path,'utf8'),before)
    assert(!(await fs.readdir(dir)).some(name=>name.endsWith('.tmp')))
  }
  await fs.writeFile(join(dir,'daily.json'),'{broken')
  await assert.rejects(generateNewsEvents({root}));assert.equal(await fs.readFile(path,'utf8'),before)
}))
test('publisher does not replace unrecognized retained data or hide read permission errors',()=>fixture(async(root,dir)=>{
  const path=join(dir,'events.json');await fs.writeFile(path,'{"version":"future"}')
  await assert.rejects(generateNewsEvents({root}));assert.equal(await fs.readFile(path,'utf8'),'{"version":"future"}')
  const io={...fs,readFile:async(p,...args)=>{if(p===path){const e=new Error('denied');e.code='EACCES';throw e}return fs.readFile(p,...args)}}
  await assert.rejects(generateNewsEvents({root,io}),/denied/)
}))
