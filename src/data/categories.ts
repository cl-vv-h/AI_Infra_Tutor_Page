import type { Category, LearningPath } from '@/types'

export const categories: Category[] = [
  {
    id: 'cat-1',
    name: '大模型并行策略',
    slug: 'parallel-strategy',
    description: '大模型推理与训练中的并行计算策略，涵盖数据并行、模型并行、张量并行、流水线并行等核心方法',
    icon: 'GitBranch',
    color: '#00d4ff',
    subcategories: [
      { id: 'sub-1-1', categoryId: 'cat-1', name: '数据并行', slug: 'data-parallelism', description: '数据并行策略的原理、实现与性能分析' },
      { id: 'sub-1-2', categoryId: 'cat-1', name: '模型并行', slug: 'model-parallelism', description: '模型并行策略的切分方法与通信优化' },
      { id: 'sub-1-3', categoryId: 'cat-1', name: '张量并行', slug: 'tensor-parallelism', description: '张量并行（Megatron-LM风格）的原理与实现' },
      { id: 'sub-1-4', categoryId: 'cat-1', name: '流水线并行', slug: 'pipeline-parallelism', description: '流水线并行的调度策略与气泡优化' },
      { id: 'sub-1-5', categoryId: 'cat-1', name: '混合并行', slug: 'hybrid-parallelism', description: '3D并行与自动并行策略的组合优化' },
      { id: 'sub-1-6', categoryId: 'cat-1', name: '并行策略选择与性能对比', slug: 'parallel-comparison', description: '不同并行策略的适用场景与性能权衡' },
      { id: 'sub-1-7', categoryId: 'cat-1', name: '并行策略教学Demo', slug: 'parallel-demos', description: 'DP/TP/PP/SP/EP推理并行策略的教学版Python Demo与讲义' },
    ],
  },
  {
    id: 'cat-2',
    name: 'LoRA',
    slug: 'lora',
    description: '参数高效微调的核心技术，涵盖LoRA原理、变体（QLoRA、AdaLoRA）及性能评估',
    icon: 'Puzzle',
    color: '#a855f7',
    subcategories: [
      { id: 'sub-2-1', categoryId: 'cat-2', name: 'LoRA原理机制', slug: 'lora-principle', description: '低秩适配的数学原理与核心思想' },
      { id: 'sub-2-2', categoryId: 'cat-2', name: 'LoRA实现方式', slug: 'lora-implementation', description: 'LoRA的工程实现与集成方法' },
      { id: 'sub-2-3', categoryId: 'cat-2', name: 'QLoRA', slug: 'qlora', description: '量化LoRA的原理与4-bit微调实践' },
      { id: 'sub-2-4', categoryId: 'cat-2', name: 'AdaLoRA', slug: 'adalora', description: '自适应秩分配的LoRA变体' },
      { id: 'sub-2-5', categoryId: 'cat-2', name: 'LoRA变体对比', slug: 'lora-variants', description: '主流LoRA变体的性能与适用场景对比' },
      { id: 'sub-2-6', categoryId: 'cat-2', name: '应用场景与性能评估', slug: 'lora-evaluation', description: 'LoRA在不同场景下的性能评估与最佳实践' },
      { id: 'sub-2-7', categoryId: 'cat-2', name: 'LoRA教学Demo', slug: 'lora-demos', description: 'LoRA/QLoRA/DoRA/AdaLoRA的教学版实现与代码导读' },
    ],
  },
  {
    id: 'cat-3',
    name: 'Prefill',
    slug: 'prefill',
    description: '推理预填充阶段的核心技术，包括计算流程、优化方法与内存管理策略',
    icon: 'FastForward',
    color: '#22c55e',
    subcategories: [
      { id: 'sub-3-1', categoryId: 'cat-3', name: 'Prefill工作原理', slug: 'prefill-principle', description: '预填充阶段在LLM推理中的作用与流程' },
      { id: 'sub-3-2', categoryId: 'cat-3', name: '计算流程', slug: 'prefill-computation', description: 'Prefill阶段的矩阵运算与注意力计算流程' },
      { id: 'sub-3-3', categoryId: 'cat-3', name: '优化技术', slug: 'prefill-optimization', description: 'FlashAttention等Prefill加速技术' },
      { id: 'sub-3-4', categoryId: 'cat-3', name: '内存管理策略', slug: 'prefill-memory', description: 'KV Cache分配与显存管理策略' },
      { id: 'sub-3-5', categoryId: 'cat-3', name: '性能瓶颈分析', slug: 'prefill-bottleneck', description: 'Prefill阶段的计算/内存瓶颈与优化方向' },
      { id: 'sub-3-6', categoryId: 'cat-3', name: 'Prefill教学Demo', slug: 'prefill-demos', description: 'FlashAttention、KV Cache、Chunked Prefill的教学版Python实现' },
    ],
  },
  {
    id: 'cat-4',
    name: 'Decode',
    slug: 'decode',
    description: '推理解码阶段的核心算法，涵盖自回归解码、批处理策略与延迟优化',
    icon: 'Terminal',
    color: '#f59e0b',
    subcategories: [
      { id: 'sub-4-1', categoryId: 'cat-4', name: '自回归解码过程', slug: 'autoregressive-decoding', description: '自回归生成的核心流程与计算特征' },
      { id: 'sub-4-2', categoryId: 'cat-4', name: '优化方法', slug: 'decode-optimization', description: '连续批处理与迭代级调度等解码优化' },
      { id: 'sub-4-3', categoryId: 'cat-4', name: '批处理策略', slug: 'decode-batching', description: 'Continuous Batching与动态批处理策略' },
      { id: 'sub-4-4', categoryId: 'cat-4', name: '延迟优化技术', slug: 'decode-latency', description: '降低首字时间与解码延迟的优化方法' },
      { id: 'sub-4-5', categoryId: 'cat-4', name: '解码算法实现', slug: 'decode-algorithm', description: '主流推理引擎的解码算法实现细节' },
      { id: 'sub-4-6', categoryId: 'cat-4', name: 'Decode教学Demo', slug: 'decode-demos', description: 'FlashDecoding等Decode阶段优化的教学版Python实现' },
    ],
  },
  {
    id: 'cat-5',
    name: '推理采样',
    slug: 'sampling',
    description: '推理输出采样策略与算法，包括Top-K、Top-P、温度调节等采样方法',
    icon: 'Shuffle',
    color: '#ec4899',
    subcategories: [
      { id: 'sub-5-1', categoryId: 'cat-5', name: '贪婪采样', slug: 'greedy-sampling', description: '贪婪解码策略的原理与适用场景' },
      { id: 'sub-5-2', categoryId: 'cat-5', name: '随机采样', slug: 'random-sampling', description: '随机采样策略与多样性控制' },
      { id: 'sub-5-3', categoryId: 'cat-5', name: 'Top-K采样', slug: 'top-k-sampling', description: 'Top-K过滤采样的原理与实现' },
      { id: 'sub-5-4', categoryId: 'cat-5', name: 'Top-P采样', slug: 'top-p-sampling', description: '核采样（Nucleus Sampling）的原理与实现' },
      { id: 'sub-5-5', categoryId: 'cat-5', name: '温度调节', slug: 'temperature', description: '温度参数对输出分布的影响与调节策略' },
      { id: 'sub-5-6', categoryId: 'cat-5', name: '采样策略对比', slug: 'sampling-comparison', description: '不同采样策略的优缺点与适用场景对比' },
    ],
  },
  {
    id: 'cat-6',
    name: '投机推理',
    slug: 'speculative-decoding',
    description: '投机解码加速推理的前沿技术，涵盖候选生成、验证机制与性能提升',
    icon: 'Zap',
    color: '#f97316',
    subcategories: [
      { id: 'sub-6-1', categoryId: 'cat-6', name: '基本原理', slug: 'speculative-principle', description: '投机解码的核心思想与理论保证' },
      { id: 'sub-6-2', categoryId: 'cat-6', name: '实现框架', slug: 'speculative-framework', description: '主流投机解码框架的架构与实现' },
      { id: 'sub-6-3', categoryId: 'cat-6', name: '候选生成策略', slug: 'speculative-candidate', description: 'Draft Model选择与候选Token生成策略' },
      { id: 'sub-6-4', categoryId: 'cat-6', name: '验证机制', slug: 'speculative-verification', description: '候选Token的验证与接受/拒绝机制' },
      { id: 'sub-6-5', categoryId: 'cat-6', name: '性能提升与局限性', slug: 'speculative-performance', description: '投机解码的加速效果分析与适用边界' },
    ],
  },
  {
    id: 'cat-7',
    name: '量化',
    slug: 'quantization',
    description: '模型量化压缩技术体系，包括INT8/INT4/FP8量化、GPTQ/AWQ/SmoothQuant等方案',
    icon: 'Minimize2',
    color: '#06b6d4',
    subcategories: [
      { id: 'sub-7-1', categoryId: 'cat-7', name: 'INT8/INT4/FP8量化', slug: 'quantization-basics', description: '不同精度量化的原理与实现方法' },
      { id: 'sub-7-2', categoryId: 'cat-7', name: '量化感知训练', slug: 'quantization-aware-training', description: 'QAT的训练流程与精度保持策略' },
      { id: 'sub-7-3', categoryId: 'cat-7', name: '量化误差分析', slug: 'quantization-error', description: '量化引入的误差来源与量化方法' },
      { id: 'sub-7-4', categoryId: 'cat-7', name: '性能与精度权衡', slug: 'quantization-tradeoff', description: '量化带来的推理加速与精度损失权衡' },
      { id: 'sub-7-5', categoryId: 'cat-7', name: 'GPTQ/AWQ/SmoothQuant', slug: 'quantization-methods', description: '主流后训练量化方法的原理与对比' },
    ],
  },
  {
    id: 'cat-8',
    name: 'SGLang',
    slug: 'sglang',
    description: '推理框架SGLang深度解析，涵盖核心架构、关键技术、执行流程与源码解析',
    icon: 'Code2',
    color: '#8b5cf6',
    subcategories: [
      { id: 'sub-8-0', categoryId: 'cat-8', name: '知识图谱', slug: 'knowledge-graph', description: 'SGLang核心模块架构与调用关系全景图' },
      { id: 'sub-8-1', categoryId: 'cat-8', name: '源码总览阅读路线', slug: 'sglang-source-reading', description: '从全局视角理解SGLang：特性地图→请求生命周期→各核心模块逐步深入，适合首次阅读源码的开发者' },
      { id: 'sub-8-2', categoryId: 'cat-8', name: 'Scheduler架构解析', slug: 'scheduler-architecture', description: '深入Scheduler模块：架构概览→流程图→代码导读→函数地图，从宏观到微观的渐进式学习路径' },
      { id: 'sub-8-3', categoryId: 'cat-8', name: 'TP Worker与Model Runner', slug: 'tp-worker-model-runner', description: '深入推理执行层：架构概览→流程图→函数地图，理解张量并行与模型推理的底层实现' },
    ],
  },
  {
    id: 'cat-9',
    name: '分布式推理',
    slug: 'distributed-inference',
    description: '大规模分布式推理系统，涵盖架构设计、通信优化、负载均衡与大规模部署实践',
    icon: 'Network',
    color: '#10b981',
    subcategories: [
      { id: 'sub-9-1', categoryId: 'cat-9', name: '分布式架构设计', slug: 'distributed-architecture', description: '分布式推理系统的整体架构设计原则' },
      { id: 'sub-9-2', categoryId: 'cat-9', name: '通信优化', slug: 'distributed-communication', description: 'NCCL等通信库的优化与RDMA加速' },
      { id: 'sub-9-3', categoryId: 'cat-9', name: '负载均衡', slug: 'distributed-loadbalancing', description: '请求调度与GPU资源负载均衡策略' },
      { id: 'sub-9-4', categoryId: 'cat-9', name: '容错机制', slug: 'distributed-faulttolerance', description: '分布式推理的故障检测与恢复机制' },
      { id: 'sub-9-5', categoryId: 'cat-9', name: '多节点协同推理', slug: 'distributed-collaborative', description: '多节点协同推理的调度与同步策略' },
      { id: 'sub-9-6', categoryId: 'cat-9', name: '大规模部署实践', slug: 'distributed-deployment', description: '生产环境大规模推理集群的部署最佳实践' },
    ],
  },
]

export const learningPaths: LearningPath[] = [
  {
    id: 'lp-1',
    title: '入门路径',
    description: '从推理基础概念出发，理解LLM推理的核心流程与关键概念',
    level: 'beginner',
    color: '#22c55e',
    topics: ['推理流程概览', 'Prefill与Decode基础', '采样策略入门', '量化基础概念'],
  },
  {
    id: 'lp-2',
    title: '进阶路径',
    description: '深入推理优化技术，掌握并行策略、量化方法与推理框架',
    level: 'intermediate',
    color: '#00d4ff',
    topics: ['张量并行与流水线并行', 'GPTQ/AWQ量化实践', 'SGLang框架使用', 'Continuous Batching'],
  },
  {
    id: 'lp-3',
    title: '专家路径',
    description: '掌握前沿推理技术与大规模部署，具备系统级优化能力',
    level: 'advanced',
    color: '#a855f7',
    topics: ['投机推理实现', 'SGLang源码解析', '分布式推理架构', '大规模部署调优'],
  },
]

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug)
}

export function getSubCategoryBySlug(categorySlug: string, subSlug: string): Category['subcategories'][0] | undefined {
  const cat = getCategoryBySlug(categorySlug)
  return cat?.subcategories.find((s) => s.slug === subSlug)
}
