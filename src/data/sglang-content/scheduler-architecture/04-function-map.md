# Scheduler 函数地图

本文件按“入�
�� -> 输入 -> 调度 -> 执行 -> 结果 ->
 控制”整理 `scheduler.py`。行号来�
�当前仓库快照，用于辅助定位；�
�稳定的定位方式是文件名 + 函数�
�。

## 进程与事件循环

| 函数 | �
�置 | 做什么 | 主要下一跳 |
| --- | 
--- | --- | --- |
| `run_scheduler_process` |
 `scheduler.py:3951` | Scheduler 子进程入
口，加载插件、配置进程、创建 Sc
heduler、通知父进程、进入事件循�
� | `configure_scheduler_process`, `Scheduler
.__init__`, `run_event_loop` |
| `configure_s
cheduler_process` | `scheduler.py:3894` | 设
置进程名、日志、faulthandler、CPU af
finity、NUMA 绑定 | 返回 `dp_rank` |
| `
Scheduler.__init__` | `scheduler.py:296` | �
�配运行时：并行状态、模型配置�
�IPC、worker、KV cache、调度策略、ove
rlap、grammar 等 | `init_running_status`, `
init_schedule_policy`, `init_request_dispatch
er` |
| `run_event_loop` | `scheduler.py:1404
` | 创建 schedule stream，并把控制权�
��给具体 event loop | `dispatch_event_loop
` |
| `dispatch_event_loop` | `scheduler.py:3
863` | 根据 disaggregation、PP、overlap�
�pdmux 选择事件循环实现 | `event_loop
_normal`, `event_loop_overlap`, PP/disagg loo
p |
| `event_loop_normal` | `scheduler.py:142
5` | 非 overlap 主循环：收请求、选 
batch、forward、处理结果 | `process_inp
ut_requests`, `get_next_batch_to_run`, `run_b
atch`, `process_batch_result` |
| `event_loop
_overlap` | `scheduler.py:1452` | overlap 主
循环：当前 batch forward 与上一 batch
 结果处理重叠 | `is_disable_overlap_for
_batch`, `run_batch`, `launch_batch_sample_if
_needed` |

## 输入与入队

| 函数 | �
�置 | 改变的核心状态 | 说明 |
| ---
 | --- | --- | --- |
| `init_request_dispatch
er` | `scheduler.py:1279` | `self._request_di
spatcher` | 建立请求类型到 handler 的
映射 |
| `process_input_requests` | `schedu
ler.py:1543` | `waiting_queue`, `return_healt
h_check_ipcs`, 控制状态 | 对一批 IPC �
��求逐个分发，立即返回控制请求�
��出 |
| `handle_generate_request` | `schedu
ler.py:1898` | 可能创建 `Req` 并入队 |
 处理 session、input embeds、多模态、
长度校验、logprob、grammar |
| `_add_re
quest_to_queue` | `scheduler.py:2156` | `wait
ing_queue` 或 disagg 专用队列 | 普通�
�式 append waiting queue，PD 模式进入 b
ootstrap/prealloc 队列 |
| `abort_request` 
| `scheduler.py:3566` | `waiting_queue`, gram
mar/disagg 队列, `req.to_finish` | abort �
�开始、等待中、disagg 中和 running �
��的请求 |

## 调度决策

| 函数 | �
�置 | 输入 | 输出 | 说明 |
| --- | ---
 | --- | --- | --- |
| `get_next_batch_to_run
` | `scheduler.py:2404` | `waiting_queue`, `r
unning_batch`, `last_batch`, `chunked_req` | 
`ScheduleBatch` 或 `None` | Scheduler 核心
决策：优先 prefill，其次 decode |
| `
get_new_batch_prefill` | `scheduler.py:2532` 
| waiting/running 状态 | prefill `ScheduleB
atch` 或 `None` | 包装 prefill delayer，�
��后调用 raw 版本 |
| `_get_new_batch_pr
efill_raw` | `scheduler.py:2552` | waiting qu
eue、KV cache、policy、chunked_req | prefi
ll `ScheduleBatch` 或 `None` | 用 `Schedule
Policy` + `PrefillAdder` 选出本轮可 pref
ill 请求 |
| `update_running_batch` | `sche
duler.py:2823` | `running_batch` | decode `Sc
heduleBatch` 或空 batch | 清理完成请�
�，检查 decode 内存，不足时 retract�
��再准备 decode 张量 |

## 执行与结�
��

| 函数 | 位置 | 做什么 | 关键协
作者 |
| --- | --- | --- | --- |
| `run_bat
ch` | `scheduler.py:2965` | 调用模型 work
er 执行 generation/embedding forward | `mod
el_worker`, `tp_worker`, `future_map`, CUDA s
treams |
| `_overlap_forward_isolation` | `sc
heduler.py` | overlap 下保护 `ScheduleBatc
h` 字段和 GPU tensor 生命周期 | `recor
d_batch_in_overlap` |
| `launch_batch_sample_
if_needed` | `scheduler.py:3136` | 处理延�
��采样，通常用于 overlap + structured 
output 场景 | `future_map`, `delay_sample_f
unc` |
| `process_batch_result` | `scheduler.
py:3167` | 按 forward mode 分发结果处�
�，统一 metrics/health/cleanup | `BatchRes
ultProcessor` |
| `on_idle` | `scheduler.py:3
249` | 空闲时做内存一致性检查、me
trics、KV event、sleep | `invariant_checker
`, `metrics_reporter`, `idle_sleeper` |

## �
��制与维护

| 函数 | 位置 | 说明 |

| --- | --- | --- |
| `is_fully_idle` | `sche
duler.py:3285` | 判断 Scheduler 是否完�
�空闲；不仅看 running/waiting，还看 
overlap result queue、grammar、disagg、HiC
ache 等 |
| `flush_cache` | `scheduler.py:34
32` | 只有完全空闲时清空 tree cache�
��req/token pools、grammar、metrics 和设�
�� allocator cache |
| `pause_generation` | `
scheduler.py:3677` | 暂停 generation；可 
in-place 保留状态，也可 retract runnin
g requests |
| `continue_generation` | `sched
uler.py:3739` | 解除暂停，可选执行 `
torch.cuda.empty_cache` |

## 关联支撑类


| 类/函数 | 位置 | Scheduler 为什么
依赖它 |
| --- | --- | --- |
| `Req` | `sc
hedule_batch.py:641` | 单请求运行时状�
��，保存 token、采样参数、cache 索�
��、finish reason |
| `ScheduleBatch` | `sch
edule_batch.py:1481` | 一次 forward 的 bat
ch 容器 |
| `ScheduleBatch.init_new` | `sch
edule_batch.py:1649` | 从 `Req` 列表创建
 batch，并绑定 cache/pool/tree_cache |
| 
`ScheduleBatch.prepare_for_extend` | `schedul
e_batch.py:1813` | 为 prefill/extend forward
 准备输入张量和元信息 |
| `Schedule
Batch.prepare_for_decode` | `schedule_batch.p
y:2383` | 为 decode forward 准备 next-toke
n 输入和 seq lens |
| `ScheduleBatch.filte
r_batch` | `schedule_batch.py:2477` | 移除 
finished/aborted/不该继续跑的请求 |
|
 `ScheduleBatch.merge_batch` | `schedule_batc
h.py:2560` | 把上一轮 prefill 完成的�
�求合入 running batch |
| `ScheduleBatch.c
heck_decode_mem` | `schedule_batch.py:2261` |
 判断 decode 下一步是否还有 KV cache
 空间 |
| `ScheduleBatch.retract_decode` | 
`schedule_batch.py:2274` | 内存不足时撤
回部分 decode 请求 |
| `SchedulePolicy.c
alc_priority` | `schedule_policy.py:162` | �
� waiting queue 排序或计算优先级 |
| 
`PrefillAdder` | `schedule_policy.py:405` | �
��责在 token/request/cache 预算下选 pre
fill 请求 |
| `PrefillAdder.add_one_req` | 
`schedule_policy.py:828` | 尝试把单个请
求加入本轮 prefill batch |
| `PrefillAdd
er.add_chunked_req` | `schedule_policy.py:679
` | 继续调度跨轮的 chunked prefill 请
求 |
| `PrefillAdder.preempt_to_schedule` | 
`schedule_policy.py:985` | 优先级抢占时
撤回低优先级 running 请求 |
| `BatchR
esultProcessor.process_batch_result_prefill` 
| `scheduler_components/batch_result_processo
r.py:178` | 处理 prefill 结果、首 token
、prefix cache、输出 |
| `BatchResultProc
essor.process_batch_result_decode` | `schedul
er_components/batch_result_processor.py:588` 
| 处理 decode token、finish 判断、流�
�输出、cache 释放 |

## 最小阅读路�
��

如果只想先读懂一条普通生成�
�求的路径，建议按下面顺序打开�
�数：

1. `scheduler.py:Scheduler.event_loo
p_normal`
2. `scheduler.py:Scheduler.process_
input_requests`
3. `scheduler.py:Scheduler.ha
ndle_generate_request`
4. `scheduler.py:Sched
uler._add_request_to_queue`
5. `scheduler.py:
Scheduler.get_next_batch_to_run`
6. `schedule
r.py:Scheduler._get_new_batch_prefill_raw`
7.
 `scheduler.py:Scheduler.run_batch`
8. `sched
uler.py:Scheduler.process_batch_result`
9. `s
cheduler_components/batch_result_processor.py
:process_batch_result_prefill`
10. `scheduler
_components/batch_result_processor.py:process
_batch_result_decode`



