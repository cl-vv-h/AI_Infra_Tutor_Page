import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import {distribution,windowReports} from '../src/lib/news-hotspots.mjs'

test('single-pass distribution exactly retains every supported corpus window and input',async()=>{
  const corpus=JSON.parse(await readFile(new URL('../src/data/news/hotspots.json',import.meta.url),'utf8'))
  const before=JSON.stringify(corpus)
  for(const hours of [24,72,168,720]){
    const rows=windowReports(corpus.items,corpus.generatedAt,hours)
    assert.deepEqual(distribution(rows,corpus.generatedAt,true),distribution(rows,corpus.generatedAt,false))
  }
  assert.equal(JSON.stringify(corpus),before)
})

test('single-pass distribution preserves UTC boundaries, rule precedence, outside-week counts and country ties',()=>{
  const asOf='2026-10-23T12:00:00.000Z'
  const report=(publishedAt,title='unclassified headline',category='technology',country='Japan',source='Example')=>({publishedAt,title,category,country,source})
  const rows=[
    report('2026-10-16T23:59:59.999Z'),
    report('2026-10-17T00:00:00.000Z','OpenAI safety release','world','Germany'),
    report('2026-10-23T23:59:59.999Z','Ukraine news','finance','Germany'),
    report('2026-10-24T00:00:00.000Z'),
    report('2026-10-22T00:00:00.000Z','无标题关键词','world','Argentina','SGLang Releases'),
  ]
  for(const input of [[],rows,[...rows].reverse(),[...rows,...rows]])assert.deepEqual(distribution(input,asOf,true),distribution(input,asOf,false))
  const actual=distribution(rows,asOf,true)
  assert.deepEqual(actual.counts,{ai:2,technology:2,finance:0,world:1})
  assert.deepEqual(actual.matrix.ai,[1,0,0,0,0,1,0])
  assert.deepEqual(actual.matrix.technology,[0,0,0,0,0,0,0])
  assert.deepEqual(actual.countries,[['Germany',2],['Japan',2],['Argentina',1]])
})
