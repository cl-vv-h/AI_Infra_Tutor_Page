import type { ProfileEvent } from './profile-analysis.ts'
import { mergeRanges } from './profile-diagnostics.ts'
export function profileTimeline(records:ProfileEvent[],origin:number){
  const timed=records.filter(e=>e.start!==undefined)
  let start=Infinity,end=-Infinity
  for(const e of timed){start=Math.min(start,e.start!);end=Math.max(end,e.start!+e.duration)}
  if(!timed.length)return {start:0,end:0,missing:records.length,lanes:[]}
  const width=(end-start)/64,streams=new Map<string,ProfileEvent[]>()
  for(const e of timed){if(!streams.has(e.stream))streams.set(e.stream,[]);streams.get(e.stream)!.push(e)}
  const lanes=[...streams].map(([stream,events])=>{
    const execution=mergeRanges(events.filter(e=>!e.role||e.role==='execution').map(e=>({start:e.start!,end:e.start!+e.duration})))
    const waiting=mergeRanges(events.filter(e=>e.role==='wait').map(e=>({start:e.start!,end:e.start!+e.duration})))
    const fraction=(rs:typeof execution,lo:number,hi:number)=>rs.reduce((s,r)=>s+Math.max(0,Math.min(hi,r.end)-Math.max(lo,r.start)),0)/(hi-lo)
    const bins=Array.from({length:64},(_,i)=>{
      const lo=start+i*width,hi=i===63?end:lo+width
      return {execution:Math.min(1,fraction(execution,lo,hi)),wait:Math.min(1,fraction(waiting,lo,hi))}
    })
    return {stream,count:events.length,bins}
  }).sort((a,b)=>a.stream.localeCompare(b.stream,undefined,{numeric:true}))
  return {start:start-origin,end:end-origin,missing:records.length-timed.length,lanes}
}
