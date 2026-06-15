import type { Category, LearningPath } from '@/types'

export const categories: Category[] = [
  {
    id: 'cat-1',
    name: '大模型并行策略',
    slug: 'parallel-strategy',
    description: '大模型推理与训练中的并行计算策略，包含DP/TP/PP/SP/EP推理并行策略的教学版Python Demo与讲义',
    icon: 'GitBranch',
    color: '#00d4ff',
    subcategories: [
      { id: 'sub-1-7', categoryId: 'cat-1', name: '并行策略教学Demo', slug: 'parallel-demos', description: 'DP/TP/PP/SP/EP推理并行策略的教学版Python Demo与讲义' },
    ],
  },
  {
    id: 'cat-2',
    name: 'LoRA',
    slug: 'lora',
    description: '参数高效微调的核心技术，包含LoRA/QLoRA/DoRA/AdaLoRA的教学版实现与代码导读',
    icon: 'Puzzle',
    color: '#a855f7',
    subcategories: [
      { id: 'sub-2-7', categoryId: 'cat-2', name: 'LoRA教学Demo', slug: 'lora-demos', description: 'LoRA/QLoRA/DoRA/AdaLoRA的教学版实现与代码导读' },
    ],
  },
  {
    id: 'cat-3',
    name: 'Prefill',
    slug: 'prefill',
    description: '推理预填充阶段的核心技术，包含FlashAttention、KV Cache、Chunked Prefill的教学版Python实现',
    icon: 'FastForward',
    color: '#22c55e',
    subcategories: [
      { id: 'sub-3-6', categoryId: 'cat-3', name: 'Prefill教学Demo', slug: 'prefill-demos', description: 'FlashAttention、KV Cache、Chunked Prefill的教学版Python实现' },
    ],
  },
  {
    id: 'cat-4',
    name: 'Decode',
    slug: 'decode',
    description: '推理解码阶段的核心算法，包含FlashDecoding等Decode阶段优化的教学版Python实现',
    icon: 'Terminal',
    color: '#f59e0b',
    subcategories: [
      { id: 'sub-4-6', categoryId: 'cat-4', name: 'Decode教学Demo', slug: 'decode-demos', description: 'FlashDecoding等Decode阶段优化的教学版Python实现' },
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
      { id: 'sub-8-4', categoryId: 'cat-8', name: 'Ascend NPU适配', slug: 'sglang-ascend-npu', description: 'SGLang在华为昇腾NPU上的适配实践：环境搭建→最小服务→Attention/Graph/HCCL/PD分离/LoRA等NPU专属适配详解' },
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
    topics: ['Prefill与Decode基础', 'KV Cache原理', '并行策略概览', 'LoRA入门'],
  },
  {
    id: 'lp-2',
    title: '进阶路径',
    description: '深入推理优化技术，掌握并行策略实现与推理框架使用',
    level: 'intermediate',
    color: '#00d4ff',
    topics: ['FlashAttention实现', 'DP/TP/PP并行Demo', 'SGLang框架使用', 'Chunked Prefill调度'],
  },
  {
    id: 'lp-3',
    title: '专家路径',
    description: '掌握SGLang源码级理解，具备系统级推理优化能力',
    level: 'advanced',
    color: '#a855f7',
    topics: ['SGLang源码解析', 'Scheduler架构深度', 'TP Worker实现', 'PD分离架构'],
  },
]

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug)
}

export function getSubCategoryBySlug(categorySlug: string, subSlug: string): Category['subcategories'][0] | undefined {
  const cat = getCategoryBySlug(categorySlug)
  return cat?.subcategories.find((s) => s.slug === subSlug)
}
