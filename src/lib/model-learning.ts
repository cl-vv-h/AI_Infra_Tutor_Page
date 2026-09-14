import type { ArchitectureNode, ModelArchitecture } from '../types/model.ts'
import { attentionKind, decoderNodes, layerCacheNode } from './model-lab.ts'

export interface LearningStop { node: ArchitectureNode; question: string; context: string }

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
    question: '文本与视觉何时汇合？为什么要在汇合后才把单路 embedding 展开为四路？',
    context: `全局入口：视觉占位替换后展开四路。到当前 Layer ${layer} 之前还需经过 ${layer} 个 Decoder 层。`,
  } : ({
    node,
    question: node.id.startsWith('hc-') ? '四路主干怎样变成单路子层输入，再恢复为四路？哪一路绕过了子层计算？' : node.tone === 'memory' ? '历史信息保存在哪里？S 增长会改变哪些维度？' : node.id.endsWith('-add') ? '参与相加的各路张量来自哪里？为什么 Shape 必须相同？' : node.id.endsWith('moe') ? '路由选择了什么？激活的专家与驻留的专家有什么区别？' : node.id === 'lm-head' ? '何时才进入词表投影？logits 是否已经是采样出的 token？' : node.id === 'embedding' ? '离散 token 如何变成主干向量？Prefill 与 Decode 的 N 有何不同？' : '输入如何变成输出？哪些中间维度或权重随 TP 改变？',
    context: node.tone === 'memory' ? '状态支路：回看刚才 Attention 的历史读写，不是一个额外串行 Decoder 层。' : node.id === 'embedding' ? `全局入口；进入当前 Layer ${layer} 前还有 ${layer} 个 Decoder 层。` : node.id === 'vision' ? '可选视觉入口：和文本 embedding 汇合，不是在文本 embedding 后串行计算。' : node.id === 'lm-head' ? `全局出口；当前层之后还有 ${model.dimensions.layers - layer - 1} 个 Decoder 层。不是每层都执行 LM Head。` : model.execution.residualLayout === 'parallel' ? '当前层采用同源并行残差；此处按学习顺序逐个观察，不表示 Attention → MLP 的依赖。' : `当前 Layer ${layer} 内部；模块详情与结构图采用同一份定义。`,
  }))
}

export function adjacentLearningStop(stops: LearningStop[], selectedId: string, direction: -1 | 1) {
  const index = stops.findIndex(({ node }) => node.id === selectedId)
  if (index < 0) return stops[0] ?? null
  return stops[index + direction] ?? null
}
