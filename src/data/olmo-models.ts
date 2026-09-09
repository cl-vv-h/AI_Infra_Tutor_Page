import type { ModelArchitecture } from '../types/model'

const hidden = '[N, 4,096]'
const structure = [{ label: 'Decoder 与残差', to: '/category/model-architecture' }]
const parallel = [{ label: 'TP 切分与通信', to: '/category/parallel-strategy' }]
const attention = [{ label: 'Q/K/V 与 Head Shape', to: '/article/ai-infra-basic--model-architecture--02-gqa-attention-shapes' }, { label: 'Attention 与位置编码', to: '/category/prefill' }]

// Checkpoint and pinned Transformers reference checked 2026-09-09.
// Q/K RMSNorm spans flattened heads; colwise_rep gathers activations, not weights.
export const olmoArchitectures: ModelArchitecture[] = [{
  id: 'olmo-2-1124-7b', name: 'OLMo 2 7B · 1124', organization: 'Ai2', family: 'MHA · Full-width QK Norm · Post-branch Norm',
  description: '32 层 Dense Decoder。Q/K 在拆 head 前按完整投影宽度归一化，Attention 与 FFN 的输出也各自归一化，再进入残差相加。图中采用 Transformers v4.57.1 的汇集式 Attention TP 路径。',
  parameters: '7B', activeParameters: '7B', accent: '#9fe2bf',
  configUrl: 'https://huggingface.co/allenai/OLMo-2-1124-7B/blob/main/config.json', configLabel: 'Ai2 官方 1124 配置',
  implementationUrl: 'https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/olmo2/modeling_olmo2.py',
  supportedTp: [1, 2, 4, 8],
  execution: {
    maxContext: 4096, denseLayers: 32, normLayout: 'post-branch-qk', cache: { kind: 'gqa', layout: 'replicated' },
    contextNote: 'OLMo-2-1124-7B：32 Q / 32 KV，最大上下文 4,096，无滑窗或额外 RoPE 扩展。按 Transformers v4.57.1 的 base_model_tp_plan：Q/K/V 为 colwise_rep，权重分片但输出汇集；Q/K Norm 跨完整投影宽度，Attention 和 KV 在每个 rank 保留全部 heads。o_proj 为 rowwise_rep，FFN 正常分片。这里是该参考路径的逻辑容量，不是所有推理引擎的唯一布局，也未执行多卡性能实测。',
  },
  dimensions: { hiddenSize: 4096, vocabSize: 100352, layers: 32, attentionHeads: 32, kvHeads: 32, headDim: 128, intermediateSize: 11008 },
  metrics: [{ label: 'Decoder Layers', value: '32' }, { label: 'Hidden Width', value: '4,096' }, { label: 'Q / KV Heads', value: '32 / 32 · 128D' }, { label: 'Config Context', value: '4,096' }],
  nodes: [
    {
      id: 'embedding', eyebrow: 'INPUT', title: 'Token Embedding', subtitle: '100,352 vocab → 4,096 hidden',
      description: '词表查表形成残差流。Embedding 与输出 LM Head 不共享权重；这里显示完整词表矩阵。',
      inputShape: '[N] token ids', outputShape: hidden, tone: 'input', weights: [{ name: 'embed_tokens.weight · replicated', shape: '[100,352, 4,096]' }], knowledge: structure,
    },
    {
      id: 'attention-projection', eyebrow: 'PROJECT → GATHER', title: 'Q / K / V Projections', subtitle: '无输入 Pre-Norm · 权重分片，输出汇集',
      description: '三路独立无 bias 线性投影直接读取残差输入。参考 TP 的 colwise_rep 先用本卡权重分片计算，再汇集完整 Q/K/V 输出。不要把“输出复制”误解成“投影权重也复制”。',
      inputShape: hidden, outputShape: 'Q / K / V each [N, 4,096]', tone: 'attention',
      weights: [{ name: 'q_proj / k_proj / v_proj · each TP local', shape: '[{localHeads} × 128, 4,096]', multiplicity: 3 }],
      tensors: [{ label: 'Q / K / V before gather · each TP local', shape: '[N, {localHeads} × 128]' }, { label: 'Q / K / V after gather · each replicated', shape: hidden, note: 'TP = 1 时不需要跨卡汇集。输出仍未拆分 heads。' }],
      knowledge: [...attention, ...parallel],
    },
    {
      id: 'qk-norm', eyebrow: 'FULL-WIDTH RMSNORM', title: 'Q/K Norm · 跨全部 heads', subtitle: '各自沿 4,096 维归一化 · ε = 1e−6',
      description: 'Q 和 K 分别计算完整 4,096 维的均方根，再乘各自的可训练缩放向量；V 不归一化。之后才 reshape 成 32 × 128 并对 Q/K 应用 RoPE。它不同于 Qwen3 对每个 head 的 128 维单独归一化。',
      inputShape: 'Q / K each [N, 4,096]', outputShape: 'Q / K each [N, 32, 128]', tone: 'attention',
      weights: [{ name: 'q_norm.weight / k_norm.weight · each replicated', shape: '[4,096]', multiplicity: 2, note: '不是两条 [128] 向量。完整向量在每个 TP rank 保留。' }],
      tensors: [{ label: 'Q / K mean square · each replicated', shape: '[N, 1]', note: '均值跨完整投影宽度计算，不按 TP 分片独立取均值。' }, { label: 'Q / K after Norm, before RoPE · each', shape: '[N, 32, 128]' }, { label: 'V bypasses Norm · replicated', shape: '[N, 32, 128]' }],
      knowledge: [...structure, ...attention, ...parallel],
    },
    {
      id: 'mha', eyebrow: 'MULTI-HEAD ATTENTION', title: 'RoPE + Full MHA + Output', subtitle: '32Q = 32KV · 汇集式 Attention TP',
      description: 'Q/K 经 θ = 500,000 的 RoPE 后执行完整因果注意力。每个 rank 处理 32 个 heads；o_proj 的 rowwise_rep 将完整输入切到本卡所需分片，再归约得到完整 hidden 输出。Q/K Norm 不改变 heads 数或 KV 保存长度。',
      inputShape: 'Q / K / V each [N, 32, 128]', outputShape: hidden, tone: 'attention', layerRange: 'Layers 0–31',
      weights: [{ name: 'o_proj · TP local', shape: '[4,096, {localHeads} × 128]' }],
      tensors: [{ label: 'Q / K after RoPE · each replicated', shape: '[N, 32, 128]' }, { label: 'Attention output before o_proj slicing', shape: hidden }, { label: 'o_proj input slice · TP local', shape: '[N, {localHeads} × 128]' }],
      phaseNotes: { prefill: '对完整输入施加因果掩码。图中 Attention 数学保持不变，实际内核可以避免物化 S×S 的 score 矩阵。', decode: '每请求只产生一个新 Query，访问全部 S 个位置的 K/V。此参考路径每卡都有完整 32 个 KV heads，不能再除以 TP。' },
      knowledge: [...attention, ...parallel],
    },
    {
      id: 'attention-post-norm', eyebrow: 'BRANCH OUTPUT NORM', title: 'Post-Attention RMSNorm', subtitle: 'o_proj → Norm → Residual Add',
      description: '先归约 o_proj 输出，再沿 hidden 维做 RMSNorm，最后与未经过该 Norm 的原始残差输入相加。这不是 Llama 的 Attention 前 Pre-Norm，也不是把残差相加的结果再归一化。',
      inputShape: hidden, outputShape: hidden, tone: 'attention', weights: [{ name: 'post_attention_layernorm.weight · replicated', shape: '[4,096]' }], knowledge: structure,
    },
    {
      id: 'kv-cache', eyebrow: 'REPLICATED STATE', title: 'Full MHA KV · 每卡完整副本', subtitle: '32 KV heads · 不随 TP 缩小',
      description: '缓存保存经过 Q/K Norm 与 RoPE 的 K，以及未经 Norm 或 RoPE 的 V。参考 TP 已汇集全部 heads，因此每卡存完整 KV；只有权重分片，不能推导出缓存也等比例分片。',
      inputShape: '[N, 2, {cacheKvHeads}, 128]', outputShape: '[{batch}, {sequence}, 2, {cacheKvHeads}, 128]', tone: 'memory', weights: [],
      knowledge: [{ label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }, ...parallel],
    },
    {
      id: 'ffn', eyebrow: 'DENSE FFN', title: 'SwiGLU · Dense FFN', subtitle: '4,096 → 11,008 → 4,096',
      description: '直接读取第一条残差相加结果，没有额外 FFN 输入 Norm。gate/up 分片后计算 SiLU(gate) × up，down_proj 归约回 hidden width，再进入 FFN 输出 Norm。三个投影均无 bias。',
      inputShape: hidden, outputShape: hidden, tone: 'ffn', layerRange: 'Layers 0–31',
      weights: [{ name: 'gate_proj / up_proj · each TP local', shape: '[{intermediateShard}, 4,096]', multiplicity: 2 }, { name: 'down_proj · TP local', shape: '[4,096, {intermediateShard}]' }],
      tensors: [{ label: 'Gate / Up · each TP local', shape: '[N, {intermediateShard}]' }, { label: 'SiLU(Gate) × Up · TP local', shape: '[N, {intermediateShard}]' }], knowledge: [...structure, ...parallel],
    },
    {
      id: 'ffn-post-norm', eyebrow: 'BRANCH OUTPUT NORM', title: 'Post-FFN RMSNorm', subtitle: 'down_proj → Norm → Residual Add',
      description: 'FFN 输出归约完成后做 RMSNorm，再加回 FFN 输入。一个 Decoder 层共有四条 RMSNorm 缩放向量：Q、K、Attention 输出和 FFN 输出；末尾的全模型 Norm 不包含在这四条中。',
      inputShape: hidden, outputShape: hidden, tone: 'ffn', weights: [{ name: 'post_feedforward_layernorm.weight · replicated', shape: '[4,096]' }], knowledge: structure,
    },
    {
      id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + Untied LM Head', subtitle: '4,096 hidden → 100,352 logits',
      description: '32 层之后做最终 RMSNorm，再经独立 LM Head 生成词表 logits。参考实现的 colwise_rep 对 LM Head 权重按词表分片并汇集输出；采样路径可只请求末尾位置的 logits。',
      inputShape: hidden, outputShape: '[N, 100,352]', tone: 'output', weights: [{ name: 'norm.weight · replicated', shape: '[4,096]' }, { name: 'lm_head.weight · TP local', shape: '[{vocabShard}, 4,096]' }], knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }],
    },
  ],
}]
