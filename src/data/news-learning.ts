export interface NewsLearningConcept {
  id: string
  label: string
  terms: string[]
  contextualTerms?: string[]
  description: string
  lesson: { label: string; to: string }
  example?: { label: string; to: string }
  reference?: { label: string; url: string }
}

/** Curated learning routes, never conclusions about a matched news article. */
export const newsLearningConcepts: NewsLearningConcept[] = [
  {
    id: 'kv-cache', label: 'KV Cache · 持久缓存',
    terms: ['KV cache', 'KV caching', 'KV缓存', 'KV 缓存', 'PagedAttention', 'prefix caching', '前缀缓存'],
    description: "KV 布局与分片决定常驻容量；上下文、并发和前缀命中影响实际占用。",
    lesson: { label: '理解 KV Cache 与显存', to: '/article/ai-infra-basic--kv-cache-memory--readme' },
    example: { label: 'Llama 3.1 8B · KV 缓存与预算', to: '/models/llama-3-1-8b?layer=0&node=kv-cache&b=4&s=4096&tp=4&bytes=2&budget=0.5' },
  },
  {
    id: 'moe', label: 'MoE · 稀疏专家路由',
    terms: ['mixture of experts', 'mixture of expert', '混合专家', '稀疏专家'], contextualTerms: ['MoE'],
    description: "总专家数决定常驻权重，Top-k 决定激活选择；路由、重排和通信另计。",
    lesson: { label: 'Router → Top-K → Expert 数据流', to: '/article/ai-infra-basic--model-architecture--03-sparse-moe-routing' },
    example: { label: 'DeepSeek-V3 · Layer 3 专家层', to: '/models/deepseek-v3?layer=3&node=moe' },
  },
  {
    id: 'mla', label: 'MLA · 潜在注意力',
    terms: ['multi head latent attention', 'multihead latent attention', '潜在注意力'], contextualTerms: ['MLA'],
    description: "latent、位置分量和 TP 复制共同决定缓存；压缩表示与展开 K/V 分开统计。",
    lesson: { label: '低秩压缩与解耦位置编码', to: '/article/ai-infra-basic--model-architecture--04-multi-head-latent-attention' },
    example: { label: 'GLM-4.7-Flash · MLA 投影', to: '/models/glm-4-7-flash?layer=0&node=mla' },
  },
  {
    id: 'gqa', label: 'GQA · 分组查询注意力',
    terms: ['grouped query attention', 'group query attention', '分组查询注意力'], contextualTerms: ['GQA'],
    description: "Q 与 KV heads 分别定义；TP 超过 KV heads 时可能发生整 head 复制。",
    lesson: { label: '跟随 QKV、RoPE 与缓存 Shape', to: '/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes' },
    example: { label: 'Llama 3.1 8B · GQA 权重与 Shape', to: '/models/llama-3-1-8b?layer=0&node=gqa' },
  },
  {
    id: 'gdn', label: 'Gated DeltaNet · 循环状态',
    terms: ['gated deltanet', 'gated delta net', 'gated delta network', 'gated delta rule', '门控 delta', '门控德尔塔'], contextualTerms: ['GDN'],
    description: "循环矩阵、卷积窗口与完整 KV 分别计量；Prefill 与 Decode 采用不同计算路径。",
    lesson: { label: 'GDN 层内数据流与 Shape', to: '/article/ai-infra-basic--gated-delta-network--02-gdn-layer-dataflow-and-shapes' },
    example: { label: 'Qwen3.5 9B · 循环状态层', to: '/models/qwen3-5-9b?layer=0&node=recurrent-state' },
  },
  {
    id: 'quantization', label: '量化 · 精度与实际收益',
    terms: ['quantization', 'quantisation', 'quantized', 'quantised', '量化', 'FP8', 'MXFP8', 'INT4', 'W4A16', 'GPTQ', 'AWQ'],
    description: "权重、激活与 KV 的量化策略独立；scale、校准误差和反量化开销共同决定收益。",
    lesson: { label: 'Activation、KV Cache 与 FP8 量化', to: '/article/ai-infra-basic--quantization--04-activation-kv-fp8-quantization' },
    reference: { label: 'vLLM · KV 量化与校准', url: 'https://docs.vllm.ai/en/stable/features/quantization/quantized_kvcache/' },
  },
  {
    id: 'parallelism', label: '并行策略 · 分片与通信',
    terms: ['tensor parallel', 'tensor parallelism', 'expert parallel', 'expert parallelism', 'pipeline parallel', 'pipeline parallelism', '张量并行', '专家并行', '流水线并行'],
    description: "TP 切矩阵、EP 切专家、PP 切层；本地张量、复制状态和通信分别核算。",
    lesson: { label: 'DP / TP / PP / SP / EP 原理', to: '/article/ai-infra-basic--parallel-strategy--tutorial' },
    example: { label: 'Qwen3 8B · TP=8 时的 KV head 分片', to: '/models/qwen3-8b?layer=0&node=kv-cache&tp=8' },
  },
  {
    id: 'speculation', label: '投机解码 · Draft 与 Verify',
    terms: ['speculative decoding', 'speculative inference', 'speculative sampling', '投机解码', '推测解码', '投机采样'],
    description: "接受率与草稿成本影响净收益；拒绝后的 token 与缓存需保持提交边界一致。",
    lesson: { label: '理解 Draft → Verify → Commit', to: '/article/ai-infra-basic--speculative-decoding--01-speculative-decoding-principles' },
  },
]
