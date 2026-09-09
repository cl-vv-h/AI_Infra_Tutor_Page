import type { ModelArchitecture } from '../types/model'

const hidden = '[N, 3,072]'
const architecture = [{ label: 'Decoder 与残差', to: '/category/model-architecture' }]
const attention = [{ label: 'Q/K/V 与 Head Shape', to: '/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes' }, { label: 'Attention 与位置编码', to: '/category/prefill' }]

// Microsoft config checked 2026-09-09: W=262144 exceeds supported S=131072.
// Treat cache as full within the supported context, never extrapolate to W.
export const phiArchitectures: ModelArchitecture[] = [{
  id: 'phi-3-5-mini-instruct', name: 'Phi-3.5 Mini Instruct', organization: 'Microsoft',
  family: 'MHA · Fused QKV · LongRoPE',
  description: '3.8B Dense 模型，32 个 Query heads 各自对应独立 K/V。融合投影展示“一个矩阵”如何拆成三路张量；LongRoPE 扩展位置表示，不压缩历史 KV。',
  parameters: '3.8B', activeParameters: '3.8B', accent: '#a5d8ff',
  configUrl: 'https://huggingface.co/microsoft/Phi-3.5-mini-instruct/blob/main/config.json', configLabel: '微软官方 config.json',
  implementationUrl: 'https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/phi3/modeling_phi3.py',
  supportedTp: [1, 2, 4, 8],
  execution: {
    maxContext: 131072, denseLayers: 32, cache: { kind: 'gqa' },
    contextNote: 'Phi-3.5 Mini 的 Q/KV 均为 32 heads，是 MHA。官方 sliding_window=262,144 大于 max_position_embeddings=131,072；在本工具范围内不会裁剪，因此按完整 S 估算。LongRoPE 的 original_max_position_embeddings=4,096 是位置缩放参考，不是 KV 窗口；不外推到 256K。TP 为按 Q/K/V 各自 head 切分的逻辑布局，并非把完整打包矩阵连续等分。',
  },
  dimensions: { hiddenSize: 3072, vocabSize: 32064, layers: 32, attentionHeads: 32, kvHeads: 32, headDim: 96, intermediateSize: 8192 },
  metrics: [{ label: 'Decoder Layers', value: '32' }, { label: 'Hidden Width', value: '3,072' }, { label: 'Attention', value: '32Q / 32KV · 96D' }, { label: 'Config Context', value: '131,072' }],
  nodes: [
    {
      id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: '32,064 vocab → 3,072 hidden',
      description: '把 token id 转换为残差流输入。词嵌入与 LM Head 不共享权重；这里显示完整词表矩阵。',
      inputShape: '[N] token ids', outputShape: hidden, tone: 'input',
      weights: [{ name: 'embed_tokens.weight · global', shape: '[32,064, 3,072]' }], knowledge: architecture,
    },
    {
      id: 'attention-norm', eyebrow: 'PRE-NORM', title: 'RMSNorm', subtitle: 'ε = 1e−5 · 3,072 scales',
      description: '沿 hidden 维计算均方根归一化，再逐元素乘缩放向量。Attention 和 FFN 前各有一次 RMSNorm，没有 Q/K head 内的额外 Norm。残差使用归一化前的输入。',
      inputShape: hidden, outputShape: hidden, tone: 'attention',
      weights: [{ name: 'input_layernorm.weight', shape: '[3,072]' }], knowledge: architecture,
    },
    {
      id: 'mha', eyebrow: 'MULTI-HEAD ATTENTION', title: 'MHA · Fused QKV + LongRoPE', subtitle: '32Q = 32K = 32V · head dim 96',
      description: '一次无 bias 的 qkv_proj 先生成 Q、K、V 三段，再各自 reshape 为 32 个 96 维 head。Q/K 经过 LongRoPE 后做因果注意力，V 不旋转。每个 Q head 都有自己的 KV；不是一组 Q 共享较少 KV 的 GQA。最终经 o_proj 返回 3,072 维，并跨 TP rank 归约局部输出。',
      inputShape: hidden, outputShape: hidden, tone: 'attention', layerRange: 'Layers 0–31',
      weights: [{ name: 'qkv_proj · TP local', shape: '[3 × {localHeads} × 96, 3,072]', note: '全局 [9216, 3072]。每卡分别取 Q/K/V 的 head 分片再打包，不是直接连续切完整矩阵的行。' }, { name: 'o_proj · TP local', shape: '[3,072, {localHeads} × 96]' }],
      tensors: [
        { label: 'Fused QKV output · TP local', shape: '[N, 3 × {localHeads} × 96]', note: '拆成等宽的 Q、K、V 三段；不是三个完整 hidden 各自复制到所有卡。' },
        { label: 'Q / K / V · each TP local', shape: '[N, {localHeads}, 96]' },
        { label: 'LongRoPE short_factor / long_factor · each', shape: '[48]', note: '配置系数，每对旋转通道一个因子，不是可训练权重。short_factor 并非全为 1；base θ = 10000。' },
        { label: 'RoPE cos / sin · each logical', shape: '[N, 96]', note: '在 heads 间广播；位置缩放与幅度缩放不改变投影或 KV 的 Shape。实际后端可共享、缓存或融合这些值。' },
      ],
      phaseNotes: {
        prefill: '完整输入采用因果掩码，Q/K 依据真实位置应用 LongRoPE。融合 QKV 投影与 FlashAttention 是不同优化：前者合并投影，后者改变注意力计算/访存方式。',
        decode: '每请求新增一个 Query，读取全部 S 个位置的 K/V。长上下文位置系数由实现选择；4,096 不是丢弃历史的阈值，KV 容量持续随 S 增长。',
      },
      knowledge: attention,
    },
    {
      id: 'kv-cache', eyebrow: 'STATE', title: 'Full MHA KV Cache', subtitle: '32 KV heads · 保留 S 个位置',
      description: '每个注意力头都保存独立 K/V。缓存里只有 K 和 V，不包含 Q；融合 QKV 权重并不会把缓存变成三份。配置窗口大于模型上下文，所以这里不启用滑窗截断。',
      inputShape: '[N, 2, {localKvHeads}, 96]', outputShape: '[{batch}, {sequence}, 2, {localKvHeads}, 96]', tone: 'memory', weights: [],
      knowledge: [{ label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }, { label: 'TP 切分与复制', to: '/category/parallel-strategy' }],
    },
    {
      id: 'ffn', eyebrow: 'DENSE FFN', title: 'SwiGLU · Fused Gate/Up', subtitle: '3,072 → 8,192 → 3,072',
      description: '一个 gate_up_proj 输出两倍中间宽度，拆分后计算 SiLU(gate) × up，再由 down_proj 返回 hidden width。两个矩阵都没有 bias；融合打包不等于只保留两路等大小矩阵，参数量仍为 3 × hidden × intermediate。',
      inputShape: hidden, outputShape: hidden, tone: 'ffn', layerRange: 'Layers 0–31',
      weights: [{ name: 'gate_up_proj · TP local', shape: '[2 × {intermediateShard}, 3,072]' }, { name: 'down_proj · TP local', shape: '[3,072, {intermediateShard}]' }],
      tensors: [{ label: 'Gate / Up · each TP local', shape: '[N, {intermediateShard}]' }, { label: 'SiLU(Gate) × Up · TP local', shape: '[N, {intermediateShard}]' }],
      knowledge: [{ label: 'FFN 与算子融合', to: '/category/model-architecture' }, { label: 'TP 并行策略', to: '/category/parallel-strategy' }],
    },
    {
      id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + Untied LM Head', subtitle: '3,072 hidden → 32,064 logits',
      description: '最终 RMSNorm 后使用独立词表矩阵生成 logits，不与 Embedding 共享。图中输出是完整逻辑词表维；TP rank 持有一个词表分片，采样实现可避免物化所有位置的完整 logits。',
      inputShape: hidden, outputShape: '[N, 32,064]', tone: 'output',
      weights: [{ name: 'norm.weight', shape: '[3,072]' }, { name: 'lm_head.weight · TP local', shape: '[{vocabShard}, 3,072]' }],
      knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }],
    },
  ],
}]
