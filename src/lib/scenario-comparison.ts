import { inspectScenario } from './deployment-scenarios.ts'
import type { DeploymentScenarioSnapshot } from './deployment-scenarios.ts'
import { deploymentWeightBudget } from './weight-deployment.ts'
import { planCacheCapacity, defaultCacheBudgetGiB, gibibyte } from './cache-capacity.ts'

export function estimateScenario(snapshot: DeploymentScenarioSnapshot, fingerprint: string) {
  const inspected = inspectScenario(snapshot, fingerprint), { model, state } = inspected
  let weights: ReturnType<typeof deploymentWeightBudget> | null = null
  let cache: ReturnType<typeof planCacheCapacity> | null = null
  let weightReason = '', cacheReason = ''
  if (model && state) {
    try {
      weights = deploymentWeightBudget(model, state.layer, state.weightBits ?? 16, {
        tp: state.scenario.tp, ep: state.ep ?? 1, pp: state.pp ?? 1, stage: state.ppStage ?? 0,
        attentionDp: state.attentionDp ?? 1, replicas: state.replicas ?? 1,
      }, state.mixed)
    } catch { weightReason = '当前逻辑权重组合无法计算，不使用默认精度替代。' }
    if ((state.pp ?? 1) !== 1 || (state.attentionDp ?? 1) !== 1) cacheReason = '不支持此组合估算：缓存未覆盖 PP / Attention DP。'
    else try { cache = planCacheCapacity(model, state.scenario, Math.round((state.cacheBudgetGiB ?? defaultCacheBudgetGiB) * gibibyte)) }
    catch { cacheReason = '当前缓存配置超出已验证范围。' }
  }
  return { snapshot, ...inspected, weights, cache, weightReason, cacheReason }
}

export function scenarioDifferenceRows(estimates: ReturnType<typeof estimateScenario>[]) {
  const fields = [
    ['模型', (e: typeof estimates[number]) => e.model?.name ?? e.snapshot.modelId],
    ['TP / EP / PP / Attention DP / 副本', (e: typeof estimates[number]) => e.state ? `${e.state.scenario.tp} / ${e.state.ep ?? 1} / ${e.state.pp ?? 1} / ${e.state.attentionDp ?? 1} / ${e.state.replicas ?? 1}` : '不可恢复'],
    ['阶段 / B（每副本） / S / KV 字节', (e: typeof estimates[number]) => e.state ? `${e.state.scenario.phase} / ${e.state.scenario.batch} / ${e.state.scenario.sequence} / ${e.state.scenario.cacheBytes} B` : '不可恢复'],
    ['Layer / PP stage / rank', (e: typeof estimates[number]) => e.state ? `${e.state.layer} / ${e.state.ppStage ?? 0} / ${e.state.rank ?? 0}` : '不可恢复'],
    ['权重精度（含逐项覆盖）', (e: typeof estimates[number]) => e.state ? e.state.mixed ? JSON.stringify(e.state.mixed) : `${e.state.weightBits ?? 16}-bit 统一理论载荷` : '不可恢复'],
    ['缓存专用预算', (e: typeof estimates[number]) => e.state ? `${e.state.cacheBudgetGiB ?? defaultCacheBudgetGiB} GiB / rank` : '不可恢复'],
    ['独立专家打包 / 原生加载参考', (e: typeof estimates[number]) => e.state ? `${e.state.expertFormat ?? 'bf16'} / ${e.state.nativeStage ?? 'initial'}（不并入逻辑账本）` : '不可恢复'],
    ['查看模块 / 工作区', (e: typeof estimates[number]) => e.state ? `${e.state.nodeId} / ${e.state.view ?? 'diagram'}` : '不可恢复'],
  ] as const
  return fields.map(([label, value]) => { const values = estimates.map(value); return { label, values, different: new Set(values).size > 1 } })
}
