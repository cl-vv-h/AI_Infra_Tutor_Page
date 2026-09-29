/** Educational routing model, not an implementation of any production router. */
export const moeRoutingVersion = 'moe-routing/1'
export type MoeRoutingConfig = {
  tokens: number; experts: number; topK: number; ep: number; seed: number
  pattern: 'balanced' | 'random' | 'hotspot'
  policy: 'dropless' | 'drop' | 'pad'; capacityFactor: number
  combine: 'preserve' | 'renormalize'
}
export const defaultMoeConfig: MoeRoutingConfig = {tokens:24,experts:8,topK:2,ep:4,seed:7,pattern:'balanced',policy:'dropless',capacityFactor:1,combine:'preserve'}
export const moeConfigKeys = Object.keys(defaultMoeConfig) as (keyof MoeRoutingConfig)[]
export function validateMoeConfig(c: MoeRoutingConfig): void {
  for (const [key, max] of [['tokens',128],['experts',64],['topK',8],['ep',64],['seed',999999]] as const) {
    if (!Number.isInteger(c[key]) || c[key] < (key === 'seed' ? 0 : 1) || c[key] > max) throw new Error(`${key} 必须是 ${key === 'seed' ? 0 : 1}–${max} 的整数。`)
  }
  if (c.topK > c.experts) throw new Error('Top-K 不能超过专家数。')
  if (c.experts % c.ep !== 0) throw new Error('本沙盘采用均匀专家放置：专家数必须能被 EP 整除。')
  if (!Number.isFinite(c.capacityFactor) || c.capacityFactor < .25 || c.capacityFactor > 4) throw new Error('容量系数必须在 0.25–4 之间。')
  if (!['balanced','random','hotspot'].includes(c.pattern) || !['dropless','drop','pad'].includes(c.policy) || !['preserve','renormalize'].includes(c.combine)) throw new Error('未知的路由、容量或归并策略。')
}
export function readMoeQuery(search: string): MoeRoutingConfig {
  const q = new URLSearchParams(search)
  if (q.has('v') && q.get('v') !== '1') throw new Error('不支持此沙盘参数版本，请重置参数。')
  for (const key of q.keys()) if (!['v',...moeConfigKeys].includes(key) || q.getAll(key).length !== 1) throw new Error('链接包含未知或重复参数，请检查或重置参数。')
  const c = {...defaultMoeConfig}
  for (const key of moeConfigKeys) {
    const value = q.get(key)
    if (value === null) continue
    if (typeof c[key] === 'number') {
      if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) throw new Error(`${key} 不是有效数字。`)
      Object.assign(c,{[key]:Number(value)})
    } else Object.assign(c,{[key]:value})
  }
  validateMoeConfig(c)
  return c
}
export function writeMoeQuery(c: MoeRoutingConfig): string {
  validateMoeConfig(c)
  return new URLSearchParams([['v','1'],...moeConfigKeys.map(k=>[k,String(c[k])])]).toString()
}
export type MoeAssignment = {token:number;source:number;expert:number;rank:number;order:number;score:number;weight:number;accepted:boolean;combineWeight:number;output:[number,number]}
export function toyExpert(token:number, expert:number): [number,number] {
  // Two-dimensional affine toy function; deliberately not a learned FFN.
  const x = (token+1)/10
  return [x*(expert+1),x+expert/10]
}
export function simulateMoe(c: MoeRoutingConfig) {
  validateMoeConfig(c)
  let state = c.seed >>> 0
  const random = () => {state = (Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
  const capacity = c.policy === 'dropless' ? null : Math.ceil(c.tokens*c.topK/c.experts*c.capacityFactor)
  const routes: MoeAssignment[] = []
  for (let token=0;token<c.tokens;token++) {
    const scores = Array.from({length:c.experts},(_,expert)=>({expert,score:c.pattern === 'balanced'
      ? c.experts-((expert-token*c.topK)%c.experts+c.experts)%c.experts
      : random()*2+(c.pattern==='hotspot'&&expert<c.topK?5:0)}))
    const selected = scores.sort((a,b)=>b.score-a.score||a.expert-b.expert).slice(0,c.topK)
    const exp = selected.map(s=>Math.exp(s.score-selected[0].score)),sum = exp.reduce((a,b)=>a+b,0)
    selected.forEach((s,order)=>routes.push({token,source:Math.floor(token*c.ep/c.tokens),expert:s.expert,rank:Math.floor(s.expert/(c.experts/c.ep)),order,score:s.score,weight:exp[order]/sum,accepted:true,combineWeight:0,output:toyExpert(token,s.expert)}))
  }
  const experts = Array.from({length:c.experts},(_,expert)=>{
    const items = routes.filter(r=>r.expert===expert).sort((a,b)=>b.weight-a.weight||a.token-b.token||a.order-b.order)
    items.forEach((r,i)=>{r.accepted=capacity===null||i<capacity})
    const accepted = items.filter(r=>r.accepted).length
    return {expert,rank:Math.floor(expert/(c.experts/c.ep)),requested:items.length,accepted,dropped:items.length-accepted,padding:c.policy==='pad'?capacity!-accepted:0}
  })
  const tokens = Array.from({length:c.tokens},(_,token)=>{
    const assignments = routes.filter(r=>r.token===token)
    const retainedWeight = assignments.reduce((s,r)=>s+(r.accepted?r.weight:0),0)
    assignments.forEach(r=>{r.combineWeight=r.accepted?r.weight/(c.combine==='renormalize'&&retainedWeight>0?retainedWeight:1):0})
    const output: [number,number] = [0,0]
    assignments.forEach(r=>{output[0]+=r.output[0]*r.combineWeight;output[1]+=r.output[1]*r.combineWeight})
    return {token,source:Math.floor(token*c.ep/c.tokens),assignments,retainedWeight,output}
  })
  // Expert-major packed buffer; identity survives dispatch and inverse permutation.
  const dispatch = routes.filter(r=>r.accepted).sort((a,b)=>a.rank-b.rank||a.expert-b.expert||a.token-b.token)
  const remote = dispatch.filter(r=>r.source!==r.rank)
  const remoteTokenRanks = new Set(remote.map(r=>`${r.token}:${r.rank}`)).size
  const ranks = Array.from({length:c.ep},(_,rank)=>{
    const owned = experts.filter(e=>e.rank===rank)
    return {rank,requested:owned.reduce((n,e)=>n+e.requested,0),accepted:owned.reduce((n,e)=>n+e.accepted,0),padding:owned.reduce((n,e)=>n+e.padding,0),sent:remote.filter(r=>r.source===rank).length,received:remote.filter(r=>r.rank===rank).length}
  })
  return {config:c,capacity,routes,tokens,experts,ranks,dispatch,remoteAssignments:remote.length,remoteTokenRanks,localAssignments:dispatch.length-remote.length,dropped:routes.length-dispatch.length,emptyTokens:tokens.filter(t=>t.retainedWeight===0).length,
    imbalance:Math.max(...experts.map(e=>e.requested))/(routes.length/c.experts),rankImbalance:Math.max(...ranks.map(r=>r.requested))/(routes.length/c.ep)}
}
