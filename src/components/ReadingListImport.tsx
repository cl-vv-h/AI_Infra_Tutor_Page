import { useEffect, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import type { NewsItem } from '@/types/news'
import { maxImportBytes, mergeReadingImport, previewReadingImport, ReadingImportError } from '@/lib/reading-list-transfer'

export function ReadingImportPreview({ candidate, current, disabled, onConfirm }: { candidate: ReturnType<typeof previewReadingImport>; current: NewsItem[]; disabled: boolean; onConfirm: () => void }) {
  const plan = mergeReadingImport(current, candidate.items)
  return <div className="mt-4 rounded-xl border border-lime-200/20 bg-lime-200/[0.03] p-4">
    <p role="status" className="text-base text-lime-100">待新增 {plan.additions.length} 条 · 重复 {candidate.duplicates + plan.duplicates} 条 · 已有 {current.length} 条保留</p>
    <p className="mt-2 text-sm leading-6 text-white/60">相同 ID 或原文链接视为重复，保留已有内容；导入文件的来源、日期与发布阶段未核验。未知字段不会保存。</p>
    {plan.additions.length > 0 ? <><ol className="mt-3 space-y-2">{plan.additions.slice(0, 5).map((item) => <li key={item.id} className="text-sm leading-6 text-slate-200"><span className="block break-words">{item.title}</span><span className="break-all text-white/50">{new URL(item.url).hostname}</span></li>)}</ol>{plan.additions.length > 5 && <p className="mt-2 text-sm text-white/60">另有 {plan.additions.length - 5} 条，确认后可在阅读清单中查看。</p>}<button type="button" disabled={disabled} onClick={onConfirm} className="mt-4 rounded-xl bg-lime-200 px-4 py-2.5 text-sm font-semibold text-[#0b131c] disabled:opacity-40">确认合并 {plan.additions.length} 条</button></> : <p className="mt-3 text-sm text-white/70">全部记录已存在，无需写入。</p>}
  </div>
}

export default function ReadingListImport({ current, disabled, onConfirm }: { current: NewsItem[]; disabled: boolean; onConfirm: (items: NewsItem[]) => void }) {
  const [candidate, setCandidate] = useState<ReturnType<typeof previewReadingImport> | null>(null)
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  const plan = candidate ? mergeReadingImport(current, candidate.items) : null
  function cancel() { request.current++; setCandidate(null); setReading(false); setMessage(''); if (input.current) input.current.value = '' }
  async function select(file?: File) {
    const ticket = ++request.current
    setCandidate(null); setMessage(''); setReading(false)
    if (!file) return
    if (file.size > maxImportBytes) { setMessage('文件超过 2 MiB；请分批导入。'); return }
    setReading(true)
    try {
      const preview = previewReadingImport(await file.text())
      if (ticket === request.current) setCandidate(preview)
    } catch (error) {
      if (ticket === request.current) setMessage(error instanceof ReadingImportError ? error.message : '文件读取失败；请选择可读取的 JSON 文件重试。')
    } finally { if (ticket === request.current) setReading(false) }
  }
  function confirm() {
    if (!candidate || !plan?.additions.length || disabled) return
    try { onConfirm(candidate.items); cancel() }
    catch (error) { setMessage(error instanceof ReadingImportError ? error.message : '导入未完成，原收藏未改动。') }
  }
  return <details className="rounded-2xl border border-cyan-200/20 bg-[#0b131c] p-4">
    <summary className="cursor-pointer text-sm text-cyan-100"><FileUp className="mr-2 inline h-4 w-4" />导入阅读清单</summary>
    <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">选择本站导出的 v2 JSON 文件，先预览再合并。仅在此浏览器读取和保存，不上传、不自动打开原文，也不覆盖已有收藏。</p>
    <p className="mt-2 text-sm leading-6 text-white/60">导入时请避免在其他标签页同时编辑收藏。清除浏览器数据会丢失本机清单，请保留导出备份。</p>
    <div className="mt-4 flex flex-wrap items-center gap-3"><label className={`rounded-xl border border-white/20 px-3 py-2.5 text-sm text-cyan-100 focus-within:outline focus-within:outline-2 focus-within:outline-cyan-200 ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-white/5'}`}>选择 JSON 文件<input ref={input} type="file" accept=".json,application/json" aria-label="选择阅读清单 JSON 文件" disabled={disabled} onChange={(event) => { void select(event.target.files?.[0]) }} className="sr-only" /></label><span className="text-sm text-white/60">最多 500 条记录 · 文件上限 2 MiB</span>{(candidate || reading || message) && <button type="button" onClick={cancel} className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70">取消导入</button>}</div>
    {disabled && <p className="mt-3 text-sm text-amber-100">原收藏正在恢复或读取异常，暂不允许导入。</p>}
    {reading && <p role="status" className="mt-3 text-sm text-cyan-100">正在本机读取文件…</p>}
    {message && <p role="alert" className="mt-3 text-sm leading-6 text-amber-100">{message}</p>}
    {candidate && <ReadingImportPreview candidate={candidate} current={current} disabled={disabled} onConfirm={confirm} />}
  </details>
}
