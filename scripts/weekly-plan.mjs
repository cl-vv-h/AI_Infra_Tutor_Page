import {readdir,readFile} from 'node:fs/promises'
import {pendingWeeks,weeklyFreshness} from '../src/lib/weekly-news.mjs'
const root=new URL('../src/data/news/',import.meta.url)
const dates=(await readdir(new URL('archive/',root))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f=>f.slice(0,10))
const latest=JSON.parse(await readFile(new URL('weekly/latest.json',root),'utf8'))
const index=JSON.parse(await readFile(new URL('weekly/index.json',root),'utf8'))
const pending=pendingWeeks(dates,index.map(r=>r.periodEnd))
console.log(JSON.stringify({freshness:weeklyFreshness(latest),next:pending[0]??null,pending,policy:'One report per run; newest missing completed week first. No generation when next is null. Dates are Asia/Shanghai; archive filenames retain collector dates.'},null,2))
