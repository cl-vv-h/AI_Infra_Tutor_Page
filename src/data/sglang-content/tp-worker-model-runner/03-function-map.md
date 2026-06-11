# 函数与代码段定位

本文件把 `tp_
worker.py` 与 `model_runner.py` 的关键函
数按阅读目的分组。建议先看函数
职责，再打开注释版源码逐段阅读
。

## tp_worker.py

| 代码位置 | 作用
 | 阅读重点 |
| --- | --- | --- |
| `Base
TpWorker` | TP worker 抽象基类 | 它定�
� Scheduler 期望 worker 暴露哪些能力�
��例如生成、embedding、权重更新、L
oRA、memory pool |
| `BaseTpWorker.model_run
ner` | 抽象属性 | 子类必须提供底�
� `ModelRunner` |
| `BaseTpWorker.get_memory_
pool()` | 读取 KV cache/request pool | Sche
duler 可以通过 worker 获取内存池状�
�� |
| `BaseTpWorker.update_weights*()` | 权
重更新委托 | 实际更新逻辑在 `Mode
lRunner` 中 |
| `BaseTpWorker.update_lora_*(
)` | LoRA 更新委托 | worker 只做入口�
��发 |
| `BaseTpWorker.forward_batch_embeddi
ng()` | embedding 模型执行入口 | embedd
ing 路径不做 token sampling |
| `TpModelW
orker.__init__()` | worker 主初始化 | 读
取 rank/device/server args，创建 `ModelCo
nfig`、`ModelRunner`、tokenizer、PP/world 
group |
| `TpModelWorker._init_model_config()
` | 模型配置初始化 | draft worker 使�
�� `speculative_draft_model_path`，target wo
rker 使用主模型路径 |
| `TpModelWorker
._init_model_runner()` | 创建 `ModelRunner`
 | 把 rank、TP/PP/DP 参数、内存池、�
��型配置传入执行层 |
| `TpModelWorker
._init_multi_layer_eagle_model_runners()` | m
ulti-layer EAGLE 初始化 | speculative deco
ding 中一个 worker 可持有多个 draft r
unner |
| `TpModelWorker._init_dllm_algorithm
()` | dLLM 初始化 | diffusion/denoising LL
M 走专用算法对象 |
| `TpModelWorker.ge
t_worker_info()` | 汇报 worker 能力 | Sch
eduler 用它理解 worker 的容量和配置
 |
| `TpModelWorker.forward_batch_generation(
)` | 生成主入口 | 最重要函数：`Sch
eduleBatch -> ForwardBatch -> ModelRunner.for
ward -> sample/result` |
| `TpModelWorker.for
ward_batch_split_prefill()` | split prefill �
��口 | 长 prefill 被拆成多个 forward �
��段 |

## model_runner.py：顶层工具与
结构

| 代码位置 | 作用 | 阅读重�
� |
| --- | --- | --- |
| `add_mla_attention_
backend()` | 动态注册 MLA attention backe
nd | MLA 模型会改写 attention backend �
�择 |
| `add_chunked_prefix_cache_attention_
backend()` | 动态注册 chunked prefix cach
e backend | 让 prefix cache 与 attention ba
ckend 适配 |
| `resolve_language_model()` |
 找到真正的语言模型主体 | 不同�
�型 wrapper 的层级不同，需要统一�
�位 `.layers` |
| `RankZeroFilter` | 日志�
��滤 | 避免多 rank 重复输出 |
| `Mode
lRunnerOutput` | forward 统一返回结构 |
 承载 logits、hidden states、spec 信息�
�� debug/metrics 输出 |
| `ModelRunner` | �
��型执行核心类 | 后续所有初始化�
��forward、sampling 都围绕它展开 |

##
 model_runner.py：初始化链路

| 代码�
��置 | 作用 | 阅读重点 |
| --- | --- |
 --- |
| `ModelRunner.__init__()` | 入口初
始化 | 保存参数，设置 rank/device/sp
ec/parallel 状态，调用分布式初始化
和主体初始化 |
| `ModelRunner.initializ
e()` | 主初始化编排 | 加载模型、�
�备 MoE、KV cache、attention backend、war
mup、graph capture |
| `ModelRunner.init_tor
ch_distributed()` | 分布式初始化 | 建�
�� TP/PP/DP/EP/attention DP/CP 通信组 |
| 
`ModelRunner.load_model()` | 模型加载 | �
��建 `LoadConfig`、调用 loader、设置 d
type/滑窗/量化/远端权重逻辑 |
| `Mo
delRunner._prepare_moe_topk()` | MoE top-k �
�备 | 兼容不同 MoE runner 的路由逻�
� |
| `ModelRunner.configure_kv_cache_dtype()
` | KV cache dtype 决策 | `auto`、FP8、BF
16、FP4 等分支都在这里处理 |
| `Mod
elRunner.init_attention_backend()` | attentio
n backend 初始化 | 普通、Hybrid、PDMux
、Two Batch Overlap 都从这里分叉 |
| `
ModelRunner._get_attention_backend()` | 解�
� prefill/decode backend | prefill 与 decode
 可使用不同 backend，并组合为 Hybri
d |
| `ModelRunner._get_attention_backend_fro
m_str()` | backend 实例化 | 从 `ATTENTION
_BACKENDS` 表中创建具体 backend |
| `Mo
delRunner.kernel_warmup()` | kernel 预热 | 
在 CUDA graph capture 前进行 autotune/war
mup |
| `ModelRunner._dummy_run()` | 假 batc
h warmup | 为 autotune 和 graph capture 构
造可执行的 `ForwardBatch` |
| `ModelRunn
er.init_device_graphs()` | 捕获设备 graph
 | decode graph 主要在这里创建 |
| `Mo
delRunner.init_piecewise_cuda_graphs()` | 捕
获 piecewise graph | 对 attention/MoE 层�
�更细粒度的图优化 |

## model_runner.
py：forward 执行链路

| 代码位置 | �
��用 | 阅读重点 |
| --- | --- | --- |
| 
`ModelRunner.forward()` | 对外统一 forwar
d 入口 | 包裹 profiling、canary、EPLB�
�错误恢复和 `_forward_raw()` |
| `ModelR
unner._forward_raw()` | forward 分发核心 
| 根据 `ForwardMode` 选择 decode、extend
、split prefill、idle，并优先尝试 gra
ph replay |
| `ModelRunner.forward_decode()` 
| decode 前向 | 初始化 decode attention 
metadata，调用 `model.forward()` |
| `Mode
lRunner.forward_extend()` | extend/prefill �
�向 | 处理 input embeds、PP proxy、piece
wise graph 和 prefill metadata |
| `ModelRun
ner.forward_split_prefill()` | split prefill 
前向 | 维护 split index，调用模型的
 `forward_split_prefill()` |
| `ModelRunner.f
orward_idle()` | idle 前向 | DP attention �
��场景下让空闲 rank 仍然参与同步 
|

## model_runner.py：采样与 logprob

| 
代码位置 | 作用 | 阅读重点 |
| --- 
| --- | --- |
| `ModelRunner._preprocess_logi
ts()` | logits 预处理 | grammar、bias、s
oftcap、logprob 等采样前处理 |
| `Mode
lRunner.sample()` | token 采样 | 根据 log
its 和 sampling_info 生成 next token |
| `
ModelRunner.compute_logprobs_only()` | 仅计
算 logprob | 用于 return_logprob 或 prefi
ll-only 路径 |
| `ModelRunner.maybe_init_ng
ram_embedding()` | ngram embedding 初始化 
| 建立 token table 与模块 buffer |
| `Mo
delRunner.maybe_update_ngram_token_table()` |
 更新 ngram token table | sampling 后把�
� token 写回 ngram 状态 |

## 两个文�
�的关键衔接点

| 衔接点 | 上游 | �
��游 | 含义 |
| --- | --- | --- | --- |
| 
`ForwardBatch.init_new(batch, model_runner)` 
| `TpModelWorker.forward_batch_generation()` 
| `ModelRunner.forward()` | 请求从调度�
�象变成模型执行对象 |
| `model_runne
r.forward(forward_batch)` | `TpModelWorker` |
 `ModelRunner._forward_raw()` | worker 进入
模型执行核心 |
| `model_runner.sample(l
ogits_output, forward_batch)` | PP 最后一�
��的 `TpModelWorker` | `Sampler` | logits �
�成 next token |
| `pp_hidden_states_proxy_t
ensors` | PP 非最后一级 `ModelRunner` | 
下一个 PP rank | pipeline parallel 中间�
��只传 hidden states |
| `get_memory_pool()
` | Scheduler/Worker | `ModelRunnerKVCacheMix
in` | 调度层可感知 KV cache 容量 |


