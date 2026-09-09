import type { ArchitectureNode, ModelArchitecture } from '../types/model'

const hybridLesson = '/article/sglang-ascend-npu--source-code-walkthrough--examples--01-qwen3-5-hybrid-end-to-end'
const knowledge = [
  { label: 'Qwen3.5 执行路径', to: hybridLesson },
  { label: 'KV 与状态缓存', to: '/category/kv-cache-memory' },
]

function qwen35(moe: boolean): ModelArchitecture {
  const hidden = moe ? 2048 : 4096
  const layers = moe ? 40 : 32
  const kvHeads = moe ? 2 : 4
  const name = moe ? 'Qwen3.5-35B-A3B' : 'Qwen3.5-9B'
  const shape = `[N, ${hidden}]`
  const ffn: ArchitectureNode = {
    id: moe ? 'moe' : 'ffn', eyebrow: 'FFN', title: moe ? 'MoE + Gated Shared Expert' : 'Dense SwiGLU',
    subtitle: moe ? '256 routed · Top-8 · 1 gated shared' : '4096 → 12288 → 4096',
    description: moe ? '每个 token 激活 8 个 routed experts，另一路 shared expert 始终计算，其输出乘以独立 sigmoid gate 后与路由结果相加。专家中间维为 512；此处仅展示 EP = 1 的 TP 切分。' : '每层都使用相同维度的 Dense FFN。SiLU(gate_proj(x)) 与 up_proj(x) 相乘，经 down_proj 投影后与残差相加。',
    inputShape: shape, outputShape: shape, tone: 'ffn', knowledge,
    weights: moe ? [
      { name: 'gate.weight · replicated', shape: '[256, 2048]' },
      { name: 'experts.gate_up_proj · TP local', shape: '[256, 2 × {expertShard}, 2048]' },
      { name: 'experts.down_proj · TP local', shape: '[256, 2048, {expertShard}]' },
      { name: 'shared_expert.gate_proj / up_proj · each TP local', shape: '[{expertShard}, 2048]', multiplicity: 2 },
      { name: 'shared_expert.down_proj · TP local', shape: '[2048, {expertShard}]' },
      { name: 'shared_expert_gate.weight · replicated', shape: '[1, 2048]' },
    ] : [
      { name: 'gate_proj / up_proj · each TP local', shape: '[{intermediateShard}, 4096]', multiplicity: 2 },
      { name: 'down_proj · TP local', shape: '[4096, {intermediateShard}]' },
    ],
  }
  return {
    id: moe ? 'qwen3-5-35b-a3b' : 'qwen3-5-9b', name, organization: 'Qwen', family: `Hybrid · Gated DeltaNet · ${moe ? 'MoE' : 'Dense'} · Vision`,
    description: `每 4 层包含 3 层 Gated DeltaNet 与 1 层完整注意力。${layers * 3 / 4} 层维护固定大小的循环状态，${layers / 4} 层保存随上下文增长的 KV；视觉分支将图像/视频编码后合入语言序列。`,
    parameters: moe ? '35B' : '9B', activeParameters: moe ? '3B' : '9B', accent: '#f0b88a',
    configUrl: `https://huggingface.co/Qwen/${name}/blob/main/config.json`, configLabel: '官方文本与视觉配置',
    implementationUrl: `https://github.com/huggingface/transformers/blob/main/src/transformers/models/${moe ? 'qwen3_5_moe/modeling_qwen3_5_moe' : 'qwen3_5/modeling_qwen3_5'}.py`,
    supportedTp: [1, 2, 4, 8],
    execution: {
      maxContext: 262144, denseLayers: moe ? 0 : layers, expertIntermediateSize: moe ? 512 : undefined,
      contextNote: '此估算只计算语言主干的单份请求状态；视觉 token 已计入 S 时也会占用语言 KV，不包含视觉编码器临时激活或 speculative / prefix cache 额外状态副本。',
      cache: { kind: 'hybrid', layerTypes: Array.from({ length: layers }, (_, i) => (i + 1) % 4 === 0 ? 'full_attention' : 'linear_attention'), keyHeads: 16, valueHeads: 32, keyDim: 128, valueDim: 128, convKernel: 4, convStateSlots: 4, convBytes: 2, recurrentBytes: 4 },
    },
    metrics: [
      { label: 'Decoder Layers', value: String(layers) }, { label: 'Hidden Width', value: String(hidden) },
      { label: 'Layer Pattern', value: '3 DeltaNet : 1 Full' }, { label: 'Full Attention', value: `16Q / ${kvHeads}KV · 256D` },
    ],
    dimensions: { hiddenSize: hidden, vocabSize: 248320, layers, attentionHeads: 16, kvHeads, headDim: 256, intermediateSize: moe ? 512 : 12288 },
    nodes: [
      {
        id: 'embedding', eyebrow: 'TEXT INPUT', title: 'Token Embedding', subtitle: `248320 vocabulary → ${hidden} hidden`,
        description: '文本 token 查表进入语言主干。带图像/视频的请求会用视觉编码器输出替换相应占位位置的 embedding；纯文本请求跳过视觉分支。',
        inputShape: '[N] token ids', outputShape: shape, weights: [{ name: 'embed_tokens.weight · global', shape: `[248320, ${hidden}]` }], knowledge, tone: 'input',
      },
      {
        id: 'vision', eyebrow: 'OPTIONAL VISION INPUT', title: 'Vision Encoder → Patch Merger', subtitle: '27 ViT layers · 2 × 2 spatial merge',
        description: `图像/视频经处理器形成 P 个 3×2×16×16 patch。Conv3D 投影到 1152 维，27 层非因果 ViT 后，每 4 个相邻空间 patch 合并为一个 ${hidden} 维视觉 token，再注入文本占位位置。P 是视觉 patch 数，与语言前向的 N 不同。`,
        inputShape: '[P, 3, 2, 16, 16]', outputShape: `[P / 4, ${hidden}]`, tone: 'input', knowledge,
        phaseNotes: { prefill: '仅含图像/视频的首次编码经过此分支；S 包含合入序列的视觉 token。', decode: '标准逐 token 解码复用已有语言状态，不重新运行视觉编码器。' },
        weights: [
          { name: 'patch_embed.proj · global', shape: '[1152, 3, 2, 16, 16]', note: 'Conv3D；bias [1152]' },
          { name: 'pos_embed.weight · global', shape: '[2304, 1152]', note: '位置向量按图像网格插值' },
          { name: 'ViT attention.qkv · each layer global', shape: '[3456, 1152]', note: '16 heads × 72D；bias [3456]' },
          { name: 'ViT attention.proj · global', shape: '[1152, 1152]', note: 'bias [1152]' },
          { name: 'ViT MLP fc1 / fc2 · global', shape: '[4304, 1152] / [1152, 4304]', note: 'GELU；bias [4304] / [1152]' },
          { name: 'ViT norm1 / norm2 · each', shape: '[1152]', note: 'LayerNorm scale 与 bias；每层' },
          { name: 'merger.norm · global', shape: '[1152]', note: 'LayerNorm scale 与 bias' },
          { name: 'merger.linear_fc1 · global', shape: '[4608, 4608]', note: 'bias [4608]；GELU' },
          { name: 'merger.linear_fc2 · global', shape: `[${hidden}, 4608]`, note: `bias [${hidden}]` },
        ],
      },
      {
        id: 'attention-norm', eyebrow: 'PRE-NORM', title: 'RMSNorm', subtitle: '按 hidden width 归一化',
        description: '先保留输入作为残差，再对 hidden 向量归一化。Qwen3.5 的这一归一化实现使用 (1 + weight) 缩放，checkpoint 参数初值与常规 RMSNorm 不同。',
        inputShape: shape, outputShape: shape, weights: [{ name: 'input_layernorm.weight', shape: `[${hidden}]` }], knowledge, tone: 'attention',
      },
      {
        id: 'gdn', eyebrow: 'LINEAR ATTENTION', title: 'Gated DeltaNet', subtitle: 'QK: 16 × 128 · V: 32 × 128',
        description: 'Q/K/V 经短程深度卷积，Q/K 按 head 做 L2 归一化，并从 16 heads 复制到 32 个 value heads。衰减门与写入门控制循环矩阵更新；读取结果经门控 RMSNorm 与输出投影返回残差流。',
        inputShape: shape, outputShape: shape, tone: 'attention', knowledge,
        phaseNotes: { prefill: 'Chunk Gated Delta Rule：按 token 块并行处理新输入，结束后保留最终矩阵及卷积窗口。', decode: 'Recurrent Gated Delta Rule：从上一步矩阵读出旧记忆，衰减并写入当前 K/V，再读出当前 Q 的结果。没有随 S 增长的逐 token KV 列表。' },
        tensors: [
          { label: '卷积后 Q / K · before repeat', shape: '[N, {linearKeyHeads}, 128]' },
          { label: 'V / Z · each', shape: '[N, {linearValueHeads}, 128]' },
          { label: '衰减 g 与写入 β · each', shape: '[N, {linearValueHeads}]' },
          { label: '循环矩阵 H', shape: '[{batch}, {linearValueHeads}, 128, 128]', note: 'FP32；大小与 S 无关' },
        ],
        weights: [
          { name: 'in_proj_qkv · TP local', shape: `[{linearQkv}, ${hidden}]`, note: 'Q + K + V；全局宽度 8192' },
          { name: 'conv1d.weight · TP local', shape: '[{linearQkv}, 1, 4]', note: 'depthwise causal convolution；无 bias' },
          { name: 'in_proj_z · TP local', shape: `[{linearValueWidth}, ${hidden}]` },
          { name: 'in_proj_a / in_proj_b · each TP local', shape: `[{linearValueHeads}, ${hidden}]`, multiplicity: 2 },
          { name: 'A_log / dt_bias · each TP local', shape: '[{linearValueHeads}]', multiplicity: 2 },
          { name: 'norm.weight · replicated', shape: '[128]', note: 'RMSNorm 后乘 SiLU(z)' },
          { name: 'out_proj · TP local', shape: `[${hidden}, {linearValueWidth}]` },
        ],
      },
      {
        id: 'recurrent-state', eyebrow: 'FIXED-SIZE STATE', title: 'DeltaNet Matrix + Conv Window', subtitle: '每请求、每层一份 · 不随 S 增长',
        description: '循环矩阵保留历史的压缩表示，卷积窗口保留最近少量 Q/K/V。这里按 Transformers 的 4 个窗口槽位、BF16 卷积状态和 FP32 循环矩阵计数；不同引擎可能仅保留 K−1 个槽位。',
        inputShape: '[N, {linearQkv}] + previous state', outputShape: '[{batch}, {linearValueHeads}, 128, 128] + [{batch}, {linearQkv}, {convSlots}]',
        weights: [], weightlessNote: '这是两种运行时状态。矩阵与窗口的精度独立于完整注意力 KV 的精度选择。', knowledge, tone: 'memory',
      },
      {
        id: 'gqa', eyebrow: 'FULL ATTENTION', title: 'Gated Full Attention', subtitle: `16 Q heads · ${kvHeads} KV heads · output gate`,
        description: 'Q 投影同时产生 query 和同宽度的输出 gate，所以该权重的输出轴是普通 Q 投影的两倍。Q/K 做 RMSNorm 后仅前 64 维应用 RoPE；完整注意力结果乘 sigmoid(gate)，再输出投影。',
        inputShape: shape, outputShape: shape, tone: 'attention', knowledge,
        phaseNotes: { prefill: '对输入做因果完整注意力，并为所有有效位置写入 K/V。', decode: '每请求使用一个新 query 读取历史 K/V；这些完整注意力层的缓存仍随 S 线性增长。' },
        tensors: [{ label: 'Q / output gate · each', shape: '[N, {localHeads}, 256]' }, { label: 'K / V · each', shape: '[N, {localKvHeads}, 256]' }],
        weights: [
          { name: 'q_proj (Q + gate) · TP local', shape: `[2 × {localHeads} × 256, ${hidden}]` },
          { name: 'k_proj / v_proj · each TP local', shape: `[{localKvHeads} × 256, ${hidden}]`, multiplicity: 2 },
          { name: 'q_norm / k_norm · each', shape: '[256]', multiplicity: 2, note: '使用 (1 + weight) 缩放；各 TP rank 复制' },
          { name: 'o_proj · TP local', shape: `[${hidden}, {localHeads} × 256]` },
        ],
      },
      {
        id: 'kv-cache', eyebrow: 'GROWING STATE', title: 'Full-Attention KV Cache', subtitle: `仅 ${layers / 4} 层保留完整 K/V`,
        description: '只有当前完整注意力层使用此缓存；不能把总层数直接代入普通 Transformer 的 KV 公式。TP 超过 KV heads 时，需要复制完整的 KV head。',
        inputShape: '[N, 2, {localKvHeads}, 256]', outputShape: '[{batch}, {sequence}, 2, {localKvHeads}, 256]', weights: [], knowledge, tone: 'memory',
      },
      ffn,
      {
        id: 'lm-head', eyebrow: 'OUTPUT', title: 'Final Norm + LM Head', subtitle: `${hidden} hidden → 248320 logits`,
        description: '完成全部混合 Decoder 层后，经最终 RMSNorm 和独立的输出头产生词表 logits。此处为标准自回归主干，MTP 辅助分支不在这次前向中执行。',
        inputShape: shape, outputShape: '[N, 248320]', weights: [{ name: 'norm.weight', shape: `[${hidden}]` }, { name: 'lm_head · TP local', shape: `[{vocabShard}, ${hidden}]` }], knowledge, tone: 'output',
      },
    ],
  }
}

export const hybridArchitectures = [qwen35(false), qwen35(true)]
