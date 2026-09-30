import { buildHotspots, heatScore } from './news-hotspots.mjs'
import type { Hotspot, HotspotCorpus } from './news-hotspots.mjs'

export const SPHERE_VERSION = 'news-sphere/1'
export const windows = [1, 6, 24, 72, 168] as const
export type RadarQuery = { category: string; hours: number; q: string; topic: string; sort: string; selected: string }
export function readRadarQuery(params: URLSearchParams): RadarQuery {
  return {
    category: ['ai', 'technology', 'finance', 'world'].includes(params.get('category') || '') ? params.get('category')! : '',
    hours: windows.includes(Number(params.get('hours')) as typeof windows[number]) ? Number(params.get('hours')) : 72,
    q: (params.get('q') || '').slice(0, 160), topic: (params.get('topic') || '').slice(0, 80),
    sort: ['latest', 'mine'].includes(params.get('sort') || '') ? params.get('sort')! : 'heat',
    selected: (params.get('selected') || '').slice(0, 80),
  }
}

// Reuse the existing stable clustering and activity definition. Short windows are
// clipped after grouping, so changing a window cannot invent a different topic ID.
export function radarWindow(groups: Hotspot[], asOf: string, hours: number): Hotspot[] {
  if (!windows.includes(hours as typeof windows[number])) throw new Error('Unsupported radar window')
  const end = Date.parse(asOf)
  return groups.flatMap(group => {
    const reports = group.reports.filter(r => Date.parse(r.publishedAt) <= end && Date.parse(r.publishedAt) > end - hours * 3600000)
    return reports.length ? [{ ...group, reports, ...heatScore(reports, asOf), latestAt: reports[0].publishedAt }] : []
  }).sort((a, b) => b.score - a.score || b.latestAt.localeCompare(a.latestAt) || a.id.localeCompare(b.id))
}
export function radarCatalog(corpus: HotspotCorpus) { return buildHotspots(corpus, 168) }
export function filterRadar(items: Hotspot[], query: RadarQuery, followed: string[]) {
  const q = query.q.trim().toLocaleLowerCase()
  return items.filter(item => (!query.category || item.category === query.category) && (!query.topic || item.id === query.topic)
    && (query.sort !== 'mine' || followed.includes(item.id))
    && (!q || `${item.title} ${item.reports.map(r => `${r.title} ${r.source} ${r.country}`).join(' ')}`.toLocaleLowerCase().includes(q)))
    .sort((a, b) => query.sort === 'latest' ? b.latestAt.localeCompare(a.latestAt) || b.score - a.score : b.score - a.score || b.latestAt.localeCompare(a.latestAt))
}

export type Vec3 = { x: number; y: number; z: number }
function seed(id: string) { let n = 2166136261; for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296 }
// Fibonacci surface sampling with deterministic small thickness, never fake nodes.
export function spherePosition(index: number, count: number, id: string): Vec3 {
  const y = 1 - 2 * (index + .5) / Math.max(1, count), theta = index * Math.PI * (3 - Math.sqrt(5))
  const noise = seed(id), radius = noise < .8 ? 1 : .92 + noise * .16
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  return { x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius }
}
export function rotatePoint(p: Vec3, yaw: number, pitch: number): Vec3 {
  const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw), z = p.z * Math.cos(yaw) - p.x * Math.sin(yaw)
  return { x, y: p.y * Math.cos(pitch) - z * Math.sin(pitch), z: p.y * Math.sin(pitch) + z * Math.cos(pitch) }
}
export function pointRadius(score: number) { return 1.3 + Math.min(4.5, Math.sqrt(Math.max(0, score)) * .5) }
export function relatedSignals(item: Hotspot, all: Hotspot[]) {
  // A transparent reading relation, not a claim that separate stories are one event.
  return all.filter(row => row.id !== item.id && row.category === item.category).slice(0, 6)
}
