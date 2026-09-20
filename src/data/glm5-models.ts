import type { ModelArchitecture } from '../types/model'

const architecture = '/category/model-architecture'
const mla = '/article/ai-infra-basic--model-architecture--04-multi-head-latent-attention'
const parallel = '/category/parallel-strategy'

/** Config checked 2026-09-14; cache/TP accounting follows the SGLang Ascend teaching baseline. */
export const glm5Architectures: ModelArchitecture[] = [{
  id: 'glm-5-2', name: 'GLM-5.2', organization: 'Z.ai',
  family: 'DSA + MLA · IndexShare · Sparse MoE',
  description: '沿 78 层追踪两种不同的 Top-k：DSA 选历史 token，MoE 选专家。IndexShare 共享检索位置，MLA 压缩每个位置的表示，二者都不等于删除历史缓存。',
  parameters: '753B', activeParameters: '未单独核定', accent: '#76e7c5',
  configUrl: 'https://huggingface.co/zai-org/GLM-5.2/blob/main/config.json', configLabel: '官方 config · 2026-09-14 核对',
  implementationUrl: 'https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/models/deepseek_v2.py',
  supportedTp: [1, 2, 4, 8],
  execution: {
    maxContext: 1048576, denseLayers: 3,
    contextNote: '1M 为配置上限，不是单卡容量承诺。本图按 PP=1、Attention TP=TP 展示；routed 专家采用当前 EP / MoE-TP 布局；DSA Index K 按 Ascend 全层预留，不含检索工作区、位置表与 NextN。实际缓存精度和分配以固定引擎版本为准。',
    cache: { kind: 'mla', latentWidth: 512, ropeWidth: 64, indexWidth: 128 }, expertParallel: { experts: 256, topK: 8, hiddenSize: 6144 }, expertIntermediateSize: 2048,
  },
  metrics: [{ label: 'Decoder Layers', value: '78' }, { label: 'Hidden Width', value: '6,144' }, { label: 'DSA / MoE Top-k', value: '2,048 tokens / 8 experts' }, { label: 'Context', value: '1,048,576' }],
  dimensions: { hiddenSize: 6144, vocabSize: 154880, layers: 78, attentionHeads: 64, kvHeads: 64, headDim: 256, intermediateSize: 12288 },
  nodes: [
    {
      id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: '154,880 词表 → 6,144 维主干',
      description: '把本轮 token id 转换成 hidden state。未命中前缀缓存的完整 Prefill 用 N=B×S；普通逐 token Decode 用 N=B。本图不模拟前缀命中或推测验证。',
      inputShape: '[N] token ids', outputShape: '[N, 6144]',
      weights: [{ name: 'embed_tokens.weight', shape: '[154880, 6144]' }], knowledge: [{ label: 'Decoder-only', to: architecture }], tone: 'input',
    },
    {
      id: 'attention-norm', eyebrow: 'BLOCK / A1', title: 'Attention RMSNorm', subtitle: '保留 residual，归一化主干',
      description: '对 6,144 维 hidden state 做 Pre-Norm。引擎可把上一子层的 residual add 与 RMSNorm 融合；图中按数学依赖分开显示。',
      inputShape: '[N, 6144]', outputShape: '[N, 6144]', weights: [{ name: 'input_layernorm.weight', shape: '[6144]' }],
      knowledge: [{ label: 'Decoder 与归一化', to: architecture }], tone: 'attention',
    },
    {
      id: 'mla', eyebrow: 'BLOCK / A2', title: 'DSA + Multi-Head Latent Attention', subtitle: '先检索 token，再在压缩 KV 上计算 Attention',
      description: 'Q 压到 2,048 维，KV 压到 512+64 维。32 个 replicated Indexer heads 从历史 Index K 中检索最多 2,048 个位置，主 Attention 的 64 个 heads 读取这些位置的本层 latent。IndexShare 只复用位置表：每层仍计算自己的 Q、KV 和 Attention 输出。官方配置 indexer_types 为前 3 层 full，之后 full 层是 6、10、14…74；本地 SGLang 快照的 index_topk_freq 分支使用另一偏移，不能把配置排布当作所有引擎的实际调度。',
      inputShape: '[N, 6144]', outputShape: '[N, 6144]',
      phaseNotes: {
        prefill: '所有输入位置都受 causal mask 约束；每个 query 只选自身及之前的有效位置，不足 2,048 时只能读取已有位置。Indexer 仍可能扫描长历史，DSA 不保证全部 Prefill 计算线性。',
        decode: '新 token 先写本层 latent/RoPE cache；Full Indexer 选历史位置或 Shared 层复用上游位置表，再计算本层 sparse attention。Top-2048 不代表缓存只剩 2,048 个 token。',
      },
      tensors: [
        { label: 'Q latent（主 Q 与 Indexer 的共同输入）', shape: '[N, 2048]' },
        { label: '主 Q heads · TP local', shape: '[N, {localHeads}, 256]', note: '192 noPE + 64 RoPE；不能读取 config 中孤立的 head_dim=192 当成总宽度。' },
        { label: '吸收后的 Q noPE · TP local', shape: '[N, {localHeads}, 512]' },
        { label: 'Indexer Q · replicated', shape: '[N, 32, 128]', note: 'Indexer heads 不除以 TP。' },
        { label: 'topk_indices · 固定槽位上限', shape: '[N, 2048]', note: '实际有效位置最多 min(可见历史长度, 2048)，无效槽不参与 Attention；它是位置表，不是专家编号。' },
        { label: 'Attention latent 输出 · TP local', shape: '[N, {localHeads}, 512]' },
      ],
      weights: [
        { name: 'q_a_proj · replicated', shape: '[2048, 6144]' },
        { name: 'kv_a_proj_with_mqa · replicated', shape: '[576, 6144]' },
        { name: 'q_a_layernorm', shape: '[2048]' }, { name: 'kv_a_layernorm', shape: '[512]' },
        { name: 'q_b_proj · TP local', shape: '[{localHeads} × 256, 2048]' },
        { name: 'kv_b_proj · TP local', shape: '[{localHeads} × 448, 512]', note: '每 head 192 noPE K + 256 V；可重排成吸收矩阵。' },
        { name: 'o_proj · TP local', shape: '[6144, {localHeads} × 256]' },
        { name: 'indexer.wq_b · replicated', shape: '[32 × 128, 2048]' },
        { name: 'indexer.wk · replicated', shape: '[128, 6144]' },
        { name: 'indexer.weights_proj · replicated', shape: '[32, 6144]' },
        { name: 'indexer.k_norm weight / bias', shape: '[128]', multiplicity: 2, note: 'Index K 使用带 bias 的 LayerNorm；不是主干 RMSNorm。按 SGLang 每层构造 Indexer 的口径列权重。' },
      ],
      knowledge: [{ label: 'MLA 压缩与吸收', to: mla }, { label: 'DSA 与模型架构', to: architecture }, { label: 'TP 分片', to: parallel }], tone: 'attention', layerRange: 'Layers 0–77',
    },
    {
      id: 'kv-cache', eyebrow: 'STATE / 3 BUFFERS', title: 'MLA + Index K Cache', subtitle: '512 latent + 64 RoPE + 128 Index K',
      description: '三类缓存按同一历史位置对齐。本图按 SGLang Ascend 全层预留 Index K 的逻辑口径估算，合计每 token 每层 704 个元素，各 TP rank 复制。共享 Top-k 不等于共享本层主 KV，也不能据此省掉缓存池已分配的 Index K。',
      inputShape: '[N, 512] + [N, 64] + [N, 128]', outputShape: '[{batch}, {sequence}, 704]', weights: [],
      tensors: [{ label: '主 KV latent', shape: '[{batch}, {sequence}, 512]' }, { label: 'RoPE Key', shape: '[{batch}, {sequence}, 64]' }, { label: 'Index K 预留', shape: '[{batch}, {sequence}, 128]' }],
      weightlessNote: '这些是运行时缓存，不是权重。图示合并 shape 仅用于加总容量，实际为独立、可能分页的 buffer。',
      knowledge: [{ label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }], tone: 'memory',
    },
    {
      id: 'dense-ffn', eyebrow: 'BLOCK / B2', title: 'Dense SwiGLU', subtitle: 'Layers 0–2 · 中间维 12,288',
      description: '前三层执行 SiLU(gate)×up，再通过 down 投影回主干。TP 切中间维，输出归约后参与 residual add；这些层不选择 MoE 专家。',
      inputShape: '[N, 6144]', outputShape: '[N, 6144]',
      weights: [{ name: 'gate_up_proj · TP local', shape: '[2 × {intermediateShard}, 6144]' }, { name: 'down_proj · TP local', shape: '[6144, {intermediateShard}]' }],
      knowledge: [{ label: 'Dense FFN', to: architecture }, { label: 'Tensor Parallel', to: parallel }], tone: 'ffn', layerRange: 'Layers 0–2',
    },
    {
      id: 'moe', eyebrow: 'BLOCK / B2', title: 'Sparse MoE', subtitle: '256 routed · Top-8 + 1 shared',
      description: 'Router 使用 sigmoid 与 correction bias 选择 8 个 routed experts，并执行 1 个 shared expert。选中权重归一化，routed 分支使用 2.5 缩放。这里 Top-8 选的是专家，与 DSA 的 Top-2048 历史位置完全不同；专家中间维为 2,048，不是 Dense 层的 12,288。',
      inputShape: '[N, 6144]', outputShape: '[N, 6144]',
      tensors: [{ label: 'Router 分数', shape: '[N, 256]' }, { label: '每 token 专家索引', shape: '[N, 8]' }],
      weights: [{ name: 'gate.weight · replicated', shape: '[256, 6144]' }, { name: 'e_score_correction_bias · replicated', shape: '[256]' }, { routedExpert: true, name: 'experts.gate_up_proj · TP local', shape: '[256, 2 × {expertShard}, 6144]', note: 'EP=1；保留所有专家，仅中间维分片。' }, { routedExpert: true, name: 'experts.down_proj · TP local', shape: '[256, 6144, {expertShard}]' }, { name: 'shared_experts.gate_up_proj · TP local', shape: '[2 × {expertShard}, 6144]' }, { name: 'shared_experts.down_proj · TP local', shape: '[6144, {expertShard}]' }],
      knowledge: [{ label: 'MoE 路由', to: architecture }, { label: 'TP / EP 区别', to: parallel }], tone: 'ffn', layerRange: 'Layers 3–77',
    },
    {
      id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final RMSNorm + LM Head', subtitle: '最后一层之后才进入词表与采样',
      description: '78 个 target layers 完成后做 Final RMSNorm 与未共享的 LM Head，生成词表 logits，再交给采样器。checkpoint 另有 1 个可选 NextN/MTP 层，本图不把它误计成第 79 个 target layer，也不模拟 draft/verify 的分支或额外缓存。',
      inputShape: '[N, 6144]', outputShape: '[N, 154880]',
      weights: [{ name: 'norm.weight', shape: '[6144]' }, { name: 'lm_head · TP local', shape: '[{vocabShard}, 6144]' }],
      knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }, { label: '推测解码', to: '/category/speculative-decoding' }], tone: 'output',
    },
  ],
}]
