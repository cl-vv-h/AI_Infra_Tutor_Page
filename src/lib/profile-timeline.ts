import type { ProfileEvent } from './profile-analysis.ts'
import { mergeRanges } from './profile-diagnostics.ts'
export function profileTimeline(records:ProfileEvent[],origin:number){
  const timed=records.filter(e=>e.start!==undefined)
  let start=Infinity,end=-Infinity
  for(const e of timed){start=Math.min(start,e.start!);end=Math.max(end,e.start!+e.duration)}
  if(!timed.length)return {start:0,end:0,missing:records.length,lanes:[]}
  const streams=new Map<string,ProfileEvent[]>()
  for(const e of timed){if(!streams.has(e.stream))streams.set(e.stream,[]);streams.get(e.stream)!.push(e)}
  const lanes=[...streams].map(([stream,events])=>{
    const execution=mergeRanges(events.filter(e=>!e.role||e.role==='execution').map(e=>({start:e.start!-origin,end:e.start!+e.duration-origin})))
    const waiting=mergeRanges(events.filter(e=>e.role==='wait').map(e=>({start:e.start!-origin,end:e.start!+e.duration-origin})))
    // O(records), not O(streams × 64): retain merged ranges and bin only the
    // currently visible streams in the UI. No streams or late tasks are dropped.
    return {stream,count:events.length,execution,waiting}
  }).sort((a,b)=>a.stream.localeCompare(b.stream,undefined,{numeric:true}))
  return {start:start-origin,end:end-origin,missing:records.length-timed.length,lanes}
}

export function timelineBins(timeline:{start:number;end:number},lane:{execution:{start:number;end:number}[];waiting:{start:number;end:number}[]}){
  const width=(timeline.end-timeline.start)/64
  const fraction=(rs:typeof lane.execution,lo:number,hi:number)=>rs.reduce((s,r)=>s+Math.max(0,Math.min(hi,r.end)-Math.max(lo,r.start)),0)/(hi-lo)
  return Array.from({length:64},(_,i)=>{
    const lo=timeline.start+i*width,hi=i===63?timeline.end:lo+width
    return {execution:Math.min(1,fraction(lane.execution,lo,hi)),wait:Math.min(1,fraction(lane.waiting,lo,hi))}
  })
}
