// Synthetic CANN-shaped data only. No real capture names, paths or measurements.
export function profileBundleFixture(){
  const epoch=1750000000000000n,stamp=t=>`${epoch+BigInt(Math.floor(t))}.${String(Math.round((t%1)*1000)).padStart(3,'0')}`
  const kernels=Array.from({length:30},(_,i)=>({name:'MatMulSynthetic',type:'AI_CORE',id:i%4,stream:2,start:10+i*20,duration:8}))
  const tasks=[...kernels,{name:'wait-overlap',type:'DAVID_EVENT_WAIT',id:91,stream:3,start:11,duration:4},{name:'wait-uncovered',type:'NOTIFY_WAIT',id:92,stream:3,start:1000,duration:10},{name:'record',type:'DAVID_EVENT_RECORD',id:93,stream:3,start:1000.010,duration:.007},{name:'copy',type:'SDMA_SQE',id:94,stream:4,start:620,duration:5}]
  const kernel=['Device_id,Task ID,Stream ID,Name,Type,Accelerator Core,Start Time(us),Duration(us),Input Shapes,Input Data Types,Input Formats,aic_total_cycles,aic_mac_ratio,aic_mte2_ratio,cube_utilization(%)',...kernels.map(t=>`0,${t.id},${t.stream},${t.name},MatMul,${t.type},${stamp(t.start)},${t.duration},"16,16;16,16",BF16;BF16,ND;ND,1000,.05,.8,50`)].join('\n')
  const trace=JSON.stringify([{ph:'M',name:'process_name',pid:9,args:{name:'Ascend Hardware'}},...tasks.map(t=>({ph:'X',pid:9,tid:99,ts:stamp(t.start),dur:t.duration,name:t.name,args:{'Task Id':t.id,'Physic Stream Id':t.stream,'Task Type':t.type}})),{ph:'X',pid:1,tid:1,name:'step[TARGET_VERIFY bs=2]',ts:stamp(0),dur:1030}])
  const taskTime=['Device_id,kernel_name,kernel_type,stream_id,task_id,task_time(us),task_start(us),task_stop(us)',...tasks.map(t=>`0,${t.name},${t.type==='SDMA_SQE'?'MEMCPY_ASYNC':t.type},${t.stream},${t.id},${t.duration},${stamp(t.start)},${stamp(t.start+t.duration)}`)].join('\n')
  return [
    ['kernel_details.csv',kernel],['trace_view.json',trace],['task_time.csv',taskTime],
    ['op_statistic.csv','Device_id,OP Type,Core Type,Count,Total Time(us),Min Time(us),Avg Time(us),Max Time(us)\n0,MatMul,AI_CORE,30,240,8,8,8'],
    ['api_statistic.csv','Device_id,Level,API Name,Time(us),Count,Avg(us),Min(us),Max(us)\n0,runtime,LaunchSynthetic,50,5,10,1,20'],
    ['operator_details.csv','Name,Call Stack,Host Self Duration(us),Host Total Duration(us),Device Self Duration(us),Device Total Duration(us)\nFrameworkSynthetic,PRIVATE_STACK_CANARY,4,100,2,200'],
    ['step_trace_time.csv','Device_id,Step,Computing,Communication,Free,Stage,Preparing\n0,,245,0,20,265,2'],
  ].map(([name,text])=>({name,text,size:Buffer.byteLength(text)}))
}
