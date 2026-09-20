export interface KnowledgeTopic {
  id: string
  group: 'structure' | 'execution' | 'serving'
  title: string
  summary: string
  prerequisites: string[]
  concepts: { title: string; body: string; expression: string; scope: string }[]
  examples: { label: string; to: string }[]
  readings: { label: string; to: string }[]
}

export const knowledgeGroups = [
  { id: 'structure', index: '01', title: '模型结构', subtitle: '数据流、算子与状态', color: '#70e1f5' },
  { id: 'execution', index: '02', title: '执行与存储', subtitle: '分片、精度与内存', color: '#c7a8ff' },
  { id: 'serving', index: '03', title: '服务与性能', subtitle: '调度、内核与测量', color: '#d8ff78' },
] as const

export const modelKnowledge: KnowledgeTopic[] = [
  {
    id: 'tensor-flow', group: 'structure', title: '张量与数据流', summary: 'Token、隐藏状态与逐层变换。', prerequisites: [],
    concepts: [
      { title: 'Prefill 与 Decode', body: 'Prefill 处理输入 token 并建立历史状态；普通自回归 Decode 每个活跃请求新增一个 query token，读取已有历史。', expression: 'N_prefill = Σ prompt_length；N_decode = B', scope: 'B 为活跃请求数。等长、无前缀复用的 Prefill 才有 N=B×S；投机解码可一次处理多个候选 token。' },
      { title: '线性层与门控 MLP', body: '线性层映射最后一个维度；SwiGLU 的 Gate/Up 分支先扩展再逐元素相乘，Down 投影恢复主干宽度。', expression: 'X[N,H] → Gate/Up[N,2I] → MLP[N,I] → Y[N,H]', scope: '这里 Gate/Up 表示融合布局。逻辑矩阵、实际融合容器和分片后的 Shape 分别记录。' },
      { title: 'Decoder 与输出', body: 'Embedding 建立 token 向量；Decoder 堆叠 Attention、FFN、Norm 与残差；最终词表投影生成 logits，采样产生 token。', expression: 'Token → Embedding → Decoder × L → Norm / LM Head → Logits', scope: '顺序残差、并行残差、mHC 与 AttnRes 使用不同依赖图。位置编码与视觉入口属于具体架构定义。' },
    ],
    examples: [{ label: 'Qwen3 Dense 数据流', to: '/models/qwen3-8b?view=diagram&node=ffn' }, { label: 'Kimi AttnRes', to: '/models/kimi-k3?view=diagram' }],
    readings: [{ label: '推理基础', to: '/category/inference-basics' }, { label: '模型架构', to: '/category/model-architecture' }],
  },
  {
    id: 'attention-state', group: 'structure', title: 'Attention 与状态', summary: '查询头、历史 KV、压缩与循环状态。', prerequisites: ['tensor-flow'],
    concepts: [
      { title: 'MHA / GQA / MQA', body: 'Q heads 与 KV heads 可以采用不同数量。GQA 将多个 Q heads 映射到同一组 K/V；KV 共享减少历史存储。', expression: 'Q[N,hq,d]；K/V[N,hkv,d]；每层 KV = 2×B×S×hkv×d×b', scope: '公式适用于等长完整历史的普通 KV，b 为每元素字节。TP 下需使用实际本地 KV heads，包含必要的复制。' },
      { title: 'MLA 与稀疏读取', body: 'MLA 保存压缩 latent；稀疏 Attention 从已存历史中选择部分位置参与计算。压缩、读取稀疏性与跨层复用是不同维度。', expression: '历史存储范围 ≠ 本次读取的 Top-k 范围', scope: 'latent、位置分量、索引 K 和跨层 owner 按模型核算。Top-k 不自动缩短常驻历史。' },
      { title: '滑窗与循环状态', body: '滑窗保留最近的窗口；DeltaNet/KDA 维护循环矩阵和局部卷积状态。混合模型按层组合完整历史、滑窗与定长状态。', expression: '滑窗记录数 = min(S,W)；混合缓存 = Σ 各层状态', scope: '固定大小的循环状态不代表全模型缓存恒定；其他 Attention 层仍可能随 S 增长。' },
    ],
    examples: [{ label: 'GQA / MLA / Hybrid 对比', to: '/models/compare?models=llama-3-1-8b,glm-4-7-flash,qwen3-5-9b' }, { label: 'V4.1 跨层 KV', to: '/models/deepseek-v4-1-flash?view=cache' }],
    readings: [{ label: 'Attention 架构', to: '/category/model-architecture' }, { label: 'KV Cache', to: '/category/kv-cache-memory' }],
  },
  {
    id: 'dense-moe', group: 'structure', title: 'Dense 与 MoE', summary: '前馈矩阵、专家路由与稀疏激活。', prerequisites: ['tensor-flow'],
    concepts: [
      { title: 'Dense FFN', body: 'Dense 模型为每个 token 执行同一组 FFN 参数。标准门控 FFN 由 Gate、Up 与 Down 三个矩阵构成。', expression: '门控 FFN 参数元素 = 3×H×I', scope: '不含 bias、Norm 和量化元数据；非门控 FFN 使用不同公式。' },
      { title: 'Routed / Shared experts', body: 'Router 为 token 选择 routed experts；shared 分支独立参与计算。激活专家数控制计算选择，不替代模型的常驻专家总数。', expression: 'Routed 参数元素 = E×3×H×I；每 token 选择 K 个专家', scope: 'E 为总专家数，K 为 Top-k。Kimi latent experts 使用独立输入宽度；共享专家另计。' },
      { title: 'Dispatch 与 Combine', body: 'token 按路由结果分发到专家，专家结果按权重合并。不同专家接收的 token 数取决于输入和 Router。', expression: '专家输入 [T_e,H]；Σ_e T_e = N×K', scope: '无丢弃、每 token 选择 K 个不同 routed experts 的逻辑关系。真实 packed buffer 还包含对齐与调度开销。' },
    ],
    examples: [{ label: 'Qwen3 MoE 专家分片', to: '/models/qwen3-30b-a3b?view=weights&node=moe&tp=8&ep=8' }, { label: 'Kimi latent 专家', to: '/models/kimi-k3?view=weights&node=moe&layer=3' }],
    readings: [{ label: 'MoE 架构与路由', to: '/category/model-architecture' }, { label: '专家并行', to: '/category/parallel-strategy' }],
  },
  {
    id: 'parallelism', group: 'execution', title: '并行策略', summary: '请求、矩阵、专家、层与上下文的分配。', prerequisites: ['tensor-flow', 'dense-moe'],
    concepts: [
      { title: 'TP 与独立 DP', body: 'TP 将矩阵或 heads 分片，由同组 ranks 协作处理请求；独立 DP 复制完整 TP 组，处理不同请求。', expression: '卡数 = TP × 独立 DP；DP 不再缩小每卡权重', scope: 'Norm、部分投影和不足 TP 数量的 KV heads 可能复制，权重与缓存不能一律除以 TP。' },
      { title: 'EP 与 DP Attention', body: 'EP 分配专家集合；DPA 将 Attention 请求分组，而 FFN 可以保留更大的并行组。两者改变的对象不同。', expression: '本实验：MoE-TP = TP/EP；Attention-TP = TP/DPA', scope: '限定页面所列 SGLang 执行基线。请求对齐、空组、归约和跨组通信单独展示。' },
      { title: 'PP 与 SP / CP', body: 'PP 按层划分 stage，传递中间激活；SP/CP 按序列或上下文分配工作，配套同步不同的张量与状态。', expression: 'TP → 矩阵；EP → 专家；PP → 层；SP/CP → 序列或上下文', scope: 'PP/SP/CP 在此提供知识与课程索引，当前逐 rank 计算器不模拟这些策略。' },
    ],
    examples: [{ label: 'TP / EP / DP Rank 实验', to: '/models/kimi-k3?view=weights&tp=8&ep=4&replicas=2' }, { label: 'GQA DP Attention', to: '/models/qwen3-8b/dpa' }],
    readings: [{ label: '并行策略与通信', to: '/category/parallel-strategy' }],
  },
  {
    id: 'precision', group: 'execution', title: '精度与量化', summary: '逻辑值、packed 容器与 scale。', prerequisites: ['tensor-flow', 'parallelism'],
    concepts: [
      { title: '逻辑精度与存储布局', body: '低位宽权重可被打包进整数容器。逻辑参数数目保持不变，容器 Shape、scale 与对齐方式随格式改变。', expression: '存储字节 = packed payload + scales + 元数据 / padding', scope: '只用参数量乘位宽得到的是理论载荷，不是完整 checkpoint 或部署显存。' },
      { title: '模块混合精度', body: 'Dense、shared 与 routed experts 可采用不同格式。Router 权重精度与路由输出 dtype 分别定义，不能互相替代。', expression: '示例：MLP FP8 + routed W4A8 + 自定义 Router FP32', scope: '该示例是可选教学策略，不等同于所有模型的原生格式。Kimi 原生 gate.weight 为 BF16。' },
      { title: '权重 / 激活 / KV', body: 'W4A8 同时描述特定算子路径的权重和激活精度；KV Cache 有独立格式。加载前后可能发生转型、重排和参数替换。', expression: '权重量化 ≠ 全部激活量化 ≠ KV 量化', scope: '格式需要匹配分组大小、分片对齐、硬件与 kernel；模型质量需独立评测。' },
    ],
    examples: [{ label: 'MLP FP8', to: '/models/qwen3-8b?view=weights&node=ffn&precision=mixed&mlp=fp8' }, { label: '专家 W4A8', to: '/models/qwen3-30b-a3b?view=weights&node=moe&tp=8&ep=8&precision=mixed&experts=w4afp8' }],
    readings: [{ label: '量化格式与加载路径', to: '/category/quantization' }],
  },
  {
    id: 'memory', group: 'execution', title: '内存账本', summary: '文件、参数、缓存、激活与峰值。', prerequisites: ['attention-state', 'precision'],
    concepts: [
      { title: '统计范围', body: '模块、单层、全 Decoder 与全模型是不同范围。完整模型可能还包含 Embedding、LM Head、视觉塔与投影。', expression: '文件字节 / 每 rank 参数 / 全卡合计：分别统计', scope: 'TB=10¹² B，TiB=2⁴⁰ B。文件头不属于 GPU 参数；参数复制和转换会改变加载量。' },
      { title: '持久状态与临时张量', body: '权重和 KV 常驻；激活、通信 buffer、kernel workspace、执行图与 allocator 影响运行时峰值。views 共享存储。', expression: '峰值取决于张量生命周期与同时存活集合', scope: '页面权重账本不是峰值预测。输入、输出、别名和旧/新参数不能无条件相加。' },
      { title: 'KV 分页与共享', body: '分页管理逻辑 token 到物理块的映射；前缀复用让多个请求共享已有 KV。物理分配受块大小、命中和回收状态影响。', expression: '逻辑容量、物理块分配、读取流量分别核算', scope: '当前缓存计算主要使用所列模型的逻辑容量，不模拟完整 allocator 或实时前缀命中。' },
    ],
    examples: [{ label: 'Kimi 原生文件与加载账本', to: '/models/kimi-k3?view=weights&tp=1' }, { label: '缓存容量对比', to: '/models/compare' }],
    readings: [{ label: 'KV Cache 与内存管理', to: '/category/kv-cache-memory' }],
  },
  {
    id: 'scheduling', group: 'serving', title: '调度与请求生命周期', summary: '批处理、前缀复用与阶段分离。', prerequisites: ['tensor-flow', 'memory'],
    concepts: [
      { title: '请求生命周期', body: '请求经历分词、排队、Prefill、采样和 Decode 循环，结束后释放占用资源。首 token 延迟包含排队与执行。', expression: '接入 → 排队 → Prefill → Decode → 完成 / 回收', scope: '模型 forward 只是服务路径的一部分；端到端延迟还包含网络、调度和后处理。' },
      { title: 'Continuous / Chunked batching', body: '连续批处理按迭代更新活跃请求；分块 Prefill 将长输入拆成较小执行段，影响 Decode 干扰与首 token 延迟。', expression: '每轮请求集合、query tokens 与历史长度分别变化', scope: 'B 不等于本轮 token 总数；吞吐与延迟取决于负载、预算和调度策略。' },
      { title: '前缀复用与 PD 分离', body: '前缀复用减少重复 Prefill；PD 分离将 Prefill 与 Decode 放到不同资源池，并传输请求的 KV 状态。', expression: 'Prefill 节省 / KV 传输成本 / Decode 延迟', scope: '收益依赖命中率、互联和请求长度；知识索引不声称页面模拟了真实服务调度。' },
    ],
    examples: [{ label: 'Prefill / Decode 张量', to: '/models/qwen3-8b?phase=prefill&view=diagram' }, { label: '不均匀 DPA 请求组', to: '/models/glm-5-2/dpa' }],
    readings: [{ label: '调度优化', to: '/article/ai-infra-basic--schedule-optimization--readme' }, { label: 'KV 传输', to: '/category/kv-transfer' }],
  },
  {
    id: 'kernels', group: 'serving', title: 'Kernel 与执行图', summary: '访存、融合、并行执行与启动开销。', prerequisites: ['parallelism', 'precision'],
    concepts: [
      { title: 'Attention kernel', body: '分块与数据复用减少中间结果的显存读写。算子实现可以改变物理执行方式，同时保持所声明的数学语义。', expression: '逻辑 Attention ≠ 显式分配完整 score 矩阵', scope: '融合实现、缓存布局和支持 dtype 由具体后端决定。' },
      { title: '融合与执行图', body: '融合减少中间写回和 kernel 启动；执行图重放减少主机调度开销。二者对形状、缓冲区和动态状态有各自限制。', expression: '启动次数 / 中间流量 / 图重放条件', scope: '融合后的 packed Shape 不替代逻辑 Shape；padding 和 workspace 仍占用资源。' },
      { title: '计算、访存与通信', body: '总执行时间受计算、显存带宽、通信和主机开销共同影响。更少的参数字节不必然意味着更短的服务延迟。', expression: '算术强度 = FLOPs / 数据搬运字节', scope: 'Shape 与理论载荷只能支持容量分析；瓶颈与重叠效果需要 profiler 证据。' },
    ],
    examples: [{ label: 'Qwen Gate/Up 融合布局', to: '/models/qwen3-8b?view=weights&node=ffn&precision=mixed&mlp=fp8' }],
    readings: [{ label: 'Attention Kernel', to: '/article/ai-infra-basic--attention-kernel--readme' }, { label: '执行图', to: '/category/execution-graph' }],
  },
  {
    id: 'measurement', group: 'serving', title: '性能指标与验证', summary: '延迟、吞吐、负载与证据层级。', prerequisites: ['scheduling', 'kernels'],
    concepts: [
      { title: '延迟与吞吐', body: 'TTFT 记录首 token 延迟，ITL 记录相邻输出 token 间隔；请求吞吐与 token 吞吐分别统计单位时间的请求数和 token 数。', expression: 'TTFT / ITL / E2E latency；QPS / tokens·s⁻¹', scope: '平均数不能替代分位数。模型版本、输入/输出长度、并发和采样条件需保持一致。' },
      { title: '负载与瓶颈', body: '输入长度、输出长度、到达速率、前缀命中和专家分布共同决定压力。服务指标定位问题范围，trace 解释内部时间。', expression: '业务指标 → 调度 / 缓存 → Kernel / 通信', scope: '区分冷启动、编译和稳态；记录失败、超时、取消及客户端限速。' },
      { title: '证据层级', body: '配置定义架构；checkpoint 描述存储；loader 决定分配；运行 trace 和实验结果验证真实行为。不同证据不能互相替代。', expression: '配置 → 文件元数据 → 加载实现 → 实测', scope: '本站提供版本化来源、计算与交互验证；未运行的硬件实验不标注为已验证。' },
    ],
    examples: [{ label: '同条件缓存对比', to: '/models/compare' }],
    readings: [{ label: 'Benchmark 与 Profiling', to: '/category/benchmark-profiling' }],
  },
]

export const modelNotation = [
  ['B', '活跃请求数'], ['S', '每请求历史长度'], ['N', '本轮 query tokens'], ['H / I', '主干 / FFN 中间维'], ['L', 'Decoder 层数'], ['hq / hkv', 'Query / KV heads'], ['d', 'Head 维度'], ['E / K', '总专家数 / Top-k'],
] as const
