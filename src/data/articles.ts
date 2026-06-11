import type { Article } from '@/types'

export const articles: Article[] = [
  {
    id: 'art-1-1',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-1',
    title: '数据并行：从原理到实践',
    slug: 'data-parallelism-guide',
    summary: '深入理解数据并行的核心原理，掌握DDP与FSDP的实现方式，了解梯度累积与同步策略的优化方法。',
    content: `## 核心概念

数据并行（Data Parallelism）是最直观的并行策略——将相同的模型复制到多个设备上，每个设备处理不同的数据子集。

### 基本原理

1. **模型复制**：每个GPU持有完整的模型副本
2. **数据切分**：输入数据被均匀分配到各GPU
3. **梯度同步**：反向传播后，各GPU同步梯度并取平均
4. **参数更新**：所有GPU使用同步后的梯度更新参数

### DDP vs FSDP

| 特性 | DDP | FSDP |
|------|-----|------|
| 模型存储 | 每GPU完整副本 | 分片存储 |
| 通信量 | 与GPU数无关 | 与分片策略相关 |
| 显存占用 | 高 | 低 |
| 适用规模 | 中小模型 | 大模型 |

## 性能评估指标

- **加速比**：N卡理想加速比为N，实际受通信开销影响
- **通信开销比**：通信时间 / 总时间
- **显存效率**：有效参数量 / 总显存占用

## 典型应用案例

在7B模型训练中，使用8卡DDP可获得约7.2x加速比，通信开销约10%。对于70B模型，FSDP可将单卡显存从280GB降至约35GB。`,
    tags: ['数据并行', 'DDP', 'FSDP', '分布式训练'],
    readTime: '15 min',
    date: '2025-01-15',
    prevArticleId: null,
    nextArticleId: 'art-1-2',
  },
  {
    id: 'art-1-2',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-3',
    title: '张量并行：Megatron-LM风格切分',
    slug: 'tensor-parallelism-megatron',
    summary: '详解张量并行的列切分与行切分策略，理解Megatron-LM如何实现Transformer层内并行。',
    content: `## 核心概念

张量并行（Tensor Parallelism）将单个算子的张量沿特定维度切分到多个设备上，实现层内并行计算。

### 列切分（Column Parallel）

将权重矩阵沿列维度切分，每个GPU计算部分输出，结果无需通信即可拼接。

### 行切分（Row Parallel）

将权重矩阵沿行维度切分，每个GPU计算部分结果后需要AllReduce求和。

### Megatron-LM的组合策略

在Transformer的FFN层中：
- 第一个线性层使用列切分
- 第二个线性层使用行切分
- 中间的GeLU激活函数无需通信

## 性能评估指标

- **通信量**：每次前向/反向各需一次AllReduce
- **计算效率**：理想情况下接近线性加速
- **显存节省**：每卡显存约为总参数量的1/N

## 典型应用案例

GPT-3 175B使用8路张量并行，在64个DGX A100节点上训练，张量并行的通信开销约5-8%。`,
    tags: ['张量并行', 'Megatron-LM', 'AllReduce', '模型并行'],
    readTime: '20 min',
    date: '2025-01-20',
    prevArticleId: 'art-1-1',
    nextArticleId: 'art-1-3',
  },
  {
    id: 'art-1-3',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-4',
    title: '流水线并行：调度与气泡优化',
    slug: 'pipeline-parallelism-scheduling',
    summary: '深入分析流水线并行的微批次调度策略，理解GPipe与1F1B调度如何减少流水线气泡。',
    content: `## 核心概念

流水线并行（Pipeline Parallelism）将模型按层切分到不同设备上，数据像流水线一样依次通过各设备。

### 流水线气泡

设备空闲等待的时间称为"气泡"。气泡比例直接影响并行效率。

### GPipe调度

所有微批次先完成前向传播，再统一反向传播。气泡较大，但实现简单。

### 1F1B调度

交替执行一个微批次的前向和反向，减少显存峰值的同时降低气泡比例。

## 性能评估指标

- **气泡比例**：空闲时间 / 总时间
- **吞吐量**：tokens/s per GPU
- **显存峰值**：最大激活值存储量

## 典型应用案例

使用1F1B调度，在4路流水线并行下，气泡比例可从GPipe的约75%降至约25%。`,
    tags: ['流水线并行', '1F1B', 'GPipe', '气泡优化'],
    readTime: '18 min',
    date: '2025-02-01',
    prevArticleId: 'art-1-2',
    nextArticleId: null,
  },
  {
    id: 'art-2-1',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-1',
    title: 'LoRA原理机制：低秩适配的数学基础',
    slug: 'lora-principle-math',
    summary: '从SVD分解到低秩假设，深入理解LoRA如何用极少参数实现高效微调。',
    content: `## 核心概念

LoRA（Low-Rank Adaptation）的核心假设：预训练模型的权重更新矩阵具有低秩特性，可以用两个小矩阵的乘积近似。

### 数学原理

原始权重更新：W' = W + ΔW

LoRA近似：ΔW = B × A，其中 B ∈ R^(d×r)，A ∈ R^(r×k)，r << min(d,k)

缩放因子：h = Wx + (α/r)BAx

### 为什么有效？

1. **内在维度**：模型微调时实际需要的自由度远小于参数量
2. **低秩结构**：ΔW的奇异值快速衰减，主要信息集中在低秩子空间
3. **无额外推理开销**：推理时可将BA合并到W中

## 性能评估指标

- **可训练参数比**：LoRA参数量 / 原始参数量
- **下游任务性能**：与全量微调的指标差距
- **训练速度**：每步训练时间对比

## 典型应用案例

在LLaMA-7B上使用r=16的LoRA，可训练参数仅0.1%，在多个NLU任务上达到全量微调95%以上的性能。`,
    tags: ['LoRA', '低秩分解', '参数高效微调', 'PEFT'],
    readTime: '22 min',
    date: '2025-02-10',
    prevArticleId: null,
    nextArticleId: 'art-2-2',
  },
  {
    id: 'art-2-2',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-3',
    title: 'QLoRA：4-bit量化微调实践',
    slug: 'qlora-4bit-finetuning',
    summary: '详解QLoRA的NF4量化、双量化和分页优化器，实现单卡微调65B模型。',
    content: `## 核心概念

QLoRA在LoRA基础上引入量化技术，将基座模型以4-bit精度加载，仅LoRA参数保持高精度，大幅降低微调显存需求。

### 三大创新

1. **NF4量化**：正态分布优化的4-bit数据类型
2. **双量化**：对量化常数再次量化，节省约0.37bit/param
3. **分页优化器**：利用CPU内存处理优化器状态的显存峰值

## 性能评估指标

- **显存占用**：单卡可微调的最大模型规模
- **微调质量**：与全量微调的性能差距
- **训练速度**：量化带来的额外计算开销

## 典型应用案例

使用QLoRA在单张A100 80G上微调LLaMA-65B，显存峰值约48GB，性能损失小于1%。`,
    tags: ['QLoRA', '4-bit量化', 'NF4', '高效微调'],
    readTime: '25 min',
    date: '2025-02-15',
    prevArticleId: 'art-2-1',
    nextArticleId: null,
  },
  {
    id: 'art-3-1',
    categoryId: 'cat-3',
    subCategoryId: 'sub-3-1',
    title: 'Prefill工作原理：推理的第一步',
    slug: 'prefill-principle-overview',
    summary: '理解LLM推理中Prefill阶段的作用，分析其计算特征与内存访问模式。',
    content: `## 核心概念

Prefill阶段是LLM推理的第一步，负责处理输入prompt的所有Token，生成初始的KV Cache。

### 工作流程

1. **Token Embedding**：将输入Token转换为向量表示
2. **并行Attention计算**：所有输入Token的Attention一次性计算
3. **KV Cache填充**：将Key和Value缓存供Decode阶段使用

### 计算特征

- **计算密集型**：大量矩阵乘法，GPU利用率高
- **可并行**：所有输入Token可并行处理
- **与序列长度平方成正比**：Attention计算复杂度为O(n²)

## 性能评估指标

- **Prefill延迟**：处理输入prompt的时间
- **吞吐量**：每秒可处理的Prefill请求数
- **TTFT**：首Token时间（Time To First Token）

## 典型应用案例

对于2048 Token的输入，在A100上Prefill约需50ms，占整个推理时间的5-15%。`,
    tags: ['Prefill', 'KV Cache', '首Token时间', '推理流程'],
    readTime: '16 min',
    date: '2025-03-01',
    prevArticleId: null,
    nextArticleId: null,
  },
  {
    id: 'art-7-1',
    categoryId: 'cat-7',
    subCategoryId: 'sub-7-1',
    title: 'INT8/INT4/FP8量化：精度与性能权衡',
    slug: 'quantization-precision-tradeoff',
    summary: '系统对比INT8、INT4、FP8三种量化精度，分析各自的适用场景与性能表现。',
    content: `## 核心概念

量化是将模型权重和/或激活值从高精度（FP32/FP16）映射到低精度的过程，以减少存储和计算开销。

### 量化类型对比

| 精度 | 比特数 | 模型体积 | 推理加速 | 精度损失 |
|------|--------|----------|----------|----------|
| FP16 | 16bit | 1x | 基线 | 无 |
| INT8 | 8bit | 0.5x | 1.5-2x | 极小 |
| INT4 | 4bit | 0.25x | 2-3x | 中等 |
| FP8 | 8bit | 0.5x | 1.5-2x | 极小 |

### 量化粒度

- **Per-tensor**：整个张量使用一个缩放因子
- **Per-channel**：每个通道独立缩放
- **Per-group**：分组量化（如G=128），平衡精度与效率

## 性能评估指标

- **模型压缩比**：量化后/量化前体积
- **推理吞吐提升**：tokens/s提升比例
- **精度保持率**：关键指标的下降幅度

## 典型应用案例

LLaMA-2 70B使用INT4量化后，模型从140GB降至约35GB，可在单张A100 80G上运行，PPL仅增加0.3。`,
    tags: ['量化', 'INT8', 'INT4', 'FP8', '模型压缩'],
    readTime: '20 min',
    date: '2025-03-10',
    prevArticleId: null,
    nextArticleId: null,
  },
  {
    id: 'art-8-1',
    categoryId: 'cat-8',
    subCategoryId: 'sub-8-1',
    title: 'SGLang核心架构设计',
    slug: 'sglang-core-architecture',
    summary: '深入解析SGLang的整体架构，理解其RadixAttention等核心创新的设计思路。',
    content: `## 核心概念

SGLang是一个高性能LLM推理框架，通过RadixAttention和高效调度实现卓越的推理吞吐。

### 架构概览

SGLang采用分层架构：

1. **前端层**：接收请求，解析SGLang程序
2. **调度层**：管理请求队列，实现连续批处理
3. **执行层**：管理KV Cache，执行模型推理
4. **后端层**：与底层推理引擎交互

### RadixAttention

SGLang的核心创新——基于基数树的KV Cache管理：

- 自动识别和复用共享前缀的KV Cache
- 支持前缀缓存的高效插入、查找和淘汰
- 特别优化多轮对话和结构化生成场景

## 性能评估指标

- **吞吐量**：tokens/s（单GPU/多GPU）
- **首Token延迟**：TTFT（ms）
- **KV Cache命中率**：缓存复用效率

## 典型应用案例

在Llama-3-8B上，SGLang相比vLLM在多轮对话场景下吞吐提升2-3x，得益于RadixAttention的高效缓存复用。`,
    tags: ['SGLang', 'RadixAttention', '推理框架', 'KV Cache'],
    readTime: '28 min',
    date: '2025-03-20',
    prevArticleId: null,
    nextArticleId: null,
  },
]

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug)
}

export function getArticlesByCategory(categoryId: string): Article[] {
  return articles.filter((a) => a.categoryId === categoryId)
}

export function getArticlesBySubCategory(subCategoryId: string): Article[] {
  return articles.filter((a) => a.subCategoryId === subCategoryId)
}
