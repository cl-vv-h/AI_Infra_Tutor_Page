// Curated research map. Dates refer to the cited work, not priority claims.
export const ATTENTION_ATLAS_VERSION = 'attention-atlas/1'
export const ATTENTION_REVIEWED_AT = '2026-10-10'
export const attentionFamilies = [
  { id: 'foundations', name: '基础形式', question: '如何计算相关性？', color: '#b8a4fa' },
  { id: 'kv', name: 'KV 共享与压缩', question: '历史信息怎样存储？', color: '#70cfe0' },
  { id: 'sparse', name: '稀疏与序列压缩', question: '读取哪些历史位置？', color: '#e8b875' },
  { id: 'linear', name: '低秩与核近似', question: '如何避免完整注意力矩阵？', color: '#9bcf8a' },
  { id: 'recurrent', name: '门控与递归状态', question: '如何更新有限状态？', color: '#f2a3b9' },
  { id: 'systems', name: '执行与内存优化', question: '如何高效执行既有语义？', color: '#9bb6eb' },
] as const
export type AttentionFamily = typeof attentionFamilies[number]['id']
export interface AttentionTechnology {
  id: string; name: string; fullName: string; year: number; family: AttentionFamily
  summary: string; boundary: string; paper: string; lesson?: string
}
const paper = (id: string) => `https://arxiv.org/abs/${id}`
const architecture = (slug: string) => `ai-infra-basic--model-architecture--${slug}`
const landscape = architecture('06-efficient-attention-landscape')
export const attentionTechnologies: AttentionTechnology[] = [
  { id:'additive',name:'Additive',fullName:'Bahdanau / Additive Attention',year:2014,family:'foundations',summary:'使用可学习的加性打分，在生成目标词时对源序列进行软对齐。',boundary:'这里选取神经机器翻译中的代表工作，不宣称它是所有注意力思想的起点。',paper:paper('1409.0473') },
  { id:'multiplicative',name:'Multiplicative',fullName:'Luong / Multiplicative Attention',year:2015,family:'foundations',summary:'研究点积、general 等打分形式，以及全局和局部对齐。',boundary:'打分形式与可见范围是两个维度，不等同于现代多头注意力。',paper:paper('1508.04025') },
  { id:'sdpa',name:'Scaled Dot-Product',fullName:'Scaled Dot-Product Attention',year:2017,family:'foundations',summary:'将 QK 点积按键维度缩放，经 softmax 后对 V 加权。',boundary:'Self / Cross 描述 Q 与 KV 的来源；Causal / Bidirectional 描述可见性，均可与多种机制组合。',paper:paper('1706.03762') },
  { id:'mha',name:'MHA',fullName:'Multi-Head Attention',year:2017,family:'foundations',summary:'多个头分别投影 Q、K、V 并计算注意力，再合并各头输出。',boundary:'多头、因果掩码和位置编码不是同一个设计维度。',paper:paper('1706.03762'),lesson:architecture('02-gqa-attention-shapes') },
  { id:'mqa',name:'MQA',fullName:'Multi-Query Attention',year:2019,family:'kv',summary:'多个 Query 头共享一组 K/V 头，减少增量解码的 KV 读取量。',boundary:'共享 KV 头不等于稀疏选择历史 token。',paper:paper('1911.02150'),lesson:architecture('02-gqa-attention-shapes') },
  { id:'gqa',name:'GQA',fullName:'Grouped-Query Attention',year:2023,family:'kv',summary:'每组 Query 头共享 K/V，在 MHA 与单组 MQA 之间提供可调粒度。',boundary:'是 MQA 的分组推广；并不意味着 MLA 必须由 GQA 继承。',paper:paper('2305.13245'),lesson:architecture('02-gqa-attention-shapes') },
  { id:'mla',name:'MLA',fullName:'Multi-head Latent Attention',year:2024,family:'kv',summary:'用联合低秩潜在表示压缩 K/V，并处理位置编码与潜在缓存的解耦。',boundary:'压缩的是特征表示；完整注意力的 prefill 不因此变为线性复杂度。',paper:paper('2405.04434'),lesson:architecture('04-multi-head-latent-attention') },
  { id:'sparse-transformer',name:'Sparse Transformer',fullName:'Factorized Sparse Attention',year:2019,family:'sparse',summary:'通过因子化的稀疏连接模式减少长序列的注意力计算。',boundary:'一种稀疏模式设计，不是后续所有稀疏模型的直接祖先。',paper:paper('1904.10509'),lesson:landscape },
  { id:'reformer',name:'Reformer',fullName:'LSH Attention / Reformer',year:2020,family:'sparse',summary:'用局部敏感哈希聚集相似的查询和键，缩小参与注意力的候选集合。',boundary:'哈希近似与固定局部窗口不同。Reformer 还包含可逆层等非 Attention 设计。',paper:paper('2001.04451') },
  { id:'longformer',name:'Longformer',fullName:'Local + Global Attention',year:2020,family:'sparse',summary:'组合滑动窗口局部注意力与任务相关的全局位置。',boundary:'全局位置如何设置与任务有关，不能简单理解为仅保留最近 token。',paper:paper('2004.05150'),lesson:landscape },
  { id:'bigbird',name:'BigBird',fullName:'Random + Local + Global Attention',year:2020,family:'sparse',summary:'结合随机、局部和全局连接，构造长序列稀疏注意力。',boundary:'与 Longformer 属于相关稀疏路线，不将发表先后误标为直接继承。',paper:paper('2007.14062') },
  { id:'swa',name:'SWA',fullName:'Sliding Window Attention',year:2023,family:'sparse',summary:'每个位置只访问限定窗口；这里以 Mistral 7B 的语言模型实现为代表。',boundary:'2023 是所引代表工作的年份，不是滑动窗口思想首次出现的年份。',paper:paper('2310.06825'),lesson:landscape },
  { id:'nsa',name:'NSA',fullName:'Native Sparse Attention',year:2025,family:'sparse',summary:'结合压缩、选择性细粒度块和局部窗口，设计可训练且硬件友好的稀疏注意力。',boundary:'NSA 与 DSA 不同；后端函数名不能证明算法继承关系。',paper:paper('2502.11089'),lesson:landscape },
  { id:'dsa',name:'DSA',fullName:'DeepSeek Sparse Attention',year:2025,family:'sparse',summary:'在 MLA 基础上使用轻量索引器，选择参与主注意力的历史 token。',boundary:'减少主注意力读取量，但索引器仍需处理候选历史；不能声称整层 decode 恒定成本。',paper:'https://github.com/deepseek-ai/DeepSeek-V3.2-Exp/blob/main/DeepSeek_V3_2.pdf',lesson:architecture('07-deepseek-sparse-attention') },
  { id:'csa',name:'CSA',fullName:'Compressed Sparse Attention',year:2026,family:'sparse',summary:'先把历史 token 压缩为条目，再通过索引选择压缩条目参与注意力。',boundary:'序列条目压缩不同于 MLA 的特征压缩，也不同于 KV 低比特量化。',paper:paper('2606.19348'),lesson:architecture('08-compressed-sparse-attention') },
  { id:'hca',name:'HCA',fullName:'Heavily Compressed Attention',year:2026,family:'sparse',summary:'对更强压缩后的序列执行注意力，与 CSA 构成不同压缩粒度的设计。',boundary:'对压缩条目的主注意力可以是稠密的；不能仅因同属 V4 就称为 CSA 的后继。',paper:paper('2606.19348'),lesson:architecture('08-compressed-sparse-attention') },
  { id:'linear',name:'Linear Attention',fullName:'Kernel-feature Linear Attention',year:2020,family:'linear',summary:'用核特征映射与矩阵乘法结合律重新组织注意力，可写成递归状态更新。',boundary:'通常改变 softmax Attention 的形式；线性指对序列长度的复杂度，不是没有非线性操作。',paper:paper('2006.16236'),lesson:landscape },
  { id:'performer',name:'Performer',fullName:'FAVOR+ / Performer',year:2020,family:'linear',summary:'通过正交随机特征近似 softmax 核，避免显式构造完整注意力矩阵。',boundary:'近似误差与特征数相关；不是 FlashAttention 的精确 IO 优化。',paper:paper('2009.14794') },
  { id:'linformer',name:'Linformer',fullName:'Low-rank Projected Attention',year:2020,family:'linear',summary:'沿序列维度投影 K/V，利用低秩近似降低注意力成本。',boundary:'投影序列维度与 MLA 压缩 KV 特征维度不是同一种低秩设计。',paper:paper('2006.04768') },
  { id:'nystrom',name:'Nyströmformer',fullName:'Nyström Approximation of Self-Attention',year:2021,family:'linear',summary:'以代表性 landmark 构造 Nyström 近似，近似完整注意力矩阵。',boundary:'属于矩阵近似路线，不自动具备因果递归推理接口。',paper:paper('2102.03902') },
  { id:'delta',name:'DeltaNet',fullName:'Delta-rule Linear Attention',year:2021,family:'recurrent',summary:'把线性注意力理解为快速权重记忆，用 Delta rule 对已有键值关联作误差修正。',boundary:'这里标注 2021 年 Delta-rule 工作；2024 年另有序列并行训练算法，并非同一年首次提出。',paper:paper('2102.11174'),lesson:'ai-infra-basic--gated-delta-network--01-gdn-math-and-state' },
  { id:'retnet',name:'RetNet',fullName:'Multi-scale Retention',year:2023,family:'recurrent',summary:'多尺度衰减的 retention 可用并行、递归和分块形式计算。',boundary:'Retention 与标准 softmax Attention 不等价。',paper:paper('2307.08621') },
  { id:'gla',name:'GLA',fullName:'Gated Linear Attention',year:2023,family:'recurrent',summary:'用数据依赖门控控制线性注意力状态的保留与遗忘，并设计高效分块训练。',boundary:'门控思想与 Delta 更新可以结合；GLA 不是 GDN 的别名。',paper:paper('2312.06635') },
  { id:'gdn',name:'GDN',fullName:'Gated DeltaNet / Gated Delta Network',year:2024,family:'recurrent',summary:'把遗忘门控与 Delta rule 结合，既能清除旧记忆，也能针对性更新关联。',boundary:'保持递归矩阵状态，不保存可逐 token 寻址的完整 KV 历史。',paper:paper('2412.06464'),lesson:'ai-infra-basic--gated-delta-network--readme' },
  { id:'kda',name:'KDA',fullName:'Kimi Delta Attention',year:2025,family:'recurrent',summary:'在 GDN 基础上采用更细的通道级门控，并配套高效分块计算。',boundary:'KDA 是注意力模块；Kimi Linear 是组合 KDA 与 MLA 层的混合模型。',paper:paper('2510.26692'),lesson:architecture('09-kimi-delta-attention') },
  { id:'kimi-linear',name:'Kimi Linear',fullName:'KDA + MLA Hybrid Architecture',year:2025,family:'recurrent',summary:'以分层方式组合 KDA 与少量完整 MLA，兼顾递归状态效率与长距离读取。',boundary:'这是混合架构节点，不是一种单一注意力公式，也不是 MLA 演进成了 KDA。',paper:paper('2510.26692'),lesson:architecture('09-kimi-delta-attention') },
  { id:'mamba',name:'Mamba',fullName:'Selective State Space Model',year:2023,family:'recurrent',summary:'以输入依赖的选择性状态空间模型建模序列，作为有限状态路线的对照。',boundary:'SSM 相邻路线，不标为 softmax Attention 分支。',paper:paper('2312.00752') },
  { id:'mamba2',name:'Mamba-2 / SSD',fullName:'Structured State Space Duality',year:2024,family:'recurrent',summary:'通过结构化状态空间对偶连接 SSM 与一类注意力形式，并改进 Mamba 计算。',boundary:'理论联系不代表所有 Attention 都是 Mamba，也不代表 GDN 直接继承全部 Mamba-2 结构。',paper:paper('2405.21060') },
  { id:'flash',name:'FlashAttention',fullName:'IO-aware Exact Attention',year:2022,family:'systems',summary:'使用分块和在线归一化减少 HBM 访问，避免存储完整注意力分数矩阵。',boundary:'精确注意力的执行优化（浮点误差除外），不是用线性核替换 softmax。',paper:paper('2205.14135'),lesson:'ai-infra-basic--attention-kernel--readme' },
  { id:'flash2',name:'FlashAttention-2',fullName:'Better Parallelism and Work Partitioning',year:2023,family:'systems',summary:'优化线程块与 warp 间工作划分，提高注意力内核的并行度和计算利用率。',boundary:'硬件、形状和精度影响收益，不能把论文峰值直接当作部署加速比。',paper:paper('2307.08691'),lesson:'ai-infra-basic--attention-kernel--readme' },
  { id:'flash3',name:'FlashAttention-3',fullName:'Asynchrony and Low-precision Attention',year:2024,family:'systems',summary:'面向 Hopper 使用异步流水与低精度技术，提升注意力内核效率。',boundary:'属于硬件相关实现路线；低精度配置需另行考虑数值误差。',paper:paper('2407.08608') },
  { id:'paged',name:'PagedAttention',fullName:'Paged KV Memory Management',year:2023,family:'systems',summary:'通过分块寻址组织非连续 KV Cache，减少碎片并支持共享。',boundary:'优化 KV 内存管理，不是稀疏丢弃历史位置；可与多种注意力机制组合。',paper:paper('2309.06180') },
]
export type AttentionRelationKind = 'extends' | 'alternative' | 'combines' | 'implements'
export const attentionRelationLabels: Record<AttentionRelationKind,string> = { extends:'扩展 / 推广',alternative:'相关设计路线',combines:'混合架构采用',implements:'执行层优化' }
export interface AttentionRelation { from:string; to:string; kind:AttentionRelationKind; explanation:string; source:string }
const edge = (from:string,to:string,kind:AttentionRelationKind,explanation:string,source?:string):AttentionRelation => ({from,to,kind,explanation,source:source ?? attentionTechnologies.find(n=>n.id===to)!.paper})
export const attentionRelations: AttentionRelation[] = [
  edge('additive','multiplicative','alternative','从加性打分转向点积 / general 等设计；是打分路线比较，不是代码依赖。'),
  edge('multiplicative','sdpa','extends','Transformer 使用按键维度缩放的点积打分。'),
  edge('sdpa','mha','extends','并行执行多个投影子空间的 scaled dot-product attention。'),
  edge('mha','mqa','alternative','共享各 Query 头的 K/V，改变 KV 头组织。'),
  edge('mqa','gqa','extends','GQA 论文明确将 MQA 推广到多个 KV 组。'),
  edge('mha','mla','alternative','以联合低秩潜在 KV 替代逐头显式 KV；不是 GQA 的必经后继。'),
  edge('mla','dsa','extends','DeepSeek-V3.2-Exp 的 DSA 在 MLA 上引入轻量索引器与 token 选择。',paper('2512.02556')),
  edge('dsa','csa','extends','将索引选择作用于压缩历史条目，而非原始逐 token 条目。'),
  edge('csa','hca','alternative','同一混合压缩架构中的两种粒度：稀疏选择与更强压缩后的注意力。'),
  edge('sparse-transformer','longformer','alternative','均减少可见位置，但 Longformer 使用局部与全局模式；非直接继承声明。'),
  edge('longformer','bigbird','alternative','局部 / 全局路线对照，BigBird 额外使用随机连接。'),
  edge('longformer','swa','alternative','共享局部窗口思想；此处 SWA 指 Mistral 的代表实现。'),
  edge('swa','nsa','combines','NSA 组合局部窗口、压缩和选择分支；不是只有窗口。'),
  edge('mha','reformer','alternative','以 LSH 候选集合替代完整配对。'),
  edge('mha','linear','alternative','用核特征与结合律重新组织序列交互，改变 softmax 形式。'),
  edge('linear','performer','alternative','共同使用核特征组织计算；Performer 以随机特征近似 softmax 核。'),
  edge('mha','linformer','alternative','在序列维度构造低秩投影近似。'),
  edge('linformer','nystrom','alternative','同属低秩近似路线，但 Nyström landmark 不等于 Linformer 的投影。'),
  edge('linear','delta','extends','以 fast-weight 视角引入 Delta rule 修正关联记忆。'),
  edge('linear','gla','extends','在线性注意力状态更新中加入数据依赖门控。'),
  edge('linear','retnet','alternative','Retention 提供具有衰减的并行 / 递归 / 分块形式。'),
  edge('delta','gdn','extends','将可遗忘的门控机制与针对性的 Delta 更新结合。'),
  edge('gla','gdn','alternative','门控状态控制与 Delta 更新互补；不声称 GDN 直接继承 GLA 全部结构。'),
  edge('gdn','kda','extends','KDA 明确扩展 GDN，以通道级门控替代更粗的遗忘控制。'),
  edge('kda','kimi-linear','combines','Kimi Linear 使用 KDA 层。'),
  edge('mla','kimi-linear','combines','Kimi Linear 同时使用完整 MLA 层，不是 MLA → KDA。'),
  edge('mamba','mamba2','extends','Mamba-2 借助 SSD 重新设计状态空间计算。'),
  edge('mamba2','gdn','alternative','GDN 论文讨论门控与 Delta 规则互补，并以 Mamba-2 为对照。'),
  edge('mha','flash','implements','优化精确注意力的 IO 与执行，不替换数学机制。'),
  edge('flash','flash2','extends','改进并行划分和非矩阵乘工作。'),
  edge('flash2','flash3','extends','继续优化注意力内核，使用 Hopper 异步与低精度能力。'),
  edge('mha','paged','implements','对 KV Cache 引入分页寻址，而非改变注意力可见性。'),
]
export const attentionOverview = ['mha','mqa','gqa','mla','dsa','nsa','linear','delta','gdn','kda','flash','paged']
export const attentionById = new Map(attentionTechnologies.map(n=>[n.id,n]))
export function readAttentionQuery(params:URLSearchParams) {
  const view=params.get('view') ?? 'overview',node=params.get('node') ?? 'mla',q=(params.get('q') ?? '').slice(0,100)
  const invalid=params.getAll('view').length>1 || params.getAll('node').length>1 || params.getAll('q').length>1 || !['overview','all',...attentionFamilies.map(f=>f.id)].includes(view) || !attentionById.has(node) || (params.get('q')?.length ?? 0)>100
  return {view:invalid?'overview':view,node:invalid?'mla':node,q:invalid?'':q,invalid}
}
export function attentionMatches(node:AttentionTechnology,query:string) {
  const haystack=`${node.name} ${node.fullName} ${node.summary} ${attentionFamilies.find(f=>f.id===node.family)?.name}`.toLocaleLowerCase()
  return query.trim().toLocaleLowerCase().split(/\s+/).every(token=>haystack.includes(token))
}
