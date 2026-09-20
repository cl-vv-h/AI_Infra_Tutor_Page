import { useState } from 'react'
import type { V41Scenario } from '@/lib/deepseek-v41-reference'
import { v41Params } from '@/lib/deepseek-v41-reference'
import { selectV41Lesson, v41LessonContent, v41Lessons } from '@/lib/v41-learning'

function LessonAnswer({ answer }: { answer: string }) {
  const [revealed, setRevealed] = useState(false)
  return <><button type="button" aria-expanded={revealed} aria-controls="v41-lesson-answer" onClick={() => setRevealed(!revealed)} className="min-h-11 rounded-xl bg-violet-200 px-4 text-sm text-[#171023]">{revealed ? '收起本步答案' : '揭示本步答案'}</button><div id="v41-lesson-answer" hidden={!revealed} className="mt-4 rounded-xl border border-violet-200/20 p-4 text-sm leading-7 text-white/75">{answer}</div></>
}

export default function V41LearningGuide({ state, onChange, onLocate }: {
  state: V41Scenario
  onChange: (next: Partial<V41Scenario>) => void
  onLocate: (next: Partial<V41Scenario>, target: string) => void
}) {
  const key = v41Params(state).toString()
  const step = v41LessonContent(state), index = state.lesson ?? 0
  const active = state.lesson !== undefined
  const navigate = (next: number) => onChange(selectV41Lesson(state, next))
  return <section aria-label="V4.1 学习导览" className="mt-4 rounded-2xl border border-violet-200/25 bg-violet-200/5 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">8 步理解 V4.1 · 先预测，再验证</h2><button type="button" onClick={() => active ? onChange({ lesson: undefined }) : navigate(0)} className="min-h-11 rounded-xl border border-violet-200/25 px-4 text-sm text-violet-100">{active ? '退出导览' : '开始 V4.1 导览'}</button></div>
    {active ? <>
      <ol className="mt-4 grid grid-cols-2 list-none gap-2 p-0 lg:grid-cols-4">{v41Lessons.map((lesson, i) => <li key={lesson.title} className="min-w-0"><button type="button" aria-current={i === index ? 'step' : undefined} aria-label={`V4.1 导览第 ${i + 1} 步：${lesson.title}`} onClick={() => navigate(i)} className={`h-full min-h-11 w-full break-words rounded-lg border px-3 py-2 text-left text-sm ${i === index ? 'border-violet-200 bg-violet-200/15 text-violet-100' : 'border-white/10 text-white/65'}`}>{i + 1}. {lesson.title}</button></li>)}</ol>
      <p className="mt-4 text-xs text-white/55">第 {index + 1} / {v41Lessons.length} 步 · 当前 Layer {state.layer} / Rank {state.rank} · 答案随当前实验条件计算</p>
      <h3 className="mt-2 text-base text-violet-100">{step.question}</h3>
      <div className="mt-4"><LessonAnswer key={key} answer={step.answer} /><button type="button" onClick={() => onLocate(selectV41Lesson(state, index), step.target)} className="mt-3 min-h-11 rounded-xl border border-white/20 px-4 text-sm text-cyan-100">定位本步演示</button></div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={index === 0} onClick={() => navigate(index - 1)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm disabled:opacity-30">上一步</button><button type="button" disabled={index === v41Lessons.length - 1} onClick={() => navigate(index + 1)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm disabled:opacity-30">下一步</button></div>
      <p className="mt-3 text-xs leading-6 text-white/50">换步或修改实验配置后先重新预测。导览只更换层、支路与工作区，不重置 B、S、world、独立副本、rank 或存储格式；不记录个人成绩。</p>
    </> : <p className="mt-2 text-sm leading-6 text-white/60">从四路主干、缓存来源，到逐 rank 权重与量化口径。可自由跳步，网址只保存当前步骤及实验配置。</p>}
  </section>
}
