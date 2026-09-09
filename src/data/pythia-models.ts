import type { ModelArchitecture } from '../types/model'

const shape = '[N, 2,048]'
const architecture = [{ label: 'Decoder 与残差', to: '/category/model-architecture' }]
const parallel = [{ label: 'TP 分片与归约', to: '/category/parallel-strategy' }]

// Fixed Pythia-1.4B checkpoint; logical head-wise TP is not an engine support claim.
export const pythiaArchitectures: ModelArchitecture[] = [{
  id: 'pythia-1-4b', name: 'Pythia 1.4B', organization: 'EleutherAI',
  family: 'Parallel Residual · MHA · Partial RoPE · GELU',
  description: '面向语言模型研究的 GPT-NeoX 系列样本：Attention 与 MLP 从同一个层输入分叉，最后共同写回残差流。24 层完整 MHA、带 bias 的 LayerNorm / GELU MLP，以及只旋转部分 head 维度的 RoPE。',
  parameters: '1.4B', activeParameters: '1.4B', accent: '#ffc98b',
  configUrl: 'https://huggingface.co/EleutherAI/pythia-1.4b/blob/main/config.json', configLabel: 'EleutherAI 官方 config.json',
  implementationUrl: 'https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/gpt_neox/modeling_gpt_neox.py',
  supportedTp: [1, 2, 4, 8],
  execution: {
    maxContext: 2048, denseLayers: 24, normKind: 'layernorm', residualLayout: 'parallel', cache: { kind: 'gqa' },
    contextNote: '固定 Pythia-1.4B 配置，上限 2,048，不外推上下文。TP 示例按完整 head 与 MLP 中间维分片，输出投影归约后加一次完整 bias；不宣称 Transformers 原生 TP 支持矩阵。并行残差指数据依赖，不意味着实现同时执行两个分支。推理 eval 关闭 Dropout。',
  },
  dimensions: { hiddenSize: 2048, vocabSize: 50304, layers: 24, attentionHeads: 16, kvHeads: 16, headDim: 128, intermediateSize: 8192 },
  metrics: [{ label: 'Decoder Layers', value: '24' }, { label: 'Hidden Width', value: '2,048' }, { label: 'Attention', value: '16Q / 16KV · MHA' }, { label: 'Config Context', value: '2,048' }],
  nodes: [
    {
      id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding · Untied', subtitle: '50,304 vocab → 2,048 hidden',
      description: 'Token id 查表得到残差流的初始向量。该配置 tie_word_embeddings=false，输入 embed_in 和输出 embed_out 是独立的词表矩阵。Pythia 是研究用基础模型，不是指令对话模型。',
      inputShape: '[N] token ids', outputShape: shape, tone: 'input',
      weights: [{ name: 'gpt_neox.embed_in.weight', shape: '[50,304, 2,048]' }], knowledge: architecture,
    },
    {
      id: 'attention-norm', eyebrow: 'BRANCH A · PRE-NORM', title: 'Attention LayerNorm · LN₁(x)', subtitle: '同一层输入 x → Attention 分支',
      description: '对层输入 x 做 LayerNorm（ε=1e−5），缩放与偏置都是独立可训练向量，在 TP ranks 复制。原始 x 同时交给 MLP 分支及最后的残差汇合。',
      inputShape: shape, outputShape: shape, tone: 'attention',
      weights: [{ name: 'input_layernorm.weight · replicated', shape: '[2,048]' }, { name: 'input_layernorm.bias · replicated', shape: '[2,048]' }], knowledge: architecture,
    },
    {
      id: 'mha', eyebrow: 'FULL MHA', title: 'Fused QKV · Partial RoPE', subtitle: '16Q / 16KV · 128D · 32D 旋转 + 96D 保留',
      description: 'query_key_value 一次生成 Q/K/V；布局按 head 分组，每个 head 内依次存 Q、K、V，不是先拼所有 Q 再拼所有 K。Q/K 的前 32 维应用 RoPE（θ=10,000），其余 96 维不旋转，V 完全不旋转。完整 128D 的 K/V 都进入缓存。注意力输出经 dense 投影回 hidden 宽度。',
      inputShape: shape, outputShape: shape, tone: 'attention', layerRange: 'Layers 0–23',
      weights: [
        { name: 'attention.query_key_value.weight · TP local', shape: '[{localHeads} × 3 × 128, 2,048]', note: '本地输出行按 [head, Q/K/V, head_dim] 排列；二维权重仍按 [OUT, IN] 展示。' },
        { name: 'attention.query_key_value.bias · TP local', shape: '[{localHeads} × 3 × 128]' },
        { name: 'attention.dense.weight · TP local', shape: '[2,048, {localHeads} × 128]' },
        { name: 'attention.dense.bias · replicated', shape: '[2,048]', note: '逻辑 TP：行并行输出归约后只加一次 bias，不能把复制的 bias 多次求和。' },
      ],
      tensors: [{ label: 'Packed QKV · head-interleaved', shape: '[N, {localHeads}, 3 × 128]' }, { label: 'Q/K rotary slice · each', shape: '[N, {localHeads}, 32]' }, { label: 'Q/K unrotated slice · each', shape: '[N, {localHeads}, 96]' }, { label: 'Q / K / V · each full head', shape: '[N, {localHeads}, 128]' }],
      phaseNotes: { prefill: '无前缀缓存时 N=B×S，因果 MHA 覆盖当前序列。Partial RoPE 仅改变 Q/K 的旋转维度，不缩短 head，也不减少 KV 缓存维度。', decode: 'N=B，每个请求新增一个 query；读取包含当前 token 的完整历史 S。只有 2,048 的配置窗口，不能因 RoPE 可以接受位置就宣称支持更长上下文。' },
      knowledge: [{ label: 'QKV 与 Head Shape', to: '/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes' }, ...parallel],
    },
    {
      id: 'kv-cache', eyebrow: 'ATTENTION STATE', title: 'Full MHA KV Cache', subtitle: '16 KV heads · 完整 128D · 全历史 S',
      description: '缓存旋转后的 K 与未旋转的 V，每个 head 都有完整 128 维；rotary_pct=0.25 不代表缓存只保留四分之一。图示按 head 切分，TP=1/2/4/8 对应每卡 16/8/4/2 heads。MLP 分支没有额外 KV 副本。',
      inputShape: '[N, 2, {localKvHeads}, 128]', outputShape: '[{batch}, {sequence}, 2, {localKvHeads}, 128]', weights: [], tone: 'memory',
      knowledge: [{ label: 'KV 缓存与显存', to: '/category/kv-cache-memory' }, ...parallel],
    },
    {
      id: 'ffn-norm', eyebrow: 'BRANCH M · PRE-NORM', title: 'MLP LayerNorm · LN₂(x)', subtitle: '同一层输入 x · 不是 Attention 输出',
      description: '虽然权重名叫 post_attention_layernorm，这里仍然归一化原始层输入 x，而非 x+A。其 gamma/beta 与 LN₁ 独立；两条分支共享的是输入，不共享归一化权重或输出。',
      inputShape: shape, outputShape: shape, tone: 'ffn',
      weights: [{ name: 'post_attention_layernorm.weight · replicated', shape: '[2,048]' }, { name: 'post_attention_layernorm.bias · replicated', shape: '[2,048]' }], knowledge: architecture,
    },
    {
      id: 'ffn', eyebrow: 'PARALLEL MLP', title: 'GELU MLP · Independent Branch', subtitle: '2,048 → 8,192 → 2,048 · 无 gate 分支',
      description: 'dense_h_to_4h 加 bias 后使用 GELU，再经 dense_4h_to_h 返回 hidden 宽度。只有两块矩阵，没有 SwiGLU 的第三块门控矩阵。输入来自 LN₂(x)，不必等待 Attention 的数值结果；参考 Python 实现仍按调用顺序执行，并非并发性能保证。',
      inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–23',
      weights: [{ name: 'mlp.dense_h_to_4h.weight · TP local', shape: '[{intermediateShard}, 2,048]' }, { name: 'mlp.dense_h_to_4h.bias · TP local', shape: '[{intermediateShard}]' }, { name: 'mlp.dense_4h_to_h.weight · TP local', shape: '[2,048, {intermediateShard}]' }, { name: 'mlp.dense_4h_to_h.bias · replicated', shape: '[2,048]', note: 'TP 输出归约后加一次完整 bias，再送往共同残差汇合。' }],
      tensors: [{ label: 'GELU activation · TP local', shape: '[N, {intermediateShard}]' }], knowledge: [...architecture, ...parallel],
    },
    {
      id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final LayerNorm + Untied LM Head', subtitle: '2,048 → 50,304 logits',
      description: '24 层后的最终 LayerNorm 含独立 scale/bias。embed_out 是无 bias 的输出词表投影，不与 embed_in 共享；展示词表行分片和完整逻辑 logits。两张词表矩阵及最终 Norm 都不计入 Decoder 权重账本。',
      inputShape: shape, outputShape: '[N, 50,304]', tone: 'output',
      weights: [{ name: 'gpt_neox.final_layer_norm.weight', shape: '[2,048]' }, { name: 'gpt_neox.final_layer_norm.bias', shape: '[2,048]' }, { name: 'embed_out.weight · untied / TP local', shape: '[{vocabShard}, 2,048]' }], knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }],
    },
  ],
}]
