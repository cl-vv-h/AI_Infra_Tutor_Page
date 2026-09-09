# AI Infra Space

一个持续生长的 AI Infra 开放知识空间：系统课程、SGLang 源码阅读，以及可追溯的全球新闻信号。

线上地址：<https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/>

## 信息架构

- `#/`：模块化门户首页。新增模块只需扩展 `src/data/modules.ts`。
- `#/learn`：AI Infra 课程地图，按“基础 → 框架 → 硬件与算子”组织。
- `#/models/*`：可交互模型结构实验室，可检查权重、张量 Shape、TP 分片和知识索引。
- `#/models/compare`：2–3 个模型的同条件架构与缓存对比，支持增长曲线、精确数值表和分享条件。
- `#/category/*`、`#/article/*`：主题与文章详情，支持中文/英文切换。
- `#/news`：AI、科技、金融、国际形势四板块的每日信号与每周报告。

## 本地开发

建议使用 Node.js 20：

```bash
npm ci
npm run dev
```

质量检查：

```bash
npm run check
npm run lint
npm run build
```

## 同步 SGLang Tutor 课程

网站在同步、启动开发和构建时自动生成 `src/data/curriculum-index.json` 双语元数据索引。目录和搜索只加载标题、摘要、标签及路径；打开文章时通过 `import.meta.glob` 单独读取所选语言正文，因此新增文章不需要手写 TypeScript import，也不会让浏览目录的访客下载全部课程。

课程页支持中英文关键词组合检索（标题、摘要、标签、源码路径），查询保存在 `#/learn?q=…`，便于分享与返回。阅读页支持正文加载重试；只有缺少译文时才回退到已有语言，不把网络错误当成缺少译文。窄屏目录可折叠，目录使用正文实际标题生成，兼容重复标题、内联代码与代码围栏。

直接编辑课程后可运行 `npm run curriculum:index` 刷新目录；`npm run test:curriculum`（Node.js 22.18+）校验索引同步、相邻课程、双语加载和搜索。生产构建仍兼容 Node.js 20，构建结束会自动检查页面没有静态导入任何课程正文、每篇正文独立打包。

当 `SGLang_Tutor` 与本仓库位于同一父目录时：

```bash
npm run sync:curriculum
```

也可以显式传入本地仓库路径：

```bash
SGLANG_TUTOR_PATH=/path/to/SGLang_Tutor npm run sync:curriculum
```

同步脚本只复制 `learning/zh` 与 `learning/en` 中的 Markdown、Python 教学代码和图片资源，不会读取或提交源仓库的 Git 配置、凭证与本地索引。

## 新闻雷达

### 每日采集

`.github/workflows/daily-news.yml` 每天 `00:30 UTC` 运行。它从公开 RSS/Atom 信源采集新闻，执行 URL 清理、标题去重、时间窗口过滤和信源/时效加权，并写入：

- `src/data/news/daily.json`：网页当前内容；
- `src/data/news/library.json`：近 90 天的 AI Infra 工程与研究长读；
- `src/data/news/releases.json`：近 90 天已收录的官方框架版本与接口读取状态；
- `src/data/news/archive/YYYY-MM-DD.json`：周报所需的七日公开数据。

本地可运行：

```bash
npm run news:fetch
```

信源配置位于 `scripts/news-sources.mjs`，目前覆盖论文与研究、AI 推理框架发布、PyTorch/NVIDIA/AMD 等工程博客、央行与国际机构原文和多地区国际媒体。排序会额外提升 inference、serving、kernel、compiler、GPU/NPU、quantization、attention 等技术信号的权重；arXiv 条目还会经过标题关键词过滤，避免泛化的分布式系统论文挤占版面。

页面分为每日信号、技术长读、框架版本、历史归档、阅读清单五个视图，支持具体信源、来源类别、技术主题、关键词组合筛选；点击文章的信源名称可只看该来源。归档按日期延迟加载。长读从工程/研究来源中按 AI Infra 关键词筛选，保留 90 天内文章，每来源最多 8 篇；这是自动筛选，不是逐篇人工审读。每日信号保留 48 小时时间窗口，每个来源最多 3 条，避免单个高频媒体挤占板块。

筛选保存在 Hash URL 中，例如 `#/news?view=library&topic=inference`。可复制包含板块、主题、具体来源、关键词、排序和归档日期的链接；更新后的数据可能产生不同结果，不是文章快照。未知来源保留为空结果，无效枚举和归档日期会提示并恢复默认值；关键词限制 200 字符。分享会包含关键词，请勿输入不宜公开的信息。收藏条目不进入链接，阅读清单视图不提供分享按钮。

六个技术主题附有研读指南，将公开文章与课程、交互模型图和容量对比连接。问题清单仅是阅读提示，不是自动生成的文章结论或事实核查。SGLang / FlashInfer 原站深读入口与自动收录区分展示；FlashInfer 的官方 Atom 已加入采集，但超出 90 天窗口的旧文章不会伪装成新内容。主题指南集中维护在 `src/data/news-study-guides.ts`。

单篇新闻卡片另有可折叠的“学习线索”，覆盖 KV Cache、MoE、MLA、GQA、Gated DeltaNet、量化、并行策略和投机解码八类概念。它只匹配该条标题与摘要，展示命中字段和术语，标题命中优先；同一概念的多个别名去重，英文词边界避免误匹配较长单词，统一大小写、全角、连字符、下划线及空白。MoE / MLA / GQA / GDN 缩写需同时有模型、推理等技术上下文；不从信源名称、URL 或旧主题标签猜测。不匹配时不展示推荐。

每条线索提供具体阅读检查问题与背景课；六类概念还能直接定位到示例模型的层和模块，KV 示例带入显存预算。教学示例不表示原文采用该模型，不把关键词命中当成全文分析或事实核查。量化线索另有 [vLLM 官方 KV 量化与校准说明](https://docs.vllm.ai/en/stable/features/quantization/quantized_kvcache/)。词表与目的地集中维护在 `src/data/news-learning.ts`；浏览器本地计算，不发送文章、收藏或输入，不使用模型 API，不加载课程正文或模型结构数据来生成推荐。所有五个新闻视图共用这一入口，收藏恢复后按当前词表重新计算。

收藏保存文章快照（标题、摘要、链接等公开元数据），每日数据更新后仍可阅读。旧版编号收藏会尝试从归档恢复；存储失败会在页面提示，不阻止阅读。支持导出 JSON 到用户本机；收藏不上传、不进入仓库。订阅状态目录显示最近采集是否成功、各来源收录数量；自动聚合不等于事实核查，所有条目始终保留原始来源链接。

采集器优先选择 Atom HTML alternate 链接，拒绝返回 HTML 错误页的伪成功响应，并在所有来源均无可用条目时保留上一版数据。单次临时连接失败会重试一次，同日归档合并已收录条目，避免较晚采集丢失较早数据。`npm run test:news`（Node.js 22.18+）覆盖解析、时间窗口、来源多样性、收藏恢复、筛选链接及课程目标；`npm run test:news:render` 对全部主题、当前长读信源、空状态和不安全查询进行静态渲染检查，不替代浏览器交互测试。

六个 GitHub 框架版本源在 Atom 失败时，使用同仓库的 [GitHub Releases 公开接口](https://docs.github.com/en/rest/releases/releases#list-releases) 备用读取：仅配置中显式绑定的仓库可启用，每源最多一次请求、最多 30 个发布记录，不追踪重定向，不读取或发送任何令牌。接口支持公开资源免认证访问；遇到限流不重试，保留故障状态。页面区分订阅正常、备用通道可用及双通道失败，并记录原订阅故障。API 通道使用 `published_at` 而非提交创建或更新时间过滤 48 小时窗口；草稿剔除，预发布明确标注并降权。Atom 通道仍使用订阅提供的日期，只有 `updated` 时不能将其当作已核实的首次发布日期。只保留标题、纯文本摘要、原文链接与发布日期，不保存作者资料、附件或接口原始响应。它不是完整版本历史，也不会为了填充新闻而将旧版本改为当天发布。周报仍由本地 Codex Luna 生成，与此免认证采集无关。

### 框架版本回看

`#/news?view=releases` 提供 SGLang、vLLM、FlashInfer、Transformers、TensorRT-LLM、Triton 的发布回看。框架导航显示已收录的最近正式版入口、数量与采集状态；可组合框架、正式版/预发布、主题和关键词筛选，收藏快照并复制筛选链接。`stage` 只对版本视图有效，切换视图或清除筛选会重置，不影响普通文章。

`npm run news:releases` 由每日工作流在普通采集后执行；它直接读取六个明确绑定的 GitHub 公开接口，每个仓库单次读取最近 30 条，无翻页、重试或凭证。每日新闻的 API 备用请求与此独立，每次运行合计最多 12 次 GitHub API 请求。发布历史使用官方 `published_at` 与 `prerelease` 布尔值，不猜测版本名称，不收草稿和未来日期。正式版仅表示发布者未标为预发布，不代表生产可用性。

历史合并按发布 URL 去重，新记录覆盖旧元数据，每个框架正式版与预发布分别保留近 90 天最多 8 条，防止密集预发布挤掉正式版。短响应或接口故障会保留仍在窗口内的已收录记录和原采集时间；页面分别展示本次检查状态与最近成功时间。这里不是完整历史，也不保证找到该项目所有正式版，完整版本请访问官方入口。版本桌面不会把旧版本重新注入当天归档，周报继续仅使用已有公开新闻归档。

单元测试覆盖阶段标记、晋级覆盖、跨框架同名版本、窗口边界、分阶段限额、失败保留、免认证请求及分享/收藏；静态渲染检查覆盖 7 个框架选择（含全部）× 3 个阶段与接口故障状态。

## 模型结构实验室

`#/models` 是可扩展的模型图解目录，卡片、机构、层数、上下文与注意力层占比均由现有模型注册表生成，不另维护一份模型名单。可搜索模型/机构/模块/权重名称，组合筛选完整 MHA、完整 GQA、MLA、全滑窗、完整+滑窗、DeltaNet 混合，以及全部 Dense / 包含 MoE。搜索忽略常见标点差异，多词按 AND 匹配；没有结果时保留空状态，不自动扩大筛选。

勾选 2–3 个模型可进入对比台，选择顺序不变，初始条件统一为 B=4、TP=4、KV=2 字节，S 取 8192 与所选模型最短上下文上限的较小值。所有模型使用同一个 S，并在目录中提前展示；对比台已有的显式条件不被改写，超范围仍提示。已选项即使被筛选隐藏也会留在上方，可逐项移除；达到三项后禁止继续添加。`q`、`attention`、`ffn`、`pick` 存入 Hash URL，浏览器返回可恢复筛选和选择，分享会包含搜索词；不使用账户或上传收藏。非法枚举、未知/重复/超量选择会提示，关键词最多 200 字符。`#/models/:modelId` 和 `#/models/compare` 保持原有路径；图解提供“浏览全部模型图解”返回入口。目录的层占比不是速度或计算占比，也不把标称参数与上下文当成部署容量承诺。

“Decoder 权重账本”随模型、当前层和 TP 联动，展示图示张量的逐项 Shape 算式、模块占比、本层全局唯一元素数与每卡理论载荷，并按实际 Dense/MoE、GQA/MLA/DeltaNet 层型累计所有 Decoder 层。占比条可定位到结构图中的模块；4/8/16/32-bit 统一假定位宽独立于 KV 精度，通过图解链接的 `wbits` 参数保存。成对矩阵使用显式 `multiplicity`，不同 Shape 的并列权重分别求积相加；计算器不执行 Shape 字符串中的代码，未识别定义会停用合计。

账本只统计已展示的 Decoder 张量，不是完整 checkpoint 参数统计或部署显存预测。它不包含 Embedding/共享 LM Head、视觉编码器、MTP、未展示的 buffer、激活、KV/循环状态、运行时工作区、量化元数据或打包对齐。MoE 在 EP=1 假设下统计所有常驻专家，不以 Top-k 激活参数替代；Norm、路由器和部分 KV 投影的 TP 复制按图解约定保留。低位宽只用于理论载荷对照，不宣称所有权重或硬件支持对应量化。参考 [Transformers 量化概念](https://huggingface.co/docs/transformers/main/en/quantization/concept_guide)。

“缓存预算反算”输入每卡**已经留给 KV／循环状态**的 GiB 预算，分别计算固定 S 时的最大等长并发 B、固定 B 时的最长 S，并可单独带回图解。两个最大值各自固定另一变量，不能直接组合。计算沿用各模型的 KV 分片／复制、完整／滑窗和混合循环状态公式；S 只在 1024 至官方配置上限内求边界，B 的理论值不截断，但应用按钮最多带入图解支持的 64。零预算和不足一个请求显示明确提示，非法输入停止计算。

预算通过 Hash URL 的 `budget` 参数分享，范围 0–1024 GiB、最多三位小数；缺省 8 GiB 只是示例，不是硬件检测结果。不读取设备或上传输入。预算需事先扣除权重、激活、图捕获、通信缓冲和安全余量；结果不计页尾填充、量化元数据、前缀共享或推测解码额外副本，仅为当前逻辑缓存布局的容量边界，不是吞吐预测或部署保证。引擎实际显存还受上下文、并发及 CUDA Graph 等影响，参见 [vLLM 显存管理说明](https://docs.vllm.ai/en/stable/configuration/conserving_memory/)。

模型结构数据位于 `src/data/models.ts`、`src/data/qwen-models.ts`、`src/data/hybrid-models.ts`、`src/data/mistral-models.ts`、`src/data/gemma-models.ts`、`src/data/phi-models.ts` 与 `src/data/olmo-models.ts`，页面组件位于 `src/pages/Models.tsx`。当前提供十二个代表模型：

- Llama 3.1 8B：Dense、GQA、SwiGLU；
- DeepSeek-V3：MLA、DeepSeekMoE、MTP；
- GLM-4.7-Flash：MLA、Sparse MoE；
- Qwen3-8B：GQA、QK-Norm、Dense SwiGLU；
- Qwen3-30B-A3B：GQA、QK-Norm、128 experts / Top-8 MoE；
- Qwen3.5-9B：24 层 DeltaNet + 8 层 Gated Full Attention、Dense FFN、视觉编码器；
- Qwen3.5-35B-A3B：30 层 DeltaNet + 10 层 Gated Full Attention、256 routed / Top-8 + gated shared expert、视觉编码器；
- Mistral-7B-v0.1：32 层滑动窗口 GQA、4,096 token 窗口、Dense SwiGLU；
- Mixtral-8x7B-v0.1：32 层完整 GQA、8 专家 / Top-2 MoE，无滑动窗口；
- Gemma 2 9B：42 层交替局部/完整 GQA、4 个子层边界 RMSNorm、GeGLU、共享词嵌入及 logits softcap；
- Phi-3.5 Mini Instruct：32 层 MHA、32Q/32KV × 96D、融合 QKV 与 Gate/Up 投影、LongRoPE、独立词嵌入与 LM Head；
- OLMo 2 7B · 1124：32 层 MHA、完整投影宽度 Q/K RMSNorm、子层输出 Norm、4K 上下文与参考汇集式 Attention TP。

每个模型都有可直接分享的 Hash 路由，例如 `#/models/qwen3-30b-a3b`。模块支持悬浮预览与点击锁定；窄屏点击打开原生模态详情，可用 Esc 关闭。Layer 控件展开一个真实 Decoder 层，显示两次残差连接，并按模型选择 Pre-Norm、Pre+Post-Norm 或子层输出 Norm 布局、按层号选择 Dense 或 MoE，其他层折叠。图中为自回归主干，不包含 MTP 辅助预测分支。

“复制当前图解”保留模型、`layer`、已选 `node`、`phase`、`b`、`s`、`tp` 与 `bytes`；刷新和返回可还原相同条件，临时悬浮和模块搜索词不进入分享链接。窄屏打开链接后可用“查看已选模块”展开详情。模型不存在时显示选择页；数值超出该模型配置或模块不属于当前层时明确提示，不悄悄渲染错误分支。切换模型保留有效推理条件并从第 0 层开始，超出新模型范围的参数会提示并恢复默认值。

模块检索按模块名称、权重名称和中间张量名称匹配，索引只包含各层实际存在的节点。点击结果定位到最近适用层（等距时取较小层号），桌面滚动并聚焦对应节点，窄屏打开详情。全局 Embedding、视觉分支和 LM Head 保持当前层上下文。模块索引与 URL 校验集中在 `src/lib/model-explorer.ts`。

层分布图按 MLA、MHA/Full、GQA/Full、Sliding GQA、Gated DeltaNet 着色，点击层号同步切换计算模块与缓存支路。Qwen3.5 的 Inspector 还显示 Q/K/V、输出门、循环矩阵等中间张量及 Prefill/Decode 算法说明；可选视觉分支显示 patch embedding、ViT 与 merger 的全局权重。

KV Cache 容量实验支持 B、S、TP、缓存字节数与 Prefill/Decode 切换，驱动数字化输入输出 Shape。计算明确区分 GQA head 分片/复制与 MLA latent 复制；展示全部主干层的每卡、全 TP 组逻辑缓存量，不将其误作部署总显存。模型的 `execution` 字段声明上下文上限、Dense 层数与缓存布局。新增模型须同时提供官方配置来源、这些元数据及模块权重。

Hybrid 缓存分为完整注意力 KV（随 S 增长）、FP32 循环矩阵（定长）及 BF16 卷积窗口（定长）。参考 Transformers 的 4 槽卷积状态分配，部分引擎使用 K−1 槽；不含前缀/推测解码额外副本、模型权重和工作空间。完整 KV 精度选项不会改变循环状态精度。公式与多种上下文长度对照均可在容量面板展开查看。

滑动窗口模型使用 `min(S, W)` 计算逻辑 KV 长度，滚动时间轴显示当前可见的位置范围；对比曲线包含窗口饱和点。Mistral-7B-v0.1 的 W=4,096，但配置上下文是 32,768；Mixtral-8x7B-v0.1 的 `sliding_window=null`，不能沿用这个窗口。容量按包含当前 token 的完整逻辑窗口估算，一些后端跨步保留 W−1 个历史位置，未裁剪实现也可能占用更多空间。零容量增长不意味着零计算或零写入，Prefill 仍需处理全部输入。

Gemma 2 9B 的 `mixed` 布局按每层类型分别统计：21 个完整层使用 S、21 个滑窗层使用 min(S, 4,096)。总 KV = B × (S × Lfull + min(S, W) × Lwindow) × 2 × 每卡 KV heads × head_dim × bytes；4K 后增长率减半而非归零，曲线止于配置上限 8K。图中的本层窗口、缓存 Shape 与层号同步变化。`normLayout: pre-post` 将两个 Post-Norm 放在各自残差相加之前；不能直接复用两 Norm 的 Decoder 顺序。参数取 Google 官方 9B 配置（固定提交），运算顺序对照 Transformers v4.57.1。模型权重不随网站分发。

Phi-3.5 Mini 的 [官方配置](https://huggingface.co/microsoft/Phi-3.5-mini-instruct/blob/main/config.json) 中 Q/KV 均为 32 heads，层图和对比台明确显示 MHA；计算复用通用 KV-head 公式。`sliding_window=262144` 超出 `max_position_embeddings=131072`，因此在支持范围内按完整 S 计数，不外推至 256K。LongRoPE 的 4096 是位置缩放参考，不是 KV 裁剪窗口；short/long 系数各 48 个且不是可训练矩阵。投影、Pre-Norm 残差与 SwiGLU 对照 [Transformers v4.57.1 Phi3 实现](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/phi3/modeling_phi3.py)，位置计算参考[同版本 LongRoPE](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/modeling_rope_utils.py)。融合 QKV 的每卡 Shape 表示各 Q/K/V head 分片再打包，不是将原始全局矩阵的连续行直接等分。“MHA / GQA：KV 头数”预设保持共同推理条件；在相同 B/S/TP/缓存精度下，Phi 的理论 KV 是 Llama 3.1 8B 的 3 倍，不能从参数规模推断缓存大小。

`npm run test:models`（Node.js 22.18+）校验逐层路径、Shape 模板、已知 KV 容量及 TP 复制边界；构建仍兼容 Node.js 20。

OLMo 2 图解针对 [Ai2 OLMo-2-1124-7B 配置](https://huggingface.co/allenai/OLMo-2-1124-7B/blob/main/config.json)，不将其他版本的上下文扩展混入：H=4096、32 层、32Q/32KV、D=128、I=11008、vocab=100352、S≤4096。其 [Transformers v4.57.1 实现](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/olmo2/modeling_olmo2.py) 在 reshape heads 前归一化 Q/K 的完整投影宽度；每层有两条 Q/K Norm 与两条子层输出 Norm，均为带缩放权重的 RMSNorm，不是 OLMo 初代的无参数 LayerNorm。

`normLayout: post-branch-qk` 展开投影 → Q/K Norm → RoPE/MHA/o_proj → Attention 输出 Norm → 残差，以及 FFN → FFN 输出 Norm → 残差。Q/K 各一条 [4096] 缩放向量，V 绕过 Norm。Decoder 权重元素数为每层 `4H² + 3HI + 4H`，其中矩阵按 TP 分片而四条 Norm 向量保留副本；不重复统计投影，也不把 Embedding/LM Head 加入 Decoder 账本。

OLMo 2 缓存采用[固定版本 TP 配置](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/models/olmo2/configuration_olmo2.py#L85)与[并行算子定义](https://github.com/huggingface/transformers/blob/v4.57.1/src/transformers/integrations/tensor_parallel.py#L821)对应的路径：`colwise_rep` 分片权重但汇集 Q/K/V 输出，`rowwise_rep` 接收复制输入并切分给 o_proj；`cache.layout: replicated` 因此每卡保存完整 32 KV heads。`cacheKvHeads` 独立于投影的 `localKvHeads`，防止把权重切分直接套入缓存计算。B=4、S=4096、2-byte KV 时每卡 8 GiB，TP=4 组内合计 32 GiB；这只是该路径的逻辑 KV，不是部署总显存、速度比较或所有引擎必须采用的布局，未进行真实多卡性能测试。

### 模型对比台

从结构实验室的“对比当前模型”进入时会携带当前 B、S、TP 和 KV 字节数。对比台统一使用 Decode 持久状态口径，不计算前向激活或性能；可选择 2–3 个模型，切换每卡 / 全 TP 组容量，比较架构字段及 1K–256K token 的缓存增长。模型、顺序和所有计算条件保存在 Hash URL 中，不需要登录，也不写入任何个人数据。

对比结果的“携带条件查看结构图”会将同一组 Decode 条件带回对应模型；当前条件不受该模型支持时，仅提供明确标注的默认图解入口，不把无效条件伪装成已完成计算。

对比直接复用结构实验室的 `cacheEstimate`。超过模型配置上下文上限或图解已覆盖 TP 范围时，该项显示“不计算”，不会暗中降低条件或外推。曲线使用对数长度轴与统一线性容量轴，并止于各模型上限；架构表显示官方配置链接及上下文扩展说明。容量不含模型权重、激活、分页、量化 scale 等部署开销，不用于模型质量或速度排名。

`tests/model-comparison.test.mjs` 覆盖分享参数恢复、无效输入、共同条件、全部模型/TP 的计算一致性、Hybrid 精度边界与增长曲线范围。

### 每周报告

每周日北京时间 `09:30`，Codex 本地自动化会在本项目中使用 `gpt-5.6-luna`，根据最近七天的公开新闻归档生成来源约束的中文周报。它随后运行本地校验，只提交 `src/data/news/weekly/latest.json`，并推送到 `main` 触发 GitHub Pages 发布。

该流程直接使用 Codex 任务自身的模型能力，不调用 OpenAI API，因此：

- 不需要配置 `OPENAI_API_KEY`；
- 不会在 GitHub Actions、仓库或构建产物中保存模型凭证；
- 运行时间到达时，本机 Codex 与该项目需要处于可运行状态；
- 如果工作区不干净、分支不是 `main`、无法快进同步或校验失败，任务会停止且不会提交或推送。

新闻标题、摘要、URL 和信源名称均按不可信输入处理；Codex 只允许基于归档中的公开信息进行总结，事实性内容必须引用归档内的 HTTPS 来源。

生成后可独立运行仓库内的确定性校验：

```bash
npm run news:weekly:check
```

不要把个人邮箱、本地绝对路径、用户标识或 `.env` 文件提交到仓库。

## 部署

推送到 `main` 后，`.github/workflows/deploy.yml` 会构建并发布 GitHub Pages。应用使用 Hash Router，可在项目子路径下稳定刷新和导航。

## 内容与许可

教学内容同步自 [SGLang Tutor](https://github.com/cl-vv-h/SGLang_Tutor)，其中保留的 SGLang 源码与相关材料仍遵循各自上游许可证。本网站用于教学导航与阅读，不是 SGLang 的替代发行版。
