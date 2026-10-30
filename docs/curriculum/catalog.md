# 课程内容映射表

> 生成自人工分类规则与固定 Git 对象。用途为课程规划，本文件不驱动网站。

教程基线：`19be702f0842301583b6d84a98c9e42a9f9b35e5`；网站对照基线：`668f9cd1867d9d6e3f27f8e97861af042d184caa`；盘点日期：2026-10-30。

182 项材料（含目录、代码、图表及维护资料），47 个主题，16 项明确列出的计划文件。所有条目仅确认源码存在；没有在本轮执行设备实验。

平台列表示材料涉及的平台或示例依赖，不表示组合兼容或部署支持。先修关系是编辑建议；原文固定版本链接只做提取，需逐篇确认其适用范围。现有站内链接按原值保留，未生成未来链接。

## 四条学习路线

### 理解大模型推理

入口要求：能阅读基础 Python 和矩阵维度；不要求设备环境。

目标：解释一次请求的计算、状态与主要开销。

1. [Inference Basics](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Inference_Basics/README.md)：区分 Prefill、Decode 与自回归循环。
2. [Decoder-only Transformer：从 Token 到下一个 Token](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/01-decoder-only-transformer.md)：识别 Decoder 的计算模块。
3. [Grouped-Query Attention：QKV、RoPE 与 KV Cache 的形状流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/02-gqa-attention-shapes.md)：追踪 Q/K/V 与缓存形状。
4. [KV Cache Memory](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/KV_Cache_Memory/README.md)：解释缓存容量、分页与复用。
5. [Benchmark Profiling](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Benchmark_Profiling/README.md)：先建立 TTFT / ITL / TPS 指标语言。
6. [Schedule Optimization 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Schedule_Optimization/README.md)：理解 Batching 与调度权衡。
7. [第 1 讲：一次 ChatCompletion 请求的完整生命周期](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/01-entry-routing/01-request-lifecycle.md)：把模型计算放回一次请求。

按需选读：

- [Prefill / Decode 调度实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Schedule_Optimization/prefill_decode_demo.py)：观察简化调度过程。

### 阅读和修改 SGLang

入口要求：完成推理基础路线；能阅读 Python 类和函数调用。

目标：从问题定位组件、状态和代码入口。

1. [SGLang 公共组件全景与 Code Walkthrough](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/00-overview/01-public-components-code-walkthrough.md)：先识别公共组件。
2. [第 1 讲：一次 ChatCompletion 请求的完整生命周期](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/01-entry-routing/01-request-lifecycle.md)：跟随请求主链路。
3. [Scheduler 架构总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/01-architecture.md)：理解调度器职责与状态。
4. [Scheduler 流程图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/02-flowcharts.md)：区分启动、调度和执行流程。
5. [架构总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/01-architecture.md)：区分 Worker 与 ModelRunner。
6. [第 6 讲：ModelRunner 如何识别并加载不同模型](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/06-model-loading-and-architecture-resolution.md)：追踪模型类解析与权重加载。
7. [第 4 讲：ModelRunner 与 Attention Backend](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/04-model-execution/04-model-runner-attention.md)：追踪 Backend 与 ForwardBatch。
8. [第 3 讲：KV Cache、Radix Cache 与 HiCache](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/03-cache-memory/03-kv-cache-radix-cache.md)：定位缓存分配与复用。

按需选读：

- [Scheduler 函数地图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/04-function-map.md)：按问题查函数。
- [第 5 讲：Speculative Decoding](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/06-advanced-features/05-speculative-decoding.md)：按需进入高级特性。

### 部署与性能优化（Ascend 实践分支）

入口要求：掌握推理基础；设备实验需另行准备匹配版本的 Ascend 环境。

目标：用可比较实验解释收益、精度变化和平台限制。

1. [00. Ascend NPU 背景知识](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/00-background.md)：理解平台栈与边界。
2. [03. 隔离环境启动与最小 Serving 跑通](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/03-launch-and-minimal-serving.md)：按环境完成最小服务验收。
3. [Benchmark Profiling](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Benchmark_Profiling/README.md)：定义指标与工作负载。
4. [14. SGLang Ascend NPU 性能测试](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/14-performance-testing.md)：记录 Baseline 与实验条件。
5. [12. SGLang-NPU Profiling 详细教学](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/12-npu-profiling-guide.md)：定位调度、计算、访存和通信瓶颈。
6. [11. SGLang NPU 推理优化工作地图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/11-performance-optimization-work-map.md)：由证据选择一个优化方向。
7. [15. SGLang Ascend NPU 精度测试与问题定位](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/15-accuracy-testing-and-debugging.md)：复验精度并二分定位异常。

按需选读：

- [Parallel Strategy 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/README.md)：多卡方向。
- [Quantization](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/README.md)：量化方向。
- [Execution Graph](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Execution_Graph/README.md)：Graph 方向。
- [KV Transfer](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/KV_Transfer/README.md)：PD 方向。

### Ascend 算子开发

入口要求：能读 Python/C++ 与基本张量运算；理论阅读不要求设备，运行需 CANN/NPU。

目标：追踪 Host / Device 契约，并设计正确性与性能验证。

1. [第一讲：五个关键对象如何组成 Ascend NPU 推理与算子栈](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/01-stack-and-relationships.md)：分清软件栈职责。
2. [第二讲：CANN 全栈与边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/02-cann-stack-and-boundaries.md)：定位 CANN 与运行时边界。
3. [基础 01：从一个公式到并行 Kernel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/01-kernel-first-principles.md)：掌握 Grid、Tile、Host / Device。
4. [基础 02：Ascend NPU、AI Core 与存储层级](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/02-ascend-hardware.md)：理解硬件与存储层级。
5. [基础 03：搬运、计算、同步与流水](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/03-memory-pipeline-and-sync.md)：理解搬运、计算与同步。
6. [代码阅读手册：变量类型、形状、地址与源码实现](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/reference/code-reading-and-types.md)：查阅类型与地址单位（作为工具书，按例子查阅）。
7. [sgl-kernel-npu 01：仓库结构与算子生命周期](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/01-repository-and-op-lifecycle.md)：定位算子工程的入口与生命周期。

**Triton-Ascend 分支**

- [Triton-Ascend 01：Program、Grid、Tile 与第一个 Kernel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/01-program-grid-tile.md)：编写 Grid / Tile。
- [Triton-Ascend 02：地址、广播、归约与矩阵分块](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/02-tensor-addressing-reduction-matmul.md)：理解地址、归约和矩阵乘。
- [Triton-Ascend 03：编译、调试与性能优化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/03-compile-debug-optimize.md)：学习编译、调试与验证。
- [torch_npu 01：Dispatcher、ACLNN 与 Custom Op 的边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md)：定位注册与调用边界。
- [sgl-kernel-npu 02：Triton 源码精读——Fused Split Q/K Norm](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/02-triton-fused-split-qk-norm.md)：阅读真实融合算子。

**Ascend C 分支**

- [Ascend C 01：Global/Local Tensor、TPipe 与 TQue](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/01-global-local-tensor-pipe-queue.md)：学习 Tensor、Pipe 与 Queue。
- [Ascend C 02：一个 Add 算子的端到端工程](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/02-add-operator-end-to-end.md)：串起最小算子端到端链路。
- [Ascend C 03：Tiling、流水、同步与性能优化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/03-tiling-pipeline-sync-optimization.md)：分析 Tiling 与流水。
- [torch_npu 01：Dispatcher、ACLNN 与 Custom Op 的边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md)：定位注册与调用边界。
- [sgl-kernel-npu 03：Ascend C 源码精读——Apply Token Bitmask](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/03-ascend-c-apply-token-bitmask.md)：阅读真实约束采样算子。

## 推理基础

### 课程总览

建议先修：无专题前置要求。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [AI Infra 基础专题](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/README.md) | 目录 / 总览 / 入门 | general | en / zh | 未建文章索引；en:内容不同，待对照 / zh:内容不同，待对照 | 修正示例路径 |
| ↳ 运行示例中的 learning/ai-infra-basic 路径缺少 zh/；本轮仅记录，不修改原文。 | | | | | |
| [SGLang 教学目录](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/README.md) | 目录 / 总览 / 入门 | general | en / zh | 未建文章索引；en:一致 / zh:一致 | 保留并归类 |

### Prefill、Decode 与生成流程

建议先修：无专题前置要求。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Inference Basics](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Inference_Basics/README.md) | 正文 / 原理 / 入门 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--inference-basics--readme)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

## 模型架构与状态机制

### Decoder-only Transformer

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Decoder-only Transformer：从 Token 到下一个 Token](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/01-decoder-only-transformer.md) | 正文 / 原理 / 入门 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--01-decoder-only-transformer)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### MHA / MQA / GQA / MLA

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Grouped-Query Attention：QKV、RoPE 与 KV Cache 的形状流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/02-gqa-attention-shapes.md) | 正文 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Multi-head Latent Attention：低秩压缩与解耦位置编码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/04-multi-head-latent-attention.md) | 正文 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--04-multi-head-latent-attention)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [高效 Attention 全景：压缩、稀疏、递归与 Kernel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/06-efficient-attention-landscape.md) | 正文 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--06-efficient-attention-landscape)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### DSA、CSA/HCA 与稀疏检索

建议先修：MHA / MQA / GQA / MLA。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [DeepSeek Sparse Attention：在 MLA Cache 上学习检索](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/07-deepseek-sparse-attention.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--07-deepseek-sparse-attention)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [压缩稀疏注意力（CSA）与重度压缩注意力（HCA）](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/08-compressed-sparse-attention.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--08-compressed-sparse-attention)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Gated DeltaNet

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [01. GDN 数学原理：Gated Delta Rule 与状态矩阵](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Gated_Delta_Network/01-gdn-math-and-state.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--gated-delta-network--01-gdn-math-and-state)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [02. GDN 层内数据流与 shape](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Gated_Delta_Network/02-gdn-layer-dataflow-and-shapes.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--gated-delta-network--02-gdn-layer-dataflow-and-shapes)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [03. GDN 的训练、Prefill、Decode 与 Serving 状态管理](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Gated_Delta_Network/03-gdn-training-and-serving.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--gated-delta-network--03-gdn-training-and-serving)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Gated Delta Network](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Gated_Delta_Network/README.md) | 目录 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--gated-delta-network--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Kimi Delta Attention

建议先修：Gated DeltaNet。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Kimi Delta Attention（KDA）：线性注意力的细粒度门控](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/09-kimi-delta-attention.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--09-kimi-delta-attention)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Mamba 与状态空间模型

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Mamba 原理详解：从 SSM 到 Mamba2 Forward](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Mamba_State_Space/02-mamba-principles.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--mamba-state-space--02-mamba-principles)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Mamba / State Space Model 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Mamba_State_Space/README.md) | 目录 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--mamba-state-space--readme)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### MoE 专家选择与计算

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Sparse MoE：Router、Top-K、Expert 与数据重排](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/03-sparse-moe-routing.md) | 正文 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--03-sparse-moe-routing)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### mHC 与残差结构

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [mHC 原理：从普通残差连接到受约束的多路信息流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/10-manifold-constrained-hyper-connections.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [mHC 数学原理实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/mhc_principles_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |

### 模型架构谱系与多模态

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [主流大模型架构谱系：哪些模块发生了变化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/05-architecture-families.md) | 正文 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--05-architecture-families)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [主流大模型架构与实现原理](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Model_Architecture/README.md) | 目录 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--model-architecture--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### GLM-4.7-Flash 综合案例

建议先修：MHA / MQA / GQA / MLA；MoE 专家选择与计算；Worker、ModelRunner 与 ForwardBatch；KV Pool、分页、Prefix Cache 与 HiCache。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [端到端样例：GLM-4.7-Flash 在 SGLang Ascend NPU 中的完整执行路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/00-glm-4.7-flash-end-to-end.md) | 模型案例 / 综合案例 / 深入 | general, ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--examples--00-glm-4-7-flash-end-to-end)；en:内容不同，待对照 / zh:内容不同，待对照 | 按学习目标拆章 |

### Qwen3.5 Hybrid 综合案例

建议先修：Gated DeltaNet；Worker、ModelRunner 与 ForwardBatch；KV Pool、分页、Prefix Cache 与 HiCache。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [端到端样例：Qwen3.5 Hybrid 在 SGLang Ascend NPU 中的完整执行路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/01-qwen3.5-hybrid-end-to-end.md) | 模型案例 / 综合案例 / 深入 | general, ascend | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--examples--01-qwen3-5-hybrid-end-to-end)；zh:内容不同，待对照 | 待补英文 |

### GLM-5.2 综合案例

建议先修：DSA、CSA/HCA 与稀疏检索；MoE 专家选择与计算；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [端到端样例：GLM-5.2 在 SGLang Ascend NPU 中的完整执行路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/02-glm-5.2-end-to-end.md) | 模型案例 / 综合案例 / 深入 | general, ascend | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |

### GLM-5.3-Flash 综合案例

建议先修：Kimi Delta Attention；DSA、CSA/HCA 与稀疏检索；mHC 与残差结构；MoE 专家选择与计算；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [GLM-5.3-Flash — 完整模型架构](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/01-model-overview.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [GLM-5.3-Flash — Decoder层内结构](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/02-decoder-layer.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [GLM-5.3-Flash — KDA层内部结构](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/03-kda-internals.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [GLM-5.3-Flash — DSA、KPool与NoPE MLA](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/04-dsa-mla-internals.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [GLM-5.3-Flash — Dense FFN与MoE内部结构](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/05-ffn-moe-internals.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [GLM-5.3-Flash — 视觉编码器与层内结构](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/06-vision-internals.html) | 图表资源 / 交互图 / 深入 | browser | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [Third-party notices](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/licenses/THIRD_PARTY_NOTICES.md) | 许可证 / 参考 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| ↳ 保留许可证，不生成独立课程入口。 | | | | | |
| [GLM-5.3-Flash 架构图资源](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/assets/glm-5.3-flash/architecture/README.md) | 资源索引 / 参考 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [端到端样例：GLM-5.3-Flash 的 Hybrid KDA、NoPE 稀疏 MLA、mHC 与多模态执行链](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/03-glm-5.3-flash-end-to-end.md) | 模型案例 / 综合案例 / 深入 | general, ascend | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| ↳ 正文区分仓内旧快照与固定上游模型实现；CPU 数学验证不等于整模型 GPU/NPU 实测。 | | | | | |
| [GLM-5.3-Flash CPU Shape 自检](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/glm53_flash_shape_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |

## Serving 运行时与缓存管理

### 源码阅读方法与组件地图

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [00. 源码阅读方法与 Ascend 分支搜索法](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/00-reading-method-and-branch-search.md) | 参考资料 / 参考 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--00-reading-method-and-branch-search)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [SGLang 特性地图：读源码前先认识这些分支](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/00-overview/00-feature-map.md) | 正文 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--00-overview--00-feature-map)；en:一致 / zh:一致 | 保留并归类 |
| [SGLang 公共组件全景与 Code Walkthrough](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/00-overview/01-public-components-code-walkthrough.md) | 正文 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--00-overview--01-public-components-code-walkthrough)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [SGLang 源码阅读笔记](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/README.md) | 目录 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### 请求生命周期与进程入口

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [03. 请求主链路中的 NPU 接入点](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/03-request-lifecycle-npu-branch-points.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--03-request-lifecycle-npu-branch-points)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [第 1 讲：一次 ChatCompletion 请求的完整生命周期](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/01-entry-routing/01-request-lifecycle.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--01-entry-routing--01-request-lifecycle)；en:一致 / zh:一致 | 保留并归类 |

### 调度、Batching 与 Overlap

建议先修：请求生命周期与进程入口。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Chunked Prefill 模拟实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Schedule_Optimization/chunked_prefill_with_fakeLLM_tutorial.py) | 实验代码 / 实验 / 入门 | python | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--schedule-optimization--chunked-prefill-with-fakellm-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [Prefill / Decode 调度实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Schedule_Optimization/prefill_decode_demo.py) | 实验代码 / 实验 / 入门 | python | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--schedule-optimization--prefill-decode-demo)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [Schedule Optimization 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Schedule_Optimization/README.md) | 目录 / 原理 / 入门 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--schedule-optimization--readme)；en:一致 / zh:一致 | 保留并归类 |
| [Scheduler 架构总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/01-architecture.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--01-architecture)；en:一致 / zh:一致 | 保留并归类 |
| [Scheduler 流程图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/02-flowcharts.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--02-flowcharts)；en:一致 / zh:一致 | 保留并归类 |
| [Scheduler 教学版代码导读](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/03-annotated-code-walkthrough.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--03-annotated-code-walkthrough)；en:一致 / zh:一致 | 保留并归类 |
| [Scheduler 函数地图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/04-function-map.md) | 参考资料 / 参考 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--04-function-map)；en:一致 / zh:一致 | 保留并归类 |
| [Scheduler 中文注释源码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/05-scheduler-annotated-cn.py) | 注释源码 / 参考 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--05-scheduler-annotated-cn)；en:一致 / zh:一致 | 保留并归类 |
| ↳ 英文目录中的该文件仍是中文注释源码；语言文件存在不代表正文已翻译。 | | | | | |
| [Scheduler 架构专题](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/scheduler-architecture/README.md) | 目录 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/scheduler-architecture--readme)；en:一致 / zh:一致 | 保留并归类 |
| [第 2 讲：Scheduler 调度核心](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/02-scheduler-runtime/02-scheduler-core.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--02-scheduler-runtime--02-scheduler-core)；en:一致 / zh:一致 | 保留并归类 |

### Worker、ModelRunner 与 ForwardBatch

建议先修：调度、Batching 与 Overlap；Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [05. ModelRunner、ForwardBatch 与设备输入缓冲区](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/05-model-runner-forward-batch-and-input-buffers.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--05-model-runner-forward-batch-and-input-buffers)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [第 4 讲：ModelRunner 与 Attention Backend](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/04-model-execution/04-model-runner-attention.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--04-model-execution--04-model-runner-attention)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [架构总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/01-architecture.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--01-architecture)；en:一致 / zh:一致 | 保留并归类 |
| [详细流程图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/02-flowcharts.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--02-flowcharts)；en:一致 / zh:一致 | 保留并归类 |
| [函数与代码段定位](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/03-function-map.md) | 参考资料 / 参考 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--03-function-map)；en:一致 / zh:一致 | 保留并归类 |
| [TpModelWorker 中文注释源码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/04-tp-worker-annotated-cn.py) | 注释源码 / 参考 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--04-tp-worker-annotated-cn)；en:一致 / zh:一致 | 保留并归类 |
| ↳ 英文目录中的该文件仍是中文注释源码；语言文件存在不代表正文已翻译。 | | | | | |
| [ModelRunner 中文注释源码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/05-model-runner-annotated-cn.py) | 注释源码 / 参考 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--05-model-runner-annotated-cn)；en:一致 / zh:一致 | 保留并归类 |
| ↳ 英文目录中的该文件仍是中文注释源码；语言文件存在不代表正文已翻译。 | | | | | |
| [TP Worker 与 ModelRunner 教学目录](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/README.md) | 目录 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--readme)；en:一致 / zh:一致 | 保留并归类 |

### 模型注册、权重加载与布局

建议先修：Decoder-only Transformer；源码阅读方法与组件地图。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [04. 模型加载、权重放置与 dtype/layout](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/04-model-loading-dtype-and-layout.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--04-model-loading-dtype-and-layout)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [第 6 讲：ModelRunner 如何识别并加载不同模型](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/tp-worker-model-runner/06-model-loading-and-architecture-resolution.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/tp-worker-model-runner--06-model-loading-and-architecture-resolution)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### KV Pool、分页、Prefix Cache 与 HiCache

建议先修：MHA / MQA / GQA / MLA。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [KV Cache Memory](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/KV_Cache_Memory/README.md) | 正文 / 原理 / 入门 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--kv-cache-memory--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [05. Ascend Attention、KV Cache 与 HiCache](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/05-attention-kv-cache.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--05-attention-kv-cache)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [第 3 讲：KV Cache、Radix Cache 与 HiCache](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/03-cache-memory/03-kv-cache-radix-cache.md) | 正文 / 运行时 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--03-cache-memory--03-kv-cache-radix-cache)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Recurrent / Hybrid State 生命周期

建议先修：KV Pool、分页、Prefix Cache 与 HiCache；Mamba 与状态空间模型。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Mamba 是什么：从 State Space Model 到 SGLang Mamba State](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Mamba_State_Space/01-mamba-and-sglang-state.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--mamba-state-space--01-mamba-and-sglang-state)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Mamba 和 Radix Cache：状态复用、代码依赖与执行流程](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Mamba_State_Space/03-mamba-radix-cache.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--mamba-state-space--03-mamba-radix-cache)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### 服务路由与 Worker 管理

建议先修：请求生命周期与进程入口。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [第 9 讲：SGLang Router 架构与源码解析](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/01-entry-routing/09-router.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--01-entry-routing--09-router)；en:内容不同，待对照 / zh:内容不同，待对照 | 分开服务路由与专家路由；按学习目标拆章 |
| ↳ 服务 Router 与 MoE Router 分开归类；迁移前保留全文和原锚点。 | | | | | |
| [第 10 讲：sgl-router 源码深潜](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/01-entry-routing/10-sgl-router-source-deep-dive.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--01-entry-routing--10-sgl-router-source-deep-dive)；en:内容不同，待对照 / zh:内容不同，待对照 | 按学习目标拆章 |

## 分布式并行与通信

### 通信原语、链路与通信库

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [01. 通信原语、张量布局与成本模型](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/01-communication-primitives-and-costs.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [02. 链路、RDMA、注册内存与完成语义](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/02-links-rdma-and-memory.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [03. Gloo、NCCL、RCCL、HCCL 与 ProcessGroup](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/03-collective-libraries-gloo-nccl-hccl.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [06. 从 SGLang 调用路径到通信性能排查](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/06-sglang-paths-and-performance.md) | 正文 / 运行时 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [通信原语语义实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/communication_semantics_demo.py) | 实验代码 / 实验 / 进阶 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [AI Infra 通信：从张量语义到 GPU/NPU 数据路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/README.md) | 目录 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |

### TP / PP / DP / EP 与 Rank 拓扑

建议先修：Decoder-only Transformer；通信原语、链路与通信库。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [00. 并行策略地图：先看切分对象，再看执行阶段](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/00-parallelism-map-and-version-boundaries.md) | 正文 / 总览 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [06. 组合并行：rank 网格、阶段交接与不同布局](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/06-parallel-topology-and-pd-composition.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [07. Encoder DP 与弹性 EP：模块并行和运行时重配置](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/07-encoder-dp-and-elastic-ep.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [DP 推理教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/dp_inference_demo.py) | 实验代码 / 实验 / 进阶 | pytorch, distributed | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--dp-inference-demo)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [组合并行数学等价性实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/parallelism_math_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [PP 推理教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/pp_inference_demo.py) | 实验代码 / 实验 / 进阶 | pytorch, distributed | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--pp-inference-demo)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [Parallel Strategy 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/README.md) | 目录 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [TP 推理教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/tp_inference_demo.py) | 实验代码 / 实验 / 进阶 | pytorch, distributed | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--tp-inference-demo)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [大模型推理并行策略基础：DP / TP / PP / EP 与 CP 数学示例](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/tutorial.md) | 正文 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--tutorial)；en:内容不同，待对照 / zh:内容不同，待对照 | 按学习目标拆章 |
| [07. 分布式、HCCL 与 Tensor Parallel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/07-distributed-hccl-tp.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--07-distributed-hccl-tp)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [第 6 讲：多进程 / 多卡 / 分布式执行](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/02-scheduler-runtime/06-multiprocess-distributed.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--02-scheduler-runtime--06-multiprocess-distributed)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [TP、DP、EP 如何真正完成切分：从 rank 拓扑到 Ascend NPU 执行](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/05-layer-communication/02-tp-dp-ep-sharding-and-ascend-npu.md) | 正文 / 运行时 / 深入 | general, ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--05-layer-communication--02-tp-dp-ep-sharding-and-ascend-npu)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Attention DP 与层边界通信

建议先修：TP / PP / DP / EP 与 Rank 拓扑；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [DP Attention：请求并行、Attention 子组与 FFN/MoE 的布局切换](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/01-dp-attention-principles.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [DP Attention 布局与去重实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/dp_attention_layout_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [第十五讲：LayerCommunicator、HCCL 与层边界通信](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/15-distributed-hccl-and-communication.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--15-distributed-hccl-and-communication)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Layer 层、LayerCommunicator 与通用算子源码导读](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/05-layer-communication/01-layer-communicator-and-common-layers.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--05-layer-communication--01-layer-communicator-and-common-layers)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [SGLang DP Attention 源码走读：从请求分发到下一层与 logits](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/05-layer-communication/03-dp-attention-code-walkthrough.md) | 正文 / 运行时 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |

### SP、Prefill CP 与 Decode CP

建议先修：TP / PP / DP / EP 与 Rank 拓扑；KV Pool、分页、Prefix Cache 与 HiCache。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [02. 从零理解 SP：切哪些数据、怎样计算，以及它与 CP 的区别](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/02-sp-versus-context-parallelism.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [03. PCP：把长 prompt 的 query 工作分给多张卡](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/03-prefill-context-parallelism.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [04. DCP：分历史 KV，用正确的 softmax 合并局部答案](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/04-decode-context-parallelism.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [DCP 缓存地址映射实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/dcp_cache_address_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [PCP Query 行分配与因果关系实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/pcp_query_rows_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [CP 分布式 Softmax 实验（历史文件名含 SP）](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/sp_inference_demo.py) | 实验代码 / 实验 / 深入 | pytorch, distributed | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--sp-inference-demo)；en:内容不同，待对照 / zh:内容不同，待对照 | 核对实验依赖、命令与预期输出 |
| ↳ 内容是 CP 分布式 softmax，不能按历史文件名误归为 LayerNorm SP。 | | | | | |
| [TP + SP 的逐步数值实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/sp_step_by_step_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |
| [SGLang PCP 源码走读：从参数到 query 分片、KV 交换与输出恢复](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/05-layer-communication/04-prefill-context-parallel-code-walkthrough.md) | 正文 / 运行时 / 深入 | general, ascend | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [PCP CPU 布局追踪实验](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/05-layer-communication/pcp_layout_trace_demo.py) | 实验代码 / 实验 / 深入 | cpu | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 核对实验依赖、命令与预期输出 |

### MoE Dispatch / Combine、DeepEP 与 DWDP

建议先修：TP / PP / DP / EP 与 Rank 拓扑；MoE 专家选择与计算。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [04. MoE token 通信：DeepEP 与 SGLang NPU 的 ZBAL](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/04-moe-deepep-and-zbal.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [07. ZBAL 的 zero buffer：从分配器、远端地址到 MoE 数据流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/07-zbal-zero-buffer-source-dataflow.md) | 正文 / 运行时 / 深入 | ascend | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [05. DWDP：让权重来找 token，而不是每层都搬 token](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/05-dwdp-weight-parallelism.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [EP 专家分发与合并教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/ep_moe_demo.py) | 实验代码 / 实验 / 进阶 | pytorch, distributed | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--parallel-strategy--ep-moe-demo)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |

### PD 分离与 KV Transfer

建议先修：TP / PP / DP / EP 与 Rank 拓扑；KV Pool、分页、Prefix Cache 与 HiCache。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [05. PD/KV 传输：Mooncake、NIXL 与 Ascend TransferEngine](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Communication/05-kv-transfer-mooncake-and-nixl.md) | 正文 / 原理 / 进阶 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [KV Transfer](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/KV_Transfer/README.md) | 正文 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--kv-transfer--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [08. Ascend PD Disaggregation 与 KV Transfer](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/08-ascend-pd-disaggregation.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--08-ascend-pd-disaggregation)；en:一致 / zh:一致 | 保留并归类 |
| [第 7 讲：Disaggregation / PD 分离](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/06-advanced-features/07-disaggregation-pd.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--06-advanced-features--07-disaggregation-pd)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Diffusion 并行扩展

建议先修：TP / PP / DP / EP 与 Rank 拓扑。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [08. Diffusion 并行：CFG、Ulysses、Ring 和 KV-gather](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Parallel_Strategy/08-diffusion-parallelism.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |

## 推理加速与高效服务

### FlashAttention、FlashDecoding 与 Online Softmax

建议先修：MHA / MQA / GQA / MLA。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [FlashAttention 教学实现](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Attention_Kernel/flash_attention_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--attention-kernel--flash-attention-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [FlashDecoding 教学实现](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Attention_Kernel/flash_decoding_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--attention-kernel--flash-decoding-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [Attention Kernel 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Attention_Kernel/README.md) | 目录 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--attention-kernel--readme)；en:一致 / zh:一致 | 保留并归类 |

### 执行图、Capture / Replay 与编译

建议先修：Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [什么是 Graph：从计算图到 SGLang CUDA Graph](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Execution_Graph/01-what-is-graph.md) | 正文 / 原理 / 进阶 | general, cuda, ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--execution-graph--01-what-is-graph)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Graph 执行原理：调度、数据与流转](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Execution_Graph/02-graph-execution-dataflow.md) | 正文 / 运行时 / 深入 | general, cuda, ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--execution-graph--02-graph-execution-dataflow)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Execution Graph](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Execution_Graph/README.md) | 目录 / 原理 / 进阶 | general, cuda, ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--execution-graph--readme)；en:一致 / zh:一致 | 保留并归类 |
| [torch_npu 02：Stream、Event、异步生命周期与计算图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/torch_npu/02-stream-events-and-graph-capture.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--torch-npu--02-stream-events-and-graph-capture)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 同主题内先读 Execution_Graph/01-what-is-graph.md，再进入 Stream/Event 与设备内存生命周期。 | | | | | |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；Worker、ModelRunner 与 ForwardBatch | | | | | |
| [06. NPU Graph 与 Piecewise Compilation](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/06-npu-graph-compilation.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--06-npu-graph-compilation)；en:一致 / zh:一致 | 保留并归类 |
| [05：计算图、torch.compile 与 SGLang NPU Graph 源码全链路](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/05-npu-graph-and-compilation.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--05-npu-graph-and-compilation)；en:内容不同，待对照 / zh:内容不同，待对照 | 按学习目标拆章 |

### 量化数学、格式、算法与 Serving

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [01. 量化基础：从浮点数到低 bit 表示](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/01-quantization-foundations.md) | 正文 / 原理 / 进阶 | general | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--01-quantization-foundations)；zh:内容不同，待对照 | 待补英文 |
| [02. 位宽记号、FP8/MXFP8 与 packed W4](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/02-bitwidth-formats-and-packing.md) | 正文 / 原理 / 进阶 | general | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--02-bitwidth-formats-and-packing)；zh:内容不同，待对照 | 待补英文 |
| [03. 权重量化算法：从 RTN 到 GPTQ、AWQ、AutoRound、HQQ、NF4](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/03-weight-quantization-algorithms.md) | 正文 / 原理 / 进阶 | general | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--03-weight-quantization-algorithms)；zh:内容不同，待对照 | 待补英文 |
| [04. Activation、KV Cache、FP8 与 MXFP8 量化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/04-activation-kv-fp8-quantization.md) | 正文 / 原理 / 进阶 | general | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--04-activation-kv-fp8-quantization)；zh:内容不同，待对照 | 待补英文 |
| [05. Serving 中的量化数据流、kernel 与排障](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/05-serving-kernel-and-debugging.md) | 正文 / 运行时 / 深入 | general | zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--05-serving-kernel-and-debugging)；zh:内容不同，待对照 | 待补英文 |
| [Quantization](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/README.md) | 目录 / 原理 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--quantization--readme)；en:一致 / zh:一致 | 保留并归类 |

### 投机采样、验证与状态提交

建议先修：Prefill、Decode 与生成流程；KV Pool、分页、Prefix Cache 与 HiCache。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [01. 投机解码的基本原理](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/01-speculative-decoding-principles.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--speculative-decoding--01-speculative-decoding-principles)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [02. 投机采样的数学原理](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/02-rejection-sampling-math.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--speculative-decoding--02-rejection-sampling-math)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [03. Serving 系统中的实现与数据流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/03-serving-implementation-dataflow.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--speculative-decoding--03-serving-implementation-dataflow)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [04. 投机推理算法谱系](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/04-algorithm-landscape.md) | 正文 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--speculative-decoding--04-algorithm-landscape)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Speculative Decoding / Speculative Inference 教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/README.md) | 目录 / 原理 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--speculative-decoding--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [第 5 讲：Speculative Decoding](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/06-advanced-features/05-speculative-decoding.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--06-advanced-features--05-speculative-decoding)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### DSpark 与半自回归执行

建议先修：投机采样、验证与状态提交；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [05. DSpark 原理：半自回归草稿、置信度调度与硬件感知验证](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Speculative_Decoding/05-dspark-principles.md) | 正文 / 原理 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |
| [SGLang DSpark 端到端源码走读](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/06-advanced-features/09-dspark-code-walkthrough.md) | 正文 / 运行时 / 深入 | general | en / zh | 未建文章索引；en:未收录 / zh:未收录 | 保留并归类 |

### LoRA 原理与多 Adapter Serving

建议先修：Decoder-only Transformer。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [AdaLoRA 教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/LoRA/adalora_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--lora--adalora-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [DoRA 教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/LoRA/dora_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--lora--dora-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [LoRA 教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/LoRA/lora_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--lora--lora-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [QLoRA 教学代码](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/LoRA/qlora_tutorial.py) | 实验代码 / 实验 / 进阶 | pytorch | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--lora--qlora-tutorial)；en:一致 / zh:一致 | 核对实验依赖、命令与预期输出 |
| [LoRA 系列教学入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/LoRA/README.md) | 目录 / 总览 / 进阶 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--lora--readme)；en:内容不同，待对照 / zh:一致 | 保留并归类 |
| [第 8 讲：LoRA Serving / Adapter 热加载](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-source-reading/06-advanced-features/08-lora-serving.md) | 正文 / 运行时 / 深入 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-source-reading--06-advanced-features--08-lora-serving)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

## 性能评测、Profiling 与正确性

### 指标、Baseline 与 Workload

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Benchmark Profiling](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Benchmark_Profiling/README.md) | 正文 / 原理 / 入门 | general | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ai-infra-basic--benchmark-profiling--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [10. Benchmark、Profiling 与排错](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/10-benchmark-debugging.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--10-benchmark-debugging)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [14. SGLang Ascend NPU 性能测试](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/14-performance-testing.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--14-performance-testing)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### Trace、瓶颈归因与实验验证

建议先修：指标、Baseline 与 Workload；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [11. SGLang NPU 推理优化工作地图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/11-performance-optimization-work-map.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--11-performance-optimization-work-map)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [12. SGLang-NPU Profiling 详细教学](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/12-npu-profiling-guide.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--12-npu-profiling-guide)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### Reference、精度评测与二分定位

建议先修：指标、Baseline 与 Workload；模型注册、权重加载与布局。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [15. SGLang Ascend NPU 精度测试与问题定位](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/15-accuracy-testing-and-debugging.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--15-accuracy-testing-and-debugging)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

## Ascend 平台实践

### Ascend 软件栈与版本边界

建议先修：Prefill、Decode 与生成流程。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [第一讲：五个关键对象如何组成 Ascend NPU 推理与算子栈](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/01-stack-and-relationships.md) | 正文 / 原理 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--01-stack-and-relationships)；en:一致 / zh:一致 | 保留并归类 |
| [第二讲：CANN 全栈与边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/02-cann-stack-and-boundaries.md) | 正文 / 原理 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--02-cann-stack-and-boundaries)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [00. Ascend NPU 背景知识](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/00-background.md) | 正文 / 总览 / 入门 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--00-background)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [SGLang Ascend NPU 实践总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/README.md) | 目录 / 总览 / 入门 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### 环境、最小服务与部署场景

建议先修：Ascend 软件栈与版本边界；指标、Baseline 与 Workload。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [01. 安装与环境：GNU/Linux + Ascend NPU 服务器上跑通 SGLang](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/01-environment-and-install.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--01-environment-and-install)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [03. 隔离环境启动与最小 Serving 跑通](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/03-launch-and-minimal-serving.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--03-launch-and-minimal-serving)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [13. SGLang NPU 多场景模型运行手册](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/13-run-models-by-scenario.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--13-run-models-by-scenario)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### NPU 接入、Backend 与参数

建议先修：Ascend 软件栈与版本边界；Worker、ModelRunner 与 ForwardBatch。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [SGLang Ascend NPU 接入点与调用图谱](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/02-ascend-npu-integration-map.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--02-ascend-npu-integration-map)；en:一致 / zh:一致 | 保留并归类 |
| [04. NPU 后端参数与默认值](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/04-npu-backend-args.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--04-npu-backend-args)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [09. Ascend LoRA、MoE、量化与特性分支](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/09-lora-moe-feature-branches.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--09-lora-moe-feature-branches)；en:内容不同，待对照 / zh:一致 | 保留并归类 |
| [第一讲：SGLang NPU 全组件与双仓目录总览](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/01-sglang-npu-component-map.md) | 正文 / 总览 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--01-sglang-npu-component-map)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [01. NPU 平台识别与进程启动](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/01-platform-detection-and-process-startup.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--01-platform-detection-and-process-startup)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [02. ServerArgs 校验与 NPU 默认参数](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/foundation/02-server-args-and-npu-defaults.md) | 正文 / 平台实现 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--foundation--02-server-args-and-npu-defaults)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [SGLang Ascend NPU 源码串讲](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) | 目录 / 总览 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/sglang-ascend-npu--source-code-walkthrough--readme)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

## 算子编程与编译

### Host / Device、类型、硬件、存储与流水

建议先修：Ascend 软件栈与版本边界。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [基础 01：从一个公式到并行 Kernel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/01-kernel-first-principles.md) | 正文 / 原理 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--foundations--01-kernel-first-principles)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [基础 02：Ascend NPU、AI Core 与存储层级](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/02-ascend-hardware.md) | 正文 / 原理 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--foundations--02-ascend-hardware)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [基础 03：搬运、计算、同步与流水](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/foundations/03-memory-pipeline-and-sync.md) | 正文 / 原理 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--foundations--03-memory-pipeline-and-sync)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Ascend Kernel Infra：从推理框架走向 NPU 算子](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/README.md) | 目录 / 总览 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--readme)；en:一致 / zh:一致 | 保留并归类 |
| [代码阅读手册：变量类型、形状、地址与源码实现](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/reference/code-reading-and-types.md) | 参考资料 / 参考 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--reference--code-reading-and-types)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [参考：Ascend Kernel Infra 术语表](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/reference/glossary.md) | 参考资料 / 参考 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--reference--glossary)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [参考：sgl-kernel-npu、Triton-Ascend 与 Ascend C 技术选型](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/reference/technology-comparison.md) | 参考资料 / 参考 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--reference--technology-comparison)；en:一致 / zh:一致 | 保留并归类 |
| [Ascend Kernel Infra 路线图](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ROADMAP.md) | 维护资料 / 总览 / 进阶 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--roadmap)；en:一致 / zh:一致 | 保留并归类 |
| ↳ 课程规划不是教学正文。 | | | | | |

### Triton-Ascend 编程与编译

建议先修：Host / Device、类型、硬件、存储与流水。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Triton-Ascend 01：Program、Grid、Tile 与第一个 Kernel](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/01-program-grid-tile.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--triton-ascend--01-program-grid-tile)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Triton-Ascend 02：地址、广播、归约与矩阵分块](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/02-tensor-addressing-reduction-matmul.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--triton-ascend--02-tensor-addressing-reduction-matmul)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Triton-Ascend 03：编译、调试与性能优化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/03-compile-debug-optimize.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--triton-ascend--03-compile-debug-optimize)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |
| [Triton-Ascend 04：TTIR、MLIR、Driver 与 Cache](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/04-ttir-mlir-driver-and-cache.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--triton-ascend--04-ttir-mlir-driver-and-cache)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Triton-Ascend 05：Persistent Kernel、大 Grid 与 Task Queue 边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/triton-ascend/05-persistent-kernel-and-large-grid.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--triton-ascend--05-persistent-kernel-and-large-grid)；en:内容不同，待对照 / zh:内容不同，待对照 | 保留并归类 |

### Ascend C、Tiling 与 Workspace

建议先修：Host / Device、类型、硬件、存储与流水。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [Ascend C 01：Global/Local Tensor、TPipe 与 TQue](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/01-global-local-tensor-pipe-queue.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--ascend-c--01-global-local-tensor-pipe-queue)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Ascend C 02：一个 Add 算子的端到端工程](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/02-add-operator-end-to-end.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--ascend-c--02-add-operator-end-to-end)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Ascend C 03：Tiling、流水、同步与性能优化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/03-tiling-pipeline-sync-optimization.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--ascend-c--03-tiling-pipeline-sync-optimization)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [Ascend C 04：Platform、Tiling、Workspace 与 Host/Device 契约](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ascend-c/04-platform-tiling-and-workspace-contracts.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--ascend-c--04-platform-tiling-and-workspace-contracts)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### torch_npu、ACLNN 与 Custom Op

建议先修：Host / Device、类型、硬件、存储与流水。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [sgl-kernel-npu 01：仓库结构与算子生命周期](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/01-repository-and-op-lifecycle.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--01-repository-and-op-lifecycle)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| [torch_npu 01：Dispatcher、ACLNN 与 Custom Op 的边界](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--torch-npu--01-dispatch-aclnn-and-custom-op-boundaries)；en:一致 / zh:内容不同，待对照 | 保留并归类 |

### 真实算子与通信 Kernel 源码

建议先修：torch_npu、ACLNN 与 Custom Op。

| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |
|---|---|---|---|---|---|
| [sgl-kernel-npu 02：Triton 源码精读——Fused Split Q/K Norm](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/02-triton-fused-split-qk-norm.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--02-triton-fused-split-qk-norm)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；Triton-Ascend 编程与编译 | | | | | |
| [sgl-kernel-npu 03：Ascend C 源码精读——Apply Token Bitmask](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/03-ascend-c-apply-token-bitmask.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--03-ascend-c-apply-token-bitmask)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；Ascend C、Tiling 与 Workspace | | | | | |
| [sgl-kernel-npu 04：FLA Chunk Gated Delta Rule 的双路径入口](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/04-fla-chunk-gated-delta-rule-mixed-path.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--04-fla-chunk-gated-delta-rule-mixed-path)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；Triton-Ascend 编程与编译；Ascend C、Tiling 与 Workspace；Gated DeltaNet | | | | | |
| [sgl-kernel-npu 05：DeepEP、HCCL 与 MoE token 路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/05-deepep-hccl-and-moe-kernel-path.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--05-deepep-hccl-and-moe-kernel-path)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；MoE Dispatch / Combine、DeepEP 与 DWDP；Ascend C、Tiling 与 Workspace | | | | | |
| [sgl-kernel-npu 06：DeepEP Low-Latency、A2 Layered 与小 Batch 推理路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/06-deepep-low-latency-and-layered-a2-path.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--06-deepep-low-latency-and-layered-a2-path)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；MoE Dispatch / Combine、DeepEP 与 DWDP；Ascend C、Tiling 与 Workspace | | | | | |
| [sgl-kernel-npu 08：FLA Mega Kernel、Device Stage 与 Ascend 数据流](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/sgl-kernel-npu/08-fla-mega-kernel-device-stages.md) | 正文 / 平台实现 / 深入 | ascend | en / zh | [原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/article/ascend-kernel-infra--sgl-kernel-npu--08-fla-mega-kernel-device-stages)；en:一致 / zh:内容不同，待对照 | 保留并归类 |
| ↳ 本材料先修：torch_npu、ACLNN 与 Custom Op；Triton-Ascend 编程与编译；Ascend C、Tiling 与 Workspace；Gated DeltaNet | | | | | |

## 计划文件（不能显示为已有课程）

以下文件尚不存在，但相关知识可能已经由其他教程覆盖。JSON 中列出同主题已有材料 ID，不能把“计划文件缺失”等同于“知识完全空缺”。

| 计划主题 | 原目录计划文件 | 计划依据 |
|---|---|---|
| 平台与运行时接入 | `sglang-ascend-npu/source-code-walkthrough/02-platform-runtime-and-kernel-bootstrap.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| Ascend Attention / MLA | `sglang-ascend-npu/source-code-walkthrough/03-ascend-attention-and-mla.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| KV Cache 与 Allocator | `sglang-ascend-npu/source-code-walkthrough/04-kv-cache-memory-and-allocator.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| Norm / RoPE / Activation | `sglang-ascend-npu/source-code-walkthrough/06-norm-rope-and-activation.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| 量化与 Linear | `sglang-ascend-npu/source-code-walkthrough/07-quantization-and-linear.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| MoE 计算与融合专家 | `sglang-ascend-npu/source-code-walkthrough/08-moe-routing-and-fused-expert.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| DeepEP-Ascend 与 EP | `sglang-ascend-npu/source-code-walkthrough/09-deepep-ascend-and-expert-parallel.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| Ascend LoRA | `sglang-ascend-npu/source-code-walkthrough/10-ascend-lora.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| FLA / Mamba / Hybrid | `sglang-ascend-npu/source-code-walkthrough/11-fla-mamba-and-hybrid-linear-attention.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| Ascend 投机解码 | `sglang-ascend-npu/source-code-walkthrough/12-speculative-decoding.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| 采样与约束解码 | `sglang-ascend-npu/source-code-walkthrough/13-sampling-and-constrained-decoding.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| 模型与多模态适配 | `sglang-ascend-npu/source-code-walkthrough/14-model-specific-and-multimodal-components.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| Ascend PD 与 KV 传输 | `sglang-ascend-npu/source-code-walkthrough/16-pd-disaggregation-and-kv-transfer.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| 工具算子与内存优化 | `sglang-ascend-npu/source-code-walkthrough/17-utility-kernels-and-memory-optimization.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| 构建、注册与双仓验证 | `sglang-ascend-npu/source-code-walkthrough/18-build-registration-tests-and-cross-repo-development.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/README.md) |
| DeepEP Fused MoE | `ascend-kernel-infra/sgl-kernel-npu/07-deepep-fused-moe-and-dispatch-ffn-combine.md` | [原始计划](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ascend-kernel-infra/ROADMAP.md) |

## 语言与站内副本差异

英文正文缺失：

- [01. 量化基础：从浮点数到低 bit 表示](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/01-quantization-foundations.md)。
- [02. 位宽记号、FP8/MXFP8 与 packed W4](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/02-bitwidth-formats-and-packing.md)。
- [03. 权重量化算法：从 RTN 到 GPTQ、AWQ、AutoRound、HQQ、NF4](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/03-weight-quantization-algorithms.md)。
- [04. Activation、KV Cache、FP8 与 MXFP8 量化](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/04-activation-kv-fp8-quantization.md)。
- [05. Serving 中的量化数据流、kernel 与排障](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/ai-infra-basic/Quantization/05-serving-kernel-and-debugging.md)。
- [端到端样例：Qwen3.5 Hybrid 在 SGLang Ascend NPU 中的完整执行路径](https://github.com/cl-vv-h/SGLang_Tutor/blob/19be702f0842301583b6d84a98c9e42a9f9b35e5/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/01-qwen3.5-hybrid-end-to-end.md)。

仅在旧站内索引存在的材料：

无。

完整的每语言 Git blob、固定来源、引用版本证据、网站副本差异及资源清单见 [catalog.json](catalog.json)。源文件本轮未同步。
