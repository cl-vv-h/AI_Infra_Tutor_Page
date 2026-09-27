import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import ModelSectionNav from '@/components/ModelSectionNav'
import { knowledgeGroups, modelKnowledge, modelNotation } from '@/data/model-knowledge'

export default function ModelKnowledge() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const topic = modelKnowledge.find(item => item.id === topicId)
  useEffect(() => { const previous = document.title; document.title = `${topic?.title ?? '模型知识体系'} · AI Infra Space`; return () => { document.title = previous } }, [topic])
  if (topicId && !topic) return <div className="model-lab-shell min-h-screen px-5 py-10 text-white"><div className="mx-auto max-w-6xl"><ModelSectionNav /><h1 className="text-2xl">专题不存在</h1><Link to="/models/knowledge" className="mt-4 inline-block text-cyan-100">返回知识体系</Link></div></div>
  return <div className="model-lab-shell min-h-screen px-5 py-8 text-white sm:px-8 lg:px-10"><div className="mx-auto max-w-[1360px]">
    <ModelSectionNav />
    {topic ? <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block"><nav aria-label="知识专题" className="sticky top-24 space-y-6">{knowledgeGroups.map(group => <div key={group.id}><p className="mb-2 px-3 text-xs text-secondary">{group.index} / {group.title}</p>{modelKnowledge.filter(item => item.group === group.id).map(item => <Link key={item.id} to={`/models/knowledge/${item.id}`} aria-current={topic.id === item.id ? 'page' : undefined} className={`block rounded-lg px-3 py-2.5 text-sm ${topic.id === item.id ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-white'}`}>{item.title}</Link>)}</div>)}</nav></aside>
      <article className="min-w-0" aria-label={topic.title}>
        <select aria-label="切换知识专题" value={topic.id} onChange={event => navigate(`/models/knowledge/${event.target.value}`)} className="mb-6 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-field px-3 text-sm text-white lg:hidden">{knowledgeGroups.map(group => <optgroup key={group.id} label={group.title}>{modelKnowledge.filter(item => item.group === group.id).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}</select>
        <PageHeader eyebrow={knowledgeGroups.find(group => group.id === topic.group)?.title ?? 'MODEL SYSTEMS'} title={topic.title} description={topic.summary} compact />
        {!!topic.prerequisites.length && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-secondary"><span>基础概念</span>{topic.prerequisites.map(id => <Link key={id} to={`/models/knowledge/${id}`} className="rounded-full border border-white/10 px-3 py-1.5 text-secondary hover:text-cyan-100">{modelKnowledge.find(item => item.id === id)?.title}</Link>)}</div>}
        <div className="mt-8 space-y-5">{topic.concepts.map((concept, i) => <section key={concept.title} className="rounded-xl border border-line bg-surface p-5 sm:p-6"><div className="flex items-baseline gap-3"><span className="font-mono text-xs text-muted">0{i + 1}</span><h2 className="text-lg font-medium">{concept.title}</h2></div><p className="mt-3 text-sm leading-7 text-secondary">{concept.body}</p><p className="mt-4 break-words rounded-xl bg-cyan-200/[0.045] p-4 font-mono text-sm leading-7 text-cyan-100">{concept.expression}</p><p className="mt-3 text-xs leading-6 text-secondary">{concept.scope}</p></section>)}</div>
        <div className="mt-8 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">{[['模型实例', topic.examples], ['课程与推导', topic.readings]].map(([title, links]) => <section key={title as string}><h2 className="text-xs tracking-wider text-secondary">{title as string}</h2><div className="mt-3 space-y-2">{(links as typeof topic.examples).map(link => <Link key={link.to} to={link.to} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-cyan-100 hover:bg-white/5">{link.label}<ArrowUpRight className="h-4 w-4 shrink-0" /></Link>)}</div></section>)}</div>
      </article>
    </div> : <>
      <PageHeader eyebrow="MODEL SYSTEMS" title="模型知识体系" description="结构定义计算，执行决定布局，服务呈现性能。" actions={<span>{knowledgeGroups.length} 个层级 / {modelKnowledge.length} 个专题 / {modelKnowledge.reduce((n, topic) => n + topic.concepts.length, 0)} 个核心概念</span>} />
      <section aria-label="知识层级" className="mt-9 grid gap-5 lg:grid-cols-3">{knowledgeGroups.map(group => <div key={group.id} className="overflow-hidden rounded-xl border border-line bg-surface"><div className="h-0.5" style={{ backgroundColor: group.color }} /><div className="p-5 sm:p-6"><p className="font-mono text-xs tracking-widest" style={{ color: group.color }}>{group.index}</p><h2 className="mt-4 text-xl font-medium">{group.title}</h2><p className="mt-2 text-sm text-secondary">{group.subtitle}</p><ol className="mt-6 divide-y divide-white/10">{modelKnowledge.filter(item => item.group === group.id).map(item => <li key={item.id}><Link to={`/models/knowledge/${item.id}`} className="group flex min-h-24 items-center justify-between gap-4 py-4"><div><h3 className="text-base text-white/85 group-hover:text-cyan-100">{item.title}</h3><p className="mt-2 text-xs leading-6 text-secondary">{item.summary}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted group-hover:text-cyan-100" /></Link></li>)}</ol></div></div>)}</section>
      <section aria-label="张量符号" className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-6"><h2 className="text-sm font-medium text-secondary">统一符号</h2><dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">{modelNotation.map(([symbol, definition]) => <div key={symbol}><dt className="font-mono text-sm text-cyan-100">{symbol}</dt><dd className="mt-1.5 text-xs leading-5 text-secondary">{definition}</dd></div>)}</dl></section>
    </>}
  </div></div>
}
