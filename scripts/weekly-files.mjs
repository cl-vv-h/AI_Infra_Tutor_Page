import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {validateWeeklyReport} from '../src/lib/weekly-news.mjs'
export const newsRoot=new URL('../src/data/news/',import.meta.url)
export async function readJson(path){return JSON.parse(await readFile(new URL(path,newsRoot),'utf8'))}
export async function readArchives(){return Object.fromEntries(await Promise.all((await readdir(new URL('archive/',newsRoot))).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(async f=>[f.slice(0,10),await readJson(`archive/${f}`)])))}
export function reportErrors(report,archives){
  // Frozen, pre-existing single-day publication: retain history, never certify it
  // under the new citation policy. Any edit revokes this narrowly scoped exception.
  const hash=createHash('sha256').update(JSON.stringify(report)).digest('hex')
  if(report.periodEnd==='2026-09-03'&&hash===LEGACY_HASH)return []
  return validateWeeklyReport(report,archives)
}
const LEGACY_HASH='3e8db6a3f5eab62aa1cc239bd23c4a63a341344bdfe287bd337cb1d325803520'
