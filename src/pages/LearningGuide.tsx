import { Link, useParams } from 'react-router-dom'
import data from '@/data/learning-guide.json'
import CurriculumSearch from '@/components/CurriculumSearch'
import PageHeader from '@/components/PageHeader'
import attention from '../../config/attention-atlas.json'

const layers: Record<string,string> = { overview:'总览',principles:'原理',runtime:'运行时',platform:'平台实现',experiment:'实验',reference:'参考','case-study':'综合案例' }
const levels: Record<string,string> = {introductory:'入门',intermediate:'进阶',advanced:'深入'}
const order = ['principles','overview','runtime','platform','experiment','case-study','reference']
export default function LearningGuide() {
  const { domainId, topicId, pathId } = useParams()
  const domain = data.domains.find(d=>d.id===domainId)
  const topic = data.topics.find(t=>t.id===topicId)
  const path = data.paths.find(p=>p.id===pathId)
  const materialLink = (sourcePath:string) => {
    const m=data.materials.find(m=>m.sourcePath===sourcePath)
    return !m ? <span>{sourcePath}</span> : m.slug ? <Link className="text-accent hover:underline" to={`/article/${m.slug}?topic=${m.topicId}`}>{m.title}</Link> : <a className="text-accent" href={m.sourceUrl} target="_blank" rel="noopener noreferrer">{m.title} ↗</a>
  }
  const back=<Link to="/learn" className="mb-8 inline-flex min-h-11 items-center text-sm text-accent">← 课程总览</Link>
  if ((domainId&&!domain)||(topicId&&!topic)||(pathId&&!path)) return <div className="page-container py-16"><h1 className="text-2xl text-ink">未找到课程入口</h1>{back}</div>
  if(topic){
    const parent=data.domains.find(d=>d.id===topic.domainId)!
    const materials=data.materials.filter(m=>m.topicId===topic.id&&m.role!=='navigation')
    const planned=data.planned.filter(p=>p.topicId===topic.id)
    return <div className="page-container py-8 sm:py-12 [overflow-wrap:anywhere]">
      <nav aria-label="课程位置" className="mb-8 flex flex-wrap gap-3 text-sm text-secondary"><Link to="/learn">课程总览</Link><span>/</span><Link to={`/learn/domains/${parent.id}`}>{parent.title}</Link></nav>
      <PageHeader eyebrow="TOPIC GUIDE / 主题学习" title={topic.title} description="按原理、运行时、平台实现与实验选择阅读深度。平台标签描述材料范围，兼容条件与验证结论以原文为准。"/>
      <div className="my-6 flex flex-wrap gap-3 text-sm text-secondary"><span>建议先修：</span>{topic.prerequisites.length?topic.prerequisites.map(id=><Link className="text-accent hover:underline" key={id} to={`/learn/topics/${id}`}>{data.topics.find(t=>t.id===id)?.title}</Link>):<span>无专题前置要求</span>}</div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]"><div>
        {order.map(layer=>{const entries=materials.filter(m=>m.layer===layer);return entries.length>0&&<section key={layer} className="mb-8"><h2 className="mb-3 text-lg font-medium text-ink">{layers[layer]}</h2><div className="divide-y divide-line border-y border-line">{entries.map(m=><div key={m.id} className="py-5"><div className="mb-2 flex flex-wrap gap-3 text-xs text-muted"><span>{levels[m.difficulty]}</span><span>{m.platforms.join(' / ')}</span><span>{m.languages.join(' / ').toUpperCase()}</span>{m.role==='annotated-source'&&<span>中文注释源码</span>}</div><h3 className="text-base font-medium">{materialLink(m.sourcePath)}</h3><details className="mt-3 text-xs leading-6 text-secondary"><summary className="cursor-pointer py-2">来源与阅读边界</summary><p className="my-2 break-all">{m.sourcePath}</p><a className="text-accent" href={m.sourceUrl} target="_blank" rel="noopener noreferrer">固定版本原文 ↗</a><p className="mt-2">站内正文保留原有编辑适配；实现版本、实验依赖和设备验证范围请查阅正文。{m.layer==='experiment'?' 数学模拟不等于真实网络或设备性能。':''}</p></details></div>)}</div></section>})}
        {!materials.length&&<p className="surface-card p-6 text-secondary">本主题暂以目录和关联材料为入口，正文待整理。</p>}
        {!!planned.length&&<details className="surface-card p-5"><summary className="cursor-pointer text-secondary">规划中的专项章节（{planned.length}）</summary><ul className="mt-4 space-y-3">{planned.map(p=><li key={p.title} className="text-sm text-secondary">{p.title} · 尚未成文 <a className="text-accent" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">查看计划依据 ↗</a></li>)}</ul></details>}
      </div><aside className="space-y-6"><section className="surface-card p-5"><h2 className="font-medium text-ink">继续探索</h2><Link className="mt-4 block text-sm text-accent" to="/models">模型结构与缓存实验室 →</Link><Link className="mt-3 block text-sm text-accent" to="/operators">性能分析与优化 →</Link>{attention.enabled&&<Link className="mt-3 block text-sm text-accent" to="/learn/attention">Attention 演进图谱 →</Link>}</section><p className="text-xs leading-6 text-secondary">来源：SGLang Tutor<br/>内容整理基线：{data.sourceRevision.slice(0,7)}<br/>源码讲解、数学验证与设备实测分别判断。</p><Link className="button-secondary" to={`/learn/domains/${parent.id}`}>返回领域目录</Link></aside></div>
    </div>
  }
  if(path) return <div className="page-container py-10 [overflow-wrap:anywhere]">{back}<PageHeader eyebrow="LEARNING PATH / 学习路线" title={path.title} description={path.outcome}/><p className="my-6 text-sm text-secondary">入口要求：{path.entryRequirements}</p><ol className="max-w-3xl divide-y divide-line border-y border-line">{path.steps.map((step,i)=><li key={step.sourcePath} className="flex gap-5 py-5"><span className="font-mono text-muted">{String(i+1).padStart(2,'0')}</span><div>{materialLink(step.sourcePath)}<p className="mt-2 text-sm text-secondary">{step.goal}</p>{step.section&&<p className="mt-2 text-xs text-muted">{step.section}</p>}</div></li>)}</ol>{'branches'in path&&path.branches?.map(branch=><section className="mt-8" key={branch.title}><h2 className="mb-3 text-lg text-ink">{branch.title}</h2><ul className="space-y-3">{branch.steps.map(step=><li key={step.sourcePath}>{materialLink(step.sourcePath)}<p className="text-sm text-secondary">{step.goal}</p></li>)}</ul></section>)}{!!path.optional.length&&<section className="mt-8"><h2 className="mb-4 text-lg text-ink">按需选读</h2><ul className="space-y-3">{path.optional.map(step=><li key={step.sourcePath}>{materialLink(step.sourcePath)}<p className="text-sm text-secondary">{step.goal}</p></li>)}</ul></section>}</div>
  return <div className="learn-shell page-container space-y-10 py-10 sm:py-12 [overflow-wrap:anywhere]">
    {domain&&back}<PageHeader eyebrow="AI INFRA / LEARNING" title={domain?.title??'理解推理系统，从一条清晰的路线开始。'} description="从模型原理到运行时，再到并行、性能与算子实现。按学习目标入门，也可以按主题深入查阅。"/><CurriculumSearch/>
    {!domain&&<section><h2 className="mb-5 text-xl font-medium text-ink">按目标学习</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.paths.map((p,i)=><Link key={p.id} className="surface-card p-5 hover:border-accent/50" to={`/learn/paths/${p.id}`}><span className="font-mono text-xs text-muted">0{i+1} / LEARNING PATH</span><h3 className="mt-5 font-medium text-ink">{p.title}</h3><p className="mt-3 text-sm leading-6 text-secondary">{p.outcome}</p><span className="mt-5 inline-block text-xs text-accent">查看阅读顺序 →</span></Link>)}</div></section>}
    <section><h2 className="mb-5 text-xl font-medium text-ink">{domain?'主题目录':'按知识领域探索'}</h2>{!domain&&<div className="mb-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">{data.domains.map(d=><Link key={d.id} className="bg-surface p-5 hover:bg-raised" to={`/learn/domains/${d.id}`}><h3 className="font-medium text-ink">{d.title}</h3><p className="mt-2 text-xs text-secondary">{data.topics.filter(t=>t.domainId===d.id).length} 个主题 →</p></Link>)}</div>}
    {!domain&&<div className="flex flex-wrap gap-3"><Link to="/learn/topics/cache" className="button-secondary">KV Cache 学习专题 →</Link><Link to="/learn/topics/attention-dp" className="button-secondary">DP Attention 学习专题 →</Link></div>}
    {domain&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.topics.filter(t=>t.domainId===domain.id).map(t=><Link key={t.id} to={`/learn/topics/${t.id}`} className="surface-card p-5 hover:border-accent/50"><h3 className="font-medium text-ink">{t.title}</h3><p className="mt-3 text-xs text-secondary">{data.materials.filter(m=>m.topicId===t.id&&m.role!=='navigation').length} 项正文、实验与参考 →</p></Link>)}</div>}</section>
    <section className="flex flex-wrap gap-5 border-t border-line pt-6 text-sm text-accent">{attention.enabled&&<Link to="/learn/attention">Attention 演进图谱 →</Link>}<Link to="/category/sglang">SGLang 源码阅读室 →</Link><Link to="/knowledge-graph">系统知识图谱 →</Link></section>
    <details className="text-xs leading-6 text-secondary"><summary className="cursor-pointer py-3">课程范围与来源</summary><p>8 个领域、47 个主题；目录、注释源码、图表与计划章节不计为已完成课程。内容来自 SGLang Tutor，具体实现与验证范围按各篇原文说明。旧分类与文章地址继续可用。</p></details>
  </div>
}
