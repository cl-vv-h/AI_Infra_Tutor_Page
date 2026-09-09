import type { ModelArchitecture } from '../types/model.ts'
import type { InferenceScenario } from './model-lab.ts'
import { cacheEstimate } from './model-lab.ts'
import { compareEstimate } from './model-comparison.ts'

export const defaultCacheBudgetGiB = 8
export const gibibyte = 1024 ** 3

export function parseCacheBudget(raw: string): number | null {
  if (!/^\d{1,4}(?:\.\d{1,3})?$/.test(raw)) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 && value <= 1024 ? value : null
}

/** Equal-length requests, no shared prefix; bytes are already reserved for cache/state only. */
export function planCacheCapacity(model: ModelArchitecture, scenario: InferenceScenario, budgetBytes: number) {
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 0 || budgetBytes > 1024 * gibibyte) throw new Error('Invalid cache budget')
  const { estimate, reasons } = compareEstimate(model, scenario)
  if (!estimate) throw new Error(reasons.join(' '))
  const perRequestBytes = cacheEstimate(model, { ...scenario, batch: 1 }).perRankBytes
  const maximumBatch = Math.floor(budgetBytes / perRequestBytes)
  // Cache grows monotonically with S, including piecewise sliding/hybrid layouts.
  // Search only the existing explorer range, rather than inventing context extension.
  let low = 1024
  let high = model.execution.maxContext
  let maximumSequence: number | null = null
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (cacheEstimate(model, { ...scenario, sequence: mid }).perRankBytes <= budgetBytes) {
      maximumSequence = mid
      low = mid + 1
    } else high = mid - 1
  }
  return { budgetBytes, perRequestBytes, maximumBatch,
    applicableBatch: Math.min(64, maximumBatch), maximumSequence,
    contextLimited: maximumSequence === model.execution.maxContext,
    currentBytes: estimate.perRankBytes, fits: estimate.perRankBytes <= budgetBytes,
    remainingBytes: Math.max(0, budgetBytes - estimate.perRankBytes), deficitBytes: Math.max(0, estimate.perRankBytes - budgetBytes) }
}
