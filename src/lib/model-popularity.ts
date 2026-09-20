import { modelPopularity, popularityObservedOn } from '../data/model-popularity.ts'
import type { ModelPopularity } from '../data/model-popularity.ts'

export const catalogSorts = ['downloads', 'name', 'catalog'] as const
export type CatalogSort = typeof catalogSorts[number]
export const catalogSortLabels: Record<CatalogSort, string> = { downloads: '近月下载 ↓', name: '名称 A–Z', catalog: '原目录顺序' }
type NamedModel = { id: string; name: string }

/** Missing/invalid measurements sort last, never masquerade as zero downloads. */
export function popularityFor(id: string, snapshot: Readonly<Record<string, ModelPopularity>> = modelPopularity) {
  const value = Object.prototype.hasOwnProperty.call(snapshot, id) ? snapshot[id] : undefined
  return value && Number.isSafeInteger(value.downloads) && value.downloads >= 0 && /^\w[\w.-]*\/\w[\w.-]*$/.test(value.repo) ? value : null
}
export function sortCatalog<T extends NamedModel>(models: readonly T[], sort: CatalogSort = 'downloads', snapshot: Readonly<Record<string, ModelPopularity>> = modelPopularity): T[] {
  const result = [...models]
  if (sort === 'catalog') return result
  return result.sort((a, b) => {
    if (sort === 'downloads') {
      const av = popularityFor(a.id, snapshot), bv = popularityFor(b.id, snapshot)
      if (!!av !== !!bv) return av ? -1 : 1
      if (av && bv && av.downloads !== bv.downloads) return bv.downloads - av.downloads
    }
    return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id, 'en')
  })
}
export function popularityIsStale(now = new Date()) {
  // The observation date is Asia/Shanghai's calendar date, matching the review.
  const age = now.getTime() - Date.parse(`${popularityObservedOn}T00:00:00+08:00`)
  return !Number.isFinite(age) || age >= 30 * 86400000
}
