import { useMemo, useState } from 'react'
import { kimiNativeLayout, nativeRoles } from '@/lib/kimi-native-layout'
import { formatBytes } from '@/lib/model-lab'
import { kimiNativePostload } from '@/lib/kimi-native-postload'
import type { KimiNativeStage } from '@/lib/kimi-native-postload'
import KimiPostloadDetails from './KimiPostloadDetails'

const source = 'https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/'
const shape = (axes: number[]) => `[${axes.join(', ')}]`
const exact = (bytes: number) => `${bytes.toLocaleString('en-US')} B`

export default function KimiNativeLayout({ tp, ep, replicas, rank, stage = 'initial', onStage }: { tp: number; ep: number; replicas: number; rank: number; stage?: KimiNativeStage; onStage?: (stage: KimiNativeStage) => void }) {
  const data = useMemo(() => kimiNativeLayout(tp, ep, replicas, rank), [tp, ep, replicas, rank])
  const post = useMemo(() => kimiNativePostload(tp, ep, replicas, rank), [tp, ep, replicas, rank])
  const processed = stage === 'processed'
  const total = processed ? post.trackedBytes : data.bytes
  const totalLabel = processed ? '已核对持久张量' : '全模型初始参数'
  const [role, setRole] = useState('experts')
  return <details aria-label="Kimi 原生加载基线" className="mt-3 rounded-xl border border-cyan-200/20 p-3 text-sm text-white/70">
    <summary className="cursor-pointer text-cyan-100">按当前配置查看原生加载基线 · Rank {rank} · {formatBytes(total)}{processed ? ' · 后处理已核对小计' : ''}</summary>
    <p className="mt-3 leading-6">CUDA SM100 / FlashInfer MXFP4 · {processed ? '后处理已核对持久张量' : '初始参数分配（后处理前）'}。默认 BF16、PP=1、A2A=none、无 DPA/EPLB/冗余专家。沿用下方 TP/EP/独立 DP/rank 控件；不采用自定义 MLP/W4A8 精度，因为这里核对的是官方 MXFP4 checkpoint。不是最终常驻显存。</p>
    <label className="mt-3 block">原生权重阶段<select aria-label="Kimi 原生权重阶段" value={stage} onChange={event => onStage?.(event.target.value as KimiNativeStage)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-[#101820] p-2 text-white"><option value="initial">初始参数（后处理前）</option><option value="processed">后处理 · 已核对持久张量</option></select></label>
    <p className="mt-2 leading-6">Rank {rank}：DP 副本 {data.replica}，TP rank {data.tpRank}，EP rank {data.epRank}，MoE-TP rank {data.moeTpRank}。本地专家 [{data.expertRange.join(', ')})，每专家 intermediate={data.intermediate}。共享 MLP 按完整 TP={tp} 分片，视觉塔完整复制。</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{[
      [`${totalLabel} / rank`, total], [`${totalLabel} / TP 组`, total * tp], [`${totalLabel} / 全部副本`, total * tp * replicas],
    ].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-lg bg-black/20 p-3"><p className="text-xs">{label}</p><p className="mt-2 font-mono text-cyan-100">{formatBytes(value as number)}</p><p className="mt-1 break-words font-mono text-xs">{exact(value as number)}</p></div>)}</div>
    {processed ? <KimiPostloadDetails data={post} /> : <>
    <p className="mt-3 text-xs leading-5">checkpoint 映射到本 rank 的参数：{exact(data.parametersBytes)}；额外零 bias：{exact(data.addedBiasBytes)}。文件 header 不进参数账本。独立 DP 只复制，不减小每卡参数；EP 改变专家数与 MoE-TP 轴，不再对同一份 payload 重复除 EP。</p>
    <details className="mt-3"><summary className="cursor-pointer">全模型模块小计</summary><dl className="mt-3 space-y-2">{data.groups.map(group => <div key={group.role} className="rounded-lg bg-black/15 p-2 sm:flex sm:justify-between sm:gap-3"><dt>{group.label}</dt><dd className="shrink-0 font-mono text-xs">{exact(group.bytes)}</dd></div>)}<div className="rounded-lg bg-black/15 p-2 sm:flex sm:justify-between sm:gap-3"><dt>额外零 bias（92 层）</dt><dd className="shrink-0 font-mono text-xs">{exact(data.addedBiasBytes)}</dd></div></dl></details>
    <label className="mt-4 block">选择原生权重模块<select aria-label="原生权重模块" value={role} onChange={event => setRole(event.target.value)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-[#101820] p-2 text-white">{Object.entries(nativeRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <p className="mt-2 text-xs leading-5">逐行显示 checkpoint 源张量映射到本 rank 的分片与份数；QKV 等融合投影可能合并这些行，不把源张量形状当作最终 kernel 布局。专家的六个实际初始容器另列在下方。</p>
    <div className="mt-3 space-y-2">{data.rows.filter(row => row.role === role).map(row => <details key={row.name + row.shape.join(',')} className="min-w-0 rounded-lg bg-black/15 p-2"><summary className="cursor-pointer break-all text-xs">{row.name.replace('language_model.model.', '')} · {formatBytes(row.bytes)}</summary>
      <p className="mt-2 break-words font-mono text-xs">文件 {shape(row.checkpointShape)} · {row.checkpointDtype} → 本 rank {shape(row.shape)} · {row.dtype}</p>
      <p className="mt-2 text-xs">共 {row.copies.toLocaleString('en-US')} 份；{exact(row.bytes)}。{row.range && `axis ${row.axis} 本地分片对应原生存储区间 [${row.range.join(', ')})。`}</p><p className="mt-2 text-xs leading-5">{row.note}</p>
    </details>)}</div>
    {role === 'experts' && <details className="mt-3" aria-label="MXFP4 初始融合分配"><summary className="cursor-pointer">w1/w3 融合后的真实初始容器与额外 bias</summary><p className="mt-2 text-xs leading-5">以下是每层的六个分配。前四项已经计入专家小计，不重复添加；后两项为 CUDA create_weights 创建的 BF16 零 bias，即使原模型无 bias 也会分配。当前尺寸满足 128 对齐，无额外 padding。</p><ul className="mt-3 space-y-2">{data.expertBuffers.map(buffer => <li className="break-words rounded-lg bg-black/15 p-2 font-mono text-xs" key={buffer.name}>{buffer.name} {shape(buffer.shape)} · {buffer.dtype}<br />{exact(buffer.bytes)} / 层 × {buffer.copies} 层{buffer.kind === 'zero' ? ' · 额外分配' : ' · 已计入'}</li>)}</ul></details>}
    <p className="mt-3 text-xs leading-5 text-amber-100/85">阶段边界：FlashInfer 后处理会把 bias 转为 FP32、创建激活参数并重排 packed/scale；模型还会准备 MLA 副本、AttnRes 派生权重与后端缓冲区。以上均未计入这个“初始参数”数字，也不含 KV、激活、allocator、转换峰值。其他后端的 padding/布局不能套用此表。</p>
    </>}
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-cyan-100"><a href={`${source}srt/models/kimi_k3.py`} target="_blank" rel="noreferrer">固定 Kimi loader ↗</a><a href={`${source}srt/layers/quantization/mxfp4.py`} target="_blank" rel="noreferrer">MXFP4 create_weights / 后处理 ↗</a><a href={`${source}srt/models/deepseek_v2.py`} target="_blank" rel="noreferrer">Router 权重与计算 dtype ↗</a></div>
  </details>
}
