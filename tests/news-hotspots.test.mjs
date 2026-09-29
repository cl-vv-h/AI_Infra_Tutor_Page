import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildHotspots, changeFollow, distribution, headlineWords, heatScore, hotspotTopics, hotspotUrl, matchTopic, parseFollows, publisherFamily, similarHeadline, validateHotspotCorpus, windowReports } from '../src/lib/news-hotspots.mjs'
import { collectHotspotCorpus } from '../scripts/news-hotspots.mjs'
const now='2026-09-29T06:00:00.000Z'
const item=(extra={})=>({title:'OpenAI safety announcement',url:'https://example.org/article',source:'BBC World',sourceCountry:'United Kingdom',category:'world',publishedAt:now,...extra})
const sources=[{name:'BBC World',country:'United Kingdom',url:'https://feeds.bbci.co.uk/news/world/rss.xml',state:'ok',entryCount:3}]
const corpus=(items=[item()],previous=null,asOf=now)=>collectHotspotCorpus(items,sources,asOf,previous)
test('public URL normalization strips feed tracking, retains meaningful query, rejects unsafe destinations',()=>{
  assert.equal(hotspotUrl('https://example.org/news/?utm_source=x&traffic_source=rss&maca=rss&id=42#x'),'https://example.org/news/?id=42')
  for(const value of ['javascript:alert(1)','http://example.com','https://user:secret@example.com','https://localhost/x','https://127.0.0.1/x']) assert.equal(hotspotUrl(value),null)
})
test('rolling corpus uses candidates, retains first seen, removes old, preserves temporarily missing feed articles',()=>{
  const first=corpus(Array.from({length:20},(_,i)=>item({title:`Story ${i}`,url:`https://example.org/${i}`})))
  assert.equal(first.items.length,20)
  const second=corpus([item({url:'https://example.org/0',title:'A corrected title'})],first,'2026-09-30T06:00:00.000Z')
  assert.equal(second.items.length,20);assert.equal(second.items.find(x=>x.url.endsWith('/0')).firstSeenAt,now)
  assert.equal(second.items.find(x=>x.url.endsWith('/0')).lastSeenAt,second.generatedAt)
  assert.equal(corpus([],second,'2026-10-30T06:00:00.000Z').items.length,0)
})
test('schema rejects corrupt previous data, unknown versions, duplicates and clock regression',()=>{
  const first=corpus()
  assert.throws(()=>corpus([], {...first,version:'future'}))
  assert.throws(()=>validateHotspotCorpus({...first,items:[...first.items,...first.items]}))
  assert.throws(()=>validateHotspotCorpus({...first,items:[{...first.items[0],lastSeenAt:'2030-01-01T00:00:00Z'}]}))
  assert.throws(()=>corpus([], first,'2026-09-28T06:00:00.000Z'))
})
test('topic matching prioritizes specific subjects, uses word boundaries, does not invent one event',()=>{
  assert.equal(matchTopic(item()).id,'openai-safety')
  assert.equal(matchTopic(item({title:'OpenAI new product'})).id,'openai')
  assert.equal(matchTopic(item({title:'NVIDIA chip export controls in China'})).id,'ai-chip-trade')
  assert.equal(matchTopic(item({title:'Airbase security in British territory'})).id,'uk-airbase')
  assert.equal(matchTopic(item({title:'Chairman chairs community meeting'})),undefined)
  assert.equal(new Set(hotspotTopics.map(row=>row.id)).size,hotspotTopics.length)
})
test('heat decays, caps publisher families and ignores identical syndicated headlines',()=>{
  const row=corpus().items[0]
  assert.equal(heatScore([row],now).score,10)
  assert.equal(heatScore([row],'2026-09-30T06:00:00.000Z').score,5)
  assert.equal(heatScore([row,{...row,source:'DW',url:'https://other.org/a'}],now).score,10)
  assert.equal(heatScore(Array.from({length:8},(_,i)=>({...row,title:`Unique story ${i}`,source:i%2?'BBC World':'BBC Business'})),now).score,30)
  assert.equal(publisherFamily('NVIDIA AI'),publisherFamily('NVIDIA Technical Blog'))
})
test('time window excludes future / exact lower boundary and sorting is deterministic',()=>{
  const data=corpus([item(),item({url:'https://example.org/old',publishedAt:'2026-09-28T06:00:00.000Z'}),item({url:'https://example.org/future',publishedAt:'2026-09-29T06:30:00.000Z'})])
  assert.equal(windowReports(data.items,now,24).length,1)
  assert.throws(()=>windowReports(data.items,now,1))
  assert.deepEqual(buildHotspots(data,24),buildHotspots({...data,items:[...data.items].reverse()},24))
})
test('all unmatched news remains discoverable, one topic assignment per article; distribution reconciles',()=>{
  const data=corpus([item(),item({title:'OpenAI shelves new model on safety concerns',source:'DW',url:'https://example.org/two'}),item({title:'A distinct new science observation',url:'https://example.org/three',category:'technology'})])
  const groups=buildHotspots(data)
  assert.equal(groups.length,2);assert.equal(groups[0].id,'openai-safety');assert.equal(groups[0].reports.length,2)
  assert.equal(groups[1].kind,'story')
  const stats=distribution(data.items,now)
  assert.equal(Object.values(stats.counts).reduce((a,b)=>a+b),3)
  assert.equal(stats.matrix.ai.at(-1),2);assert.equal(stats.days.length,7)
})
test('conservative headline clusters do not merge on one entity; IDs survive window changes and appended observations',()=>{
  assert.equal(similarHeadline(headlineWords('OpenAI court case in Madrid'),headlineWords('OpenAI releases coding model')),false)
  const first=corpus([item({title:'Evicted Spanish pensioner returns home lawyer says',url:'https://example.org/a',publishedAt:'2026-09-27T06:00:00.000Z'}),item({title:'Evicted Spanish pensioner moves back home lawyer says',url:'https://example.org/b'})])
  const wide=buildHotspots(first,72),narrow=buildHotspots(first,24)
  assert.equal(wide.length,1);assert.equal(wide[0].kind,'cluster');assert.equal(wide[0].id,narrow[0].id)
  const next=corpus([item({title:'Evicted Spanish pensioner returns home lawyer confirms',url:'https://example.org/c',publishedAt:'2026-09-29T08:00:00.000Z'})],first,'2026-09-29T09:00:00.000Z')
  assert.equal(buildHotspots(next,72)[0].id,wide[0].id)
  assert.equal(matchTopic(item({title:'South Sudan calls for sanctions to be lifted'})).id,'south-sudan')
})
test('local follows validate version, cap, entries and preserve unknown topic IDs',()=>{
  assert.deepEqual(parseFollows(null),{version:1,entries:[]})
  for(const raw of ['{','{"version":2,"entries":[]}',JSON.stringify({version:1,entries:Array(51).fill({id:'a',title:'a',seenThrough:now})})]) assert.throws(()=>parseFollows(raw))
  assert.equal(parseFollows(JSON.stringify({version:1,entries:[{id:'retired-topic',title:'History',seenThrough:now}]})).entries.length,1)
})
const memory=()=>{let raw=null;return {getItem:()=>raw,setItem:(_,value)=>{raw=value}}}
const locks={request:async(_,fn)=>fn()}
test('follow actions re-read latest state; mark-read never regresses; removal scoped',async()=>{
  const storage=memory()
  await changeFollow(storage,locks,'openai','OpenAI',now,'add')
  await changeFollow(storage,locks,'vllm','vLLM',now,'add')
  await changeFollow(storage,locks,'openai','OpenAI','2026-09-28T06:00:00.000Z','read')
  assert.equal(parseFollows(storage.getItem()).entries[0].seenThrough,now)
  await changeFollow(storage,locks,'openai','OpenAI',now,'remove')
  assert.equal(parseFollows(storage.getItem()).entries[0].id,'vllm')
})
test('storage denied, no-op writes, unsupported locking and corrupt records never report success',async()=>{
  await assert.rejects(changeFollow({getItem:()=>null,setItem:()=>{throw new Error('quota')}},locks,'a','A',now,'add'),/quota/)
  await assert.rejects(changeFollow({getItem:()=>null,setItem:()=>{}},locks,'a','A',now,'add'),/校验/)
  await assert.rejects(changeFollow(memory(),undefined,'a','A',now,'add'),/Web Locks/)
  let touched=false
  await assert.rejects(changeFollow({getItem:()=>'{',setItem:()=>{touched=true}},locks,'a','A',now,'add'))
  assert.equal(touched,false)
})
test('checked-in public corpus passes schema and includes all categories / expanded source coverage',async()=>{
  const data=validateHotspotCorpus(JSON.parse(await readFile(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8')))
  assert(data.sources.length>=39)
  assert(data.sources.some(row=>row.name==='DW'));assert(data.sources.some(row=>row.name==='CNA Business'))
  const groups=buildHotspots(data,168)
  assert(groups.length>4);assert.equal(new Set(groups.map(row=>row.category)).size,4)
})
