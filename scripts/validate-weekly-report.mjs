import {readFile,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {validateWeeklyReport} from '../src/lib/weekly-news.mjs'
import {reportErrors} from './weekly-files.mjs'
const root=new URL('../src/data/news/',import.meta.url)
const archives=Object.fromEntries(await Promise.all((await readdir(new URL('archive/',root))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(async f=>[f.slice(0,10),JSON.parse(await readFile(new URL(`archive/${f}`,root),'utf8'))])))
const path=process.argv[2]?resolve(process.argv[2]):new URL('weekly/latest.json',root)
const report=JSON.parse(await readFile(path,'utf8'))
const errors=process.argv[2]?validateWeeklyReport(report,archives):reportErrors(report,archives)
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else console.log(`${report.archiveDates?'Weekly report valid':'Frozen legacy report retained; not certified by new citation policy'}: ${report.periodStart}–${report.periodEnd}; ${report.itemCount} sources. This is not a model-provenance or freshness check.`)
