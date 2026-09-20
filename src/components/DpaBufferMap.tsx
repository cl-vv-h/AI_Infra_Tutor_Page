import type { dpaLayout } from '@/lib/dpa-lab'

const styles = {
  tokens: { label: '有效 token', className: 'bg-cyan-300', paint: {} },
  alignment: { label: 'Attention TP 对齐补齐', className: 'bg-violet-300', paint: { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #0b141e55 4px, #0b141e55 6px)' } },
  maximum: { label: 'MAX_LEN 额外补齐', className: 'bg-amber-200', paint: { backgroundImage: 'radial-gradient(#0b141e99 1px, transparent 1px)', backgroundSize: '5px 5px' } },
}
const number = (n: number) => n.toLocaleString('en-US')
const interval = (start: number, rows: number) => `[${number(start)}, ${number(start + rows)})`

export default function DpaBufferMap({ data, onSelectGroup }: {
  data: ReturnType<typeof dpaLayout>
  onSelectGroup: (dpRank: number) => void
}) {
  return <section aria-label="DPA 缓冲区分段图" className="mt-5 rounded-xl border border-white/15 p-4">
    <h3 className="font-semibold">从各组 token 到 FFN 缓冲区</h3>
    <p className="mt-2 text-sm leading-6 text-white/65">横条按行数比例拼接；区间左闭右开。点击组卡查看对应 rank，不改变请求负载。每行宽度 {data.model.dimensions.hiddenSize}，不是把隐层维按 DP 拼接。</p>
    <ul className="mt-3 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-white/70">
      {Object.entries(styles).map(([key, style]) => <li key={key} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-5 rounded-sm ${style.className}`} style={style.paint} />{style.label}</li>)}
    </ul>
    <div aria-hidden="true" className="mt-4 flex h-9 overflow-hidden rounded-md bg-white/5">
      {data.bufferSegments.map((segment) => <span key={`${segment.dpRank}-${segment.kind}`} className={`${styles[segment.kind].className} ${segment.dpRank === data.selected.dpRank ? 'brightness-110' : 'opacity-60'}`} style={{ ...styles[segment.kind].paint, width: `${segment.rows / data.bufferRows * 100}%` }} />)}
    </div>
    <p className="mt-2 text-xs leading-5 text-white/60">{data.bufferRows > 0 ? `缓冲范围 ${interval(0, data.bufferRows)}；每卡 ${number(data.bufferRows)} 行，返回当前组仅取 ${interval(data.selected.group.offset, data.selected.group.tokens)} 的有效数据。` : '空缓冲：所有组都没有有效 token，也没有补齐行。'}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.groups.map((group) => <button key={group.dpRank} type="button" aria-label={`查看 DPA 缓冲组 ${group.dpRank}`} aria-pressed={group.dpRank === data.selected.dpRank} onClick={() => onSelectGroup(group.dpRank)} className={`min-w-0 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${group.dpRank === data.selected.dpRank ? 'border-cyan-200 bg-cyan-200/10' : 'border-white/15 bg-white/[0.02]'}`}>
        <span className="block text-sm text-cyan-100">DPA {group.dpRank} · R{group.peers.join('/R')}</span>
        <span className="mt-2 block break-words font-mono text-xs text-white/80">{interval(group.offset, group.padded)}</span>
        <span className="mt-2 block text-xs leading-6 text-white/65">有效 {number(group.tokens)} · 对齐补齐 {number(group.aligned - group.tokens)} · MAX 补齐 {number(group.padded - group.aligned)}</span>
        <span className="mt-1 block break-words text-xs leading-5 text-white/60">{group.tokens > 0 ? `有效返回 ${interval(group.offset, group.tokens)}` : group.padded > 0 ? '无有效返回；这一组仅含补齐槽。' : '空区间；不占缓冲行。'}</span>
      </button>)}
    </div>
    <p className="mt-3 text-xs leading-6 text-white/55">颜色与纹理只表示行的来源；补齐不是新请求，不加入历史 KV，也不代表真实专家命中。大序列按比例显示，不创建逐 token 的 DOM 元素。</p>
  </section>
}
