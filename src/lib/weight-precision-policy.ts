import type { ModelArchitecture, TensorParallelSize } from '../types/model.ts'
import { decoderNodes } from './model-lab.ts'
import { formatWeight } from './model-weights.ts'
import { effectiveWeightPrecision, hasRoutedOverrides, matrixPrecisions, mixedWeightRole, mixedWeightStorage, precisionKey, precisionWeightParts } from './mixed-precision.ts'
import type { ExpertPrecision, MixedPrecision } from './mixed-precision.ts'

const inventories = new Map<string, ReturnType<typeof buildInventory>>()
function buildInventory(model: ModelArchitecture, tp: TensorParallelSize, ep: TensorParallelSize, attentionTp: TensorParallelSize) {
  return Array.from({ length: model.dimensions.layers }, (_, layer) => decoderNodes(model, layer).flatMap(node => node.weights.flatMap(weight => {
    const localTp = ['gqa', 'mla'].includes(node.id) ? attentionTp : tp
    const formatted = formatWeight(weight, model, { phase: 'decode', batch: 1, sequence: 1024, tp: localTp, cacheBytes: 2 }, ['gqa', 'mla'].includes(node.id) ? 1 : ep)
    return precisionWeightParts(formatted).map(part => {
      const options = matrixPrecisions.filter(format => {
        try { mixedWeightStorage(part, node.id, { mlp: 'bf16', shared: 'bf16', experts: 'bf16', weights: { [precisionKey(node.id, part.name)]: format } }, layer); return true } catch { return false }
      })
      return { layer, nodeId: node.id, nodeTitle: node.title, weight: part, role: mixedWeightRole(part, node.id), key: precisionKey(node.id, part.name), options }
    })
  }))).flat()
}
export function precisionInventory(model: ModelArchitecture, tp: TensorParallelSize, ep: TensorParallelSize = 1, attentionTp: TensorParallelSize = tp) {
  const key = `${model.id}/${tp}/${ep}/${attentionTp}`
  if (!inventories.has(key)) inventories.set(key, buildInventory(model, tp, ep, attentionTp))
  return inventories.get(key)!
}

/** Bounded public URL schema. Accept only real logical weights in this model. */
export function readWeightOverrides(params: URLSearchParams, model: ModelArchitecture, tp: TensorParallelSize, ep: TensorParallelSize, policy: MixedPrecision, notices: string[], attentionTp: TensorParallelSize = tp): MixedPrecision {
  if (!params.has('pw')) return policy
  if (params.get('pm') !== model.id) { notices.push('逐权重配置属于其他模型，已清除覆盖；模块默认值保留。'); return policy }
  const raw = params.get('pw')!
  let entries: unknown
  try { if (raw.length > 24000) throw new Error(); entries = JSON.parse(raw) } catch { notices.push('逐权重配置无效或过长，已清除覆盖。'); return policy }
  if (!Array.isArray(entries) || entries.length > 256 || entries.some(e => !Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || typeof e[1] !== 'string')) { notices.push('逐权重配置格式无效，已清除覆盖。'); return policy }
  const inventory = precisionInventory(model, tp, ep, attentionTp)
  const targets = new Map<string, typeof inventory>()
  for (const item of inventory) for (const key of [item.key, precisionKey(item.nodeId, item.weight.name, item.layer)]) targets.set(key, [...(targets.get(key) ?? []), item])
  const weights: Record<string, ExpertPrecision> = {}
  const seen = new Set<string>()
  let rejected = 0
  for (const [key, format] of entries as [string, ExpertPrecision][]) {
    const matches = targets.get(key)
    if (seen.has(key) || !matches?.every(item => item.options.includes(format as typeof matrixPrecisions[number]))) { rejected++; continue }
    seen.add(key); weights[key] = format
  }
  if (rejected) notices.push(`${rejected} 项逐权重配置不存在、重复或不满足当前分片对齐，已忽略。`)
  if (!Object.keys(weights).length) return policy
  const result = { ...policy, modelId: model.id, weights }
  if (hasRoutedOverrides(result) && result.w4Stage) { delete result.w4Stage; notices.push('专家逐权重覆盖使用拆分存储账本，已取消融合 W4A8 后处理阶段。') }
  return result
}
export function writeWeightOverrides(params: URLSearchParams, policy: MixedPrecision) {
  if (!policy.weights || !Object.keys(policy.weights).length) return
  params.set('pm', policy.modelId ?? '')
  params.set('pw', JSON.stringify(Object.entries(policy.weights).sort(([a], [b]) => a.localeCompare(b))))
}
export function precisionRows(model: ModelArchitecture, tp: TensorParallelSize, ep: TensorParallelSize, policy: MixedPrecision, layer: number, scope: 'all' | 'layer', attentionTp: TensorParallelSize = tp) {
  const inventory = precisionInventory(model, tp, ep, attentionTp)
  const rows = scope === 'layer' ? inventory.filter(item => item.layer === layer) : [...new Map(inventory.map(item => [item.key, item])).values()]
  return rows.map(item => {
    const key = precisionKey(item.nodeId, item.weight.name, scope === 'all' ? 'all' : layer)
    const peers = scope === 'all' ? inventory.filter(peer => peer.key === item.key) : [item]
    const options = item.options.filter(format => peers.every(peer => peer.options.includes(format)))
    return { ...item, key, options, effective: effectiveWeightPrecision(item.weight, item.nodeId, policy, scope === 'layer' ? layer : undefined) }
  })
}
