import { useRef } from 'react'
import { explorerViewForKey, explorerViews } from '@/lib/model-explorer'
import type { ExplorerView } from '@/lib/model-explorer'

export default function ModelWorkspaceTabs({ view, onSelect }: { view: ExplorerView; onSelect: (view: ExplorerView) => void }) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  return <div role="tablist" aria-label="模型工作区" className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0b1119] p-2">
    {explorerViews.map((item, index) => <button key={item.id} ref={(element) => { tabs.current[index] = element }}
      type="button" role="tab" id={`workspace-tab-${item.id}`} aria-controls={`workspace-panel-${item.id}`}
      aria-selected={view === item.id} tabIndex={view === item.id ? 0 : -1}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        const next = explorerViewForKey(item.id, event.key)
        if (next === null) return
        event.preventDefault()
        tabs.current[explorerViews.findIndex((item) => item.id === next)]?.focus()
        onSelect(next)
      }}
      className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${view === item.id ? 'bg-cyan-200 text-[#071014]' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
      {item.label}
    </button>)}
  </div>
}
