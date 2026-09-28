import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { weeklyFreshness } from '@/lib/weekly-news.mjs'
import latest from '@/data/news/weekly/latest.json'
import daily from '@/data/news/daily.json'

export default function NewsFreshness(){
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(id)},[])
  const weekly=weeklyFreshness(latest,now),age=now.getTime()-Date.parse(daily.generatedAt??'')
  const fresh=Number.isFinite(age)&&age>=-3600000&&age<=48*3600000
  return <section aria-label="内容更新状态" className="mb-6 grid gap-4 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2">
    <div><p className="font-medium text-ink">每日信号 · {fresh?'已更新':'需要检查更新'}</p><p className="mt-2 text-xs leading-6 text-muted">最近采集：{daily.generatedAt?new Date(daily.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未知'}（北京时间） · {daily.failedSourceCount} 个信源本次未成功</p></div>
    <div><p className={`font-medium ${weekly.state==='current'?'text-ink':'text-amber-200'}`}>周报 · {weekly.state==='current'?'本期已发布':weekly.state==='overdue'?'存在待补期次':weekly.state==='invalid'?'日期异常，待核对':'尚未发布'}</p><p className="mt-2 text-xs leading-6 text-muted">应覆盖：{weekly.expected.start} 至 {weekly.expected.end}。状态由当前日期与已发布文件计算，不代表后台任务正在运行。</p><Link to="/news/weekly" className="inline-flex min-h-11 items-center text-accent hover:underline">查看周报与历史 →</Link></div>
  </section>
}
