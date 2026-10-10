import { buildHotspots } from './news-hotspots.mjs'

// One reader belongs to one immutable, validated collection snapshot. Recreate
// it when replacing that snapshot; never share it across datasets or persistence.
export function createHotspotWindowReader(corpus, build = buildHotspots, enabled = true) {
  const windows = new Map()
  return (hours = 72) => {
    if (![24, 72, 168, 720].includes(hours)) throw new RangeError('Unsupported hotspot window')
    if (!enabled) return build(corpus, hours)
    if (!windows.has(hours)) windows.set(hours, build(corpus, hours))
    return windows.get(hours)
  }
}
