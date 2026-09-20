# 模型页面交付核对表

2026-09-21 页面整理：新增[模型知识体系](model-knowledge-system.md)，问答导览已替换为直接展示的模块知识卡；下文的逐步问答与发布阻塞均为历史记录。

> **历史记录入口**：最新发布状态见 [2026-09-21 上线记录](model-release-2026-09-21.md)，六项要求与计算验证见 [2026-09-16 验收](model-acceptance-2026-09-16.md)。下文保留阶段记录；旧远端 SHA、旧测试数量和“只能恢复本机 Git”的判断不代表当前状态。

> 2026-09-16 新要求已重新打开目标。下面是上一阶段的历史验收，不代表新增要求已全部完成。混合方案覆盖五个通用模型和 GLM-5.2 DPA，W4A8 已支持初始/后处理权重与 scale 布局，运行元数据去重另列；DPA 提供本层/全 Decoder 账本及 BF16 边界载荷。19 项目录按公开下载快照排序，并精简卡片与切换入口。Kimi 完整 checkpoint 元数据审计现已完成：96 个分片、497,220 张量及索引精确对账，文件总计 1,560,936,091,448 B；未下载或哈希验证权重载荷。Kimi 已提供限定后端的逐 rank 初始参数与后处理已核对持久张量小计；其他格式最终布局、V4.1 模块级混合方案、更多模型的 DPA 与进一步页面重排仍待推进。详见 `model-expansion.md` 的同日记录；所有新增功能尚未上线。

核对日期：2026-09-15。功能基线：`bc5b450`，分支 `codex/model-expansion`。

当前状态：本地页面与计算验证通过，尚未发布。不能把本地验收结果当作线上已具备这些功能。

2026-09-16 增量：Kimi 的原生加载初始参数已与 TP/EP/独立 DP/rank 联动，覆盖全部 checkpoint 模板、Embedding/LM Head 和复制的视觉塔；包含 A_log 裁剪、o_norm 类型转换、MXFP4 六个初始容器及额外零 bias。现可切换到后处理已核对持久张量小计，覆盖九个 MXFP4 参数、MLA/AttnRes 副本、KDA padding/预备张量和去重的行索引。限定 CUDA SM100 / FlashInfer 0.6.18、无 DPA；dispatcher、workspace、KV/激活及峰值等仍未覆盖，不能称为完整部署显存。

2026-09-16 增量：Qwen3-8B 新增 Dense MLP BF16/FP8 混合方案，Attention 与 Norm 保持 BF16；纯 Dense 控件隐藏无效专家选项。36 层总账、TP/独立 DP 与 Gate/Up 融合初始布局已按独立算式核对，原公共 Decoder 补入的 FFN Norm 保留且不重复计数。详见 [Qwen3 核对说明](qwen3-dense-precision.md)。现混合方案覆盖五个通用模型，GLM-5.2 DPA 另列。

2026-09-16 增量：DPA 现扩展至 Qwen3-8B（GQA + Dense），新增专属路由、每 rank 的 Q/KV head 区间、逐组缓存与全卡守恒、内部 QKV/MLP 逻辑载荷，及按 Attention TP / 总 TP 分别核算的混合权重。DP=1 与普通工作区对账；同请求数下 GQA 全卡 KV 不变，但不均匀请求的单卡缓存可以不同。EP 不适用于此模型，控件隐藏且非法链接受限。详见 [GQA-DPA 说明](qwen3-dpa.md)。GLM-5.2 原 DPA 基线保留；其他模型/后端仍须单独核对。

2026-09-16 增量：权重工作区新增按统计范围定位的阅读入口；独立副本选择器只展开当前副本的 TP ranks，不再一次铺满 64 张卡。各副本仍可完整访问，切换保留 TP local 坐标，所有副本总量不受折叠影响。当前模块、全部 Decoder、全副本分别显示精确 B 与可读单位；Kimi 的完整文件体积保持直接可见，详细差额/专家归属/计算规则按需展开。此轮调整不改变数值模型或现有 URL 协议。

## 原始要求与证据

2026-09-16 增量：Llama-3.1-8B、Qwen3-8B 和 Qwen3-30B-A3B 的普通 GQA rank 面板新增 Q/K/V head 归属。默认摘要展示所选 head 范围，展开可查看当前独立副本的 TP 分片、KV 复制 peers 以及逻辑投影矩阵区间；EP 不改变这些归属。其他后端不自动推广，详见 [head 归属说明](attention-head-ownership.md)。

2026-09-16 增量：Qwen3-30B-A3B 补齐组内 EP、专家归属、Router 复制与 48 层混合权重账本。Routed 精度控件随 MoE-TP 的 128/32 对齐条件变化，非法 FP8/W4A8 链接提示并回退 BF16；无 Dense/Shared 选项。原生 BF16 Router 与自定义 FP32 情景明确区分。混合方案现覆盖六个通用模型，DPA 仍仅 GLM-5.2/Qwen3-8B。详见 [Qwen3 MoE 核对](qwen3-moe-precision.md)。

2026-09-16 增量：普通逐 rank 面板新增输入/输出逻辑元素数与非缓存模块的 2 B/元素参考载荷，内部张量增加所列 Shape 的元素量。参考不随权重量化或 KV 位宽改变；不是实际 kernel dtype、分配量或峰值。缓存模块不显示该统一参考，动态或含歧义分隔符的 Shape 明确未推断；详见扩展日志。

| 用户要求 | 当前实现 | 验证证据 |
| --- | --- | --- |
| GLM-5.2 | DSA、跨层索引复用、Dense/MoE 切换、完整 Decoder 数据流 | `glm5-model.test.mjs`；通用结构、导览、rank 与浏览器回归 |
| GLM-5.3-Flash | KDA/DSA 混合、四路 mHC、视觉入口、池化索引与 MoE | `glm53-model.test.mjs`；移动/桌面缓存、mHC 和 rank 交互 |
| Kimi-K3 | KDA/MLA、AttnRes 深度聚合、latent MoE、视觉入口 | `kimi-k3-model.test.mjs`；深度聚合、缓存、latent 专家 Shape 浏览器检查 |
| DeepSeek V4 | V4-Flash 的 SWA/CSA/HCA、mHC、hash/routed MoE | `deepseek-v4-model.test.mjs`；层切换、压缩缓存、导览及并行交互 |
| DeepSeek V4.1 | V4.1-Flash 官方参考实现；40 层、跨层 KV owner、Single-Pass mHC、Engram | `deepseek-v41-reference.test.mjs`；240 个 layer/world/workspace 渲染组合及真实浏览器操作 |
| 更好的展示与学习 | 统一目录搜索/筛选/选择；跨模型缓存对比；结构图/缓存/权重工作区；逐步问答、知识链接、模块检索、分享 URL、键盘导航、移动布局 | 19 个目录条目、27 组筛选、153 对通用模型和 144 组 V4.1 混合对比；197 个模块链接；通用逐层导览与 V4.1 八步导览测试 |
| TP、DP、EP 配置后观察各 rank 的输入输出 | 逐 rank 选择与组拓扑；B/S/阶段、TP、独立 DP、EP 联动；模块边界、内部张量与逐专家激活；GLM-5.2 另有 DPA 请求组/对齐/汇集实验 | `model-ranks.test.mjs`、`dpa-lab.test.mjs`；36 个 EP 共享工作区、30 个 DPA 路由，以及浏览器滑块与 URL 恢复检查 |
| 权重 Shape 与大小 | EP 专家轴与 MoE-TP 中间轴；统一假定位宽账本；独立专家加载格式的 payload/scale；V4.1 参考混合格式 | `model-weights.test.mjs`、`expert-packing.test.mjs`、V4.1 参考测试；130 组专家加载渲染；浏览器验证理论账本不被独立格式选择改写 |

上述测试位于 `tests/`。实现入口为 `src/pages/Models.tsx`、`DeepseekV41.tsx`、`DpaLab.tsx`、`ModelCatalog.tsx`、`ModelCompare.tsx`。版本化来源与逐阶段技术记录见 [model-expansion.md](model-expansion.md)。

## 计算口径与明确限制

- V4/V4.1 当前具体样本是 Flash，不声称展示了同系列全部尺寸或部署后端。
- SGLang 通用基线固定版本：独立 DP 副本、PP=1、MoE DP=1、A2A=none，关闭共享融合、EPLB 和冗余专家。EP 划分已有 TP 组，MoE-TP=TP/EP，Attention 使用完整 TP。
- 独立 DP 不等于 DPA。GLM-5.2 的独立 DPA 实验单独展示 Attention 分组、不均匀请求及 MAX/SUM padding，不把这些缓冲区混入普通 rank 账本。
- V4.1 的并行与混合格式以官方最小参考实现为依据，world 同时决定 Attention TP 和完整专家 EP；没有经过验证的 SGLang V4.1 后端不能标为已验证。
- 专家激活中的 T_e 由真实路由决定。页面给出逻辑 Shape 和严格范围，不伪造精确的 token dispatch 轨迹。
- 统一位宽是理论载荷；专家加载对照是指定 SGLang 分配方法的 payload/scale，不是检查点转换器或整个模型的量化支持清单。V4.1 的原生参考权重则按各自真实格式统计。
- 不把学习顺序当作串行执行顺序，也不把引用的 CED 优化参数量当作最小参考 forward 已运行优化。
- 没有执行 GPU/NPU 模型推理；未验证速度、精度、实际峰值显存或所有硬件的后端可用性。

历史日志中的 All-to-All 动态路由、更多模型的 DPA、视觉分辨率控制、DSpark/CED 优化执行等是进一步扩展方向，尚未实现，不能列入已交付功能；也不将其不断追加为此次页面教学目标的新验收条件。

## 当前基线复验

本次在功能基线重新执行并通过：

- `npm run test:models`：140 项单元测试。
- `npm run test:models:packing`：4 项单元测试、130 个静态渲染组合；包含超过 7,000 个逐层/TP/EP/格式计算样例。
- `npm run test:models:render`：通用模型、V4.1、DPA、目录、对比与模块链接检查。
- `npm run check`、`npm run lint`。
- `npm run test:models:browser`：Chrome 152，360/390/768/1440px，共 143 次宽度检查，未发现页面运行时错误。需要通过环境变量指定可用浏览器依赖，仓库不保存本机依赖路径或浏览器个人资料。

功能基线的生产构建已通过，276 份课程正文仍保持独立分包；本次复验浏览器访问的正是该本地生产产物。

## 发布阻塞与恢复条件

本次只读检查显示，远端 main 仍为 `826d35fd41a124ac829d87216b7fce217682d1a3`；线上入口产物没有 V4.1 和 GLM-5.2 DPA 路由。本地功能基线领先该版本 8 个提交。

对目标仓库执行一次非交互 `git push --dry-run origin HEAD:main`，返回权限拒绝、退出码 128；未修改远端引用，不是非快进冲突，也不是等待中的部署。没有读取或输出凭证值、修改 Git 登录账户或加入任何 API key。

需要用户在本机恢复对目标仓库的 Git 写入权限。恢复后，从干净的模型分支重新获取远端状态；确认远端 main 仍为当前 HEAD 的祖先，再正常快进推送并验证 GitHub Pages 部署及线上路由。若远端已分叉，则先检查差异，不能强推。原始新闻工作区有未提交修改，不得用它直接合并、重置或覆盖模型交付分支。

只有正常推送、部署成功且线上功能复验通过后，才能宣称本次网页目标已完成。
