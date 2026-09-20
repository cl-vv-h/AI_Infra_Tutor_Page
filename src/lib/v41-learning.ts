import { v41Cache, v41Layer, v41RankFlow, v41Weights, v41WeightStorage } from './deepseek-v41-reference.ts'
import type { V41Scenario } from './deepseek-v41-reference.ts'

/** Navigation changes only the teaching focus; numerical experiment conditions stay intact. */
export const v41Lessons = [
  { title: '输入与四路主干', view: 'diagram', layer: 0, target: 'v41-boundaries', flow: 'attention' },
  { title: '区分所有者与读取者', view: 'diagram', layer: 24, target: 'v41-sources', flow: 'attention' },
  { title: '跟踪 Single-Pass mHC', view: 'diagram', layer: 20, target: 'v41-layer-flow', flow: 'attention' },
  { title: '本地 heads 与归约', view: 'weights', layer: 20, target: 'v41-rank-flow', flow: 'attention' },
  { title: '完整专家，不是专家 TP', view: 'weights', layer: 20, target: 'v41-rank-flow', flow: 'moe' },
  { title: 'Engram 行表与尾卡', view: 'weights', layer: 14, target: 'v41-rank-flow', flow: 'engram' },
  { title: '缓存只数真正的 owner', view: 'cache', layer: 24, target: 'v41-cache', flow: 'attention' },
  { title: '权重格式与常驻载荷', view: 'weights', layer: 14, target: 'v41-weights', flow: 'engram' },
] as const

export function selectV41Lesson(state: V41Scenario, index: number): V41Scenario {
  if (!Number.isInteger(index) || index < 0 || index >= v41Lessons.length) throw new Error('Invalid V4.1 lesson')
  const step = v41Lessons[index]
  return { ...state, lesson: index, layer: step.layer, view: step.view, flow: step.flow }
}

export function v41LessonContent(state: V41Scenario) {
  const index = state.lesson ?? 0
  if (!Number.isInteger(index) || index < 0 || index >= v41Lessons.length) throw new Error('Invalid V4.1 lesson')
  const layer = v41Layer(state.layer), rank = v41RankFlow(state)
  const cache = v41Cache(state.batch, state.sequence, state.storage)
  const bits = state.weightMode === 'native' ? undefined : Number(state.weightMode) as 4 | 8 | 16 | 32
  const weights = v41Weights(state.layer, state.world)
  const bytes = weights.reduce((sum, weight) => sum + v41WeightStorage(weight, bits).bytes, 0)
  const n = (value: number) => value.toLocaleString('en-US')
  const source = (value: number | null) => value === null ? '不使用' : `Layer ${value}`
  const contents = [
    { question: '当前阶段有多少个 query token？四路 residual 是否意味着执行四份 Attention？', answer: `N=${n(rank.tokens)}，来自 ${state.phase === 'prefill' ? 'B×S 的完整 Prefill' : 'B 个 Decode query'}。主干 [${rank.tokens},4,5120] 合并为子层输入 [${rank.tokens},5120]；四路是残差流，不是四次 Attention。历史 S=${n(state.sequence)} 不应直接当作 Decode query 数。` },
    { question: `Layer ${state.layer} 的主 KV、Index K 与 Top-k 位置表来自同一层吗？`, answer: `主 KV：${source(layer.kvSource)}；Index K：${source(layer.indexKeySource)}；Top-k：${source(layer.topKSource)}。当前 ${layer.mode} 模式，${layer.ownsKv ? '本层拥有全局 KV' : '本层不新增全局 KV owner'}。重新计算索引 query 不等于新增一份历史 K；SWA 仍每层独立。` },
    { question: `Layer ${state.layer} 的 Attention 应该用刚算出的 attn_pre，还是前一个子层的 pre？`, answer: `Attention 使用 ${layer.attentionPreFrom}；当前 FFN 使用 ${layer.ffnPreFrom}。新生成的 pre 留给下一个子层，而 post/comb 用于当前子层写回四路。第 39 层的 FFN pre 最后用于合并主干，不另加 V4 式动态 hc_head。` },
    { question: `Rank ${state.rank} 负责哪些 Q heads？输出 Shape 相同是否表示归约前后数据也相同？`, answer: `本地 heads ${rank.headStart}–${rank.headEnd}，Q [${rank.tokens},${64 / state.world},512]。wo_b 本地输出与归约结果均为 [${rank.tokens},5120]，前者仅是本卡贡献；只在副本 ${rank.replica} 的 [${rank.peers.join(', ')}] 内合并，不跨独立 DP 副本相加。` },
    { question: 'world 增大后，单专家中间维会变小吗？Top-6 是否意味着只保存六个专家？', answer: `参考实现给本卡完整专家 ${rank.expertStart}–${rank.expertEnd}，中间维仍是 2304；本地专家数为 ${384 / state.world}。Top-6 是激活选择，不减少常驻权重；实际输入 [T_e,5120]，不能用平均负载替代未知 T_e。shared 每卡复制，routed 合并后才加 shared。` },
    { question: `当前 Layer ${state.layer} 的 Engram 表如何分片？尾部补齐行是否能成为合法 hash ID？`, answer: rank.engramRows ? `本卡合法全局行 ${n(rank.engramRows.start)}–${n(rank.engramRows.end)}；分配 ${n(rank.engramRows.allocated)} 行，其中 ${rank.engramRows.padding} 行 padding。补齐仍占权重空间，却不是合法 ID；非本卡查表贡献要屏蔽，再在副本内归约。` : '当前层没有 Engram。只有 Layer 1/14 注入；点击“定位本步演示”回到 Layer 14，再比较首卡与尾卡。' },
    { question: '40 层是否要保存 40 份全局压缩 KV？切换 world 会把每卡缓存除小吗？', answer: `只有 Layer 2/8/14/20 四个全局 owner；各自记录数为 ${cache.owners.map((owner) => `${owner.layer}:${n(owner.records)}`).join('、')} / 请求。当前 ${state.storage === 'packed' ? '紧凑设计（含 scale）' : '参考 BF16 buffer'} 每 rank ${n(cache.total)} B，包含 40 层 SWA 与 3 个 C2 增量状态。缓存按 rank 复制，不除 world；两种存储口径不能混算。` },
    { question: '权重位宽变化会改变逻辑矩阵 Shape、专家数或当前激活 dtype 吗？', answer: `不会。Layer ${state.layer} 的 ${weights.length} 项图示权重在当前 rank 共 ${n(bytes)} B，采用 ${bits ? `统一 ${bits}-bit 理论载荷（不含 scale）` : '参考混合格式（含 scale）'}。位宽改变载荷，不改变逻辑 Shape，也不控制激活 dtype。这里没有计其他层、Embedding、LM Head、视觉或 DSpark，不能当作整模型显存。` },
  ]
  return { ...v41Lessons[index], ...contents[index] }
}
