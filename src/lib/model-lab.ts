import type { ArchitectureNode, InferencePhase, ModelArchitecture, TensorParallelSize } from '../types/model'

export interface InferenceScenario {
  phase: InferencePhase
  batch: number
  sequence: number
  tp: TensorParallelSize
  cacheBytes: 1 | 2
}

export function localKvHeads(model: ModelArchitecture, tp: TensorParallelSize) {
  return Math.max(1, model.dimensions.kvHeads / tp)
}

/** Cache placement can differ from projection-weight sharding (e.g. gathered Q/K/V). */
export function cacheKvHeads(model: ModelArchitecture, tp: TensorParallelSize) {
  return model.execution.cache.kind === 'gqa' && model.execution.cache.layout === 'replicated'
    ? model.dimensions.kvHeads : localKvHeads(model, tp)
}

export function tokenCount(scenario: InferenceScenario) {
  return scenario.batch * (scenario.phase === 'prefill' ? scenario.sequence : 1)
}

/** Logical retained positions, including the current token, not allocation. */
export function cachedSequence(model: ModelArchitecture, sequence: number) {
  return model.execution.cache.kind === 'swa' ? Math.min(sequence, model.execution.cache.window) : sequence
}

export function windowSequence(model: ModelArchitecture, sequence: number) {
  const cache = model.execution.cache
  return cache.kind === 'swa' || cache.kind === 'mixed' ? Math.min(sequence, cache.window) : sequence
}

export function formatShape(template: string, model: ModelArchitecture, scenario: InferenceScenario) {
  const hybrid = model.execution.cache.kind === 'hybrid' ? model.execution.cache : null
  const values: Record<string, number> = {
    localHeads: model.dimensions.attentionHeads / scenario.tp,
    localKvHeads: localKvHeads(model, scenario.tp),
    cacheKvHeads: cacheKvHeads(model, scenario.tp),
    vocabShard: Math.ceil(model.dimensions.vocabSize / scenario.tp),
    intermediateShard: model.dimensions.intermediateSize / scenario.tp,
    expertShard: (model.execution.expertIntermediateSize ?? model.dimensions.intermediateSize) / scenario.tp,
    tp: scenario.tp, batch: scenario.batch, sequence: scenario.sequence, cachedSequence: cachedSequence(model, scenario.sequence), windowSequence: windowSequence(model, scenario.sequence),
    ...(hybrid ? {
      linearKeyHeads: hybrid.keyHeads / scenario.tp,
      linearValueHeads: hybrid.valueHeads / scenario.tp,
      linearQkv: (2 * hybrid.keyHeads * hybrid.keyDim + hybrid.valueHeads * hybrid.valueDim) / scenario.tp,
      linearValueWidth: hybrid.valueHeads * hybrid.valueDim / scenario.tp,
      convSlots: hybrid.convStateSlots,
    } : {}),
  }
  return template.replace(/\{(\w+)\}/g, (original, name) => values[name]?.toLocaleString('en-US') ?? original)
    .replace(/\bN\b/g, tokenCount(scenario).toLocaleString('en-US'))
    // Tensor-axis separators use commas; thousands separators would be ambiguous.
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, (value) => value.replace(/,/g, ''))
}

export function cacheEstimate(model: ModelArchitecture, scenario: InferenceScenario) {
  const cache = model.execution.cache
  const kvLayers = cache.kind === 'hybrid' ? cache.layerTypes.filter((type) => type === 'full_attention').length : model.dimensions.layers
  const recurrentLayers = cache.kind === 'hybrid' ? model.dimensions.layers - kvLayers : 0
  const slidingLayers = cache.kind === 'swa' ? kvLayers : cache.kind === 'mixed' ? cache.layerTypes.filter((type) => type === 'sliding_attention').length : 0
  const fullKvLayers = kvLayers - slidingLayers
  const valuesPerTokenPerLayer = cache.kind === 'mla'
    ? cache.latentWidth + cache.ropeWidth
    : 2 * cacheKvHeads(model, scenario.tp) * model.dimensions.headDim
  const bytesPerToken = valuesPerTokenPerLayer * kvLayers * scenario.cacheBytes
  const retainedTokens = cachedSequence(model, scenario.sequence)
  const slidingRetainedTokens = windowSequence(model, scenario.sequence)
  const bytesPerLayerToken = valuesPerTokenPerLayer * scenario.cacheBytes
  const fullKvBytes = scenario.batch * scenario.sequence * fullKvLayers * bytesPerLayerToken
  const slidingKvBytes = scenario.batch * slidingRetainedTokens * slidingLayers * bytesPerLayerToken
  const kvBytes = fullKvBytes + slidingKvBytes
  const growthBytesPerToken = (cache.kind === 'swa' || cache.kind === 'mixed') && scenario.sequence >= cache.window ? fullKvLayers * bytesPerLayerToken : bytesPerToken
  const recurrentBytes = cache.kind === 'hybrid' ? scenario.batch * recurrentLayers * cache.valueHeads / scenario.tp * cache.keyDim * cache.valueDim * cache.recurrentBytes : 0
  const convBytes = cache.kind === 'hybrid' ? scenario.batch * recurrentLayers * (2 * cache.keyHeads * cache.keyDim + cache.valueHeads * cache.valueDim) / scenario.tp * cache.convStateSlots * cache.convBytes : 0
  const perRankBytes = kvBytes + recurrentBytes + convBytes
  return { perRankBytes, allRankBytes: perRankBytes * scenario.tp, bytesPerToken, growthBytesPerToken, retainedTokens, valuesPerTokenPerLayer, kvBytes, recurrentBytes, convBytes, kvLayers, recurrentLayers, fullKvLayers, slidingLayers, fullKvBytes, slidingKvBytes, slidingRetainedTokens }
}

export function attentionKind(model: ModelArchitecture, layer: number) {
  const cache = model.execution.cache
  if (cache.kind === 'hybrid') return cache.layerTypes[layer] === 'linear_attention' ? 'gdn' : 'gqa'
  if (cache.kind === 'mixed') return cache.layerTypes[layer] === 'sliding_attention' ? 'swa' : 'gqa'
  if (cache.kind === 'gqa' && model.dimensions.attentionHeads === model.dimensions.kvHeads) return 'mha'
  return cache.kind
}

export function layerCacheNode(model: ModelArchitecture, layer: number) {
  const kind = attentionKind(model, layer)
  return model.nodes.find((node) => node.id === (kind === 'gdn' ? 'recurrent-state' : kind === 'swa' && model.execution.cache.kind === 'mixed' ? 'window-cache' : 'kv-cache'))!
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const exponent = Math.min(4, Math.max(0, Math.floor(Math.log2(Math.max(1, bytes)) / 10)))
  return `${(bytes / 1024 ** exponent).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${units[exponent]}`
}

// One actual decoder layer, not a serial chain of mutually exclusive FFN types.
export function decoderNodes(model: ModelArchitecture, layer: number): ArchitectureNode[] {
  const shape = `[N, ${model.dimensions.hiddenSize.toLocaleString('en-US')}]`
  const get = (id: string) => model.nodes.find((node) => node.id === id)!
  const residual = (id: string, source: string): ArchitectureNode => ({
    id, eyebrow: 'RESIDUAL', title: 'Residual Add', subtitle: source,
    description: `将${source}与子层输出逐元素相加。两路必须保持相同 Shape；TP 的行并行输出在相加前需要归约。`,
    inputShape: `${shape} + ${shape}`, outputShape: shape, weights: [],
    weightlessNote: '逐元素加法，没有可训练参数。',
    knowledge: [{ label: '残差与 Pre-Norm', to: '/category/model-architecture' }, { label: 'TP 通信', to: '/category/parallel-strategy' }], tone: 'output',
  })
  const ffn = layer < model.execution.denseLayers ? get('dense-ffn') ?? get('ffn') : get('moe')
  if (model.execution.normLayout === 'post-branch-qk') return [
    get('attention-projection'), get('qk-norm'), get(attentionKind(model, layer)), get('attention-post-norm'), residual('attention-add', 'Attention 子层输入'),
    ffn, get('ffn-post-norm'), residual('ffn-add', 'FFN 子层输入'),
  ]
  if (model.execution.normLayout === 'pre-post') return [
    get('attention-norm'), get(attentionKind(model, layer)), get('attention-post-norm'), residual('attention-add', 'Attention 子层输入'),
    get('ffn-norm'), ffn, get('ffn-post-norm'), residual('ffn-add', 'FFN 子层输入'),
  ]
  return [
    get('attention-norm'), get(attentionKind(model, layer)), residual('attention-add', 'Attention 子层输入'),
    get('ffn-norm') ?? {
      id: 'ffn-norm', eyebrow: 'PRE-NORM', title: 'Post-Attention RMSNorm', subtitle: 'FFN 前归一化',
      description: 'Attention 残差相加后，再做一次 RMSNorm，供 Dense FFN 或 MoE 使用。归一化前的向量保留用于第二次残差相加。',
      inputShape: shape, outputShape: shape,
      weights: [{ name: 'post_attention_layernorm.weight', shape: `[${model.dimensions.hiddenSize.toLocaleString('en-US')}]` }],
      knowledge: [{ label: 'Decoder 结构', to: '/category/model-architecture' }], tone: 'ffn',
    },
    ffn, residual('ffn-add', 'FFN 子层输入'),
  ]
}

export function decoderGroups(model: ModelArchitecture, layer: number) {
  const nodes = decoderNodes(model, layer)
  const split = nodes.findIndex((node) => node.id === 'attention-add') + 1
  return [nodes.slice(0, split), nodes.slice(split)]
}
