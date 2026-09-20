import type { ModelArchitecture } from '../types/model.ts'
import { decoderWeightBudget } from './model-weights.ts'
import checkpoint from '../data/kimi-checkpoint-audit.json' with { type: 'json' }

/** File inventory is native checkpoint storage, never a runtime allocation estimate. */
export const kimiCheckpoint = checkpoint

/** Bridge the illustrated runtime-element scenario to independently audited native bytes. */
export function kimiWeightAudit(model: ModelArchitecture) {
  if (model.id !== 'kimi-k3') throw new Error('Kimi audit requires the K3 configuration')
  const budget = decoderWeightBudget(model, 0, 1, 4)
  const expert = model.execution.expertParallel!
  const routedElements = (model.dimensions.layers - model.execution.denseLayers) * expert.experts * 3 * expert.hiddenSize * model.execution.expertIntermediateSize!
  if (budget.allLayersGlobal === null || budget.allLayersBytes === null) throw new Error('Incomplete Kimi Decoder inventory')
  const otherElements = budget.allLayersGlobal - routedElements
  const scaleBytes = routedElements / 32
  const bf16RestorationBytes = otherElements * 1.5
  const referenceScenarioBytes = budget.allLayersBytes + scaleBytes + bf16RestorationBytes
  const fp32RestorationBytes = checkpoint.templates.filter(t => t.dtype === 'F32' && t.name.startsWith('language_model.model.layers.')).reduce((sum, t) => sum + t.bytes / 2, 0)
  // Runtime narrows A_log from 128 checkpoint elements to 96 heads in each KDA layer.
  const aLog = checkpoint.templates.find(t => t.name.endsWith('.self_attn.A_log'))!
  const checkpointOnlyElementsBytes = (aLog.shape[0] - model.dimensions.attentionHeads) * aLog.count * 2
  const outsideDecoderBytes = checkpoint.payloadBytes - checkpoint.decoderBytes
  if (referenceScenarioBytes + fp32RestorationBytes + checkpointOnlyElementsBytes !== checkpoint.decoderBytes) throw new Error('Kimi native Decoder reconciliation failed')
  return { elements: budget.allLayersGlobal, routedElements, otherElements, uniform4Bytes: budget.allLayersBytes,
    scaleBytes, bf16RestorationBytes, referenceScenarioBytes, fp32RestorationBytes, checkpointOnlyElementsBytes, outsideDecoderBytes }
}
export const decimalTB = (bytes: number) => `${(bytes / 1e12).toFixed(3)} TB`
