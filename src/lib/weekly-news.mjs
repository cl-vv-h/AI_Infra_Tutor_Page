const dayMs=86400000
export const weeklyModel='gpt-5.6-luna'
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day}
export function shiftDay(day,offset){if(!validDay(day))throw new Error('Invalid calendar date');return new Date(Date.parse(day)+offset*dayMs).toISOString().slice(0,10)}
export function periodDays(start,end){if(!validDay(start)||!validDay(end)||start>end||Date.parse(end)-Date.parse(start)>6*dayMs)throw new Error('Invalid weekly period');return Array.from({length:(Date.parse(end)-Date.parse(start))/dayMs+1},(_,i)=>shiftDay(start,i))}
// Completed Monday–Sunday; due Monday 09:30 Asia/Shanghai.
export function dueWeek(now=new Date()){
  const local=new Date(new Date(now).getTime()+8*3600000)
  if(!Number.isFinite(local.getTime()))throw new Error('Invalid clock')
  const today=local.toISOString().slice(0,10),dow=(local.getUTCDay()+6)%7
  const beforeDeadline=dow===0&&(local.getUTCHours()*60+local.getUTCMinutes()<570)
  const end=shiftDay(today,-dow-1-(beforeDeadline?7:0))
  return {start:shiftDay(end,-6),end}
}
export function pendingWeeks(archiveDates,reportEnds,now=new Date()){
  const dates=[...new Set(archiveDates.filter(validDay))].sort(),done=new Set(reportEnds),periods=[]
  if(!dates.length)return periods
  for(let end=dueWeek(now).end;end>=dates[0];end=shiftDay(end,-7)){
    const start=shiftDay(end,-6),available=periodDays(start,end).filter(d=>dates.includes(d))
    if(!done.has(end)&&available.length)periods.push({start,end,archiveDates:available})
    if(periods.length>=52)break
  }
  return periods
}
export function weeklyFreshness(report,now=new Date()){
  const expected=dueWeek(now)
  if(!report||!validDay(report.periodEnd)||!report.generatedAt)return {state:'missing',expected,missingWeeks:null}
  if(!Number.isFinite(Date.parse(report.generatedAt))||Date.parse(report.generatedAt)>new Date(now).getTime()+3600000||report.periodEnd>expected.end)return {state:'invalid',expected,missingWeeks:null}
  const missingWeeks=Math.max(0,Math.ceil((Date.parse(expected.end)-Date.parse(report.periodEnd))/(7*dayMs)))
  return {state:missingWeeks?'overdue':'current',expected,missingWeeks}
}
export function normalizedSourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?value.replace(/^http:/,'https:'):''}catch{return ''}}
export function reportLinks(content){
  const urls=[]
  for(let i=0;i<content.length;i++)if(content.slice(i,i+2)===']('){
    let depth=1,j=i+2
    for(;j<content.length&&depth;j++){if(content[j]==='(')depth++;else if(content[j]===')')depth--}
    if(depth)throw new Error('Unclosed Markdown link')
    const value=content.slice(i+2,j-1)
    if(!/^https:\/\/[^\s]+$/.test(value))throw new Error('Only inline HTTPS citations are allowed')
    const u=new URL(value)
    if(u.username||u.password)throw new Error('URL credentials are not allowed')
    urls.push(value);i=j-1
  }
  return urls
}
export function validateWeeklyReport(report,archives,{now=new Date(),legacy=false}={}){
  const errors=[],fail=s=>errors.push(s)
  if(!report||typeof report!=='object')return ['Report must be an object']
  const keys=['generatedAt','periodStart','periodEnd','model','itemCount','content','sources','archiveDates']
  if(Object.keys(report).some(k=>!keys.includes(k)))fail('Unexpected report fields')
  if(report.model!==weeklyModel)fail('Model must be gpt-5.6-luna')
  let days=[]
  try{days=periodDays(report.periodStart,report.periodEnd)}catch{fail('Invalid calendar period')}
  if(!legacy&&(days.length!==7||new Date(report.periodStart).getUTCDay()!==1))fail('New reports must cover Monday–Sunday')
  if(typeof report.generatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(report.generatedAt)||!Number.isFinite(Date.parse(report.generatedAt))||Date.parse(report.generatedAt)>new Date(now).getTime()+3600000)fail('Invalid generation timestamp')
  if(report.periodEnd>dueWeek(now).end&&!legacy)fail('Reporting period is not due yet')
  if(!legacy&&validDay(report.periodEnd)&&Date.parse(report.generatedAt)<Date.parse(report.periodEnd)+16*3600000)fail('Generation timestamp predates the completed reporting week')
  const available=days.filter(d=>archives[d]),recorded=report.archiveDates
  if(!available.length)fail('No archived evidence for this period')
  if(!legacy&&(!Array.isArray(recorded)||JSON.stringify(recorded)!==JSON.stringify(available)))fail('archiveDates must list actual available dates in order')
  const content=report.content
  if(typeof content!=='string'||content.length<200||content.length>16000)fail('Report content must contain 200–16000 characters')
  if(typeof content==='string'){
    const headings=content.split(/\r?\n/).filter(s=>/^#{1,2} /.test(s))
    if(JSON.stringify(headings)!==JSON.stringify(['# 本周信号','## AI','## 科技','## 金融','## 国际形势','## 跨板块观察','## 下周观察清单']))fail('Required headings must occur exactly once in order')
    if(/<\/?[a-z][^>]*>|!\[|\]\[[^\]]*\]/i.test(content))fail('HTML, images and reference-style links are not allowed')
    if(!legacy&&available.length<7&&!/归档不完整|证据不足|缺失/.test(content))fail('Incomplete coverage must be disclosed')
  }
  const serialized=JSON.stringify(report)
  if(/OPENAI_API_KEY|\bsk-[A-Za-z0-9_-]{12,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\/Users\/|\/home\/|[A-Z]:\\Users\\/i.test(serialized))fail('Sensitive or local-only data detected')
  if(!Array.isArray(report.sources)||!report.sources.length)return [...errors,'Sources are required']
  const evidence=available.flatMap(d=>archives[d].items??[]),urls=new Set()
  for(const s of report.sources){
    if(!s||Object.keys(s).sort().join(',')!=='source,title,url'||typeof s.url!=='string'||!s.url.startsWith('https://')){fail('Invalid source entry');continue}
    if(urls.has(s.url))fail('Duplicate citation source');urls.add(s.url)
    if(!evidence.some(item=>normalizedSourceUrl(item.url)===s.url&&item.title===s.title&&item.source===s.source))fail('Source must match an archived title, URL and publisher')
  }
  if(!Number.isInteger(report.itemCount)||report.itemCount!==urls.size)fail('itemCount must equal unique sources')
  try{
    const cited=new Set(reportLinks(typeof content==='string'?content:''))
    if([...cited].some(u=>!urls.has(u))||[...urls].some(u=>!cited.has(u)))fail('Citations and declared sources must match both ways')
  }catch(e){fail(e.message)}
  return [...new Set(errors)]
}
