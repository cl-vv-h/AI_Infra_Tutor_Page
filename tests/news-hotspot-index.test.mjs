import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildHotspots} from '../src/lib/news-hotspots.mjs'

test('seed index exactly preserves full retained-corpus outputs in every window',()=>{
  const corpus=JSON.parse(readFileSync(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8')),before=JSON.stringify(corpus)
  for(const hours of [24,72,168,720])assert.deepEqual(buildHotspots(corpus,hours,true),buildHotspots(corpus,hours,false))
  assert.equal(JSON.stringify(corpus),before)
})
const make=(titles)=>({generatedAt:'2026-10-23T12:00:00Z',items:titles.map((entry,i)=>({id:String(i).padStart(16,'0'),title:typeof entry==='string'?entry:entry.title,category:typeof entry==='string'?'technology':entry.category,source:'Synthetic',url:`https://example.org/${i}`,country:'Synthetic',publishedAt:'2026-10-23T10:00:00Z',firstSeenAt:`2026-10-23T10:00:${String(i).padStart(2,'0')}Z`,lastSeenAt:'2026-10-23T11:00:00Z'}))})
test('index preserves earliest matching seed, threshold and category boundaries',()=>{
  const corpus=make(['alpha bravo charlie delta echo','alpha bravo foxtrot golf hotel','golf hotel charlie bravo alpha',{title:'alpha bravo charlie delta echo',category:'finance'},'alpha bravo india juliet kilo'])
  const actual=buildHotspots(corpus,72,true)
  assert.deepEqual(actual,buildHotspots(corpus,72,false))
  assert.equal(actual.find(g=>g.reports.some(r=>r.id===corpus.items[2].id)).id,`story-${corpus.items[0].id}`)
  assert.equal(actual.find(g=>g.reports.some(r=>r.id===corpus.items[3].id)).reports.length,1)
  assert.equal(actual.find(g=>g.reports.some(r=>r.id===corpus.items[4].id)).reports.length,1)
})
test('matched reports do not expand seeds into similarity chains; topic rules retain precedence',()=>{
  const corpus=make(['alpha bravo charlie delta echo','alpha bravo charlie foxtrot golf','charlie foxtrot golf hotel india','OpenAI model safety release','OpenAI safety update'])
  const actual=buildHotspots(corpus,72,true)
  assert.deepEqual(actual,buildHotspots(corpus,72,false))
  assert.equal(actual.find(g=>g.reports.some(r=>r.id===corpus.items[2].id)).reports.length,1)
  assert.equal(actual.find(g=>g.id==='openai-safety').reports.length,2)
  assert.deepEqual(buildHotspots(make([]),72,true),[])
})
test('deterministic varied corpora retain exact legacy behavior including short titles',()=>{
  let state=7
  const words=['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet','kilo']
  const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state}
  for(let run=0;run<25;run++){
    const rows=Array.from({length:45},(_,i)=>({title:i%9===0?'中文标题':Array.from({length:next()%8+1},()=>words[next()%words.length]).join(' '),category:['ai','technology','finance','world'][next()%4]}))
    const corpus=make(rows)
    assert.deepEqual(buildHotspots(corpus,72,true),buildHotspots(corpus,72,false))
  }
})
