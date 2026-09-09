import type { ArchitectureNode, ModelArchitecture } from '../types/model'

// Versioned classic checkpoints. Mixtral v0.1 has no sliding window in config;
// do not infer a window merely because it shares Mistral's GQA dimensions.
function mistralModel(moe: boolean): ModelArchitecture {
  const checkpoint = moe ? 'Mixtral-8x7B-v0.1' : 'Mistral-7B-v0.1'
  const shape = '[N, 4,096]'
  const ffn: ArchitectureNode = moe ? {
    id: 'moe', eyebrow: 'SPARSE FFN', title: 'Mixtral Top-2 MoE', subtitle: '8 experts · Top-2 · 无 shared expert',
    description: 'Router 为每个 token 产生 8 个分数，Softmax 后选 Top-2 并重新归一化，两个专家的 SwiGLU 输出按路由权重相加。只替换 FFN，不是运行两套完整 Decoder。EP = 1 时所有专家都驻留，各专家矩阵可沿中间维做 TP。',
    inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–31',
    tensors: [{ label: 'Router logits', shape: '[N, 8]' }, { label: 'Selected expert ids / weights', shape: '[N, 2]', note: '分数和编号是两个张量；专家间 token 数不一定均匀。' }],
    weights: [
      { name: 'block_sparse_moe.gate · replicated', shape: '[8, 4,096]' },
      { name: 'experts.w1 / w3 · each TP local', shape: '[8, {expertShard}, 4,096]', note: 'w1 是 gate，w3 是 up；首维按 8 个独立专家堆叠示意。' },
      { name: 'experts.w2 · TP local', shape: '[8, 4,096, {expertShard}]', note: 'Down projection；TP 局部输出需归约。' },
    ],
    knowledge: [{ label: 'Sparse MoE', to: '/article/ai-infra-basic--model-architecture--03-sparse-moe-routing' }, { label: 'TP / EP', to: '/category/parallel-strategy' }],
  } : {
    id: 'ffn', eyebrow: 'DENSE FFN', title: 'Dense SwiGLU', subtitle: '4,096 → 14,336 → 4,096',
    description: 'SiLU(gate_proj(x)) 与 up_proj(x) 相乘，再通过 down_proj 返回残差宽度。所有 token 使用相同的 Dense FFN；没有 Router 或稀疏专家。',
    inputShape: shape, outputShape: shape, tone: 'ffn', layerRange: 'Layers 0–31',
    weights: [{ name: 'gate_proj / up_proj · each TP local', shape: '[{intermediateShard}, 4,096]' }, { name: 'down_proj · TP local', shape: '[4,096, {intermediateShard}]' }],
    knowledge: [{ label: 'Transformer 与 FFN', to: '/category/model-architecture' }, { label: 'TP 分片', to: '/category/parallel-strategy' }],
  }
  return {
    id: moe ? 'mixtral-8x7b-v0-1' : 'mistral-7b-v0-1', name: checkpoint, organization: 'Mistral AI',
    family: moe ? 'Full GQA · Top-2 MoE' : 'Sliding GQA · Dense',
    description: moe ? '经典稀疏专家检查点：32 层共享 GQA 主干，每层 FFN 有 8 个专家，每 token 激活 2 个。此 v0.1 配置没有滑动窗口，KV 仍随历史长度增长。' : '经典滑动窗口检查点：每层 GQA 只直接读取最近 4,096 个位置，滚动缓存达到窗口后不再随 S 增长。32 层之间的信息传播仍可扩大感受范围，窗口不等于整模型上下文。',
    parameters: moe ? '46.7B' : '7.3B', activeParameters: moe ? '12.9B' : '7.3B', accent: '#ffc98b',
    configUrl: `https://huggingface.co/mistralai/${checkpoint}/blob/main/config.json`, configLabel: '官方 v0.1 config.json',
    implementationUrl: `https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/${moe ? 'mixtral/modeling_mixtral.py' : 'mistral/modeling_mistral.py'}`,
    supportedTp: [1, 2, 4, 8],
    execution: {
      maxContext: 32768, denseLayers: moe ? 0 : 32, ...(moe ? { expertIntermediateSize: 14336 } : {}),
      cache: moe ? { kind: 'gqa' } : { kind: 'swa', window: 4096 },
      contextNote: moe ? 'Mixtral-8x7B-v0.1 的 sliding_window 为 null；不要把 Mistral-7B-v0.1 的 4K 窗口套用到这个模型。' : '这里固定使用 Mistral-7B-v0.1：配置上下文 32,768，滑动窗口 4,096。容量按包含当前 token 的完整逻辑窗口估算；部分缓存实现跨步仅保留 W−1 个历史位置，未裁剪的实现也可能占用更多空间。',
    },
    dimensions: { hiddenSize: 4096, vocabSize: 32000, layers: 32, attentionHeads: 32, kvHeads: 8, headDim: 128, intermediateSize: 14336 },
    metrics: [{ label: 'Decoder Layers', value: '32' }, { label: 'Hidden Width', value: '4,096' }, { label: 'Attention', value: moe ? '32Q / 8KV · Full' : '32Q / 8KV · W 4,096' }, { label: 'Config Context', value: '32,768' }],
    nodes: [
      {
        id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: '32,000 vocabulary → 4,096 hidden',
        description: 'Token id 查表形成残差流。此检查点的 Embedding 与 LM Head 不共享权重；这里展示完整矩阵。',
        inputShape: '[N] token ids', outputShape: shape, tone: 'input', weights: [{ name: 'embed_tokens.weight · global', shape: '[32,000, 4,096]' }],
        knowledge: [{ label: 'Decoder 结构', to: '/category/model-architecture' }],
      },
      {
        id: 'attention-norm', eyebrow: 'PRE-NORM', title: 'RMSNorm', subtitle: 'Attention 前归一化',
        description: '在 hidden 维度上做 RMS 归一化，同时保留未归一化输入供残差相加。不是 Qwen3 的 Q/K head 内归一化。',
        inputShape: shape, outputShape: shape, tone: 'attention', weights: [{ name: 'input_layernorm.weight', shape: '[4,096]' }],
        knowledge: [{ label: 'Pre-Norm 与残差', to: '/category/model-architecture' }],
      },
      {
        id: moe ? 'gqa' : 'swa', eyebrow: 'ATTENTION', title: moe ? 'Full GQA + RoPE' : 'Sliding Window GQA', subtitle: moe ? '32 Q heads · 8 KV heads · 无局部窗口' : '32 Q heads · 8 KV heads · W = 4,096',
        description: moe ? '每 4 个 Q heads 共享一对 K/V，Q 和 K 应用 RoPE。采用完整因果注意力，读取此前所有有效位置；只有 FFN 专家选择是稀疏的，Attention 并非 Top-2。' : '每组 4 个 Q heads 共享 K/V。Q/K 应用 RoPE 后执行局部因果注意力：只读当前位置及此前最多 4,095 个位置。滚动存储槽可以复用，但位置编码仍对应真实序列位置。',
        inputShape: shape, outputShape: shape, tone: 'attention', layerRange: 'Layers 0–31',
        phaseNotes: {
          prefill: moe ? '因果掩码下处理完整输入；Prefill 可分块，但不改变历史 KV 的完整注意力语义。' : 'Prefill 处理全部输入 token，并为每个 query 施加局部因果掩码；不能直接删掉输入前半段来替代这些计算。结束后只需保留窗口状态。',
          decode: moe ? '每请求新增一个 query，读取 S 个历史及当前位置的 KV。' : '每请求新增一个 query；窗口饱和后淘汰最早 KV 并写入新位置。固定的是本层缓存容量，不是新增 token 的计算量。',
        },
        tensors: [{ label: 'Q after projection / RoPE', shape: '[N, {localHeads}, 128]' }, { label: 'K / V · each', shape: '[N, {localKvHeads}, 128]' }],
        weights: [{ name: 'q_proj · TP local', shape: '[{localHeads} × 128, 4,096]' }, { name: 'k_proj / v_proj · each TP local', shape: '[{localKvHeads} × 128, 4,096]' }, { name: 'o_proj · TP local', shape: '[4,096, {localHeads} × 128]' }],
        knowledge: [{ label: 'Attention 算法', to: '/category/decode' }, { label: 'KV Cache', to: '/category/kv-cache-memory' }],
      },
      {
        id: 'kv-cache', eyebrow: 'STATE', title: moe ? 'Full GQA KV Cache' : 'Rolling KV Cache', subtitle: moe ? '保存全部 S 个位置' : '保留 min(S, 4,096) 个位置',
        description: moe ? '缓存按 KV head 做 TP 分片。专家数影响 FFN 权重，并不会让同一层的 KV 缓存复制 8 份。' : '此 Shape 是包含当前 token 的完整逻辑窗口，而非每个后端的物理分配。窗口达到 4,096 后大小保持不变；Prefill 的临时张量与历史信息的跨层传播不在这里表示。',
        inputShape: '[N, 2, {localKvHeads}, 128]', outputShape: '[{batch}, {cachedSequence}, 2, {localKvHeads}, 128]', tone: 'memory', weights: [],
        knowledge: [{ label: 'KV 内存与分页', to: '/category/kv-cache-memory' }],
      },
      ffn,
      {
        id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + LM Head', subtitle: '4,096 hidden → 32,000 logits',
        description: '最终 RMSNorm 后映射到词表；输出是完整逻辑 logits。TP 头只持有词表分片，Prefill 通常仅为待采样位置物化 logits。',
        inputShape: shape, outputShape: '[N, 32,000]', tone: 'output', weights: [{ name: 'norm.weight', shape: '[4,096]' }, { name: 'lm_head · TP local', shape: '[{vocabShard}, 4,096]' }],
        knowledge: [{ label: 'Decode 与采样', to: '/category/inference-basics' }],
      },
    ],
  }
}

export const mistralArchitectures = [mistralModel(false), mistralModel(true)]
