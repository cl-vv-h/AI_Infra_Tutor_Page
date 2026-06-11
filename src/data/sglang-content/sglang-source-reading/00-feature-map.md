# SGLang 特性地图：读源码前先认识
这些分支

这份文档不是用户手册�
��而是“读源码词典”。你在看 SGL
ang 源码时，经常会遇到 `dllm_config 
is not None`、`disaggregation_mode == PREFIL
L`、`enable_overlap`、`spec_algorithm`、`e
nable_hierarchical_cache` 这类分支。它�
��不是主链，但会频繁插进主链。


本讲目标：先知道这些特性分别�
�决什么问题、会影响哪条路径、�
�一次读源码时能不能先跳过。每�
�源码定位都给到具体函数、类或�
�码段，而不是只给文件。

## 总览
图

```mermaid
mindmap
  root((SGLang 特性
))
    Serving API
      OpenAI compatible
  
    Streaming
      Function calling
      Re
asoning parser
    Scheduler
      Continuous
 batching
      Chunked prefill
      Priorit
y scheduling
      Overlap schedule
    Cache
 / Memory
      KV cache pool
      Radix cac
he
      HiCache
      LMCache
    Generation

      Sampling
      Structured output
     
 Speculative decoding
      dLLM
    Adaptati
on
      LoRA
      Custom logit processor
  
  Parallelism
      TP
      PP
      DP atte
ntion
      PD disaggregation
      Expert pa
rallelism
    Model Types
      Text LLM
    
  Multimodal
      Embedding / scoring
      
Diffusion LLM
```

## 主线与支线

```mer
maid
flowchart TD
  A["主线：一次生成�
��求"] --> B["HTTP / OpenAI Adapter"]
  B --
> C["TokenizerManager"]
  C --> D["Scheduler"
]
  D --> E["ModelWorker / ModelRunner"]
  E 
--> F["DetokenizerManager"]

  D -.支线.-> 
G["Speculative Decoding"]
  D -.支线.-> H["
PD Disaggregation"]
  D -.支线.-> I["dLLM"]

  D -.支线.-> J["HiCache / Radix Cache"]
 
 E -.支线.-> K["CUDA Graph / Attention Back
end / Quantization"]
  C -.支线.-> L["LoRA 
/ Grammar / Reasoning / Tools"]
```

第一�
�读源码时，先走实线。虚线分支�
�知道“它为什么存在”，不急着�
�行读。

## 关键类调用关系全景图


下面这张图把一次普通生成请求�
��最重要的类、管理器和数据对象�
��在同一张图里。它不是继承图，�
��是“运行时谁调用谁、谁持有哪�
��对象、数据如何流动”的知识图�
��。

```mermaid
flowchart TB
  subgraph API
["入口层：HTTP / OpenAI / Engine"]
    HT
TP["FastAPI HTTP Server<br/>python/sglang/srt
/entrypoints/http_server.py"]
    Engine["Eng
ine<br/>python/sglang/srt/entrypoints/engine.
py"]
    OpenAIChat["OpenAIServingChat<br/>en
trypoints/openai/serving_chat.py"]
    OpenAI
Base["OpenAIServingBase<br/>entrypoints/opena
i/serving_base.py"]
    TemplateManager["Temp
lateManager<br/>managers/template_manager.py"
]
  end

  subgraph Tokenize["Tokenize / Deto
kenize 层"]
    TokenizerManager["TokenizerM
anager<br/>managers/tokenizer_manager.py"]
  
  TokenizerControlMixin["TokenizerControlMixi
n<br/>managers/tokenizer_control_mixin.py"]
 
   TokenizerScoreMixin["TokenizerManagerScore
Mixin<br/>managers/tokenizer_manager_score_mi
xin.py"]
    HFTokenizer["HF / tiktoken Token
izer<br/>utils/hf_transformers/tokenizer.py<b
r/>tokenizer/tiktoken_tokenizer.py"]
    Proc
essor["Processor / Multimodal Processor<br/>H
F processor or model processor"]
    Detokeni
zerManager["DetokenizerManager<br/>managers/d
etokenizer_manager.py"]
  end

  subgraph IPC
["进程通信与请求结构"]
    GenerateR
eq["GenerateReqInput / EmbeddingReqInput<br/>
managers/io_struct.py"]
    TokenizedReq["Tok
enizedGenerateReqInput<br/>managers/io_struct
.py"]
    BatchTokenizedReq["BatchTokenizedGe
nerateReqInput<br/>managers/io_struct.py"]
  
  SchedulerReqReceiver["SchedulerRequestRecei
ver<br/>scheduler_components/request_receiver
.py"]
    SchedulerIpcChannels["SchedulerIpcC
hannels<br/>scheduler_components/ipc_channels
.py"]
    Streamer["SchedulerOutputStreamer<b
r/>scheduler_components/output_streamer.py"]

  end

  subgraph SchedulerLayer["调度层�
�Scheduler 与 Batch"]
    Scheduler["Schedul
er<br/>managers/scheduler.py"]
    SchedulerM
ixins["Scheduler Mixins<br/>PP / dLLM / Disag
g / Multiplex / MLX"]
    Req["Req<br/>manage
rs/schedule_batch.py"]
    ScheduleBatch["Sch
eduleBatch<br/>managers/schedule_batch.py"]
 
   SchedulePolicy["SchedulePolicy / Prefix ma
tch<br/>managers/schedule_policy.py"]
    Bat
chProcessor["SchedulerBatchResultProcessor<br
/>scheduler_components/batch_result_processor
.py"]
    LogprobProcessor["SchedulerLogprobR
esultProcessor<br/>scheduler_components/logpr
ob_result_processor.py"]
    DPAttnAdapter["S
chedulerDPAttnAdapter<br/>scheduler_component
s/dp_attn.py"]
    WeightUpdater["SchedulerWe
ightUpdaterManager<br/>scheduler_components/w
eight_updater.py"]
  end

  subgraph CacheLay
er["缓存与内存层"]
    TreeCache["BaseP
refixCache<br/>RadixCache / SWARadixCache / U
nifiedRadixCache"]
    HiCache["HiRadixCache 
/ HiCacheStorage<br/>mem_cache/hiradix_cache.
py<br/>mem_cache/hicache_storage.py"]
    Req
Pool["ReqToTokenPool<br/>mem_cache/memory_poo
l.py"]
    KVPool["KVCache<br/>MHATokenToKVPo
ol / MLATokenToKVPool / SWAKVPool / DSATokenT
oKVPool"]
    KVAllocator["BaseTokenToKVPoolA
llocator<br/>TokenToKVPoolAllocator / PagedTo
kenToKVPoolAllocator"]
    KVBuilder["KVCache
Builder / KVCacheBuildResult<br/>mem_cache/kv
_cache_builder.py"]
  end

  subgraph WorkerL
ayer["模型 worker 层"]
    BaseTpWorker["B
aseTpWorker<br/>managers/tp_worker.py"]
    T
pWorker["TpModelWorker<br/>managers/tp_worker
.py"]
    SpecWorker["Speculative Workers<br/
>EAGLE / NGram / FrozenKV-MTP"]
    DllmManag
er["DllmManager<br/>dllm/mixin/scheduler.py"]

  end

  subgraph Executor["模型执行层"
]
    ModelRunner["ModelRunner<br/>model_exec
utor/model_runner.py"]
    KVMixin["ModelRunn
erKVCacheMixin<br/>model_executor/model_runne
r_kv_cache_mixin.py"]
    ForwardBatch["Forwa
rdBatch<br/>model_executor/forward_batch_info
.py"]
    PPProxy["PPProxyTensors<br/>model_e
xecutor/forward_batch_info.py"]
    ForwardCo
ntext["ForwardContext<br/>model_executor/forw
ard_batch_info.py"]
    ModelConfig["ModelCon
fig<br/>configs/model_config.py"]
    ModelLo
ader["Model Loader<br/>model_loader/*"]
    M
odel["nn.Module model<br/>models/*"]
  end

 
 subgraph Kernels["执行后端与采样"]
  
  AttentionBackend["AttentionBackend<br/>laye
rs/attention/*"]
    GraphRunner["CudaGraphRu
nner / CPUGraphRunner / NPUGraphRunner<br/>mo
del_executor/cuda_graph_runner.py"]
    Piece
wiseGraph["PiecewiseCudaGraphRunner<br/>model
_executor/piecewise_cuda_graph.py"]
    Logit
sProcessor["LogitsProcessor / LogitsProcessor
Output<br/>layers/logits_processor.py"]
    S
ampler["Sampler<br/>layers/sampler.py"]
    S
amplingInfo["SamplingBatchInfo<br/>sampling/s
ampling_batch_info.py"]
    SamplingParams["S
amplingParams<br/>sampling/sampling_params.py
"]
    LoRAManager["LoRAManager<br/>lora/lora
_manager.py"]
  end

  HTTP --> OpenAIChat
  
HTTP --> Engine
  Engine --> TokenizerManager

  OpenAIChat --> OpenAIBase
  OpenAIChat -->
 TemplateManager
  OpenAIBase --> TokenizerMa
nager
  TemplateManager --> HFTokenizer

  To
kenizerManager --> TokenizerControlMixin
  To
kenizerManager --> TokenizerScoreMixin
  Toke
nizerManager --> HFTokenizer
  TokenizerManag
er --> Processor
  TokenizerManager --> Gener
ateReq
  GenerateReq --> TokenizedReq
  Token
izerManager --> BatchTokenizedReq
  BatchToke
nizedReq --> SchedulerReqReceiver
  Scheduler
ReqReceiver --> Scheduler
  SchedulerIpcChann
els --> Scheduler
  Scheduler --> Streamer
  
Streamer --> DetokenizerManager
  Detokenizer
Manager --> HFTokenizer

  Scheduler --> Sche
dulerMixins
  Scheduler --> Req
  Req --> Sch
eduleBatch
  Scheduler --> ScheduleBatch
  Sc
heduler --> SchedulePolicy
  Scheduler --> Ba
tchProcessor
  Scheduler --> LogprobProcessor

  Scheduler --> DPAttnAdapter
  Scheduler --
> WeightUpdater

  SchedulePolicy --> TreeCac
he
  Scheduler --> TreeCache
  TreeCache --> 
HiCache
  ScheduleBatch --> ReqPool
  Schedul
eBatch --> KVAllocator
  KVAllocator --> KVPo
ol
  ModelRunner --> KVMixin
  KVMixin --> KV
Builder
  KVBuilder --> ReqPool
  KVBuilder -
-> KVPool
  KVBuilder --> KVAllocator

  Sche
duler --> BaseTpWorker
  BaseTpWorker --> TpW
orker
  TpWorker --> ModelRunner
  SpecWorker
 --> TpWorker
  SchedulerMixins --> DllmManag
er
  DllmManager --> TpWorker

  TpWorker -->
 ForwardBatch
  ScheduleBatch --> ForwardBatc
h
  ModelRunner --> ModelConfig
  ModelRunner
 --> ModelLoader
  ModelLoader --> Model
  Mo
delRunner --> ForwardBatch
  ModelRunner --> 
ForwardContext
  ForwardBatch --> PPProxy
  F
orwardContext --> AttentionBackend
  ModelRun
ner --> AttentionBackend
  ModelRunner --> Gr
aphRunner
  ModelRunner --> PiecewiseGraph
  
ModelRunner --> LogitsProcessor
  ModelRunner
 --> Sampler
  ModelRunner --> LoRAManager
  
ForwardBatch --> SamplingInfo
  SamplingInfo 
--> SamplingParams
  Model --> LogitsProcesso
r
  LogitsProcessor --> Sampler
  Sampler -->
 BatchProcessor
  BatchProcessor --> Streamer

```

读这张图时，可以先抓住 5 条
主边：

1. `TokenizerManager -> Scheduler 
-> TpModelWorker -> ModelRunner -> Sampler`�
�普通文本生成主链路。
2. `Scheduler
 -> ScheduleBatch -> ForwardBatch`：请求�
�调度视角变成模型执行视角。
3. `
Scheduler / SchedulePolicy -> RadixCache -> R
eqToTokenPool / KVPool`：prefix cache 与 KV
 cache 分配链路。
4. `ModelRunner -> Att
entionBackend / GraphRunner / LogitsProcessor
 / Sampler`：模型执行后的性能与采�
��链路。
5. `SchedulerBatchResultProcessor
 -> SchedulerOutputStreamer -> DetokenizerMan
ager`：模型输出回到流式文本的链�
��。

## 关键类知识图谱

### 1. 入�
�与请求对象

| 类 / 对象 | 位置 | �
��游 | 下游 | 核心职责 |
|---|---|---|
---|---|
| `Engine` | `python/sglang/srt/entr
ypoints/engine.py` / `Engine` | Python API �
� HTTP server | `TokenizerManager`、Schedule
r 子进程、Detokenizer 子进程 | 本地/
嵌入式使用的总入口，负责启动 to
kenizer、scheduler、detokenizer 等运行�
�组件。 |
| `OpenAIServingChat` | `entrypo
ints/openai/serving_chat.py` | FastAPI route 
| `TokenizerManager.generate_request()` | 处
理 `/v1/chat/completions`，完成 messages�
��tools、reasoning、response_format 等 Ope
nAI 协议转换。 |
| `OpenAIServingBase` |
 `entrypoints/openai/serving_base.py` | 各 O
penAI serving 类 | `TokenizerManager` | 提�
�� LoRA 解析、模型信息、通用错误�
��理等基础能力。 |
| `GenerateReqInput
` | `managers/io_struct.py` | OpenAI serving 
/ Engine API | `TokenizerManager` | 未 token
ized 的生成请求，保留原始 prompt、
messages、sampling params、stream 等用户
语义。 |
| `TokenizedGenerateReqInput` | `
managers/io_struct.py` | `TokenizerManager` |
 `SchedulerRequestReceiver`、`Scheduler` | �
��完成 tokenization 的单请求，调度�
�主要消费这个对象。 |
| `BatchTokeni
zedGenerateReqInput` | `managers/io_struct.py
` | `TokenizerManager` | `Scheduler` | 批量
 tokenized 请求，减少 IPC 次数。 |

#
## 2. Tokenizer / Detokenizer 层

| 类 / �
�象 | 位置 | 依赖 | 被谁调用 | 核�
�职责 |
|---|---|---|---|---|
| `TokenizerM
anager` | `managers/tokenizer_manager.py` / `
TokenizerManager` | HF tokenizer、processor�
��template、IPC sockets | OpenAI serving、E
ngine | 把原始请求转成 token ids，并
把 tokenized 请求发送给 Scheduler。也
负责 multimodal preprocessing、grammar 初
始化、LoRA 信息注入。 |
| `TokenizerC
ontrolMixin` | `managers/tokenizer_control_mi
xin.py` | `TokenizerManager` 状态 | HTTP co
ntrol endpoint | flush cache、abort request�
��update weights、LoRA load/unload 等控制
面命令。 |
| `TokenizerManagerScoreMixin`
 | `managers/tokenizer_manager_score_mixin.py
` | tokenizer、scheduler IPC | score / reran
k serving | 支持 score、classify、rerank 
等非普通生成请求。 |
| `TemplateMana
ger` | `managers/template_manager.py` | token
izer、chat template | OpenAI chat serving | 
把 messages 组织成模型可接受的 prom
pt/chat template。 |
| HF / tiktoken tokeniz
er | `utils/hf_transformers/tokenizer.py`、`
tokenizer/tiktoken_tokenizer.py` | 模型 tok
enizer 文件 | `TokenizerManager`、`Detoken
izerManager` | encode prompt、decode token i
ds、处理 special token。 |
| `Detokenizer
Manager` | `managers/detokenizer_manager.py` 
/ `DetokenizerManager` | tokenizer、输出 I
PC | Scheduler output streamer | 把增量 to
ken ids 解码成文本，处理 stream chunk
、finish reason、skip special tokens。 |


### 3. Scheduler 与 batch 对象

| 类 / �
�象 | 位置 | 依赖 | 被谁调用 | 核�
�职责 |
|---|---|---|---|---|
| `Scheduler`
 | `managers/scheduler.py` / `Scheduler` | to
kenizer、tree cache、worker、request recei
ver、result processor | Scheduler event loop
 | SGLang runtime 的调度核心，维护 wa
iting/running batch，决定 prefill/decode�
�chunked prefill、evict、flush、abort、Lo
RA 混批等策略。 |
| `SchedulerRequestRe
ceiver` | `scheduler_components/request_recei
ver.py` | IPC sockets | `Scheduler.event_loop
_*()` | 从 tokenizer 进程接收 tokenized 
请求或控制命令。 |
| `SchedulerBatchR
esultProcessor` | `scheduler_components/batch
_result_processor.py` | `Req`、`ScheduleBatc
h`、spec info | `Scheduler.process_batch_res
ult()` | 消费 worker 返回的 `GenerationB
atchResult`，更新请求状态、接受/拒
绝 spec token、判断 finish、准备输出
。 |
| `SchedulerOutputStreamer` | `schedule
r_components/output_streamer.py` | detokenize
r IPC、request state | `Scheduler` | 把 tok
en ids、logprobs、finish 状态发往 detok
enizer 或 HTTP stream。 |
| `SchedulerLogpr
obResultProcessor` | `scheduler_components/lo
gprob_result_processor.py` | logits/logprob �
��出 | `SchedulerBatchResultProcessor` | 处
理 prefill logprob、top logprobs、normaliz
ed prompt logprob 等 logprob 结果。 |
| `
SchedulerDPAttnAdapter` | `scheduler_componen
ts/dp_attn.py` | DP group、global batch stat
e | `Scheduler` | DP attention 场景下协�
�各 DP rank 的 batch 与负载信息。 |
|
 `SchedulerWeightUpdaterManager` | `scheduler
_components/weight_updater.py` | worker contr
ol path | `Scheduler` | 调度在线权重更
新、同步多个 worker 的更新状态。 
|
| `Req` | `managers/schedule_batch.py` / `R
eq` | tokenized request、prefix cache result
、sampling params | `Scheduler`、`ScheduleB
atch` | 单个请求在调度层的运行时�
��态：input ids、output ids、prefix indic
es、extend len、finish status、stream 状�
��。 |
| `ScheduleBatch` | `managers/schedul
e_batch.py` / `ScheduleBatch` | 多个 `Req`�
��memory pool、sampling info | `Scheduler`�
�`TpModelWorker` | 一次即将送入模型�
� batch。它负责 prepare_for_extend/decode
、分配 KV cache、构造 sampling batch in
fo。 |
| `SamplingBatchInfo` | `sampling/sam
pling_batch_info.py` | 多个 `Req.sampling_p
arams` | `ScheduleBatch`、`ModelRunner.sampl
e()` | 把 temperature、top_p、top_k、gram
mar、logit bias 等采样配置整理成 bat
ch tensor。 |

### 4. Cache / Memory 对象


| 类 / 对象 | 位置 | 依赖 | 被谁调
用 | 核心职责 |
|---|---|---|---|---|
| 
`BasePrefixCache` | `mem_cache/base_prefix_ca
che.py` | token ids、request metadata | `Sch
edulePolicy`、`Scheduler` | prefix cache 抽
象接口，提供 match/insert/evict/cache_u
nfinished_req 等能力。 |
| `RadixCache` |
 `mem_cache/radix_cache.py` / `RadixCache` | 
radix tree、KV indices | `SchedulePolicy.mat
ch_prefix_for_req()` | 默认 prefix cache，
通过 radix tree 复用相同 prompt 前缀�
�� KV cache。 |
| `UnifiedRadixCache` | `mem
_cache/unified_radix_cache.py` | 多 cache po
ol | `create_tree_cache()` | 统一管理不�
��层或不同 cache 类型的 radix cache。
 |
| `SWARadixCache` | `mem_cache/swa_radix_c
ache.py` | sliding-window attention 配置 | 
hybrid/SWA 模型调度 | sliding-window atte
ntion 模型使用的 prefix cache 变体。 
|
| `HiRadixCache` / `HiCacheStorage` | `mem_
cache/hiradix_cache.py`、`mem_cache/hicache_
storage.py` | host/storage KV cache | Schedul
er cache path | 分层 KV cache，把部分 K
V 从 GPU 扩展到 host 或外部 storage。
 |
| `ReqToTokenPool` | `mem_cache/memory_poo
l.py` / `ReqToTokenPool` | request pool size�
��context len | `ScheduleBatch`、`ModelRunne
rKVCacheMixin` | 保存 request index 到 tok
en/KV slot 的映射，是 continuous batchin
g 的核心索引表。 |
| `KVCache` | `mem_
cache/memory_pool.py` / `KVCache` | GPU/host 
memory | attention layer、ModelRunner | KV c
ache 抽象基类。具体子类适配 MHA、
MLA、SWA、DSA、Mamba、FP4/FP8 等结构�
� |
| `MHATokenToKVPool` | `mem_cache/memory_
pool.py` | layer/head/page 配置 | attention
 backend | 标准 MHA/GQA 模型的 KV cache 
pool。 |
| `MLATokenToKVPool` | `mem_cache/m
emory_pool.py` | MLA latent KV 配置 | MLA a
ttention backend | DeepSeek MLA 等模型使�
��的 KV cache pool。 |
| `BaseTokenToKVPool
Allocator` | `mem_cache/allocator/base.py` | 
KV pool | `ScheduleBatch.prepare_for_*()` | �
��配和释放 token 对应的 KV cache slot�
�� |
| `TokenToKVPoolAllocator` / `PagedToken
ToKVPoolAllocator` | `mem_cache/allocator/tok
en.py`、`allocator/paged.py` | KV pool free 
list/page table | Scheduler/Batch | 普通或
 paged 形式的 KV slot 分配器。 |
| `Mo
delRunnerKVCacheMixin` | `model_executor/mode
l_runner_kv_cache_mixin.py` | model config、
server args、GPU memory | `ModelRunner.initi
alize()` | 为 `ModelRunner` 提供 `init_mem
ory_pool()` 等 KV cache 初始化能力。 |


### 5. Worker 与模型执行对象

| 类 
/ 对象 | 位置 | 依赖 | 被谁调用 | �
��心职责 |
|---|---|---|---|---|
| `BaseTp
Worker` | `managers/tp_worker.py` / `BaseTpWo
rker` | `ModelRunner` | `Scheduler` | worker 
抽象接口，暴露 forward、embedding、L
oRA、权重更新、memory pool 等能力。
 |
| `TpModelWorker` | `managers/tp_worker.py
` / `TpModelWorker` | `ModelConfig`、`ModelR
unner`、tokenizer、PP/TP group | `Scheduler
` | TP rank 上的模型 worker。把 `Schedu
leBatch` 转成 `ForwardBatch`，调用 `Mode
lRunner.forward()`，在 PP 最后一级采�
�。 |
| `ModelConfig` | `configs/model_confi
g.py` / `ModelConfig` | HF config、server ar
gs | `TpModelWorker`、`ModelRunner` | 统一
模型结构信息，例如 dtype、context l
en、is_generation、is_multimodal、hidden s
ize、vocab size。 |
| `ModelRunner` | `mode
l_executor/model_runner.py` / `ModelRunner` |
 model、KV pool、attention backend、sample
r、graph runner | `TpModelWorker` | 模型�
�行核心，负责分布式初始化、模�
�加载、KV cache、attention metadata、for
ward dispatch、sampling。 |
| `ForwardBatch
` | `model_executor/forward_batch_info.py` / 
`ForwardBatch` | `ScheduleBatch`、`ModelRunn
er`、KV pool | `ModelRunner.forward()` | 模
型层 batch 输入，包含 input ids、posi
tions、seq lens、cache loc、sampling info�
��spec info、PP proxy 等。 |
| `ForwardCon
text` | `model_executor/forward_batch_info.py
` | attention backend | model layers | forwar
d 期间的上下文对象，让模型层 att
ention 能读取当前 backend 和 metadata�
� |
| `PPProxyTensors` | `model_executor/forw
ard_batch_info.py` | hidden states | PP rank 
之间 | Pipeline parallel 中间 rank 传递
 hidden states 和其他代理张量。 |
| `
ModelRunnerOutput` | `model_executor/model_ru
nner.py` | logits 或 PP proxy | `TpModelWork
er` | `ModelRunner.forward()` 的返回结构
，携带 logits、graph 可用性、spec/deb
ug/metrics 输出。 |

### 6. Kernel、Logit
s 与采样对象

| 类 / 对象 | 位置 | 
依赖 | 被谁调用 | 核心职责 |
|---|-
--|---|---|---|
| `AttentionBackend` 系列 |
 `layers/attention/*` | KV pool、ForwardBatc
h metadata | `ModelRunner.forward_decode/exte
nd()` | 为 prefill/decode attention kernel �
��备 metadata，并执行具体 attention ke
rnel。 |
| `CudaGraphRunner` / `CPUGraphRunn
er` / `NPUGraphRunner` | `model_executor/cuda
_graph_runner.py` 等 | `ModelRunner`、固�
� shape buffer | `ModelRunner._forward_raw()`
 | 捕获并 replay 固定形状 decode graph
，减少 launch overhead。 |
| `PiecewiseCu
daGraphRunner` | `model_executor/piecewise_cu
da_graph.py` | 模型 layers、attention/MoE 
层 | `ModelRunner.forward_extend()` | 捕获
局部算子/层级 graph，覆盖比整图�
�动态的场景。 |
| `LogitsProcessor` | `
layers/logits_processor.py` / `LogitsProcesso
r` | model hidden states、lm_head、metadata
 | model forward | 把 hidden states 转成 l
ogits，并按需要输出 next token logits�
��input token logprobs 等。 |
| `LogitsProc
essorOutput` | `layers/logits_processor.py` |
 logits tensor | `ModelRunner.sample()` | 承
载 next-token logits、input-token logprobs�
��hidden states 等输出。 |
| `Sampler` | 
`layers/sampler.py` / `Sampler` | logits、`S
amplingBatchInfo` | `ModelRunner.sample()` | 
执行 temperature、top-p、top-k、min-p、
grammar mask 等采样逻辑。 |
| `Sampling
Params` | `sampling/sampling_params.py` | 用
户请求 | `Req`、`SamplingBatchInfo` | 单
请求采样参数，包含 max_new_tokens、
temperature、stop、top_p、logprob 等。 |

| `LoRAManager` | `lora/lora_manager.py` / `
LoRAManager` | base model、LoRA weights | `M
odelRunner`、Scheduler control path | 动态
加载/卸载 LoRA adapter，并在 batch for
ward 前准备对应 LoRA 权重。 |

### 7.
 特性支线对象

| 特性 | 关键类 / �
��象 | 位置 | 如何插入主链路 |
|---
|---|---|---|
| Speculative decoding | `Specu
lativeAlgorithm`、`EagleWorker`、`EagleWork
erV2`、`NGramWorker`、`EagleVerifyInput` | 
`speculative/*` | Scheduler 生成 draft/veri
fy batch；`TpModelWorker` 可能持有 draft
 runner；`ForwardBatch.spec_info` 告诉 `Mo
delRunner` 当前是 draft 还是 verify。 |

| dLLM | `SchedulerDllmMixin`、`DllmManager
`、`DllmConfig` | `dllm/*` | Scheduler 和 `
TpModelWorker.forward_batch_generation()` 分
流到 diffusion-style 生成，不走普通 
next-token loop。 |
| PD disaggregation | `S
chedulerDisaggregationPrefillMixin`、`Schedu
lerDisaggregationDecodeMixin`、`CommonKVSend
er`、`CommonKVReceiver`、`MooncakeKVManager
` / `NixlKVManager` | `disaggregation/*` | pr
efill worker 计算 KV 后通过 KV transfer 
发送给 decode worker，Scheduler 的 batch
 生命周期被拆成两个部署角色。 |

| DP attention | `SchedulerDPAttnAdapter` | 
`scheduler_components/dp_attn.py` | Scheduler
 在 DP rank 间同步 batch 和负载，`For
wardBatch` 中带 global token 信息。 |
| 
Pipeline parallel | `SchedulerPPMixin`、`PPP
roxyTensors` | `managers/scheduler_pp_mixin.p
y`、`forward_batch_info.py` | `TpModelWorker
` 非最后 PP rank 返回 hidden states prox
y，最后一级才得到 logits 并采样。
 |
| HiCache | `HiRadixCache`、`HiCacheStora
ge`、hybrid cache controller | `mem_cache/*h
icache*` | `RadixCache` 的扩展路径；KV 
cache 可以在 GPU、host、storage 间 load
/evict。 |
| LoRA | `LoRAManager`、LoRA lay
ers | `lora/*` | Scheduler 控制 adapter 加
载；`ModelRunner` 在 forward 前准备 LoR
A batch。 |
| Structured output | grammar ba
ckend、grammar matcher | `constrained/*`、`
sampling/*` | TokenizerManager 编译 grammar
；Sampler 根据 grammar mask 限制可采�
� token。 |

## 依赖关系速读

### 运�
��时对象依赖树

```mermaid
flowchart TD

  ServerArgs["ServerArgs"] --> TokenizerMana
ger
  ServerArgs --> Scheduler
  ServerArgs -
-> TpWorker
  ServerArgs --> ModelRunner

  T
okenizerManager --> Tokenizer["Tokenizer"]
  
TokenizerManager --> Processor["Processor"]
 
 TokenizerManager --> TemplateManager

  Sche
duler --> TreeCache["Radix/Prefix Cache"]
  S
cheduler --> RequestReceiver["SchedulerReques
tReceiver"]
  Scheduler --> OutputStreamer["S
chedulerOutputStreamer"]
  Scheduler --> TpWo
rker
  Scheduler --> Req
  Scheduler --> Sche
duleBatch

  TpWorker --> ModelConfig
  TpWor
ker --> ModelRunner
  TpWorker --> Tokenizer


  ModelRunner --> ModelConfig
  ModelRunner 
--> Model["Loaded nn.Module"]
  ModelRunner -
-> MemoryPools["ReqToTokenPool + KVPool + All
ocator"]
  ModelRunner --> AttentionBackend
 
 ModelRunner --> Sampler
  ModelRunner --> Gr
aphRunner
  ModelRunner --> LoRAManager

  Sc
heduleBatch --> SamplingBatchInfo
  ScheduleB
atch --> MemoryPools
  ScheduleBatch --> Forw
ardBatch
  ForwardBatch --> ModelRunner
```


### 数据对象转换链

```mermaid
flowcha
rt LR
  RawHTTP["HTTP JSON / Python API input
"] --> GenerateReqInput
  GenerateReqInput --
> TokenizerManager
  TokenizerManager --> Tok
enizedGenerateReqInput
  TokenizedGenerateReq
Input --> Req
  Req --> ScheduleBatch
  Sched
uleBatch --> ForwardBatch
  ForwardBatch --> 
ModelRunnerOutput
  ModelRunnerOutput --> Gen
erationBatchResult
  GenerationBatchResult --
> BatchResultProcessor
  BatchResultProcessor
 --> StreamOutput["token ids / logprobs / fin
ish reason"]
  StreamOutput --> DetokenizerMa
nager
  DetokenizerManager --> TextChunk["tex
t delta / final text"]
```

### “持有关�
��”与“调用关系”的区别

| 关系
 | 例子 | 怎么理解 |
|---|---|---|
| �
�有 | `TpModelWorker` 持有 `ModelRunner` |
 生命周期绑定，worker 初始化时创�
�� runner，后续请求复用。 |
| 持有 
| `ModelRunner` 持有 `Sampler`、`Attention
Backend`、KV pools | 这些是模型执行�
�源，初始化昂贵，请求之间复用�
� |
| 持有 | `Scheduler` 持有 `tree_cache
`、`waiting_queue`、`running_batch` | 调�
�状态必须跨 event loop tick 保留。 |

| 转换 | `GenerateReqInput -> TokenizedGene
rateReqInput -> Req -> ScheduleBatch -> Forwa
rdBatch` | 同一个用户请求在不同层�
��不同表示。 |
| 调用 | `Scheduler -> 
TpModelWorker.forward_batch_generation()` | S
cheduler 决定跑哪个 batch，worker 负�
�实际送入模型。 |
| 调用 | `TpModelW
orker -> ModelRunner.forward()` | worker 处�
�� TP/PP/spec 分支，runner 处理模型执
行分支。 |
| 调用 | `ModelRunner -> Sam
pler` | logits 已经算出后，采样器把
它变成 next token。 |
| 回传 | `Schedul
erBatchResultProcessor -> SchedulerOutputStre
amer -> DetokenizerManager` | 生成结果从
模型侧回到用户可读文本。 |

## �
�次普通生成请求的完整流程图

```
mermaid
sequenceDiagram
  participant U as Us
er / Client
  participant API as OpenAI Servi
ng / Engine
  participant TM as TokenizerMana
ger
  participant SCH as Scheduler
  particip
ant TC as RadixCache / KV Pools
  participant
 W as TpModelWorker
  participant MR as Model
Runner
  participant M as Model + AttentionBa
ckend
  participant S as Sampler
  participan
t DT as DetokenizerManager

  U->>API: HTTP J
SON 或 Python API 调用
  API->>API: 解析
 messages / tools / response_format / samplin
g params
  API->>TM: GenerateReqInput
  TM->>
TM: apply chat template / tokenize / multimod
al process / grammar init
  TM->>SCH: Tokeniz
edGenerateReqInput 或 BatchTokenizedGenerate
ReqInput
  SCH->>SCH: 创建 Req，进入 wai
ting queue
  SCH->>TC: match_prefix_for_req�
�查询可复用 prefix KV
  TC-->>SCH: prefi
x_indices / cache hit 信息
  SCH->>SCH: get
_next_batch_to_run，选择 prefill 或 decod
e
  SCH->>SCH: ScheduleBatch.prepare_for_exte
nd/decode
  SCH->>TC: 分配 req pool index �
�� KV cache slot
  SCH->>W: forward_batch_gen
eration(ScheduleBatch)
  W->>MR: ForwardBatch
.init_new(...)
  W->>MR: ModelRunner.forward(
ForwardBatch)
  MR->>MR: _forward_raw，判�
� graph replay / decode / extend / split pref
ill
  MR->>M: model.forward(input_ids, positi
ons, forward_batch)
  M->>M: attention backen
d 使用 KV cache metadata 执行 attention
 
 M-->>MR: LogitsProcessorOutput
  MR->>S: sam
ple(logits_output, sampling_info)
  S-->>MR: 
next_token_ids
  MR-->>W: ModelRunnerOutput
 
 W-->>SCH: GenerationBatchResult
  SCH->>SCH:
 SchedulerBatchResultProcessor 更新 Req / f
inish / logprob / spec 状态
  SCH->>DT: tok
en ids + request state
  DT->>DT: decode toke
n ids，拼接增量文本
  DT-->>API: text 
delta / final output
  API-->>U: stream chunk
 或完整 response
```

## Prefill 与 Decod
e 中类关系的差异

```mermaid
flowchart
 TB
  subgraph Prefill["Prefill / Extend"]
  
  PReq["Req.extend_input_len > 0"]
    PMatch
["RadixCache.match_prefix"]
    PBatch["Sched
uleBatch.prepare_for_extend"]
    PKV["分配
多个 token 的 KV slot"]
    PForward["Forw
ardBatch.forward_mode = EXTEND"]
    PAttn["p
refill attention metadata"]
    PModel["Model
Runner.forward_extend"]
  end

  subgraph Dec
ode["Decode"]
    DReq["Req 仍未 finished"]

    DBatch["ScheduleBatch.prepare_for_decode
"]
    DKV["为每个请求分配 1 个新 to
ken KV slot"]
    DForward["ForwardBatch.forw
ard_mode = DECODE"]
    DGraph["可选 CudaGr
aphRunner.replay"]
    DAttn["decode attentio
n metadata"]
    DModel["ModelRunner.forward_
decode"]
  end

  PReq --> PMatch --> PBatch 
--> PKV --> PForward --> PAttn --> PModel
  D
Req --> DBatch --> DKV --> DForward --> DGrap
h --> DAttn --> DModel
```

区别可以压�
�成一句话：prefill 主要处理“很多
 prompt token 怎么写入 KV cache”，deco
de 主要处理“每个活跃请求再追加
 1 个 token，如何低延迟循环”。

#
# 按源码阅读的推荐路径

如果你�
�按类关系逐步读源码，建议顺序�
�下：

1. `TokenizerManager.generate_reques
t()`、`_prepare_tokenizer_input()`、`_batch
_tokenize_and_process()`：理解请求如何
进入 runtime。
2. `Scheduler.event_loop_no
rmal()`、`get_next_batch_to_run()`、`get_ne
w_batch_prefill()`、`update_running_batch()`
：理解调度循环。
3. `Req` 与 `Schedu
leBatch.prepare_for_extend()` / `prepare_for_
decode()`：理解 batch 状态如何形成�
�
4. `RadixCache.match_prefix()`、`ReqToToke
nPool`、`BaseTokenToKVPoolAllocator.alloc()`
：理解 prefix cache 与 KV slot 分配。

5. `TpModelWorker.forward_batch_generation()`
：理解 Scheduler 到 ModelRunner 的边界
。
6. `ForwardBatch.init_new()`：理解模�
��执行层需要哪些张量和 metadata。

7. `ModelRunner.forward()`、`_forward_raw()`
、`forward_extend()`、`forward_decode()`：
理解模型执行分发。
8. `ModelRunner.i
nit_attention_backend()` 与具体 attention 
backend 的 `init_forward_metadata()`：理�
� attention kernel 的输入准备。
9. `Log
itsProcessorOutput`、`ModelRunner.sample()`�
��`Sampler.forward()`：理解 logits 到 tok
en 的过程。
10. `SchedulerBatchResultProc
essor` 与 `DetokenizerManager`：理解 toke
n 如何回到用户。

## 特性源码定�
�表

| 特性 | 解决的问题 | 具体源�
��定位 | 第一遍怎么读 |
|---|---|---|
---|
| Continuous batching | 动态维护 `ru
nning_batch`，让新请求可插入 prefill 
| `python/sglang/srt/managers/scheduler.py` /
 `Scheduler.get_next_batch_to_run()`；`Sched
uler.get_new_batch_prefill()`；`Scheduler.up
date_running_batch()`；`python/sglang/srt/ma
nagers/schedule_batch.py` / `ScheduleBatch.pr
epare_for_extend()`、`prepare_for_decode()` 
| 不能跳过，这是 Scheduler 骨架。 |

| Chunked prefill | 长 prompt 分块，降�
��一次性 KV 和 GPU 时间峰值 | `python
/sglang/srt/server_args.py` / `ServerArgs` �
� `chunked_prefill_size`、`enable_dynamic_ch
unking` 字段；`python/sglang/srt/managers/
scheduler.py` / `Scheduler.init_chunked_prefi
ll()`、`Scheduler._get_new_batch_prefill_raw
()`；`python/sglang/srt/managers/schedule_ba
tch.py` / `Req.set_extend_input_len()`、`Sch
eduleBatch.prepare_for_extend()` | 先知道�
��会改变 `extend_input_len` 和 prefill ba
tch 形态。 |
| Radix cache | 复用相同 
prompt prefix 的 KV cache | `python/sglang/s
rt/mem_cache/registry.py` / `create_tree_cach
e()`、`default_radix_cache_factory()`；`pyt
hon/sglang/srt/mem_cache/radix_cache.py` / `R
adixCache.match_prefix()`、`insert()`、`cac
he_unfinished_req()`；`python/sglang/srt/man
agers/schedule_policy.py` / `match_prefix_for
_req()` | 不能完全跳过，至少理解 `
prefix_indices`。 |
| HiCache | 把 KV cache
 扩展到 host/storage 层级 | `python/sgla
ng/srt/server_args.py` / `enable_hierarchical
_cache`、`hicache_*` 字段；`python/sglang
/srt/mem_cache/registry.py` / `default_radix_
cache_factory()`；`python/sglang/srt/mem_cac
he/hiradix_cache.py` / `HiRadixCache` 相关 
match/load-back 方法；`python/sglang/srt/m
em_cache/hybrid_cache/hybrid_cache_controller
.py` / hybrid cache controller 的 load/evict
 方法 | 可以先当成增强版 `tree_cach
e`。 |
| PD disaggregation | Prefill 和 dec
ode 分离部署，中间传 KV | `python/sgl
ang/srt/disaggregation/utils.py` / `Disaggreg
ationMode`；`python/sglang/srt/server_args.p
y` / `disaggregation_mode`、`bootstrap_*` �
�段；`python/sglang/srt/disaggregation/pref
ill.py` / prefill worker 处理入口；`pyth
on/sglang/srt/disaggregation/decode.py` / dec
ode worker 处理入口；`python/sglang/srt/
disaggregation/common/conn.py` 和 `base/conn
.py` / KV transfer connection 抽象 | 非分
布式阅读可先跳过。 |
| dLLM | 支持
 diffusion-style LLM，不按普通 next-toke
n loop 生成 | `python/sglang/srt/dllm/confi
g.py` / `DllmConfig`；`python/sglang/srt/dll
m/mixin/scheduler.py` / dLLM scheduler mixin 
的 batch 构造和结果处理；`python/sgl
ang/srt/models/sdar.py` / `SDARForCausalLM`�
�`SDARMoeForCausalLM`；`python/sglang/srt/ma
nagers/scheduler.py` / `dllm_config` 分支 |
 普通 LLM 主线先跳过。 |
| Speculativ
e decoding | draft 模型先猜 token，targe
t 模型验证 | `python/sglang/srt/speculati
ve/spec_info.py` / `SpeculativeAlgorithm`、s
pec info classes；`python/sglang/srt/specula
tive/eagle_worker.py` / EAGLE worker；`pytho
n/sglang/srt/speculative/eagle_worker_v2.py` 
/ v2 worker；`python/sglang/srt/speculative/
ngram_worker.py` / N-gram draft；`python/sgl
ang/srt/managers/scheduler_components/batch_r
esult_processor.py` / spec result acceptance 
逻辑 | 读普通生成时沿 `spec_algorith
m.is_none()` 分支走。 |
| Overlap schedul
e | CPU 调度/结果处理和 GPU forward �
�水重叠 | `python/sglang/srt/server_args.p
y` / `disable_overlap_schedule`、`enable_two
_batch_overlap` 字段；`python/sglang/srt/m
anagers/scheduler.py` / `Scheduler.init_overl
ap()`、`event_loop_overlap()`、`record_batc
h_in_overlap()`；`python/sglang/srt/model_ex
ecutor/model_runner.py` / `ModelRunner.update
_decode_attn_backend()` | 先读 `event_loop_
normal()`，再回来读 overlap。 |
| CUDA 
graph | 复用固定形状 GPU 执行图，�
�低 launch overhead | `python/sglang/srt/ser
ver_args.py` / `cuda_graph_max_bs` 等字段�
��`python/sglang/srt/model_executor/model_run
ner.py` / `ModelRunner.init_device_graphs()`�
��`init_piecewise_cuda_graphs()`、`_forward_
raw()` 中 `graph_runner.replay` 分支 | 可
以先跳过，保留“decode 优化路径�
�的印象。 |
| Structured output / Grammar
 | JSON schema、regex、EBNF 等约束输出
 | `python/sglang/srt/server_args.py` / `gram
mar_backend` 字段；`python/sglang/srt/cons
trained/xgrammar_backend.py` / `XGrammarGramm
arBackend` 的 compile/mask 逻辑；`python/
sglang/srt/entrypoints/openai/protocol.py` / 
request 的 `response_format` 字段；`pytho
n/sglang/srt/sampling` / sampler 应用 gramm
ar mask 的代码段 | 读 chat conversion �
�会遇到，可以先理解为“采样前 m
ask 词表”。 |
| Reasoning parser | 分�
� reasoning 内容和最终答案 | `python/s
glang/srt/server_args.py` / `reasoning_parser
` 字段；`python/sglang/srt/entrypoints/ope
nai/serving_chat.py` / `_get_reasoning_from_r
equest()`、`_process_reasoning_stream()`；`
python/sglang/srt/parser/reasoning_parser.py`
 / reasoning parser 基类和实现 | 普通�
��本生成可先跳过。 |
| Function calli
ng | 将模型输出解析成工具调用 | `
python/sglang/srt/entrypoints/openai/serving_
chat.py` / `_process_messages()`、`_process_
tool_calls()`、`_process_tool_call_stream()`
；`python/sglang/srt/function_call/function_
call_parser.py` / parser 入口；`python/sgl
ang/srt/function_call/*_detector.py` / 各模
型 tool call detector | 读 `/v1/chat/comple
tions` 时常见。 |
| LoRA | 同一个 base
 model 上动态加载 adapter | `python/sgla
ng/srt/server_args.py` / `enable_lora`、`lor
a_*` 字段；`python/sglang/srt/lora/lora_ma
nager.py` / LoRA manager；`python/sglang/srt
/entrypoints/openai/serving_base.py` / `_reso
lve_lora_path()`；`python/sglang/srt/manager
s/scheduler.py` / `_can_schedule_lora_req()`�
��`load_lora_adapter()`、`unload_lora_adapte
r()` | 先理解为调度时多了 adapter �
�批约束。 |
| Multimodal | 支持图片�
�视频、音频输入 | `python/sglang/srt/e
ntrypoints/openai/serving_chat.py` / `_proces
s_messages()`、`_encode_messages()`；`pytho
n/sglang/srt/managers/tokenizer_manager.py` /
 `_prepare_tokenizer_input()`、`_batch_token
ize_and_process()`；`python/sglang/srt/manag
ers/schedule_batch.py` / `MultimodalInputs`�
�`MultimodalDataItem` | 纯文本主线可沿
非 multimodal 分支走。 |
| Tensor parall
el | 单层矩阵计算切到多卡 | `python
/sglang/srt/managers/tp_worker.py` / `TpModel
Worker.__init__()`、`_init_model_runner()`�
�`forward_batch_generation()`；`python/sglan
g/srt/model_executor/model_runner.py` / `Mode
lRunner.init_torch_distributed()` | 单卡阅
读时只需知道 worker 边界。 |
| Pipel
ine parallel | 不同层放在不同 GPU/节�
��形成流水 | `python/sglang/srt/managers/
scheduler_pp_mixin.py` / PP mixin 中 microba
tch 调度方法；`python/sglang/srt/model_e
xecutor/model_runner.py` / PP 相关 forward 
分支；`python/sglang/srt/model_executor/fo
rward_batch_info.py` / `PPProxyTensors` | 可
以跳过，除非专门读多卡。 |
| DP a
ttention | Data parallel 下的 attention 同
步和路由 | `python/sglang/srt/server_args
.py` / `enable_dp_attention` 字段；`python
/sglang/srt/managers/scheduler_components/dp_
attn.py` / DP attention adapter；`python/sgl
ang/srt/managers/scheduler.py` / `init_dp_att
n_adapter()` | 可以跳过。 |
| Expert par
allel / EPLB | MoE expert 分布与负载均�
�� | `python/sglang/srt/server_args.py` / exp
ert parallel 与 EPLB 字段；`python/sglang
/srt/eplb` / expert load balance controller�
�`python/sglang/srt/layers/moe` / MoE layer �
�� runner；`python/sglang/srt/model_executor
/model_runner.py` / `update_expert_location()
` | 读 dense LLM 时跳过。 |
| Quantizati
on 与 kernel backend | 选择量化、attent
ion backend、sampling backend、MoE backend 
| `python/sglang/srt/server_args.py` / `quant
ization`、`kv_cache_dtype`、`attention_back
end` 字段；`python/sglang/srt/model_execut
or/model_runner.py` / `configure_kv_cache_dty
pe()`、`init_attention_backend()`、`_get_at
tention_backend_from_str()`；`python/sglang/
srt/layers/quantization` / quant method class
es；`python/sglang/srt/layers/attention` / b
ackend classes | 性能专题再读。 |
| Em
bedding / scoring / rerank | 非生成式请�
��，不走完整 decode loop | `python/sglan
g/srt/entrypoints/openai/serving_embedding.py
` / embedding serving handler；`python/sglan
g/srt/entrypoints/openai/serving_score.py` / 
score handler；`python/sglang/srt/entrypoint
s/openai/serving_rerank.py` / rerank handler�
��`python/sglang/srt/managers/scheduler.py` /
 `handle_embedding_request()`、`handle_batch
_embedding_request()` | 只研究 chat comple
tion 时先关注 `GenerateReqInput`。 |

##
 常见分支速查表

| 代码标志 | 大�
��含义 | 第一遍读主线怎么处理 |
|
---|---|---|
| `self.dllm_config is not None`
 | Diffusion LLM 特殊路径 | 跳过，走�
��通 LLM 分支 |
| `disaggregation_mode != 
NULL` | Prefill/Decode 分离部署 | 跳过�
��走 unified 模式 |
| `not spec_algorithm.
is_none()` | Speculative decoding | 跳过，
走 non-spec 分支 |
| `enable_hierarchical_
cache` | HiCache 分层缓存 | 当成增强�
�� radix cache |
| `disable_radix_cache` | �
�闭 prefix cache | 理解为不复用前缀 
|
| `chunked_req is not None` | 长 prompt �
�切块 | 先理解为 prefill 没做完 |
| 
`enable_overlap` | CPU/GPU 流水重叠 | 先
读 non-overlap 分支 |
| `can_run_cuda_grap
h` | 可复用 CUDA graph | 先读普通 forw
ard |
| `enable_lora` | adapter serving | 先
理解为调度多一个约束 |
| `req.gramm
ar is not None` | 结构化输出约束 | 先
理解为采样前 mask 词表 |
| `model_con
fig.is_multimodal` | 多模态模型 | 纯文
本阅读时跳过 |
| `is_generation` | 生�
�� vs embedding/scoring | chat completion 走
生成分支 |

## 推荐阅读策略

```mer
maid
flowchart TD
  A["遇到一个 if 分支
"] --> B{"它影响主请求生命周期吗?"
}
  B -->|"是"| C["读到对象如何变化"
]
  B -->|"否"| D["标记为特性支线"]
 
 C --> E{"它改变 ScheduleBatch / Req / KV 
cache 吗?"}
  E -->|"是"| F["认真读"]
  
E -->|"否"| G["先略读"]
  D --> H["回到
主线"]
```

建议顺序：

1. 先读普�
�文本生成、非 spec、非 disagg、非 d
LLM、非 LoRA、非 multimodal。
2. 第二�
��读 Scheduler 和 KV cache。
3. 第三遍�
��逐个打开特性支线。

## 后续专�
�建议

1. KV cache / Radix cache / HiCache�
��
2. Speculative decoding。
3. PD disaggreg
ation。
4. LoRA serving。
5. Structured out
put 与 function calling。
6. dLLM。

这�
�顺序比较自然：先掌握普通 LLM ser
ving，再看性能优化，最后看特殊�
�型和特殊部署。


