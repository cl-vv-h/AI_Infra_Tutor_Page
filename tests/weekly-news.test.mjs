import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {dueWeek,pendingWeeks,weeklyFreshness,periodDays,validateWeeklyReport,reportLinks,validDay} from '../src/lib/weekly-news.mjs'
import {reportErrors} from '../scripts/weekly-files.mjs'
const now=new Date('2026-09-28T02:00:00Z')
const days=periodDays('2026-09-21','2026-09-27')
const source={title:'Synthetic public announcement',url:'https://example.org/news/update',source:'Example institution'}
const archives=Object.fromEntries(days.map(d=>[d,{items:[source]}]))
function fixture(){return {generatedAt:now.toISOString(),periodStart:days[0],periodEnd:days.at(-1),model:'gpt-5.6-luna',itemCount:1,archiveDates:days,content:'# 本周信号\n\n这是合成测试材料，不是真实新闻。\n\n'+['AI','科技','金融','国际形势','跨板块观察','下周观察清单'].map(s=>`## ${s}\n\n仅根据公开归档描述本项信号，不增加缺乏依据的事实；区分观察与推测。[原文](${source.url})\n`).join('\n'),sources:[{...source}]}}
test('weekly deadline uses Shanghai Monday 09:30, not UTC or last seven filenames',()=>{
  assert.deepEqual(dueWeek(new Date('2026-09-28T01:29:59Z')),{start:'2026-09-14',end:'2026-09-20'})
  assert.deepEqual(dueWeek(new Date('2026-09-28T01:30:00Z')),{start:'2026-09-21',end:'2026-09-27'})
  assert.deepEqual(dueWeek(new Date('2026-09-27T15:00:00Z')),{start:'2026-09-14',end:'2026-09-20'})
  assert.deepEqual(dueWeek(new Date('2027-01-04T02:00:00Z')),{start:'2026-12-28',end:'2027-01-03'})
})
test('missing archive days remain gaps; backfill is newest first and skips completed weeks',()=>{
  const dates=['2026-09-03',...days.filter(d=>d!=='2026-09-24')]
  const pending=pendingWeeks(dates,[],now)
  assert.equal(pending[0].archiveDates.length,6)
  assert.equal(pending[0].start,'2026-09-21')
  assert.equal(pending.at(-1).start,'2026-08-31')
  assert.equal(pendingWeeks(dates,['2026-09-27'],now)[0].end,'2026-09-06')
  assert.deepEqual(pendingWeeks([],[],now),[])
})
test('freshness distinguishes old content, future dates and missing reports',()=>{
  assert.equal(weeklyFreshness(fixture(),now).state,'current')
  assert.equal(weeklyFreshness({...fixture(),periodEnd:'2026-09-03'},now).state,'overdue')
  assert.equal(weeklyFreshness({...fixture(),periodEnd:'2026-10-04'},now).state,'invalid')
  assert.equal(weeklyFreshness(null,now).state,'missing')
  assert.equal(validDay('2026-02-30'),false)
  assert.throws(()=>periodDays('2026-09-21','2026-09-28'))
})
test('valid weekly report matches all evidence and citations',()=>assert.deepEqual(validateWeeklyReport(fixture(),archives,{now}),[]))
test('wrong model, duplicate sources and counts fail closed',()=>{
  const r=fixture();r.model='another-model';r.sources.push({...source});r.itemCount=3
  const errors=validateWeeklyReport(r,archives,{now}).join(';')
  assert.match(errors,/Model/);assert.match(errors,/Duplicate/);assert.match(errors,/itemCount/)
})
test('references must match original title and publisher and belong to the chosen period',()=>{
  const r=fixture();r.sources[0].title='Invented title'
  assert.match(validateWeeklyReport(r,archives,{now}).join(';'),/archived title/)
  assert.match(validateWeeklyReport(fixture(),{'2026-09-01':{items:[source]}},{now}).join(';'),/No archived evidence/)
})
test('bidirectional citations reject invented links and unused declared sources',()=>{
  const r=fixture();r.content+=`\n[Unsupported](https://example.org/absent)`
  assert.match(validateWeeklyReport(r,archives,{now}).join(';'),/both ways/)
  r.content=fixture().content.replaceAll(`[原文](${source.url})`,'不含引用')
  assert.match(validateWeeklyReport(r,archives,{now}).join(';'),/both ways/)
})
test('coverage is exact and incomplete weeks must disclose missing evidence',()=>{
  const r=fixture(),partial={...archives};delete partial[days[2]]
  assert.match(validateWeeklyReport(r,partial,{now}).join(';'),/archiveDates/)
  r.archiveDates=days.filter(d=>d!==days[2])
  assert.match(validateWeeklyReport(r,partial,{now}).join(';'),/disclosed/)
  r.content+='\n归档不完整，证据不足。'
  assert.deepEqual(validateWeeklyReport(r,partial,{now}),[])
})
test('headings are ordered; HTML, future publications and sensitive values are rejected',()=>{
  for(const mutate of [r=>r.content+='<iframe src="https://example.org"></iframe>',r=>r.content+='\nuser@example.org',r=>r.content=r.content.replace('## AI','## 科技'),r=>r.generatedAt='2099-01-01T00:00:00Z',r=>r.extra='unknown']){
    const r=fixture();mutate(r);assert.ok(validateWeeklyReport(r,archives,{now}).length)
  }
})
test('balanced URL parentheses work; non-HTTPS and credentials are rejected',()=>{
  assert.deepEqual(reportLinks('[x](https://example.org/a(b))'),['https://example.org/a(b)'])
  assert.throws(()=>reportLinks('[x](javascript:alert(1))'))
  assert.throws(()=>reportLinks('[x](https://user:pass@example.org/)'))
  assert.throws(()=>reportLinks('[x](https://example.org/'))
})
test('legacy exception is immutable and cannot certify edited historical content',()=>{
  const legacy=JSON.parse(readFileSync(new URL('../src/data/news/weekly/reports/2026-09-03.json',import.meta.url),'utf8'))
  assert.deepEqual(reportErrors(legacy,{}),[])
  legacy.content+=' forged'
  assert.ok(reportErrors(legacy,{}).length)
})

test('publisher preserves newest latest, rejects duplicates/invalid evidence, and prepares consistent history',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'weekly-publish-test-'))
  try{
    for(const path of ['src/lib','src/data/news/archive','src/data/news/weekly/reports','scripts'])await mkdir(join(dir,path),{recursive:true})
    for(const path of ['src/lib/weekly-news.mjs','scripts/publish-weekly-report.mjs'])await copyFile(new URL(`../${path}`,import.meta.url),join(dir,path))
    // The fixture always starts with the frozen historical report, regardless of
    // which week is live when CI runs.
    const frozen=readFileSync(new URL('../src/data/news/weekly/reports/2026-09-03.json',import.meta.url),'utf8')
    const {content,sources,...metadata}=JSON.parse(frozen);void content;void sources
    await writeFile(join(dir,'src/data/news/weekly/latest.json'),frozen)
    await writeFile(join(dir,'src/data/news/weekly/index.json'),JSON.stringify([metadata]))
    for(const d of [...periodDays('2026-09-14','2026-09-20'),...days])await writeFile(join(dir,`src/data/news/archive/${d}.json`),JSON.stringify({items:[source]}))
    const candidate=join(dir,'candidate.json'),run=()=>spawnSync(process.execPath,[join(dir,'scripts/publish-weekly-report.mjs'),candidate],{encoding:'utf8'})
    const current=fixture();await writeFile(candidate,JSON.stringify(current));assert.equal(run().status,0)
    const newest=await readFile(join(dir,'src/data/news/weekly/latest.json'),'utf8')
    const older={...fixture(),periodStart:'2026-09-14',periodEnd:'2026-09-20',archiveDates:periodDays('2026-09-14','2026-09-20')}
    const orphan=join(dir,'src/data/news/weekly/reports/2026-09-20.json')
    await writeFile(orphan,'preserve unfinished work')
    await writeFile(candidate,JSON.stringify(older));assert.notEqual(run().status,0)
    assert.equal(await readFile(orphan,'utf8'),'preserve unfinished work')
    await rm(orphan)
    await writeFile(candidate,JSON.stringify(older));assert.equal(run().status,0)
    assert.equal(await readFile(join(dir,'src/data/news/weekly/latest.json'),'utf8'),newest)
    const index=await readFile(join(dir,'src/data/news/weekly/index.json'),'utf8')
    assert.deepEqual(JSON.parse(index).map(r=>r.periodEnd),['2026-09-27','2026-09-20','2026-09-03'])
    assert.notEqual(run().status,0,'same period may not overwrite history')
    await writeFile(candidate,JSON.stringify({...current,itemCount:999}));assert.notEqual(run().status,0)
    assert.equal(await readFile(join(dir,'src/data/news/weekly/index.json'),'utf8'),index)
  }finally{await rm(dir,{recursive:true,force:true})}
})
