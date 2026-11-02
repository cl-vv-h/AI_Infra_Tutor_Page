import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url)))
const data=await read('src/data/learning-guide.json'), index=await read('src/data/curriculum-index.json'), catalog=await read('docs/curriculum/catalog.json')
test('all learning paths point to real indexed bodies, including optional branches',()=>{
  assert.equal(data.paths.length,4);assert.equal(data.domains.length,8);assert.equal(data.topics.length,47)
  for(const p of data.paths) for(const step of [...p.steps,...p.optional,...(p.branches??[]).flatMap(b=>b.steps)]){
    const m=data.materials.find(m=>m.sourcePath===step.sourcePath);assert.ok(m?.slug,step.sourcePath)
    assert.ok(index.some(a=>a.slug===m.slug));assert.ok(!data.planned.some(x=>x.sourcePath===step.sourcePath))
  }
})
test('all old article URLs survive; model cases and DPA source material are readable',()=>{
  for(const m of catalog.materials.filter(m=>m.existingSiteRoute)) assert.ok(index.some(a=>'#/article/'+a.slug===m.existingSiteRoute))
  for(const topic of ['cache','attention-dp','case-glm52','case-glm53'])assert.ok(data.materials.some(m=>m.topicId===topic&&m.slug))
  for(const m of data.materials.filter(m=>m.slug))assert.ok(index.some(a=>a.sourcePath===m.sourcePath&&a.slug===m.slug))
})
test('planned and support files are excluded from course materials and translations remain real',()=>{
  for(const m of data.materials){assert.ok(!['license','maintenance','visualization','resource-index'].includes(m.role));const a=index.find(a=>a.slug===m.slug);if(a)assert.deepEqual([...a.availableLanguages].sort(),[...m.languages].sort())}
  assert.equal(data.planned.length,16)
  assert.ok(data.materials.filter(m=>m.topicId==='attention-dp').some(m=>m.layer==='experiment'))
  assert.ok(data.materials.filter(m=>m.topicId==='cache').some(m=>m.layer==='platform'))
})
