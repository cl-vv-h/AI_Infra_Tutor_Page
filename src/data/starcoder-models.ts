import type { ModelArchitecture } from '../types/model'

const shape = '[N, 3,072]'
const architecture = [{ label: 'Decoder 与残差', to: '/category/model-architecture' }]
const parallel = [{ label: 'TP 分片与通信', to: '/category/parallel-strategy' }]

// Checkpoint geometry and biased LayerNorm / GELU MLP verified against the linked sources.
// TP>2 uses the site's whole-KV-head replication convention, not an engine support promise.
export const starcoderArchitectures: ModelArchitecture[] = [{
  id: 'starcoder2-3b', name: 'StarCoder2 3B', organization: 'BigCode',
  family: 'Sliding GQA · LayerNorm · GELU MLP · Bias',
  description: '代码补全模型的另一种 Decoder：LayerNorm 同时带缩放与偏置，FFN 用两层 GELU MLP 而非门控三矩阵。24 个 Q heads 共享 2 组 KV，局部窗口 4,096；不是指令微调模型。',
  parameters: '3B', activeParameters: '3B', accent: '#f5b8d3',
  configUrl: 'https://huggingface.co/bigcode/starcoder2-3b/blob/main/config.json', configLabel: 'BigCode 官方 config.json',
  implementationUrl: 'https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/starcoder2/modeling_starcoder2.py',
  supportedTp: [1, 2, 4, 8],
  execution: {
    maxContext: 16384, denseLayers: 30, normKind: 'layernorm', cache: { kind: 'swa', window: 4096 },
    contextNote: '固定 StarCoder2-3B 检查点：上下文 16,384，滑窗 4,096。按包含当前 token 的完整逻辑窗口估算；后端可能仅持久保留 W−1，或未裁剪而占用更多。图示 TP 沿 Q heads 与 MLP 中间维分片；TP>2 时完整 KV heads 复制，不宣称框架原生 TP 支持这些组合。推理 eval 关闭 Dropout。',
  },
  dimensions: { hiddenSize: 3072, vocabSize: 49152, layers: 30, attentionHeads: 24, kvHeads: 2, headDim: 128, intermediateSize: 12288 },
  metrics: [{ label: 'Decoder Layers', value: '30' }, { label: 'Hidden Width', value: '3,072' }, { label: 'Attention', value: '24Q / 2KV · W 4,096' }, { label: 'Config Context', value: '16,384' }],
  nodes: [
    {
      id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: '49,152 vocab → 3,072 hidden',
      description: 'Token id 查表进入残差流。按该配置和 Transformers 默认值，词嵌入与输出 LM Head 共享权重；训练的 Fill-in-the-Middle 目标不增加额外 Decoder 分支。',
      inputShape: '[N] token ids', outputShape: shape, tone: 'input',
      weights: [{ name: 'embed_tokens.weight · shared with lm_head', shape: '[49,152, 3,072]' }], knowledge: architecture,
    },
    {
      id: 'attention-norm', eyebrow: 'PRE-NORM', title: 'LayerNorm · Scale + Bias', subtitle: 'Attention 前 · ε = 1e−5',
      description: '沿 hidden 维减均值、除以标准差，再乘 gamma、加 beta；与只使用均方根和缩放向量的 RMSNorm 不同。输入副本留给 Attention 残差。两条向量都在 TP ranks 复制。',
      inputShape: shape, outputShape: shape, tone: 'attention',
      weights: [{ name: 'input_layernorm.weight · replicated', shape: '[3,072]' }, { name: 'input_layernorm.bias · replicated', shape: '[3,072]' }], knowledge: architecture,
    },
    {
      id: 'swa', eyebrow: 'SLIDING GQA', title: 'Biased GQA · Sliding Window', subtitle: '24 Q / 2 KV · 128D · W = 4,096',
      description: '每组 12 个 Q heads 共享一对 K/V；四个投影均带 bias。Q/K 经 RoPE 后做局部因果注意力，V 不旋转。TP 示例中 Q bias 随 Q 分片、K/V bias 随 KV heads 分片或复制；o_proj 的完整 bias 在局部输出归约后只加一次，避免重复累加。',
      inputShape: shape, outputShape: shape, tone: 'attention', layerRange: 'Layers 0–29',
      weights: [
        { name: 'q_proj.weight · TP local', shape: '[{localHeads} × 128, 3,072]' },
        { name: 'q_proj.bias · TP local', shape: '[{localHeads} × 128]' },
        { name: 'k_proj.weight / v_proj.weight · each TP local', shape: '[{localKvHeads} × 128, 3,072]', multiplicity: 2 },
        { name: 'k_proj.bias / v_proj.bias · each TP local', shape: '[{localKvHeads} × 128]', multiplicity: 2 },
        { name: 'o_proj.weight · TP local', shape: '[3,072, {localHeads} × 128]' },
        { name: 'o_proj.bias · replicated', shape: '[3,072]', note: '图示 TP 语义：归约后的完整输出加一次 bias，不将每卡 bias 一起求和。' },
      ],
      tensors: [{ label: 'Q · TP local', shape: '[N, {localHeads}, 128]' }, { label: 'K / V · each TP local', shape: '[N, {localKvHeads}, 128]' }, { label: 'Attention output before o_proj · TP local', shape: '[N, {localHeads} × 128]' }],
      phaseNotes: {
        prefill: '全部输入 token 仍经过投影与局部因果注意力，不能把 Prefill 输入截成最后 4K 来替代。RoPE θ≈999999.442，使用真实位置。',
        decode: '每请求新增一个 query，读取最近 min(S, 4096) 个位置。TP≥2 后每卡至少一组 KV；继续增加 TP 不会把这个完整 head 切成分数个。',
      },
      knowledge: [{ label: 'QKV 与 Head Shape', to: '/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes' }, ...parallel],
    },
    {
      id: 'kv-cache', eyebrow: 'STATE', title: 'Rolling KV · Whole-head Replication', subtitle: 'min(S, 4,096) · 2 KV heads',
      description: '仅保存 K/V，不保存 Q 或投影 bias。TP=1 每卡 2 heads；TP=2/4/8 每卡 1 head。超过两卡时，整个 TP 组包含重复 KV，因此不能再把单卡缓存按 TP 线性缩小。',
      inputShape: '[N, 2, {localKvHeads}, 128]', outputShape: '[{batch}, {cachedSequence}, 2, {localKvHeads}, 128]', tone: 'memory', weights: [],
      knowledge: [{ label: 'KV 缓存与显存', to: '/category/kv-cache-memory' }, ...parallel],
    },
    {
      id: 'ffn-norm', eyebrow: 'PRE-NORM', title: 'Post-Attention LayerNorm', subtitle: 'FFN 前 · 独立 gamma / beta',
      description: 'Attention 残差相加后的向量再做 LayerNorm，供 MLP 使用。两条可训练向量独立于 Attention 前的 LayerNorm；残差仍保留归一化前的值。',
      inputShape: shape, outputShape: shape, tone: 'ffn',
      weights: [{ name: 'post_attention_layernorm.weight · replicated', shape: '[3,072]' }, { name: 'post_attention_layernorm.bias · replicated', shape: '[3,072]' }], knowledge: architecture,
    },
    {
      id: 'ffn', eyebrow: 'DENSE MLP', title: 'GELU MLP · Two Linear Layers', subtitle: '3,072 → 12,288 → 3,072 · 无 gate 分支',
      description: 'c_fc 加 bias 后使用 tanh 近似 GELU，再由 c_proj 返回残差宽度。只有两块矩阵，不是 SwiGLU / GeGLU 的 gate 与 up 相乘；MLP 矩阵元素数为 2×H×I。c_proj 的 bias 在 TP 输出归约后加一次。',
      inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–29',
      weights: [{ name: 'c_fc.weight · TP local', shape: '[{intermediateShard}, 3,072]' }, { name: 'c_fc.bias · TP local', shape: '[{intermediateShard}]' }, { name: 'c_proj.weight · TP local', shape: '[3,072, {intermediateShard}]' }, { name: 'c_proj.bias · replicated', shape: '[3,072]' }],
      tensors: [{ label: 'c_fc(X) + bias · TP local', shape: '[N, {intermediateShard}]' }, { label: 'GELU activation · TP local', shape: '[N, {intermediateShard}]' }], knowledge: [...architecture, ...parallel],
    },
    {
      id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final LayerNorm + Tied LM Head', subtitle: '3,072 → 49,152 logits',
      description: '最后的 LayerNorm 也有 weight 与 bias，之后乘共享词表矩阵。LM Head 自身没有 bias；此处展示词表分片与完整逻辑 logits，不把共享矩阵计为两份独立参数。',
      inputShape: shape, outputShape: '[N, 49,152]', tone: 'output',
      weights: [{ name: 'norm.weight', shape: '[3,072]' }, { name: 'norm.bias', shape: '[3,072]' }, { name: 'lm_head.weight · tied / TP local', shape: '[{vocabShard}, 3,072]' }], knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }],
    },
  ],
}]
