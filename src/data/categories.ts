import type { Category, LearningPath } from '@/types'

export const categories: Category[] = [
  {
    id: 'cat-5',
    name: '模型架构',
    nameEn: 'Model Architecture',
    slug: 'model-architecture',
    description: '主流大模型架构剖析：Decoder-Only Transformer、GQA、Sparse MoE、MLA、架构家族谱系',
    descriptionEn: 'Analysis of mainstream LLM architectures: Decoder-Only Transformer, GQA, Sparse MoE, MLA, and architecture families',
    icon: 'Network',
    color: '#06b6d4',
    subcategories: [
      { id: 'sub-5-1', categoryId: 'cat-5', name: '架构专题导读', nameEn: 'Architecture Topics', slug: 'arch-topics', description: '从Decoder-Only到MLA、Sparse MoE的架构演进与实现细节', descriptionEn: 'Architecture evolution and implementation details from Decoder-Only to MLA and Sparse MoE' },
    ],
  },
  {
    id: 'cat-1',
    name: '大模型并行策略',
    nameEn: 'Parallel Strategy',
    slug: 'parallel-strategy',
    description: '大模型推理与训练中的并行计算策略，包含DP/TP/PP/SP/EP推理并行策略的教学版Python Demo与讲义',
    descriptionEn: 'Parallel computing strategies for LLM inference and training, including DP/TP/PP/SP/EP inference demos and tutorials',
    icon: 'GitBranch',
    color: '#00d4ff',
    subcategories: [
      { id: 'sub-1-7', categoryId: 'cat-1', name: '并行策略教学Demo', nameEn: 'Parallel Strategy Demos', slug: 'parallel-demos', description: 'DP/TP/PP/SP/EP推理并行策略的教学版Python Demo与讲义', descriptionEn: 'Educational Python demos and tutorials for DP/TP/PP/SP/EP inference parallel strategies' },
    ],
  },
  {
    id: 'cat-2',
    name: 'LoRA',
    nameEn: 'LoRA',
    slug: 'lora',
    description: '参数高效微调的核心技术，包含LoRA/QLoRA/DoRA/AdaLoRA的教学版实现与代码导读',
    descriptionEn: 'Parameter-efficient fine-tuning core techniques, including LoRA/QLoRA/DoRA/AdaLoRA educational implementations',
    icon: 'Puzzle',
    color: '#a855f7',
    subcategories: [
      { id: 'sub-2-7', categoryId: 'cat-2', name: 'LoRA教学Demo', nameEn: 'LoRA Demos', slug: 'lora-demos', description: 'LoRA/QLoRA/DoRA/AdaLoRA的教学版实现与代码导读', descriptionEn: 'Educational implementations of LoRA/QLoRA/DoRA/AdaLoRA' },
    ],
  },
  {
    id: 'cat-3',
    name: 'Prefill与调度优化',
    nameEn: 'Prefill & Scheduling',
    slug: 'prefill',
    description: '推理预填充阶段与调度优化技术：FlashAttention、KV Cache、Chunked Prefill、连续批处理的教学版Python实现',
    descriptionEn: 'Prefill phase and scheduling optimization: FlashAttention, KV Cache, Chunked Prefill, and continuous batching educational implementations',
    icon: 'FastForward',
    color: '#22c55e',
    subcategories: [
      { id: 'sub-3-6', categoryId: 'cat-3', name: 'Prefill与调度教学Demo', nameEn: 'Prefill & Scheduling Demos', slug: 'prefill-demos', description: 'FlashAttention、Prefill/Decode与KV Cache、Chunked Prefill调度的教学版Python实现', descriptionEn: 'Educational Python implementations of FlashAttention, Prefill/Decode with KV Cache, and Chunked Prefill scheduling' },
    ],
  },
  {
    id: 'cat-4',
    name: 'Decode',
    nameEn: 'Decode',
    slug: 'decode',
    description: '推理解码阶段的核心算法，包含FlashDecoding等Decode阶段优化的教学版Python实现',
    descriptionEn: 'Core algorithms for the decode phase, including FlashDecoding and other decode-stage optimizations',
    icon: 'Terminal',
    color: '#f59e0b',
    subcategories: [
      { id: 'sub-4-6', categoryId: 'cat-4', name: 'Decode教学Demo', nameEn: 'Decode Demos', slug: 'decode-demos', description: 'FlashDecoding等Decode阶段优化的教学版Python实现', descriptionEn: 'Educational Python implementations of FlashDecoding and decode-stage optimizations' },
    ],
  },
  {
    id: 'cat-10',
    name: '推理基础',
    nameEn: 'Inference Basics',
    slug: 'inference-basics',
    description: 'LLM推理核心概念：Prefill/Decode两阶段、KV Cache、采样、TTFT/ITL等关键指标',
    descriptionEn: 'Core LLM inference concepts: Prefill/Decode two-phase, KV Cache, sampling, TTFT/ITL key metrics',
    icon: 'BookOpen',
    color: '#3b82f6',
    subcategories: [
      { id: 'sub-10-1', categoryId: 'cat-10', name: '推理基础专题', nameEn: 'Inference Basics Topics', slug: 'inference-basics-topics', description: 'Prefill/Decode、KV Cache、采样、TTFT/ITL等推理基础概念', descriptionEn: 'Prefill/Decode, KV Cache, sampling, TTFT/ITL and other inference fundamentals' },
    ],
  },
  {
    id: 'cat-11',
    name: 'KV Cache与显存',
    nameEn: 'KV Cache & Memory',
    slug: 'kv-cache-memory',
    description: 'KV Cache布局、分页管理、前缀缓存、显存估算与HiCache分层缓存',
    descriptionEn: 'KV Cache layout, paged attention, prefix cache, memory estimation, and HiCache hierarchical caching',
    icon: 'Database',
    color: '#14b8a6',
    subcategories: [
      { id: 'sub-11-1', categoryId: 'cat-11', name: 'KV Cache专题', nameEn: 'KV Cache Topics', slug: 'kv-cache-topics', description: 'KV Cache布局、分页、前缀缓存与显存管理', descriptionEn: 'KV Cache layout, paging, prefix cache, and memory management' },
    ],
  },
  {
    id: 'cat-12',
    name: 'KV Transfer与PD分离',
    nameEn: 'KV Transfer & PD Disaggregation',
    slug: 'kv-transfer',
    description: 'Prefill/Decode分离架构：Bootstrap、Prealloc、KV Transfer引擎与跨节点传输',
    descriptionEn: 'Prefill/Decode disaggregation: Bootstrap, Prealloc, KV Transfer engine, and cross-node transfer',
    icon: 'ArrowLeftRight',
    color: '#0ea5e9',
    subcategories: [
      { id: 'sub-12-1', categoryId: 'cat-12', name: 'KV Transfer专题', nameEn: 'KV Transfer Topics', slug: 'kv-transfer-topics', description: 'PD分离架构与KV Cache跨节点传输', descriptionEn: 'PD disaggregation architecture and cross-node KV Cache transfer' },
    ],
  },
  {
    id: 'cat-6',
    name: '投机解码',
    nameEn: 'Speculative Decoding',
    slug: 'speculative-decoding',
    description: '投机解码原理、拒绝采样数学推导、服务化实现数据流与算法全景',
    descriptionEn: 'Speculative decoding principles, rejection sampling math, serving implementation dataflow, and algorithm landscape',
    icon: 'Shuffle',
    color: '#ec4899',
    subcategories: [
      { id: 'sub-6-1', categoryId: 'cat-6', name: '投机解码专题', nameEn: 'Speculative Decoding Topics', slug: 'spec-decoding-topics', description: '投机解码的原理、数学、服务化与算法变体', descriptionEn: 'Principles, math, serving, and algorithm variants of speculative decoding' },
    ],
  },
  {
    id: 'cat-7',
    name: 'Mamba状态空间',
    nameEn: 'Mamba State Space',
    slug: 'mamba-state-space',
    description: 'Mamba/SSM模型原理、与SGLang集成状态、Radix Cache适配',
    descriptionEn: 'Mamba/SSM model principles, integration with SGLang, and Radix Cache adaptation',
    icon: 'Minimize2',
    color: '#10b981',
    subcategories: [
      { id: 'sub-7-1', categoryId: 'cat-7', name: 'Mamba专题导读', nameEn: 'Mamba Topics', slug: 'mamba-topics', description: 'Mamba/SSM原理、与SGLang集成、Radix Cache适配', descriptionEn: 'Mamba/SSM principles, SGLang integration, and Radix Cache adaptation' },
    ],
  },
  {
    id: 'cat-13',
    name: '量化',
    nameEn: 'Quantization',
    slug: 'quantization',
    description: '模型量化技术：Weight-only(GPTQ/AWQ)、W8A8/FP8、KV Cache量化与校准',
    descriptionEn: 'Model quantization: Weight-only (GPTQ/AWQ), W8A8/FP8, KV Cache quantization, and calibration',
    icon: 'Layers',
    color: '#f43f5e',
    subcategories: [
      { id: 'sub-13-1', categoryId: 'cat-13', name: '量化专题', nameEn: 'Quantization Topics', slug: 'quant-topics', description: 'Weight-only、W8A8/FP8、KV Cache量化', descriptionEn: 'Weight-only, W8A8/FP8, and KV Cache quantization' },
    ],
  },
  {
    id: 'cat-14',
    name: '基准与性能分析',
    nameEn: 'Benchmark & Profiling',
    slug: 'benchmark-profiling',
    description: '推理性能基准测试：TTFT/ITL/TPS指标、负载测试、Profiling工具与瓶颈定位',
    descriptionEn: 'Inference performance benchmarking: TTFT/ITL/TPS metrics, load testing, profiling tools, and bottleneck identification',
    icon: 'Gauge',
    color: '#84cc16',
    subcategories: [
      { id: 'sub-14-1', categoryId: 'cat-14', name: '基准与Profiling专题', nameEn: 'Benchmark & Profiling Topics', slug: 'benchmark-topics', description: 'TTFT/ITL/TPS指标、负载测试与Profiling', descriptionEn: 'TTFT/ITL/TPS metrics, load testing, and profiling' },
    ],
  },
  {
    id: 'cat-9',
    name: '执行图',
    nameEn: 'Execution Graph',
    slug: 'execution-graph',
    description: '推理执行图概念与图执行数据流：从框架视角理解算子编排与调度',
    descriptionEn: 'Inference execution graph concepts and graph execution dataflow: understanding operator orchestration and scheduling',
    icon: 'Workflow',
    color: '#f97316',
    subcategories: [
      { id: 'sub-9-1', categoryId: 'cat-9', name: '执行图专题', nameEn: 'Execution Graph Topics', slug: 'exec-graph-topics', description: '执行图概念与图执行数据流', descriptionEn: 'Execution graph concepts and graph execution dataflow' },
    ],
  },
  {
    id: 'cat-8',
    name: 'SGLang',
    nameEn: 'SGLang',
    slug: 'sglang',
    description: '推理框架SGLang深度解析，涵盖核心架构、关键技术、执行流程与源码解析',
    descriptionEn: 'In-depth analysis of the SGLang inference framework: core architecture, key technologies, execution flow, and source code reading',
    icon: 'Code2',
    color: '#8b5cf6',
    subcategories: [
      { id: 'sub-8-0', categoryId: 'cat-8', name: '知识图谱', nameEn: 'Knowledge Graph', slug: 'knowledge-graph', description: 'SGLang核心模块架构与调用关系全景图', descriptionEn: 'Panoramic view of SGLang core modules and their call relationships' },
      { id: 'sub-8-1', categoryId: 'cat-8', name: '源码总览阅读路线', nameEn: 'Source Reading Roadmap', slug: 'sglang-source-reading', description: '从全局视角理解SGLang：特性地图→请求生命周期→各核心模块逐步深入，适合首次阅读源码的开发者', descriptionEn: 'Understand SGLang from a global perspective: feature map → request lifecycle → deep dive into each core module' },
      { id: 'sub-8-2', categoryId: 'cat-8', name: 'Scheduler架构解析', nameEn: 'Scheduler Architecture', slug: 'scheduler-architecture', description: '深入Scheduler模块：架构概览→流程图→代码导读→函数地图，从宏观到微观的渐进式学习路径', descriptionEn: 'Deep dive into the Scheduler module: architecture → flowcharts → code walkthrough → function map' },
      { id: 'sub-8-3', categoryId: 'cat-8', name: 'TP Worker与Model Runner', nameEn: 'TP Worker & Model Runner', slug: 'tp-worker-model-runner', description: '深入推理执行层：架构概览→流程图→函数地图，理解张量并行与模型推理的底层实现', descriptionEn: 'Deep dive into the inference execution layer: architecture → flowcharts → function map for TP and model runner' },
      { id: 'sub-8-4', categoryId: 'cat-8', name: 'Ascend NPU适配', nameEn: 'Ascend NPU Adaptation', slug: 'sglang-ascend-npu', description: 'SGLang在华为昇腾NPU上的适配实践：环境搭建→最小服务→Attention/Graph/HCCL/PD分离/LoRA等NPU专属适配详解', descriptionEn: 'SGLang adaptation on Huawei Ascend NPU: environment → minimal serving → Attention/Graph/HCCL/PD disaggregation/LoRA NPU specifics' },
      { id: 'sub-8-5', categoryId: 'cat-8', name: 'Ascend算子基础设施', nameEn: 'Ascend Kernel Infrastructure', slug: 'ascend-kernel-infra', description: 'Ascend NPU算子层下沉：sgl-kernel-npu、Triton-Ascend、Ascend C、torch_npu的关系、编程模型与性能优化', descriptionEn: 'Ascend NPU kernel layer: sgl-kernel-npu, Triton-Ascend, Ascend C, torch_npu relationships, programming model, and performance optimization' },
    ],
  },
]

export const learningPaths: LearningPath[] = [
  {
    id: 'lp-1',
    title: '入门路径',
    titleEn: 'Beginner Path',
    description: '从推理基础概念出发，理解LLM推理的核心流程与关键概念',
    descriptionEn: 'Start from inference fundamentals and understand the core flow and key concepts of LLM inference',
    level: 'beginner',
    color: '#22c55e',
    topics: ['推理基础与Prefill/Decode', 'KV Cache原理', '模型架构概览', '并行策略入门'],
    topicsEn: ['Inference basics & Prefill/Decode', 'KV Cache principles', 'Model architecture overview', 'Parallel strategy introduction'],
  },
  {
    id: 'lp-2',
    title: '进阶路径',
    titleEn: 'Intermediate Path',
    description: '深入推理优化技术，掌握并行策略实现与推理框架使用',
    descriptionEn: 'Deepen inference optimization skills, master parallel strategy implementations and inference frameworks',
    level: 'intermediate',
    color: '#00d4ff',
    topics: ['FlashAttention实现', 'DP/TP/PP并行Demo', 'SGLang框架使用', 'Chunked Prefill调度'],
    topicsEn: ['FlashAttention implementation', 'DP/TP/PP parallel demos', 'SGLang framework usage', 'Chunked Prefill scheduling'],
  },
  {
    id: 'lp-3',
    title: '专家路径',
    titleEn: 'Expert Path',
    description: '掌握SGLang源码级理解，具备系统级推理优化能力',
    descriptionEn: 'Achieve source-level understanding of SGLang and system-level inference optimization capabilities',
    level: 'advanced',
    color: '#a855f7',
    topics: ['SGLang源码解析', 'Scheduler架构深度', 'TP Worker实现', 'PD分离与Ascend NPU'],
    topicsEn: ['SGLang source reading', 'Scheduler architecture deep dive', 'TP Worker implementation', 'PD disaggregation & Ascend NPU'],
  },
]

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug)
}

export function getSubCategoryBySlug(categorySlug: string, subSlug: string): Category['subcategories'][0] | undefined {
  const cat = getCategoryBySlug(categorySlug)
  return cat?.subcategories.find((s) => s.slug === subSlug)
}
