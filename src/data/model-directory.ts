import { modelArchitectures } from './models.ts'
import type { ModelArchitecture } from '../types/model.ts'
import { v41Reference, v41Source, v41Weights } from '../lib/deepseek-v41-reference.ts'

/** Discovery metadata is separate from backend-specific graph definitions. */
export interface V41DirectoryEntry extends Pick<ModelArchitecture, 'id' | 'name' | 'organization' | 'family' | 'description' | 'parameters' | 'activeParameters' | 'accent' | 'configUrl' | 'supportedTp' | 'dimensions'> {
  referenceKind: 'v41'
  execution: { maxContext: number; denseLayers: number }
  searchTerms: string[]
}
export type ModelDirectoryEntry = ModelArchitecture | V41DirectoryEntry
export function isV41Entry(model: ModelDirectoryEntry): model is V41DirectoryEntry { return 'referenceKind' in model && model.referenceKind === 'v41' }
export const v41DirectoryEntry: V41DirectoryEntry = {
  referenceKind: 'v41', id: 'deepseek-v4-1-flash', name: 'DeepSeek-V4.1-Flash', organization: 'DeepSeek',
  family: 'CSA2 · Single-Pass mHC · Engram · MoE',
  description: '沿 40 层因果 Encoder–Decoder 追踪四个全局 KV owner，区分重算索引与复用；探索完整专家 EP、Engram 行表与参考混合量化。官方参考实现，不代表 SGLang 后端已验证。',
  parameters: '552B 主干 + 约196B Engram', activeParameters: '8B Prefill / 16B Decode（CED 优化口径）', accent: '#c7a8ff',
  configUrl: v41Source('config.json'), supportedTp: [1, 2, 4, 8],
  execution: { maxContext: v41Reference.maxContext, denseLayers: 0 },
  dimensions: { hiddenSize: v41Reference.hidden, vocabSize: v41Reference.vocab, layers: v41Reference.layers, attentionHeads: v41Reference.heads, kvHeads: 1, headDim: v41Reference.headDim, intermediateSize: v41Reference.intermediate },
  searchTerms: ['CSA2', 'Single-Pass mHC', 'Engram', 'Reindex', 'Reuse', 'KV owner', '跨层缓存共享', 'DSpark', ...new Set([0, 1, 2, 14, 20, 24].flatMap((layer) => v41Weights(layer, 1).map((weight) => weight.name)))],
}
export const modelDirectory: ModelDirectoryEntry[] = [...modelArchitectures, v41DirectoryEntry]
