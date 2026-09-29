import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ExplorerState } from '@/lib/model-explorer'
import { createScenario } from '@/lib/deployment-scenarios'
import { readScenarioLibrary, changeScenarioLibrary } from '@/lib/scenario-store'
import { calculatorVersion } from '@/lib/site-release'

export default function ScenarioSave({ modelId, modelName, state }: { modelId: string; modelName: string; state: ExplorerState }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(''), [revision, setRevision] = useState<number | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false)
  async function open() {
    setName(`${modelName} · TP${state.scenario.tp}`); setError(''); setSaved(false); setRevision(null)
    dialog.current?.showModal()
    try { setRevision((await readScenarioLibrary()).revision) } catch (e) { setError((e as Error).message) }
  }
  async function save() {
    setBusy(true); setError('')
    try {
      const snapshot = createScenario(modelId, state, name, calculatorVersion)
      await changeScenarioLibrary(revision!, items => [...items, snapshot])
      setSaved(true); dialog.current?.close()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <>
    <button className="button-secondary" onClick={open}>保存方案</button>
    {saved && <span role="status" className="text-sm text-secondary">已保存到本机。<Link to="/models/scenarios" className="text-accent">打开方案库 →</Link></span>}
    <dialog ref={dialog} aria-labelledby="save-scenario-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-6 text-ink backdrop:bg-black/70">
      <h2 id="save-scenario-title" className="text-xl">保存当前方案</h2>
      <p className="my-4 text-sm leading-6 text-muted">仅存于此浏览器；包含当前模型、并行与逐权重精度，不上传服务器。</p>
      <form onSubmit={e => { e.preventDefault(); if (revision !== null && !busy) void save() }}>
        <label className="block text-sm">方案名称<input autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line bg-field px-3" /></label>
        {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
        {revision === null && !error && <p role="status">正在打开本机方案库…</p>}
        <div className="mt-5 flex flex-wrap gap-3"><button className="button-primary" disabled={revision === null || busy}>保存到本机</button><button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>取消</button></div>
      </form>
    </dialog>
  </>
}
