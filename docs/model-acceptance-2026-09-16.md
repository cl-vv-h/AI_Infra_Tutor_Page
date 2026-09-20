# 模型页面：六项要求验收

> 最新发布状态见 [2026-09-21 上线记录](model-release-2026-09-21.md)。下文保留 9 月 16 日和 20 日的验收与阻塞历史，不代表目前仍无法通过 SSH 发布。

## 2026-09-20 恢复与重新集成

原临时工作区已不存在，但已提交的模型工作完整保存在 Git 中。已从 `5e3d7af` 恢复到持久工作区、分支 `codex/model-delivery`，没有重建或覆盖原新闻工作区的未提交内容。

最新远端 `main` 为 `581539709a4b8cd6b804d71f6b9ca19d61dd6486`。相对 9 月 16 日基线只有五天归档与每日/资料库/版本数据的 8 个新闻文件变化，已无冲突合入；集成提交为 `2611a54`。模型实现、测试及依赖清单与 `5e3d7af` 相同。下文 9 月 16 日的模型计算验收仍是功能基线，不把旧部署状态当新证据。

恢复后重新执行并通过 `npm run check`、`npm run test:models:checkpoint`（12 个单元测试、80 个原生布局渲染）、`npm run test:news`（50 个单元测试）、`npm run test:news:render`、`npm run build`（276 份课程正文独立分包）。新生产构建的 `npm run test:models:browser` 也已完成：Chrome 152.0.7977.83，360/390/768/1440 px，全部交互断言与 311 次宽度检查通过，退出码 0。没有执行 GPU 推理。

集成分支的新闻数据与最新远端完全一致；原新闻工作区未提交文件清单保持不变。相对远端的新增内容再次检查，个人绝对路径、邮箱、常见 API token 模式匹配均为 0；此模式检查不声称覆盖所有敏感信息。

本次读取远端成功；非修改性 Git 推送检查仍被权限拒绝。连接器仍提供仓库写权限，但用户尚未授权默认提交身份。未推送、未改变凭据，也未把本地恢复称为已上线。

## 2026-09-16 功能验收

核对日期：2026-09-16。功能基线 `8c42aa2`，合并远端新闻更新后的验证基线 `8db66ed`；远端 `main` 为 `a55bd0aa9c7331f368e01b6f5a09741b7ff6700e`。

**9 月 16 日结论：下表所列教学场景已实现并通过本地计算与渲染检查；当时尚未发布。** 本文保留本次六项要求的计算核对依据。[旧交付记录](model-delivery-status.md)和[扩展日志](model-expansion.md)保留历史过程，不能用其中旧测试数或旧远端版本判断当前状态。

## 要求与直接证据

| 用户要求 | 当前实现与验收证据 | 不应扩大解释为 |
| --- | --- | --- |
| 1. 计算准确，解释 Kimi 1.56 TB | `kimi-checkpoint-audit.json` 的 96 分片、497,220 张量、216 个模板逐项核对 shape、dtype、offset 和索引。文件总量 **1,560,936,091,448 B**；原生载荷 **1,560,860,324,864 B**。`kimi-checkpoint-audit.test.mjs`、`kimi-native-layout.test.mjs`、`kimi-native-postload.test.mjs` 独立核算文件、加载转换和逐 rank 小计；`model-weights.test.mjs` 核对所有注册 Decoder 定义可计数，并以独立算式验证代表模型、Norm 复制、KV 复制及全部常驻专家。未知 Shape 不显示伪精确总量。 | 文件体积等于单卡显存；所有张量统一 4-bit；只统计 Top-k 活跃专家；已复现用户原来的 1.14 TB 配置。 |
| 2. TP、EP、独立 DP、DP Attention | 普通工作区支持 TP 组内 EP（MoE-TP=TP/EP）、专家 ID/通信组及独立 DP 副本；DPA 工作区分别覆盖 GLM-5.2 的 MLA/DSA 和 Qwen3-8B 的 GQA/Dense。`model-ranks.test.mjs` 与 `dpa-lab.test.mjs` 检查权重复制/分片、请求守恒、不均匀与空组、Attention TP 与总 TP、MAX/SUM 对齐及缓存区别。 | DP 和 DPA 是同一个开关；独立 DP 会把单卡权重再除一次；EP 与 TP 可以重复除专家权重；全部后端都遵循同一通信布局。 |
| 3. 模块级混合精度 | 六个通用模型支持模块策略：GLM-5.2、GLM-5.3-Flash、Kimi-K3、DeepSeek-V4-Flash、Qwen3-8B、Qwen3-30B-A3B。Dense/Shared MLP 可选 BF16/FP8，routed experts 可选 BF16/FP8/MXFP4/W4A8（按分片对齐条件限制）；自定义方案 Router FP32，其余 BF16。`mixed-precision.test.mjs` 独立核对 payload、weight/input scales、W4 初始/后处理及所有层汇总；`w4-lifecycle-render.mjs` 覆盖 124 个页面布局。 | 原生 Kimi Router 权重本来就是 FP32（实际 checkpoint gate 为 BF16）；自定义策略已验证模型质量或 kernel 可运行；W4 的 A8 自动改变所有模块边界激活 dtype。 |
| 4. 热度排序 | `model-popularity.ts` 保存 2026-09-16 的 19 个确切 HF checkpoint 公开近月下载快照；目录默认按下载数降序，缺失值不伪装成零，并支持名称/原目录顺序。`model-catalog.test.mjs` 检查数值排序、稳定平局、URL 与 30 天过期提醒；浏览器检查排序、筛选、选择和重载。 | 实时全网热度、质量排行榜，或收集访客个人行为。 |
| 5. 展示与学习效率 | 目录卡片按需展开，分为结构/缓存/权重工作区；权重范围入口可聚焦当前模块、全部 Decoder 或 Kimi 完整文件。先选 DP 副本再选其 TP rank，避免一次堆满 64 张卡；公式、内部张量、专家归属和审计明细默认折叠。`weight-reading-render.mjs` 覆盖 128 个 model/TP/replica/rank 组合、可达性和统计范围；真实浏览器检查四种宽度、键盘与滑块。 | 已通过真实用户学习效率研究，或仅凭静态渲染就证明实际交互可用。 |
| 6. 拖动参数看每 rank 的输入/输出/权重 Shape 与字节 | `ModelRankWorkbench` 联动阶段、B/S、TP、EP、DP、层/模块、精度及 rank；显示模块边界、内部张量、专家激活逻辑 Shape、逻辑权重与 packed/scale 布局、单 rank/TP 组/全副本字节。三种 GQA 模型额外展示 Q/KV head 归属及复制 peers；DPA 展示实际请求组和对齐行数。`model-ranks.test.mjs`、`attention-heads.ts` 对应测试、`expert-packing.test.mjs`、DPA 测试及浏览器检查证明这些联动。 | 未运行模型就知道实际 token-to-expert 路由；把动态 T_e 均分；把输入、输出和 views 相加当峰值内存。 |

## 数值口径抽查

- Kimi TP1：完整文件 **1.560936091448 TB / 1.419663104978099 TiB**。同一完整元数据映射到固定 SGLang 加载初始参数为 **1,562,464,095,360 B/rank**；后处理已核对持久张量小计为 **1,564,681,137,280 B/rank**。这三者范围不同，不能互换。完整推导与固定来源见 [Kimi 审计](kimi-checkpoint-audit.md)。
- Kimi TP8：EP1/EP8 初始参数分别为 **206,668,769,776 / 206,151,756,272 B/rank**；差别包含复制零 bias，而不是重复除专家权重。独立 DP 增加完整组的副本数，不缩小单卡参数。
- Qwen3-8B：36 层 Decoder 的 BF16 TP1 小计 **13,892,143,104 B**；仅 MLP 改 FP8 后为 **8,457,652,224 B**，TP8 为 **1,057,738,752 B/rank**，包含 FP32 block scales 和复制 Norm。它们不含 Embedding/LM Head，见 [Dense 精度核对](qwen3-dense-precision.md)。
- Qwen3-30B-A3B：TP8 的四个 KV heads 在八个 ranks 间复制，每组两个 ranks 共用一个 KV head 分片；EP 不改变 Attention。W4/FP8 要求 MoE-TP 为 1 或 2，其他分片不能悄悄向上取整冒充受支持格式，见 [MoE 核对](qwen3-moe-precision.md)及 [head 归属](attention-head-ownership.md)。
- Qwen3-8B DPA：TP8/DPA4，请求 `[3,1,0,2]`、S128、缓存 2 B/元素时，各 rank KV 为 `[27,27,9,9,0,0,18,18] MiB`，全卡 108 MiB。空请求组仍有权重；同请求数下 GQA 全卡 KV 不因 DPA 改变，见 [DPA 核对](qwen3-dpa.md)。

## 验证记录

以下命令在合并远端新闻后的 `8db66ed` 已完成且退出码为 0；不是仅保留上一版本结果：

```sh
npm run check
npm run lint
npm run test:news
npm run test:news:render
npm run test:models
npm run test:models:render
npm run test:models:mixed
npm run test:models:packing
npm run test:models:checkpoint
npm run build
```

生产构建确认 276 份课程正文保持独立分包。静态渲染包括：19 张目录卡片/27 组筛选、240 个 V4.1 路由、40 个 Qwen DPA 路由、48 个混合 DPA 路由、30 个 GLM DPA 路由、128 个权重阅读组合、140 个专家布局及 80 个 Kimi 原生布局。

最新生产产物的 `npm run test:models:browser` 已完成、退出码为 0：Chrome 152.0.7977.83，360/390/768/1440 px，311 次宽度溢出检查通过，无捕获到的页面运行时错误。脚本同时执行排序/筛选、真实滑块、TP/EP 动态边界、DP/rank 选择、混合精度/W4 阶段、DPA、键盘操作与 URL 重载断言；不是只有截图或页面加载检查。浏览器使用隔离上下文，只允许本地预览来源，不使用个人浏览器资料。

对相对远端的 80 个变更文件新增行执行隐私检查：个人绝对路径、常见 API token 模式、邮箱匹配数均为 0。此检查是发布前防线之一，不代表能够证明不存在所有形式的敏感信息。没有修改原新闻工作区、周报模型或凭据。

## 发布门槛与剩余事项

远端最新新闻更新已无冲突合入模型分支；当前线上入口仍为 `index-BYG6INwK.js`，本地新构建为 `index-DaqPrEh0.js`。不能把本地结果说成线上已提供。

本机 Git 的最近一次非修改性推送检查被权限拒绝。现有 GitHub 连接有仓库写权限，但其创建提交接口不提供机器人 author/committer 字段；使用默认身份可能公开账号作者信息。**发布方式等待用户选择：恢复本机 Git 写权限并保留现有机器人提交，或允许连接器默认提交身份。** 不提取凭证、不更换登录、不强推，也不绕过这个身份选择。

获准且通道可用后：重新获取远端，保留期间的新提交，以非强推方式发布；核对远端树、Pages 部署成功和线上计算/交互，才能完成网站交付。若远端变化，重新比较并验证，不覆盖新闻内容。

本次验收不要求额外完成 GPU/NPU 推理、所有硬件 kernel、所有模型 DPA、PP/CP/EPLB 或峰值显存分析；这些未实现能力不能标成已支持，也不应被不断添加成无限扩展的验收条件。现有声明必须严格限定为页面已经展示并核对的教学场景。
