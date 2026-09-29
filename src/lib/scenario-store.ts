import { emptyScenarioLibrary, validateLibrary } from './deployment-scenarios.ts'
import type { DeploymentScenarioSnapshot, ScenarioLibrary } from './deployment-scenarios.ts'

export const scenarioDatabase = 'ai-infra-deployment-scenarios-v1'
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (error: string) => { if (!done) { done = true; clearTimeout(timer); reject(new Error(error)) } }
    const timer = setTimeout(() => finish('打开方案库超时；请关闭占用的旧标签页后重试。'), 5000)
    try {
      const request = indexedDB.open(scenarioDatabase, 1)
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('library')) request.result.createObjectStore('library') }
      request.onblocked = () => finish('方案库被其他标签页占用；请关闭旧页面后重试。')
      request.onerror = () => finish('无法打开本机方案库；请检查浏览器存储权限。')
      request.onsuccess = () => {
        if (done) { request.result.close(); return }
        done = true; clearTimeout(timer)
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    } catch { finish('浏览器不允许访问 IndexedDB；未保存任何方案。') }
  })
}
async function transaction(expected?: number, change?: (items: DeploymentScenarioSnapshot[]) => DeploymentScenarioSnapshot[]): Promise<ScenarioLibrary> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    let result: ScenarioLibrary, cause = ''
    const tx = db.transaction('library', change ? 'readwrite' : 'readonly')
    const timer = setTimeout(() => { cause = '方案库操作超时，未确认保存；请刷新核对。'; try { tx.abort() } catch { /* transaction already completed */ } }, 10000)
    const finish = () => { clearTimeout(timer); db.close() }
    tx.oncomplete = () => { finish(); resolve(result) }
    tx.onabort = () => { finish(); reject(new Error(cause || '本机保存失败或空间不足；原方案未改动。')) }
    tx.onerror = () => { /* abort handler owns rejection */ }
    const store = tx.objectStore('library'), request = store.get('state')
    request.onsuccess = () => {
      try {
        result = request.result === undefined ? emptyScenarioLibrary() : validateLibrary(request.result)
        if (change) {
          if (result.revision !== expected) throw new Error('方案库已被其他标签页修改；请刷新方案库后重试，未覆盖他人的修改。')
          result = validateLibrary({ version: 1, revision: result.revision + 1, items: change(result.items) })
          store.put(result, 'state')
        }
      } catch (error) { cause = error instanceof Error ? error.message : '方案数据无效'; tx.abort() }
    }
  })
}
export const readScenarioLibrary = () => transaction()
export const changeScenarioLibrary = (expectedRevision: number, change: (items: DeploymentScenarioSnapshot[]) => DeploymentScenarioSnapshot[]) => transaction(expectedRevision, change)
