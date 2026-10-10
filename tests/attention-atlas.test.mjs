import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {attentionTechnologies as nodes,attentionRelations as edges,attentionFamilies,attentionOverview,attentionMatches,readAttentionQuery} from '../src/data/attention-atlas.ts'

test('attention catalog has unique nodes, primary sources, valid lessons and requested branches',()=>{
  assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length)
  const curriculum=JSON.parse(readFileSync(new URL('../src/data/curriculum-index.json',import.meta.url),'utf8'))
  const slugs=new Set(curriculum.map(n=>n.slug))
  for(const node of nodes){
    assert.ok(attentionFamilies.some(f=>f.id===node.family));assert.match(node.paper,/^https:\/\/(arxiv.org|github.com\/deepseek-ai)\//)
    assert.ok(node.summary&&node.boundary&&node.fullName);assert.ok(node.year>=2014&&node.year<=2026)
    if(node.lesson)assert.ok(slugs.has(node.lesson),node.lesson)
  }
  for(const id of ['mha','mqa','gqa','mla','nsa','dsa','csa','hca','linear','gdn','kda','flash','paged'])assert.ok(nodes.some(n=>n.id===id))
  for(const id of attentionOverview)assert.ok(nodes.some(n=>n.id===id))
})
test('relations carry evidence and distinguish extension from comparison and implementation',()=>{
  const ids=new Set(nodes.map(n=>n.id)),pairs=new Set()
  for(const e of edges){assert.ok(ids.has(e.from)&&ids.has(e.to));assert.notEqual(e.from,e.to);assert.ok(e.explanation);assert.match(e.source,/^https:/);assert.ok(!pairs.has(`${e.from}-${e.to}`));pairs.add(`${e.from}-${e.to}`)}
  const relation=(from,to)=>edges.find(e=>e.from===from&&e.to===to)
  for(const pair of [['mqa','gqa'],['mla','dsa'],['dsa','csa'],['delta','gdn'],['gdn','kda']])assert.equal(relation(...pair).kind,'extends')
  assert.equal(relation('mla','kimi-linear').kind,'combines');assert.equal(relation('kda','kimi-linear').kind,'combines')
  assert.equal(relation('mha','flash').kind,'implements');assert.equal(relation('mha','paged').kind,'implements')
  assert.ok(!relation('nsa','dsa'));assert.ok(!relation('mla','kda'));assert.equal(relation('csa','hca').kind,'alternative')
  const visit=(id,path=[])=>{assert.ok(!path.includes(id),`cycle ${path} ${id}`);for(const e of edges.filter(e=>e.from===id&&e.kind==='extends'))visit(e.to,[...path,id])}
  for(const id of ids)visit(id)
})
test('strict URL state round trips and rejects unknown, duplicated or unbounded values',()=>{
  for(const node of nodes)for(const view of ['all','overview',node.family]){const expected={view,node:node.id,q:'Delta 测试',invalid:false};assert.deepEqual(readAttentionQuery(new URLSearchParams(expected)),expected)}
  for(const query of ['node=missing','view=other','node=mla&node=gqa','q=a&q=b','q='+ 'x'.repeat(101)])assert.equal(readAttentionQuery(new URLSearchParams(query)).invalid,true)
  assert.equal(readAttentionQuery(new URLSearchParams()).node,'mla')
})
test('search finds abbreviations, full names and Chinese without executing input',()=>{
  assert.ok(attentionMatches(nodes.find(n=>n.id==='gdn'),'gated delta'))
  assert.ok(attentionMatches(nodes.find(n=>n.id==='dsa'),'稀疏'))
  assert.ok(!nodes.some(n=>attentionMatches(n,'<script>alert(1)</script>')))
})
test('archify overview uses the same catalog labels, years and verified main relationships',()=>{
  const diagram=JSON.parse(readFileSync(new URL('../docs/diagrams/attention-core.json',import.meta.url),'utf8'))
  for(const n of diagram.components){const node=nodes.find(v=>v.id===n.id);assert.equal(n.label,node.name);assert.ok(n.sublabel.startsWith(String(node.year)))}
  for(const e of diagram.connections)assert.ok(edges.some(v=>v.from===e.from&&v.to===e.to))
})
