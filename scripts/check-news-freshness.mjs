import {readJson} from './weekly-files.mjs'
import {weeklyFreshness} from '../src/lib/weekly-news.mjs'
const daily=await readJson('daily.json'),weekly=await readJson('weekly/latest.json'),now=new Date(),issues=[]
const dailyAge=now-Date.parse(daily.generatedAt??'')
if(!Number.isFinite(dailyAge)||dailyAge< -3600000||dailyAge>48*3600000)issues.push('Daily news has no valid successful collection within 48 hours.')
const status=weeklyFreshness(weekly,now)
const graceDeadline=Date.parse(status.expected.end)+2*86400000+90*60000
if(status.state==='invalid'||(status.missingWeeks??0)>1||status.state!=='current'&&now.getTime()>=graceDeadline)issues.push(`Weekly report overdue: expected ${status.expected.start}–${status.expected.end}; last published ${weekly.periodEnd??'none'}. Check the local Luna automation and isolated workspace.`)
if(issues.length){console.error(issues.join('\n'));process.exitCode=1}else console.log('News freshness is within deadlines (48h daily; 24h weekly grace).')
