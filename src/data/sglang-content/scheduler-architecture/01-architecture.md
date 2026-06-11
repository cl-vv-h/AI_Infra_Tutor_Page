# Scheduler 架构总览

## 一句话理解


`Scheduler` 是 SGLang server 里真正决�
�“下一次 GPU forward 跑哪些请求”�
��组件。它一边从 Tokenizer/RPC 收请�
��，一边维护等待队列和运行中 bat
ch，再根据 KV cache、请求优先级、c
hunked prefill、LoRA、grammar、disaggregat
ion、overlap 等约束，把请求组装成 
`ScheduleBatch` 交给模型 worker 执行。


源码入口：

- `python/sglang/srt/manag
ers/scheduler.py:Scheduler.__init__`
- `pytho
n/sglang/srt/managers/scheduler.py:Scheduler.
run_event_loop`
- `python/sglang/srt/managers
/scheduler.py:dispatch_event_loop`

## 核心
职责

1. 进程初始化：加载模型配�
��、并行拓扑、IPC 通道、KV cache、w
orker、metrics、grammar、LoRA、HiCache �
�组件。
2. 请求接收：从 `request_rec
eiver` 读取 TokenizerManager/RPC 发来的�
��求。
3. 请求分发：通过 `TypeBasedD
ispatcher` 把不同请求类型派发给不�
�� handler。
4. 入队与校验：把生成�
��求转换成 `Req`，做长度、logprob、
多模态、grammar、disaggregation 等校�
�，然后放入 `waiting_queue` 或专用队
列。
5. batch 决策：在每一轮事件�
�环里调用 `get_next_batch_to_run`，优�
�构造 prefill batch，没有 prefill 时推
进 decode batch。
6. forward 执行：调�
� `model_worker.forward_batch_generation` 或
 embedding worker。
7. 结果处理：按 pr
efill/decode/prebuilt/idle 分支更新请求
状态、释放缓存、发送输出。
8. �
�闲维护：空闲时做 cache/invariant 检
查、metrics 刷新、睡眠等待下一次�
��件。

## 关键状态

核心状态入口
主要分散在 `Scheduler.init_running_statu
s`、`Scheduler.init_chunked_prefill` 和 `Sc
heduler.init_overlap`。

| 状态 | 含义 |
 谁会读写 |
| --- | --- | --- |
| `waitin
g_queue` | 等待被 prefill 的 `Req` 列表
 | `_add_request_to_queue` 写入，`_get_new
_batch_prefill_raw` 消费 |
| `running_batch
` | 已完成 prefill、正在 decode 或等�
�� decode 的 batch | `get_next_batch_to_run`
 合并 prefill 结果，`update_running_batc
h` 推进 |
| `cur_batch` | 当前这一轮�
�备执行或正在执行的 batch | event lo
op 设置，结果处理时读取 |
| `last_b
atch` | 上一轮执行过的 batch | overlap
/normal loop 用它把 extend batch 合并进
 running batch |
| `chunked_req` | 被切分 
prefill 的大请求，初始化于 `init_chu
nked_prefill` | `PrefillAdder` 创建或继�
�调度 |
| `result_queue` | overlap 模式�
�暂存已经 launch 但尚未处理的结果
，初始化于 `init_overlap`/`event_loop_ov
erlap` | `event_loop_overlap` 维护 |
| `ret
urn_health_check_ipcs` | 忙碌时延迟返�
�的健康检查请求 | `process_input_reque
sts` 写入，`maybe_send_health_check_signal
` 消费 |

## 主要协作者

| 组件 | �
�件/函数 | 在 Scheduler 中的角色 |
| 
--- | --- | --- |
| `Req` | `schedule_batch.p
y:Req` | 单个生成/embedding 请求的运�
��时状态，包括输入 token、输出 tok
en、采样参数、缓存位置、完成状�
�� |
| `ScheduleBatch` | `schedule_batch.py:S
cheduleBatch` | 一次 GPU forward 的 batch 
容器，保存 req 列表、forward mode、t
oken 张量、KV cache 索引等 |
| `Schedul
ePolicy` | `schedule_policy.py:SchedulePolicy
.calc_priority` | 给等待队列排序，决
定请求调度优先级 |
| `PrefillAdder` |
 `schedule_policy.py:PrefillAdder.add_one_req
` | 在 token/request/KV cache 预算下挑�
�能进入下一次 prefill 的请求 |
| `Ba
tchResultProcessor` | `scheduler_components/b
atch_result_processor.py` | 处理模型 forw
ard 结果，更新请求状态并发送输�
� |
| `tree_cache` | KV/Radix/HiCache 相关�
��现 | 负责 prefix cache 命中、缓存�
�入、缓存释放、HiCache 异步事件 |

| `model_worker` | Scheduler 初始化时创�
�� | 真正执行 generation/embedding forwar
d |
| `grammar_manager` | Scheduler 初始化
时创建 | 结构化输出 grammar 的等待
、准备、abort 与采样同步 |
| `ipc_ch
annels` | Scheduler 初始化时创建 | 与 
tokenizer、detokenizer、RPC 进程通信 |


## Scheduler 的层次

```mermaid
flowchart
 TB
  subgraph P["进程层"]
    A["run_sche
duler_process"]
    B["configure_scheduler_pr
ocess"]
    C["Scheduler.__init__"]
  end

  
subgraph L["事件循环层"]
    D["run_even
t_loop"]
    E["dispatch_event_loop"]
    F["
event_loop_normal / event_loop_overlap / disa
gg / pp"]
  end

  subgraph I["输入层"]
  
  G["process_input_requests"]
    H["TypeBase
dDispatcher"]
    I1["handle_generate_request
"]
    I2["_add_request_to_queue"]
  end

  s
ubgraph S["调度层"]
    J["get_next_batch_
to_run"]
    K["get_new_batch_prefill"]
    L
1["_get_new_batch_prefill_raw"]
    M["update
_running_batch"]
  end

  subgraph FWD["执�
�与结果层"]
    N["run_batch"]
    O["pro
cess_batch_result"]
    Q["BatchResultProcess
or"]
  end

  A --> B --> C --> D --> E --> F

  F --> G --> H --> I1 --> I2
  F --> J
  J 
--> K --> L1
  J --> M
  J --> N --> O --> Q

```

## 最重要的设计点

### 1. Continu
ous batching

Scheduler 不会等一批请求
全部完成才接收新请求。每一轮循
环都会先收新请求，再决定是否优
先跑 prefill；如果没有合适的 prefil
l，就继续 decode 已在运行的请求。


关键函数：

- `scheduler.py:Scheduler.
event_loop_normal`
- `scheduler.py:Scheduler.
get_next_batch_to_run`
- `scheduler.py:Schedu
ler._get_new_batch_prefill_raw`
- `scheduler.
py:Scheduler.update_running_batch`

### 2. Pr
efill 优先，但受预算约束

新请求�
��须先走 prefill，把 prompt 写进 KV ca
che。`PrefillAdder` 会根据可用请求槽
、可用 KV cache token、chunked prefill、
LoRA 限制、优先级抢占等条件，决�
��哪些请求能进入当前 prefill batch�
�

### 3. Decode 是 running_batch 的持续�
��进

完成 prefill 的请求会进入 `run
ning_batch`。decode 阶段每轮通常为每
个未完成请求生成新 token；如果 KV
 cache 不够，`update_running_batch` 会撤
回一部分请求，把它们重新放回等
待队列。

### 4. Overlap 模式把“发�
�� forward”和“处理上轮结果”拆�
�

普通模式是：

```text
选 batch -> r
un_batch -> process_batch_result -> 下一轮

```

Overlap 模式是：

```text
处理上
轮必要结果 -> 发起本轮 forward -> �
�处理上一轮结果 -> 延迟采样 -> 下
一轮
```

这样 Scheduler 的 CPU 侧准�
�工作可以和 GPU forward 部分重叠，�
��也需要 `future_map`、stream 同步和 `
result_queue` 保证数据生命周期正确�
��


