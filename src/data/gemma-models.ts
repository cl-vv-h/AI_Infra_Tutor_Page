import type { ArchitectureNode, ModelArchitecture } from '../types/model'

const shape = '[N, 3,584]'
const knowledge = [{ label: '模型架构', to: '/category/model-architecture' }, { label: 'TP 分片', to: '/category/parallel-strategy' }]
function norm(id: string, name: string, title: string, description: string, tone: 'attention' | 'ffn'): ArchitectureNode {
  return { id, eyebrow: 'RMSNORM', title, subtitle: '1-centered weight · ε = 1e−6', description: `${description} Gemma 2 使用 (1 + weight) 作为归一化后的缩放，不是直接乘 weight。`, inputShape: shape, outputShape: shape, tone, weights: [{ name, shape: '[3,584]' }], knowledge }
}
const attention = (sliding: boolean): ArchitectureNode => ({
  id: sliding ? 'swa' : 'gqa', eyebrow: 'ATTENTION', title: sliding ? 'Local Sliding GQA' : 'Global GQA', subtitle: sliding ? '偶数层 · W = 4,096' : '奇数层 · Full causal attention',
  description: '16 个 Q heads、8 个 KV heads，head_dim=256。Q 投影总宽度为 4,096，与残差宽度 3,584 不同。Q/K 应用 RoPE；缩放后的注意力 logits 经过 50 × tanh(x / 50)，再施加掩码与 Softmax。',
  inputShape: shape, outputShape: shape, tone: 'attention',
  phaseNotes: {
    prefill: sliding ? '处理完整输入，并对每个 query 使用局部因果掩码。不能用截断输入代替各层计算。' : '本层使用完整因果掩码；不继承相邻层的局部窗口。',
    decode: sliding ? '当前 query 直接读取最近最多 4,096 个位置的 KV，包含当前 token；窗口饱和后复用旧槽。' : '当前 query 读取全部 S 个有效位置的 KV；本层缓存继续随 S 增长。',
  },
  tensors: [{ label: 'Q after RoPE', shape: '[N, {localHeads}, 256]' }, { label: 'K / V · each', shape: '[N, {localKvHeads}, 256]' }],
  weights: [{ name: 'q_proj · TP local', shape: '[{localHeads} × 256, 3,584]' }, { name: 'k_proj / v_proj · each TP local', shape: '[{localKvHeads} × 256, 3,584]' }, { name: 'o_proj · TP local', shape: '[3,584, {localHeads} × 256]' }],
  knowledge: [{ label: 'Attention 算法', to: '/category/decode' }, { label: 'KV Cache', to: '/category/kv-cache-memory' }],
})

export const gemmaArchitectures: ModelArchitecture[] = [{
  id: 'gemma-2-9b', name: 'Gemma 2 9B', organization: 'Google', family: 'Alternating GQA · GeGLU',
  description: '42 层 Dense Decoder，局部滑窗与完整注意力逐层交替。每层采用四个 RMSNorm 和两个残差连接；FFN 是 GELU 门控而非 SwiGLU。这里展示 9B 基础模型的文本主干。',
  parameters: '9B', activeParameters: '9B', accent: '#9dbbff',
  configUrl: 'https://github.com/google/gemma_pytorch/blob/cb7c0152a369e43908e769eb09e1ce6043afe084/gemma/config.py#L129', configLabel: 'Google 官方 9B 配置',
  implementationUrl: 'https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/gemma2/modeling_gemma2.py',
  supportedTp: [1, 2, 4, 8],
  execution: { maxContext: 8192, denseLayers: 42, normLayout: 'pre-post', cache: { kind: 'mixed', window: 4096, layerTypes: Array.from({ length: 42 }, (_, i) => i % 2 === 0 ? 'sliding_attention' : 'full_attention') },
    contextNote: '编号从 0 开始：21 层滑窗、21 层完整注意力，配置上下文 8,192。局部容量按包含当前 token 的完整逻辑窗口计算，实际后端可保留 W−1 历史槽或采用不同物理分配。这里只展示架构，不打包模型权重；下载与使用须遵守 Gemma 模型条款。' },
  dimensions: { hiddenSize: 3584, vocabSize: 256000, layers: 42, attentionHeads: 16, kvHeads: 8, headDim: 256, intermediateSize: 14336 },
  metrics: [{ label: 'Decoder Layers', value: '42 · Local / Global' }, { label: 'Hidden Width', value: '3,584' }, { label: 'Attention', value: '16 Q / 8 KV · D 256' }, { label: 'Norms per Layer', value: '4 · Pre + Post' }],
  nodes: [
    { id: 'embedding', eyebrow: 'INPUT', title: 'Scaled Token Embedding', subtitle: '256,000 vocab · × √3,584', description: '词表查表后乘以 hidden_size 的平方根，进入残差流。Embedding 与 LM Head 共享参数；缩放因子不是额外的可训练矩阵。', inputShape: '[N] token ids', outputShape: shape, tone: 'input', weights: [{ name: 'embed_tokens.weight · global · tied', shape: '[256,000, 3,584]' }], knowledge },
    norm('attention-norm', 'input_layernorm.weight', 'Pre-Attention RMSNorm', '在注意力前归一化；保留原输入用于第一条残差连接。', 'attention'),
    attention(true), attention(false),
    norm('attention-post-norm', 'post_attention_layernorm.weight', 'Post-Attention RMSNorm', '归一化 Attention 输出，再与原始子层输入相加；不是残差之后的 FFN 前归一化。', 'attention'),
    norm('ffn-norm', 'pre_feedforward_layernorm.weight', 'Pre-FFN RMSNorm', '第一条残差相加后，为 FFN 输入做独立归一化。', 'ffn'),
    { id: 'ffn', eyebrow: 'DENSE FFN', title: 'GeGLU · GELU-tanh', subtitle: '3,584 → 14,336 → 3,584', description: 'GELU-tanh(gate_proj(x)) 与 up_proj(x) 逐元素相乘，再由 down_proj 返回残差宽度。GELU 使用 tanh 近似；不要替换成 SiLU / SwiGLU。', inputShape: shape, outputShape: shape, tone: 'ffn', weights: [{ name: 'gate_proj / up_proj · each TP local', shape: '[{intermediateShard}, 3,584]' }, { name: 'down_proj · TP local', shape: '[3,584, {intermediateShard}]' }], knowledge },
    norm('ffn-post-norm', 'post_feedforward_layernorm.weight', 'Post-FFN RMSNorm', '归一化 FFN 输出，再执行第二条残差相加。', 'ffn'),
    { id: 'window-cache', eyebrow: 'STATE', title: 'Local Window KV Cache', subtitle: '仅偶数层 · min(S, 4,096)', description: '局部注意力层只需保留窗口内 KV。这里显示逻辑有效长度，不含分页、静态预分配或临时 Prefill 激活。', inputShape: '[N, 2, {localKvHeads}, 256]', outputShape: '[{batch}, {windowSequence}, 2, {localKvHeads}, 256]', tone: 'memory', weights: [], knowledge: [{ label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }] },
    { id: 'kv-cache', eyebrow: 'STATE', title: 'Global KV Cache', subtitle: '仅奇数层 · 保留 S', description: '完整注意力层保存所有有效位置。整模型 KV 是完整层与滑窗层之和；不能让全部 42 层都在 4K 后停止增长。', inputShape: '[N, 2, {localKvHeads}, 256]', outputShape: '[{batch}, {sequence}, 2, {localKvHeads}, 256]', tone: 'memory', weights: [], knowledge: [{ label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }] },
    { id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + Tied LM Head', subtitle: '最终 logits softcap = 30', description: '最终 RMSNorm 后用共享词嵌入矩阵映射到词表，再对 logits 应用 30 × tanh(x / 30)。不是 hard clipping，也不是注意力中的 50 softcap。共享权重不应重复计为两份参数。', inputShape: shape, outputShape: '[N, 256,000]', tone: 'output', weights: [{ name: 'norm.weight · 1-centered', shape: '[3,584]' }, { name: 'lm_head.weight · tied TP local', shape: '[{vocabShard}, 3,584]', note: '与 embed_tokens 共享；这里展示 TP 词表分片，Embedding 节点展示全局矩阵。' }], knowledge },
  ],
}]
