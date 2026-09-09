import type { ArchitectureNode, ModelArchitecture } from '../types/model'

// Dimensions from each linked official checkpoint config; tensors use [out, in].
function qwenModel(moe: boolean): ModelArchitecture {
  const hidden = moe ? '2,048' : '4,096'
  const layers = moe ? 48 : 36
  const shape = `[N, ${hidden}]`
  const ffn: ArchitectureNode = moe ? {
    id: 'moe', eyebrow: 'FFN', title: 'Sparse MoE', subtitle: '128 experts · Top-8 · 无 shared expert',
    description: '每个 token 经 Router 选择 8 个专家，加权合并输出。128 个专家都需要驻留；激活参数量不等于模型装载所需显存。这里展示 EP = 1 的 expert Tensor Parallel 分片。',
    inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–47',
    weights: [
      { name: 'router.gate', shape: '[128, 2,048]', note: '路由权重复制到各 TP rank' },
      { name: 'experts.gate_up_proj · TP local', shape: '[128, 2 × {expertShard}, 2,048]' },
      { name: 'experts.down_proj · TP local', shape: '[128, 2,048, {expertShard}]' },
    ],
    knowledge: [{ label: 'MoE 与稀疏激活', to: '/category/model-architecture' }, { label: 'TP / EP', to: '/category/parallel-strategy' }],
  } : {
    id: 'ffn', eyebrow: 'FFN', title: 'Dense SwiGLU', subtitle: '4,096 → 12,288 → 4,096',
    description: 'Gate 和 Up 两个投影分别产生门控与数值分支；SiLU(gate) 与 up 逐元素相乘，再投影回 hidden width。每个 token 都经过这套相同的权重。',
    inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–35',
    weights: [
      { name: 'gate_proj · TP local', shape: '[{intermediateShard}, 4,096]' },
      { name: 'up_proj · TP local', shape: '[{intermediateShard}, 4,096]' },
      { name: 'down_proj · TP local', shape: '[4,096, {intermediateShard}]' },
    ],
    knowledge: [{ label: 'SwiGLU', to: '/category/model-architecture' }, { label: 'Tensor Parallel', to: '/category/parallel-strategy' }],
  }
  return {
    id: moe ? 'qwen3-30b-a3b' : 'qwen3-8b', name: moe ? 'Qwen3-30B-A3B' : 'Qwen3-8B', organization: 'Qwen',
    family: moe ? 'GQA · QK-Norm · MoE' : 'GQA · QK-Norm · Dense',
    description: moe
      ? '用 GQA 与 128 个细粒度专家组合成稀疏 Decoder。Q heads 的总宽度为 4,096，独立于 2,048 的残差宽度，是理解 head_dim 不能总用 hidden / heads 推算的实例。'
      : 'Dense Qwen3 的清晰基线：36 层 GQA + SwiGLU。Query 和 Key 在各自 head 内做 RMSNorm，再应用 RoPE，便于对照 Llama 的注意力路径。',
    parameters: moe ? '30.5B' : '8.2B', activeParameters: moe ? '3.3B' : '8.2B', accent: '#b6a0ff',
    configUrl: `https://huggingface.co/Qwen/${moe ? 'Qwen3-30B-A3B' : 'Qwen3-8B'}/blob/main/config.json`,
    configLabel: '官方 config.json', supportedTp: [1, 2, 4, 8],
    execution: { maxContext: 40960, contextNote: 'Qwen3 的配置上限为 40,960；官方模型卡注明原生上下文为 32,768，扩展到 131,072 需要另配 YaRN。配置可接受的长度不等于该长度上的质量保证。', denseLayers: moe ? 0 : layers, cache: { kind: 'gqa' }, ...(moe ? { expertIntermediateSize: 768 } : {}) },
    metrics: [
      { label: 'Decoder Layers', value: String(layers) }, { label: 'Hidden Width', value: hidden },
      { label: 'Attention', value: `32Q / ${moe ? 4 : 8}KV · QK-Norm` }, { label: 'Config Context', value: '40,960' },
    ],
    dimensions: { hiddenSize: moe ? 2048 : 4096, vocabSize: 151936, layers, attentionHeads: 32, kvHeads: moe ? 4 : 8, headDim: 128, intermediateSize: moe ? 6144 : 12288 },
    nodes: [
      {
        id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: `151,936 vocabulary → ${hidden} hidden`,
        description: '输入 token id 查表形成残差流。Embedding 与 LM Head 不共享权重；此处显示完整检查点矩阵。',
        inputShape: '[N] token ids', outputShape: shape,
        weights: [{ name: 'embed_tokens.weight · global', shape: `[151,936, ${hidden}]` }],
        knowledge: [{ label: 'Decoder 基础', to: '/category/model-architecture' }], tone: 'input',
      },
      {
        id: 'attention-norm', eyebrow: 'PRE-NORM', title: 'RMSNorm', subtitle: 'Attention 前归一化',
        description: '对每个 token 的 hidden 向量进行 RMS 归一化。保留未归一化的输入供稍后的残差相加使用。',
        inputShape: shape, outputShape: shape, weights: [{ name: 'input_layernorm.weight', shape: `[${hidden}]` }],
        knowledge: [{ label: 'Pre-Norm 与残差', to: '/category/model-architecture' }], tone: 'attention',
      },
      {
        id: 'gqa', eyebrow: 'ATTENTION', title: 'GQA + QK-Norm + RoPE', subtitle: `32 Q heads · ${moe ? 4 : 8} KV heads · 128 dim`,
        description: moe
          ? '每组 8 个 Q heads 共享一对 K/V。Q/K 在 128 维 head 内归一化后应用 RoPE。TP = 8 时，只有 4 个 KV heads，因此各 KV head 会复制到 2 个 rank，而不能继续等分成半个 head。'
          : '每组 4 个 Q heads 共享 K/V。Q/K 投影后分别进行 head 内 RMSNorm，再应用 RoPE；V 不经过这两个步骤。输出投影后还需要 TP 归约。',
        inputShape: shape, outputShape: shape,
        weights: [
          { name: 'q_proj · TP local', shape: `[{localHeads} × 128, ${hidden}]` },
          { name: 'k_proj / v_proj · each TP local', shape: `[{localKvHeads} × 128, ${hidden}]` },
          { name: 'q_norm / k_norm · each', shape: '[128]', note: '每个 head 共享的缩放向量；各 TP rank 复制' },
          { name: 'o_proj · TP local', shape: `[${hidden}, {localHeads} × 128]` },
        ],
        knowledge: [{ label: 'GQA 与 RoPE', to: '/category/model-architecture' }, { label: 'TP 分片', to: '/category/parallel-strategy' }],
        tone: 'attention', layerRange: `Layers 0–${layers - 1}`,
      },
      {
        id: 'kv-cache', eyebrow: 'STATE', title: 'GQA KV Cache', subtitle: '按 KV head 分片或复制',
        description: '为历史位置保存 K 和 V。图中用连续逻辑 Shape 表示，有效 token 数与页分配数并不相同。显存估算按每个 rank 实际持有的完整 KV heads 计算。',
        inputShape: '[N, 2, {localKvHeads}, 128]', outputShape: '[{batch}, {sequence}, 2, {localKvHeads}, 128]',
        weights: [], knowledge: [{ label: 'Paged KV Cache', to: '/category/kv-cache-memory' }], tone: 'memory',
      },
      ffn,
      {
        id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + LM Head', subtitle: `${hidden} hidden → 151,936 logits`,
        description: '所有 Decoder 层完成后，最终归一化并映射到词表。图中输出是完整逻辑 logits；实际 TP 头持有词表分片，Prefill 通常只为采样所需的位置物化 logits。',
        inputShape: shape, outputShape: '[N, 151,936]',
        weights: [{ name: 'norm.weight', shape: `[${hidden}]` }, { name: 'lm_head · TP local', shape: `[{vocabShard}, ${hidden}]` }],
        knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }], tone: 'output',
      },
    ],
  }
}

export const qwenArchitectures = [qwenModel(false), qwenModel(true)]
