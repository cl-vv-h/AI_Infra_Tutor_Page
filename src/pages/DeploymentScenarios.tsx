import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import ModelSectionNav from '@/components/ModelSectionNav'
import ScenarioComparison from '@/components/ScenarioComparison'
import { calculatorVersion, siteFeatures } from '@/lib/site-release'
import { exportScenarios, inspectScenario, maxScenarioBytes, mergeScenarios, parseScenarioImport, scenarioName } from '@/lib/deployment-scenarios'
import type { DeploymentScenarioSnapshot, ScenarioLibrary } from '@/lib/deployment-scenarios'
import { changeScenarioLibrary, readScenarioLibrary } from '@/lib/scenario-store'

function download(items: DeploymentScenarioSnapshot[]) {
  const url = URL.createObjectURL(new Blob([exportScenarios(items)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'deployment-scenarios-v1.json'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function DeploymentScenarios() {
  return siteFeatures.scenarioLibrary ? <ScenarioLibraryPage /> : <div className="page-container py-12"><h1 className="text-3xl text-ink">方案库暂未开放</h1><p className="my-5 text-secondary">本机方案没有被删除；重新开放后可继续读取。</p><Link className="button-secondary" to="/models">返回模型目录</Link></div>
}
function ScenarioLibraryPage() {
  const [params, setParams] = useSearchParams()
  const [library, setLibrary] = useState<ScenarioLibrary | null>(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<DeploymentScenarioSnapshot[] | null>(null)
  const [editing, setEditing] = useState<{ item: DeploymentScenarioSnapshot; mode: 'rename' | 'copy' | 'delete' } | null>(null), [name, setName] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), file = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const selectedIds = [...new Set((params.get('compare') ?? '').split(',').filter(Boolean))].slice(0, 3)
  const selected = (library?.items ?? []).filter(item => selectedIds.includes(item.id))
  function toggleSelection(id: string) {
    const ids = selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id].slice(0, 3)
    setParams(ids.length ? { compare: ids.join(',') } : {}, { preventScrollReset: true })
  }
  useEffect(() => { active.current = true; void readScenarioLibrary().then(value => { if (active.current) setLibrary(value) }).catch(e => { if (active.current) setError(e.message) }); return () => { active.current = false } }, [])
  async function refresh() {
    setBusy(true); setError(''); setPending(null)
    try { setLibrary(await readScenarioLibrary()); setMessage('已读取本机最新方案。') } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function mutate(change: (items: DeploymentScenarioSnapshot[]) => DeploymentScenarioSnapshot[], success: string) {
    setBusy(true); setError('')
    try { setLibrary(await changeScenarioLibrary(library!.revision, change)); setMessage(success); setPending(null); dialog.current?.close(); setEditing(null) }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function importFile(value?: File) {
    if (!value) return
    setError(''); setPending(null)
    try {
      if (value.size > maxScenarioBytes) throw new Error('文件超过 1 MiB；未导入。')
      const items = parseScenarioImport(await value.text()); mergeScenarios(library!.items, items); setPending(items)
    } catch (e) { setError((e as Error).message) }
    finally { if (file.current) file.current.value = '' }
  }
  function edit(item: DeploymentScenarioSnapshot, mode: 'rename' | 'copy' | 'delete') {
    setError(''); setEditing({ item, mode }); setName(mode === 'copy' ? `${item.name.slice(0, 74)} · 副本` : item.name); dialog.current?.showModal()
  }
  function confirmEdit() {
    if (!editing) return
    const { item, mode } = editing
    try {
      const label = mode === 'delete' ? '' : scenarioName(name)
      void mutate(items => {
        if (mode === 'delete') return items.filter(s => s.id !== item.id)
        const next = { ...item, name: label, updatedAt: new Date().toISOString() }
        return mode === 'copy' ? [...items, { ...next, id: crypto.randomUUID(), createdAt: next.updatedAt }] : items.map(s => s.id === item.id ? next : s)
      }, mode === 'delete' ? '已删除此方案；其他方案不变。' : '方案已保存。')
    } catch (e) { setError((e as Error).message) }
  }
  let plan: ReturnType<typeof mergeScenarios> | null = null
  let importError = ''
  try { if (pending && library) plan = mergeScenarios(library.items, pending) }
  catch (e) { importError = (e as Error).message }
  return <div className="page-container py-8">
    <ModelSectionNav />
    <PageHeader eyebrow="LOCAL DEPLOYMENT WORKSPACE" title="部署方案库" description="保存一次配置，随时恢复与复核。方案仅在此浏览器，跨设备请导出 JSON。" />
    <div className="mb-6 flex flex-wrap gap-3">
      <Link to="/models" className="button-primary">选择模型创建方案</Link>
      <button className="button-secondary" onClick={refresh} disabled={busy}>刷新方案库</button>
      <button className="button-secondary" disabled={!library || busy} onClick={() => { try { download(library!.items) } catch (e) { setError((e as Error).message) } }}>导出全部</button>
      <button className="button-secondary" disabled={!library || busy} onClick={() => file.current?.click()}>导入 JSON</button>
      {siteFeatures.scenarioComparison && <button className="button-secondary" disabled={!selectedIds.length} onClick={() => setParams({}, { preventScrollReset: true })}>清空对比选择</button>}
      {siteFeatures.scenarioComparison && selected.length >= 2 && <button className="button-secondary" onClick={() => download(selected)}>导出所选方案</button>}
      <input ref={file} type="file" accept=".json,application/json" aria-label="导入方案文件" className="sr-only" onChange={e => void importFile(e.target.files?.[0])} />
    </div>
    {error && !editing && <p role="alert" className="mb-5 rounded-xl border border-amber-200/30 p-4 text-sm text-amber-200">{error}</p>}
    {message && <p role="status" className="mb-4 text-sm text-secondary">{message}</p>}
    {importError && <p role="alert" className="mb-4 text-sm text-amber-200">{importError}</p>}
    {!library && !error && <p role="status">正在读取本机方案…</p>}
    {siteFeatures.scenarioComparison && library && <>
      <p className="mb-4 text-sm text-secondary">选择 2–3 个方案对比 · 已选 {selected.length} 个{selectedIds.some(id => !library.items.some(s => s.id === id)) && '。链接中部分方案不在此浏览器，请导入 JSON 或清空选择。'}</p>
      <ScenarioComparison items={selected} />
    </>}
    {plan && <section aria-label="导入预览" className="surface-card mb-6 p-5"><h2 className="text-lg text-ink">确认导入</h2><p className="my-3 text-sm text-secondary">新增 {plan.added} 个，跳过完全相同的 {plan.skipped} 个；已有方案不覆盖。</p><ul className="mb-3 space-y-2 text-sm text-secondary">{pending!.map(s => <li key={s.id}>{s.name} · {s.modelId}{!inspectScenario(s, calculatorVersion).state && ' · 当前不可恢复，仅保留导出'}</li>)}</ul><button disabled={busy} className="button-primary" onClick={() => void mutate(items => mergeScenarios(items, pending!).items, '导入完成。')}>确认导入</button><button className="button-secondary ml-3" onClick={() => setPending(null)}>取消导入</button></section>}
    {library && <><p className="mb-4 text-xs text-muted">{library.items.length} / 50 个方案 · 仅计算逻辑容量，不保证实际部署可行。请定期导出备份。</p>
      {!library.items.length && <section className="surface-card p-8 text-secondary">还没有方案。在任一通用模型页面点击“保存方案”即可开始。</section>}
      <div className="grid gap-4 lg:grid-cols-2">{library.items.map(item => {
        const info = inspectScenario(item, calculatorVersion)
        return <article key={item.id} aria-label={`方案 ${item.name}`} className="surface-card min-w-0 p-5 [overflow-wrap:anywhere]">
          <h2 className="text-lg text-ink">{item.name}</h2><p className="mt-2 text-sm text-secondary">{info.model?.name ?? item.modelId}</p>
          {siteFeatures.scenarioComparison && <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-secondary"><input type="checkbox" aria-label={`对比 ${item.name}`} checked={selectedIds.includes(item.id)} disabled={!selectedIds.includes(item.id) && selectedIds.length >= 3} onChange={() => toggleSelection(item.id)} />加入对比</label>}
          {info.state && <p className="mt-3 text-sm text-secondary">TP {info.state.scenario.tp} · EP {info.state.ep ?? 1} · PP {info.state.pp ?? 1} · Attention DP {info.state.attentionDp ?? 1} · 副本 {info.state.replicas ?? 1}</p>}
          {info.changed && <p className="mt-3 text-xs text-amber-200">计算定义已更新；恢复后按当前版本重算，原始参数保留。</p>}
          {info.reasons.map(reason => <p key={reason} className="mt-3 text-xs text-amber-200">{reason}</p>)}
          <div className="mt-4 flex flex-wrap gap-2">
            {info.state && <Link className="button-primary" to={`/models/${item.modelId}?${item.params}`}>恢复配置</Link>}
            <button className="button-secondary" disabled={busy} onClick={() => edit(item, 'rename')}>重命名</button><button className="button-secondary" disabled={busy} onClick={() => edit(item, 'copy')}>复制方案</button><button className="button-secondary" onClick={() => download([item])}>导出</button><button className="button-secondary" disabled={busy} onClick={() => edit(item, 'delete')}>删除</button>
          </div><details className="mt-4 text-xs leading-6 text-muted"><summary className="cursor-pointer">参数与版本</summary><p>更新：{new Date(item.updatedAt).toLocaleString('zh-CN')}</p><p>保存时指纹：{item.calculatorFingerprint}</p><p className="break-all">{item.params}</p></details>
        </article>
      })}</div>
    </>}
    <dialog ref={dialog} onClose={() => setEditing(null)} aria-labelledby="edit-scenario-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-6 text-ink backdrop:bg-black/70">
      <h2 id="edit-scenario-title" className="text-xl">{editing?.mode === 'delete' ? '删除方案' : editing?.mode === 'copy' ? '复制方案' : '重命名方案'}</h2>
      <form className="mt-4" onSubmit={e => { e.preventDefault(); if (!busy) confirmEdit() }}>
        {editing?.mode === 'delete' ? <p className="text-sm text-secondary">删除「{editing.item.name}」？建议先导出；其他方案不会受影响。</p> : <label className="text-sm">方案名称<input autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-field px-3" /></label>}
        {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
        <div className="mt-5 flex gap-3"><button disabled={busy} className="button-primary">{editing?.mode === 'delete' ? '确认删除' : '确认保存'}</button><button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>取消</button></div>
      </form>
    </dialog>
  </div>
}
