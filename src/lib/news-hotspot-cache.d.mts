import type { Hotspot, HotspotCorpus } from './news-hotspots.mjs'
export function createHotspotWindowReader(corpus:HotspotCorpus,build?:(corpus:HotspotCorpus,hours:number)=>Hotspot[],enabled?:boolean):(hours?:number)=>Hotspot[]
