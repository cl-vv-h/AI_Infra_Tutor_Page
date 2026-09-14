export type InferencePhase = 'prefill' | 'decode'
export type TensorParallelSize = 1 | 2 | 4 | 8

export interface KdaMlaCache {
  kind: 'kda-mla'
  layerTypes: Array<'kda' | 'mla'>
  heads: number
  headDim: number
  convSlots: number
  convBytes: number
  stateBytes: number
  latentWidth: number
  indexWidth: number
  indexPool: number
  indexTopk: number
  tailSlots: number
  tailBytes: number
}

export interface ModelMetric {
  label: string
  value: string
}

export interface ModelWeight {
  name: string
  shape: string
  /** Number of equally shaped tensors represented by this row (not inferred from labels). */
  multiplicity?: number
  note?: string
}

export interface ModelKnowledgeLink {
  label: string
  to: string
}

export interface ArchitectureNode {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  description: string
  inputShape: string
  outputShape: string
  weights: ModelWeight[]
  knowledge: ModelKnowledgeLink[]
  tone: 'input' | 'attention' | 'ffn' | 'memory' | 'output'
  layerRange?: string
  weightlessNote?: string
  phaseNotes?: Record<InferencePhase, string>
  tensors?: Array<{ label: string; shape: string; note?: string }>
}

export interface ModelArchitecture {
  id: string
  name: string
  organization: string
  family: string
  description: string
  parameters: string
  activeParameters: string
  accent: string
  configUrl: string
  configLabel: string
  implementationUrl?: string
  supportedTp: TensorParallelSize[]
  execution: {
    maxContext: number
    contextNote?: string
    denseLayers: number
    hashLayers?: number
    normKind?: 'rmsnorm' | 'layernorm'
    residualLayout?: 'parallel' | 'mhc'
    residualStreams?: number
    outputGroups?: number
    normLayout?: 'pre-post' | 'post-branch-qk'
    cache: KdaMlaCache | { kind: 'compressed'; window: number; ratios: Array<0 | 4 | 128>; kvWidth: number; indexWidth: number; indexTopk: number; stateBytes: number } | { kind: 'gqa'; layout?: 'replicated' } | { kind: 'swa'; window: number } | { kind: 'mixed'; window: number; layerTypes: Array<'sliding_attention' | 'full_attention'> } | { kind: 'mla'; latentWidth: number; ropeWidth: number; /** Replicated index K allocation at every layer, using the selected logical precision. */ indexWidth?: number } | {
      kind: 'hybrid'
      layerTypes: Array<'linear_attention' | 'full_attention'>
      keyHeads: number
      valueHeads: number
      keyDim: number
      valueDim: number
      convKernel: number
      convStateSlots: number
      convBytes: number
      recurrentBytes: number
    }
    expertIntermediateSize?: number
  }
  metrics: ModelMetric[]
  dimensions: {
    hiddenSize: number
    vocabSize: number
    layers: number
    attentionHeads: number
    kvHeads: number
    headDim: number
    intermediateSize: number
  }
  nodes: ArchitectureNode[]
}
