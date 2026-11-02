import { Link } from 'react-router-dom'
import data from '@/data/learning-guide.json'
import config from '../../config/curriculum-guide.json'
const conclusions: Record<string,string> = {
  cache:'区分权重、历史 KV 与临时工作区；先确认模型和 Backend 保存的状态，再讨论容量、分页与前缀复用。',
  'attention-dp':'先确定请求与 token 行归属，再分析 Attention 子组、FFN / MoE 的协作；相同形状可能表示 replica 或 partial。',
}
export default function ArticleLearningContext({sourcePath}:{sourcePath:string}) {
  if(!config.enabled) return null
  const material=data.materials.find(m=>m.sourcePath===sourcePath)
  const topic=data.topics.find(t=>t.id===material?.topicId)
  if(!topic) return null
  return <section aria-label="主题学习导航" className="mb-8 rounded-xl border border-line bg-surface p-5">
    <Link className="text-sm font-medium text-accent" to={`/learn/topics/${topic.id}`}>← {topic.title} · 主题学习</Link>
    {conclusions[topic.id]&&<p className="mt-3 text-sm leading-7 text-secondary">学习要点：{conclusions[topic.id]}</p>}
    <details className="mt-2 text-sm text-secondary"><summary className="cursor-pointer py-2">主题内继续阅读</summary><ul className="mt-2 space-y-3">{data.materials.filter(m=>m.topicId===topic.id&&m.slug&&m.sourcePath!==sourcePath&&m.role!=='navigation').map(m=><li key={m.id}><Link className="text-accent hover:underline" to={`/article/${m.slug}?topic=${topic.id}`}>{m.title}</Link></li>)}</ul><Link className="mt-4 inline-block text-accent" to={`/learn/topics/${topic.id}`}>查看原理、源码、平台与实验的完整顺序 →</Link></details>
  </section>
}
