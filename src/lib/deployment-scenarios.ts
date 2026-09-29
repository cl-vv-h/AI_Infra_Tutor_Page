import { modelArchitectures } from '../data/models.ts'
import { explorerParams, parseExplorer } from './model-explorer.ts'
import type { ExplorerState } from './model-explorer.ts'

export const maxScenarioBytes = 1024 * 1024
export const maxScenarios = 50
export interface DeploymentScenarioSnapshot {
  version: 1
  id: string
  name: string
  modelId: string
  params: string
  createdAt: string
  updatedAt: string
  calculatorFingerprint: string
}
export interface ScenarioLibrary { version: 1; revision: number; items: DeploymentScenarioSnapshot[] }
export const emptyScenarioLibrary = (): ScenarioLibrary => ({ version: 1, revision: 0, items: [] })
const fail = (message: string): never => { throw new Error(message) }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && ![...v].some(char => {
  const code = char.charCodeAt(0)
  return code < 32 || code === 127 || code >= 0x202a && code <= 0x202e || code >= 0x2066 && code <= 0x2069
})
export function scenarioName(value: string) {
  const name = value.trim()
  if (!text(name, 80)) fail('方案名称须为 1–80 个字符，不能包含控制字符。')
  return name
}
export function validateSnapshot(value: unknown): DeploymentScenarioSnapshot {
  if (!object(value) || Object.keys(value).sort().join() !== 'calculatorFingerprint,createdAt,id,modelId,name,params,updatedAt,version' || value.version !== 1) return fail('不支持的方案格式；原数据未修改。')
  if (!text(value.id, 80) || !/^[\w-]+$/.test(value.id) || !text(value.modelId, 100) || !/^[a-z0-9-]+$/.test(value.modelId) || !text(value.params, 100000) || !text(value.calculatorFingerprint, 100) || !/^[\w-]+$/.test(value.calculatorFingerprint)) return fail('方案字段无效或过长；整批未导入。')
  if (typeof value.name !== 'string' || scenarioName(value.name) !== value.name) return fail('方案名称无效。')
  for (const date of [value.createdAt, value.updatedAt]) if (typeof date !== 'string' || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) return fail('方案时间格式无效。')
  if (String(value.createdAt) > String(value.updatedAt)) return fail('方案更新时间早于创建时间。')
  return { version: 1, id: value.id, name: value.name, modelId: value.modelId, params: value.params, createdAt: String(value.createdAt), updatedAt: String(value.updatedAt), calculatorFingerprint: value.calculatorFingerprint }
}
function validateItems(value: unknown): DeploymentScenarioSnapshot[] {
  if (!Array.isArray(value) || value.length > maxScenarios) return fail('最多保存 50 个方案；请先导出备份再整理。')
  const items = value.map(validateSnapshot)
  if (new Set(items.map(s => s.id)).size !== items.length) return fail('文件中存在重复方案 ID；整批未导入。')
  if (new TextEncoder().encode(JSON.stringify({ version: 1, items })).length > maxScenarioBytes) return fail('方案数据超过 1 MiB；原数据未修改。')
  return items
}
export function validateLibrary(value: unknown): ScenarioLibrary {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return fail('本机方案库格式不受支持；为保护数据，禁止覆盖。')
  return { version: 1, revision: Number(value.revision), items: validateItems(value.items) }
}
export function parseScenarioImport(raw: string) {
  if (new TextEncoder().encode(raw).length > maxScenarioBytes) return fail('文件超过 1 MiB；整批未导入。')
  let value: unknown
  try { value = JSON.parse(raw.replace(/^\uFEFF/, '')) } catch { return fail('无法解析 JSON；请选择本站导出的方案文件。') }
  if (!object(value) || value.version !== 1 || Object.keys(value).sort().join() !== 'items,version') return fail('不支持的导入版本或格式。')
  return validateItems(value.items)
}
export function exportScenarios(items: DeploymentScenarioSnapshot[]) {
  const result = JSON.stringify({ version: 1, items: validateItems(items) }, null, 2)
  if (new TextEncoder().encode(result).length > maxScenarioBytes) return JSON.stringify({ version: 1, items })
  return result
}
const queryKeys = new Set('layer,node,phase,b,s,tp,bytes,ep,replicas,rank,wbits,budget,view,packing,precision,mlp,shared,experts,w4stage,pm,pw,native,pp,stage,adp'.split(','))
export function inspectScenario(snapshot: DeploymentScenarioSnapshot, fingerprint: string) {
  const model = modelArchitectures.find(m => m.id === snapshot.modelId)
  const changed = snapshot.calculatorFingerprint !== fingerprint
  if (!model) return { model: null, state: null, changed, reasons: ['该模型不在当前通用实验室中；保留原方案，仅可导出。'] }
  try {
    const params = new URLSearchParams(snapshot.params)
    const keys = [...params.keys()]
    if (keys.some(k => !queryKeys.has(k)) || new Set(keys).size !== keys.length) throw new Error('包含未知或重复参数')
    const { state, notices } = parseExplorer(params, model)
    // Detect ignored/inactive fields too: no silent precision or topology repair.
    const canonical = explorerParams(state); canonical.sort(); params.sort()
    if (notices.length || canonical.toString() !== params.toString()) return { model, state: null, changed, reasons: ['参数与当前规则不兼容，未自动修正；请保留导出文件。', ...notices] }
    return { model, state, changed, reasons: [] as string[] }
  } catch { return { model, state: null, changed, reasons: ['参数无法安全恢复，原方案保持不变。'] } }
}
export function createScenario(modelId: string, state: ExplorerState, name: string, fingerprint: string, id = crypto.randomUUID(), now = new Date().toISOString()) {
  const snapshot = validateSnapshot({ version: 1, id, name: scenarioName(name), modelId, params: explorerParams(state).toString(), createdAt: now, updatedAt: now, calculatorFingerprint: fingerprint })
  const inspected = inspectScenario(snapshot, fingerprint)
  if (!inspected.state) return fail(inspected.reasons.join(' '))
  return snapshot
}
export function mergeScenarios(current: DeploymentScenarioSnapshot[], incoming: DeploymentScenarioSnapshot[]) {
  const items = [...current]
  let skipped = 0
  for (const item of validateItems(incoming)) {
    const existing = items.find(s => s.id === item.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) return fail(`方案「${item.name}」的 ID 与本机不同内容冲突；整批未导入，不覆盖原方案。`)
    if (existing) skipped++; else items.push(item)
  }
  return { items: validateItems(items), added: items.length - current.length, skipped }
}
