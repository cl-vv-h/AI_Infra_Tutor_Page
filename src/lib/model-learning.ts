import type { ArchitectureNode, ModelArchitecture } from '../types/model.ts'
import { attentionKind, decoderNodes, layerCacheNode } from './model-lab.ts'

export interface LearningStop { node: ArchitectureNode; focus: string; context: string }

/** Reading order, deliberately not an execution DAG: cache is an attention side branch. */
export function learningStops(model: ModelArchitecture, layer: number): LearningStop[] {
  const block = decoderNodes(model, layer)
  const nodes: ArchitectureNode[] = []
  const embedding = model.nodes.find((node) => node.id === 'embedding')!
  const vision = model.nodes.find((node) => node.id === 'vision')
  nodes.push(embedding)
  if (vision) nodes.push(vision)
  const expand = model.nodes.find((node) => node.id === 'hc-expand')
  if (expand) nodes.push(expand)
  for (const node of block) {
    nodes.push(node)
    if (node.id === attentionKind(model, layer)) nodes.push(layerCacheNode(model, layer))
  }
  nodes.push(model.nodes.find((node) => node.id === 'lm-head')!)
  return nodes.map((node) => node.id === 'hc-expand' ? {
    node,
    focus: '多模态汇合与四路残差展开',
    context: `全局入口：视觉占位替换后展开四路。到当前 Layer ${layer} 之前还需经过 ${layer} 个 Decoder 层。`,
  } : ({
    node,
    focus: node.id.includes('-res-') ? '跨层残差聚合、已保存快照与块内累加' : node.id.startsWith('hc-') ? '四路残差流的投影与写回' : node.tone === 'memory' ? '历史状态与上下文维度' : node.id.endsWith('-add') ? '同形状残差汇合' : node.id.endsWith('moe') ? '专家路由与常驻权重' : node.id === 'lm-head' ? '词表投影与 logits' : node.id === 'embedding' ? 'Token 映射与输入张量' : '张量变换与 TP 分片',
    context: node.tone === 'memory' ? '状态支路：回看刚才 Attention 的历史读写，不是一个额外串行 Decoder 层。' : node.id === 'embedding' ? `全局入口；进入当前 Layer ${layer} 前还有 ${layer} 个 Decoder 层。` : node.id === 'vision' ? '可选视觉入口：和文本 embedding 汇合，不是在文本 embedding 后串行计算。' : node.id === 'lm-head' ? `全局出口；当前层之后还有 ${model.dimensions.layers - layer - 1} 个 Decoder 层。不是每层都执行 LM Head。` : model.execution.residualLayout === 'parallel' ? '当前层采用同源并行残差；此处按学习顺序逐个观察，不表示 Attention → MLP 的依赖。' : `当前 Layer ${layer} 内部；模块详情与结构图采用同一份定义。`,
  }))
}

export function adjacentLearningStop(stops: LearningStop[], selectedId: string, direction: -1 | 1) {
  const index = stops.findIndex(({ node }) => node.id === selectedId)
  if (index < 0) return stops[0] ?? null
  return stops[index + direction] ?? null
}
