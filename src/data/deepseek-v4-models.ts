import type { ArchitectureNode, ModelArchitecture, ModelWeight } from '../types/model'

const knowledge = [{ label: 'Attention 与 MoE', to: '/category/model-architecture' }, { label: '并行分片', to: '/category/parallel-strategy' }]
const hidden = '[N, 4096]'
const streams = '[N, 4, 4096]'
const ratios: Array<0 | 4 | 128> = Array.from({ length: 43 }, (_, i) => i < 2 ? 0 : i % 2 === 0 ? 4 : 128)

function hc(branch: 'attn' | 'ffn', post = false): ArchitectureNode {
  return {
    id: `hc-${branch}-${post ? 'post' : 'pre'}`, eyebrow: `mHC / ${post ? 'COMBINE' : 'REDUCE'}`,
    title: `mHC ${branch === 'attn' ? 'Attention' : 'FFN'} ${post ? 'Post' : 'Pre'}`,
    subtitle: post ? '子层输出广播 + 四路残差混合' : '四路主干 → 一路子层输入',
    description: post ? '保留的四路 residual 按 4×4 组合矩阵混合，再加上按 post 系数分发的子层输出，得到新的四路主干。不是普通 x+f(x)，也不是执行四次 Attention 或 MoE。post 和组合矩阵来自对应的 Pre，不重复学习一套权重。' : '将四路 hidden 展平为 16,384 维，动态投影生成 24 个混合值，分成 4 个 pre、4 个 post 和 16 个 residual mixing 值。Sinkhorn 约束残差组合矩阵；pre 加权求和得到一路 4,096 维输入，再交给 RMSNorm。四路 residual、post 和组合矩阵单独保留到对应 Post。',
    inputShape: post ? `${hidden} + ${streams}` : streams, outputShape: post ? streams : hidden,
    weights: post ? [] : [{ name: `hc_${branch}_fn · replicated`, shape: '[24, 16384]' }, { name: `hc_${branch}_base · replicated`, shape: '[24]' }, { name: `hc_${branch}_scale · replicated`, shape: '[3]' }],
    tensors: [{ label: 'pre / post 系数', shape: '[N, 4] / [N, 4]' }, { label: '组合矩阵 Hres', shape: '[N, 4, 4]', note: '20 次 Sinkhorn 迭代；图示系数 shape，不伪造训练后的数值。' }, { label: '保留的四路 residual', shape: streams }],
    weightlessNote: post ? '使用 Pre 产生的动态系数，无额外可训练权重。' : undefined,
    knowledge, tone: post ? 'output' : branch === 'attn' ? 'attention' : 'ffn',
  }
}

function compressorWeights(prefix: string, ratio: number, width: number): ModelWeight[] {
  const factor = ratio === 4 ? 2 : 1
  return [{ name: `${prefix}.wkv_gate · replicated`, shape: `[${2 * factor * width}, 4096]`, note: 'SGLang 融合 value 与 gate 投影；C4 另含 overlap 分量。' }, { name: `${prefix}.ape · replicated`, shape: `[${ratio}, ${factor * width}]` }, { name: `${prefix}.norm · replicated`, shape: `[${width}]` }]
}

function attention(ratio: 0 | 4 | 128): ArchitectureNode {
  const id = ratio === 0 ? 'window-mqa' : ratio === 4 ? 'csa' : 'hca'
  return {
    id, eyebrow: 'ATTENTION', title: ratio === 0 ? 'Sliding-window MQA' : ratio === 4 ? 'Compressed Sparse Attention' : 'Heavily Compressed Attention',
    subtitle: ratio === 0 ? '128 原始位置 · 不生成压缩历史' : ratio === 4 ? 'SWA 128 + C4 检索 Top-512' : 'SWA 128 + 全部 C128 压缩位置',
    description: 'Q 经 1,024 维低秩投影扩展到 64 个 512 维 heads；共享 KV 只有一份 512 维向量，同时充当 Key 与 Value，不乘 K/V 的二倍系数。Q 做无参数逐 head RMS 归一化；Q/K 的最后 64 维做 RoPE，输出先逆旋转，再经过 8 组低秩输出投影。每 head 有一个 attention sink 标量。' + (ratio === 0 ? '本层只直接读取最近 128 个原始位置。' : ratio === 4 ? '另一路 learned gated pooling 每 4 个 token 形成一个压缩位置，使用 overlap。Indexer 在独立的 128 维压缩 Index K 上选最多 512 个位置；它选的是压缩记录，不是 512 个原始 token。滑窗与所选压缩记录共同参与一次 Attention。' : '另一路每 128 个 token 形成一个压缩位置，读取所有已完成压缩记录；没有 C4 Indexer 或 Top-512 筛选。'),
    inputShape: hidden, outputShape: hidden,
    phaseNotes: {
      prefill: 'N=B×S。每个 query 只能读取自己之前已形成的压缩块及 causal 滑窗；图中的历史 shape 表示整个 Prefill 结束后的保留状态，不表示最早 query 可看见未来压缩块。',
      decode: ratio ? `N=B。每当总长度 S 完成 ${ratio} 的一个分组，追加一条压缩记录；未完成分组保留在 FP32 compressor state。滑窗滚动替换旧原始位置。` : 'N=B。覆盖环形窗口内最旧位置，保留最近 min(S,128) 条 KV。没有压缩记录或 compressor state。',
    },
    tensors: [{ label: 'Q latent · replicated', shape: '[N, 1024]' }, { label: 'Q · TP local', shape: '[N, {localHeads}, 512]' }, { label: '共享 KV', shape: '[N, 512]', note: '448 noPE + 64 RoPE；K=V 共享表示。' }, { label: '分组输出低秩 latent · TP local', shape: '[N, {localGroups}, 1024]' }, ...(ratio === 4 ? [{ label: 'Indexer Q · SGLang replicated', shape: '[N, 64, 128]' }] : [])],
    weights: [
      { name: 'wq_a · replicated', shape: '[1024, 4096]' }, { name: 'q_norm · replicated', shape: '[1024]' },
      { name: 'wq_b · TP local', shape: '[{localHeads} × 512, 1024]' }, { name: 'wkv · replicated', shape: '[512, 4096]' }, { name: 'kv_norm · replicated', shape: '[512]' },
      { name: 'wo_a · grouped TP local', shape: '[{localGroups}, 1024, 4096]', note: '每组 8 heads × 512；不是普通 32768→8192 的全连接。' },
      { name: 'wo_b · TP local', shape: '[4096, {localGroups} × 1024]' }, { name: 'attn_sink · SGLang replicated', shape: '[64]', note: '官方最小实现按本地 heads 保存；本图采用 SGLang 参数声明的全 heads 副本。' },
      ...(ratio ? compressorWeights('compressor', ratio, 512) : []),
      ...(ratio === 4 ? [{ name: 'indexer.wq_b · SGLang replicated', shape: '[64 × 128, 1024]' }, { name: 'indexer.weights_proj · SGLang replicated', shape: '[64, 4096]' }, ...compressorWeights('indexer.compressor', 4, 128)] : []),
    ], knowledge, tone: 'attention',
  }
}

function cacheNode(ratio: 0 | 4 | 128): ArchitectureNode {
  const kind = ratio === 0 ? 'window-mqa' : ratio === 4 ? 'csa' : 'hca'
  const compressed = ratio === 4 ? '{compressed4}' : '{compressed128}'
  const stateShape = ratio === 4 ? '[{batch}, 8, 1024] × 2 + [{batch}, 8, 256] × 2' : '[{batch}, 128, 512] × 2'
  return {
    id: `${kind}-cache`, eyebrow: 'STATE / RETAINED', title: ratio ? `SWA + C${ratio} Cache` : 'SWA-only KV Cache',
    subtitle: ratio ? '窗口记录、压缩历史和增量状态分开存储' : '只保留短窗口，没有压缩支路',
    description: '各 TP rank 都保存同一份 KV 表示；增加 TP 不会把共享 KV 宽度除小。' + (ratio ? `已完成的压缩记录数为 floor(S/${ratio})，不是 ceil，也不是滑窗长度。${ratio === 4 ? 'Index K 还保存全部 C4 压缩位置，Top-512 仅限制主 Attention 读取。' : 'C128 没有 Index K。'} 缓存实验另计官方最小实现的 FP32 kv_state 与 score_state 固定窗口；生产引擎可能使用在线归约或不同环形布局。` : 'K 和 V 引用同一份表示，所以容量按一次 512 维计算。'),
    inputShape: '[N, 512]', outputShape: `[{batch}, {windowSequence}, 512]${ratio ? ` + [{batch}, ${compressed}, 512]` : ''}`,
    tensors: [...(ratio ? [{ label: '压缩 KV', shape: `[{batch}, ${compressed}, 512]` }, { label: 'FP32 Compressor state · 参考实现基线', shape: stateShape, note: '每个 ×2 分别表示 kv_state 与 score_state，不随 KV 精度改变。' }] : []), ...(ratio === 4 ? [{ label: '全部压缩 Index K', shape: '[{batch}, {compressed4}, 128]' }] : [])],
    weights: [], weightlessNote: '运行时状态，不是可训练权重。各式是独立 buffer 的逻辑 shape；不把它们视为一个实际连续张量。', knowledge: [{ label: 'KV Cache', to: '/category/kv-cache-memory' }], tone: 'memory',
  }
}

function moe(hash = false): ArchitectureNode {
  return {
    id: hash ? 'hash-moe' : 'moe', eyebrow: 'FFN / ROUTING', title: hash ? 'Token-id routed MoE' : 'Score-routed MoE',
    subtitle: hash ? 'Layers 0–2 · 预设 6 个专家编号' : 'Layers 3–42 · 分数 Top-6',
    description: `256 个 routed experts，每 token 执行 6 个，另有 1 个 shared expert；单专家中间维 2,048，SwiGLU 带 limit=10。${hash ? '前三层按 input_ids 查 tid2eid，决定专家集合；仍计算 sqrt(softplus(router(x))) 作为被选专家的权重，并非没有 Router GEMM 或没有 MoE。' : '其余层以 sqrt(softplus(router(x))) 加 correction bias 选 Top-6；bias 不进入原始路由权重。'}被选原始分数归一化后乘 1.5。图中按 SGLang 当前 EP 分配专家、MoE-TP 切分专家中间维；shared 始终按完整 TP 切分，与官方最小实现的并行口径分开。`,
    inputShape: hidden, outputShape: hidden,
    tensors: [{ label: 'Router scores', shape: '[N, 256]' }, { label: '专家索引与权重', shape: '[N, 6] / [N, 6]' }, ...(hash ? [{ label: 'tid2eid 冻结 INT32 表', shape: '[129280, 6]', note: '每层 3,102,720 B，三层独立；不是浮点可训练权重，未混入统一位宽权重账本或 KV 缓存预算。' }] : [])],
    weights: [{ name: 'gate.weight · replicated', shape: '[256, 4096]' }, ...(!hash ? [{ name: 'e_score_correction_bias · replicated', shape: '[256]' }] : []), { routedExpert: true, name: 'experts.gate_up_proj · TP local', shape: '[256, 2 × {expertShard}, 4096]' }, { routedExpert: true, name: 'experts.down_proj · TP local', shape: '[256, 4096, {expertShard}]' }, { name: 'shared_expert.gate_up_proj · TP local', shape: '[2 × {expertShard}, 4096]' }, { name: 'shared_expert.down_proj · TP local', shape: '[4096, {expertShard}]' }],
    knowledge, tone: 'ffn', layerRange: hash ? 'Layers 0–2' : 'Layers 3–42',
  }
}

export const deepseekV4Architectures: ModelArchitecture[] = [{
  id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', organization: 'DeepSeek', family: 'SWA + CSA / HCA · mHC · Hash MoE',
  description: '43 层通过四路 mHC 主干传递信息。SWA 保留细粒度近期 token，CSA / HCA 压缩长历史；前三层按 token-id 路由专家，后续按分数路由。对应原始 V4-Flash，不冒充 0731 更新版或 V4.1。',
  parameters: '284B（模型卡）', activeParameters: '13B（模型卡）', accent: '#ffaeb9',
  configUrl: 'https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json', configLabel: '官方原始 Flash 配置 · 2026-09-14 核对',
  implementationUrl: 'https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/models/deepseek_v4.py', supportedTp: [1, 2, 4, 8],
  execution: { maxContext: 1048576, denseLayers: 0, hashLayers: 3, residualLayout: 'mhc', residualStreams: 4, outputGroups: 8,
    contextNote: '缓存为占用的逻辑记录 + 官方最小实现 FP32 compressor 窗口。不是生产量化布局，也不是 max_seq_len 预分配；不含 INT32 路由表、RoPE 表、临时 logits、MTP 和分页开销。权重按 SGLang 当前 EP / MoE-TP 基线，缓存状态口径另行明示。',
    cache: { kind: 'compressed', window: 128, ratios, kvWidth: 512, indexWidth: 128, indexTopk: 512, stateBytes: 4 }, expertParallel: { experts: 256, topK: 6, hiddenSize: 4096 }, expertIntermediateSize: 2048 },
  metrics: [{ label: 'Target Layers', value: '43' }, { label: 'SWA / CSA / HCA', value: '2 / 21 / 20' }, { label: 'Residual Streams', value: '4 · mHC' }, { label: 'MoE', value: '256 · Top-6 + shared' }],
  dimensions: { hiddenSize: 4096, vocabSize: 129280, layers: 43, attentionHeads: 64, kvHeads: 1, headDim: 512, intermediateSize: 2048 },
  nodes: [
    { id: 'embedding', eyebrow: 'INPUT / EXPAND', title: 'Embedding + mHC Expand', subtitle: '一路 token embedding 初始化为四路', description: '词表投影先得到 [N,4096]，再重复到四路 residual stream。只有一套词表权重，不是四份 embedding 参数；四路在后续 mHC 中逐步分化。', inputShape: '[N] token ids', outputShape: streams, weights: [{ name: 'embed_tokens · TP local', shape: '[{vocabShard}, 4096]' }], knowledge, tone: 'input' },
    hc('attn'), hc('attn', true), hc('ffn'), hc('ffn', true),
    ...(['attention', 'ffn'] as const).map((branch): ArchitectureNode => ({ id: `${branch}-norm`, eyebrow: 'PRE-NORM', title: `${branch === 'attention' ? 'Attention' : 'FFN'} RMSNorm`, subtitle: '在 mHC 合并后的一路向量上归一化', description: 'mHC Pre 已将四路主干加权缩成一路；RMSNorm 缩放这一路 4,096 维向量，随后交给子层。它不会对四路分别执行四份子层。', inputShape: hidden, outputShape: hidden, weights: [{ name: branch === 'attention' ? 'input_layernorm' : 'post_attention_layernorm', shape: '[4096]' }], knowledge, tone: branch === 'attention' ? 'attention' : 'ffn' })),
    attention(0), attention(4), attention(128), cacheNode(0), cacheNode(4), cacheNode(128), moe(true), moe(),
    { id: 'lm-head', eyebrow: 'OUTPUT / COLLAPSE', title: 'mHC Head + Norm + LM Head', subtitle: '最终四路主干 → 单路 → 词表 logits', description: '43 个 target 层结束后，以独立 hc_head 动态系数加权四路，得到一路 hidden；再 RMSNorm、词表投影和采样。本图展示逐位置逻辑 logits，推理实现可只投影每请求最后位置。配置列表末尾额外的 ratio=0 属于 1 个 MTP 辅助层，不是第 44 个 target 层；本图未展开 MTP。', inputShape: streams, outputShape: '[N, 129280]', weights: [{ name: 'hc_head_fn · replicated', shape: '[4, 16384]' }, { name: 'hc_head_base · replicated', shape: '[4]' }, { name: 'hc_head_scale · replicated', shape: '[1]' }, { name: 'norm.weight', shape: '[4096]' }, { name: 'lm_head · TP local', shape: '[{vocabShard}, 4096]' }], knowledge: [{ label: 'Decode 与采样', to: '/category/decode' }, { label: 'MTP', to: '/category/speculative-decoding' }], tone: 'output' },
  ],
}]
