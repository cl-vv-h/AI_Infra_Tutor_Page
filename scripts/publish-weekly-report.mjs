import {readFile,readdir,mkdir,writeFile,rename,access} from 'node:fs/promises'
import {resolve} from 'node:path'
import {validateWeeklyReport} from '../src/lib/weekly-news.mjs'
if(!process.argv[2])throw new Error('Usage: node scripts/publish-weekly-report.mjs <candidate.json>')
const root=new URL('../src/data/news/',import.meta.url)
const candidate=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'))
const archives=Object.fromEntries(await Promise.all((await readdir(new URL('archive/',root))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(async f=>[f.slice(0,10),JSON.parse(await readFile(new URL(`archive/${f}`,root),'utf8'))])))
const errors=validateWeeklyReport(candidate,archives)
if(errors.length)throw new Error(errors.join('; '))
const index=JSON.parse(await readFile(new URL('weekly/index.json',root),'utf8'))
if(index.some(r=>r.periodEnd===candidate.periodEnd))throw new Error('This period is already published; do not overwrite history')
try{
  await access(new URL(`weekly/reports/${candidate.periodEnd}.json`,root))
  throw new Error('A report file already exists for this period; inspect incomplete publication without overwriting it')
}catch(error){if(error.code!=='ENOENT')throw error}
const latest=JSON.parse(await readFile(new URL('weekly/latest.json',root),'utf8'))
const {content,sources,...metadata}=candidate
void content;void sources
const nextIndex=[...index,metadata].sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd))
async function write(path,data){const target=new URL(path,root),temp=new URL(`${target.href}.tmp`);await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,target)}
await mkdir(new URL('weekly/reports/',root),{recursive:true})
await write(`weekly/reports/${candidate.periodEnd}.json`,candidate)
await write('weekly/index.json',nextIndex)
if(!latest.periodEnd||candidate.periodEnd>latest.periodEnd)await write('weekly/latest.json',candidate)
console.log(`Prepared ${candidate.periodEnd}; validate and commit all weekly files together before publishing.`)
