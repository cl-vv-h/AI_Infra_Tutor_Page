import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultTopology as base,readTopologyQuery,writeTopologyQuery,worldSize,groupMembers,logicalRank,placeRank,simulateTopology,snapshotTopology,contributors,witnessValue,roundCost} from '../src/lib/communication-topology.ts'

test('all topology fields strictly round trip; malformed axes, ranges and modes fail closed',()=>{
  const c={...base,tp:64,ep:32,adp:16,pp:64,replicas:64,rank:262143,devices:16,placement:'striped',sizeKiB:1,remoteGBs:.1,localUs:.01}
  assert.deepEqual(readTopologyQuery(writeTopologyQuery(c)),c)
  assert.deepEqual(readTopologyQuery(''),base)
  for(const q of ['v=2','tp=128','tp=3','tp=2&ep=4','adp=16','pp=0','pp=65','rank=16','rank=-1','sizeKiB=0','sizeKiB=1048577','sizeKiB=1.5','nicGBs=0','localUs=0','remoteGBs=NaN','remoteGBs=1e3','group=ep','mode=missing','group=unknown','placement=unknown','rank=0&rank=1','unknown=1'])assert.throws(()=>readTopologyQuery(q),undefined,q)
})
test('TP axes, EP striding, Attention DP and PP preserve rank membership without multiplying EP/DP',()=>{
  const c={...base,tp:16,ep:4,adp:2,pp:3,replicas:2,rank:71}
  assert.equal(worldSize(c),96);assert.deepEqual(logicalRank(c,71),{rank:71,t:7,stage:1,replica:1,attentionGroup:0,attentionRank:7,expertGroup:1,expertTpRank:3})
  assert.deepEqual(groupMembers({...c,group:'attention'}),[64,65,66,67,68,69,70,71])
  assert.deepEqual(groupMembers({...c,group:'moe'}),[68,69,70,71])
  assert.deepEqual(groupMembers({...c,group:'ep',mode:'pairwise-alltoall'}),[67,71,75,79])
  assert.deepEqual(groupMembers({...c,group:'pp',mode:'pipeline'}),[55,71,87])
  assert.deepEqual(groupMembers(c),Array.from({length:16},(_,i)=>64+i))
})
test('packed and striped placement are bijective with partial final hosts and very large logical worlds',()=>{
  for(const placement of ['packed','striped'])for(const pp of [1,3,7]){
    const c={...base,tp:2,ep:2,adp:1,pp,devices:8,replicas:1,placement},locations=new Set()
    for(let rank=0;rank<worldSize(c);rank++){
      const p=placeRank(c,rank);assert.ok(p.host<Math.ceil(worldSize(c)/c.devices));assert.ok(p.slot<c.devices);locations.add(`${p.host}:${p.slot}`)
    }
    assert.equal(locations.size,worldSize(c))
  }
  const huge={...base,tp:64,ep:64,adp:64,pp:64,replicas:64,rank:262143,placement:'striped',devices:64}
  assert.deepEqual(placeRank(huge,huge.rank),{host:4095,slot:63});assert.equal(groupMembers(huge).length,64)
})
test('Ring and Tree All-Reduce converge to the same independently computed sums through size 64',()=>{
  for(const n of [1,2,4,8,16,32,64])for(const mode of ['ring-allreduce','tree-allreduce']){
    const c={...base,tp:n,ep:1,pp:1,mode},r=simulateTopology(c),mask=(1n<<BigInt(n))-1n
    assert.equal(r.rounds.length,mode==='ring-allreduce'?2*(n-1):2*Math.log2(n))
    assert.equal(r.totalBytes,2*(n-1)*c.sizeKiB*1024)
    assert.deepEqual(snapshotTopology(r,r.rounds.length),r.final)
    r.final.forEach((row,d)=>row.forEach((value,k)=>{assert.equal(value,mask);assert.equal(witnessValue(c,value,k,d,n),n*(n+1)/2*(k+1))}))
    assert.equal(r.sent.reduce((a,b)=>a+b,0),r.received.reduce((a,b)=>a+b,0))
  }
})
test('Reduce-Scatter output chunk belongs to the same communicator rank; All-Gather preserves source order',()=>{
  for(const n of [1,2,4,8,16,32,64]){
    const c={...base,tp:n,ep:1,pp:1},rs=simulateTopology({...c,mode:'ring-reducescatter'}),ag=simulateTopology({...c,mode:'ring-allgather'})
    assert.equal(rs.totalBytes,(n-1)*c.sizeKiB*1024);assert.equal(ag.totalBytes,rs.totalBytes)
    for(let rank=0;rank<n;rank++){
      assert.equal(rs.final[rank][rank],(1n<<BigInt(n))-1n)
      ag.final[rank].forEach((mask,chunk)=>assert.deepEqual(contributors(mask,n),[chunk]))
    }
  }
})
test('every ring partial reduction combines disjoint contributors from the previous round only',()=>{
  const r=simulateTopology({...base,tp:16,ep:1})
  for(let round=0;round<15;round++){
    const before=snapshotTopology(r,round),after=snapshotTopology(r,round+1)
    for(const t of r.rounds[round].transfers){
      assert.equal(t.mask,before[t.from][t.chunk]);assert.equal(before[t.to][t.targetChunk]&t.mask,0n)
      assert.equal(contributors(after[t.to][t.targetChunk],16).length,round+2)
    }
  }
  assert.throws(()=>snapshotTopology(r,-1));assert.throws(()=>snapshotTopology(r,r.rounds.length+1))
})
test('All-to-All delivers exactly one distinct original chunk for each ordered pair without duplicate local traffic',()=>{
  for(const n of [1,2,4,8,16,32,64]){
    const c={...base,tp:n,ep:n,pp:1,group:'ep',mode:'pairwise-alltoall'},r=simulateTopology(c),pairs=new Set()
    assert.equal(r.rounds.length,n-1);assert.equal(r.totalBytes,(n-1)*c.sizeKiB*1024)
    r.rounds.forEach(round=>round.transfers.forEach(t=>{assert.notEqual(t.from,t.to);pairs.add(`${t.from}:${t.to}`);assert.equal(t.chunk,t.to);assert.equal(t.targetChunk,t.from)}))
    assert.equal(pairs.size,n*(n-1))
    r.final.forEach((row,dest)=>row.forEach((mask,source)=>{assert.equal(mask,1n<<BigInt(source));assert.equal(witnessValue(c,mask,source,dest,n),1000*(source+1)+dest+1)}))
  }
})
test('PP is a directed adjacent-stage activation chain, not a collective across replicas',()=>{
  const c={...base,tp:8,pp:7,replicas:2,rank:69,group:'pp',mode:'pipeline'},r=simulateTopology(c)
  assert.deepEqual(r.members,[61,69,77,85,93,101,109]);assert.equal(r.rounds.length,6)
  r.rounds.forEach((step,i)=>{assert.equal(step.transfers.length,1);assert.equal(step.transfers[0].from,i);assert.equal(step.transfers[0].to,i+1)})
  assert.equal(r.totalBytes,6*c.sizeKiB*1024);assert.ok(r.final.every(row=>row[0]===1n))
})
test('placement changes host crossings, not logical membership, numerical results or total sent bytes',()=>{
  const packed=simulateTopology(base),striped=simulateTopology({...base,placement:'striped'})
  assert.deepEqual(packed.members,striped.members);assert.deepEqual(packed.final,striped.final);assert.equal(packed.totalBytes,striped.totalBytes)
  assert.equal(packed.remoteBytes,0);assert.equal(striped.remoteBytes,striped.totalBytes)
  assert.ok(striped.durationUs>packed.durationUs)
})
test('round cost uses declared decimal GB/s, separate directional budgets and shared NIC contention',()=>{
  const c={...base,tp:4,ep:1,pp:1,devices:2,localGBs:100,remoteGBs:10,nicGBs:5,localUs:2,remoteUs:8}
  const transfer=(from,to)=>({from,to,chunk:0,targetChunk:0,bytes:1000000,mask:1n,action:'copy'})
  const cost=roundCost(c,[0,1,2,3],[transfer(0,2),transfer(1,3),transfer(2,0),transfer(3,1)])
  assert.equal(cost.durationUs,408);assert.equal(cost.nicPeakBytes,2000000);assert.equal(cost.remoteBytes,4000000);assert.equal(cost.limit,'host-network')
  const local=roundCost(c,[0,1],[transfer(0,1),transfer(1,0)])
  assert.equal(local.durationUs,12);assert.equal(local.remoteBytes,0);assert.equal(local.localBytes,2000000)
  assert.equal(roundCost(c,[0],[]).durationUs,0)
})
test('all singleton operations have no fictitious messages or startup cost',()=>{
  for(const [group,mode] of [['dense','ring-allreduce'],['dense','tree-allreduce'],['dense','ring-allgather'],['dense','ring-reducescatter'],['ep','pairwise-alltoall'],['pp','pipeline']]){
    const r=simulateTopology({...base,tp:1,ep:1,pp:1,group,mode});assert.equal(r.durationUs,0);assert.equal(r.totalBytes,0);assert.equal(r.rounds.length,0)
  }
})
