import type { Article } from '@/types'

// ==================== Model Architecture (cat-5 / sub-5-1) ====================
import ma01Zh from './content/zh/ai-infra-basic/Model_Architecture/01-decoder-only-transformer.md?raw'
import ma01En from './content/en/ai-infra-basic/Model_Architecture/01-decoder-only-transformer.md?raw'
import ma02Zh from './content/zh/ai-infra-basic/Model_Architecture/02-gqa-attention-shapes.md?raw'
import ma02En from './content/en/ai-infra-basic/Model_Architecture/02-gqa-attention-shapes.md?raw'
import ma03Zh from './content/zh/ai-infra-basic/Model_Architecture/03-sparse-moe-routing.md?raw'
import ma03En from './content/en/ai-infra-basic/Model_Architecture/03-sparse-moe-routing.md?raw'
import ma04Zh from './content/zh/ai-infra-basic/Model_Architecture/04-multi-head-latent-attention.md?raw'
import ma04En from './content/en/ai-infra-basic/Model_Architecture/04-multi-head-latent-attention.md?raw'
import ma05Zh from './content/zh/ai-infra-basic/Model_Architecture/05-architecture-families.md?raw'
import ma05En from './content/en/ai-infra-basic/Model_Architecture/05-architecture-families.md?raw'

// ==================== Parallel Strategy (cat-1 / sub-1-7) ====================
import psTutorialZh from './content/zh/ai-infra-basic/Parallel_Strategy/tutorial.md?raw'
import psTutorialEn from './content/en/ai-infra-basic/Parallel_Strategy/tutorial.md?raw'
import psReadmeZh from './content/zh/ai-infra-basic/Parallel_Strategy/README.md?raw'
import psReadmeEn from './content/en/ai-infra-basic/Parallel_Strategy/README.md?raw'
import psDpZh from './content/zh/ai-infra-basic/Parallel_Strategy/dp_inference_demo.py?raw'
import psDpEn from './content/en/ai-infra-basic/Parallel_Strategy/dp_inference_demo.py?raw'
import psTpZh from './content/zh/ai-infra-basic/Parallel_Strategy/tp_inference_demo.py?raw'
import psTpEn from './content/en/ai-infra-basic/Parallel_Strategy/tp_inference_demo.py?raw'
import psPpZh from './content/zh/ai-infra-basic/Parallel_Strategy/pp_inference_demo.py?raw'
import psPpEn from './content/en/ai-infra-basic/Parallel_Strategy/pp_inference_demo.py?raw'
import psSpZh from './content/zh/ai-infra-basic/Parallel_Strategy/sp_inference_demo.py?raw'
import psSpEn from './content/en/ai-infra-basic/Parallel_Strategy/sp_inference_demo.py?raw'
import psEpZh from './content/zh/ai-infra-basic/Parallel_Strategy/ep_moe_demo.py?raw'
import psEpEn from './content/en/ai-infra-basic/Parallel_Strategy/ep_moe_demo.py?raw'

// ==================== LoRA (cat-2 / sub-2-7) ====================
import loraReadmeZh from './content/zh/ai-infra-basic/LoRA/README.md?raw'
import loraReadmeEn from './content/en/ai-infra-basic/LoRA/README.md?raw'
import loraBasicZh from './content/zh/ai-infra-basic/LoRA/lora_tutorial.py?raw'
import loraBasicEn from './content/en/ai-infra-basic/LoRA/lora_tutorial.py?raw'
import loraQloraZh from './content/zh/ai-infra-basic/LoRA/qlora_tutorial.py?raw'
import loraQloraEn from './content/en/ai-infra-basic/LoRA/qlora_tutorial.py?raw'
import loraDoraZh from './content/zh/ai-infra-basic/LoRA/dora_tutorial.py?raw'
import loraDoraEn from './content/en/ai-infra-basic/LoRA/dora_tutorial.py?raw'
import loraAdaZh from './content/zh/ai-infra-basic/LoRA/adalora_tutorial.py?raw'
import loraAdaEn from './content/en/ai-infra-basic/LoRA/adalora_tutorial.py?raw'

// ==================== Schedule Optimization / Prefill (cat-3 / sub-3-6) ====================
import schedReadmeZh from './content/zh/ai-infra-basic/Schedule_Optimization/README.md?raw'
import schedReadmeEn from './content/en/ai-infra-basic/Schedule_Optimization/README.md?raw'
import schedPdZh from './content/zh/ai-infra-basic/Schedule_Optimization/prefill_decode_demo.py?raw'
import schedPdEn from './content/en/ai-infra-basic/Schedule_Optimization/prefill_decode_demo.py?raw'
import schedChunkZh from './content/zh/ai-infra-basic/Schedule_Optimization/chunked_prefill_with_fakeLLM_tutorial.py?raw'
import schedChunkEn from './content/en/ai-infra-basic/Schedule_Optimization/chunked_prefill_with_fakeLLM_tutorial.py?raw'

// ==================== Attention Kernel / Decode (cat-4 / sub-4-6) ====================
import akReadmeZh from './content/zh/ai-infra-basic/Attention_Kernel/README.md?raw'
import akReadmeEn from './content/en/ai-infra-basic/Attention_Kernel/README.md?raw'
import akFaZh from './content/zh/ai-infra-basic/Attention_Kernel/flash_attention_tutorial.py?raw'
import akFaEn from './content/en/ai-infra-basic/Attention_Kernel/flash_attention_tutorial.py?raw'
import akFdZh from './content/zh/ai-infra-basic/Attention_Kernel/flash_decoding_tutorial.py?raw'
import akFdEn from './content/en/ai-infra-basic/Attention_Kernel/flash_decoding_tutorial.py?raw'

// ==================== Inference Basics (cat-10 / sub-10-1) ====================
import ibReadmeZh from './content/zh/ai-infra-basic/Inference_Basics/README.md?raw'
import ibReadmeEn from './content/en/ai-infra-basic/Inference_Basics/README.md?raw'

// ==================== KV Cache Memory (cat-11 / sub-11-1) ====================
import kvReadmeZh from './content/zh/ai-infra-basic/KV_Cache_Memory/README.md?raw'
import kvReadmeEn from './content/en/ai-infra-basic/KV_Cache_Memory/README.md?raw'

// ==================== KV Transfer (cat-12 / sub-12-1) ====================
import kvtReadmeZh from './content/zh/ai-infra-basic/KV_Transfer/README.md?raw'
import kvtReadmeEn from './content/en/ai-infra-basic/KV_Transfer/README.md?raw'

// ==================== Speculative Decoding (cat-6 / sub-6-1) ====================
import sd01Zh from './content/zh/ai-infra-basic/Speculative_Decoding/01-speculative-decoding-principles.md?raw'
import sd01En from './content/en/ai-infra-basic/Speculative_Decoding/01-speculative-decoding-principles.md?raw'
import sd02Zh from './content/zh/ai-infra-basic/Speculative_Decoding/02-rejection-sampling-math.md?raw'
import sd02En from './content/en/ai-infra-basic/Speculative_Decoding/02-rejection-sampling-math.md?raw'
import sd03Zh from './content/zh/ai-infra-basic/Speculative_Decoding/03-serving-implementation-dataflow.md?raw'
import sd03En from './content/en/ai-infra-basic/Speculative_Decoding/03-serving-implementation-dataflow.md?raw'
import sd04Zh from './content/zh/ai-infra-basic/Speculative_Decoding/04-algorithm-landscape.md?raw'
import sd04En from './content/en/ai-infra-basic/Speculative_Decoding/04-algorithm-landscape.md?raw'

// ==================== Mamba (cat-7 / sub-7-1) ====================
import mb01Zh from './content/zh/ai-infra-basic/Mamba_State_Space/01-mamba-and-sglang-state.md?raw'
import mb01En from './content/en/ai-infra-basic/Mamba_State_Space/01-mamba-and-sglang-state.md?raw'
import mb02Zh from './content/zh/ai-infra-basic/Mamba_State_Space/02-mamba-principles.md?raw'
import mb02En from './content/en/ai-infra-basic/Mamba_State_Space/02-mamba-principles.md?raw'
import mb03Zh from './content/zh/ai-infra-basic/Mamba_State_Space/03-mamba-radix-cache.md?raw'
import mb03En from './content/en/ai-infra-basic/Mamba_State_Space/03-mamba-radix-cache.md?raw'

// ==================== Quantization (cat-13 / sub-13-1) ====================
import quantReadmeZh from './content/zh/ai-infra-basic/Quantization/README.md?raw'
import quantReadmeEn from './content/en/ai-infra-basic/Quantization/README.md?raw'

// ==================== Benchmark Profiling (cat-14 / sub-14-1) ====================
import bpReadmeZh from './content/zh/ai-infra-basic/Benchmark_Profiling/README.md?raw'
import bpReadmeEn from './content/en/ai-infra-basic/Benchmark_Profiling/README.md?raw'

// ==================== Execution Graph (cat-9 / sub-9-1) ====================
import eg01Zh from './content/zh/ai-infra-basic/Execution_Graph/01-what-is-graph.md?raw'
import eg01En from './content/en/ai-infra-basic/Execution_Graph/01-what-is-graph.md?raw'
import eg02Zh from './content/zh/ai-infra-basic/Execution_Graph/02-graph-execution-dataflow.md?raw'
import eg02En from './content/en/ai-infra-basic/Execution_Graph/02-graph-execution-dataflow.md?raw'

// Helper: wrap raw .py content in a python code block
function py(content: string): string {
  return '```python\n' + content + '\n```'
}

export const aiInfraBasicArticles: Article[] = [
  // -------- Model Architecture --------
  {
    id: 'ma-01',
    categoryId: 'cat-5',
    subCategoryId: 'sub-5-1',
    title: 'Decoder-only Transformer：从 Token 到下一个 Token',
    titleEn: 'Decoder-only Transformer: From Token to Next Token',
    slug: 'decoder-only-transformer',
    summary: '从 token 序列到 logits 的完整数据流，解析 embedding、RoPE、Pre-Norm Decoder Block 的实现细节',
    summaryEn: 'Complete dataflow from token sequence to logits, parsing embedding, RoPE, and Pre-Norm Decoder Block implementation',
    content: ma01Zh,
    contentEn: ma01En,
    tags: ['Transformer', 'Decoder-Only', 'RoPE'],
    readTime: '20 min',
    date: '2025-03-01',
    prevArticleId: null,
    nextArticleId: 'ma-02',
  },
  {
    id: 'ma-02',
    categoryId: 'cat-5',
    subCategoryId: 'sub-5-1',
    title: 'GQA：分组查询注意力的张量形状流',
    titleEn: 'GQA: Grouped-Query Attention Tensor Shape Flow',
    slug: 'gqa-attention-shapes',
    summary: 'MHA→GQA→MQA 的演进，通过张量形状流图解 GQA 的 KV 头复用机制',
    summaryEn: 'Evolution from MHA to GQA to MQA, with tensor shape flow diagrams of KV head reuse',
    content: ma02Zh,
    contentEn: ma02En,
    tags: ['GQA', 'Attention', 'KV Cache'],
    readTime: '15 min',
    date: '2025-03-02',
    prevArticleId: 'ma-01',
    nextArticleId: 'ma-03',
  },
  {
    id: 'ma-03',
    categoryId: 'cat-5',
    subCategoryId: 'sub-5-1',
    title: 'Sparse MoE：路由数据流与负载均衡',
    titleEn: 'Sparse MoE: Routing Dataflow and Load Balancing',
    slug: 'sparse-moe-routing',
    summary: 'Top-K 路由、expert 计算与 combine 的完整数据流，解析负载均衡损失与容量因子',
    summaryEn: 'Complete dataflow of Top-K routing, expert computation, and combine, with load balancing loss and capacity factor',
    content: ma03Zh,
    contentEn: ma03En,
    tags: ['MoE', 'Sparse', 'Routing'],
    readTime: '18 min',
    date: '2025-03-03',
    prevArticleId: 'ma-02',
    nextArticleId: 'ma-04',
  },
  {
    id: 'ma-04',
    categoryId: 'cat-5',
    subCategoryId: 'sub-5-1',
    title: 'MLA：多头潜在注意力的低秩压缩',
    titleEn: 'MLA: Multi-Head Latent Attention with Low-Rank Compression',
    slug: 'multi-head-latent-attention',
    summary: 'DeepSeek MLA 的下投影压缩与上投影还原，KV Cache 显存优化原理',
    summaryEn: 'DeepSeek MLA down-projection compression and up-projection restoration, KV Cache memory optimization',
    content: ma04Zh,
    contentEn: ma04En,
    tags: ['MLA', 'DeepSeek', 'KV Cache'],
    readTime: '20 min',
    date: '2025-03-04',
    prevArticleId: 'ma-03',
    nextArticleId: 'ma-05',
  },
  {
    id: 'ma-05',
    categoryId: 'cat-5',
    subCategoryId: 'sub-5-1',
    title: '主流模型架构家族谱系',
    titleEn: 'Mainstream Model Architecture Families',
    slug: 'architecture-families',
    summary: '从 GPT 到 Llama、Mistral、DeepSeek、Qwen 的架构演进谱系图',
    summaryEn: 'Architecture evolution family tree from GPT to Llama, Mistral, DeepSeek, and Qwen',
    content: ma05Zh,
    contentEn: ma05En,
    tags: ['架构谱系', 'Llama', 'DeepSeek'],
    readTime: '15 min',
    date: '2025-03-05',
    prevArticleId: 'ma-04',
    nextArticleId: null,
  },

  // -------- Parallel Strategy --------
  {
    id: 'ps-01',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: '并行策略总讲义：DP/TP/PP/SP/EP',
    titleEn: 'Parallel Strategy Tutorial: DP/TP/PP/SP/EP',
    slug: 'parallel-strategy-tutorial',
    summary: '系统讲解 DP、TP、PP、SP/CP、EP 分别切什么、解决什么问题、通信代价是什么',
    summaryEn: 'Systematic explanation of what DP, TP, PP, SP/CP, EP split, what problems they solve, and their communication costs',
    content: psTutorialZh,
    contentEn: psTutorialEn,
    tags: ['并行策略', 'DP', 'TP', 'PP', 'SP', 'EP'],
    readTime: '30 min',
    date: '2025-02-01',
    prevArticleId: null,
    nextArticleId: 'ps-02',
  },
  {
    id: 'ps-02',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: '并行策略教学入口导读',
    titleEn: 'Parallel Strategy Learning Overview',
    slug: 'parallel-strategy-overview',
    summary: '并行策略教学Demo总览：文件说明与学习路径',
    summaryEn: 'Overview of parallel strategy demos: file descriptions and learning path',
    content: psReadmeZh,
    contentEn: psReadmeEn,
    tags: ['并行策略', '导读'],
    readTime: '5 min',
    date: '2025-02-02',
    prevArticleId: 'ps-01',
    nextArticleId: 'ps-03',
  },
  {
    id: 'ps-03',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: 'Data Parallelism 推理 Demo',
    titleEn: 'Data Parallelism Inference Demo',
    slug: 'dp-inference-demo',
    summary: '请求或 batch 维度如何分发到多个完整模型副本',
    summaryEn: 'How requests or batches are distributed to multiple complete model replicas',
    content: py(psDpZh),
    contentEn: py(psDpEn),
    tags: ['DP', 'Demo'],
    readTime: '15 min',
    date: '2025-02-03',
    prevArticleId: 'ps-02',
    nextArticleId: 'ps-04',
  },
  {
    id: 'ps-04',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: 'Tensor Parallelism 推理 Demo',
    titleEn: 'Tensor Parallelism Inference Demo',
    slug: 'tp-inference-demo',
    summary: 'Linear/Attention/FFN 的矩阵如何切到多个 rank',
    summaryEn: 'How Linear/Attention/FFN matrices are split across ranks',
    content: py(psTpZh),
    contentEn: py(psTpEn),
    tags: ['TP', 'Demo'],
    readTime: '20 min',
    date: '2025-02-04',
    prevArticleId: 'ps-03',
    nextArticleId: 'ps-05',
  },
  {
    id: 'ps-05',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: 'Pipeline Parallelism 推理 Demo',
    titleEn: 'Pipeline Parallelism Inference Demo',
    slug: 'pp-inference-demo',
    summary: 'Transformer 层如何分段，hidden states 如何跨 stage 传递',
    summaryEn: 'How Transformer layers are staged and hidden states pass across stages',
    content: py(psPpZh),
    contentEn: py(psPpEn),
    tags: ['PP', 'Demo'],
    readTime: '18 min',
    date: '2025-02-05',
    prevArticleId: 'ps-04',
    nextArticleId: 'ps-06',
  },
  {
    id: 'ps-06',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: 'Sequence/Context Parallelism 推理 Demo',
    titleEn: 'Sequence/Context Parallelism Inference Demo',
    slug: 'sp-inference-demo',
    summary: '长序列或长上下文如何按 sequence/context 维度拆分',
    summaryEn: 'How long sequences/contexts are split along the sequence/context dimension',
    content: py(psSpZh),
    contentEn: py(psSpEn),
    tags: ['SP', 'CP', 'Demo'],
    readTime: '18 min',
    date: '2025-02-06',
    prevArticleId: 'ps-05',
    nextArticleId: 'ps-07',
  },
  {
    id: 'ps-07',
    categoryId: 'cat-1',
    subCategoryId: 'sub-1-7',
    title: 'Expert Parallelism (MoE) Demo',
    titleEn: 'Expert Parallelism (MoE) Demo',
    slug: 'ep-moe-demo',
    summary: 'MoE 的 expert 如何分布到多个 rank，all-to-all 通信模式',
    summaryEn: 'How MoE experts are distributed across ranks, with all-to-all communication',
    content: py(psEpZh),
    contentEn: py(psEpEn),
    tags: ['EP', 'MoE', 'Demo'],
    readTime: '18 min',
    date: '2025-02-07',
    prevArticleId: 'ps-06',
    nextArticleId: null,
  },

  // -------- LoRA --------
  {
    id: 'lora-01',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-7',
    title: 'LoRA 系列教学入口导读',
    titleEn: 'LoRA Series Learning Overview',
    slug: 'lora-overview',
    summary: 'LoRA/QLoRA/DoRA/AdaLoRA 教学Demo总览与学习路径',
    summaryEn: 'Overview of LoRA/QLoRA/DoRA/AdaLoRA educational demos and learning path',
    content: loraReadmeZh,
    contentEn: loraReadmeEn,
    tags: ['LoRA', '导读'],
    readTime: '5 min',
    date: '2025-02-10',
    prevArticleId: null,
    nextArticleId: 'lora-02',
  },
  {
    id: 'lora-02',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-7',
    title: 'LoRA 基础实现',
    titleEn: 'LoRA Basic Implementation',
    slug: 'lora-basic',
    summary: '低秩矩阵 A/B 如何注入 Linear，如何 freeze base model，如何 merge/unmerge',
    summaryEn: 'How low-rank A/B matrices inject into Linear, freeze base model, and merge/unmerge',
    content: py(loraBasicZh),
    contentEn: py(loraBasicEn),
    tags: ['LoRA', 'Demo'],
    readTime: '20 min',
    date: '2025-02-11',
    prevArticleId: 'lora-01',
    nextArticleId: 'lora-03',
  },
  {
    id: 'lora-03',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-7',
    title: 'QLoRA 教学实现',
    titleEn: 'QLoRA Educational Implementation',
    slug: 'qlora',
    summary: '4-bit base weight 与 LoRA 分支如何一起训练，量化 buffer 如何组织',
    summaryEn: 'How 4-bit base weights and LoRA branches train together, quantization buffer organization',
    content: py(loraQloraZh),
    contentEn: py(loraQloraEn),
    tags: ['QLoRA', '量化', 'Demo'],
    readTime: '20 min',
    date: '2025-02-12',
    prevArticleId: 'lora-02',
    nextArticleId: 'lora-04',
  },
  {
    id: 'lora-04',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-7',
    title: 'DoRA 教学实现',
    titleEn: 'DoRA Educational Implementation',
    slug: 'dora',
    summary: 'Weight-Decomposed Low-Rank Adaptation：将权重分解为方向和幅度',
    summaryEn: 'Weight-Decomposed Low-Rank Adaptation: decomposing weights into direction and magnitude',
    content: py(loraDoraZh),
    contentEn: py(loraDoraEn),
    tags: ['DoRA', 'Demo'],
    readTime: '18 min',
    date: '2025-02-13',
    prevArticleId: 'lora-03',
    nextArticleId: 'lora-05',
  },
  {
    id: 'lora-05',
    categoryId: 'cat-2',
    subCategoryId: 'sub-2-7',
    title: 'AdaLoRA 教学实现',
    titleEn: 'AdaLoRA Educational Implementation',
    slug: 'adalora',
    summary: 'Adaptive Budget Allocation：动态分配 LoRA 秩给不同层',
    summaryEn: 'Adaptive Budget Allocation: dynamically allocating LoRA rank to different layers',
    content: py(loraAdaZh),
    contentEn: py(loraAdaEn),
    tags: ['AdaLoRA', 'Demo'],
    readTime: '18 min',
    date: '2025-02-14',
    prevArticleId: 'lora-04',
    nextArticleId: null,
  },

  // -------- Schedule Optimization / Prefill --------
  {
    id: 'sched-01',
    categoryId: 'cat-3',
    subCategoryId: 'sub-3-6',
    title: '调度优化教学入口导读',
    titleEn: 'Schedule Optimization Learning Overview',
    slug: 'schedule-optimization-overview',
    summary: 'Prefill/Decode 差异、KV Cache 作用、Chunked Prefill 调度教学Demo总览',
    summaryEn: 'Overview of Prefill/Decode differences, KV Cache role, and Chunked Prefill scheduling demos',
    content: schedReadmeZh,
    contentEn: schedReadmeEn,
    tags: ['调度', 'Prefill', '导读'],
    readTime: '5 min',
    date: '2025-02-15',
    prevArticleId: null,
    nextArticleId: 'sched-02',
  },
  {
    id: 'sched-02',
    categoryId: 'cat-3',
    subCategoryId: 'sub-3-6',
    title: '带 KV Cache 的 Prefill/Decode Demo',
    titleEn: 'Prefill/Decode Demo with KV Cache',
    slug: 'prefill-decode-demo',
    summary: 'prefill 一次处理 prompt，decode 每次处理一个新 token，KV Cache 如何避免重复计算',
    summaryEn: 'Prefill processes prompt once, decode processes one new token each step, how KV Cache avoids recomputation',
    content: py(schedPdZh),
    contentEn: py(schedPdEn),
    tags: ['Prefill', 'Decode', 'KV Cache', 'Demo'],
    readTime: '20 min',
    date: '2025-02-16',
    prevArticleId: 'sched-01',
    nextArticleId: 'sched-03',
  },
  {
    id: 'sched-03',
    categoryId: 'cat-3',
    subCategoryId: 'sub-3-6',
    title: 'Chunked Prefill 调度模拟',
    titleEn: 'Chunked Prefill Scheduling Simulation',
    slug: 'chunked-prefill-demo',
    summary: '长 prompt 如何拆成多个 chunk，decode 请求如何穿插执行',
    summaryEn: 'How long prompts are split into chunks and decode requests interleave',
    content: py(schedChunkZh),
    contentEn: py(schedChunkEn),
    tags: ['Chunked Prefill', '调度', 'Demo'],
    readTime: '25 min',
    date: '2025-02-17',
    prevArticleId: 'sched-02',
    nextArticleId: null,
  },

  // -------- Attention Kernel / Decode --------
  {
    id: 'ak-01',
    categoryId: 'cat-4',
    subCategoryId: 'sub-4-6',
    title: 'Attention Kernel 教学入口导读',
    titleEn: 'Attention Kernel Learning Overview',
    slug: 'attention-kernel-overview',
    summary: 'FlashAttention 与 FlashDecoding 教学Demo总览',
    summaryEn: 'Overview of FlashAttention and FlashDecoding educational demos',
    content: akReadmeZh,
    contentEn: akReadmeEn,
    tags: ['Attention', '导读'],
    readTime: '5 min',
    date: '2025-02-18',
    prevArticleId: null,
    nextArticleId: 'ak-02',
  },
  {
    id: 'ak-02',
    categoryId: 'cat-4',
    subCategoryId: 'sub-4-6',
    title: 'FlashAttention Forward 教学版',
    titleEn: 'FlashAttention Forward Educational Version',
    slug: 'flash-attention-tutorial',
    summary: '分块 attention、online softmax、避免显式保存完整 attention matrix',
    summaryEn: 'Tiled attention, online softmax, avoiding explicit full attention matrix storage',
    content: py(akFaZh),
    contentEn: py(akFaEn),
    tags: ['FlashAttention', 'Demo'],
    readTime: '25 min',
    date: '2025-02-19',
    prevArticleId: 'ak-01',
    nextArticleId: 'ak-03',
  },
  {
    id: 'ak-03',
    categoryId: 'cat-4',
    subCategoryId: 'sub-4-6',
    title: 'FlashDecoding 教学版',
    titleEn: 'FlashDecoding Educational Version',
    slug: 'flash-decoding-tutorial',
    summary: 'decode 单 token 查询、KV block partial result、跨 block 合并',
    summaryEn: 'Decode single-token query, KV block partial results, cross-block merge',
    content: py(akFdZh),
    contentEn: py(akFdEn),
    tags: ['FlashDecoding', 'Decode', 'Demo'],
    readTime: '20 min',
    date: '2025-02-20',
    prevArticleId: 'ak-02',
    nextArticleId: null,
  },

  // -------- Inference Basics --------
  {
    id: 'ib-01',
    categoryId: 'cat-10',
    subCategoryId: 'sub-10-1',
    title: 'LLM 推理基础：Prefill/Decode/KV Cache/采样',
    titleEn: 'LLM Inference Basics: Prefill/Decode/KV Cache/Sampling',
    slug: 'inference-basics',
    summary: 'LLM 推理到底在做什么：Prefill、Decode、KV Cache、采样、TTFT/ITL 等核心概念',
    summaryEn: 'What LLM inference actually does: Prefill, Decode, KV Cache, sampling, TTFT/ITL core concepts',
    content: ibReadmeZh,
    contentEn: ibReadmeEn,
    tags: ['推理基础', 'Prefill', 'Decode', 'KV Cache'],
    readTime: '15 min',
    date: '2025-01-10',
    prevArticleId: null,
    nextArticleId: null,
  },

  // -------- KV Cache Memory --------
  {
    id: 'kvc-01',
    categoryId: 'cat-11',
    subCategoryId: 'sub-11-1',
    title: 'KV Cache 与显存管理',
    titleEn: 'KV Cache and Memory Management',
    slug: 'kv-cache-memory',
    summary: 'KV Cache 形状、分配、复用和回收：布局、分页、前缀缓存与显存估算',
    summaryEn: 'KV Cache shape, allocation, reuse, and recycling: layout, paging, prefix cache, and memory estimation',
    content: kvReadmeZh,
    contentEn: kvReadmeEn,
    tags: ['KV Cache', '显存', 'PagedAttention'],
    readTime: '20 min',
    date: '2025-01-15',
    prevArticleId: null,
    nextArticleId: null,
  },

  // -------- KV Transfer --------
  {
    id: 'kvt-01',
    categoryId: 'cat-12',
    subCategoryId: 'sub-12-1',
    title: 'KV Transfer 与 PD 分离架构',
    titleEn: 'KV Transfer and PD Disaggregation Architecture',
    slug: 'kv-transfer',
    summary: 'KV Cache 如何跨 worker/节点移动：Bootstrap、Prealloc、KV Transfer 引擎',
    summaryEn: 'How KV Cache moves across workers/nodes: Bootstrap, Prealloc, KV Transfer engine',
    content: kvtReadmeZh,
    contentEn: kvtReadmeEn,
    tags: ['KV Transfer', 'PD分离', 'Disaggregation'],
    readTime: '18 min',
    date: '2025-01-20',
    prevArticleId: null,
    nextArticleId: null,
  },

  // -------- Speculative Decoding --------
  {
    id: 'sd-01',
    categoryId: 'cat-6',
    subCategoryId: 'sub-6-1',
    title: '投机解码原理：单轮流程与加速条件',
    titleEn: 'Speculative Decoding Principles: Single Round Flow and Speedup Conditions',
    slug: 'speculative-decoding-principles',
    summary: '投机解码的核心思想、单轮流程图、为什么可能加速以及何时会变慢',
    summaryEn: 'Core idea of speculative decoding, single round flow diagram, why it can speed up and when it slows down',
    content: sd01Zh,
    contentEn: sd01En,
    tags: ['投机解码', 'Speculative'],
    readTime: '20 min',
    date: '2025-01-25',
    prevArticleId: null,
    nextArticleId: 'sd-02',
  },
  {
    id: 'sd-02',
    categoryId: 'cat-6',
    subCategoryId: 'sub-6-1',
    title: '拒绝采样数学推导：分布不变性证明',
    titleEn: 'Rejection Sampling Math: Distribution Invariance Proof',
    slug: 'rejection-sampling-math',
    summary: '严格投机采样为什么可以不改变目标模型分布的完整数学推导',
    summaryEn: 'Complete mathematical proof of why strict speculative sampling preserves the target model distribution',
    content: sd02Zh,
    contentEn: sd02En,
    tags: ['拒绝采样', '数学推导', 'Speculative'],
    readTime: '30 min',
    date: '2025-01-26',
    prevArticleId: 'sd-01',
    nextArticleId: 'sd-03',
  },
  {
    id: 'sd-03',
    categoryId: 'cat-6',
    subCategoryId: 'sub-6-1',
    title: '服务化投机解码实现数据流',
    titleEn: 'Serving Speculative Decoding Implementation Dataflow',
    slug: 'speculative-decoding-serving',
    summary: '在线 serving 系统如何管理 draft token、target verify、KV Cache 与 scheduler',
    summaryEn: 'How online serving systems manage draft tokens, target verify, KV Cache, and scheduler',
    content: sd03Zh,
    contentEn: sd03En,
    tags: ['服务化', '数据流', 'Speculative'],
    readTime: '25 min',
    date: '2025-01-27',
    prevArticleId: 'sd-02',
    nextArticleId: 'sd-04',
  },
  {
    id: 'sd-04',
    categoryId: 'cat-6',
    subCategoryId: 'sub-6-1',
    title: '投机推理算法谱系全景',
    titleEn: 'Speculative Inference Algorithm Landscape',
    slug: 'speculative-decoding-landscape',
    summary: '从 draft model 到 self-speculative、 Medusa、EAGLE 等投机推理算法变体谱系',
    summaryEn: 'Algorithm variants from draft model to self-speculative, Medusa, EAGLE and beyond',
    content: sd04Zh,
    contentEn: sd04En,
    tags: ['算法谱系', 'Medusa', 'EAGLE'],
    readTime: '20 min',
    date: '2025-01-28',
    prevArticleId: 'sd-03',
    nextArticleId: null,
  },

  // -------- Mamba --------
  {
    id: 'mb-01',
    categoryId: 'cat-7',
    subCategoryId: 'sub-7-1',
    title: 'Mamba 与 SGLang State 概述',
    titleEn: 'Mamba and SGLang State Overview',
    slug: 'mamba-and-sglang-state',
    summary: 'State Space Model 与 Mamba 基本原理，SGLang 中 Mamba state 的内存、调度与数据流',
    summaryEn: 'State Space Model and Mamba principles, Mamba state memory, scheduling, and dataflow in SGLang',
    content: mb01Zh,
    contentEn: mb01En,
    tags: ['Mamba', 'SSM', 'SGLang'],
    readTime: '25 min',
    date: '2025-02-22',
    prevArticleId: null,
    nextArticleId: 'mb-02',
  },
  {
    id: 'mb-02',
    categoryId: 'cat-7',
    subCategoryId: 'sub-7-1',
    title: 'Mamba 模型原理与 forward 实现',
    titleEn: 'Mamba Model Principles and Forward Implementation',
    slug: 'mamba-principles',
    summary: 'Mamba2 block 的 forward 实现、prefill/decode kernel 路径',
    summaryEn: 'Mamba2 block forward implementation, prefill/decode kernel paths',
    content: mb02Zh,
    contentEn: mb02En,
    tags: ['Mamba', 'Mamba2', 'forward'],
    readTime: '30 min',
    date: '2025-02-23',
    prevArticleId: 'mb-01',
    nextArticleId: 'mb-03',
  },
  {
    id: 'mb-03',
    categoryId: 'cat-7',
    subCategoryId: 'sub-7-1',
    title: 'Mamba Radix Cache 适配',
    titleEn: 'Mamba Radix Cache Adaptation',
    slug: 'mamba-radix-cache',
    summary: 'Radix Cache 如何适配 Mamba 的 state-based 前缀复用',
    summaryEn: 'How Radix Cache adapts to Mamba state-based prefix reuse',
    content: mb03Zh,
    contentEn: mb03En,
    tags: ['Mamba', 'Radix Cache', '前缀复用'],
    readTime: '20 min',
    date: '2025-02-24',
    prevArticleId: 'mb-02',
    nextArticleId: null,
  },

  // -------- Quantization --------
  {
    id: 'quant-01',
    categoryId: 'cat-13',
    subCategoryId: 'sub-13-1',
    title: '推理量化：Weight-only/W8A8/FP8/KV Cache',
    titleEn: 'Inference Quantization: Weight-only/W8A8/FP8/KV Cache',
    slug: 'quantization',
    summary: '量化对象、GPTQ/AWQ、W8A8/FP8、KV Cache 量化与校准的系统性讲解',
    summaryEn: 'Systematic coverage of quantization targets, GPTQ/AWQ, W8A8/FP8, KV Cache quantization, and calibration',
    content: quantReadmeZh,
    contentEn: quantReadmeEn,
    tags: ['量化', 'GPTQ', 'AWQ', 'FP8'],
    readTime: '20 min',
    date: '2025-01-30',
    prevArticleId: null,
    nextArticleId: null,
  },

  // -------- Benchmark Profiling --------
  {
    id: 'bp-01',
    categoryId: 'cat-14',
    subCategoryId: 'sub-14-1',
    title: '基准测试与性能分析',
    titleEn: 'Benchmark and Profiling',
    slug: 'benchmark-profiling',
    summary: 'TTFT/ITL/TPS 指标、负载测试、Profiling 工具与瓶颈定位',
    summaryEn: 'TTFT/ITL/TPS metrics, load testing, profiling tools, and bottleneck identification',
    content: bpReadmeZh,
    contentEn: bpReadmeEn,
    tags: ['Benchmark', 'Profiling', 'TTFT', 'ITL'],
    readTime: '18 min',
    date: '2025-02-05',
    prevArticleId: null,
    nextArticleId: null,
  },

  // -------- Execution Graph --------
  {
    id: 'eg-01',
    categoryId: 'cat-9',
    subCategoryId: 'sub-9-1',
    title: '执行图是什么：CUDA/NPU/CPU Graph',
    titleEn: 'What is Execution Graph: CUDA/NPU/CPU Graph',
    slug: 'what-is-graph',
    summary: '从计算图概念到 SGLang 中 CUDA/NPU/CPU Graph 的 capture/replay 实现',
    summaryEn: 'From computation graph concepts to SGLang CUDA/NPU/CPU Graph capture/replay implementation',
    content: eg01Zh,
    contentEn: eg01En,
    tags: ['执行图', 'CUDA Graph', 'Capture'],
    readTime: '25 min',
    date: '2025-02-08',
    prevArticleId: null,
    nextArticleId: 'eg-02',
  },
  {
    id: 'eg-02',
    categoryId: 'cat-9',
    subCategoryId: 'sub-9-1',
    title: '图执行数据流：replay 时的数据流转',
    titleEn: 'Graph Execution Dataflow: Data Flow During Replay',
    slug: 'graph-execution-dataflow',
    summary: 'graph replay 时哪些数据进入 graph、如何调度、数据如何在 buffer/KV cache/output 间流转',
    summaryEn: 'What data enters graph during replay, how it is scheduled, and how data flows between buffer/KV cache/output',
    content: eg02Zh,
    contentEn: eg02En,
    tags: ['执行图', 'Replay', '数据流'],
    readTime: '25 min',
    date: '2025-02-09',
    prevArticleId: 'eg-01',
    nextArticleId: null,
  },
]
