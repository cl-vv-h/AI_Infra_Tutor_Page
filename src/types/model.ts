export type InferencePhase = 'prefill' | 'decode'
export type TensorParallelSize = 1 | 2 | 4 | 8

export interface ModelMetric {
  label: string
  value: string
}

export interface ModelWeight {
  name: string
  shape: string
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
  supportedTp: TensorParallelSize[]
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
