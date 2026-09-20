import type { V41Scenario } from '@/lib/deepseek-v41-reference'
import { selectV41Lesson, v41LessonContent, v41Lessons } from '@/lib/v41-learning'

export default function V41LearningGuide({ state, onChange, onLocate }: {
  state: V41Scenario
  onChange: (next: Partial<V41Scenario>) => void
  onLocate: (next: Partial<V41Scenario>, target: string) => void
}) {
  const step = v41LessonContent(state), index = state.lesson ?? 0
  const active = state.lesson !== undefined
  const navigate = (next: number) => onChange(selectV41Lesson(state, next))
  return <section aria-label="V4.1 专题索引" className="mt-4 rounded-2xl border border-white/10 bg-[#0b141d] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-medium text-violet-100">V4.1 专题索引</h2><button type="button" onClick={() => active ? onChange({ lesson: undefined }) : navigate(0)} className="min-h-11 rounded-lg border border-white/15 px-3 text-sm text-white/70">{active ? '收起专题' : '展开专题'}</button></div>
    {active && <>
      <label className="mt-4 block text-xs text-white/50">架构专题<select aria-label="V4.1 架构专题" value={index} onChange={event => navigate(Number(event.target.value))} className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#101e29] px-3 text-sm text-white">{v41Lessons.map((lesson, i) => <option key={lesson.title} value={i}>{i + 1}. {lesson.title}</option>)}</select></label>
      <div id="v41-topic-content" aria-live="polite" className="mt-4">
        <p className="font-mono text-xs text-white/45">LAYER {state.layer} / RANK {state.rank}</p>
        <h3 className="mt-2 text-lg text-white">{step.heading}</h3>
        <p className="mt-2 text-sm leading-7 text-white/75">{step.description}</p>
      </div>
      <button type="button" onClick={() => onLocate(selectV41Lesson(state, index), step.target)} className="mt-4 min-h-11 rounded-lg border border-cyan-200/25 px-4 text-sm text-cyan-100">定位对应模块</button>
    </>}
  </section>
}
