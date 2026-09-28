import assert from 'node:assert/strict'
import {readdir} from 'node:fs/promises'
import {readJson,readArchives,reportErrors,newsRoot} from './weekly-files.mjs'
const index=await readJson('weekly/index.json'),latest=await readJson('weekly/latest.json'),archives=await readArchives()
assert.ok(Array.isArray(index)&&index.length,'Weekly index must not be empty')
const files=(await readdir(new URL('weekly/reports/',newsRoot))).sort()
assert.deepEqual(files,index.map(r=>`${r.periodEnd}.json`).sort(),'Index and report files differ')
assert.equal(new Set(index.map(r=>r.periodEnd)).size,index.length,'Duplicate weekly period')
assert.deepEqual(index.map(r=>r.periodEnd),index.map(r=>r.periodEnd).sort().reverse(),'Index must be newest first')
for(const entry of index){
  assert.match(entry.periodEnd,/^\d{4}-\d{2}-\d{2}$/)
  const report=await readJson(`weekly/reports/${entry.periodEnd}.json`)
  assert.deepEqual(reportErrors(report,archives),[],`Invalid report ${entry.periodEnd}`)
  const {content,sources,...meta}=report;void content;void sources
  assert.deepEqual(meta,entry,'Metadata index mismatch')
}
assert.deepEqual(latest,await readJson(`weekly/reports/${index[0].periodEnd}.json`),'latest.json is not the newest published report')
console.log(`Weekly library integrity passed: ${index.length} reports; freshness checked separately.`)
